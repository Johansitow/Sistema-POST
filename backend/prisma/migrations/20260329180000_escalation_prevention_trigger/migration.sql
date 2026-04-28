-- =============================================================================
-- Migración: escalation_prevention_trigger
-- Propósito: cerrar las dos brechas de escalamiento de privilegios que NO cubre
--   el trigger tg_protect_super_admin existente:
--
--   BRECHA 1 — UPDATE escalación (false → true):
--     El trigger anterior solo protege a un usuario que YA es super admin
--     (OLD.es_super_admin = true). No bloqueaba el caso donde alguien hace
--     UPDATE usuarios SET es_super_admin = true WHERE id = X (escalamiento).
--
--   BRECHA 2 — INSERT con es_super_admin = true por API:
--     Un endpoint de creación de usuario podría recibir es_super_admin: true
--     en el body. El índice único parcial solo garantiza unicidad cuando ya
--     existe uno; no bloquea el primer intento fraudulento.
--
-- Estrategia:
--   - Reemplazar la función protect_super_admin() para añadir la guarda de
--     escalamiento en UPDATE (regla 4).
--   - Crear función y trigger nuevos para INSERT que permitan crear el SA
--     solo si NO existe ninguno aún (ventana de setup inicial del sistema).
--     Una vez creado, ningún INSERT posterior puede setearlo en true.
--
-- El trigger de DELETE existente (tg_protect_super_admin_delete) no se modifica.
-- =============================================================================

-- ─── 1. Reemplazar función UPDATE: añadir guarda anti-escalamiento ────────────

CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Regla 1: no se puede revocar el flag una vez asignado
  IF OLD.es_super_admin = TRUE AND NEW.es_super_admin = FALSE THEN
    RAISE EXCEPTION
      'SUPER_ADMIN_PROTECTED: el flag es_super_admin no puede ser removido. '
      'El super admin del sistema es inmutable.';
  END IF;

  -- Regla 2: no se puede hacer soft-delete del super admin
  IF OLD.es_super_admin = TRUE AND NEW.estado::TEXT = 'eliminado' THEN
    RAISE EXCEPTION
      'SUPER_ADMIN_PROTECTED: el super admin no puede ser eliminado del sistema.';
  END IF;

  -- Regla 3: no se puede desactivar al super admin
  IF OLD.es_super_admin = TRUE AND NEW.estado::TEXT = 'inactivo' THEN
    RAISE EXCEPTION
      'SUPER_ADMIN_PROTECTED: el super admin no puede ser desactivado.';
  END IF;

  -- Regla 4 [NUEVA]: escalamiento de privilegios — UPDATE false → true bloqueado
  --   Nadie puede auto-asignarse o asignar a otro el flag de super admin
  --   mediante un UPDATE, sin importar qué usuario de DB ejecute la query.
  --   El super admin SOLO puede existir si fue creado en el INSERT inicial.
  IF OLD.es_super_admin = FALSE AND NEW.es_super_admin = TRUE THEN
    RAISE EXCEPTION
      'SUPER_ADMIN_PROTECTED: escalamiento de privilegios bloqueado. '
      'El flag es_super_admin no puede activarse mediante UPDATE. '
      'Solo puede ser configurado durante el INSERT inicial del seed del sistema.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger existente tg_protect_super_admin ya apunta a esta función,
-- por lo que el REPLACE la actualiza automáticamente sin recrear el trigger.

-- ─── 2. Nueva función INSERT: ventana única de setup ─────────────────────────
--
-- Permite crear el super admin SOLO si aún no existe ninguno en el sistema
-- (primera vez que corre el seed). En cualquier otro INSERT con
-- es_super_admin = true, levanta excepción.

CREATE OR REPLACE FUNCTION protect_super_admin_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.es_super_admin = TRUE THEN
    IF EXISTS (
      SELECT 1 FROM "usuarios" WHERE "es_super_admin" = TRUE
    ) THEN
      RAISE EXCEPTION
        'SUPER_ADMIN_PROTECTED: ya existe un super admin en el sistema. '
        'Solo puede existir un único super admin. '
        'No es posible crear otro mediante INSERT.';
    END IF;
    -- Si no existe ninguno, permitir: es el setup inicial del sistema.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_protect_super_admin_insert ON "usuarios";

CREATE TRIGGER tg_protect_super_admin_insert
  BEFORE INSERT ON "usuarios"
  FOR EACH ROW
  EXECUTE FUNCTION protect_super_admin_insert();

-- ─── 3. Verificar que los tres triggers están activos ────────────────────────
-- (No es DDL ejecutable, solo documentación de estado esperado)
--
-- Triggers activos sobre "usuarios" tras esta migración:
--   tg_protect_super_admin          BEFORE UPDATE — reglas 1, 2, 3, 4
--   tg_protect_super_admin_delete   BEFORE DELETE — bloquea DELETE físico
--   tg_protect_super_admin_insert   BEFORE INSERT — ventana única de setup
