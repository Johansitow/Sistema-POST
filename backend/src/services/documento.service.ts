/**
 * DocumentoService — emisión y verificación de documentos laborales.
 *
 * Reglas de negocio:
 *   • El HTML se renderiza aquí y se guarda como SNAPSHOT. Reimprimir un
 *     documento devuelve el snapshot, nunca lo vuelve a renderizar: si la
 *     plantilla cambió, el documento emitido debe seguir diciendo lo mismo.
 *   • El consecutivo es por tipo, grupo y año (CL-2026-0001).
 *   • La verificación pública devuelve el mínimo indispensable: confirma
 *     autenticidad sin revelar el salario.
 */

import crypto from 'crypto';
import { EstadoLaboral } from '@prisma/client';
import prisma from '../config/database';
import { documentoRepository } from '../repositories/documento.repository';
import { usuarioRepository } from '../repositories/usuario.repository';
import { plantillaRepository } from '../repositories/plantilla.repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../exceptions/HttpErrors';
import { CATALOGO_DOCUMENTOS, esTipoDocumento, type TipoDocumento, type DocumentoConfig } from '../lib/documentos/catalogo';
import { renderizarDocumento, renderizarDesprendible } from '../lib/documentos/documentoRenderer';
import { listarVariablesDisponibles, type ContextoDocumento } from '../lib/documentos/variables';
import { config } from '../config/env';

/** Alfabeto sin caracteres ambiguos (0/O, 1/I) — el código se dicta por teléfono. */
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD_CODIGO = 10;

function generarCodigo(): string {
  const bytes = crypto.randomBytes(LONGITUD_CODIGO);
  return Array.from(bytes, b => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
}

const sha256 = (texto: string) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

/**
 * Datos reunidos antes de renderizar. Se declara explícitamente (en vez de
 * inferirlo con ReturnType) porque el service se referencia a sí mismo y
 * TypeScript no puede resolver el tipo circular.
 */
interface BaseDocumento {
  meta:        (typeof CATALOGO_DOCUMENTOS)[TipoDocumento];
  empleado:    Record<string, any>;
  sede:        { id: number; nombre: string; nit: string | null; ciudad: string | null;
                 direccion: string | null; telefono: string | null; logo_url: string | null;
                 id_grupo: number } | null;
  grupo:       { id: number; nombre: string; nit: string | null; logo_url: string | null };
  nomina:      { salario_base: unknown; tipo_pago: string } | null;
  plantilla:   DocumentoConfig;
  idPlantilla: number | null;
  idGrupo:     number;
}

/**
 * URL pública de verificación; el frontend expone /verificar/:codigo.
 * Se reutiliza CORS_ORIGIN, que ya apunta al frontend: así el QR impreso
 * lleva al dominio correcto sin añadir otra variable de entorno que se
 * quedaría desactualizada.
 */
const urlVerificacion = (codigo: string) =>
  `${config.cors.origin.split(',')[0].trim()}/verificar/${codigo}`;

export const documentoService = {

  /** Catálogo de tipos disponibles, para el selector del frontend. */
  listarTipos() {
    return Object.values(CATALOGO_DOCUMENTOS).map(
      ({ tipo, nombre, descripcion, requiereRetiro, requierePeriodo }) => ({
        tipo, nombre, descripcion, requiereRetiro, requierePeriodo: !!requierePeriodo,
      }));
  },

  /**
   * Datos de la liquidación para el desprendible de pago.
   * Se exige que el periodo esté APROBADO o PAGADO: emitir una colilla de una
   * liquidación en borrador sería entregar cifras que aún pueden cambiar.
   */
  async _datosDesprendible(idEmpleado: number, idPeriodo: number, grupoId?: number) {
    const detalle = await prisma.nominaDetalle.findUnique({
      where:   { id_periodo_id_empleado: { id_periodo: idPeriodo, id_empleado: idEmpleado } },
      include: { periodo: true, conceptos: { orderBy: { orden: 'asc' } } },
    });

    if (!detalle) {
      throw new BadRequestError(
        'El empleado no tiene liquidación en ese periodo. Liquida el periodo antes de emitir el desprendible.'
      );
    }
    if (grupoId && detalle.periodo.id_grupo !== grupoId) throw new NotFoundError('Periodo de nómina');

    if (detalle.periodo.estado !== 'aprobada' && detalle.periodo.estado !== 'pagada') {
      throw new BadRequestError(
        `El periodo está "${detalle.periodo.estado}". El desprendible solo se emite ` +
        `sobre una nómina aprobada: antes de eso las cifras todavía pueden cambiar.`
      );
    }

    return {
      periodo_nombre: detalle.periodo.nombre,
      fecha_inicio:   detalle.periodo.fecha_inicio,
      fecha_fin:      detalle.periodo.fecha_fin,
      dias:           Number(detalle.dias_trabajados),
      salario_base:   Number(detalle.salario_base),
      ibc:            Number(detalle.ibc),
      conceptos: detalle.conceptos.map(c => ({
        codigo: c.codigo, nombre: c.nombre, tipo: c.tipo,
        cantidad: Number(c.cantidad), valor: Number(c.valor),
      })),
      total_devengado:   Number(detalle.total_devengado),
      total_deducciones: Number(detalle.total_deducciones),
      neto_pagar:        Number(detalle.neto_pagar),
      banco:             detalle.banco,
      numero_cuenta:     detalle.numero_cuenta,
    };
  },

  listarVariables() {
    return listarVariablesDisponibles();
  },

  /**
   * Reúne los datos del empleado, la empresa y la plantilla efectiva.
   * Es la base tanto del preview como de la emisión, para que no puedan
   * divergir.
   */
  async _construirContexto(tipo: TipoDocumento, idEmpleado: number, grupoId?: number): Promise<BaseDocumento> {
    const meta = CATALOGO_DOCUMENTOS[tipo];

    const empleado = await usuarioRepository.findById(idEmpleado) as any;
    if (!empleado) throw new NotFoundError('Empleado');

    if (grupoId) {
      const pertenece = await usuarioRepository.perteneceAGrupo(idEmpleado, grupoId);
      if (!pertenece) throw new NotFoundError('Empleado');
    }

    if (meta.requiereRetiro && empleado.estado_laboral !== EstadoLaboral.retirado) {
      throw new BadRequestError(
        `"${meta.nombre}" solo puede emitirse a empleados con estado laboral "retirado". ` +
        `Registra primero el retiro en la ficha del empleado.`
      );
    }

    // La sede base del empleado ancla el tenant y aporta los datos del membrete;
    // si no la tiene, se usa el grupo.
    const sede = empleado.restaurante_base
      ? await prisma.restaurante.findUnique({
          where:  { id: empleado.restaurante_base.id },
          select: { id: true, nombre: true, nit: true, ciudad: true, direccion: true,
                    telefono: true, logo_url: true, id_grupo: true },
        })
      : null;

    const idGrupo = sede?.id_grupo ?? grupoId;
    if (!idGrupo) {
      throw new BadRequestError(
        'No se pudo determinar la empresa del empleado. Asígnale una sede de nómina en su ficha.'
      );
    }

    const grupo = await prisma.grupoNegocio.findUnique({
      where:  { id: idGrupo },
      select: { id: true, nombre: true, nit: true, logo_url: true },
    });
    if (!grupo) throw new NotFoundError('Grupo de negocio');

    const nomina = await usuarioRepository.findNomina(idEmpleado);

    // Plantilla del grupo si existe; si no, la del catálogo
    const plantillaBD = await plantillaRepository.findAll(tipo, { id_grupo: idGrupo })
      .then(list => list.find(p => p.es_default) ?? list[0] ?? null);

    const plantilla = (plantillaBD?.plantilla as unknown as DocumentoConfig) ?? meta.plantilla;

    return {
      meta, empleado, sede, grupo, nomina,
      plantilla,
      idPlantilla: plantillaBD?.id ?? null,
      idGrupo,
    };
  },

  _contexto(base: BaseDocumento, extra: {
    consecutivo: string; codigo: string; observaciones?: string; firmante: string;
  }): ContextoDocumento {
    const { empleado, sede, grupo, nomina, plantilla } = base;

    return {
      empleado: {
        nombre_completo:     empleado.nombre_completo,
        tipo_documento:      empleado.tipo_documento,
        documento_identidad: empleado.documento_identidad,
        cargo:               empleado.cargo,
        fecha_ingreso:       empleado.fecha_ingreso,
        fecha_retiro:        empleado.fecha_retiro,
        motivo_retiro:       empleado.motivo_retiro,
        tipo_contrato:       empleado.tipo_contrato,
        jornada:             empleado.jornada,
        codigo_empleado:     empleado.codigo_empleado,
        email:               empleado.email,
        telefono:            empleado.telefono,
      },
      empresa: {
        nombre:    sede?.nombre    ?? grupo.nombre,
        nit:       sede?.nit       ?? grupo.nit,
        ciudad:    sede?.ciudad    ?? null,
        direccion: sede?.direccion ?? null,
        telefono:  sede?.telefono  ?? null,
      },
      nomina: nomina
        ? { salario_base: Number(nomina.salario_base), tipo_pago: nomina.tipo_pago }
        : null,
      // Si la plantilla no fija un firmante, firma quien emite el documento
      firma: {
        nombre: plantilla.documento.firma.nombre || extra.firmante,
        cargo:  plantilla.documento.firma.cargo  || 'Representante Legal',
      },
      consecutivo:   extra.consecutivo,
      codigo:        extra.codigo,
      observaciones: extra.observaciones,
      fechaEmision:  new Date(),
    };
  },

  /**
   * previsualizar — renderiza SIN persistir, para revisar antes de emitir.
   * Usa el mismo renderer que la emisión, así que lo que se ve es lo que sale.
   */
  async previsualizar(tipo: string, idEmpleado: number, opciones: {
    observaciones?: string; firmante: string;
  }, grupoId?: number) {
    if (!esTipoDocumento(tipo)) throw new BadRequestError('Tipo de documento inválido');

    const base = await this._construirContexto(tipo, idEmpleado, grupoId);
    const ctx  = this._contexto(base, {
      consecutivo:   `${base.meta.prefijo}-${new Date().getFullYear()}-BORRADOR`,
      codigo:        'PREVIEW',
      observaciones: opciones.observaciones,
      firmante:      opciones.firmante,
    });

    const dias = base.plantilla.documento.vigencia_dias;
    const { html } = await renderizarDocumento({
      plantilla:       base.plantilla,
      contexto:        ctx,
      urlVerificacion: urlVerificacion('PREVIEW'),
      vigenciaHasta:   dias > 0 ? new Date(Date.now() + dias * 86_400_000) : null,
      logoUrl:         base.sede?.logo_url ?? base.grupo.logo_url,
    });

    return { html, tipo, nombre: base.meta.nombre };
  },

  /**
   * emitir — renderiza, calcula el hash y guarda el snapshot inmutable.
   *
   * El consecutivo se calcula dentro de la transacción para que dos emisiones
   * simultáneas no reciban el mismo número.
   */
  async emitir(tipo: string, idEmpleado: number, opciones: {
    observaciones?: string; id_periodo?: number;
  }, emisor: { id: number; nombre: string }, grupoId?: number) {
    if (!esTipoDocumento(tipo)) throw new BadRequestError('Tipo de documento inválido');

    const base = await this._construirContexto(tipo, idEmpleado, grupoId);
    const anio = new Date().getFullYear();

    // El desprendible se arma con la liquidación real, no con párrafos
    const datosNomina = base.meta.requierePeriodo
      ? await (async () => {
          if (!opciones.id_periodo) {
            throw new BadRequestError('Indica el periodo de nómina del desprendible');
          }
          return this._datosDesprendible(idEmpleado, opciones.id_periodo, grupoId);
        })()
      : null;

    return prisma.$transaction(async (tx) => {
      const ultimo = await documentoRepository.findUltimoDelAnio(tipo, base.idGrupo, anio, tx);
      const secuencia = ultimo
        ? parseInt(ultimo.consecutivo.split('-').pop() ?? '0', 10) + 1
        : 1;

      const consecutivo = `${base.meta.prefijo}-${anio}-${String(secuencia).padStart(4, '0')}`;
      const codigo      = generarCodigo();

      const ctx  = this._contexto(base, {
        consecutivo, codigo,
        observaciones: opciones.observaciones,
        firmante:      emisor.nombre,
      });

      const dias = base.plantilla.documento.vigencia_dias;
      const vigenciaHasta = dias > 0 ? new Date(Date.now() + dias * 86_400_000) : null;

      const { html, variables } = datosNomina
        ? await renderizarDesprendible({
            plantilla:       base.plantilla,
            contexto:        ctx,
            datos:           datosNomina,
            urlVerificacion: urlVerificacion(codigo),
            logoUrl:         base.sede?.logo_url ?? base.grupo.logo_url,
          })
        : await renderizarDocumento({
            plantilla:       base.plantilla,
            contexto:        ctx,
            urlVerificacion: urlVerificacion(codigo),
            vigenciaHasta,
            logoUrl:         base.sede?.logo_url ?? base.grupo.logo_url,
          });

      return documentoRepository.create({
        tipo,
        consecutivo,
        codigo_verificacion: codigo,
        hash_contenido:      sha256(html),
        contenido_html:      html,
        datos:               variables,
        vigencia_hasta:      vigenciaHasta,
        id_empleado:         idEmpleado,
        id_emisor:           emisor.id,
        id_grupo:            base.idGrupo,
        id_restaurante:      base.sede?.id ?? null,
        id_plantilla:        base.idPlantilla,
      }, tx);
    });
  },

  async listarPorEmpleado(idEmpleado: number, grupoId?: number) {
    if (grupoId) {
      const pertenece = await usuarioRepository.perteneceAGrupo(idEmpleado, grupoId);
      if (!pertenece) throw new NotFoundError('Empleado');
    }
    return documentoRepository.findByEmpleado(idEmpleado, grupoId);
  },

  /** Reimprime el snapshot original — nunca vuelve a renderizar. */
  async obtenerContenido(id: number, grupoId?: number) {
    const doc = await documentoRepository.findContenido(id, grupoId);
    if (!doc) throw new NotFoundError('Documento');
    return doc;
  },

  async anular(id: number, motivo: string, grupoId?: number) {
    const doc = await documentoRepository.findContenido(id, grupoId);
    if (!doc) throw new NotFoundError('Documento');
    if (doc.anulado) throw new BadRequestError('El documento ya está anulado');
    if (!motivo?.trim()) throw new BadRequestError('Debes indicar el motivo de la anulación');
    return documentoRepository.anular(id, motivo.trim());
  },

  /**
   * verificar — consulta PÚBLICA, sin autenticación.
   *
   * Devuelve lo justo para confirmar autenticidad: tipo, empresa, nombre del
   * titular, fechas y vigencia. NO devuelve el salario ni el documento de
   * identidad: quien verifica quiere saber si el certificado es real, no los
   * datos personales de la persona.
   */
  async verificar(codigo: string) {
    const doc = await documentoRepository.findByCodigo(codigo.toUpperCase().trim());
    if (!doc) throw new NotFoundError('Documento');

    const vencido = !!doc.vigencia_hasta && doc.vigencia_hasta < new Date();
    const estado  = doc.anulado ? 'anulado' : vencido ? 'vencido' : 'vigente';

    return {
      valido:        estado === 'vigente',
      estado,
      tipo:          doc.tipo,
      tipo_nombre:   CATALOGO_DOCUMENTOS[doc.tipo as TipoDocumento]?.nombre ?? doc.tipo,
      consecutivo:   doc.consecutivo,
      codigo:        doc.codigo_verificacion,
      titular:       doc.empleado.nombre_completo,
      empresa:       doc.grupo.nombre,
      empresa_nit:   doc.grupo.nit,
      fecha_emision: doc.fecha_emision,
      vigencia_hasta: doc.vigencia_hasta,
      // Permite a quien tenga el PDF comparar que no fue alterado
      hash:          doc.hash_contenido,
    };
  },
};

/** Guard reutilizable: emitir documentos es una acción sensible y auditable. */
export const assertPuedeEmitir = (esSuperAdmin: boolean, grupoAdminId?: number) => {
  if (!esSuperAdmin && !grupoAdminId) {
    throw new ForbiddenError('No tienes permiso para emitir documentos laborales');
  }
};
