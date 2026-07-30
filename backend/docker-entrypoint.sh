#!/bin/sh
# Entrypoint del backend en producción.
# Aplica las migraciones ya versionadas (nunca db push) y arranca el servidor.
set -e

echo "▶ Aplicando migraciones (prisma migrate deploy)…"
npx prisma migrate deploy

echo "▶ Iniciando servidor…"
exec node dist/server.js
