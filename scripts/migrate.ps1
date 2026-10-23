<#
.SYNOPSIS
  SMRITI Retail OS — Master Database Migration & Pre-Migration Backup CLI
.DESCRIPTION
  Automates PostgreSQL database backup snapshot, Alembic head migration, 
  zero-data-loss verification, and fail-safe rollback across control plane and tenant databases.
.PARAMETER Db
  Target database: 'all' (default), 'control' (smritisys), 'smriti001', or specific tenant db name.
.PARAMETER BackupOnly
  Creates verified pre-migration backups without running Alembic migrations.
.PARAMETER NoBackup
  Skips pre-migration backup (NOT recommended for production).
.PARAMETER AutoRollback
  Automatically restores pre-migration snapshot if any migration step fails.
.PARAMETER VerifyOnly
  Inspects topology, revisions, and schema health without executing migrations.
.PARAMETER Restore
  Restores specified .dump snapshot to the target database.
.EXAMPLE
  .\scripts\migrate.ps1
  .\scripts\migrate.ps1 -Db smriti001
  .\scripts\migrate.ps1 -BackupOnly
  .\scripts\migrate.ps1 -VerifyOnly
  .\scripts\migrate.ps1 -Db smriti001 -Restore "backend\backups\pre_migration\migration_session_xxx\smriti001_xxx.dump"
#>

[CmdletBinding()]
param (
    [string]$Database = "all",
    [switch]$BackupOnly,
    [switch]$NoBackup,
    [switch]$AutoRollback,
    [switch]$VerifyOnly,
    [string]$Restore = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = Split-Path -Parent $ScriptDir
$PythonExe = Join-Path $WorkspaceRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

$AutoMigratePy = Join-Path $ScriptDir "auto_migrate.py"

$ArgsList = @()
$ArgsList += $AutoMigratePy
$ArgsList += "--db"
$ArgsList += $Database

if ($BackupOnly) {
    $ArgsList += "--backup-only"
}
if ($NoBackup) {
    $ArgsList += "--no-backup"
}
if ($AutoRollback) {
    $ArgsList += "--auto-rollback"
}
if ($VerifyOnly) {
    $ArgsList += "--verify-only"
}
if ($Restore -ne "") {
    $ArgsList += "--restore"
    $ArgsList += $Restore
}

& $PythonExe $ArgsList
exit $LASTEXITCODE
