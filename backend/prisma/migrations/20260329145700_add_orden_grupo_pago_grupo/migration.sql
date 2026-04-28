-- AlterTable
ALTER TABLE "grupo_negocio" ALTER COLUMN "uuid" DROP DEFAULT,
ALTER COLUMN "fecha_modificacion" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "id_orden_grupo" INTEGER,
ADD COLUMN     "sufijo_orden" VARCHAR(10);

-- AlterTable
ALTER TABLE "producto_stock" ALTER COLUMN "fecha_modificacion" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ordenes_grupo" (
    "id" SERIAL NOT NULL,
    "numero_grupo" VARCHAR(50) NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'abierto',
    "notas" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),

    CONSTRAINT "ordenes_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_grupo" (
    "id" SERIAL NOT NULL,
    "id_orden_grupo" INTEGER NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(100),
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_grupo_numero_grupo_key" ON "ordenes_grupo"("numero_grupo");

-- CreateIndex
CREATE INDEX "ordenes_grupo_id_grupo_idx" ON "ordenes_grupo"("id_grupo");

-- CreateIndex
CREATE INDEX "ordenes_grupo_id_usuario_idx" ON "ordenes_grupo"("id_usuario");

-- CreateIndex
CREATE INDEX "ordenes_grupo_fecha_creacion_idx" ON "ordenes_grupo"("fecha_creacion");

-- CreateIndex
CREATE INDEX "pagos_grupo_id_orden_grupo_idx" ON "pagos_grupo"("id_orden_grupo");

-- CreateIndex
CREATE INDEX "ordenes_id_orden_grupo_idx" ON "ordenes"("id_orden_grupo");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_orden_grupo_fkey" FOREIGN KEY ("id_orden_grupo") REFERENCES "ordenes_grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_grupo" ADD CONSTRAINT "ordenes_grupo_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_grupo" ADD CONSTRAINT "ordenes_grupo_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_grupo" ADD CONSTRAINT "pagos_grupo_id_orden_grupo_fkey" FOREIGN KEY ("id_orden_grupo") REFERENCES "ordenes_grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_grupo" ADD CONSTRAINT "pagos_grupo_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
