-- =============================================================================
-- Migración: tenant_isolation_fields
-- Propósito: aísla correctamente el catálogo, clientes, proveedores, turnos,
--   alertas, plantillas y auditoría por grupo/restaurante.
--   Hace id_restaurante NOT NULL en ordenes (con backfill seguro).
--   Crea tabla configuracion_restaurante.
-- =============================================================================

-- ─── 1. Categoria — scoping por grupo ────────────────────────────────────────
ALTER TABLE "categorias"
  ADD COLUMN "id_grupo" INTEGER,
  ADD CONSTRAINT "categorias_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Eliminar el UNIQUE global de nombre (ahora es único por grupo)
ALTER TABLE "categorias" DROP CONSTRAINT IF EXISTS "categorias_nombre_key";
CREATE UNIQUE INDEX "categorias_nombre_id_grupo_key" ON "categorias"("nombre", "id_grupo");

CREATE INDEX "idx_categorias_id_grupo" ON "categorias"("id_grupo");

-- ─── 2. Producto — scoping por grupo ─────────────────────────────────────────
ALTER TABLE "productos"
  ADD COLUMN "id_grupo" INTEGER,
  ADD CONSTRAINT "productos_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_productos_id_grupo" ON "productos"("id_grupo");

-- ─── 3. Proveedor — scoping por grupo ────────────────────────────────────────
ALTER TABLE "proveedores"
  ADD COLUMN "id_grupo" INTEGER,
  ADD CONSTRAINT "proveedores_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_proveedores_id_grupo" ON "proveedores"("id_grupo");

-- ─── 4. Cliente — scoping por grupo ──────────────────────────────────────────
ALTER TABLE "clientes"
  ADD COLUMN "id_grupo" INTEGER,
  ADD CONSTRAINT "clientes_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_clientes_id_grupo" ON "clientes"("id_grupo");

-- ─── 5. TurnoCaja — scoping por restaurante ──────────────────────────────────
ALTER TABLE "turnos_caja"
  ADD COLUMN "id_restaurante" INTEGER,
  ADD CONSTRAINT "turnos_caja_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_turnos_caja_id_restaurante" ON "turnos_caja"("id_restaurante");

-- ─── 6. Alerta — scoping por restaurante ─────────────────────────────────────
ALTER TABLE "alertas"
  ADD COLUMN "id_restaurante" INTEGER,
  ADD CONSTRAINT "alertas_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_alertas_id_restaurante" ON "alertas"("id_restaurante");

-- ─── 7. Orden — hacer id_restaurante NOT NULL ────────────────────────────────
-- Backfill seguro: asignar el primer restaurante activo a órdenes huérfanas.
-- En producción se debería verificar que no haya órdenes sin restaurante antes
-- de ejecutar este paso.
DO $$
DECLARE
  v_primer_id INT;
BEGIN
  SELECT id INTO v_primer_id FROM "restaurantes" WHERE activo = true ORDER BY id LIMIT 1;
  IF v_primer_id IS NOT NULL THEN
    UPDATE "ordenes" SET "id_restaurante" = v_primer_id WHERE "id_restaurante" IS NULL;
  END IF;
END $$;

ALTER TABLE "ordenes" ALTER COLUMN "id_restaurante" SET NOT NULL;

-- ─── 8. PlantillaImpresion — scoping por restaurante y grupo ─────────────────
ALTER TABLE "plantillas_impresion"
  ADD COLUMN "id_restaurante" INTEGER,
  ADD COLUMN "id_grupo"       INTEGER,
  ADD CONSTRAINT "plantillas_impresion_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "plantillas_impresion_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_plantillas_id_restaurante" ON "plantillas_impresion"("id_restaurante");
CREATE INDEX "idx_plantillas_id_grupo"       ON "plantillas_impresion"("id_grupo");

-- ─── 9. Auditoria — contexto tenant ──────────────────────────────────────────
ALTER TABLE "auditoria"
  ADD COLUMN "id_restaurante" INTEGER,
  ADD COLUMN "id_grupo"       INTEGER,
  ADD CONSTRAINT "auditoria_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "auditoria_id_grupo_fkey"
    FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_auditoria_id_restaurante" ON "auditoria"("id_restaurante");
CREATE INDEX "idx_auditoria_id_grupo"       ON "auditoria"("id_grupo");

-- ─── 10. ConfiguracionRestaurante — nueva tabla ───────────────────────────────
CREATE TABLE "configuracion_restaurante" (
  "id"               SERIAL        NOT NULL,
  "id_restaurante"   INTEGER       NOT NULL,
  "clave"            VARCHAR(100)  NOT NULL,
  "valor"            TEXT          NOT NULL,
  "tipo_dato"        "TipoDato"    NOT NULL DEFAULT 'string',
  "descripcion"      TEXT,
  "fecha_modificacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "configuracion_restaurante_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "configuracion_restaurante_id_restaurante_fkey"
    FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "configuracion_restaurante_id_restaurante_clave_key"
  ON "configuracion_restaurante"("id_restaurante", "clave");

CREATE INDEX "idx_config_restaurante" ON "configuracion_restaurante"("id_restaurante");

-- ─── 11. Índices de performance para consultas consolidadas ──────────────────
-- Consultas de inventario más frecuentes (alertas de stock)
CREATE INDEX IF NOT EXISTS "idx_producto_stock_rest_prod"
  ON "producto_stock"("id_restaurante", "id_producto");

CREATE INDEX IF NOT EXISTS "idx_ordenes_rest_estado_fecha"
  ON "ordenes"("id_restaurante", "id_estado", "fecha_apertura" DESC);

CREATE INDEX IF NOT EXISTS "idx_auditoria_rest_modulo_fecha"
  ON "auditoria"("id_restaurante", "modulo", "fecha_hora" DESC);
