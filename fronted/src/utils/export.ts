/**
 * export.ts — Exportación de datos tabulares a CSV
 *
 * Antes de esto el sistema no exportaba nada en ninguna pantalla: el botón
 * "Exportar" de Reportes era decorativo (sin onClick). Para un producto que se
 * vende por suscripción, poder sacar los datos es requisito, no extra.
 *
 * Se usa CSV con BOM UTF-8 porque el destino real es Excel en español: sin el
 * BOM, Excel abre los acentos como caracteres rotos. Y se usa `;` como
 * separador porque en configuración regional es-CO el separador de lista de
 * Excel es punto y coma — con `,` Excel mete todo en una sola columna.
 *
 * Uso:
 *   exportarCSV('ventas-2026-07', [
 *     { columna: 'Producto', valor: p => p.nombre },
 *     { columna: 'Total',    valor: p => p.total   },
 *   ], productos);
 */

/** Define una columna del CSV: encabezado + cómo extraer el valor de cada fila. */
export interface ColumnaCSV<T> {
  columna: string;
  valor: (fila: T) => string | number | null | undefined;
}

/**
 * Escapa un valor para CSV.
 *
 * Además de las comillas y saltos de línea, neutraliza la inyección de
 * fórmulas: un valor que empiece por `= + - @` es interpretado por Excel como
 * fórmula, lo que permite exfiltrar datos desde un CSV descargado. Se prefija
 * con un apóstrofo para que Excel lo trate como texto.
 */
function escaparCelda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';

  let texto = String(valor);

  if (/^[=+\-@\t\r]/.test(texto)) {
    texto = `'${texto}`;
  }

  if (/[";\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Construye el contenido CSV (sin descargarlo). Separado para poder testearlo. */
export function construirCSV<T>(columnas: ColumnaCSV<T>[], filas: T[]): string {
  const encabezado = columnas.map(c => escaparCelda(c.columna)).join(';');
  const cuerpo = filas.map(fila =>
    columnas.map(c => escaparCelda(c.valor(fila))).join(';'),
  );
  return [encabezado, ...cuerpo].join('\r\n');
}

/**
 * Genera y descarga un CSV.
 *
 * @param nombreArchivo sin extensión — se le añade la fecha y `.csv`
 * @returns false si no había filas que exportar (para que la UI avise)
 */
export function exportarCSV<T>(
  nombreArchivo: string,
  columnas: ColumnaCSV<T>[],
  filas: T[],
): boolean {
  if (filas.length === 0) return false;

  // BOM UTF-8 — sin esto Excel rompe los acentos.
  const contenido = '﻿' + construirCSV(columnas, filas);
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  // Liberar el object URL: sin esto el blob queda retenido hasta recargar.
  URL.revokeObjectURL(url);
  return true;
}
