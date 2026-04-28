-- AlterTable
ALTER TABLE "cierres_caja" ADD COLUMN     "id_restaurante" INTEGER;

-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "id_restaurante" INTEGER;

-- CreateTable
CREATE TABLE "restaurantes" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "nit" VARCHAR(50),
    "descripcion" TEXT,
    "logo_url" VARCHAR(500),
    "direccion" VARCHAR(300),
    "ciudad" VARCHAR(100),
    "telefono" VARCHAR(20),
    "email" VARCHAR(150),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurantes_uuid_key" ON "restaurantes"("uuid");

-- CreateIndex
CREATE INDEX "cierres_caja_id_restaurante_idx" ON "cierres_caja"("id_restaurante");

-- CreateIndex
CREATE INDEX "ordenes_id_restaurante_idx" ON "ordenes"("id_restaurante");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
