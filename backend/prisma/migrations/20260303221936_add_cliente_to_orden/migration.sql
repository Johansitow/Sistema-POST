-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('cc', 'ce', 'nit', 'pasaporte', 'sin_documento');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('regular', 'frecuente', 'vip', 'corporativo', 'delivery');

-- CreateEnum
CREATE TYPE "TipoPunto" AS ENUM ('ganado', 'canjeado', 'ajuste', 'vencimiento', 'bienvenida');

-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "id_cliente" INTEGER;

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "nombre_completo" VARCHAR(200) NOT NULL,
    "email" VARCHAR(150),
    "telefono" VARCHAR(20),
    "telefono_alterno" VARCHAR(20),
    "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'cc',
    "numero_documento" VARCHAR(50),
    "direccion" VARCHAR(255),
    "ciudad" VARCHAR(100),
    "barrio" VARCHAR(100),
    "tipo_cliente" "TipoCliente" NOT NULL DEFAULT 'regular',
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "puntos_acumulados" INTEGER NOT NULL DEFAULT 0,
    "total_gastado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_ordenes" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "preferencias" JSONB,
    "canal_adquisicion" VARCHAR(50),
    "fecha_nacimiento" DATE,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "ultima_visita" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_direcciones" (
    "id" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "alias" VARCHAR(50) NOT NULL,
    "direccion" VARCHAR(255) NOT NULL,
    "ciudad" VARCHAR(100),
    "barrio" VARCHAR(100),
    "referencia" VARCHAR(255),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cliente_direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_puntos" (
    "id" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_orden" INTEGER,
    "tipo" "TipoPunto" NOT NULL,
    "puntos" INTEGER NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "saldo_antes" INTEGER NOT NULL,
    "saldo_despues" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_uuid_key" ON "clientes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_numero_documento_key" ON "clientes"("numero_documento");

-- CreateIndex
CREATE INDEX "clientes_email_idx" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "clientes_telefono_idx" ON "clientes"("telefono");

-- CreateIndex
CREATE INDEX "clientes_numero_documento_idx" ON "clientes"("numero_documento");

-- CreateIndex
CREATE INDEX "clientes_tipo_cliente_idx" ON "clientes"("tipo_cliente");

-- CreateIndex
CREATE INDEX "clientes_ultima_visita_idx" ON "clientes"("ultima_visita");

-- CreateIndex
CREATE INDEX "cliente_direcciones_id_cliente_idx" ON "cliente_direcciones"("id_cliente");

-- CreateIndex
CREATE INDEX "cliente_puntos_id_cliente_idx" ON "cliente_puntos"("id_cliente");

-- CreateIndex
CREATE INDEX "cliente_puntos_id_orden_idx" ON "cliente_puntos"("id_orden");

-- CreateIndex
CREATE INDEX "cliente_puntos_fecha_idx" ON "cliente_puntos"("fecha");

-- CreateIndex
CREATE INDEX "ordenes_id_cliente_idx" ON "ordenes"("id_cliente");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_direcciones" ADD CONSTRAINT "cliente_direcciones_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_puntos" ADD CONSTRAINT "cliente_puntos_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_puntos" ADD CONSTRAINT "cliente_puntos_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
