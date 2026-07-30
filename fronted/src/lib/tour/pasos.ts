/**
 * pasos.ts — guion del modo tutorial (product tour), como datos puros.
 *
 * Cada paso apunta a un elemento real de la UI vía un selector `data-tour`. El
 * motor (tourStore + TourOverlay) resuelve el elemento en el DOM; si no existe
 * —porque el módulo está oculto para ese rol, feature flag apagado, o viewport
 * móvil— el paso se SALTA en vez de romper el recorrido. Así un mismo guion
 * sirve para cajero y administrador.
 *
 * Los pasos sin `target` son tarjetas centradas (bienvenida / cierre), que el
 * motor pinta con el Modal accesible común en vez de un tooltip anclado.
 *
 * Los anclajes viven en el chasis (Layout.tsx): sidebar y AppBar están siempre
 * montados, así que el tour recorre toda la app sin navegar entre rutas. Para un
 * paso que sí necesite otra pantalla, se puede rellenar `ruta`.
 */

export type PosicionTooltip = 'top' | 'bottom' | 'left' | 'right';

export interface PasoTour {
  /** Identificador estable del paso (para tests y keys de React). */
  id: string;
  /**
   * Selector CSS del elemento a resaltar. Si se omite, el paso es una tarjeta
   * centrada (bienvenida/cierre).
   */
  target?: string;
  titulo: string;
  contenido: string;
  /** Lado preferido del tooltip respecto al target. El motor hace flip si no cabe. */
  posicion?: PosicionTooltip;
  /** Ruta a la que navegar antes de mostrar el paso (opcional). */
  ruta?: string;
}

/**
 * Guion global del POS. Cubre el chasis (sidebar + acciones clave del AppBar).
 * Ampliar a mini-tours por módulo queda fuera de este primer alcance.
 */
export const PASOS_TOUR: PasoTour[] = [
  {
    id: 'bienvenida',
    titulo: '¡Te damos la bienvenida! 👋',
    contenido:
      'Este recorrido de un minuto te muestra dónde está cada cosa. Puedes salir cuando quieras y retomarlo después desde tu menú de usuario.',
  },
  {
    id: 'dashboard',
    target: '[data-tour="nav-/dashboard"]',
    titulo: 'Tu panel de inicio',
    contenido:
      'El Dashboard resume ventas, órdenes y alertas del día. Es tu punto de partida cada mañana.',
    posicion: 'right',
  },
  {
    id: 'ordenes',
    target: '[data-tour="nav-/ordenes"]',
    titulo: 'Órdenes',
    contenido:
      'Aquí registras y gestionas los pedidos: crear una orden, cobrar y ver su estado en tiempo real.',
    posicion: 'right',
  },
  {
    id: 'cocina',
    target: '[data-tour="nav-/cocina"]',
    titulo: 'Pantalla de cocina (KDS)',
    contenido:
      'La cocina ve los pedidos entrantes y los marca como listos. Se actualiza al instante, sin recargar.',
    posicion: 'right',
  },
  {
    id: 'inventario',
    target: '[data-tour="nav-/inventario"]',
    titulo: 'Inventario',
    contenido:
      'Controla el stock por sede, registra entradas y recibe alertas cuando algo está por agotarse.',
    posicion: 'right',
  },
  {
    id: 'caja',
    target: '[data-tour="nav-/caja"]',
    titulo: 'Caja',
    contenido:
      'Abre y cierra el turno de caja, y cuadra lo recaudado al final del día.',
    posicion: 'right',
  },
  {
    id: 'reportes',
    target: '[data-tour="nav-/reportes"]',
    titulo: 'Reportes',
    contenido:
      'Analiza ventas, rentabilidad y desempeño con reportes filtrables por periodo y sede.',
    posicion: 'right',
  },
  {
    id: 'selector-sede',
    target: '[data-tour="selector-sede"]',
    titulo: 'Cambia de sucursal',
    contenido:
      'Si tienes varias sedes, cámbialas aquí. Toda la información se recarga con la sede activa.',
    posicion: 'bottom',
  },
  {
    id: 'notificaciones',
    target: '[data-tour="notificaciones"]',
    titulo: 'Notificaciones',
    contenido:
      'La campana te avisa de stock bajo, cierres pendientes y otros eventos importantes.',
    posicion: 'bottom',
  },
  {
    id: 'usuario-menu',
    target: '[data-tour="usuario-menu"]',
    titulo: 'Tu cuenta',
    contenido:
      'Desde aquí entras a tu perfil, cierras sesión y puedes volver a lanzar este tutorial cuando lo necesites.',
    posicion: 'bottom',
  },
  {
    id: 'cierre',
    titulo: '¡Listo para empezar! 🎉',
    contenido:
      'Eso es todo lo esencial. Explora con confianza: siempre podrás repetir el recorrido desde tu menú de usuario.',
  },
];
