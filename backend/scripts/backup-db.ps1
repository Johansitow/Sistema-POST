# Respaldo de la base de datos PostgreSQL del POS (Windows / PowerShell).
# Equivalente a backup-db.sh. Genera un dump custom y aplica retención.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\backup-db.ps1
#
# Requisitos: pg_dump en el PATH.
# Config por entorno (opcional): DATABASE_URL, BACKUP_DIR, BACKUP_RETENTION_DAYS.

$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir

# Resolver DATABASE_URL: entorno primero, luego backend/.env
$DatabaseUrl = $env:DATABASE_URL
if (-not $DatabaseUrl) {
  $envFile = Join-Path $BackendDir '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if ($line) { $DatabaseUrl = ($line -replace '^DATABASE_URL=', '').Trim('"').Trim("'") }
  }
}
if (-not $DatabaseUrl) {
  Write-Error 'DATABASE_URL no está definida (ni en el entorno ni en backend/.env).'
  exit 1
}

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $BackendDir 'backups' }
$RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$Out = Join-Path $BackupDir "pos_$Timestamp.dump"

Write-Host "📦 Respaldando base de datos → $Out"
pg_dump $DatabaseUrl --format=custom --no-owner --no-privileges --file $Out
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump falló (código $LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host "🧹 Eliminando respaldos con más de $RetentionDays días"
$limite = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupDir -Filter 'pos_*.dump' |
  Where-Object { $_.LastWriteTime -lt $limite } |
  Remove-Item -Force

Write-Host "✅ Backup completado: $Out"
