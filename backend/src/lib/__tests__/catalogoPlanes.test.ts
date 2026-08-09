/**
 * Tests del catálogo de planes — límites, precios y helpers de tope.
 */

import { describe, it, expect } from 'vitest';
import {
  getPlan, listarPlanes, esIlimitado, excedeLimite, ILIMITADO,
  planIncluyeModulo, moduloMinimoPlan,
} from '../planes/catalogo';

describe('catálogo de planes', () => {
  it('expone los tres planes ordenados por precio ascendente', () => {
    const planes = listarPlanes();
    expect(planes.map(p => p.codigo)).toEqual(['starter', 'professional', 'enterprise']);
    const precios = planes.map(p => p.precio_mensual_cop);
    expect(precios).toEqual([...precios].sort((a, b) => a - b));
  });

  it('ningún plan supera los 50.000 COP (económico y masivo)', () => {
    for (const p of listarPlanes()) {
      expect(p.precio_mensual_cop).toBeLessThanOrEqual(50000);
    }
  });

  it('starter (Gratis) es $0, con marca de agua y topes bajos', () => {
    const s = getPlan('starter');
    expect(s.precio_mensual_cop).toBe(0);
    expect(s.limites.watermark_tickets).toBe(true);
    expect(s.limites.max_sedes).toBe(1);
    expect(s.limites.max_usuarios).toBe(2);
    expect(s.limites.max_productos).toBe(60);
  });

  it('professional y enterprise no tienen marca de agua ni tope de productos', () => {
    for (const codigo of ['professional', 'enterprise'] as const) {
      const p = getPlan(codigo);
      expect(p.limites.watermark_tickets).toBe(false);
      expect(esIlimitado(p.limites.max_productos)).toBe(true);
    }
  });
});

describe('excedeLimite / esIlimitado', () => {
  it('un límite ilimitado nunca se excede', () => {
    expect(esIlimitado(ILIMITADO)).toBe(true);
    expect(excedeLimite(9999, ILIMITADO)).toBe(false);
  });

  it('se excede al ALCANZAR el tope (comparación >=, se llama antes de crear)', () => {
    expect(excedeLimite(2, 2)).toBe(true);   // ya hay 2, el 3º no cabe
    expect(excedeLimite(1, 2)).toBe(false);  // hay 1, el 2º sí cabe
    expect(excedeLimite(60, 60)).toBe(true);
    expect(excedeLimite(59, 60)).toBe(false);
  });
});

describe('gating de módulos por plan', () => {
  it('starter (Gratis) no incluye ningún módulo de pago', () => {
    for (const m of ['recetas', 'proveedores', 'listas_compras', 'clientes', 'nomina', 'documentos'] as const) {
      expect(planIncluyeModulo('starter', m)).toBe(false);
    }
  });

  it('professional incluye recetas/proveedores/listas/clientes pero NO nómina/documentos', () => {
    expect(planIncluyeModulo('professional', 'recetas')).toBe(true);
    expect(planIncluyeModulo('professional', 'proveedores')).toBe(true);
    expect(planIncluyeModulo('professional', 'listas_compras')).toBe(true);
    expect(planIncluyeModulo('professional', 'clientes')).toBe(true);
    expect(planIncluyeModulo('professional', 'nomina')).toBe(false);
    expect(planIncluyeModulo('professional', 'documentos')).toBe(false);
  });

  it('enterprise incluye todos los módulos', () => {
    for (const m of ['recetas', 'proveedores', 'listas_compras', 'clientes', 'nomina', 'documentos'] as const) {
      expect(planIncluyeModulo('enterprise', m)).toBe(true);
    }
  });

  it('moduloMinimoPlan indica el plan más barato que desbloquea cada módulo', () => {
    expect(moduloMinimoPlan('recetas')).toBe('professional');
    expect(moduloMinimoPlan('clientes')).toBe('professional');
    expect(moduloMinimoPlan('nomina')).toBe('enterprise');
    expect(moduloMinimoPlan('documentos')).toBe('enterprise');
  });
});
