/**
 * NominaService — ciclo de liquidación de nómina.
 *
 * Máquina de estados del periodo:
 *
 *   borrador ──liquidar──> en_revision ──aprobar──> aprobada ──pagar──> pagada
 *      ▲                        │
 *      └────── reabrir ─────────┘
 *
 * Reglas que hacen que esto sea nómina y no una hoja de cálculo:
 *   • No se liquida con parámetros legales sin verificar. Antes que liquidar
 *     con un salario mínimo equivocado, se falla.
 *   • Aprobación a cuatro ojos: quien aprueba no puede ser quien liquidó.
 *   • Una vez aprobada NO se reliquida. Los errores se corrigen con un periodo
 *     de ajuste, que es como funciona la contabilidad.
 *   • El salario y los datos bancarios quedan CONGELADOS en el detalle: subir
 *     un sueldo mañana no cambia lo que ya se liquidó.
 */

import { EstadoLaboral, EstadoPeriodoNomina, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { nominaRepository } from '../repositories/nomina.repository';
import { NotFoundError, BadRequestError, ConflictError } from '../exceptions/HttpErrors';
import { liquidar, costoTotalEmpleador, DIAS_MES_COMERCIAL } from '../lib/nomina/calculadora';
import type { NovedadCalculo, ParametrosLegales } from '../lib/nomina/tipos';
import { getEstadoFinalId } from '../lib/estadoOrden';

// ─── Parámetros ───────────────────────────────────────────────────────────────

const aNumero = (v: Prisma.Decimal | number): number => Number(v);

/** Convierte la fila de BD (Decimals) en los números que consume el motor. */
function aParametrosLegales(p: NonNullable<Awaited<ReturnType<typeof nominaRepository.findParametros>>>): ParametrosLegales {
  return {
    anio:                        p.anio,
    salario_minimo:              aNumero(p.salario_minimo),
    auxilio_transporte:          aNumero(p.auxilio_transporte),
    tope_auxilio_smmlv:          p.tope_auxilio_smmlv,
    uvt:                         aNumero(p.uvt),
    porc_salud_empleado:         aNumero(p.porc_salud_empleado),
    porc_pension_empleado:       aNumero(p.porc_pension_empleado),
    porc_salud_empleador:        aNumero(p.porc_salud_empleador),
    porc_pension_empleador:      aNumero(p.porc_pension_empleador),
    porc_caja_compensacion:      aNumero(p.porc_caja_compensacion),
    porc_icbf:                   aNumero(p.porc_icbf),
    porc_sena:                   aNumero(p.porc_sena),
    porc_recargo_nocturno:       aNumero(p.porc_recargo_nocturno),
    porc_extra_diurna:           aNumero(p.porc_extra_diurna),
    porc_extra_nocturna:         aNumero(p.porc_extra_nocturna),
    porc_dominical:              aNumero(p.porc_dominical),
    porc_extra_dominical_diurna: aNumero(p.porc_extra_dominical_diurna),
    horas_mensuales:             p.horas_mensuales,
    porc_cesantias:              aNumero(p.porc_cesantias),
    porc_interes_cesantias:      aNumero(p.porc_interes_cesantias),
    porc_prima:                  aNumero(p.porc_prima),
    porc_vacaciones:             aNumero(p.porc_vacaciones),
  };
}

// ─── Excepciones de la prenómina ──────────────────────────────────────────────

export interface ExcepcionPrenomina {
  id_empleado: number;
  empleado:    string;
  severidad:   'bloqueante' | 'advertencia';
  mensaje:     string;
}

/**
 * Semáforo previo a liquidar. Lo BLOQUEANTE impide liquidar al empleado; la
 * ADVERTENCIA deja pasar pero avisa. Es lo que separa una nómina revisada de
 * una que se descubre rota el día del pago.
 */
function revisarEmpleado(
  e: { id: number; nombre_completo: string; nomina: unknown; eps: string | null;
       afp: string | null; arl: string | null; documento_identidad: string | null },
  salarioMinimo: number,
): ExcepcionPrenomina[] {
  const out: ExcepcionPrenomina[] = [];
  const base = { id_empleado: e.id, empleado: e.nombre_completo };
  const nomina = e.nomina as { salario_base: Prisma.Decimal; numero_cuenta: string | null } | null;

  if (!nomina) {
    out.push({ ...base, severidad: 'bloqueante', mensaje: 'No tiene salario registrado en su ficha.' });
    return out;   // sin salario no tiene sentido seguir revisando
  }

  const salario = aNumero(nomina.salario_base);
  if (salario <= 0) {
    out.push({ ...base, severidad: 'bloqueante', mensaje: 'El salario registrado es cero.' });
  } else if (salario < salarioMinimo) {
    out.push({
      ...base, severidad: 'bloqueante',
      mensaje: `El salario ($${salario.toLocaleString('es-CO')}) es inferior al mínimo legal.`,
    });
  }

  if (!nomina.numero_cuenta) {
    out.push({ ...base, severidad: 'advertencia', mensaje: 'Sin cuenta bancaria: no entrará en el archivo de dispersión.' });
  }
  if (!e.documento_identidad) {
    out.push({ ...base, severidad: 'advertencia', mensaje: 'Sin documento de identidad registrado.' });
  }
  const faltantes = [!e.eps && 'EPS', !e.afp && 'fondo de pensiones', !e.arl && 'ARL'].filter(Boolean);
  if (faltantes.length) {
    out.push({ ...base, severidad: 'advertencia', mensaje: `Sin ${faltantes.join(', ')} registrada(s) para PILA.` });
  }

  return out;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const nominaService = {

  // ── Parámetros legales ───────────────────────────────────────────────────

  listarParametros: () => nominaRepository.listarParametros(),

  async obtenerParametros(anio: number) {
    const p = await nominaRepository.findParametros(anio);
    if (!p) {
      throw new BadRequestError(
        `No hay parámetros legales cargados para ${anio}. ` +
        `Cárgalos en Nómina → Parámetros antes de liquidar.`
      );
    }
    return p;
  },

  guardarParametros(anio: number, data: Record<string, unknown>) {
    // Cambiar un valor invalida la verificación: hay que volver a confirmarlo
    return nominaRepository.upsertParametros(anio, {
      ...data, anio, verificado: false, verificado_por: null, fecha_verificacion: null,
    } as Prisma.ParametroNominaUncheckedCreateInput);
  },

  verificarParametros(anio: number, idUsuario: number) {
    return nominaRepository.verificarParametros(anio, idUsuario);
  },

  // ── Periodos ─────────────────────────────────────────────────────────────

  listarPeriodos: (grupoId?: number, anio?: number) =>
    nominaRepository.listarPeriodos(grupoId, anio),

  async obtenerPeriodo(id: number, grupoId?: number) {
    const p = await nominaRepository.findPeriodo(id, grupoId);
    if (!p) throw new NotFoundError('Periodo de nómina');
    return p;
  },

  async crearPeriodo(data: {
    nombre: string; tipo_periodo: string;
    fecha_inicio: string | Date; fecha_fin: string | Date;
    id_restaurante?: number | null;
  }, grupoId: number) {
    const inicio = new Date(data.fecha_inicio);
    const fin    = new Date(data.fecha_fin);
    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      throw new BadRequestError('Fechas inválidas');
    }
    if (fin < inicio) throw new BadRequestError('La fecha final no puede ser anterior a la inicial');

    const sede = data.id_restaurante ?? null;
    const solapado = await nominaRepository.findPeriodoSolapado(grupoId, sede, inicio, fin);
    if (solapado) {
      throw new ConflictError(
        `Las fechas se cruzan con el periodo "${solapado.nombre}". ` +
        `Liquidar dos veces el mismo rango pagaría doble.`
      );
    }

    // Se valida al crear, no al liquidar: mejor enterarse antes de cargar novedades
    await this.obtenerParametros(inicio.getFullYear());

    return nominaRepository.crearPeriodo({
      nombre:       data.nombre,
      tipo_periodo: data.tipo_periodo,
      fecha_inicio: inicio,
      fecha_fin:    fin,
      anio:         inicio.getFullYear(),
      id_grupo:     grupoId,
      id_restaurante: sede,
    });
  },

  // ── Prenómina ────────────────────────────────────────────────────────────

  /**
   * Revisión previa: qué empleados entran y qué problemas hay. No escribe nada.
   */
  async prenomina(idPeriodo: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);
    const params  = await this.obtenerParametros(periodo.anio);

    const empleados = await nominaRepository.empleadosLiquidables(
      periodo.id_grupo, periodo.id_restaurante, periodo.fecha_inicio,
    );

    const excepciones = empleados.flatMap(e =>
      revisarEmpleado(e, aNumero(params.salario_minimo)));

    const bloqueantes = excepciones.filter(x => x.severidad === 'bloqueante');
    const idsBloqueados = new Set(bloqueantes.map(x => x.id_empleado));

    return {
      periodo,
      parametros_verificados: params.verificado,
      anio_parametros:        params.anio,
      total_empleados:        empleados.length,
      liquidables:            empleados.length - idsBloqueados.size,
      bloqueados:             idsBloqueados.size,
      excepciones,
      puede_liquidar: params.verificado
        && empleados.length > 0
        && idsBloqueados.size < empleados.length,
    };
  },

  // ── Liquidación ──────────────────────────────────────────────────────────

  /**
   * liquidar — calcula y guarda el detalle de todos los empleados del periodo.
   * Reliquidar un periodo en borrador borra el detalle previo y lo recalcula.
   */
  async liquidarPeriodo(idPeriodo: number, idUsuario: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);

    if (periodo.estado !== EstadoPeriodoNomina.borrador
      && periodo.estado !== EstadoPeriodoNomina.en_revision) {
      throw new ConflictError(
        `El periodo está "${periodo.estado}" y ya no se puede reliquidar. ` +
        `Para corregirlo crea un periodo de ajuste.`
      );
    }

    const paramsBD = await this.obtenerParametros(periodo.anio);
    if (!paramsBD.verificado) {
      throw new BadRequestError(
        `Los parámetros legales de ${periodo.anio} no han sido verificados. ` +
        `Confírmalos en Nómina → Parámetros antes de liquidar: liquidar con un ` +
        `salario mínimo equivocado afecta a toda la nómina.`
      );
    }
    const params = aParametrosLegales(paramsBD);

    const [empleados, novedades] = await Promise.all([
      nominaRepository.empleadosLiquidables(periodo.id_grupo, periodo.id_restaurante, periodo.fecha_inicio),
      nominaRepository.listarNovedades(idPeriodo),
    ]);

    const novedadesPorEmpleado = new Map<number, NovedadCalculo[]>();
    for (const n of novedades) {
      const lista = novedadesPorEmpleado.get(n.id_empleado) ?? [];
      lista.push({ tipo: n.tipo, cantidad: aNumero(n.cantidad), valor: aNumero(n.valor) });
      novedadesPorEmpleado.set(n.id_empleado, lista);
    }

    const totales = {
      devengado: 0, deducciones: 0, neto: 0, aportes: 0, provisiones: 0, empleados: 0,
    };

    await prisma.$transaction(async (tx) => {
      await nominaRepository.borrarDetalles(idPeriodo, tx);

      for (const e of empleados) {
        const problemas = revisarEmpleado(e, aNumero(paramsBD.salario_minimo));
        if (problemas.some(p => p.severidad === 'bloqueante')) continue;

        const nomina = e.nomina!;
        const salario = aNumero(nomina.salario_base);

        // Un empleado retirado a mitad de periodo solo se liquida hasta su
        // fecha de retiro.
        let dias = DIAS_MES_COMERCIAL;
        if (e.estado_laboral === EstadoLaboral.retirado && e.fecha_retiro
          && e.fecha_retiro <= periodo.fecha_fin) {
          const transcurridos = Math.floor(
            (e.fecha_retiro.getTime() - periodo.fecha_inicio.getTime()) / 86_400_000,
          ) + 1;
          dias = Math.max(0, Math.min(DIAS_MES_COMERCIAL, transcurridos));
        }

        const r = liquidar({
          salario_base:     salario,
          dias_trabajados:  dias,
          novedades:        novedadesPorEmpleado.get(e.id) ?? [],
          nivel_riesgo_arl: e.nivel_riesgo_arl,
        }, params);

        await nominaRepository.crearDetalle({
          id_periodo:        idPeriodo,
          id_empleado:       e.id,
          salario_base:      salario,
          dias_trabajados:   r.dias_liquidados,
          ibc:               r.ibc,
          total_devengado:   r.total_devengado,
          total_deducciones: r.total_deducciones,
          neto_pagar:        r.neto_pagar,
          aportes_empleador: r.aportes_empleador,
          provisiones:       r.provisiones,
          banco:             nomina.banco,
          tipo_cuenta:       nomina.tipo_cuenta,
          numero_cuenta:     nomina.numero_cuenta,
        }, r.conceptos.map(c => ({
          codigo: c.codigo, nombre: c.nombre, tipo: c.tipo,
          cantidad: c.cantidad, valor: c.valor, orden: c.orden,
        })), tx);

        totales.devengado   += r.total_devengado;
        totales.deducciones += r.total_deducciones;
        totales.neto        += r.neto_pagar;
        totales.aportes     += r.aportes_empleador;
        totales.provisiones += r.provisiones;
        totales.empleados   += 1;
      }

      await nominaRepository.actualizarPeriodo(idPeriodo, {
        estado:                  EstadoPeriodoNomina.en_revision,
        total_devengado:         totales.devengado,
        total_deducciones:       totales.deducciones,
        total_neto:              totales.neto,
        total_aportes_empleador: totales.aportes,
        total_provisiones:       totales.provisiones,
        empleados_liquidados:    totales.empleados,
        id_liquidado_por:        idUsuario,
        fecha_liquidacion:       new Date(),
      }, tx);
    });

    return this.obtenerPeriodo(idPeriodo, grupoId);
  },

  /**
   * aprobar — control a cuatro ojos.
   * Quien aprueba no puede ser quien liquidó: es la separación de funciones
   * que evita que una sola persona genere y autorice un pago.
   */
  async aprobarPeriodo(idPeriodo: number, idUsuario: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);

    if (periodo.estado !== EstadoPeriodoNomina.en_revision) {
      throw new ConflictError(`Solo se aprueba un periodo en revisión (está "${periodo.estado}").`);
    }
    if (periodo.id_liquidado_por === idUsuario) {
      throw new ConflictError(
        'Quien liquidó el periodo no puede aprobarlo. La nómina requiere que la ' +
        'apruebe una segunda persona.'
      );
    }
    if (periodo.empleados_liquidados === 0) {
      throw new BadRequestError('El periodo no tiene empleados liquidados.');
    }

    return nominaRepository.actualizarPeriodo(idPeriodo, {
      estado:           EstadoPeriodoNomina.aprobada,
      id_aprobado_por:  idUsuario,
      fecha_aprobacion: new Date(),
    });
  },

  async marcarPagado(idPeriodo: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);
    if (periodo.estado !== EstadoPeriodoNomina.aprobada) {
      throw new ConflictError('Solo se marca como pagado un periodo aprobado.');
    }
    return nominaRepository.actualizarPeriodo(idPeriodo, {
      estado: EstadoPeriodoNomina.pagada, fecha_pago: new Date(),
    });
  },

  /** Devuelve un periodo en revisión a borrador para corregir novedades. */
  async reabrirPeriodo(idPeriodo: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);
    if (periodo.estado !== EstadoPeriodoNomina.en_revision) {
      throw new ConflictError(
        `Solo se reabre un periodo en revisión. Un periodo aprobado o pagado se ` +
        `corrige con un periodo de ajuste.`
      );
    }
    return nominaRepository.actualizarPeriodo(idPeriodo, { estado: EstadoPeriodoNomina.borrador });
  },

  // ── Novedades ────────────────────────────────────────────────────────────

  listarNovedades: (idPeriodo: number) => nominaRepository.listarNovedades(idPeriodo),

  async crearNovedad(idPeriodo: number, data: {
    id_empleado: number; tipo: string; cantidad?: number; valor?: number;
    observaciones?: string;
  }, idUsuario: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);
    if (periodo.estado !== EstadoPeriodoNomina.borrador
      && periodo.estado !== EstadoPeriodoNomina.en_revision) {
      throw new ConflictError('No se pueden agregar novedades a un periodo aprobado o pagado.');
    }

    return nominaRepository.crearNovedad({
      id_periodo:  idPeriodo,
      id_empleado: data.id_empleado,
      tipo:        data.tipo as Prisma.NovedadNominaUncheckedCreateInput['tipo'],
      cantidad:    data.cantidad ?? 0,
      valor:       data.valor ?? 0,
      observaciones: data.observaciones,
      id_registrado_por: idUsuario,
    });
  },

  async eliminarNovedad(id: number, grupoId?: number) {
    const novedad = await nominaRepository.findNovedad(id);
    if (!novedad) throw new NotFoundError('Novedad');
    if (grupoId && novedad.periodo.id_grupo !== grupoId) throw new NotFoundError('Novedad');
    if (novedad.periodo.estado !== EstadoPeriodoNomina.borrador
      && novedad.periodo.estado !== EstadoPeriodoNomina.en_revision) {
      throw new ConflictError('No se pueden eliminar novedades de un periodo aprobado o pagado.');
    }
    return nominaRepository.eliminarNovedad(id);
  },

  // ── Detalles y métricas ──────────────────────────────────────────────────

  listarDetalles: (idPeriodo: number) => nominaRepository.listarDetalles(idPeriodo),

  async obtenerDetalle(idPeriodo: number, idEmpleado: number, grupoId?: number) {
    await this.obtenerPeriodo(idPeriodo, grupoId);
    const d = await nominaRepository.findDetalle(idPeriodo, idEmpleado);
    if (!d) throw new NotFoundError('Liquidación del empleado');
    return d;
  },

  /**
   * costoLaboral — porcentaje del costo de nómina sobre las ventas del periodo.
   *
   * Es la métrica reina en restaurantes (sano: 25-32 %) y solo se puede
   * calcular porque la nómina vive DENTRO del POS: un software de nómina
   * aparte no conoce las ventas.
   */
  async costoLaboral(idPeriodo: number, grupoId?: number) {
    const periodo = await this.obtenerPeriodo(idPeriodo, grupoId);
    const idEstadoFinal = await getEstadoFinalId();

    const ventas = await nominaRepository.ventasDelPeriodo(
      periodo.id_grupo, periodo.id_restaurante,
      periodo.fecha_inicio, periodo.fecha_fin, idEstadoFinal,
    );

    const totalVentas = aNumero(ventas._sum.total ?? 0);
    const costoTotal  = aNumero(periodo.total_devengado)
                      + aNumero(periodo.total_aportes_empleador)
                      + aNumero(periodo.total_provisiones);

    return {
      ventas:            totalVentas,
      costo_nomina:      aNumero(periodo.total_devengado),
      costo_total:       costoTotal,
      // null cuando no hay ventas: un porcentaje sobre cero no significa nada
      porcentaje:        totalVentas > 0 ? (costoTotal / totalVentas) * 100 : null,
      empleados:         periodo.empleados_liquidados,
      venta_por_empleado: periodo.empleados_liquidados > 0
        ? totalVentas / periodo.empleados_liquidados
        : 0,
    };
  },

  /**
   * simularCosto — cuánto cuesta REALMENTE pagar un salario.
   * Responde a "si le subo a X, ¿cuánto me cuesta?" con el factor prestacional.
   */
  async simularCosto(salario: number, anio: number, nivelRiesgo?: string) {
    const paramsBD = await this.obtenerParametros(anio);
    const params   = aParametrosLegales(paramsBD);

    const r = liquidar({
      salario_base: salario, dias_trabajados: DIAS_MES_COMERCIAL,
      novedades: [], nivel_riesgo_arl: nivelRiesgo,
    }, params);

    const costo = costoTotalEmpleador(r);
    return {
      salario_base:      salario,
      neto_empleado:     r.neto_pagar,
      total_devengado:   r.total_devengado,
      aportes_empleador: r.aportes_empleador,
      provisiones:       r.provisiones,
      costo_total:       costo,
      factor_prestacional: salario > 0 ? costo / salario : 0,
    };
  },
};
