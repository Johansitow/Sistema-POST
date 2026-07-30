-- ============================================================================
-- BASELINE — Arquitectura nueva de órdenes (OrdenSede / OrdenSedeItem /
-- PagoOrden / OrdenEvento)
-- ============================================================================
--
-- CONTEXTO: estas tablas y enums se introdujeron en su momento con
-- `prisma db push`, por lo que quedaron en la base de datos pero NUNCA en el
-- historial de migraciones. Consecuencias que esto arreglaba:
--
--   1. `prisma migrate dev` fallaba (P3006): la migración
--      20260706030450_add_impuesto_tipo_snapshot hace ALTER TABLE sobre
--      "orden_sedes", tabla que la shadow database nunca creaba.
--   2. La base de datos no era reproducible desde cero — un despliegue nuevo
--      habría fallado.
--
-- Esta migración NO cambia comportamiento ni datos: solo registra en el
-- historial una estructura que ya existía. Se marcó como aplicada en las bases
-- de datos existentes con `prisma migrate resolve --applied`.
--
-- Está fechada 20260706020000 (antes de add_impuesto_tipo_snapshot) para que
-- el replay ordenado de la shadow database encuentre las tablas ya creadas.
--
-- Todas las sentencias son idempotentes: en una base que ya tenga la
-- estructura no hacen nada; en una base vacía la crean completa.
--
-- NOTA: "orden_sedes" se crea aquí SIN la columna "impuesto_tipo" a propósito.
-- Esa columna la añade 20260706030450_add_impuesto_tipo_snapshot, que corre
-- justo después. Incluirla aquí rompería el replay por columna duplicada.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
-- CREATE TYPE no admite IF NOT EXISTS: se envuelve en un bloque que ignora el
-- error de objeto duplicado.

DO $$ BEGIN
  CREATE TYPE "EstadoOrdenGlobal" AS ENUM ('BORRADOR', 'RECIBIDA', 'EN_PROCESO', 'LISTA', 'ENTREGADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoOrdenSede" AS ENUM ('PENDIENTE', 'EN_PREPARACION', 'LISTA', 'ENTREGADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoPagoOrden" AS ENUM ('pendiente', 'confirmado', 'rechazado', 'revertido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoFactura" AS ENUM ('GLOBAL', 'SEDE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tablas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "orden_sedes" (
    "id" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_restaurante" INTEGER NOT NULL,
    "sufijo" VARCHAR(5),
    "estado" "EstadoOrdenSede" NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_inicio_prep" TIMESTAMP(3),
    "fecha_lista" TIMESTAMP(3),
    "fecha_cancelacion" TIMESTAMP(3),
    "motivo_cancelacion" VARCHAR(300),
    "id_cocinero" INTEGER,

    CONSTRAINT "orden_sedes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orden_sede_items" (
    "id" SERIAL NOT NULL,
    "id_sede" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_variante" INTEGER,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notas" VARCHAR(500),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_sede_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pagos_orden" (
    "id" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(100),
    "notas" VARCHAR(300),
    "estado" "EstadoPagoOrden" NOT NULL DEFAULT 'pendiente',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_orden_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orden_eventos" (
    "id" BIGSERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "tipo_evento" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "id_usuario" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_eventos_pkey" PRIMARY KEY ("id")
);

-- ── Índices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "orden_sedes_id_orden_idx"           ON "orden_sedes"("id_orden");
CREATE INDEX IF NOT EXISTS "orden_sedes_id_restaurante_idx"     ON "orden_sedes"("id_restaurante");
CREATE INDEX IF NOT EXISTS "orden_sedes_estado_idx"             ON "orden_sedes"("estado");
CREATE UNIQUE INDEX IF NOT EXISTS "orden_sedes_id_orden_id_restaurante_key" ON "orden_sedes"("id_orden", "id_restaurante");

CREATE INDEX IF NOT EXISTS "orden_sede_items_id_sede_idx"       ON "orden_sede_items"("id_sede");
CREATE INDEX IF NOT EXISTS "orden_sede_items_id_producto_idx"   ON "orden_sede_items"("id_producto");

CREATE INDEX IF NOT EXISTS "pagos_orden_id_orden_idx"           ON "pagos_orden"("id_orden");

CREATE INDEX IF NOT EXISTS "orden_eventos_id_orden_idx"         ON "orden_eventos"("id_orden");
CREATE INDEX IF NOT EXISTS "orden_eventos_tipo_evento_idx"      ON "orden_eventos"("tipo_evento");
CREATE INDEX IF NOT EXISTS "orden_eventos_creado_en_idx"        ON "orden_eventos"("creado_en");

-- ── Claves foráneas ─────────────────────────────────────────────────────────
-- ADD CONSTRAINT no admite IF NOT EXISTS: se ignora el error de duplicado.

DO $$ BEGIN
  ALTER TABLE "orden_sedes" ADD CONSTRAINT "orden_sedes_id_orden_fkey"
    FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orden_sedes" ADD CONSTRAINT "orden_sedes_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orden_sede_items" ADD CONSTRAINT "orden_sede_items_id_sede_fkey"
    FOREIGN KEY ("id_sede") REFERENCES "orden_sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orden_sede_items" ADD CONSTRAINT "orden_sede_items_id_producto_fkey"
    FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orden_sede_items" ADD CONSTRAINT "orden_sede_items_id_variante_fkey"
    FOREIGN KEY ("id_variante") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pagos_orden" ADD CONSTRAINT "pagos_orden_id_orden_fkey"
    FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pagos_orden" ADD CONSTRAINT "pagos_orden_id_metodo_pago_fkey"
    FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "orden_eventos" ADD CONSTRAINT "orden_eventos_id_orden_fkey"
    FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
