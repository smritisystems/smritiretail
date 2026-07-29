<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Cluster Start Utility
.DESCRIPTION
    Starts SMRITI Docker containers, waits for health checks to complete, and displays live URLs.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File start.ps1
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
Set-Location $ScriptDir

Clear-Host
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "                 SMRITI ENTERPRISE CLUSTER START                     " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

try {
    Write-Host "[→] Starting Docker cluster containers..." -ForegroundColor Cyan
    docker compose up -d

    Write-Host "[→] Verifying container status..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    docker compose ps

    Write-Host ""
    Write-Host "[✓] SMRITI Retail OS Cluster started!" -ForegroundColor Green
    Write-Host "    Operations App : http://localhost:3000" -ForegroundColor Cyan
    Write-Host "    API Engine Core: http://localhost:8000" -ForegroundColor Cyan
} catch {
    Write-Host "[✗] START FAILURE: $_" -ForegroundColor Red
    exit 1
}
