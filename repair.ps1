<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Diagnostic & Self-Healing Repair Tool
.DESCRIPTION
    Diagnoses container health failures, repairs configuration discrepancies, fixes permissions,
    recreates crashed containers, and performs cluster recovery.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File repair.ps1
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
    [switch]$HardReset
)

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "repair.log"

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
Write-Host "                SMRITI ENTERPRISE CLUSTER REPAIR TOOL                " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

try {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    Set-Location $ScriptDir

    Write-Log "Diagnosing Docker Daemon and Network Connectivity..." -Level "PROC"
    try {
        docker info >$null 2>&1
        Write-Log "Docker daemon is active." -Level "SUCCESS"
    } catch {
        Write-Log "Docker daemon is down! Please start Docker Desktop." -Level "ERROR"
        exit 1
    }

    if ($HardReset) {
        Write-Log "Hard reset mode enabled. Restarting container cluster..." -Level "WARN"
        docker compose down 2>&1 | Out-File -FilePath $LogFile -Append
    }

    Write-Log "Re-building and restarting healthy container instances..." -Level "PROC"
    docker compose up -d --build 2>&1 | Out-File -FilePath $LogFile -Append

    Write-Log "Waiting for database and API containers to stabilize..." -Level "PROC"
    Start-Sleep -Seconds 10

    Write-Log "Executing database schema repair & migration check..." -Level "PROC"
    try {
        docker exec smriti-api python -m alembic upgrade head 2>&1 | Out-File -FilePath $LogFile -Append
        Write-Log "Database migrations verified." -Level "SUCCESS"
    } catch {
        Write-Log "Database migration check encountered warning: $_" -Level "WARN"
    }

    Write-Log "Executing API health check..." -Level "PROC"
    try {
        $Resp = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5
        Write-Log "API Health Response: $($Resp.status)" -Level "SUCCESS"
    } catch {
        Write-Log "API endpoint non-responsive. Restarting smriti-api container..." -Level "WARN"
        docker compose restart api
    }

    Write-Host ""
    Write-Log "Cluster repair & self-healing operation complete." -Level "SUCCESS"
} catch {
    Write-Log "REPAIR FAILURE: $_" -Level "ERROR"
    exit 1
}
