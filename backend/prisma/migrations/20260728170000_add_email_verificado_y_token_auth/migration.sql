-- CreateEnum
CREATE TYPE "TipoTokenAuth" AS ENUM ('verificacion_email', 'reset_password');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "email_verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_verificado_en" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tokens_auth" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoTokenAuth" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_auth_token_hash_key" ON "tokens_auth"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_auth_id_usuario_tipo_idx" ON "tokens_auth"("id_usuario", "tipo");

-- AddForeignKey
ALTER TABLE "tokens_auth" ADD CONSTRAINT "tokens_auth_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
