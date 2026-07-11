-- DropIndex
DROP INDEX "clientes_email_key";

-- DropIndex
DROP INDEX "clientes_numero_documento_key";

-- CreateIndex
CREATE UNIQUE INDEX "clientes_id_grupo_email_key" ON "clientes"("id_grupo", "email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_id_grupo_numero_documento_key" ON "clientes"("id_grupo", "numero_documento");
