/**
 * resolverPerfil — función pura que traduce ejes/arquetipos del wizard
 * a la lista exacta de flags y configs KV que el endpoint apply debe persistir.
 *
 * Sin acceso a BD, sin efectos secundarios, determinista.
 * Misma entrada → misma salida siempre.
 *
 * Notas de implementación para el endpoint apply:
 *   - "plantilla de ticket por defecto" (facturacion_tipo=ticket) no tiene un nombre
 *     de flag/KV en el catálogo → el apply debe crearla directamente, no viene aquí.
 *   - "activa cron de alertas" (inventario=avanzado) es infraestructura (job siempre
 *     activo); el flag `inventario.lotes=on` es la señal suficiente para el apply.
 *   - `buildContexto` vive en flagContexto.ts y se usa al escribir en BD con IDs reales;
 *     aquí solo etiquetamos cada salida con nivel 'grupo'|'sede'.
 */

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type Nivel = 'grupo' | 'sede';

export interface FlagSalida {
  nombre: string;
  habilitado: boolean;
  nivel: Nivel;
}

export interface ConfigSalida {
  clave: string;
  valor: string;
  nivel: Nivel;
}

export interface PerfilResuelta {
  flags: FlagSalida[];
  configs: ConfigSalida[];
}

export interface EntradaResolver {
  /** Slug del arquetipo (opcional). Si viene, actúa como preset de ejes. */
  arquetipo?: string;
  /** Overrides del usuario. Se aplican encima del preset del arquetipo. */
  ejes?: Record<string, string>;
}

// ── Arquetipos — presets de ejes según tabla Sección 6 del catálogo ───────────

const ARQUETIPOS: Record<string, Record<string, string>> = {
  dark_kitchen: {
    servicio:         'delivery',
    inventario:       'simple',
    recetas:          'simple',
    facturacion_tipo: 'ticket',
    caja:             'no',
    clientes:         'registro',
    multisede:        'no',
    franquicia:       'no',
  },
  con_mesas: {
    servicio:         'mesas',
    inventario:       'avanzado',
    recetas:          'fases',
    facturacion_tipo: 'ambos',
    caja:             'si',
    clientes:         'registro',
    multisede:        'no',
    franquicia:       'no',
  },
  comida_rapida: {
    servicio:         'mostrador',
    inventario:       'simple',
    recetas:          'simple',
    facturacion_tipo: 'ticket',
    caja:             'si',
    clientes:         'anonimo',
    multisede:        'no',
    franquicia:       'no',
  },
  cafeteria: {
    servicio:         'mostrador',
    inventario:       'simple',
    recetas:          'no',
    facturacion_tipo: 'ticket',
    caja:             'si',
    clientes:         'anonimo',
    multisede:        'no',
    franquicia:       'no',
  },
  bar: {
    servicio:         'mixto',
    inventario:       'avanzado',
    recetas:          'simple',
    facturacion_tipo: 'ambos',
    caja:             'si',
    clientes:         'anonimo',
    multisede:        'no',
    franquicia:       'no',
  },
  franquicia: {
    servicio:         'mixto',
    inventario:       'avanzado',
    recetas:          'fases',
    facturacion_tipo: 'ambos',
    caja:             'si',
    clientes:         'puntos',
    multisede:        'si',
    franquicia:       'si',
  },
};

// ── Traductores — un traductor por eje ─────────────────────────────────────────
// Cada función devuelve { flags, configs } con nivel según el catálogo:
//   (S) → 'sede'   (G) → 'grupo'   (G define, S usa) → 'grupo'

type Produccion = { flags: FlagSalida[]; configs: ConfigSalida[] };

function traducirServicio(valor: string): Produccion {
  // Eje 1 (S). ordenes.modelo_servicio es un KV de configuración, no un flag booleano.
  const configs: ConfigSalida[] = [{ clave: 'ordenes.modelo_servicio', valor, nivel: 'sede' }];
  switch (valor) {
    case 'delivery':
    case 'mostrador':
      return {
        flags: [
          { nombre: 'modulo.mesas',    habilitado: false, nivel: 'sede' },
          { nombre: 'ordenes.propina', habilitado: false, nivel: 'sede' },
        ],
        configs,
      };
    case 'mesas':
    case 'mixto':
      return {
        // módulo parcial: solo activa el flag; el frontend muestra únicamente el campo mesa
        flags: [
          { nombre: 'modulo.mesas',    habilitado: true, nivel: 'sede' },
          { nombre: 'ordenes.propina', habilitado: true, nivel: 'sede' },
        ],
        configs,
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'servicio': '${valor}'. Válidos: delivery, mostrador, mesas, mixto`,
      );
  }
}

function traducirInventario(valor: string): Produccion {
  // Eje 2 (S).
  switch (valor) {
    case 'no':
      return {
        flags: [
          { nombre: 'modulo.inventario',       habilitado: false, nivel: 'sede' },
          { nombre: 'inventario.descuento_auto', habilitado: false, nivel: 'sede' },
        ],
        configs: [],
      };
    case 'simple':
      return {
        flags: [
          { nombre: 'modulo.inventario',       habilitado: true,  nivel: 'sede' },
          { nombre: 'inventario.lotes',         habilitado: false, nivel: 'sede' },
          { nombre: 'inventario.descuento_auto', habilitado: true,  nivel: 'sede' },
        ],
        configs: [],
      };
    case 'avanzado':
      return {
        // "activa cron de alertas" es nota para el apply; inventario.lotes=on es la señal
        flags: [
          { nombre: 'modulo.inventario',       habilitado: true, nivel: 'sede' },
          { nombre: 'inventario.lotes',         habilitado: true, nivel: 'sede' },
          { nombre: 'inventario.descuento_auto', habilitado: true, nivel: 'sede' },
        ],
        configs: [],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'inventario': '${valor}'. Válidos: no, simple, avanzado`,
      );
  }
}

function traducirRecetas(valor: string): Produccion {
  // Eje 3 (G define, S usa) → nivel grupo para los flags de módulo.
  switch (valor) {
    case 'no':
      return {
        flags: [{ nombre: 'modulo.recetas', habilitado: false, nivel: 'grupo' }],
        configs: [],
      };
    case 'simple':
      return {
        flags: [
          { nombre: 'modulo.recetas', habilitado: true,  nivel: 'grupo' },
          { nombre: 'recetas.fases',  habilitado: false, nivel: 'grupo' },
        ],
        configs: [],
      };
    case 'fases':
      return {
        flags: [
          { nombre: 'modulo.recetas', habilitado: true, nivel: 'grupo' },
          { nombre: 'recetas.fases',  habilitado: true, nivel: 'grupo' },
        ],
        configs: [],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'recetas': '${valor}'. Válidos: no, simple, fases`,
      );
  }
}

function traducirFacturacionTipo(valor: string): Produccion {
  // Eje 4 (S). "plantilla de ticket por defecto" (opción ticket) no tiene nombre
  // de flag/KV en el catálogo → es responsabilidad del endpoint apply, no del resolver.
  switch (valor) {
    case 'ticket':
      return {
        flags:   [],
        configs: [{ clave: 'facturacion.tipo', valor: 'ticket', nivel: 'sede' }],
      };
    case 'formal':
      return {
        flags:   [{ nombre: 'modulo.facturas', habilitado: true, nivel: 'sede' }],
        configs: [{ clave: 'facturacion.tipo', valor: 'formal', nivel: 'sede' }],
      };
    case 'ambos':
      return {
        flags:   [{ nombre: 'modulo.facturas', habilitado: true, nivel: 'sede' }],
        configs: [{ clave: 'facturacion.tipo', valor: 'ambos', nivel: 'sede' }],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'facturacion_tipo': '${valor}'. Válidos: ticket, formal, ambos`,
      );
  }
}

function traducirMoneda(valor: string): Produccion {
  // Eje 4 (S) — pregunta separada. Se emite solo si el usuario la proporcionó.
  if (!valor.trim()) {
    throw new Error(`resolverPerfil: 'moneda' no puede ser una cadena vacía`);
  }
  return {
    flags:   [],
    configs: [{ clave: 'general.moneda', valor, nivel: 'sede' }],
  };
}

function traducirCaja(valor: string): Produccion {
  // Eje 5 (S).
  switch (valor) {
    case 'no':
      return { flags: [{ nombre: 'modulo.caja', habilitado: false, nivel: 'sede' }], configs: [] };
    case 'si':
      return { flags: [{ nombre: 'modulo.caja', habilitado: true,  nivel: 'sede' }], configs: [] };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'caja': '${valor}'. Válidos: no, si`,
      );
  }
}

function traducirClientes(valor: string): Produccion {
  // Eje 6 (G). Único dueño de modulo.clientes y modulo.fidelizacion.
  // Delivery + anónimo es una combinación válida (dark kitchen sin base de clientes).
  switch (valor) {
    case 'anonimo':
      return {
        flags: [
          { nombre: 'modulo.clientes',     habilitado: false, nivel: 'grupo' },
          { nombre: 'modulo.fidelizacion', habilitado: false, nivel: 'grupo' },
        ],
        configs: [],
      };
    case 'registro':
      return {
        flags: [
          { nombre: 'modulo.clientes',     habilitado: true,  nivel: 'grupo' },
          { nombre: 'modulo.fidelizacion', habilitado: false, nivel: 'grupo' },
        ],
        configs: [],
      };
    case 'puntos':
      return {
        flags: [
          { nombre: 'modulo.clientes',     habilitado: true, nivel: 'grupo' },
          { nombre: 'modulo.fidelizacion', habilitado: true, nivel: 'grupo' },
        ],
        configs: [],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'clientes': '${valor}'. Válidos: anonimo, registro, puntos`,
      );
  }
}

function traducirFranquicia(valor: string): Produccion {
  // Sub-eje 4B (S, adaptativo). Único dueño de facturacion.impuesto_tipo e
  // impuesto_tarifa. Si el eje no viene en la entrada, no se llama y no emite nada:
  // las claves caen al default global del seed (impoconsumo / 8).
  switch (valor) {
    case 'no':
      return {
        flags: [],
        configs: [
          { clave: 'facturacion.impuesto_tipo',    valor: 'impoconsumo', nivel: 'sede' },
          { clave: 'facturacion.impuesto_tarifa',  valor: '8',           nivel: 'sede' },
        ],
      };
    case 'si':
      return {
        flags: [],
        configs: [
          { clave: 'facturacion.impuesto_tipo',    valor: 'iva', nivel: 'sede' },
          { clave: 'facturacion.impuesto_tarifa',  valor: '19',  nivel: 'sede' },
        ],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'franquicia': '${valor}'. Válidos: no, si`,
      );
  }
}

function traducirMultisede(valor: string): Produccion {
  // Eje 7 (G). No afecta la arquitectura de órdenes; OrdenSede siempre activa.
  switch (valor) {
    case 'no':
      return {
        flags: [
          { nombre: 'estructura.multisede',           habilitado: false, nivel: 'grupo' },
          { nombre: 'modulo.reportes_consolidados',    habilitado: false, nivel: 'grupo' },
        ],
        configs: [],
      };
    case 'si':
      return {
        flags: [
          { nombre: 'estructura.multisede',           habilitado: true, nivel: 'grupo' },
          { nombre: 'modulo.reportes_consolidados',    habilitado: true, nivel: 'grupo' },
        ],
        configs: [],
      };
    default:
      throw new Error(
        `resolverPerfil: valor desconocido para eje 'multisede': '${valor}'. Válidos: no, si`,
      );
  }
}

type TraductorFn = (valor: string) => Produccion;

const TRADUCTORES: Record<string, TraductorFn> = {
  servicio:         traducirServicio,
  inventario:       traducirInventario,
  recetas:          traducirRecetas,
  facturacion_tipo: traducirFacturacionTipo,
  moneda:           traducirMoneda,
  caja:             traducirCaja,
  clientes:         traducirClientes,
  multisede:        traducirMultisede,
  franquicia:       traducirFranquicia,
};

// ── Guardia de colisiones ──────────────────────────────────────────────────────
// Exportada para poder testearla de forma aislada.

interface ProduccionConEje extends Produccion {
  eje: string;
}

export function mergeConColisionGuard(produccionesPorEje: ProduccionConEje[]): PerfilResuelta {
  const flagMap   = new Map<string, { habilitado: boolean; nivel: Nivel; eje: string }>();
  const configMap = new Map<string, { valor: string;     nivel: Nivel; eje: string }>();

  for (const { eje, flags, configs } of produccionesPorEje) {
    for (const f of flags) {
      const existing = flagMap.get(f.nombre);
      if (existing !== undefined && existing.habilitado !== f.habilitado) {
        throw new Error(
          `resolverPerfil: colisión en flag '${f.nombre}': ` +
          `eje '${existing.eje}' escribe ${existing.habilitado}, ` +
          `eje '${eje}' escribe ${f.habilitado}. ` +
          `El catálogo no define una regla de precedencia explícita para esta clave.`,
        );
      }
      if (existing === undefined) flagMap.set(f.nombre, { habilitado: f.habilitado, nivel: f.nivel, eje });
    }

    for (const c of configs) {
      const existing = configMap.get(c.clave);
      if (existing !== undefined && existing.valor !== c.valor) {
        throw new Error(
          `resolverPerfil: colisión en config '${c.clave}': ` +
          `eje '${existing.eje}' escribe '${existing.valor}', ` +
          `eje '${eje}' escribe '${c.valor}'. ` +
          `El catálogo no define una regla de precedencia explícita para esta clave.`,
        );
      }
      if (existing === undefined) configMap.set(c.clave, { valor: c.valor, nivel: c.nivel, eje });
    }
  }

  return {
    flags:   [...flagMap.entries()].map(([nombre, { habilitado, nivel }]) => ({ nombre, habilitado, nivel })),
    configs: [...configMap.entries()].map(([clave, { valor, nivel }])     => ({ clave,  valor,     nivel })),
  };
}

// ── Función principal ──────────────────────────────────────────────────────────

export function resolverPerfil({ arquetipo, ejes }: EntradaResolver): PerfilResuelta {
  // 1. Partir del preset del arquetipo (si viene)
  let ejesResueltos: Record<string, string> = {};

  if (arquetipo !== undefined) {
    const preset = ARQUETIPOS[arquetipo];
    if (!preset) {
      throw new Error(
        `resolverPerfil: arquetipo desconocido '${arquetipo}'. ` +
        `Válidos: ${Object.keys(ARQUETIPOS).join(', ')}`,
      );
    }
    ejesResueltos = { ...preset };
  }

  // 2. Aplicar overrides del usuario encima del preset
  if (ejes !== undefined) {
    for (const clave of Object.keys(ejes)) {
      if (!TRADUCTORES[clave]) {
        throw new Error(
          `resolverPerfil: eje desconocido '${clave}'. ` +
          `Válidos: ${Object.keys(TRADUCTORES).join(', ')}`,
        );
      }
    }
    ejesResueltos = { ...ejesResueltos, ...ejes };
  }

  if (Object.keys(ejesResueltos).length === 0) {
    throw new Error(
      `resolverPerfil: debe proporcionarse al menos un arquetipo o un eje`,
    );
  }

  // 3. Traducir cada eje a flags + configs
  const producciones: ProduccionConEje[] = Object.entries(ejesResueltos).map(
    ([eje, valor]) => ({ eje, ...TRADUCTORES[eje](valor) }),
  );

  // 4. Merge con guardia de colisiones
  return mergeConColisionGuard(producciones);
}
