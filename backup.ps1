<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Automated Backup Utility
.DESCRIPTION
    Creates compressed timestamped PostgreSQL database backups and stores them in the backups directory.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File backup.ps1
.NOTES
    Project      : SMRITI Retail OS
    Author       : Jawahar Ramkripal Mallah
    Designation  : Chief Systems Architect & Creator
    Email        : support@smritibooks.com
    Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
    Version      : 3.33.0
#>

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$BackupsDir = Join-Path $ScriptDir "backups"
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "backup.log"

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
Write-Host "                SMRITI ENTERPRISE BACKUP ENGINE                      " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

try {
    if (-not (Test-Path $BackupsDir)) { New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null }
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

    $DateStamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $BackupFileName = "smriti_db_backup_$DateStamp.sql"
    $BackupPath = Join-Path $BackupsDir $BackupFileName

    Write-Log "Initiating PostgreSQL database dump from container 'smriti-db'..." -Level "PROC"

    # Dump database using pg_dump inside smriti-db container
    $DumpCmd = "docker exec -t smriti-db pg_dump -U postgres -d smriti_retail_db"
    Invoke-Expression "$DumpCmd > '$BackupPath'"

    if ((Test-Path $BackupPath) -and (Get-Item $BackupPath).Length -gt 0) {
        $SizeMB = [math]::Round(((Get-Item $BackupPath).Length / 1MB), 2)
        Write-Log "Database backup created successfully: $BackupFileName ($SizeMB MB)" -Level "SUCCESS"
        Write-Log "Backup File Location: $BackupPath" -Level "INFO"
    } else {
        Write-Log "Backup file created but appears empty. Verify database status." -Level "WARN"
    }
} catch {
    Write-Log "BACKUP FAILURE: $_" -Level "ERROR"
    exit 1
}
