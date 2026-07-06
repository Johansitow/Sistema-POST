-- AlterEnum
BEGIN;
CREATE TYPE "UnidadMedida_new" AS ENUM ('unidad', 'gramo', 'kilogramo', 'litro', 'mililitro', 'porcion');
ALTER TABLE "productos" ALTER COLUMN "unidad_medida" TYPE "UnidadMedida_new" USING ("unidad_medida"::text::"UnidadMedida_new");
ALTER TABLE "recetas" ALTER COLUMN "unidad_produccion" TYPE "UnidadMedida_new" USING ("unidad_produccion"::text::"UnidadMedida_new");
ALTER TABLE "receta_ingredientes" ALTER COLUMN "unidad" TYPE "UnidadMedida_new" USING ("unidad"::text::"UnidadMedida_new");
ALTER TYPE "UnidadMedida" RENAME TO "UnidadMedida_old";
ALTER TYPE "UnidadMedida_new" RENAME TO "UnidadMedida";
DROP TYPE "UnidadMedida_old";
COMMIT;
