-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tutorial_completado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tutorial_completado_en" TIMESTAMP(3);
