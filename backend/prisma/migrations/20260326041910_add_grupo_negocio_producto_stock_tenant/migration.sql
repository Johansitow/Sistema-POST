-- ============================================================================
-- MIGRACIÓN: GrupoNegocio + ProductoStock + Modelo Híbrido de Tenant
-- Alta Prioridad — Arquitectura SaaS Multi-Restaurante
--
-- Estrategia de migración de datos para columnas NOT NULL en tablas con datos:
--   1. Crear la tabla grupo_negocio e insertar un grupo por defecto
--   2. Agregar columnas como nullable, poblar datos, luego hacer NOT NULL
--   3. Así evitamos errores de constraint en filas existentes
-- ============================================================================

-- ── Step 1: Nuevos ENUMs ─────────────────────────────────────────────────────
CREATE TYPE "TipoTenant" AS ENUM ('compartido', 'aislado');
CREATE TYPE "PlanSaaS"   AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE "RolGrupo"   AS ENUM ('owner', 'admin', 'operador', 'auditor');

-- ── Step 2: Crear tabla grupo_negocio ────────────────────────────────────────
CREATE TABLE "grupo_negocio" (
    "id"                    SERIAL       NOT NULL,
    "uuid"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "nombre"                VARCHAR(200) NOT NULL,
    "nit"                   VARCHAR(50),
    "logo_url"              VARCHAR(500),
    "plan"                  "PlanSaaS"   NOT NULL DEFAULT 'starter',
    "plan_max_restaurantes" INTEGER      NOT NULL DEFAULT 3,
    "db_schema"             VARCHAR(100),
    "db_connection_url"     TEXT,
    "activo"                BOOLEAN      NOT NULL DEFAULT true,
    "fecha_creacion"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_negocio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grupo_negocio_uuid_key" ON "grupo_negocio"("uuid");
CREATE UNIQUE INDEX "grupo_negocio_nit_key"  ON "grupo_negocio"("nit");

-- ── Step 3: Insertar el grupo por defecto para los restaurantes existentes ────
-- Este grupo se asignará a todos los restaurantes existentes.
-- En producción, renombrar este grupo después del despliegue.
INSERT INTO "grupo_negocio" ("nombre", "plan", "activo", "fecha_creacion", "fecha_modificacion")
VALUES ('Grupo Principal', 'starter', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ── Step 4: Crear tabla usuario_grupo ────────────────────────────────────────
CREATE TABLE "usuario_grupo" (
    "id"               SERIAL       NOT NULL,
    "id_usuario"       INTEGER      NOT NULL,
    "id_grupo"         INTEGER      NOT NULL,
    "rol_en_grupo"     "RolGrupo"   NOT NULL DEFAULT 'operador',
    "es_activo"        BOOLEAN      NOT NULL DEFAULT true,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_grupo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        "usuario_grupo_id_usuario_idx"           ON "usuario_grupo"("id_usuario");
CREATE INDEX        "usuario_grupo_id_grupo_idx"             ON "usuario_grupo"("id_grupo");
CREATE UNIQUE INDEX "usuario_grupo_id_usuario_id_grupo_key"  ON "usuario_grupo"("id_usuario", "id_grupo");

-- ── Step 5: Crear tabla producto_stock ───────────────────────────────────────
CREATE TABLE "producto_stock" (
    "id"                 SERIAL         NOT NULL,
    "id_producto"        INTEGER        NOT NULL,
    "id_restaurante"     INTEGER        NOT NULL,
    "stock_actual"       DECIMAL(12,3)  NOT NULL DEFAULT 0,
    "stock_minimo"       DECIMAL(12,3)  NOT NULL DEFAULT 0,
    "stock_maximo"       DECIMAL(12,3),
    "punto_reorden"      DECIMAL(12,3),
    "precio_venta_local" DECIMAL(12,2),
    "activo"             BOOLEAN        NOT NULL DEFAULT true,
    "fecha_modificacion" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        "producto_stock_id_restaurante_idx"              ON "producto_stock"("id_restaurante");
CREATE UNIQUE INDEX "producto_stock_id_producto_id_restaurante_key"  ON "producto_stock"("id_producto", "id_restaurante");

-- ── Step 6: Agregar columnas a restaurantes (nullable primero) ───────────────
ALTER TABLE "restaurantes"
  ADD COLUMN "id_grupo"     INTEGER,
  ADD COLUMN "tipo_tenant"  "TipoTenant" NOT NULL DEFAULT 'compartido',
  ADD COLUMN "moneda"       VARCHAR(10)  NOT NULL DEFAULT 'COP',
  ADD COLUMN "zona_horaria" VARCHAR(50)  NOT NULL DEFAULT 'America/Bogota';

-- Asignar todos los restaurantes existentes al grupo por defecto
UPDATE "restaurantes"
  SET "id_grupo" = (SELECT "id" FROM "grupo_negocio" ORDER BY "id" LIMIT 1);

-- Ahora sí hacer NOT NULL y agregar FK
ALTER TABLE "restaurantes" ALTER COLUMN "id_grupo" SET NOT NULL;

CREATE INDEX "restaurantes_id_grupo_idx" ON "restaurantes"("id_grupo");

ALTER TABLE "restaurantes"
  ADD CONSTRAINT "restaurantes_id_grupo_fkey"
  FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 7: FKs de usuario_grupo ─────────────────────────────────────────────
ALTER TABLE "usuario_grupo"
  ADD CONSTRAINT "usuario_grupo_id_usuario_fkey"
  FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_grupo"
  ADD CONSTRAINT "usuario_grupo_id_grupo_fkey"
  FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Step 8: Movimientos — agregar id_restaurante (nullable → NOT NULL) ────────
ALTER TABLE "movimientos" ADD COLUMN "id_restaurante" INTEGER;

-- Asignar todos los movimientos al restaurante default
UPDATE "movimientos"
  SET "id_restaurante" = (SELECT "id" FROM "restaurantes" WHERE "es_default" = true LIMIT 1);

ALTER TABLE "movimientos" ALTER COLUMN "id_restaurante" SET NOT NULL;

CREATE INDEX "movimientos_id_restaurante_idx" ON "movimientos"("id_restaurante");

ALTER TABLE "movimientos"
  ADD CONSTRAINT "movimientos_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 9: Recetas — agregar id_restaurante (nullable → NOT NULL) ────────────
ALTER TABLE "recetas" ADD COLUMN "id_restaurante" INTEGER;

UPDATE "recetas"
  SET "id_restaurante" = (SELECT "id" FROM "restaurantes" WHERE "es_default" = true LIMIT 1);

ALTER TABLE "recetas" ALTER COLUMN "id_restaurante" SET NOT NULL;

CREATE INDEX "recetas_id_restaurante_idx" ON "recetas"("id_restaurante");

ALTER TABLE "recetas"
  ADD CONSTRAINT "recetas_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 10: Lotes — id_restaurante Int? → Int (NOT NULL) ────────────────────
-- Hay lotes con id_restaurante NULL → asignarlos al restaurante default
UPDATE "lotes"
  SET "id_restaurante" = (SELECT "id" FROM "restaurantes" WHERE "es_default" = true LIMIT 1)
  WHERE "id_restaurante" IS NULL;

-- Eliminar FK antigua (nullable) y hacer NOT NULL
ALTER TABLE "lotes" DROP CONSTRAINT IF EXISTS "lotes_id_restaurante_fkey";
ALTER TABLE "lotes" ALTER COLUMN "id_restaurante" SET NOT NULL;

ALTER TABLE "lotes"
  ADD CONSTRAINT "lotes_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 11: ListaCompras — id_restaurante Int? → Int (NOT NULL) ─────────────
UPDATE "listas_compras"
  SET "id_restaurante" = (SELECT "id" FROM "restaurantes" WHERE "es_default" = true LIMIT 1)
  WHERE "id_restaurante" IS NULL;

ALTER TABLE "listas_compras" DROP CONSTRAINT IF EXISTS "listas_compras_id_restaurante_fkey";
ALTER TABLE "listas_compras" ALTER COLUMN "id_restaurante" SET NOT NULL;

ALTER TABLE "listas_compras"
  ADD CONSTRAINT "listas_compras_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 12: CierreCaja — id_restaurante Int? → Int (NOT NULL) ───────────────
UPDATE "cierres_caja"
  SET "id_restaurante" = (SELECT "id" FROM "restaurantes" WHERE "es_default" = true LIMIT 1)
  WHERE "id_restaurante" IS NULL;

ALTER TABLE "cierres_caja" DROP CONSTRAINT IF EXISTS "cierres_caja_id_restaurante_fkey";
ALTER TABLE "cierres_caja" ALTER COLUMN "id_restaurante" SET NOT NULL;

ALTER TABLE "cierres_caja"
  ADD CONSTRAINT "cierres_caja_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 13: FK de producto_stock ────────────────────────────────────────────
ALTER TABLE "producto_stock"
  ADD CONSTRAINT "producto_stock_id_producto_fkey"
  FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "producto_stock"
  ADD CONSTRAINT "producto_stock_id_restaurante_fkey"
  FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
