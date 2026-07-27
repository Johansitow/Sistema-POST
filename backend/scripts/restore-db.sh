#!/usr/bin/env bash
#
# Restaura un respaldo de PostgreSQL generado por backup-db.sh.
# ⚠️ DESTRUCTIVO: --clean elimina y recrea los objetos de la base destino.
#
# Uso:
#   ./restore-db.sh <archivo.dump>
#
# Config por entorno (opcional):
#   DATABASE_URL   base DESTINO (si no, se lee de backend/.env).
#                  Para PROBAR una restauración, apunta a una base de prueba,
#                  p.ej.: DATABASE_URL=postgresql://user:pass@host:5432/pos_restore_test
#   FORCE=1        omite la confirmación interactiva (para automatizar).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "ERROR: falta el archivo de respaldo. Uso: ./restore-db.sh <archivo.dump>" >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: no existe el archivo: $FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f "$BACKEND_DIR/.env" ]]; then
  line="$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -n1 || true)"
  DATABASE_URL="${line#DATABASE_URL=}"
  DATABASE_URL="${DATABASE_URL%\"}"
  DATABASE_URL="${DATABASE_URL#\"}"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL no está definida (ni en el entorno ni en backend/.env)." >&2
  exit 1
fi

echo "⚠️  Vas a RESTAURAR '$FILE'"
echo "    sobre la base: $DATABASE_URL"
echo "    Esto ELIMINA y recrea los datos actuales de esa base."
if [[ "${FORCE:-}" != "1" ]]; then
  read -r -p "¿Continuar? Escribe 'si' para confirmar: " answer
  [[ "$answer" == "si" ]] || { echo "Cancelado."; exit 1; }
fi

echo "♻️  Restaurando…"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" "$FILE"

echo "✅ Restauración completada."
