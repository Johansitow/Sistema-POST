-- ============================================================================
-- BASELINE (2/2) — Deriva preexistente: columnas de ordenes/facturas e índices
-- ============================================================================
--
-- Segunda parte de la reparación del historial de migraciones. La primera
-- (20260706020000_baseline_orden_sede_architecture) registró las 4 tablas de
-- la arquitectura nueva de órdenes. Al poder ya replicar el historial en una
-- shadow database se descubrió deriva adicional, también introducida en su
-- momento con `prisma db push`:
--
--   • ordenes:  estado_global, id_grupo (+ FK) y onDelete de id_restaurante
--   • facturas: tipo_factura, id_sede, datos_cliente (+ índice único y FK)
--   • configuracion_restaurante: fecha_modificacion sin DEFAULT (@updatedAt)
--   • índices creados a mano con prefijo idx_* que el schema espera con el
--     nombre por convención de Prisma (tabla_columna_idx)
--   • categorias_nombre_key: el nombre de categoría dejó de ser único global
--     al pasar a ser por grupo
--
-- Igual que la anterior: NO cambia comportamiento ni datos. Solo registra en
-- el historial una estructura que las bases de datos existentes ya tienen, y
-- por eso se marca con `prisma migrate resolve --applied`. En una base vacía
-- reconstruye la estructura correcta.
--
-- Todas las sentencias son idempotentes.
-- ============================================================================

-- ── ordenes: columnas de la arquitectura nueva ──────────────────────────────

ALTER TABLE "ordenes" ADD COLUMN IF NOT EXISTS "estado_global" "EstadoOrdenGlobal" NOT NULL DEFAULT 'RECIBIDA';
ALTER TABLE "ordenes" ADD COLUMN IF NOT EXISTS "id_grupo" INTEGER;

-- onDelete de id_restaurante: se recrea para que coincida con el schema
ALTER TABLE "ordenes" DROP CONSTRAINT IF EXISTS "ordenes_id_restaurante_fkey";
DO $$ BEGIN
  ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── facturas: factura por sede + snapshot de datos del cliente ──────────────

ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "tipo_factura"  "TipoFactura" NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "id_sede"       INTEGER;
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "datos_cliente" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "facturas_id_sede_key" ON "facturas"("id_sede");

DO $$ BEGIN
  ALTER TABLE "facturas" ADD CONSTRAINT "facturas_id_sede_fkey"
    FOREIGN KEY ("id_sede") REFERENCES "orden_sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── configuracion_restaurante: @updatedAt lo gestiona Prisma, no un DEFAULT ──
-- DROP DEFAULT sobre una columna sin default es un no-op en PostgreSQL.

ALTER TABLE "configuracion_restaurante" ALTER COLUMN "fecha_modificacion" DROP DEFAULT;

-- ── Índices obsoletos ───────────────────────────────────────────────────────
-- El nombre de categoría ya no es único global (ahora es único por grupo).

DROP INDEX IF EXISTS "categorias_nombre_key";
DROP INDEX IF EXISTS "idx_auditoria_rest_modulo_fecha";
DROP INDEX IF EXISTS "idx_clientes_id_grupo";
DROP INDEX IF EXISTS "idx_ordenes_rest_estado_fecha";
DROP INDEX IF EXISTS "idx_producto_stock_rest_prod";

-- ── Renombrado de índices a la convención de Prisma ─────────────────────────
-- Solo renombra si existe el nombre viejo y no existe el nuevo, para que sea
-- idempotente en bases que ya fueron renombradas.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('idx_alertas_id_restaurante',      'alertas_id_restaurante_idx'),
    ('idx_auditoria_id_grupo',          'auditoria_id_grupo_idx'),
    ('idx_auditoria_id_restaurante',    'auditoria_id_restaurante_idx'),
    ('idx_categorias_id_grupo',         'categorias_id_grupo_idx'),
    ('idx_config_restaurante',          'configuracion_restaurante_id_restaurante_idx'),
    ('idx_plantillas_id_grupo',         'plantillas_impresion_id_grupo_idx'),
    ('idx_plantillas_id_restaurante',   'plantillas_impresion_id_restaurante_idx'),
    ('idx_productos_id_grupo',          'productos_id_grupo_idx'),
    ('idx_proveedores_id_grupo',        'proveedores_id_grupo_idx'),
    ('idx_turnos_caja_id_restaurante',  'turnos_caja_id_restaurante_idx')
  ) AS t(viejo, nuevo)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = r.viejo AND relkind = 'i')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = r.nuevo AND relkind = 'i')
    THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.viejo, r.nuevo);
    END IF;
  END LOOP;
END $$;
