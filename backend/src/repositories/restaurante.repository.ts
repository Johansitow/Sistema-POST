/**
 * RestauranteRepository — Multi-tenant: gestión de restaurantes
 */

import prisma from '../config/database';

export const restauranteRepository = {

  findAll: () =>
    prisma.restaurante.findMany({
      where:   { activo: true },
      orderBy: { nombre: 'asc' },
    }),

  findAllIncludeInactive: () =>
    prisma.restaurante.findMany({ orderBy: { nombre: 'asc' } }),

  findById: (id: number) =>
    prisma.restaurante.findUnique({ where: { id } }),

  findDefault: () =>
    prisma.restaurante.findFirst({ where: { es_default: true, activo: true } }),

  /** Sedes de un grupo (incluye inactivas — el owner debe poder verlas) */
  findByGrupo: (id_grupo: number) =>
    prisma.restaurante.findMany({
      where:   { id_grupo },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { usuarios: true } } },
    }),

  create: async (data: {
    nombre:       string;
    id_grupo:     number;
    nit?:         string;
    descripcion?: string;
    logo_url?:    string;
    direccion?:   string;
    ciudad?:      string;
    telefono?:    string;
    email?:       string;
    es_default?:  boolean;
    config?:      unknown;
    tipo_tenant?: string;
    zona_horaria?: string;
    moneda?:      string;
  }) => {
    // Si el nuevo es default, quitar el default anterior
    if (data.es_default) {
      await prisma.restaurante.updateMany({
        where:  { es_default: true },
        data:   { es_default: false },
      });
    }
    return prisma.restaurante.create({ data: data as any });
  },

  update: async (id: number, data: Partial<{
    nombre:      string;
    nit:         string;
    descripcion: string;
    logo_url:    string;
    direccion:   string;
    ciudad:      string;
    telefono:    string;
    email:       string;
    activo:      boolean;
    es_default:  boolean;
    config:      unknown;
  }>) => {
    if (data.es_default) {
      await prisma.restaurante.updateMany({
        where: { es_default: true, NOT: { id } },
        data:  { es_default: false },
      });
    }
    return prisma.restaurante.update({ where: { id }, data: data as any });
  },

  toggleActivo: async (id: number) => {
    const current = await prisma.restaurante.findUnique({ where: { id } });
    return prisma.restaurante.update({
      where: { id },
      data:  { activo: !current?.activo },
    });
  },

  count: () => prisma.restaurante.count(),

  // ── Gestión de usuarios por restaurante ───────────────────────────────────

  findUsuarios: (id_restaurante: number) =>
    prisma.usuarioRestaurante.findMany({
      where:   { id_restaurante, es_activo: true },
      include: {
        usuario: {
          select: {
            id:             true,
            uuid:           true,
            nombre_completo: true,
            usuario:        true,
            email:          true,
            estado:         true,
            rol:            { select: { id: true, nombre: true, color: true } },
          },
        },
      },
      orderBy: { fecha_asignacion: 'asc' },
    }),

  findRestaurantesByUsuario: (id_usuario: number) =>
    prisma.usuarioRestaurante.findMany({
      where:   { id_usuario, es_activo: true },
      include: { restaurante: { select: { id: true, nombre: true, es_default: true, activo: true } } },
    }),

  asignarUsuario: (id_restaurante: number, id_usuario: number) =>
    prisma.usuarioRestaurante.upsert({
      where:  { id_usuario_id_restaurante: { id_usuario, id_restaurante } },
      create: { id_usuario, id_restaurante, es_activo: true },
      update: { es_activo: true },
    }),

  removerUsuario: (id_restaurante: number, id_usuario: number) =>
    prisma.usuarioRestaurante.update({
      where: { id_usuario_id_restaurante: { id_usuario, id_restaurante } },
      data:  { es_activo: false },
    }),
};
