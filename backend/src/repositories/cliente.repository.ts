/**
 * ClienteRepository - Queries Prisma para el módulo de Clientes
 */

import { EstadoGeneral, TipoCliente, TipoPunto } from '@prisma/client';
import prisma from '../config/database';
import { PaginationParams, getSkip } from '../lib/pagination';

export const clienteRepository = {

  // ── Listado y búsqueda ────────────────────────────────────────────────────

  findAll: (
    pagination: PaginationParams,
    filters: {
      id_grupo?:     number | null;   // tenant scope — clientes compartidos dentro del grupo
      search?:       string;
      estado?:       EstadoGeneral;
      tipo_cliente?: TipoCliente;
    }
  ) => {
    const where: any = { estado: { not: EstadoGeneral.eliminado } };
    if (filters.id_grupo != null) where.id_grupo = filters.id_grupo;
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
  },

  findById: (id: number) =>
    prisma.cliente.findFirst({
      where: { id, estado: { not: EstadoGeneral.eliminado } },
      include: {
        direcciones: { where: { activa: true }, orderBy: { es_principal: 'desc' } },
        _count: { select: { ordenes: true } },
      },
    }),

  findByEmail: (email: string, excludeId?: number) =>
    prisma.cliente.findFirst({
      where: {
        email,
        estado: { not: EstadoGeneral.eliminado },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    }),

  findByDocumento: (numero_documento: string, excludeId?: number) =>
    prisma.cliente.findFirst({
      where: {
        numero_documento,
        estado: { not: EstadoGeneral.eliminado },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    }),

  // ── CRUD ──────────────────────────────────────────────────────────────────

  create: (data: {
    nombre_completo:   string;
    email?:            string;
    telefono?:         string;
    telefono_alterno?: string;
    tipo_documento?:   any;
    numero_documento?: string;
    direccion?:        string;
    ciudad?:           string;
    barrio?:           string;
    tipo_cliente?:     TipoCliente;
    notas?:            string;
    preferencias?:     any;
    canal_adquisicion?: string;
    fecha_nacimiento?: Date;
  }) => prisma.cliente.create({ data }),

  update: (id: number, data: Partial<{
    nombre_completo:   string;
    email:             string;
    telefono:          string;
    telefono_alterno:  string;
    tipo_documento:    any;
    numero_documento:  string;
    direccion:         string;
    ciudad:            string;
    barrio:            string;
    tipo_cliente:      TipoCliente;
    estado:            EstadoGeneral;
    notas:             string;
    preferencias:      any;
    canal_adquisicion: string;
    fecha_nacimiento:  Date;
    ultima_visita:     Date;
  }>) => prisma.cliente.update({ where: { id }, data }),

  // ── Estadísticas ──────────────────────────────────────────────────────────

  estadisticas: async () => {
    const [total, activos, frecuentes, vip] = await Promise.all([
      prisma.cliente.count({ where: { estado: { not: EstadoGeneral.eliminado } } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo, tipo_cliente: TipoCliente.frecuente } }),
      prisma.cliente.count({ where: { estado: EstadoGeneral.activo, tipo_cliente: TipoCliente.vip } }),
    ]);
    return { total, activos, frecuentes, vip };
  },

  // ── Órdenes del cliente ───────────────────────────────────────────────────

  findOrdenes: (id_cliente: number, pagination: PaginationParams) => {
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
  },

  // ── Direcciones ───────────────────────────────────────────────────────────

  findDirecciones: (id_cliente: number) =>
    prisma.clienteDireccion.findMany({
      where: { id_cliente, activa: true },
      orderBy: [{ es_principal: 'desc' }, { id: 'asc' }],
    }),

  findDireccionById: (id: number, id_cliente: number) =>
    prisma.clienteDireccion.findFirst({ where: { id, id_cliente } }),

  addDireccion: (id_cliente: number, data: {
    alias: string; direccion: string;
    ciudad?: string; barrio?: string; referencia?: string; es_principal?: boolean;
  }) => prisma.clienteDireccion.create({ data: { id_cliente, ...data } }),

  updateDireccion: (id: number, data: Partial<{
    alias: string; direccion: string; ciudad: string;
    barrio: string; referencia: string; es_principal: boolean; activa: boolean;
  }>) => prisma.clienteDireccion.update({ where: { id }, data }),

  deleteDireccion: (id: number) =>
    prisma.clienteDireccion.update({ where: { id }, data: { activa: false } }),

  // ── Puntos de lealtad ─────────────────────────────────────────────────────

  findPuntos: (id_cliente: number, pagination: PaginationParams) => {
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
  },

  registrarPuntos: (data: {
    id_cliente:    number;
    tipo:          TipoPunto;
    puntos:        number;
    descripcion:   string;
    saldo_antes:   number;
    saldo_despues: number;
    id_orden?:     number;
  }) => prisma.clientePunto.create({ data }),

  actualizarPuntos: (id_cliente: number, nuevos_puntos: number) =>
    prisma.cliente.update({
      where: { id: id_cliente },
      data:  { puntos_acumulados: nuevos_puntos },
    }),
};
