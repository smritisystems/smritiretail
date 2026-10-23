<#
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.16
  Created      : 2026-10-23
  Modified     : 2026-10-23
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Master Database Migration CLI (PowerShell)

.SYNOPSIS
  SMRITI Retail OS — Master Database Migration & Pre-Migration Backup CLI
.DESCRIPTION
  Automates PostgreSQL database backup snapshot, Alembic head migration, 
  zero-data-loss verification, and fail-safe rollback across control plane and tenant databases.
  Supports both host Python execution and automated Docker container fallback.
.PARAMETER Database
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
  .\scripts\migrate.ps1 -Database smriti001
  .\scripts\migrate.ps1 -BackupOnly
  .\scripts\migrate.ps1 -VerifyOnly
  .\scripts\migrate.ps1 -Database smriti001 -Restore "backend\backups\pre_migration\migration_session_xxx\smriti001_xxx.dump"
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

$hasHostPython = $false
if (Test-Path $PythonExe) {
    $hasHostPython = $true
} else {
    $PythonExe = "python"
    try {
        $testPy = & python --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $testPy -match "Python \d") {
            $hasHostPython = $true
        }
    } catch {
        $hasHostPython = $false
    }
}

if (-not $hasHostPython) {
    # Check if smriti-api Docker container is running
    $containerRunning = & docker ps --filter "name=smriti-api" --filter "status=running" --format "{{.Names}}" 2>$null
    if ($containerRunning -match "smriti-api") {
        Write-Host "Notice: Python not detected on Windows host. Routing execution to Docker container 'smriti-api'..." -ForegroundColor Cyan
        $dockerArgs = @("exec", "-i", "smriti-api", "python", "/workspace/scripts/auto_migrate.py", "--db", $Database)
        if ($BackupOnly) { $dockerArgs += "--backup-only" }
        if ($NoBackup) { $dockerArgs += "--no-backup" }
        if ($AutoRollback) { $dockerArgs += "--auto-rollback" }
        if ($VerifyOnly) { $dockerArgs += "--verify-only" }
        if ($Restore -ne "") { $dockerArgs += "--restore"; $dockerArgs += $Restore }
        & docker $dockerArgs
        exit $LASTEXITCODE
    } else {
        Write-Error "Python is not installed on host OS and Docker container 'smriti-api' is not running. Please start containers using 'docker compose up -d' or install Python."
        exit 1
    }
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
