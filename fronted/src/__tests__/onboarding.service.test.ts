/**
 * Tests para onboardingService.
 *
 * Verifica que:
 *   - previsualizar llama POST /onboarding/apply?preview=true reutilizando api.ts
 *   - aplicar     llama POST /onboarding/apply (sin query param)
 *   - La respuesta se extrae de data.data correctamente
 *   - El interceptor de api.ts agrega JWT + X-Restaurante-Id (no se verifica aquí;
 *     es responsabilidad del interceptor, testeado en api.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

import { onboardingService }  from '../services/onboarding.service';
import api                    from '../services/api';
import type { PerfilResuelta } from '../types/onboarding.types';

const apiMock = api as unknown as { post: ReturnType<typeof vi.fn> };

const mockPerfil: PerfilResuelta = {
  flags: [
    { nombre: 'modulo.mesas', habilitado: false, nivel: 'sede' },
  ],
  configs: [
    { clave: 'ordenes.modelo_servicio', valor: 'delivery', nivel: 'sede' },
  ],
  desactivadosPorDependencia: [],
  omitidosPorDependencia:     [],
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.post.mockResolvedValue({ data: { success: true, data: mockPerfil } });
});

// ── previsualizar ─────────────────────────────────────────────────────────────

describe('onboardingService.previsualizar', () => {
  it('llama POST /onboarding/apply con preview=true', async () => {
    await onboardingService.previsualizar({ arquetipo: 'dark_kitchen' });

    expect(apiMock.post).toHaveBeenCalledWith(
      '/onboarding/apply',
      { arquetipo: 'dark_kitchen' },
      { params: { preview: 'true' } },
    );
  });

  it('devuelve el perfil extraído de data.data', async () => {
    const result = await onboardingService.previsualizar({ arquetipo: 'dark_kitchen' });
    expect(result).toEqual(mockPerfil);
  });

  it('puede enviar ejes sin arquetipo', async () => {
    await onboardingService.previsualizar({ ejes: { servicio: 'mostrador' } });

    expect(apiMock.post).toHaveBeenCalledWith(
      '/onboarding/apply',
      { ejes: { servicio: 'mostrador' } },
      { params: { preview: 'true' } },
    );
  });

  it('propaga error si el API falla', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('Network error'));
    await expect(onboardingService.previsualizar({ arquetipo: 'dark_kitchen' }))
      .rejects.toThrow('Network error');
  });
});

// ── aplicar ───────────────────────────────────────────────────────────────────

describe('onboardingService.aplicar', () => {
  it('llama POST /onboarding/apply SIN query param preview', async () => {
    await onboardingService.aplicar({ arquetipo: 'dark_kitchen' });

    expect(apiMock.post).toHaveBeenCalledWith(
      '/onboarding/apply',
      { arquetipo: 'dark_kitchen' },
    );

    // Garantía: no se pasa params con preview
    const [, , config] = apiMock.post.mock.calls[0];
    expect(config).toBeUndefined();
  });

  it('devuelve el perfil extraído de data.data', async () => {
    const result = await onboardingService.aplicar({ arquetipo: 'dark_kitchen' });
    expect(result).toEqual(mockPerfil);
  });

  it('propaga error si el API falla', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('500 Internal'));
    await expect(onboardingService.aplicar({ arquetipo: 'dark_kitchen' }))
      .rejects.toThrow('500 Internal');
  });
});

// ── Distinción preview vs apply (no comparte config) ─────────────────────────

describe('preview vs apply — endpoints distintos', () => {
  it('previsualizar y aplicar usan el mismo path pero diferente config', async () => {
    await onboardingService.previsualizar({ arquetipo: 'cafeteria' });
    await onboardingService.aplicar({ arquetipo: 'cafeteria' });

    const [previewCall, applyCall] = apiMock.post.mock.calls;

    // Mismo path
    expect(previewCall[0]).toBe('/onboarding/apply');
    expect(applyCall[0]).toBe('/onboarding/apply');

    // Config diferente
    expect(previewCall[2]).toEqual({ params: { preview: 'true' } });
    expect(applyCall[2]).toBeUndefined(); // sin params
  });
});
