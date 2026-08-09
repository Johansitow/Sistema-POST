/**
 * planGate.middleware — gating de módulos por plan SaaS.
 *
 * `requireModulo(modulo)` bloquea el acceso a un módulo que el plan del grupo no
 * incluye. A diferencia de flagGate, NO es fail-open: ante un módulo no incluido
 * responde 403 con `code: 'MODULE_LOCKED'` para que el frontend muestre el upsell.
 *
 * Montar SIEMPRE después de authenticate + tenantContextOptional (o requireGrupoAdmin),
 * para que el grupo esté resuelto en req.
 */

import { Request, Response, NextFunction } from 'express';
import { planService } from '../services/plan.service';
import { planIncluyeModulo, moduloMinimoPlan, type ModuloPlan } from '../lib/planes/catalogo';

export const requireModulo = (modulo: ModuloPlan) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Superadmin: acceso total.
      if (req.esSuperAdmin) return next();

      const grupoId = req.grupoId ?? req.grupoAdminId ?? req.user?.grupos_admin?.[0]?.id_grupo;
      // Sin grupo resuelto no aplicamos gating aquí (la propia ruta valida acceso).
      if (!grupoId) return next();

      const { plan, gatingActivo } = await planService.getPlanDeGrupo(grupoId);

      // Grupo grandfathered (existente antes del gating) → conserva todos los módulos.
      if (!gatingActivo) return next();
      if (planIncluyeModulo(plan, modulo)) return next();

      res.status(403).json({
        success:        false,
        code:           'MODULE_LOCKED',
        modulo,
        plan_requerido: moduloMinimoPlan(modulo),
        error:          'Este módulo no está disponible en tu plan actual.',
      });
    } catch (err) {
      next(err);
    }
  };
