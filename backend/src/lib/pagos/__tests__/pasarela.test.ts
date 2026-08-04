/**
 * Tests de los helpers puros de la pasarela: dinero y firmas.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  pesosACentavos,
  centavosAPesos,
  firmaIntegridad,
  verificarFirmaEvento,
  mapEstadoWompi,
  type EventoWompi,
} from '../pasarela';

describe('pesosACentavos / centavosAPesos', () => {
  it('convierte COP (2 decimales) a centavos enteros', () => {
    expect(pesosACentavos(19900)).toBe(1990000);
    expect(pesosACentavos('49900')).toBe(4990000);
    expect(pesosACentavos(19900.5)).toBe(1990050);
  });
  it('convierte centavos de vuelta a COP', () => {
    expect(centavosAPesos(1990000)).toBe(19900);
  });
});

describe('firmaIntegridad', () => {
  it('es SHA256(referencia+centavos+moneda+secret) y determinista', () => {
    const esperado = crypto.createHash('sha256').update('ref-1199000COPsecreto').digest('hex');
    expect(firmaIntegridad('ref-1', 199000, 'COP', 'secreto')).toBe(esperado);
  });
});

describe('verificarFirmaEvento', () => {
  const secret = 'events_secret_de_prueba';

  function construirEvento(): EventoWompi {
    const timestamp = 1700000000;
    const data = { transaction: { id: 'txn_123', status: 'APPROVED', amount_in_cents: 1990000 } };
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
    const concat = `${data.transaction.id}${data.transaction.status}${data.transaction.amount_in_cents}`;
    const checksum = crypto.createHash('sha256').update(`${concat}${timestamp}${secret}`).digest('hex');
    return { event: 'transaction.updated', data, timestamp, signature: { checksum, properties } };
  }

  it('acepta una firma válida', () => {
    expect(verificarFirmaEvento(construirEvento(), secret)).toBe(true);
  });

  it('rechaza si el checksum no coincide (evento manipulado)', () => {
    const ev = construirEvento();
    (ev.data!.transaction as Record<string, unknown>).amount_in_cents = 1; // manipulado
    expect(verificarFirmaEvento(ev, secret)).toBe(false);
  });

  it('rechaza con secret incorrecto', () => {
    expect(verificarFirmaEvento(construirEvento(), 'otro_secret')).toBe(false);
  });

  it('rechaza evento sin firma', () => {
    expect(verificarFirmaEvento({ data: {}, timestamp: 1 }, secret)).toBe(false);
  });
});

describe('mapEstadoWompi', () => {
  it('mapea los estados de Wompi a los normalizados', () => {
    expect(mapEstadoWompi('APPROVED')).toBe('aprobada');
    expect(mapEstadoWompi('DECLINED')).toBe('rechazada');
    expect(mapEstadoWompi('VOIDED')).toBe('anulada');
    expect(mapEstadoWompi('ERROR')).toBe('error');
    expect(mapEstadoWompi('PENDING')).toBe('pendiente');
    expect(mapEstadoWompi('LO_QUE_SEA')).toBe('pendiente');
  });
});
