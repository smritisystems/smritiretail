<#
.SYNOPSIS
    SMRITI Retail OS - Factory Reset Utility
.DESCRIPTION
    Wipes existing database tables, re-applies Alembic migrations from scratch, and seeds default accounts.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File reset.ps1 -Force
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
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "reset.log"

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
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "              SMRITI ENTERPRISE FACTORY RESET UTILITY                " -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host ""

try {
    if (-not $Force) {
        Write-Host "WARNING: Factory Reset will clear all transactional & catalog database data!" -ForegroundColor Red
        $Confirm = Read-Host "Type 'RESET' to confirm resetting database to initial factory seed"
        if ($Confirm -ne "RESET") {
            Write-Log "Factory reset operation aborted." -Level "WARN"
            exit 0
        }
    }

    Set-Location $ScriptDir
    Write-Log "Re-creating database volume and restarting database container..." -Level "PROC"
    docker compose stop db api workspace >$null 2>&1
    docker compose rm -f db >$null 2>&1
    docker volume rm smriti_db_volume >$null 2>&1

    Write-Log "Starting clean database and backend service containers..." -Level "PROC"
    docker compose up -d db api workspace

    Write-Log "Waiting 10 seconds for database container to initialize..." -Level "INFO"
    Start-Sleep -Seconds 10

    Write-Log "Running Alembic migrations..." -Level "PROC"
    docker exec smriti-api python -m alembic upgrade head

    Write-Log "Seeding initial admin accounts & master lookup tables..." -Level "PROC"
    docker exec smriti-api python -m app.db.seed

    Write-Host ""
    Write-Log "SMRITI Retail OS Factory Reset completed successfully!" -Level "SUCCESS"
} catch {
    Write-Log "RESET FAILURE: $_" -Level "ERROR"
    exit 1
}
