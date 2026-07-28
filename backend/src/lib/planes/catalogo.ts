/**
 * Catálogo de planes SaaS — fuente ÚNICA de verdad de precios y límites.
 *
 * El enum `PlanSaaS` de Prisma (starter | professional | enterprise) es la clave;
 * aquí se le cuelga el nombre comercial, el precio y los límites que consumen
 * tanto el backend (guards de límite, `plan_max_restaurantes`) como el frontend
 * (página de precios y pantalla "Mi plan").
 *
 * Estrategia de negocio: entrada gratis y masiva (captación de datos) + módulos
 * pesados en planes superiores. Ningún plan supera los 50.000 COP/mes.
 *
 * NOTA (Fase A): el desbloqueo de MÓDULOS por plan vía feature-flags se cablea en
 * la Fase B (cobro), porque exige reconciliar los flags globales vs. de contexto
 * sin romper el comportamiento actual de tenants existentes. Aquí `modulos` es
 * solo la lista legible que pinta la página de precios.
 */

import { PlanSaaS } from '@prisma/client';

/** Centinela de "sin tope". Se usa en vez de Infinity para que serialice a JSON. */
export const ILIMITADO = -1;

export const esIlimitado = (valor: number): boolean => valor < 0;

/**
 * ¿El uso actual alcanzó o superó el límite? Un límite ilimitado nunca se excede.
 * Se compara con `>=` porque se llama ANTES de crear el recurso número (max+1).
 */
export const excedeLimite = (actual: number, max: number): boolean =>
  !esIlimitado(max) && actual >= max;

export interface LimitesPlan {
  /** Sedes/restaurantes activos permitidos. Alimenta `plan_max_restaurantes`. */
  max_sedes: number;
  /** Usuarios (empleados) activos del grupo. */
  max_usuarios: number;
  /** Productos propios del catálogo del grupo. */
  max_productos: number;
  /** Ventana de historial de reportes, en días. `ILIMITADO` = sin tope. */
  historial_reportes_dias: number;
  /** Marca de agua "Hecho con Crezco" en los tickets. */
  watermark_tickets: boolean;
}

export interface DefinicionPlan {
  codigo: PlanSaaS;
  /** Nombre comercial mostrado al cliente. */
  nombre: string;
  precio_mensual_cop: number;
  descripcion: string;
  /** Marca visual del plan recomendado en la página de precios. */
  destacado: boolean;
  limites: LimitesPlan;
  /** Lista legible de lo incluido, para la página de precios. */
  modulos: string[];
}

export const CATALOGO_PLANES: Record<PlanSaaS, DefinicionPlan> = {
  starter: {
    codigo: 'starter',
    nombre: 'Gratis',
    precio_mensual_cop: 0,
    descripcion: 'Para empezar a vender hoy. Punto de venta e inventario básico.',
    destacado: false,
    limites: {
      max_sedes: 1,
      max_usuarios: 2,
      max_productos: 60,
      historial_reportes_dias: 7,
      watermark_tickets: true,
    },
    modulos: [
      'Punto de venta (órdenes y caja)',
      'Inventario básico',
      'Reportes de los últimos 7 días',
      'Hasta 2 usuarios y 60 productos',
    ],
  },
  professional: {
    codigo: 'professional',
    nombre: 'Pro',
    precio_mensual_cop: 19900,
    descripcion: 'Operación completa para un negocio que está creciendo.',
    destacado: true,
    limites: {
      max_sedes: 1,
      max_usuarios: 6,
      max_productos: ILIMITADO,
      historial_reportes_dias: ILIMITADO,
      watermark_tickets: false,
    },
    modulos: [
      'Todo lo de Gratis, sin límites',
      'Recetas y rentabilidad (costo/margen)',
      'Proveedores y listas de compras',
      'Fidelización de clientes',
      'Reportes avanzados, sin marca de agua',
    ],
  },
  enterprise: {
    codigo: 'enterprise',
    nombre: 'Negocio',
    precio_mensual_cop: 49900,
    descripcion: 'Varias sedes y nómina colombiana en un mismo lugar.',
    destacado: false,
    limites: {
      max_sedes: 3,
      max_usuarios: 15,
      max_productos: ILIMITADO,
      historial_reportes_dias: ILIMITADO,
      watermark_tickets: false,
    },
    modulos: [
      'Todo lo de Pro',
      'Hasta 3 sedes con reportes consolidados',
      'Nómina colombiana y documentos laborales',
      'Marca propia (white-label)',
    ],
  },
};

/** Definición de un plan por su código de enum. */
export const getPlan = (codigo: PlanSaaS): DefinicionPlan => CATALOGO_PLANES[codigo];

/** Todos los planes, en orden de precio ascendente (para la página de precios). */
export const listarPlanes = (): DefinicionPlan[] =>
  Object.values(CATALOGO_PLANES).sort((a, b) => a.precio_mensual_cop - b.precio_mensual_cop);
