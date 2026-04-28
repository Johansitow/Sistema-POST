-- AlterTable
ALTER TABLE "listas_compras" ADD COLUMN     "id_restaurante" INTEGER;

-- AlterTable
ALTER TABLE "lotes" ADD COLUMN     "id_restaurante" INTEGER;

-- CreateIndex
CREATE INDEX "listas_compras_id_restaurante_idx" ON "listas_compras"("id_restaurante");

-- CreateIndex
CREATE INDEX "lotes_id_restaurante_idx" ON "lotes"("id_restaurante");

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas_compras" ADD CONSTRAINT "listas_compras_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
