-- CreateEnum
CREATE TYPE "EstadoFacturaElectronica" AS ENUM ('pendiente', 'emitida', 'rechazada', 'error', 'anulada');

-- CreateTable
CREATE TABLE "facturas_electronicas" (
    "id" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_restaurante" INTEGER,
    "id_orden" INTEGER NOT NULL,
    "referencia" VARCHAR(100) NOT NULL,
    "proveedor" VARCHAR(30) NOT NULL,
    "estado" "EstadoFacturaElectronica" NOT NULL DEFAULT 'pendiente',
    "cufe" VARCHAR(120),
    "numero" VARCHAR(60),
    "qr_url" VARCHAR(500),
    "pdf_url" VARCHAR(500),
    "xml" TEXT,
    "adquiriente" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "impuestos" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "raw_respuesta" JSONB,
    "mensaje_error" TEXT,
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "fecha_emision" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_electronicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facturas_electronicas_id_orden_key" ON "facturas_electronicas"("id_orden");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_electronicas_referencia_key" ON "facturas_electronicas"("referencia");

-- CreateIndex
CREATE INDEX "facturas_electronicas_id_grupo_estado_idx" ON "facturas_electronicas"("id_grupo", "estado");

-- AddForeignKey
ALTER TABLE "facturas_electronicas" ADD CONSTRAINT "facturas_electronicas_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_electronicas" ADD CONSTRAINT "facturas_electronicas_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

