/**
 * numeroALetras.ts — convierte cifras a texto en español.
 *
 * Los documentos laborales colombianos escriben el salario dos veces: en
 * números y en letras ("UN MILLÓN OCHOCIENTOS MIL PESOS M/CTE"). La versión en
 * letras es la que prevalece ante una discrepancia, así que no puede
 * improvisarse en la plantilla.
 *
 * Casos que las implementaciones ingenuas suelen equivocar y que aquí se
 * cubren con tests:
 *   • 1 → "un" pero 21 → "veintiún" y 100 → "cien" vs 101 → "ciento uno"
 *   • 1000 → "mil" (nunca "un mil")
 *   • 1000000 → "un millón" (sí lleva "un") y 2000000 → "dos millones"
 *   • concordancia de género: "veintiuna mil" para miles
 */

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const DECENAS  = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

/**
 * Convierte 0–999 a letras.
 * @param femenino concordancia para "una"/"veintiuna" (se usa en los miles)
 */
function tresDigitos(n: number, femenino = false): string {
  if (n === 0)   return '';
  if (n === 100) return 'cien';

  const centena = Math.floor(n / 100);
  const resto   = n % 100;

  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 30) {
      let palabra = UNIDADES[resto];
      if (femenino) {
        if (resto === 1)  palabra = 'una';
        if (resto === 21) palabra = 'veintiuna';
      }
      partes.push(palabra);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      if (unidad === 0) {
        partes.push(DECENAS[decena]);
      } else {
        let palabra = UNIDADES[unidad];
        if (femenino && unidad === 1) palabra = 'una';
        partes.push(`${DECENAS[decena]} y ${palabra}`);
      }
    }
  }

  return partes.join(' ');
}

/**
 * numeroALetras — parte entera de un número a texto en minúsculas.
 * Soporta hasta 999.999.999.999 (billones no aplican a nóminas).
 */
export function numeroALetras(valor: number): string {
  const n = Math.floor(Math.abs(valor));
  if (n === 0) return 'cero';

  const millones = Math.floor(n / 1_000_000);
  const miles    = Math.floor((n % 1_000_000) / 1000);
  const resto    = n % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    // "un millón" lleva artículo; a partir de dos, plural
    partes.push(millones === 1 ? 'un millón' : `${numeroALetras(millones)} millones`);
  }

  if (miles > 0) {
    // "mil", nunca "un mil". Los miles concuerdan en femenino: "veintiuna mil"
    partes.push(miles === 1 ? 'mil' : `${tresDigitos(miles, true)} mil`);
  }

  if (resto > 0) partes.push(tresDigitos(resto));

  const texto = partes.join(' ');
  return valor < 0 ? `menos ${texto}` : texto;
}

/**
 * apocopar — "uno" pierde la vocal final delante de un sustantivo masculino.
 *   1  → "un peso"            (no "uno peso")
 *   21 → "veintiún pesos"     (con tilde, porque pierde la sílaba átona)
 *   31 → "treinta y un pesos"
 * No aplica cuando el número no termina en "uno" (cien, mil, dos millones…).
 */
function apocopar(letras: string): string {
  if (letras.endsWith('veintiuno')) return letras.slice(0, -9) + 'veintiún';
  if (letras.endsWith('uno'))       return letras.slice(0, -3) + 'un';
  return letras;
}

/**
 * pesosEnLetras — importe con la fórmula usada en documentos colombianos.
 * Ej: 1800000 → "UN MILLÓN OCHOCIENTOS MIL PESOS M/CTE"
 *
 * M/CTE = moneda corriente. Se ignoran los centavos: los salarios en COP se
 * manejan en pesos enteros.
 */
export function pesosEnLetras(valor: number): string {
  const entero = Math.round(Math.abs(valor));
  const letras = apocopar(numeroALetras(entero)).toUpperCase();
  const unidad = entero === 1 ? 'PESO' : 'PESOS';
  return `${letras} ${unidad} M/CTE`;
}
