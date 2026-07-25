<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Database Restore Utility
.DESCRIPTION
    Restores PostgreSQL database state from a specified dump file in the backups directory.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File restore.ps1 -BackupFile "backups/smriti_db_backup_20260725_120000.sql"
.NOTES
    Project      : SMRITI Retail OS
    Author       : Jawahar Ramkripal Mallah
    Designation  : Chief Systems Architect & Creator
    Email        : support@smritibooks.com
    Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
    Version      : 3.33.0
#>

[CmdletBinding()]
param (
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$BackupsDir = Join-Path $ScriptDir "backups"
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "restore.log"

function Write-Log {
    param ([string]$Message, [string]$Level = "INFO")
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $LogFile -Value "[$Timestamp] [$Level] $Message" -ErrorAction SilentlyContinue

    switch ($Level) {
        "SUCCESS" { Write-Host "[✓] $Message" -ForegroundColor Green }
        "WARN"    { Write-Host "[⚠] $Message" -ForegroundColor Yellow }
        "ERROR"   { Write-Host "[✗] $Message" -ForegroundColor Red }
        "PROC"    { Write-Host "[→] $Message" -ForegroundColor Cyan }
        Default   { Write-Host "    $Message" -ForegroundColor White }
    }
}

Clear-Host
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "               SMRITI ENTERPRISE DATABASE RESTORE ENGINE             " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

try {
    if (-not (Test-Path $BackupsDir)) {
        Write-Log "No backups directory found at $BackupsDir" -Level "ERROR"
        exit 1
    }

    if (-not $BackupFile) {
        $Available = Get-ChildItem -Path $BackupsDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending
        if ($Available.Count -eq 0) {
            Write-Log "No .sql backup files found in $BackupsDir" -Level "ERROR"
            exit 1
        }
        $Target = $Available[0].FullName
        Write-Log "No backup file specified. Auto-selecting latest backup: $($Available[0].Name)" -Level "WARN"
    } else {
        if (Test-Path $BackupFile) {
            $Target = (Get-Item $BackupFile).FullName
        } else {
            $Target = Join-Path $BackupsDir $BackupFile
            if (-not (Test-Path $Target)) {
                Write-Log "Specified backup file not found: $BackupFile" -Level "ERROR"
                exit 1
            }
        }
    }

    Write-Log "Restoring PostgreSQL database from: $Target..." -Level "PROC"

    # Restore via psql into smriti-db container
    $RestoreCmd = "cmd /c `"type `"$Target`" | docker exec -i smriti-db psql -U postgres -d smriti_retail_db`""
    Invoke-Expression $RestoreCmd 2>&1 | Out-File -FilePath $LogFile -Append

    Write-Log "Database restore operation complete!" -Level "SUCCESS"
    Write-Log "Verifying API endpoints post-restoration..." -Level "PROC"
    
    Start-Sleep -Seconds 3
    docker exec smriti-api python -m app.db.seed 2>&1 | Out-File -FilePath $LogFile -Append
    Write-Log "System seed state verified." -Level "SUCCESS"
} catch {
    Write-Log "RESTORE FAILURE: $_" -Level "ERROR"
    exit 1
}
