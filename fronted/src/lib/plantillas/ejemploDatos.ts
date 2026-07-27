/**
 * ejemploDatos.ts — Única fuente de datos de ejemplo para el preview de plantillas.
 *
 * Cubre TODOS los campos que cualquier sección puede mostrar, de modo que al
 * hacer toggle de cualquier campo en el editor, el preview siempre tiene algo
 * que mostrar u ocultar.
 */

import type { PrintOrden, PrintPago, PrintNegocio } from './ticketRenderer';

// Logo de ejemplo (SVG inline como data-URI) para que el preview muestre el
// efecto del toggle "Mostrar logo" sin depender de una imagen externa.
const LOGO_EJEMPLO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
      <rect width="120" height="60" rx="8" fill="#111"/>
      <text x="60" y="38" font-family="Georgia, serif" font-size="22" fill="#fff"
        text-anchor="middle" font-weight="bold">LOGO</text>
    </svg>`,
  );

export const NEGOCIO_EJEMPLO: PrintNegocio = {
  nombre:         'La Bodega Gourmet',
  nit:            '900.123.456-7',
  telefono:       '601 234 5678',
  ciudad:         'Cra 7 #45-10, Bogotá',
  resolucionDian: '18764000125671',
  logoUrl:        LOGO_EJEMPLO,
};

export const ORDEN_EJEMPLO: PrintOrden = {
  numero_orden:    'ORD-0042',
  tipo_orden:      'local',
  fecha_apertura:  '2025-06-24T14:32:00.000Z',
  nombre_contacto: 'Juan Gómez',
  telefono:        '315 987 6543',
  mesa:            '5',
  mesero:          'María López',
  prioridad:       'ALTA',
  observaciones:   'Sin gluten en las papas',
  detalles: [
    {
      nombre:          'Hamburguesa clásica',
      cantidad:        2,
      precio_unitario: 18000,
      variante:        'Término 3/4',
      notas:           'Sin cebolla',
    },
    {
      nombre:          'Limonada de coco',
      cantidad:        1,
      precio_unitario: 8000,
    },
    {
      nombre:          'Papas con salsa',
      cantidad:        1,
      precio_unitario: 7000,
      variante:        'Porción grande',
    },
  ],
  subtotal:  51000,
  impuestos:  4794,
  total:     55794,
};

export const PAGOS_EJEMPLO: PrintPago[] = [
  { metodo: 'Efectivo', monto: 60000 },
];
