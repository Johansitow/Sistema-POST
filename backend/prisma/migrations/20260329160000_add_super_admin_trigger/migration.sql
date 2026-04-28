-- =============================================================================
-- Trigger: protect_super_admin
-- Propósito: impedir a nivel de base de datos que el super admin sea
--   modificado, desactivado o eliminado (soft-delete) por cualquier vía,
--   incluyendo consultas directas a la DB que bypaseen el backend.
--
-- Complementa el índice único parcial ya existente
-- (idx_usuario_super_admin_unico) que garantiza unicidad del flag.
-- =============================================================================

-- ─── Función del trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Impedir desactivar el flag es_super_admin una vez asignado
  IF OLD.es_super_admin = true AND NEW.es_super_admin = false THEN
    RAISE EXCEPTION
      'Violación de integridad: el flag es_super_admin no puede ser removido. '
      'El super admin del sistema es inmutable.';
  END IF;

  -- 2. Impedir soft-delete del super admin (estado = 'eliminado')
  IF OLD.es_super_admin = true AND NEW.estado = 'eliminado' THEN
    RAISE EXCEPTION
      'Violación de integridad: el super admin no puede ser eliminado del sistema.';
  END IF;

  -- 3. Impedir desactivación del super admin (estado = 'inactivo')
  IF OLD.es_super_admin = true AND NEW.estado = 'inactivo' THEN
    RAISE EXCEPTION
      'Violación de integridad: el super admin no puede ser desactivado.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Trigger sobre la tabla usuarios ─────────────────────────────────────────
-- Se ejecuta BEFORE UPDATE para abortar la operación antes de que ocurra.
-- FOR EACH ROW garantiza que evalúa fila por fila (no por sentencia).

DROP TRIGGER IF EXISTS tg_protect_super_admin ON "usuarios";

CREATE TRIGGER tg_protect_super_admin
  BEFORE UPDATE ON "usuarios"
  FOR EACH ROW
  EXECUTE FUNCTION protect_super_admin();

-- ─── Protección adicional: impedir DELETE físico del super admin ──────────────

CREATE OR REPLACE FUNCTION protect_super_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.es_super_admin = true THEN
    RAISE EXCEPTION
      'Violación de integridad: el super admin no puede ser eliminado físicamente.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_protect_super_admin_delete ON "usuarios";

CREATE TRIGGER tg_protect_super_admin_delete
  BEFORE DELETE ON "usuarios"
  FOR EACH ROW
  EXECUTE FUNCTION protect_super_admin_delete();
