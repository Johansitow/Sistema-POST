/**
 * ListaComprasService
 * Generación automática, creación manual, recepción y gestión de listas de compras.
 *
 * Generación automática: incluye productos agotados (stock ≤ 0), bajo mínimo, y
 * los que la tendencia de consumo marca como insuficientes (stock_actual por
 * debajo del stock ideal calculado por DemandaService). La cantidad sugerida
 * lleva cada producto hasta su stock ideal.
 *
 * Recepción: al registrar recepción se generan movimientos de ENTRADA reales en
 * el inventario, reutilizando inventarioService.registrarMovimiento. Es idempotente
 * gracias a Movimiento.referencia: solo ingresa el delta no ingresado aún, así que
 * una recepción parcial que luego se completa no duplica stock.
 */

import prisma from '../config/database';
import { listaComprasRepository } from '../repositories/lista-compras.repository';
import { proveedorRepository }    from '../repositories/proveedor.repository';
import { inventarioService }      from './inventario.service';
import { demandaService, type DemandaProducto } from './demanda.service';
import { NotFoundError, BadRequestError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import { assertRestauranteId } from '../lib/tenantQuery';
import { EstadoListaCompras, TipoMovimiento } from '@prisma/client';

const PREFIJO_LISTA = 'LC-';

/** Razón por la que un producto entra en la lista automática. */
type MotivoCompra = 'agotado' | 'bajo_minimo' | 'alta_rotacion';

interface CandidatoRaw {
  id: number; nombre: string; sku: string; unidad_medida: string;
  stock_actual: number; stock_minimo: number; stock_maximo: number | null;
}

export const listaComprasService = {

  async listar(params: {
    page?: unknown; limit?: unknown;
    estado?: EstadoListaCompras;
    id_proveedor?: number;
    desde?: Date;
    hasta?: Date;
    id_restaurante?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [listas, total] = await listaComprasRepository.findAll(pagination, {
      estado:         params.estado,
      id_proveedor:   params.id_proveedor,
      desde:          params.desde,
      hasta:          params.hasta,
      id_restaurante: params.id_restaurante,
    });
    return buildPaginatedResult(listas, total, pagination);
  },

  /**
   * Obtiene una lista verificando que pertenezca a la sede indicada.
   * id_restaurante viene del contexto de tenant: si la lista es de otra sede
   * se responde NotFound (no se revela su existencia). Cierra el IDOR.
   */
  async obtenerPorId(id: number, id_restaurante?: number) {
    const lista = await listaComprasRepository.findById(id);
    if (!lista) throw new NotFoundError('Lista de compras');
    if (id_restaurante != null && lista.id_restaurante !== id_restaurante) {
      throw new NotFoundError('Lista de compras');
    }
    return lista;
  },

  /**
   * Genera una lista de compras automáticamente para la sede indicada.
   * Considera tres motivos: producto agotado (stock ≤ 0), bajo mínimo, y alta
   * rotación (stock por debajo del stock ideal según tendencia de consumo).
   * La cantidad sugerida lleva cada producto hasta su stock ideal (o el máximo).
   */
  async generarAutomatico(id_usuario: number, opciones: {
    notas?: string;
    id_proveedor_asignado?: number;
    id_restaurante: number;
  }): Promise<any> {
    assertRestauranteId(opciones.id_restaurante);
    const idRestaurante = opciones.id_restaurante;

    // 1. Stock por sede de TODOS los productos activos de la sede (no solo los
    //    que tienen stock_minimo). Fuente autoritativa: producto_stock.
    const productosRaw = await prisma.$queryRaw<CandidatoRaw[]>`
      SELECT p.id, p.nombre, p.sku, p.unidad_medida::text AS unidad_medida,
             ps.stock_actual::float, ps.stock_minimo::float, ps.stock_maximo::float
      FROM   producto_stock ps
      JOIN   productos p ON p.id = ps.id_producto
      WHERE  p.estado         = 'activo'
        AND  ps.id_restaurante = ${idRestaurante}
        AND  ps.activo         = true
    `;

    if (!productosRaw.length) {
      return { mensaje: 'La sede no tiene productos con stock registrado', lista: null };
    }

    // 2. Demanda/tendencia por producto para calcular el stock ideal.
    const demanda = await demandaService.calcularDemandaSede(idRestaurante);

    const items: {
      id_producto:            number;
      id_proveedor_sugerido?: number;
      cantidad_sugerida:      number;
      precio_estimado?:       number;
      observaciones?:         string;
    }[] = [];

    let totalEstimado = 0;
    let mejorProveedorGeneral: number | undefined = opciones?.id_proveedor_asignado;

    for (const prod of productosRaw) {
      const dem      = demanda.get(prod.id);
      const objetivo = calcularObjetivoStock(prod, dem);
      const motivo   = clasificarMotivo(prod, objetivo.stock_objetivo);
      if (!motivo) continue;   // stock suficiente, no se pide

      const cantPedir = Math.max(0, objetivo.stock_objetivo - prod.stock_actual);
      if (cantPedir <= 0) continue;

      const mejorRelacion = await proveedorRepository.findMejorProveedorParaProducto(prod.id);
      const precioUnit    = mejorRelacion ? Number(mejorRelacion.precio_unitario) : undefined;
      if (precioUnit) totalEstimado += cantPedir * precioUnit;
      if (!mejorProveedorGeneral && mejorRelacion) mejorProveedorGeneral = mejorRelacion.id_proveedor;

      items.push({
        id_producto:           prod.id,
        id_proveedor_sugerido: mejorRelacion?.id_proveedor,
        cantidad_sugerida:     Math.round(cantPedir * 1000) / 1000,
        precio_estimado:       precioUnit ? Math.round(cantPedir * precioUnit) : undefined,
        observaciones:         describirMotivo(motivo, prod, objetivo, dem),
      });
    }

    if (!items.length) {
      return { mensaje: 'No hay productos que necesiten reposición en este momento', lista: null };
    }

    const lista = await this._crearLista({
      id_usuario,
      id_restaurante:        idRestaurante,
      id_proveedor_asignado: mejorProveedorGeneral,
      notas:                 opciones?.notas ?? 'Generada automáticamente por stock bajo y tendencia de consumo',
      total_estimado:        totalEstimado > 0 ? Math.round(totalEstimado) : undefined,
      items,
    });

    await this._alertarListaGenerada(lista.numero_lista, idRestaurante, items.length);
    return { lista, total_items: items.length };
  },

  /**
   * Creación manual: el usuario define productos y cantidades. Los productos
   * deben pertenecer a la sede (tener stock activo) para no cruzar tenants.
   */
  async crearManual(id_usuario: number, data: {
    id_restaurante: number;
    notas?: string;
    id_proveedor_asignado?: number;
    items: {
      id_producto:           number;
      cantidad_sugerida:     number;
      id_proveedor_sugerido?: number;
      precio_estimado?:       number;
      observaciones?:         string;
    }[];
  }) {
    assertRestauranteId(data.id_restaurante);
    const idRestaurante = data.id_restaurante;

    // Validar que todos los productos son de la sede (stock activo en ella).
    const ids = [...new Set(data.items.map(i => i.id_producto))];
    const validos = await prisma.productoStock.findMany({
      where:  { id_restaurante: idRestaurante, activo: true, id_producto: { in: ids } },
      select: { id_producto: true },
    });
    const validSet = new Set(validos.map(v => v.id_producto));
    const invalidos = ids.filter(id => !validSet.has(id));
    if (invalidos.length) {
      throw new BadRequestError(`Producto(s) fuera de esta sede: ${invalidos.join(', ')}`);
    }

    const totalEstimado = data.items.reduce(
      (s, i) => s + (i.precio_estimado != null ? Number(i.precio_estimado) : 0), 0,
    );

    const lista = await this._crearLista({
      id_usuario,
      id_restaurante:        idRestaurante,
      id_proveedor_asignado: data.id_proveedor_asignado,
      notas:                 data.notas ?? 'Lista creada manualmente',
      total_estimado:        totalEstimado > 0 ? Math.round(totalEstimado) : undefined,
      items: data.items.map(i => ({
        id_producto:           i.id_producto,
        id_proveedor_sugerido: i.id_proveedor_sugerido,
        cantidad_sugerida:     i.cantidad_sugerida,
        precio_estimado:       i.precio_estimado,
        observaciones:         i.observaciones,
      })),
    });

    await this._alertarListaGenerada(lista.numero_lista, idRestaurante, data.items.length);
    return { lista, total_items: data.items.length };
  },

  async cambiarEstado(id: number, data: {
    estado:           EstadoListaCompras;
    notas?:           string;
    fecha_envio?:     Date;
    fecha_recepcion?: Date;
  }, id_restaurante?: number) {
    const lista = await this.obtenerPorId(id, id_restaurante);

    const transicionesValidas: Record<string, EstadoListaCompras[]> = {
      generada:  ['enviada', 'cancelada'],
      enviada:   ['recibida', 'parcial', 'cancelada'],
      parcial:   ['recibida', 'cancelada'],
      recibida:  [],
      cancelada: [],
    };

    const permitidas = transicionesValidas[lista.estado] ?? [];
    if (!permitidas.includes(data.estado)) {
      throw new BadRequestError(`No se puede cambiar de estado '${lista.estado}' a '${data.estado}'`);
    }

    // Al recibir (total o parcial), ingresar al inventario lo recibido.
    if (data.estado === EstadoListaCompras.recibida || data.estado === EstadoListaCompras.parcial) {
      await this._ingresarRecepcion(id, id_usuarioResponsable(lista));
      data.fecha_recepcion = data.fecha_recepcion ?? new Date();
    }

    return listaComprasRepository.update(id, {
      estado:          data.estado,
      notas:           data.notas,
      fecha_envio:     data.fecha_envio,
      fecha_recepcion: data.fecha_recepcion,
    });
  },

  async actualizarItem(id_lista: number, id_item: number, data: {
    cantidad_recibida: number;
    observaciones?:    string;
  }, id_restaurante?: number) {
    const lista = await this.obtenerPorId(id_lista, id_restaurante);
    // El item debe pertenecer a la lista (evita mover items de otra lista/sede).
    const pertenece = (lista.items ?? []).some(it => it.id === id_item);
    if (!pertenece) throw new NotFoundError('Item de la lista');
    return listaComprasRepository.updateItem(id_item, data);
  },

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /** Crea la lista + items numerando dentro de una transacción (numero_lista @unique). */
  async _crearLista(data: {
    id_usuario:             number;
    id_restaurante:         number;
    id_proveedor_asignado?: number;
    notas?:                 string;
    total_estimado?:        number;
    items: {
      id_producto:            number;
      id_proveedor_sugerido?: number;
      cantidad_sugerida:      number;
      precio_estimado?:       number;
      observaciones?:         string;
    }[];
  }) {
    return prisma.$transaction(async (tx) => {
      const ultima = await tx.listaCompras.findFirst({
        orderBy: { numero_lista: 'desc' }, select: { numero_lista: true },
      });
      const num = ultima ? parseInt(ultima.numero_lista.replace(PREFIJO_LISTA, ''), 10) : 0;
      const numeroLista = `${PREFIJO_LISTA}${String(num + 1).padStart(6, '0')}`;

      return tx.listaCompras.create({
        data: {
          numero_lista:          numeroLista,
          id_usuario_generado:   data.id_usuario,
          id_proveedor_asignado: data.id_proveedor_asignado,
          id_restaurante:        data.id_restaurante,
          notas:                 data.notas,
          total_estimado:        data.total_estimado,
          items: {
            create: data.items.map(item => ({
              id_producto:           item.id_producto,
              id_proveedor_sugerido: item.id_proveedor_sugerido,
              cantidad_sugerida:     item.cantidad_sugerida,
              precio_estimado:       item.precio_estimado,
              observaciones:         item.observaciones,
            })),
          },
        },
        include: {
          usuario_generado:   { select: { id: true, nombre_completo: true } },
          proveedor_asignado: true,
          items: { include: { producto: { select: { id: true, nombre: true, sku: true, unidad_medida: true, stock_actual: true, stock_minimo: true, stock_maximo: true } } } },
        },
      });
    });
  },

  /**
   * Ingresa al inventario lo recibido en cada item con cantidad_recibida > 0.
   * Idempotente: usa Movimiento.referencia = `LC:{id_lista}:item:{id_item}` para
   * saber cuánto ya se ingresó y mover solo el delta pendiente. Así una recepción
   * parcial que luego se completa suma únicamente la diferencia.
   */
  async _ingresarRecepcion(id_lista: number, id_usuario?: number) {
    const lista = await listaComprasRepository.findById(id_lista);
    if (!lista) throw new NotFoundError('Lista de compras');

    for (const item of lista.items ?? []) {
      const recibida = item.cantidad_recibida != null ? Number(item.cantidad_recibida) : 0;
      if (recibida <= 0) continue;

      const referencia = `LC:${id_lista}:item:${item.id}`;

      // Cuánto de este item ya se ingresó al inventario en recepciones previas.
      const agg = await prisma.movimiento.aggregate({
        _sum: { cantidad: true },
        where: {
          id_restaurante:  lista.id_restaurante,
          id_producto:     item.id_producto,
          tipo_movimiento: TipoMovimiento.entrada,
          referencia,
        },
      });
      const yaIngresado = agg._sum.cantidad ? Number(agg._sum.cantidad) : 0;
      const delta = recibida - yaIngresado;
      if (delta <= 0) continue;   // ya ingresado (o corrección a la baja: no se descuenta)

      await inventarioService.registrarMovimiento({
        id_producto:            item.id_producto,
        id_restaurante:         lista.id_restaurante,
        tipo_movimiento:        TipoMovimiento.entrada,
        cantidad:               delta,
        motivo:                 `Recepción lista de compras ${lista.numero_lista}`,
        id_proveedor:           item.id_proveedor_sugerido ?? lista.id_proveedor_asignado ?? undefined,
        referencia,
        id_usuario_responsable: id_usuario,
      });
    }
  },

  async _alertarListaGenerada(numeroLista: string, idRestaurante: number, nItems: number) {
    try {
      await prisma.alerta.create({
        data: {
          id_tipo_alerta:  await obtenerTipoAlertaId('LISTA_COMPRA'),
          id_restaurante:  idRestaurante,
          mensaje:         `Lista de compras ${numeroLista} generada con ${nItems} producto(s).`,
          nivel_prioridad: 'alta',
        },
      });
    } catch { /* no bloquear la creación de la lista por una alerta */ }
  },
};

/**
 * Stock objetivo de un producto: el mayor entre su stock_ideal por tendencia,
 * su stock_maximo configurado, o (como respaldo) 2.5× el mínimo. Si no hay
 * ningún dato, cae a un objetivo de 0 (no se pedirá salvo que esté agotado).
 */
function calcularObjetivoStock(prod: CandidatoRaw, dem?: DemandaProducto) {
  const candidatos: number[] = [];
  if (dem && dem.stock_ideal > 0) candidatos.push(dem.stock_ideal);
  if (prod.stock_maximo != null && prod.stock_maximo > 0) candidatos.push(prod.stock_maximo);
  if (prod.stock_minimo > 0) candidatos.push(prod.stock_minimo * 2.5);

  const stock_objetivo = candidatos.length ? Math.max(...candidatos) : 0;
  return { stock_objetivo: Math.ceil(stock_objetivo) };
}

/**
 * Motivo por el que el producto entra en la lista, o null si no hace falta pedir.
 * - agotado:      stock ≤ 0
 * - bajo_minimo:  stock ≤ stock_minimo (y hay mínimo configurado)
 * - alta_rotacion: stock < stock objetivo por tendencia/máximo
 */
function clasificarMotivo(prod: CandidatoRaw, stockObjetivo: number): MotivoCompra | null {
  if (prod.stock_actual <= 0) return 'agotado';
  if (prod.stock_minimo > 0 && prod.stock_actual <= prod.stock_minimo) return 'bajo_minimo';
  if (stockObjetivo > 0 && prod.stock_actual < stockObjetivo) return 'alta_rotacion';
  return null;
}

function describirMotivo(
  motivo: MotivoCompra,
  prod: CandidatoRaw,
  objetivo: { stock_objetivo: number },
  dem?: DemandaProducto,
): string {
  const u = prod.unidad_medida;
  const tendencia = dem && dem.tendencia !== 'sin_datos' ? ` · consumo ${dem.tendencia}` : '';
  switch (motivo) {
    case 'agotado':
      return `Agotado (stock 0 ${u}). Objetivo: ${objetivo.stock_objetivo} ${u}${tendencia}`;
    case 'bajo_minimo':
      return `Bajo mínimo: ${prod.stock_actual} ${u} (mín ${prod.stock_minimo}). Objetivo: ${objetivo.stock_objetivo} ${u}${tendencia}`;
    case 'alta_rotacion':
      return `Alta rotación: ${prod.stock_actual} ${u} por debajo del ideal ${objetivo.stock_objetivo} ${u}${tendencia}`;
  }
}

/** El responsable del ingreso es quien generó la lista (mejor trazabilidad que anónimo). */
function id_usuarioResponsable(lista: { id_usuario_generado?: number | null }): number | undefined {
  return lista.id_usuario_generado ?? undefined;
}

async function obtenerTipoAlertaId(codigo: string): Promise<number> {
  const tipo = await prisma.tipoAlerta.findFirst({ where: { codigo } });
  return tipo?.id ?? 1;
}
