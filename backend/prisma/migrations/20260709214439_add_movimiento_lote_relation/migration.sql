-- CreateIndex
CREATE INDEX "movimientos_id_lote_idx" ON "movimientos"("id_lote");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_id_lote_fkey" FOREIGN KEY ("id_lote") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
