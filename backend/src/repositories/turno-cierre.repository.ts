/**
 * TurnoCajaRepository + CierreCajaRepository
 */

import prisma from '../config/database';
import { Prisma, EstadoCierre } from '@prisma/client';

// ── Turnos ────────────────────────────────────────────────────────────────────

export const turnoCajaRepository = {

  findAll: (id_restaurante: number, soloActivos = false) =>
    prisma.turnoCaja.findMany({
      where: {
        id_restaurante,
        ...(soloActivos ? { activo: true } : {}),
      },
      include: { _count: { select: { cierres: true } } },
      orderBy: { hora_apertura: 'asc' },
    }),

  findById: (id: number) =>
    prisma.turnoCaja.findUnique({
      where: { id },
      include: { cierres: { take: 5, orderBy: { fecha_cierre: 'desc' } } },
    }),

  create: (data: {
    id_restaurante: number;   // obligatorio
    nombre:         string;
    hora_apertura:  string;
    hora_cierre:    string;
    dias_semana?:   number[];
  }) => prisma.turnoCaja.create({
    data: {
      ...data,
      dias_semana: data.dias_semana ?? Prisma.JsonNull,
    },
  }),

  update: (id: number, data: Partial<{
    nombre:        string;
    hora_apertura: string;
    hora_cierre:   string;
    dias_semana:   number[];
    activo:        boolean;
  }>) => prisma.turnoCaja.update({ where: { id }, data }),

  delete: (id: number) => prisma.turnoCaja.delete({ where: { id } }),
};

// ── Cierres ───────────────────────────────────────────────────────────────────

export const cierreCajaRepository = {

  findAll: (params: {
    skip: number; take: number;
    fecha_desde?: Date; fecha_hasta?: Date;
    id_usuario?: number; estado?: EstadoCierre;
    id_restaurante?: number;
  }) =>
    prisma.$transaction([
      prisma.cierreCaja.findMany({
        skip: params.skip, take: params.take,
        where: {
          ...(params.id_usuario    && { id_usuario: params.id_usuario }),
          ...(params.estado        && { estado: params.estado }),
          ...(params.id_restaurante && { id_restaurante: params.id_restaurante }),
          ...(params.fecha_desde || params.fecha_hasta
            ? { fecha_cierre: {
                ...(params.fecha_desde && { gte: params.fecha_desde }),
                ...(params.fecha_hasta && { lte: params.fecha_hasta }),
              }}
            : {}),
        },
        include: { usuario: { select: { id: true, nombre_completo: true, usuario: true } }, turno: true },
        orderBy: { fecha_cierre: 'desc' },
      }),
      prisma.cierreCaja.count(),
    ]),

  findById: (id: number) =>
    prisma.cierreCaja.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nombre_completo: true, usuario: true } },
        turno: true,
      },
    }),

  findByNumeroCierre: (numero: string) =>
    prisma.cierreCaja.findUnique({ where: { numero_cierre: numero } }),

  findUltimo: () =>
    prisma.cierreCaja.findFirst({ orderBy: { id: 'desc' } }),

  create: (data: {
    id_usuario:          number;
    id_turno?:           number;
    id_restaurante:      number;
    numero_cierre:       string;
    fecha_apertura:      Date;
    monto_inicial:       number;
    monto_final:         number;
    totales_por_metodo?: Record<string, number>;
    total_ventas:        number;
    total_efectivo:      number;
    diferencia:          number;
    justificacion?:      string;
    estado:              EstadoCierre;
    observaciones?:      string;
  }) =>
    prisma.cierreCaja.create({
      data: {
        ...data,
        monto_inicial:      data.monto_inicial,
        monto_final:        data.monto_final,
        total_ventas:       data.total_ventas,
        total_efectivo:     data.total_efectivo,
        diferencia:         data.diferencia,
        totales_por_metodo: data.totales_por_metodo ?? undefined,
      },
      include: { usuario: true, turno: true },
    }),

  update: (id: number, data: Partial<{
    monto_final:        number;
    diferencia:         number;
    justificacion:      string;
    estado:             EstadoCierre;
    observaciones:      string;
    totales_por_metodo: Record<string, number>;
  }>) => prisma.cierreCaja.update({ where: { id }, data }),
};