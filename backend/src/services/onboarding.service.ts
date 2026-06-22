/**
 * onboardingService — lógica del wizard de configuración inicial.
 *
 * previsualizarPerfil: traduce arquetipo+ejes a flags+configs sin tocar la BD.
 * aplicarPerfil:       persiste el resultado de forma transaccional (todo o nada):
 *   - Flags  → FeatureFlagAsignacion con contexto restaurante_<id> o grupo_<id>
 *   - Configs → ConfiguracionRestaurante (nivel=sede) o ConfiguracionGrupo (nivel=grupo)
 *   - Marca onboarding_completado SOLO para esa sede (nunca global)
 *
 * Multi-tenant: restauranteId y grupoId vienen del JWT vía tenantContext; nunca
 * se aceptan del cuerpo de la request.
 */

import prisma from '../config/database';
import { resolverPerfil } from '../lib/onboarding/resolverPerfil';
import { buildContexto } from '../lib/flagContexto';
import type { EntradaResolver, PerfilResuelta } from '../lib/onboarding/resolverPerfil';

const ONBOARDING_COMPLETADO = 'onboarding_completado';

export const onboardingService = {
  /** Devuelve el plan de flags+configs sin escribir nada en la BD. */
  previsualizarPerfil(input: EntradaResolver): PerfilResuelta {
    return resolverPerfil(input);
  },

  /**
   * Persiste el perfil del wizard de forma transaccional.
   * Si resolverPerfil lanza (colisión, arquetipo desconocido, etc.), el error
   * se propaga antes de abrir la transacción.
   */
  async aplicarPerfil(
    restauranteId: number,
    grupoId: number,
    input: EntradaResolver,
  ): Promise<PerfilResuelta> {
    const perfil = resolverPerfil(input);

    await prisma.$transaction(async (tx) => {
      // ── 1. Flags ────────────────────────────────────────────────────────────
      for (const f of perfil.flags) {
        const contexto = buildContexto(
          f.nivel === 'sede' ? 'restaurante' : 'grupo',
          f.nivel === 'sede' ? restauranteId : grupoId,
        );

        // Los flags deben estar pre-sembrados; upsert como red de seguridad
        let flag = await tx.featureFlag.findUnique({ where: { nombre: f.nombre } });
        if (!flag) {
          flag = await tx.featureFlag.create({
            data: { nombre: f.nombre, habilitado: false, scope: 'contexto' },
          });
        }

        await tx.featureFlagAsignacion.upsert({
          where:  { id_feature_flag_contexto: { id_feature_flag: flag.id, contexto } },
          create: { id_feature_flag: flag.id, contexto, habilitado: f.habilitado },
          update: { habilitado: f.habilitado },
        });
      }

      // ── 2. Configs KV ───────────────────────────────────────────────────────
      for (const c of perfil.configs) {
        if (c.nivel === 'sede') {
          await tx.configuracionRestaurante.upsert({
            where:  { id_restaurante_clave: { id_restaurante: restauranteId, clave: c.clave } },
            create: { id_restaurante: restauranteId, clave: c.clave, valor: c.valor },
            update: { valor: c.valor },
          });
        } else {
          await tx.configuracionGrupo.upsert({
            where:  { id_grupo_clave: { id_grupo: grupoId, clave: c.clave } },
            create: { id_grupo: grupoId, clave: c.clave, valor: c.valor },
            update: { valor: c.valor },
          });
        }
      }

      // ── 3. Marcar onboarding_completado solo para ESTA sede ─────────────────
      let completadoFlag = await tx.featureFlag.findUnique({ where: { nombre: ONBOARDING_COMPLETADO } });
      if (!completadoFlag) {
        completadoFlag = await tx.featureFlag.create({
          data: {
            nombre:      ONBOARDING_COMPLETADO,
            habilitado:  false,
            scope:       'contexto',
            descripcion: 'El restaurante completó el wizard de configuración inicial',
          },
        });
      }
      const ctxRestaurante = buildContexto('restaurante', restauranteId);
      await tx.featureFlagAsignacion.upsert({
        where:  { id_feature_flag_contexto: { id_feature_flag: completadoFlag.id, contexto: ctxRestaurante } },
        create: { id_feature_flag: completadoFlag.id, contexto: ctxRestaurante, habilitado: true },
        update: { habilitado: true },
      });
    });

    return perfil;
  },
};
