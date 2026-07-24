/**
 * Tests del sistema de tokens.
 *
 * Lo que protegen: que el color de marca del tenant llegue de verdad a toda la
 * app. Antes de esta fundación, `colorPrimario` moría en `palette.primary.main`
 * y las pantallas operativas (Órdenes, Dashboard, Cocina, Inventario) se
 * quedaban con colores quemados a mano — la promesa white-label estaba rota.
 */

import { describe, expect, it } from 'vitest';
import { construirRampaMarca, PARADAS, SEMANTICOS } from '../theme/tokens';
import { construirTema, construirVariablesCSS } from '../theme';
import { clasesEstado, colorMuiEstado, definirEstado } from '../theme/estados';

describe('construirRampaMarca', () => {
  it('devuelve las diez paradas', () => {
    const rampa = construirRampaMarca('#e53935');
    expect(Object.keys(rampa)).toHaveLength(PARADAS.length);
  });

  it('deja la parada 500 igual al color que eligió el cliente', () => {
    // Es el color que aprobó y el que tiene en su logo: no se debe alterar.
    expect(construirRampaMarca('#e53935')[500]).toBe('229 57 53');
    expect(construirRampaMarca('#2563eb')[500]).toBe('37 99 235');
  });

  it('produce canales RGB, no hex (lo que Tailwind necesita para la opacidad)', () => {
    const rampa = construirRampaMarca('#e53935');
    for (const parada of PARADAS) {
      expect(rampa[parada]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it('aclara por debajo de 500 y oscurece por encima', () => {
    const rampa = construirRampaMarca('#e53935');
    const luma = (canales: string) => {
      const [r, g, b] = canales.split(' ').map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(luma(rampa[50])).toBeGreaterThan(luma(rampa[500]));
    expect(luma(rampa[900])).toBeLessThan(luma(rampa[500]));
  });

  it('cae al color por defecto si el cliente escribe algo inválido', () => {
    // El campo de color de Apariencia es texto libre: alguien puede pegar
    // cualquier cosa y la app no debe quedarse sin marca.
    expect(construirRampaMarca('no-es-un-color')[500]).toBe('229 57 53');
    expect(construirRampaMarca('')[500]).toBe('229 57 53');
  });

  it('acepta los formatos de color que un cliente puede pegar', () => {
    expect(() => construirRampaMarca('#fff')).not.toThrow();
    expect(() => construirRampaMarca('rgb(37, 99, 235)')).not.toThrow();
  });
});

describe('construirVariablesCSS', () => {
  it('publica la marca y los cinco tonos semánticos en :root', () => {
    const vars = construirVariablesCSS('#2563eb')[':root'];
    for (const prefijo of ['brand', 'exito', 'alerta', 'peligro', 'info', 'neutro']) {
      for (const parada of PARADAS) {
        expect(vars[`--${prefijo}-${parada}`]).toBeDefined();
      }
    }
  });

  it('refleja el color del tenant — es lo que hace funcionar el white-label', () => {
    const azul = construirVariablesCSS('#2563eb')[':root'];
    const rojo = construirVariablesCSS('#e53935')[':root'];
    expect(azul['--brand-500']).toBe('37 99 235');
    expect(rojo['--brand-500']).toBe('229 57 53');
    expect(azul['--brand-500']).not.toBe(rojo['--brand-500']);
  });

  it('deja los tonos semánticos fijos: el estado no cambia con la marca', () => {
    // "Cancelada" tiene que verse roja aunque el cliente elija marca roja o
    // verde; si el estado siguiera a la marca, se perdería el significado.
    const azul = construirVariablesCSS('#2563eb')[':root'];
    const rojo = construirVariablesCSS('#e53935')[':root'];
    expect(azul['--peligro-600']).toBe(rojo['--peligro-600']);
    expect(azul['--exito-600']).toBe(SEMANTICOS.exito[600]);
  });
});

describe('construirTema', () => {
  it('aplica el color del tenant a la paleta primaria de MUI', () => {
    expect(construirTema('#2563eb').palette.primary.main).toBe('rgb(37 99 235)');
  });

  it('define la tipografía — antes MUI caía a Roboto y Tailwind a system-ui', () => {
    expect(construirTema('#e53935').typography.fontFamily).toContain('Inter');
  });

  it('sube el radio de MUI al que ya usaban las páginas Tailwind', () => {
    // El default de MUI era 4px contra los 12px de rounded-xl: una tarjeta MUI
    // y una Tailwind lado a lado parecían de productos distintos.
    expect(construirTema('#e53935').shape.borderRadius).toBe(12);
  });
});

describe('estados', () => {
  it('da el mismo tono a un estado sea cual sea el consumidor', () => {
    // Antes "Pendiente" se definía en cinco archivos y se desincronizaban.
    expect(definirEstado('PENDIENTE').tono).toBe('alerta');
    expect(colorMuiEstado('PENDIENTE')).toBe('warning');
    expect(clasesEstado('PENDIENTE').insignia).toContain('alerta');
  });

  it('no distingue mayúsculas en el código de estado', () => {
    expect(definirEstado('pendiente').tono).toBe(definirEstado('PENDIENTE').tono);
  });

  it('degrada a neutro ante un estado que el frontend aún no conoce', () => {
    // El backend puede introducir estados nuevos antes que el frontend.
    const d = definirEstado('ESTADO_NUEVO_DEL_BACKEND');
    expect(d.tono).toBe('neutro');
    expect(d.label).toBe('ESTADO_NUEVO_DEL_BACKEND');
  });

  it('separa el dominio de entidad del de orden', () => {
    expect(definirEstado('activo', 'entidad').tono).toBe('exito');
    expect(definirEstado('eliminado', 'entidad').tono).toBe('peligro');
  });

  it('devuelve clases literales para que el JIT de Tailwind las genere', () => {
    // Si se construyeran con plantillas (`bg-${tono}-50`), Tailwind no las
    // encontraría al escanear el código y no emitiría ninguna regla.
    expect(clasesEstado('LISTA').insignia).toBe('bg-exito-50 text-exito-700 border border-exito-200');
  });
});
