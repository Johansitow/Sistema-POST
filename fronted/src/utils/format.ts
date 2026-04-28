/**
 * utils/format.ts
 *
 * Funciones puras de formato reutilizables en toda la app.
 * Sin dependencias de React — se pueden usar en servicios, stores y componentes.
 *
 * Regla: si necesitas mostrar un dato formateado en la UI,
 * la función va aquí — no inline en el componente.
 */

// ─── Moneda ───────────────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda colombiana (COP)
 * Ej: 15000   → "$15.000"
 *     1500000 → "$1.500.000"
 */
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-CO', {
    style:                 'currency',
    currency:              'COP',
    minimumFractionDigits: 0,
  }).format(value);

/**
 * Formatea moneda de forma compacta para espacios reducidos
 * Ej: 1500000 → "$1,5M"
 *     15000   → "$15K"
 */
export const formatCurrencyCompact = (value: number): string =>
  new Intl.NumberFormat('es-CO', {
    style:                 'currency',
    currency:              'COP',
    notation:              'compact',
    minimumFractionDigits: 0,
  }).format(value);

// ─── Fechas ───────────────────────────────────────────────────────────────────

/**
 * Formatea fecha completa para encabezados y títulos
 * Ej: new Date() → "lunes, 27 de febrero de 2026"
 */
export const formatDate = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  }).format(date);

/**
 * Formatea fecha corta para tablas y listados
 * Ej: "2026-02-27T21:00:00" → "27/02/2026"
 */
export const formatDateShort = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('es-CO', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });

/**
 * Formatea fecha y hora para tablas con timestamp
 * Ej: "2026-02-27T21:00:00" → "27/02/2026 9:00 p.m."
 */
export const formatDateTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

/**
 * Formatea tiempo relativo (hace cuánto)
 * Ej: fecha de hace 5 min → "hace 5 minutos"
 *     fecha de hace 2h   → "hace 2 horas"
 */
export const formatRelativeTime = (dateStr: string): string => {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)   return 'ahora mismo';
  if (mins  < 60)  return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  if (hours < 24)  return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  if (days  < 30)  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  return formatDateShort(dateStr);
};

// ─── Números ──────────────────────────────────────────────────────────────────

/**
 * Formatea número con separadores de miles
 * Ej: 15000 → "15.000"
 */
export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('es-CO').format(value);

/**
 * Formatea cantidad de stock con unidad
 * Ej: (15, 'kilogramo') → "15 kg"
 *     (3,  'unidad')    → "3 und"
 */
export const formatStock = (
  cantidad: number,
  unidad: 'unidad' | 'gramo' | 'kilogramo' | 'litro' | 'mililitro' | 'porcion'
): string => {
  const abreviaturas: Record<string, string> = {
    unidad:     'und',
    gramo:      'g',
    kilogramo:  'kg',
    litro:      'L',
    mililitro:  'mL',
    porcion:    'por',
  };
  return `${formatNumber(cantidad)} ${abreviaturas[unidad] ?? unidad}`;
};

// ─── Texto ────────────────────────────────────────────────────────────────────

/**
 * Genera iniciales desde un nombre completo (máx 2 palabras)
 * Ej: "Juan Ospina Prieto" → "JO"
 *     "María"             → "M"
 */
export const getInitials = (nombre: string): string =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

/**
 * Capitaliza la primera letra de cada palabra
 * Ej: "administrador" → "Administrador"
 */
export const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/**
 * Trunca texto largo con ellipsis
 * Ej: ("Este es un texto muy largo", 20) → "Este es un texto m..."
 */
export const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
