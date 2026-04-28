-- AlterTable: agregar flag de superadmin único al usuario
ALTER TABLE "usuarios" ADD COLUMN "es_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- Índice único parcial: garantiza que SOLO UN usuario puede tener es_super_admin = true.
-- A diferencia de un UNIQUE normal, este solo aplica a las filas donde es_super_admin = true,
-- permitiendo que todos los demás usuarios tengan es_super_admin = false sin conflicto.
CREATE UNIQUE INDEX "idx_usuario_super_admin_unico"
  ON "usuarios" ("es_super_admin")
  WHERE "es_super_admin" = true;
