# Scripts de respaldo de la base de datos

Respaldo y restauración de PostgreSQL para el POS. Un backup que nunca probaste
a restaurar **no es un backup**: prueba la restauración al menos una vez.

## Requisitos

- `pg_dump` y `pg_restore` en el PATH (vienen con el cliente de PostgreSQL).
  Verifica con `pg_dump --version`.
- `DATABASE_URL` definida en el entorno o en `backend/.env` (los scripts la leen solos).

## Hacer un respaldo

Linux / Mac / Git Bash:

```bash
bash backend/scripts/backup-db.sh
```

Windows (PowerShell):

```bash
powershell -ExecutionPolicy Bypass -File backend/scripts/backup-db.ps1
```

Genera `backend/backups/pos_AAAAMMDD_HHMMSS.dump` y borra los que superan la
retención (14 días por defecto; ajusta con `BACKUP_RETENTION_DAYS`).

## Restaurar (y cómo PROBARLO sin riesgo)

⚠️ Restaurar es destructivo sobre la base destino. Para **probar** que un dump
sirve, restáuralo en una base de prueba, no en la de producción:

```bash
# 1) Crea una base vacía de prueba (una sola vez)
createdb pos_restore_test

# 2) Restaura el último dump apuntando DATABASE_URL a esa base de prueba
DATABASE_URL="postgresql://USUARIO:PASS@localhost:5432/pos_restore_test" \
  bash backend/scripts/restore-db.sh backend/backups/pos_XXXXXXXX_XXXXXX.dump

# 3) Verifica que hay datos, por ejemplo:
psql "postgresql://USUARIO:PASS@localhost:5432/pos_restore_test" -c "SELECT count(*) FROM \"Usuario\";"

# 4) Borra la base de prueba cuando termines
dropdb pos_restore_test
```

Si el conteo tiene sentido, tu backup es bueno. Repite esta prueba de vez en cuando.

## Programar el respaldo automático (diario)

**Linux (cron):** edita el crontab con `crontab -e` y agrega (backup diario 3:00am):

```
0 3 * * * /bin/bash /ruta/al/repo/backend/scripts/backup-db.sh >> /var/log/pos-backup.log 2>&1
```

**Windows (Programador de tareas):** crea una tarea básica diaria que ejecute:

```
Programa:   powershell
Argumentos: -ExecutionPolicy Bypass -File C:\ruta\al\repo\backend\scripts\backup-db.ps1
```

> Cuando el sistema pase a Docker (Fase 1), este respaldo se moverá a un contenedor
> o servicio administrado; por ahora cubre el piloto en un solo equipo/servidor.
