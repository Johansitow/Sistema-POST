-- Normalizar datos antes de aplicar las restricciones: cadenas vacías en
-- telefono_alterno deben ser NULL, o violarían el unique compuesto por grupo.
UPDATE "clientes" SET "telefono_alterno" = NULL WHERE "telefono_alterno" = '';

-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "telefono" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clientes_id_grupo_telefono_key" ON "clientes"("id_grupo", "telefono");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_id_grupo_telefono_alterno_key" ON "clientes"("id_grupo", "telefono_alterno");
