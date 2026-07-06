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
import { resolverPerfil, detectarHuerfanos, DEPENDENCIAS } from '../lib/onboarding/resolverPerfil';
import { buildContexto } from '../lib/flagContexto';
import { cacheDel } from '../config/redis';
import type { EntradaResolver, HuerfanoDetectado, PerfilResuelta } from '../lib/onboarding/resolverPerfil';

const ONBOARDING_COMPLETADO = 'onboarding_completado';

// ── helpers internos ───────────────────────────────────────────────────────────

/**
 * Lee de BD el estado actual de los flags que son "hijo" en DEPENDENCIAS.
 * Se usa en relanzamientos para que detectarHuerfanos vea qué estaba activo antes.
 * Solo consulta los contextos del restaurante y del grupo para este tenant.
 */
async function leerEstadoFlagsRelevantes(
  restauranteId: number,
  grupoId: number,
): Promise<Map<string, boolean>> {
  const nombresHijos = DEPENDENCIAS.map(d => d.hijo);
  const ctxSede   = buildContexto('restaurante', restauranteId);
  const ctxGrupo  = buildContexto('grupo', grupoId);

  const asignaciones = await prisma.featureFlagAsignacion.findMany({
    where: {
      feature_flag: { nombre: { in: nombresHijos } },
      contexto:     { in: [ctxSede, ctxGrupo] },
    },
    include: { feature_flag: { select: { nombre: true } } },
  });

  // Si hay asignaciones para el mismo flag en sede y grupo, sede tiene precedencia.
  const mapa = new Map<string, boolean>();
  for (const a of asignaciones) {
    const nombre = a.feature_flag.nombre;
    if (a.contexto === ctxSede || !mapa.has(nombre)) {
      mapa.set(nombre, a.habilitado);
    }
  }
  return mapa;
}

export const onboardingService = {
  /**
   * Devuelve el plan de flags+configs sin escribir nada en la BD.
   * Incluye desactivadosPorDependencia: huérfanos detectados dentro del nuevo perfil.
   * (Para relanzamientos el frontend debe llamar preview antes de apply.)
   */
  previsualizarPerfil(input: EntradaResolver): PerfilResuelta {
    const perfil = resolverPerfil(input);
    const desactivadosPorDependencia = detectarHuerfanos(perfil);
    return { ...perfil, desactivadosPorDependencia };
  },

  /**
   * Persiste el perfil del wizard de forma transaccional.
   * Incluye la cascada de dependencias: apaga los flags huérfanos cuyo módulo-padre
   * quedó desactivado, salvo que estén bloqueados (es_editable=false en ConfiguracionRestaurante).
   *
   * IMPORTANTE: este endpoint NO debe ser invocado por el frontend sin que el usuario
   * haya confirmado previamente el preview (incluyendo desactivadosPorDependencia). La
   * confirmación es responsabilidad de la UI (Entregable E3).
   *
   * Si resolverPerfil lanza (colisión, arquetipo desconocido, etc.), el error
   * se propaga antes de abrir la transacción.
   */
  async aplicarPerfil(
    restauranteId: number,
    grupoId: number,
    input: EntradaResolver,
  ): Promise<PerfilResuelta> {
    const perfil = resolverPerfil(input);

    // Leer estado actual de flags relevantes (para relanzamientos).
    const estadoActual = await leerEstadoFlagsRelevantes(restauranteId, grupoId);
    const huerfanos = detectarHuerfanos(perfil, estadoActual);

    const desactivadosPorDependencia: HuerfanoDetectado[] = [];
    const omitidosPorDependencia:     HuerfanoDetectado[] = [];

    await prisma.$transaction(async (tx) => {
      // ── 1. Flags del perfil ──────────────────────────────────────────────────
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

      // ── 2. Configs KV ────────────────────────────────────────────────────────
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

      // ── 3. Cascada de huérfanos ──────────────────────────────────────────────
      // Para cada flag huérfano: si está bloqueado (es_editable=false en ConfiguracionRestaurante
      // para esa clave), se omite; si no, se apaga en su contexto correspondiente.
      for (const huerfano of huerfanos) {
        const bloqueado = await tx.configuracionRestaurante.findFirst({
          where: { id_restaurante: restauranteId, clave: huerfano.clave, es_editable: false },
        });

        if (bloqueado) {
          omitidosPorDependencia.push(huerfano);
          continue;
        }

        // Determinar el contexto del flag huérfano basándose en los flags del perfil.
        // Si no está en el perfil (relanzamiento), asumimos contexto de sede.
        const enPerfil = perfil.flags.find(f => f.nombre === huerfano.clave);
        const nivel    = enPerfil?.nivel ?? 'sede';
        const contexto = buildContexto(
          nivel === 'sede' ? 'restaurante' : 'grupo',
          nivel === 'sede' ? restauranteId : grupoId,
        );

        let flag = await tx.featureFlag.findUnique({ where: { nombre: huerfano.clave } });
        if (!flag) {
          flag = await tx.featureFlag.create({
            data: { nombre: huerfano.clave, habilitado: false, scope: 'contexto' },
          });
        }

        await tx.featureFlagAsignacion.upsert({
          where:  { id_feature_flag_contexto: { id_feature_flag: flag.id, contexto } },
          create: { id_feature_flag: flag.id, contexto, habilitado: false },
          update: { habilitado: false },
        });

        desactivadosPorDependencia.push(huerfano);
      }

      // ── 4. Marcar onboarding_completado solo para ESTA sede ──────────────────
      // El flag master debe tener habilitado=true para que getClientFlags alcance
      // resolveAsignacion. Si fue sembrado con false (versiones anteriores), se corrige aquí.
      const completadoFlag = await tx.featureFlag.upsert({
        where:  { nombre: ONBOARDING_COMPLETADO },
        create: {
          nombre:      ONBOARDING_COMPLETADO,
          habilitado:  true,
          scope:       'contexto',
          descripcion: 'El restaurante completó el wizard de configuración inicial',
        },
        update: { habilitado: true },
      });
      const ctxRestaurante = buildContexto('restaurante', restauranteId);
      await tx.featureFlagAsignacion.upsert({
        where:  { id_feature_flag_contexto: { id_feature_flag: completadoFlag.id, contexto: ctxRestaurante } },
        create: { id_feature_flag: completadoFlag.id, contexto: ctxRestaurante, habilitado: true },
        update: { habilitado: true },
      });
    });

    // Invalida el cache de flags para que reloadFlags() post-apply lea datos frescos.
    await cacheDel('ff:all');

    return { ...perfil, desactivadosPorDependencia, omitidosPorDependencia };
  },
};
