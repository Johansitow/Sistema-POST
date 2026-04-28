/**
 * Tests para plantillaService — listar, crear, actualizar, eliminar
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstadoGeneral } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../repositories/plantilla.repository', () => ({
  plantillaRepository: {
    findAll:      vi.fn(),
    findById:     vi.fn(),
    findDefault:  vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    clearDefaults: vi.fn(),
    softDelete:   vi.fn(),
  },
}));

vi.mock('../../config/redis', () => ({
  cacheGetOrSet: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()),
  cacheDel:      vi.fn(),
  CACHE_TTL:     { SHORT: 60, MID: 300, LONG: 3600 },
}));

// Mock de prisma para las transacciones en crear/actualizar
vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      // Simula el cliente de transacción con los mismos métodos que necesita el service
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create:     vi.fn(),
          update:     vi.fn(),
        },
      };
      return fn(tx);
    }),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { plantillaService }    from '../plantilla.service';
import { plantillaRepository } from '../../repositories/plantilla.repository';
import { cacheDel }            from '../../config/redis';
import prisma                  from '../../config/database';
import { NotFoundError, ConflictError } from '../../exceptions/HttpErrors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mkPlantilla = (overrides = {}) => ({
  id:         1,
  nombre:     'Ticket estándar',
  tipo:       'ticket',
  es_default: false,
  plantilla:  { header: 'Mi Restaurante' },
  estado:     EstadoGeneral.activo,
  ...overrides,
});

// ── listar ────────────────────────────────────────────────────────────────────

describe('plantillaService.listar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna todas las plantillas cuando no se filtra por tipo', async () => {
    (plantillaRepository.findAll as any).mockResolvedValue([mkPlantilla()]);

    const result = await plantillaService.listar();

    expect(result).toHaveLength(1);
    expect(plantillaRepository.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it('filtra por tipo cuando se proporciona', async () => {
    (plantillaRepository.findAll as any).mockResolvedValue([]);

    await plantillaService.listar('factura');

    expect(plantillaRepository.findAll).toHaveBeenCalledWith('factura', undefined);
  });
});

// ── obtenerPorId ──────────────────────────────────────────────────────────────

describe('plantillaService.obtenerPorId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna la plantilla cuando existe y está activa', async () => {
    (plantillaRepository.findById as any).mockResolvedValue(mkPlantilla());

    const result = await plantillaService.obtenerPorId(1);
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si la plantilla no existe', async () => {
    (plantillaRepository.findById as any).mockResolvedValue(null);

    await expect(plantillaService.obtenerPorId(99)).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError si la plantilla está eliminada', async () => {
    (plantillaRepository.findById as any).mockResolvedValue(
      mkPlantilla({ estado: EstadoGeneral.eliminado })
    );

    await expect(plantillaService.obtenerPorId(1)).rejects.toThrow(NotFoundError);
  });
});

// ── obtenerDefault ────────────────────────────────────────────────────────────

describe('plantillaService.obtenerDefault', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna null si no hay plantilla por defecto para el tipo', async () => {
    (plantillaRepository.findDefault as any).mockResolvedValue(null);

    const result = await plantillaService.obtenerDefault('comanda');
    expect(result).toBeNull();
  });

  it('retorna la plantilla por defecto si existe', async () => {
    const defecto = mkPlantilla({ es_default: true, tipo: 'comanda' });
    (plantillaRepository.findDefault as any).mockResolvedValue(defecto);

    const result = await plantillaService.obtenerDefault('comanda');
    expect(result?.es_default).toBe(true);
  });
});

// ── crear ─────────────────────────────────────────────────────────────────────

describe('plantillaService.crear', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza ConflictError para un tipo inválido', async () => {
    await expect(plantillaService.crear({
      nombre: 'Test', tipo: 'invalid_type', plantilla: {},
    })).rejects.toThrow(ConflictError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('crea la plantilla dentro de una transacción', async () => {
    const nueva = mkPlantilla({ tipo: 'ticket' });

    // El $transaction mock ejecuta fn(tx) y retorna lo que fn retorna
    // El tx.plantillaImpresion.create devuelve la plantilla
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    const result = await plantillaService.crear({
      nombre: 'Ticket estándar', tipo: 'ticket', plantilla: {},
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result.tipo).toBe('ticket');
    expect(cacheDel).toHaveBeenCalledWith('plantillas:all', 'plantillas:tipo:ticket', 'plantilla:default:ticket');
  });

  it('llama updateMany para quitar el default anterior al crear con es_default=true', async () => {
    const nueva = mkPlantilla({ es_default: true, tipo: 'factura' });
    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: mockUpdateMany,
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    await plantillaService.crear({
      nombre: 'Nueva default', tipo: 'factura', es_default: true, plantilla: {},
    });

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tipo: 'factura', es_default: true }) })
    );
  });

  it('NO llama updateMany si es_default es false', async () => {
    const nueva = mkPlantilla({ tipo: 'comanda', es_default: false });
    const mockUpdateMany = vi.fn();

    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: mockUpdateMany,
          create:     vi.fn().mockResolvedValue(nueva),
        },
      };
      return fn(tx);
    });

    await plantillaService.crear({
      nombre: 'Comanda sin default', tipo: 'comanda', es_default: false, plantilla: {},
    });

    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

// ── actualizar ────────────────────────────────────────────────────────────────

describe('plantillaService.actualizar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalida el caché del tipo anterior cuando cambia el tipo', async () => {
    const existente = mkPlantilla({ tipo: 'ticket' });
    const actualizada = mkPlantilla({ tipo: 'comanda' });

    (plantillaRepository.findById as any).mockResolvedValue(existente);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await plantillaService.actualizar(1, { tipo: 'comanda' });

    const deletedKeys = (cacheDel as any).mock.calls[0];
    expect(deletedKeys).toContain('plantillas:tipo:ticket');     // tipo anterior
    expect(deletedKeys).toContain('plantilla:default:ticket');   // default anterior
    expect(deletedKeys).toContain('plantillas:tipo:comanda');    // tipo nuevo
  });

  it('solo invalida el tipo nuevo si el tipo no cambió', async () => {
    const existente = mkPlantilla({ tipo: 'ticket' });
    const actualizada = mkPlantilla({ tipo: 'ticket', nombre: 'Ticket v2' });

    (plantillaRepository.findById as any).mockResolvedValue(existente);
    (prisma.$transaction as any).mockImplementationOnce(async (fn: any) => {
      const tx = {
        plantillaImpresion: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          update:     vi.fn().mockResolvedValue(actualizada),
        },
      };
      return fn(tx);
    });

    await plantillaService.actualizar(1, { nombre: 'Ticket v2' });

    const deletedKeys = (cacheDel as any).mock.calls[0];
    // Solo debe aparecer una vez 'plantillas:tipo:ticket' (no duplicado del anterior)
    const ticketCount = deletedKeys.filter((k: string) => k === 'plantillas:tipo:ticket').length;
    expect(ticketCount).toBe(1);
  });
});

// ── eliminar ──────────────────────────────────────────────────────────────────

describe('plantillaService.eliminar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hace soft-delete e invalida todos los cachés relacionados', async () => {
    (plantillaRepository.findById as any).mockResolvedValue(mkPlantilla({ tipo: 'ticket' }));
    (plantillaRepository.softDelete as any).mockResolvedValue(undefined);

    await plantillaService.eliminar(1);

    expect(plantillaRepository.softDelete).toHaveBeenCalledWith(1);
    expect(cacheDel).toHaveBeenCalledWith(
      'plantillas:all',
      'plantilla:1',
      'plantillas:tipo:ticket',
      'plantilla:default:ticket',
    );
  });

  it('lanza NotFoundError si la plantilla no existe', async () => {
    (plantillaRepository.findById as any).mockResolvedValue(null);

    await expect(plantillaService.eliminar(99)).rejects.toThrow(NotFoundError);
    expect(plantillaRepository.softDelete).not.toHaveBeenCalled();
  });
});
