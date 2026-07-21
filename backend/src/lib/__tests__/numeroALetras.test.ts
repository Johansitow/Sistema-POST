/**
 * Tests de numeroALetras — el importe en letras de los documentos laborales.
 *
 * Importa que sea exacto: en un certificado o un contrato, ante una
 * discrepancia entre la cifra y las letras, prevalecen las letras.
 */

import { describe, it, expect } from 'vitest';
import { numeroALetras, pesosEnLetras } from '../documentos/numeroALetras';

describe('numeroALetras', () => {
  it('convierte unidades y el cero', () => {
    expect(numeroALetras(0)).toBe('cero');
    expect(numeroALetras(1)).toBe('uno');
    expect(numeroALetras(9)).toBe('nueve');
  });

  it('maneja las formas irregulares de 10 a 29', () => {
    expect(numeroALetras(11)).toBe('once');
    expect(numeroALetras(15)).toBe('quince');
    expect(numeroALetras(16)).toBe('dieciséis');
    expect(numeroALetras(21)).toBe('veintiuno');
    expect(numeroALetras(22)).toBe('veintidós');
    expect(numeroALetras(29)).toBe('veintinueve');
  });

  it('usa "y" solo a partir de treinta', () => {
    expect(numeroALetras(30)).toBe('treinta');
    expect(numeroALetras(31)).toBe('treinta y uno');
    expect(numeroALetras(99)).toBe('noventa y nueve');
  });

  it('distingue "cien" de "ciento"', () => {
    expect(numeroALetras(100)).toBe('cien');
    expect(numeroALetras(101)).toBe('ciento uno');
    expect(numeroALetras(115)).toBe('ciento quince');
  });

  it('convierte centenas', () => {
    expect(numeroALetras(200)).toBe('doscientos');
    expect(numeroALetras(500)).toBe('quinientos');
    expect(numeroALetras(700)).toBe('setecientos');
    expect(numeroALetras(900)).toBe('novecientos');
    expect(numeroALetras(999)).toBe('novecientos noventa y nueve');
  });

  it('dice "mil", nunca "un mil"', () => {
    expect(numeroALetras(1000)).toBe('mil');
    expect(numeroALetras(1001)).toBe('mil uno');
    expect(numeroALetras(2000)).toBe('dos mil');
  });

  it('concuerda en femenino los miles', () => {
    // "veintiún mil" es incorrecto: el sustantivo elidido es "unidades de mil"
    expect(numeroALetras(21_000)).toBe('veintiuna mil');
    expect(numeroALetras(31_000)).toBe('treinta y una mil');
  });

  it('distingue "un millón" de "dos millones"', () => {
    expect(numeroALetras(1_000_000)).toBe('un millón');
    expect(numeroALetras(2_000_000)).toBe('dos millones');
  });

  it('convierte importes de nómina reales', () => {
    expect(numeroALetras(1_800_000)).toBe('un millón ochocientos mil');
    expect(numeroALetras(1_423_500)).toBe('un millón cuatrocientos veintitrés mil quinientos');
    expect(numeroALetras(2_100_000)).toBe('dos millones cien mil');
  });

  it('maneja negativos', () => {
    expect(numeroALetras(-500)).toBe('menos quinientos');
  });

  it('ignora los decimales (los salarios en COP van en pesos enteros)', () => {
    expect(numeroALetras(1500.75)).toBe('mil quinientos');
  });
});

describe('pesosEnLetras', () => {
  it('usa el formato de los documentos colombianos', () => {
    expect(pesosEnLetras(1_800_000)).toBe('UN MILLÓN OCHOCIENTOS MIL PESOS M/CTE');
  });

  it('usa singular para un peso', () => {
    expect(pesosEnLetras(1)).toBe('UN PESO M/CTE');
  });

  it('apocopa "uno" delante del sustantivo', () => {
    // En español "uno" pierde la vocal ante un sustantivo masculino
    expect(pesosEnLetras(21)).toBe('VEINTIÚN PESOS M/CTE');
    expect(pesosEnLetras(31)).toBe('TREINTA Y UN PESOS M/CTE');
    expect(pesosEnLetras(101)).toBe('CIENTO UN PESOS M/CTE');
  });

  it('no apocopa cuando el número no termina en "uno"', () => {
    expect(pesosEnLetras(100)).toBe('CIEN PESOS M/CTE');
    expect(pesosEnLetras(1000)).toBe('MIL PESOS M/CTE');
  });

  it('redondea en lugar de truncar', () => {
    expect(pesosEnLetras(1999.6)).toBe('DOS MIL PESOS M/CTE');
  });

  it('convierte el salario mínimo de referencia sin errores', () => {
    expect(pesosEnLetras(1_423_500)).toBe('UN MILLÓN CUATROCIENTOS VEINTITRÉS MIL QUINIENTOS PESOS M/CTE');
  });
});
