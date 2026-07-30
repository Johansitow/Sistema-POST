/**
 * Tipos de plantillas térmicas (tirilla) — fuente única compartida.
 *
 * Estos son los tipos que el editor de impresión del frontend puede crear/editar
 * y que pinta `ticketRenderer.ts`. La familia `documento_*` (documentos laborales)
 * vive aparte en `lib/documentos/catalogo.ts` porque la renderiza el backend.
 *
 * Se centraliza aquí para que el `z.enum` del controller y `TIPOS_VALIDOS` del
 * service NUNCA se desincronicen (antes el controller aceptaba 4 tipos pero el
 * service listaba otros, provocando rechazos silenciosos).
 */
export const TIPOS_TERMICOS = ['comanda', 'factura', 'ticket', 'cocina'] as const;

export type TipoTermico = (typeof TIPOS_TERMICOS)[number];
