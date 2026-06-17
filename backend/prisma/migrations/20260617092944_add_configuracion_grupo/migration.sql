-- CreateTable
CREATE TABLE "configuracion_grupo" (
    "id" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo_dato" "TipoDato" NOT NULL DEFAULT 'string',
    "descripcion" TEXT,
    "es_editable" BOOLEAN NOT NULL DEFAULT true,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracion_grupo_id_grupo_idx" ON "configuracion_grupo"("id_grupo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_grupo_id_grupo_clave_key" ON "configuracion_grupo"("id_grupo", "clave");

-- AddForeignKey
ALTER TABLE "configuracion_grupo" ADD CONSTRAINT "configuracion_grupo_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
