-- CreateTable
CREATE TABLE "documentos_emitidos" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "consecutivo" VARCHAR(30) NOT NULL,
    "codigo_verificacion" VARCHAR(24) NOT NULL,
    "hash_contenido" VARCHAR(64) NOT NULL,
    "contenido_html" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "vigencia_hasta" TIMESTAMP(3),
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "motivo_anulacion" VARCHAR(300),
    "fecha_anulacion" TIMESTAMP(3),
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_empleado" INTEGER NOT NULL,
    "id_emisor" INTEGER NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_restaurante" INTEGER,
    "id_plantilla" INTEGER,

    CONSTRAINT "documentos_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_emitidos_codigo_verificacion_key" ON "documentos_emitidos"("codigo_verificacion");

-- CreateIndex
CREATE INDEX "documentos_emitidos_id_empleado_idx" ON "documentos_emitidos"("id_empleado");

-- CreateIndex
CREATE INDEX "documentos_emitidos_id_grupo_tipo_idx" ON "documentos_emitidos"("id_grupo", "tipo");

-- CreateIndex
CREATE INDEX "documentos_emitidos_fecha_emision_idx" ON "documentos_emitidos"("fecha_emision");

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_id_plantilla_fkey" FOREIGN KEY ("id_plantilla") REFERENCES "plantillas_impresion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

