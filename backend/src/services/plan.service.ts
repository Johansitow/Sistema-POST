/**
 * PlanService — lectura del plan de un grupo y aplicación de cambios de plan.
 *
 * El plan vive en `GrupoNegocio.plan` (enum PlanSaaS) + `plan_max_restaurantes`.
 * Los demás límites (usuarios, productos, historial) NO son columnas: se derivan
 * del catálogo de código (`lib/planes/catalogo.ts`), única fuente de verdad.
 *
 * Multi-tenant: siempre se opera con un `grupoId` explícito (nunca del cliente).
 */

import { PlanSaaS } from '@prisma/client';
import { grupoNegocioRepository } from '../repositories/grupo-negocio.repository';
import { usuarioRepository } from '../repositories/usuario.repository';
import { productoRepository } from '../repositories/producto.repository';
import { getPlan, type DefinicionPlan, type LimitesPlan } from '../lib/planes/catalogo';
import { NotFoundError } from '../exceptions/HttpErrors';
import { cacheDel } from '../config/redis';

export interface UsoGrupo {
  sedes: number;
  usuarios: number;
  productos: number;
}

export interface PlanYUso {
  plan: PlanSaaS;
  nombre: string;
  precio_mensual_cop: number;
  limites: LimitesPlan;
  uso: UsoGrupo;
}

export const planService = {
  /**
   * aplicarPlan — fija el plan de un grupo y sincroniza `plan_max_restaurantes`
   * con el límite de sedes del catálogo. El desbloqueo de módulos por flags se
   * cablea en la Fase B (cobro); aquí solo se persiste el plan y su tope de sedes.
   */
  async aplicarPlan(grupoId: number, plan: PlanSaaS): Promise<DefinicionPlan> {
    const def = getPlan(plan);
    await grupoNegocioRepository.update(grupoId, {
      plan,
      plan_max_restaurantes: def.limites.max_sedes,
    });
    await cacheDel('restaurantes:all');
    return def;
  },

  /**
   * getPlanYUso — plan actual del grupo, sus límites y el uso real (sedes,
   * usuarios y productos). Alimenta la pantalla "Mi plan" y los avisos de tope.
   */
  async getPlanYUso(grupoId: number): Promise<PlanYUso> {
    const grupo = await grupoNegocioRepository.findById(grupoId);
    if (!grupo) throw new NotFoundError('Grupo de negocio');

    const def = getPlan(grupo.plan);
    const [sedes, usuarios, productos] = await Promise.all([
      grupoNegocioRepository.countRestaurantesActivos(grupoId),
      usuarioRepository.count(grupoId),
      productoRepository.countByGrupo(grupoId),
    ]);

    return {
      plan: def.codigo,
      nombre: def.nombre,
      precio_mensual_cop: def.precio_mensual_cop,
      limites: def.limites,
      uso: { sedes, usuarios, productos },
    };
  },
};
