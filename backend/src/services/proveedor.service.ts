/**
 * ProveedorService - Lógica de negocio para proveedores y sus productos
 */

import { EstadoGeneral } from '@prisma/client';
import { proveedorRepository } from '../repositories/proveedor.repository';
import { NotFoundError, ConflictError } from '../exceptions/HttpErrors';
import { assertGrupoCtx, type TenantCtx } from '../lib/tenantCtx';
import { toDecimal } from '../lib/decimal';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';

export const proveedorService = {

  async listar(params: {
    page?: unknown; limit?: unknown;
    search?: string; estado?: EstadoGeneral; id_grupo?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [proveedores, total] = await proveedorRepository.findAll(pagination, {
      search:   params.search,
      estado:   params.estado,
      id_grupo: params.id_grupo,
    });
    return buildPaginatedResult(proveedores, total, pagination);
  },

  async obtenerPorId(id: number) {
    const proveedor = await proveedorRepository.findById(id);
    if (!proveedor) throw new NotFoundError('Proveedor');
    return proveedor;
  },

  async crear(data: {
    razon_social:             string;
    nit?:                     string;
    contacto_nombre?:         string;
    contacto_telefono?:       string;
    contacto_whatsapp?:       string;
    contacto_email?:          string;
    sitio_web?:               string;
    direccion?:               string;
    ciudad?:                  string;
    calificacion?:            number;
    tiempo_entrega_promedio?: number;
  }, ctx: TenantCtx) {
    assertGrupoCtx(ctx);
    if (data.nit) {
      const existe = await proveedorRepository.findByNit(data.nit);
      if (existe) throw new ConflictError('Ya existe un proveedor con ese NIT');
    }
    return proveedorRepository.create({ ...data, id_grupo: ctx.grupoId! });
  },

  async actualizar(id: number, data: Partial<{
    razon_social:             string;
    nit:                      string;
    contacto_nombre:          string;
    contacto_telefono:        string;
    contacto_whatsapp:        string;
    contacto_email:           string;
    sitio_web:                string;
    direccion:                string;
    ciudad:                   string;
    calificacion:             number;
    tiempo_entrega_promedio:  number;
  }>, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id, ctx);
    if (data.nit) {
      const existe = await proveedorRepository.findByNit(data.nit, id);
      if (existe) throw new ConflictError('Ya existe un proveedor con ese NIT');
    }
    return proveedorRepository.update(id, data);
  },

  async cambiarEstado(id: number, estado: EstadoGeneral, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id, ctx);
    return proveedorRepository.update(id, { estado });
  },

  // ─── ProveedorProducto ───────────────────────────────────────────────────────

  async listarProductos(id_proveedor: number, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id_proveedor, ctx);
    return proveedorRepository.findProductosByProveedor(id_proveedor);
  },

  async asociarProducto(id_proveedor: number, data: {
    id_producto:             number;
    precio_unitario:         number;
    tiempo_entrega?:         number;
    cantidad_minima?:        number;
    es_proveedor_preferido?: boolean;
    calidad_calificacion?:   number;
  }, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id_proveedor, ctx);

    const existe = await proveedorRepository.findRelacion(id_proveedor, data.id_producto);
    if (existe) throw new ConflictError('Ese producto ya está asociado a este proveedor');

    const relacion = await proveedorRepository.createRelacion({
      id_proveedor,
      id_producto:            data.id_producto,
      precio_unitario:        toDecimal(data.precio_unitario),
      tiempo_entrega:         data.tiempo_entrega,
      cantidad_minima:        data.cantidad_minima != null ? toDecimal(data.cantidad_minima) : undefined,
      es_proveedor_preferido: data.es_proveedor_preferido ?? false,
      calidad_calificacion:   data.calidad_calificacion != null ? toDecimal(data.calidad_calificacion) : undefined,
    });

    await this._recalcularCalificacion(id_proveedor).catch(() => {});

    return relacion;
  },

  async actualizarRelacion(id_proveedor: number, id_producto: number, data: Partial<{
    precio_unitario:         number;
    tiempo_entrega:          number;
    cantidad_minima:         number;
    es_proveedor_preferido:  boolean;
    calidad_calificacion:    number;
    fecha_ultima_entrega:    Date;
  }>, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id_proveedor, ctx);

    const existe = await proveedorRepository.findRelacion(id_proveedor, id_producto);
    if (!existe) throw new NotFoundError('Relación proveedor-producto');

    const relacion = await proveedorRepository.updateRelacion(id_proveedor, id_producto, {
      ...(data.precio_unitario         != null && { precio_unitario:        toDecimal(data.precio_unitario) }),
      ...(data.tiempo_entrega          != null && { tiempo_entrega:         data.tiempo_entrega }),
      ...(data.cantidad_minima         != null && { cantidad_minima:        toDecimal(data.cantidad_minima) }),
      ...(data.es_proveedor_preferido  != null && { es_proveedor_preferido: data.es_proveedor_preferido }),
      ...(data.calidad_calificacion    != null && { calidad_calificacion:   toDecimal(data.calidad_calificacion) }),
      ...(data.fecha_ultima_entrega    != null && { fecha_ultima_entrega:   data.fecha_ultima_entrega }),
    });

    await this._recalcularCalificacion(id_proveedor).catch(() => {});

    return relacion;
  },

  async desasociarProducto(id_proveedor: number, id_producto: number, ctx: TenantCtx) {
    await proveedorRepository.findByIdScoped(id_proveedor, ctx);

    const existe = await proveedorRepository.findRelacion(id_proveedor, id_producto);
    if (!existe) throw new NotFoundError('Relación proveedor-producto');
    return proveedorRepository.updateRelacion(id_proveedor, id_producto, {
      estado: EstadoGeneral.inactivo,
    });
  },

  // ─── Scoring Automático ──────────────────────────────────────────────────────

  async _recalcularCalificacion(id_proveedor: number): Promise<void> {
    const proveedor = await proveedorRepository.findParaScoring(id_proveedor);
    if (!proveedor || !proveedor.productos.length) return;

    // --- Score calidad (40%): avg(calidad_calificacion) sobre 5
    const calidades = proveedor.productos
      .map(p => Number(p.calidad_calificacion))
      .filter(v => !isNaN(v) && v > 0);
    const scoreCalidad = calidades.length > 0
      ? calidades.reduce((a, b) => a + b, 0) / calidades.length
      : 2.5; // neutral si no hay calificaciones

    // --- Score precio (40%): comparar con competidores para cada producto
    let sumScorePrecio = 0;
    let countPrecio    = 0;
    for (const pp of proveedor.productos) {
      const competidores = await proveedorRepository.findCompetidoresByProducto(
        pp.id_producto, id_proveedor
      );
      if (!competidores.length) {
        sumScorePrecio += 3.0; // sin competencia, score neutral
        countPrecio++;
        continue;
      }
      const precios = competidores.map(c => Number(c.precio_unitario));
      const precioMin = Math.min(...precios);
      const precioMax = Math.max(...precios);
      const miPrecio  = Number(pp.precio_unitario);
      if (precioMax === precioMin) {
        sumScorePrecio += 3.0;
      } else {
        // 5 = más barato, 1 = más caro
        const ratio = (precioMax - miPrecio) / (precioMax - precioMin);
        sumScorePrecio += 1 + ratio * 4;
      }
      countPrecio++;
    }
    const scorePrecios = countPrecio > 0 ? sumScorePrecio / countPrecio : 2.5;

    // --- Score tiempo (20%): tiempo_entrega_promedio comparado (menor = mejor)
    const tiempos = proveedor.productos
      .map(p => p.tiempo_entrega)
      .filter((t): t is number => t !== null && t !== undefined && t > 0);
    let scoreTiempo = 2.5;
    if (tiempos.length > 0 && proveedor.tiempo_entrega_promedio) {
      // Referencia: 1 día = 5.0, 30 días = 1.0
      const dias = proveedor.tiempo_entrega_promedio;
      scoreTiempo = Math.max(1, Math.min(5, 5 - ((dias - 1) / 29) * 4));
    }

    const calificacion = Math.round((
      scorePrecios * 0.40 +
      scoreCalidad * 0.40 +
      scoreTiempo  * 0.20
    ) * 100) / 100;

    await proveedorRepository.update(id_proveedor, {
      calificacion: toDecimal(Math.min(5, Math.max(1, calificacion))),
    });
  },
};
