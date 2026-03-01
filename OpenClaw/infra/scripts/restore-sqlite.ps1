param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DbPath = "infra/sqlite/sales.db"
)

if (!(Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
  exit 1
}

Copy-Item -Path $BackupFile -Destination $DbPath -Force
Write-Output "Database restored from: $BackupFile"
