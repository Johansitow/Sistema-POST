/**
 * DTOs y validaciones para el módulo de Clientes
 */

import { z } from 'zod';
import { TipoDocumento, TipoCliente, EstadoGeneral } from '@prisma/client';

// ── Crear cliente ─────────────────────────────────────────────────────────────

export const createClienteSchema = z.object({
  nombre_completo:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  email:             z.string().email('Email inválido').max(150).optional(),
  telefono:          z.string().max(20).optional(),
  telefono_alterno:  z.string().max(20).optional(),
  tipo_documento:    z.nativeEnum(TipoDocumento).default(TipoDocumento.cc),
  numero_documento:  z.string().max(50).optional(),
  direccion:         z.string().max(255).optional(),
  ciudad:            z.string().max(100).optional(),
  barrio:            z.string().max(100).optional(),
  tipo_cliente:      z.nativeEnum(TipoCliente).default(TipoCliente.regular),
  notas:             z.string().max(2000).optional(),
  preferencias:      z.record(z.any()).optional(),
  canal_adquisicion: z.string().max(50).optional(),
  fecha_nacimiento:  z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
  puntos_bienvenida: z.boolean().default(false),
});

// ── Actualizar cliente ────────────────────────────────────────────────────────

export const updateClienteSchema = z.object({
  nombre_completo:   z.string().min(2).max(200).optional(),
  email:             z.string().email('Email inválido').max(150).optional(),
  telefono:          z.string().max(20).optional(),
  telefono_alterno:  z.string().max(20).optional(),
  tipo_documento:    z.nativeEnum(TipoDocumento).optional(),
  numero_documento:  z.string().max(50).optional(),
  direccion:         z.string().max(255).optional(),
  ciudad:            z.string().max(100).optional(),
  barrio:            z.string().max(100).optional(),
  tipo_cliente:      z.nativeEnum(TipoCliente).optional(),
  notas:             z.string().max(2000).optional(),
  preferencias:      z.record(z.any()).optional(),
  canal_adquisicion: z.string().max(50).optional(),
  fecha_nacimiento:  z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
});

// ── Cambiar estado ────────────────────────────────────────────────────────────

export const cambiarEstadoClienteSchema = z.object({
  estado: z.enum([EstadoGeneral.activo, EstadoGeneral.inactivo], {
    errorMap: () => ({ message: 'El estado debe ser "activo" o "inactivo"' }),
  }),
});

// ── Direcciones ───────────────────────────────────────────────────────────────

export const addDireccionSchema = z.object({
  alias:        z.string().min(1).max(50),
  direccion:    z.string().min(5).max(255),
  ciudad:       z.string().max(100).optional(),
  barrio:       z.string().max(100).optional(),
  referencia:   z.string().max(255).optional(),
  es_principal: z.boolean().default(false),
});

export const updateDireccionSchema = z.object({
  alias:        z.string().min(1).max(50).optional(),
  direccion:    z.string().min(5).max(255).optional(),
  ciudad:       z.string().max(100).optional(),
  barrio:       z.string().max(100).optional(),
  referencia:   z.string().max(255).optional(),
  es_principal: z.boolean().optional(),
  activa:       z.boolean().optional(),
});

// ── Puntos ────────────────────────────────────────────────────────────────────

export const canjearPuntosSchema = z.object({
  puntos:      z.number().int().positive('Los puntos deben ser un número entero positivo'),
  descripcion: z.string().max(255).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateClienteDTO  = z.infer<typeof createClienteSchema>;
export type UpdateClienteDTO  = z.infer<typeof updateClienteSchema>;
export type AddDireccionDTO   = z.infer<typeof addDireccionSchema>;
export type UpdateDireccionDTO = z.infer<typeof updateDireccionSchema>;
export type CanjearPuntosDTO  = z.infer<typeof canjearPuntosSchema>;
