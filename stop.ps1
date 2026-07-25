<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Cluster Stop Utility
.DESCRIPTION
    Gracefully stops SMRITI Docker containers while preserving state.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File stop.ps1
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
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host "                 SMRITI ENTERPRISE CLUSTER STOP                      " -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Yellow
Write-Host ""

try {
    Write-Host "[→] Stopping SMRITI Docker containers gracefully..." -ForegroundColor Cyan
    docker compose stop

    Write-Host ""
    Write-Host "[✓] All SMRITI containers stopped successfully." -ForegroundColor Green
} catch {
    Write-Host "[✗] STOP FAILURE: $_" -ForegroundColor Red
    exit 1
}
