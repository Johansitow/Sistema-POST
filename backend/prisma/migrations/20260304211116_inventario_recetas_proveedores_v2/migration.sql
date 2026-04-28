-- CreateEnum
CREATE TYPE "TipoFormulaIngrediente" AS ENUM ('proporcional', 'porcentaje', 'fijo', 'aproximado');

-- CreateEnum
CREATE TYPE "EstadoListaCompras" AS ENUM ('generada', 'enviada', 'recibida', 'parcial', 'cancelada');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UnidadMedida" ADD VALUE 'taza';
ALTER TYPE "UnidadMedida" ADD VALUE 'cucharada';
ALTER TYPE "UnidadMedida" ADD VALUE 'rama';
ALTER TYPE "UnidadMedida" ADD VALUE 'pizca';
ALTER TYPE "UnidadMedida" ADD VALUE 'porcion_aprox';

-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "id_usuario_responsable" INTEGER,
ADD COLUMN     "vida_util_dias" INTEGER;

-- AlterTable
ALTER TABLE "proveedor_productos" ADD COLUMN     "calidad_calificacion" DECIMAL(3,2),
ADD COLUMN     "fecha_ultima_entrega" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "proveedores" ADD COLUMN     "contacto_whatsapp" VARCHAR(20),
ADD COLUMN     "sitio_web" VARCHAR(255);

-- AlterTable
ALTER TABLE "receta_ingredientes" ADD COLUMN     "factor_formula" DECIMAL(10,4),
ADD COLUMN     "formula_descripcion" VARCHAR(500),
ADD COLUMN     "id_ingrediente_base" INTEGER,
ADD COLUMN     "tipo_formula" "TipoFormulaIngrediente";

-- AlterTable
ALTER TABLE "recetas" ADD COLUMN     "instrucciones_almacenamiento" TEXT;

-- CreateTable
CREATE TABLE "receta_fases" (
    "id" SERIAL NOT NULL,
    "id_receta" INTEGER NOT NULL,
    "numero_fase" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "duracion_minutos" INTEGER,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',

    CONSTRAINT "receta_fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_compras" (
    "id" SERIAL NOT NULL,
    "numero_lista" VARCHAR(50) NOT NULL,
    "estado" "EstadoListaCompras" NOT NULL DEFAULT 'generada',
    "id_usuario_generado" INTEGER NOT NULL,
    "id_proveedor_asignado" INTEGER,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_envio" TIMESTAMP(3),
    "fecha_recepcion" TIMESTAMP(3),
    "notas" TEXT,
    "total_estimado" DECIMAL(12,2),

    CONSTRAINT "listas_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_compras_items" (
    "id" SERIAL NOT NULL,
    "id_lista" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_proveedor_sugerido" INTEGER,
    "cantidad_sugerida" DECIMAL(12,3) NOT NULL,
    "precio_estimado" DECIMAL(12,2),
    "cantidad_recibida" DECIMAL(12,3),
    "observaciones" VARCHAR(500),

    CONSTRAINT "listas_compras_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receta_fases_id_receta_idx" ON "receta_fases"("id_receta");

-- CreateIndex
CREATE UNIQUE INDEX "receta_fases_id_receta_numero_fase_key" ON "receta_fases"("id_receta", "numero_fase");

-- CreateIndex
CREATE UNIQUE INDEX "listas_compras_numero_lista_key" ON "listas_compras"("numero_lista");

-- CreateIndex
CREATE INDEX "listas_compras_estado_idx" ON "listas_compras"("estado");

-- CreateIndex
CREATE INDEX "listas_compras_fecha_generacion_idx" ON "listas_compras"("fecha_generacion");

-- CreateIndex
CREATE INDEX "listas_compras_id_proveedor_asignado_idx" ON "listas_compras"("id_proveedor_asignado");

-- CreateIndex
CREATE INDEX "listas_compras_items_id_lista_idx" ON "listas_compras_items"("id_lista");

-- CreateIndex
CREATE INDEX "listas_compras_items_id_producto_idx" ON "listas_compras_items"("id_producto");

-- CreateIndex
CREATE INDEX "lotes_id_usuario_responsable_idx" ON "lotes"("id_usuario_responsable");

-- AddForeignKey
ALTER TABLE "receta_fases" ADD CONSTRAINT "receta_fases_id_receta_fkey" FOREIGN KEY ("id_receta") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_id_usuario_responsable_fkey" FOREIGN KEY ("id_usuario_responsable") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_compras" ADD CONSTRAINT "listas_compras_id_usuario_generado_fkey" FOREIGN KEY ("id_usuario_generado") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_compras" ADD CONSTRAINT "listas_compras_id_proveedor_asignado_fkey" FOREIGN KEY ("id_proveedor_asignado") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_compras_items" ADD CONSTRAINT "listas_compras_items_id_lista_fkey" FOREIGN KEY ("id_lista") REFERENCES "listas_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_compras_items" ADD CONSTRAINT "listas_compras_items_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
