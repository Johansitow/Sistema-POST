/**
 * Tests para plantillaRepository.findDefault — precedencia multi-tenant
 * sede (id_restaurante) > grupo (id_grupo) > global (null/null).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de prisma: findFirst decide qué fila devolver según el `where` recibido,
// simulando qué ámbitos tienen una plantilla por defecto en cada escenario.
vi.mock('../../config/database', () => ({
  default: { plantillaImpresion: { findFirst: vi.fn() } },
}));

import { plantillaRepository } from '../plantilla.repository';
import prisma from '../../config/database';

const findFirst = (prisma as unknown as { plantillaImpresion: { findFirst: ReturnType<typeof vi.fn> } })
  .plantillaImpresion.findFirst;

const SEDE   = { id: 1, tipo: 'ticket', es_default: true, id_restaurante: 10, id_grupo: 1 };
const GRUPO  = { id: 2, tipo: 'ticket', es_default: true, id_restaurante: null, id_grupo: 1 };
const GLOBAL = { id: 3, tipo: 'ticket', es_default: true, id_restaurante: null, id_grupo: null };

/** Configura el "DB" con qué ámbitos existen. */
function seed({ sede, grupo, global }: { sede?: boolean; grupo?: boolean; global?: boolean }) {
  findFirst.mockImplementation((args?: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    if (where.id_restaurante === 10) return Promise.resolve(sede ? SEDE : null);
    if (where.id_grupo === 1 && where.id_restaurante === null) return Promise.resolve(grupo ? GRUPO : null);
    if (where.id_grupo === null && where.id_restaurante === null) return Promise.resolve(global ? GLOBAL : null);
    return Promise.resolve(null);
  });
}

describe('plantillaRepository.findDefault — precedencia', () => {
  beforeEach(() => findFirst.mockReset());

  it('prefiere la plantilla de la sede cuando existe', async () => {
    seed({ sede: true, grupo: true, global: true });
    const r = await plantillaRepository.findDefault('ticket', { id_restaurante: 10, id_grupo: 1 });
    expect(r).toEqual(SEDE);
  });

  it('cae al default del grupo cuando la sede no tiene uno propio', async () => {
    seed({ sede: false, grupo: true, global: true });
    const r = await plantillaRepository.findDefault('ticket', { id_restaurante: 10, id_grupo: 1 });
    expect(r).toEqual(GRUPO);
  });

  it('cae a la plantilla global cuando ni sede ni grupo tienen default', async () => {
    seed({ sede: false, grupo: false, global: true });
    const r = await plantillaRepository.findDefault('ticket', { id_restaurante: 10, id_grupo: 1 });
    expect(r).toEqual(GLOBAL);
  });

  it('sin tenant solo consulta la plantilla global', async () => {
    seed({ sede: true, grupo: true, global: true });
    const r = await plantillaRepository.findDefault('ticket');
    expect(r).toEqual(GLOBAL);
    // Una sola consulta: la global
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
