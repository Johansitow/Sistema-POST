#!/usr/bin/env bash
#
# Respaldo de la base de datos PostgreSQL del POS.
# Genera un dump en formato custom (comprimido, restaurable con pg_restore) y
# borra los respaldos más viejos que BACKUP_RETENTION_DAYS.
#
# Uso:
#   ./backup-db.sh
#
# Requisitos: pg_dump en el PATH (viene con el cliente de PostgreSQL).
# Config por entorno (opcional):
#   DATABASE_URL            cadena de conexión (si no, se lee de backend/.env)
#   BACKUP_DIR              carpeta destino (default: backend/backups)
#   BACKUP_RETENTION_DAYS   días a conservar (default: 14)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Resolver DATABASE_URL: entorno primero, luego backend/.env
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

BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/pos_${TIMESTAMP}.dump"

echo "📦 Respaldando base de datos → $OUT"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$OUT"

echo "🧹 Eliminando respaldos con más de ${RETENTION_DAYS} días"
find "$BACKUP_DIR" -name 'pos_*.dump' -type f -mtime +"$RETENTION_DAYS" -delete

echo "✅ Backup completado: $OUT"
