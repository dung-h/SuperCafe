param(
  [string]$DbPath = "infra/sqlite/sales.db",
  [string]$BackupDir = "infra/sqlite/backups"
)

if (!(Test-Path $DbPath)) {
  Write-Error "Database not found: $DbPath"
  exit 1
}

if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $BackupDir "sales-$stamp.db"
Copy-Item -Path $DbPath -Destination $target -Force
Write-Output "Backup created: $target"
