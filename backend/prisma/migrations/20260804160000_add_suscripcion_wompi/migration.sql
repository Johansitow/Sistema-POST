-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('activa', 'pendiente_pago', 'vencida', 'cancelada');

-- CreateEnum
CREATE TYPE "MetodoSuscripcion" AS ENUM ('nequi', 'pse', 'tarjeta');

-- CreateEnum
CREATE TYPE "EstadoTxWompi" AS ENUM ('pendiente', 'aprobada', 'rechazada', 'error', 'anulada');

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "plan" "PlanSaaS" NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'pendiente_pago',
    "metodo" "MetodoSuscripcion",
    "periodo_inicio" TIMESTAMP(3),
    "periodo_fin" TIMESTAMP(3),
    "proximo_cobro" TIMESTAMP(3),
    "wompi_payment_source_id" VARCHAR(100),
    "wompi_customer_ref" VARCHAR(100),
    "monto_cop" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones_suscripcion" (
    "id" SERIAL NOT NULL,
    "id_suscripcion" INTEGER NOT NULL,
    "referencia" VARCHAR(100) NOT NULL,
    "wompi_transaction_id" VARCHAR(100),
    "monto_cop" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoTxWompi" NOT NULL DEFAULT 'pendiente',
    "metodo" "MetodoSuscripcion" NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "raw_evento" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacciones_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_webhook_wompi" (
    "id" SERIAL NOT NULL,
    "evento_id" VARCHAR(120) NOT NULL,
    "tipo" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "procesado_en" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_webhook_wompi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_id_grupo_key" ON "suscripciones"("id_grupo");

-- CreateIndex
CREATE INDEX "suscripciones_estado_proximo_cobro_idx" ON "suscripciones"("estado", "proximo_cobro");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_suscripcion_referencia_key" ON "transacciones_suscripcion"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_suscripcion_wompi_transaction_id_key" ON "transacciones_suscripcion"("wompi_transaction_id");

-- CreateIndex
CREATE INDEX "transacciones_suscripcion_id_suscripcion_idx" ON "transacciones_suscripcion"("id_suscripcion");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_webhook_wompi_evento_id_key" ON "eventos_webhook_wompi"("evento_id");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones_suscripcion" ADD CONSTRAINT "transacciones_suscripcion_id_suscripcion_fkey" FOREIGN KEY ("id_suscripcion") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
