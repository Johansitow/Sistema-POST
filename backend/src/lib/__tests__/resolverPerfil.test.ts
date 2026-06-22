/**
 * Tests para resolverPerfil — función pura, sin BD, sin mocks necesarios.
 *
 * Cubre:
 *   - Los 6 arquetipos resuelven al set completo esperado de flags+configs.
 *   - Arquetipo + override de eje: el override gana.
 *   - Solo ejes, sin arquetipo: resuelve correctamente.
 *   - Módulo parcial (mesas): emite el flag sin asumir backend inexistente.
 *   - Delivery + anónimo: sin colisión (modulo.clientes lo controla solo el Eje 6).
 *   - Guardia de colisiones: lanza error descriptivo si dos ejes escriben valores
 *     distintos a la misma clave.
 */

import { describe, it, expect } from 'vitest';
import { resolverPerfil, mergeConColisionGuard } from '../onboarding/resolverPerfil';
import type { FlagSalida, ConfigSalida } from '../onboarding/resolverPerfil';

// ── Helpers ───────────────────────────────────────────────────────────────────

function flag(nombre: string, habilitado: boolean, nivel: 'grupo' | 'sede'): FlagSalida {
  return { nombre, habilitado, nivel };
}

function cfg(clave: string, valor: string, nivel: 'grupo' | 'sede'): ConfigSalida {
  return { clave, valor, nivel };
}

// Comparación sin importar orden
function expectFlags(result: ReturnType<typeof resolverPerfil>, expected: FlagSalida[]) {
  expect(result.flags).toEqual(expect.arrayContaining(expected));
  expect(result.flags).toHaveLength(expected.length);
}

function expectConfigs(result: ReturnType<typeof resolverPerfil>, expected: ConfigSalida[]) {
  expect(result.configs).toEqual(expect.arrayContaining(expected));
  expect(result.configs).toHaveLength(expected.length);
}

// ── Arquetipos ────────────────────────────────────────────────────────────────

describe('resolverPerfil — arquetipo dark_kitchen', () => {
  const result = resolverPerfil({ arquetipo: 'dark_kitchen' });

  it('emite flags correctos', () => {
    expectFlags(result, [
      flag('modulo.mesas',                 false, 'sede'),
      flag('ordenes.propina',              false, 'sede'),
      flag('modulo.inventario',            true,  'sede'),
      flag('inventario.lotes',             false, 'sede'),
      flag('inventario.descuento_auto',    true,  'sede'),
      flag('modulo.recetas',               true,  'grupo'),
      flag('recetas.fases',                false, 'grupo'),
      flag('modulo.caja',                  false, 'sede'),
      flag('modulo.clientes',              true,  'grupo'),
      flag('modulo.fidelizacion',          false, 'grupo'),
      flag('estructura.multisede',         false, 'grupo'),
      flag('modulo.reportes_consolidados', false, 'grupo'),
    ]);
  });

  it('emite configs correctas', () => {
    expectConfigs(result, [
      cfg('ordenes.modelo_servicio',      'delivery',     'sede'),
      cfg('facturacion.tipo',             'ticket',       'sede'),
      cfg('facturacion.impuesto_tipo',    'impoconsumo',  'sede'),
      cfg('facturacion.impuesto_tarifa',  '8',            'sede'),
    ]);
  });

  it('no emite modulo.facturas (ticket no lo requiere)', () => {
    expect(result.flags.find(f => f.nombre === 'modulo.facturas')).toBeUndefined();
  });
});

describe('resolverPerfil — arquetipo con_mesas', () => {
  const result = resolverPerfil({ arquetipo: 'con_mesas' });

  it('emite flags correctos', () => {
    expectFlags(result, [
      flag('modulo.mesas',                 true,  'sede'),
      flag('ordenes.propina',              true,  'sede'),
      flag('modulo.inventario',            true,  'sede'),
      flag('inventario.lotes',             true,  'sede'),
      flag('inventario.descuento_auto',    true,  'sede'),
      flag('modulo.recetas',               true,  'grupo'),
      flag('recetas.fases',                true,  'grupo'),
      flag('modulo.facturas',              true,  'sede'),
      flag('modulo.caja',                  true,  'sede'),
      flag('modulo.clientes',              true,  'grupo'),
      flag('modulo.fidelizacion',          false, 'grupo'),
      flag('estructura.multisede',         false, 'grupo'),
      flag('modulo.reportes_consolidados', false, 'grupo'),
    ]);
  });

  it('emite configs correctas', () => {
    expectConfigs(result, [
      cfg('ordenes.modelo_servicio',      'mesas',        'sede'),
      cfg('facturacion.tipo',             'ambos',        'sede'),
      cfg('facturacion.impuesto_tipo',    'impoconsumo',  'sede'),
      cfg('facturacion.impuesto_tarifa',  '8',            'sede'),
    ]);
  });
});

describe('resolverPerfil — arquetipo comida_rapida', () => {
  const result = resolverPerfil({ arquetipo: 'comida_rapida' });

  it('emite flags correctos', () => {
    expectFlags(result, [
      flag('modulo.mesas',                 false, 'sede'),
      flag('ordenes.propina',              false, 'sede'),
      flag('modulo.inventario',            true,  'sede'),
      flag('inventario.lotes',             false, 'sede'),
      flag('inventario.descuento_auto',    true,  'sede'),
      flag('modulo.recetas',               true,  'grupo'),
      flag('recetas.fases',                false, 'grupo'),
      flag('modulo.caja',                  true,  'sede'),
      flag('modulo.clientes',              false, 'grupo'),
      flag('modulo.fidelizacion',          false, 'grupo'),
      flag('estructura.multisede',         false, 'grupo'),
      flag('modulo.reportes_consolidados', false, 'grupo'),
    ]);
  });
});

describe('resolverPerfil — arquetipo cafeteria', () => {
  const result = resolverPerfil({ arquetipo: 'cafeteria' });

  it('no emite recetas.fases cuando recetas=no', () => {
    expect(result.flags.find(f => f.nombre === 'recetas.fases')).toBeUndefined();
  });

  it('emite modulo.recetas=false', () => {
    expect(result.flags).toContainEqual(flag('modulo.recetas', false, 'grupo'));
  });

  it('clientes=anonimo → modulo.clientes=false, modulo.fidelizacion=false', () => {
    expect(result.flags).toContainEqual(flag('modulo.clientes',     false, 'grupo'));
    expect(result.flags).toContainEqual(flag('modulo.fidelizacion', false, 'grupo'));
  });
});

describe('resolverPerfil — arquetipo bar', () => {
  const result = resolverPerfil({ arquetipo: 'bar' });

  it('servicio=mixto activa modulo.mesas (módulo parcial)', () => {
    expect(result.flags).toContainEqual(flag('modulo.mesas', true, 'sede'));
  });

  it('emite modulo.facturas por facturacion=ambos', () => {
    expect(result.flags).toContainEqual(flag('modulo.facturas', true, 'sede'));
  });

  it('clientes=anonimo → modulo.clientes y modulo.fidelizacion son false', () => {
    expect(result.flags).toContainEqual(flag('modulo.clientes',     false, 'grupo'));
    expect(result.flags).toContainEqual(flag('modulo.fidelizacion', false, 'grupo'));
  });
});

describe('resolverPerfil — arquetipo franquicia', () => {
  const result = resolverPerfil({ arquetipo: 'franquicia' });

  it('emite flags correctos', () => {
    expectFlags(result, [
      flag('modulo.mesas',                 true,  'sede'),
      flag('ordenes.propina',              true,  'sede'),
      flag('modulo.inventario',            true,  'sede'),
      flag('inventario.lotes',             true,  'sede'),
      flag('inventario.descuento_auto',    true,  'sede'),
      flag('modulo.recetas',               true,  'grupo'),
      flag('recetas.fases',                true,  'grupo'),
      flag('modulo.facturas',              true,  'sede'),
      flag('modulo.caja',                  true,  'sede'),
      flag('modulo.clientes',              true,  'grupo'),
      flag('modulo.fidelizacion',          true,  'grupo'),
      flag('estructura.multisede',         true,  'grupo'),
      flag('modulo.reportes_consolidados', true,  'grupo'),
    ]);
  });

  it('emite configs correctas', () => {
    expectConfigs(result, [
      cfg('ordenes.modelo_servicio',      'mixto', 'sede'),
      cfg('facturacion.tipo',             'ambos', 'sede'),
      cfg('facturacion.impuesto_tipo',    'iva',   'sede'),
      cfg('facturacion.impuesto_tarifa',  '19',    'sede'),
    ]);
  });
});

// ── Override de eje ───────────────────────────────────────────────────────────

describe('resolverPerfil — arquetipo + override de eje', () => {
  it('override de clientes gana sobre preset del arquetipo', () => {
    // dark_kitchen preset: clientes=registro → modulo.clientes=true
    // override:            clientes=anonimo  → modulo.clientes=false
    const result = resolverPerfil({
      arquetipo: 'dark_kitchen',
      ejes:      { clientes: 'anonimo' },
    });
    expect(result.flags).toContainEqual(flag('modulo.clientes',     false, 'grupo'));
    expect(result.flags).toContainEqual(flag('modulo.fidelizacion', false, 'grupo'));
  });

  it('override de facturacion_tipo agrega modulo.facturas cuando el preset no lo tenía', () => {
    // dark_kitchen: facturacion_tipo=ticket → sin modulo.facturas
    // override:     facturacion_tipo=formal → modulo.facturas=true
    const result = resolverPerfil({
      arquetipo: 'dark_kitchen',
      ejes:      { facturacion_tipo: 'formal' },
    });
    expect(result.flags).toContainEqual(flag('modulo.facturas', true, 'sede'));
    expect(result.configs).toContainEqual(cfg('facturacion.tipo', 'formal', 'sede'));
  });

  it('override de inventario de simple a avanzado activa lotes', () => {
    const result = resolverPerfil({
      arquetipo: 'comida_rapida',
      ejes:      { inventario: 'avanzado' },
    });
    expect(result.flags).toContainEqual(flag('inventario.lotes', true, 'sede'));
  });
});

// ── Solo ejes, sin arquetipo ──────────────────────────────────────────────────

describe('resolverPerfil — solo ejes, sin arquetipo', () => {
  it('resuelve correctamente un subconjunto de ejes', () => {
    const result = resolverPerfil({
      ejes: {
        servicio:  'delivery',
        clientes:  'anonimo',
        multisede: 'no',
      },
    });
    expect(result.configs).toContainEqual(cfg('ordenes.modelo_servicio', 'delivery', 'sede'));
    expect(result.flags).toContainEqual(flag('modulo.clientes',         false, 'grupo'));
    expect(result.flags).toContainEqual(flag('estructura.multisede',    false, 'grupo'));
    // No emite flags de inventario porque ese eje no se proporcionó
    expect(result.flags.find(f => f.nombre === 'modulo.inventario')).toBeUndefined();
  });

  it('emite general.moneda solo cuando se proporciona', () => {
    const conMoneda    = resolverPerfil({ ejes: { servicio: 'mostrador', moneda: 'COP' } });
    const sinMoneda    = resolverPerfil({ ejes: { servicio: 'mostrador' } });
    expect(conMoneda.configs).toContainEqual(cfg('general.moneda', 'COP', 'sede'));
    expect(sinMoneda.configs.find(c => c.clave === 'general.moneda')).toBeUndefined();
  });
});

// ── Módulo parcial (mesas) ────────────────────────────────────────────────────

describe('resolverPerfil — módulo parcial mesas', () => {
  it('emite modulo.mesas=true sin asumir gestor de salón completo', () => {
    const result = resolverPerfil({ ejes: { servicio: 'mesas' } });
    // El flag se emite para que el frontend muestre el campo mesa en la orden.
    // No hay flags de plano, estado de mesa ni asignación de mesero.
    expect(result.flags).toContainEqual(flag('modulo.mesas', true, 'sede'));
    expect(result.flags.find(f => f.nombre.startsWith('salon.'))).toBeUndefined();
  });

  it('servicio=mixto también activa modulo.mesas (partial)', () => {
    const result = resolverPerfil({ ejes: { servicio: 'mixto' } });
    expect(result.flags).toContainEqual(flag('modulo.mesas', true, 'sede'));
  });
});

// ── Delivery + anónimo — caso crítico sin colisión ───────────────────────────

describe('resolverPerfil — delivery + anónimo', () => {
  it('no produce colisión en modulo.clientes (Eje 6 es único dueño)', () => {
    // Eje 1 (delivery) NO escribe modulo.clientes.
    // Eje 6 (anonimo)  SÍ escribe modulo.clientes=false.
    // Resultado: una sola entrada en modulo.clientes, sin conflicto.
    const result = resolverPerfil({
      ejes: { servicio: 'delivery', clientes: 'anonimo' },
    });
    const clientesFlags = result.flags.filter(f => f.nombre === 'modulo.clientes');
    expect(clientesFlags).toHaveLength(1);
    expect(clientesFlags[0].habilitado).toBe(false);
  });

  it('dark_kitchen (delivery + registro) resuelve correctamente sin colisión', () => {
    expect(() => resolverPerfil({ arquetipo: 'dark_kitchen' })).not.toThrow();
    const result = resolverPerfil({ arquetipo: 'dark_kitchen' });
    // delivery no toca clientes; registro lo pone en true
    expect(result.flags).toContainEqual(flag('modulo.clientes', true, 'grupo'));
  });
});

// ── Guardia de colisiones ─────────────────────────────────────────────────────

describe('mergeConColisionGuard — guardia de colisiones', () => {
  it('lanza error descriptivo si dos ejes escriben valores DISTINTOS al mismo flag', () => {
    // Simula un futuro eje que pisara modulo.mesas desde otro eje
    expect(() =>
      mergeConColisionGuard([
        {
          eje:     'eje_a',
          flags:   [{ nombre: 'modulo.mesas', habilitado: true,  nivel: 'sede' }],
          configs: [],
        },
        {
          eje:     'eje_b',
          flags:   [{ nombre: 'modulo.mesas', habilitado: false, nivel: 'sede' }],
          configs: [],
        },
      ]),
    ).toThrow(/colisión en flag 'modulo\.mesas'/);
  });

  it('lanza error descriptivo si dos ejes escriben valores DISTINTOS a la misma config', () => {
    expect(() =>
      mergeConColisionGuard([
        {
          eje:     'eje_a',
          flags:   [],
          configs: [{ clave: 'facturacion.tipo', valor: 'ticket', nivel: 'sede' }],
        },
        {
          eje:     'eje_b',
          flags:   [],
          configs: [{ clave: 'facturacion.tipo', valor: 'formal', nivel: 'sede' }],
        },
      ]),
    ).toThrow(/colisión en config 'facturacion\.tipo'/);
  });

  it('NO lanza si dos ejes escriben el MISMO valor a la misma clave (idempotente)', () => {
    expect(() =>
      mergeConColisionGuard([
        {
          eje:     'eje_a',
          flags:   [{ nombre: 'modulo.inventario', habilitado: true, nivel: 'sede' }],
          configs: [],
        },
        {
          eje:     'eje_b',
          flags:   [{ nombre: 'modulo.inventario', habilitado: true, nivel: 'sede' }],
          configs: [],
        },
      ]),
    ).not.toThrow();
  });
});

// ── Sub-eje 4B — Impuesto adaptativo (franquicia) ────────────────────────────

describe('resolverPerfil — sub-eje franquicia (impuesto)', () => {
  it('arquetipo franquicia → impuesto_tipo=iva, tarifa=19', () => {
    const result = resolverPerfil({ arquetipo: 'franquicia' });
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tipo',   'iva', 'sede'));
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tarifa', '19',  'sede'));
  });

  it('arquetipo dark_kitchen → impuesto_tipo=impoconsumo, tarifa=8', () => {
    const result = resolverPerfil({ arquetipo: 'dark_kitchen' });
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tipo',   'impoconsumo', 'sede'));
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tarifa', '8',           'sede'));
  });

  it('override franquicia=si gana sobre el preset no-franquicia', () => {
    // comida_rapida preset: franquicia=no → impoconsumo 8%
    // override: franquicia=si → iva 19%
    const result = resolverPerfil({ arquetipo: 'comida_rapida', ejes: { franquicia: 'si' } });
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tipo',   'iva', 'sede'));
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tarifa', '19',  'sede'));
    // solo una entrada por clave (sin duplicados)
    expect(result.configs.filter(c => c.clave === 'facturacion.impuesto_tipo')).toHaveLength(1);
  });

  it('override franquicia=no sobre arquetipo franquicia → impoconsumo 8%', () => {
    const result = resolverPerfil({ arquetipo: 'franquicia', ejes: { franquicia: 'no' } });
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tipo',   'impoconsumo', 'sede'));
    expect(result.configs).toContainEqual(cfg('facturacion.impuesto_tarifa', '8',           'sede'));
  });

  it('sin eje franquicia → no emite claves de impuesto (cae al default global del seed)', () => {
    // Si el sub-eje no viene, el resolver no emite nada para impuesto_tipo ni tarifa.
    const result = resolverPerfil({ ejes: { servicio: 'delivery', caja: 'no' } });
    expect(result.configs.find(c => c.clave === 'facturacion.impuesto_tipo')).toBeUndefined();
    expect(result.configs.find(c => c.clave === 'facturacion.impuesto_tarifa')).toBeUndefined();
  });

  it('emite ambas claves a nivel sede', () => {
    const result = resolverPerfil({ ejes: { franquicia: 'si' } });
    const tipo   = result.configs.find(c => c.clave === 'facturacion.impuesto_tipo');
    const tarifa = result.configs.find(c => c.clave === 'facturacion.impuesto_tarifa');
    expect(tipo?.nivel).toBe('sede');
    expect(tarifa?.nivel).toBe('sede');
  });
});

// ── Validación de entradas ────────────────────────────────────────────────────

describe('resolverPerfil — validación de entradas', () => {
  it('lanza si el arquetipo no existe', () => {
    expect(() => resolverPerfil({ arquetipo: 'pizzeria' }))
      .toThrow(/arquetipo desconocido/);
  });

  it('lanza si un eje es desconocido', () => {
    expect(() => resolverPerfil({ ejes: { idioma: 'es' } }))
      .toThrow(/eje desconocido/);
  });

  it('lanza si se invoca sin arquetipo ni ejes', () => {
    expect(() => resolverPerfil({}))
      .toThrow(/debe proporcionarse/);
  });

  it('lanza si la moneda es cadena vacía', () => {
    expect(() => resolverPerfil({ ejes: { moneda: '' } }))
      .toThrow(/moneda/);
  });
});
