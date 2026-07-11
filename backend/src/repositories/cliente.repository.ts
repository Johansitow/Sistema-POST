/**
 * ClienteRepository — extiende TenantRepository (llave id_grupo).
 *
 * findByIdScoped(id, ctx): 404 si el cliente no existe o pertenece a otro grupo.
 * ForbiddenError si ctx no tiene grupoId y no es superadmin.
 * Superadmin: accede sin restricción (bypass).
 */

import { EstadoGeneral, Prisma, TipoCliente, TipoDocumento, TipoPunto } from '@prisma/client';
import prisma from '../config/database';
import { TenantRepository } from './base/TenantRepository';
import type { TenantCtx } from '../lib/tenantCtx';
import { PaginationParams, getSkip } from '../lib/pagination';

const includeCliente = {
  direcciones: { where: { activa: true }, orderBy: { es_principal: 'desc' } },
  _count: { select: { ordenes: true } },
} as const;

class ClienteRepositoryImpl extends TenantRepository {
  constructor() {
    super(prisma);
  }

  // ── Listado y búsqueda ──────────────────────────────────────────────────────

  findAll(
    pagination: PaginationParams,
    filters: {
      id_grupo?:     number | null;
      search?:       string;
      estado?:       EstadoGeneral;
      tipo_cliente?: TipoCliente;
    }
  ) {
    const where: Record<string, unknown> = { estado: { not: EstadoGeneral.eliminado } };
    if (filters.id_grupo != null) where.id_grupo    = filters.id_grupo;
    if (filters.estado)           where.estado       = filters.estado;
    if (filters.tipo_cliente)     where.tipo_cliente = filters.tipo_cliente;
    if (filters.search) {
      where.OR = [
        { nombre_completo:  { contains: filters.search, mode: 'insensitive' } },
        { email:            { contains: filters.search, mode: 'insensitive' } },
        { telefono:         { contains: filters.search, mode: 'insensitive' } },
        { numero_documento: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return Promise.all([
      prisma.cliente.findMany({
        where,
        select: {
          id: true, uuid: true, nombre_completo: true, email: true,
          telefono: true, tipo_cliente: true, estado: true,
          puntos_acumulados: true, total_gastado: true, total_ordenes: true,
          canal_adquisicion: true, ultima_visita: true, fecha_creacion: true,
          direccion: true,
        },
        orderBy: { fecha_creacion: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.cliente.count({ where }),
    ]);
  }

  findById(id: number) {
    return prisma.cliente.findFirst({
      where: { id, estado: { not: EstadoGeneral.eliminado } },
      include: includeCliente,
    });
  }

  /**
   * Lookup guardado por id_grupo.
   * NotFoundError si no existe O es de otro grupo.
   * ForbiddenError si ctx no tiene grupoId y no es superadmin.
   * Superadmin: accede sin restricción.
   */
  findByIdScoped(id: number, ctx: TenantCtx) {
    return this._scopedLookup(
      (i) => prisma.cliente.findFirst({
        where: { id: i, estado: { not: EstadoGeneral.eliminado } },
        include: includeCliente,
      }),
      id,
      ctx,
      'id_grupo',
    );
  }

  /** Únicos por grupo de negocio — el mismo email puede repetirse en otro grupo. */
  findByEmail(email: string, id_grupo: number | null | undefined, excludeId?: number) {
    return prisma.cliente.findFirst({
      where: {
        email,
        ...(id_grupo != null ? { id_grupo } : {}),
        estado: { not: EstadoGeneral.eliminado },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  /** Únicos por grupo de negocio — el mismo documento puede repetirse en otro grupo. */
  findByDocumento(numero_documento: string, id_grupo: number | null | undefined, excludeId?: number) {
    return prisma.cliente.findFirst({
      where: {
        numero_documento,
        ...(id_grupo != null ? { id_grupo } : {}),
        estado: { not: EstadoGeneral.eliminado },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  create(data: {
    nombre_completo:   string;
    id_grupo:          number;
    email?:            string;
    telefono?:         string;
    telefono_alterno?: string;
    tipo_documento?:   TipoDocumento;
    numero_documento?: string;
    direccion?:        string;
    ciudad?:           string;
    barrio?:           string;
    tipo_cliente?:     TipoCliente;
    notas?:            string;
    preferencias?:     Prisma.InputJsonValue;
    canal_adquisicion?: string;
    fecha_nacimiento?: Date;
  }) {
    return prisma.cliente.create({ data });
  }

  update(id: number, data: Partial<{
    nombre_completo:   string;
    email:             string;
    telefono:          string;
    telefono_alterno:  string;
    tipo_documento:    TipoDocumento;
    numero_documento:  string;
    direccion:         string;
    ciudad:            string;
    barrio:            string;
    tipo_cliente:      TipoCliente;
    estado:            EstadoGeneral;
    notas:             string;
    preferencias:      Prisma.InputJsonValue;
    canal_adquisicion: string;
    fecha_nacimiento:  Date;
    ultima_visita:     Date;
  }>) {
    return prisma.cliente.update({ where: { id }, data });
  }

  // ── Estadísticas ────────────────────────────────────────────────────────────

  estadisticas() {
    return Promise.all([
      prisma.cliente.count({ where: { estado: { not: EstadoGeneral.eliminado } } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo, tipo_cliente: TipoCliente.frecuente } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo, tipo_cliente: TipoCliente.vip } }),
    ]).then(([total, activos, frecuentes, vip]) => ({ total, activos, frecuentes, vip }));
  }

  // ── Órdenes del cliente ─────────────────────────────────────────────────────

  findOrdenes(id_cliente: number, pagination: PaginationParams) {
    const where = { id_cliente };
    return Promise.all([
      prisma.orden.findMany({
        where,
        select: {
          id: true, numero_orden: true, tipo_orden: true,
          total: true, subtotal: true, impuestos: true, propina: true,
          estado: { select: { nombre: true, codigo: true, color: true } },
          fecha_apertura: true,
        },
        orderBy: { fecha_apertura: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.orden.count({ where }),
    ]);
  }

  // ── Direcciones ─────────────────────────────────────────────────────────────

  findDirecciones(id_cliente: number) {
    return prisma.clienteDireccion.findMany({
      where: { id_cliente, activa: true },
      orderBy: [{ es_principal: 'desc' }, { id: 'asc' }],
    });
  }

  findDireccionById(id: number, id_cliente: number) {
    return prisma.clienteDireccion.findFirst({ where: { id, id_cliente } });
  }

  addDireccion(id_cliente: number, data: {
    alias: string; direccion: string;
    ciudad?: string; barrio?: string; referencia?: string; es_principal?: boolean;
  }) {
    return prisma.clienteDireccion.create({ data: { id_cliente, ...data } });
  }

  updateDireccion(id: number, data: Partial<{
    alias: string; direccion: string; ciudad: string;
    barrio: string; referencia: string; es_principal: boolean; activa: boolean;
  }>) {
    return prisma.clienteDireccion.update({ where: { id }, data });
  }

  deleteDireccion(id: number) {
    return prisma.clienteDireccion.update({ where: { id }, data: { activa: false } });
  }

  // ── Puntos de lealtad ───────────────────────────────────────────────────────

  findPuntos(id_cliente: number, pagination: PaginationParams) {
    const where = { id_cliente };
    return Promise.all([
      prisma.clientePunto.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip: getSkip(pagination),
        take: pagination.limit,
      }),
      prisma.clientePunto.count({ where }),
    ]);
  }

  registrarPuntos(data: {
    id_cliente:    number;
    tipo:          TipoPunto;
    puntos:        number;
    descripcion:   string;
    saldo_antes:   number;
    saldo_despues: number;
    id_orden?:     number;
  }) {
    return prisma.clientePunto.create({ data });
  }

  actualizarPuntos(id_cliente: number, nuevos_puntos: number) {
    return prisma.cliente.update({
      where: { id: id_cliente },
      data:  { puntos_acumulados: nuevos_puntos },
    });
  }
}

export const clienteRepository = new ClienteRepositoryImpl();
