-- AlterTable
ALTER TABLE "receta_fases" ADD COLUMN     "merma_esperada_porcentaje" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "receta_ingredientes" ADD COLUMN     "numero_fase" INTEGER;

-- AlterTable
ALTER TABLE "recetas" ADD COLUMN     "medio_refrigeracion" VARCHAR(200);
