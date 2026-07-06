/**
 * Fuente única de datos de UI del wizard de onboarding.
 *
 * Responsabilidad: traducir slugs técnicos (arquetipos, claves de flags/configs)
 * a texto legible para el usuario. NO contiene lógica de negocio — eso vive en
 * resolverPerfil.ts en el backend.
 *
 * Usado por: Paso1Arquetipo (cards + "qué incluye"), Paso2Ejes (preguntas),
 *            Paso3Revisar (bloques de activación/desactivación/bloqueo).
 */

// ── Arquetipos ─────────────────────────────────────────────────────────────────

export interface ArquetipoUI {
  slug: string;
  label: string;
  descripcion: string;
  incluye: { label: string }[];
}

export const ARQUETIPOS_UI: ArquetipoUI[] = [
  {
    slug: 'dark_kitchen',
    label: 'Cocina oculta',
    descripcion: 'Solo domicilios, sin salón',
    incluye: [
      { label: 'Solo domicilios' },
      { label: 'Inventario simple' },
      { label: 'Registro de clientes' },
      { label: 'Ticket de venta' },
    ],
  },
  {
    slug: 'con_mesas',
    label: 'Restaurante con mesas',
    descripcion: 'Servicio en salón',
    incluye: [
      { label: 'Mesas y propina' },
      { label: 'Inventario con lotes' },
      { label: 'Recetas por fases' },
      { label: 'Ticket y factura' },
      { label: 'Turnos de caja' },
      { label: 'Registro de clientes' },
    ],
  },
  {
    slug: 'comida_rapida',
    label: 'Comida rápida',
    descripcion: 'Pedido en mostrador',
    incluye: [
      { label: 'Pedido en mostrador' },
      { label: 'Inventario simple' },
      { label: 'Ticket de venta' },
      { label: 'Turnos de caja' },
    ],
  },
  {
    slug: 'cafeteria',
    label: 'Cafetería / panadería',
    descripcion: 'Producto sobre vitrina',
    incluye: [
      { label: 'Producto sobre vitrina' },
      { label: 'Inventario simple' },
      { label: 'Ticket de venta' },
      { label: 'Turnos de caja' },
    ],
  },
  {
    slug: 'bar',
    label: 'Bar',
    descripcion: 'Rondas y licor por lote',
    incluye: [
      { label: 'Servicio mixto' },
      { label: 'Inventario con lotes' },
      { label: 'Ticket y factura' },
      { label: 'Turnos de caja' },
    ],
  },
  {
    slug: 'franquicia',
    label: 'Franquicia',
    descripcion: 'Varias sedes, IVA 19%',
    incluye: [
      { label: 'Servicio mixto' },
      { label: 'Inventario con lotes' },
      { label: 'Recetas por fases' },
      { label: 'Multi-sede' },
      { label: 'Fidelización de clientes' },
    ],
  },
];

// ── Preguntas de ajuste en Paso 2 ─────────────────────────────────────────────
// El resto de los ejes viene implícito en el arquetipo y no se pregunta al usuario.

export interface OpcionEje {
  valor: string;
  label: string;
}

export interface PreguntaEje {
  eje: string;
  pregunta: string;
  ayuda: string;
  tipo: 'toggle' | 'select';
  opciones: OpcionEje[];
}

export const PREGUNTAS_EJE: PreguntaEje[] = [
  {
    eje: 'multisede',
    pregunta: '¿Cuántas sedes manejas?',
    ayuda: 'Si tienes varias, activamos reportes consolidados.',
    tipo: 'toggle',
    opciones: [
      { valor: 'no', label: 'Una sola sede' },
      { valor: 'si', label: 'Varias sedes' },
    ],
  },
  {
    eje: 'inventario',
    pregunta: '¿Cómo controlas el inventario?',
    ayuda: 'Con lotes puedes seguir vencimientos y recibir alertas.',
    tipo: 'toggle',
    opciones: [
      { valor: 'simple', label: 'Simple' },
      { valor: 'avanzado', label: 'Con lotes y vencimiento' },
      { valor: 'no', label: 'Sin inventario' },
    ],
  },
  {
    eje: 'franquicia',
    pregunta: '¿Operas bajo franquicia o concesión?',
    ayuda: 'Esto define el impuesto: franquicia cobra IVA 19%, el resto impoconsumo 8%.',
    tipo: 'toggle',
    opciones: [
      { valor: 'no', label: 'No' },
      { valor: 'si', label: 'Sí, soy franquicia' },
    ],
  },
  {
    eje: 'moneda',
    pregunta: 'Moneda',
    ayuda: 'La que usarás en tickets y reportes.',
    tipo: 'select',
    opciones: [
      { valor: 'COP', label: 'Peso colombiano (COP)' },
      { valor: 'USD', label: 'Dólar (USD)' },
    ],
  },
];

// ── Mapa técnica → humana (flags y configs del paso 3) ────────────────────────
// Si una clave no aparece aquí, no se muestra en el bloque "Se activará".
// Garantiza que el usuario NUNCA ve nombres de flags crudos.

const FLAGS_ETIQUETA: Record<string, string> = {
  'modulo.mesas':                 'Servicio en mesas',
  'ordenes.propina':              'Propina en mesas',
  'modulo.inventario':            'Inventario',
  'inventario.lotes':             'Inventario con lotes y vencimiento',
  'inventario.descuento_auto':    'Descuento automático de inventario',
  'modulo.recetas':               'Recetas de producción',
  'recetas.fases':                'Recetas por fases',
  'modulo.facturas':              'Facturación electrónica',
  'modulo.caja':                  'Turnos de caja',
  'modulo.clientes':              'Registro de clientes',
  'modulo.fidelizacion':          'Fidelización de clientes',
  'estructura.multisede':         'Multi-sede',
  'modulo.reportes_consolidados': 'Reportes consolidados',
};

const CONFIGS_ETIQUETA: Record<string, (valor: string) => string> = {
  'ordenes.modelo_servicio': (v) =>
    ({ delivery: 'Solo domicilios', mostrador: 'Pedido en mostrador',
       mesas: 'Servicio en mesas', mixto: 'Servicio mixto' })[v] ?? '',
  'facturacion.tipo': (v) =>
    ({ ticket: 'Ticket de venta', formal: 'Factura electrónica',
       ambos: 'Ticket y factura electrónica' })[v] ?? '',
  'facturacion.impuesto_tipo': (v) =>
    ({ impoconsumo: 'Impoconsumo 8%', iva: 'IVA 19%' })[v] ?? '',
  'general.moneda': (v) =>
    ({ COP: 'Moneda: peso colombiano (COP)', USD: 'Moneda: dólar (USD)' })[v] ?? '',
};

export function etiquetaFlag(nombre: string): string | undefined {
  return FLAGS_ETIQUETA[nombre];
}

export function etiquetaConfig(clave: string, valor: string): string | undefined {
  const fn = CONFIGS_ETIQUETA[clave];
  if (!fn) return undefined;
  const label = fn(valor);
  return label || undefined;
}

// ── Defaults de ejes para Paso 2 (refleja el subset expuesto en PREGUNTAS_EJE) ─

const DEFAULTS_EJES: Record<string, Record<string, string>> = {
  dark_kitchen:  { multisede: 'no', inventario: 'simple',   franquicia: 'no', moneda: 'COP' },
  con_mesas:     { multisede: 'no', inventario: 'avanzado', franquicia: 'no', moneda: 'COP' },
  comida_rapida: { multisede: 'no', inventario: 'simple',   franquicia: 'no', moneda: 'COP' },
  cafeteria:     { multisede: 'no', inventario: 'simple',   franquicia: 'no', moneda: 'COP' },
  bar:           { multisede: 'no', inventario: 'avanzado', franquicia: 'no', moneda: 'COP' },
  franquicia:    { multisede: 'si', inventario: 'avanzado', franquicia: 'si', moneda: 'COP' },
};

export function defaultsEjes(arquetipo: string): Record<string, string> {
  return DEFAULTS_EJES[arquetipo] ?? { multisede: 'no', inventario: 'simple', franquicia: 'no', moneda: 'COP' };
}
