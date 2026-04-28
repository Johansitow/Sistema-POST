-- CreateTable
CREATE TABLE "usuario_restaurantes" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "id_restaurante" INTEGER NOT NULL,
    "es_activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_restaurantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuario_restaurantes_id_usuario_idx" ON "usuario_restaurantes"("id_usuario");

-- CreateIndex
CREATE INDEX "usuario_restaurantes_id_restaurante_idx" ON "usuario_restaurantes"("id_restaurante");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_restaurantes_id_usuario_id_restaurante_key" ON "usuario_restaurantes"("id_usuario", "id_restaurante");

-- AddForeignKey
ALTER TABLE "usuario_restaurantes" ADD CONSTRAINT "usuario_restaurantes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_restaurantes" ADD CONSTRAINT "usuario_restaurantes_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
