-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "client_uuid" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_client_uuid_key" ON "ordenes"("client_uuid");

