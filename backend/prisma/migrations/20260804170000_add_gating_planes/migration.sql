-- AlterTable: nuevo flag de gating de módulos por plan.
-- Grupos nuevos nacen con true (gating activo).
ALTER TABLE "grupo_negocio" ADD COLUMN     "gating_activo" BOOLEAN NOT NULL DEFAULT true;

-- Grandfather: los grupos que ya existían conservan acceso a todos los módulos
-- (no se les aplica el gating retroactivamente).
UPDATE "grupo_negocio" SET "gating_activo" = false;
