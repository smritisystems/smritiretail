<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Uninstaller
.DESCRIPTION
    Safely tears down the SMRITI Docker cluster containers, networks, and optionally volumes.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File uninstall.ps1 -RemoveVolumes
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
    [switch]$RemoveVolumes,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "uninstall.log"

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
Write-Host "=====================================================================" -ForegroundColor Red
Write-Host "                   SMRITI ENTERPRISE UNINSTALLER                     " -ForegroundColor Red
Write-Host "=====================================================================" -ForegroundColor Red
Write-Host ""

try {
    if (-not $Force) {
        Write-Host "WARNING: This script will stop and remove SMRITI Docker containers." -ForegroundColor Yellow
        if ($RemoveVolumes) {
            Write-Host "CAUTION: -RemoveVolumes flag set! Persistent database data WILL BE DELETED!" -ForegroundColor Red
        }
        Write-Host ""
        $Confirm = Read-Host "Are you sure you want to proceed with uninstallation? (y/N)"
        if ($Confirm -notmatch "^[Yy]$") {
            Write-Log "Uninstallation cancelled by user." -Level "WARN"
            exit 0
        }
    }

    Set-Location $ScriptDir
    Write-Log "Stopping and removing Docker container cluster..." -Level "PROC"

    if ($RemoveVolumes) {
        Write-Log "Tearing down cluster containers AND persistent volume storage..." -Level "WARN"
        docker compose down -v --remove-orphans 2>&1 | Out-File -FilePath $LogFile -Append
    } else {
        Write-Log "Tearing down cluster containers (preserving data volumes)..." -Level "INFO"
        docker compose down --remove-orphans 2>&1 | Out-File -FilePath $LogFile -Append
    }

    Write-Host ""
    Write-Log "SMRITI Retail OS Cluster uninstallation complete." -Level "SUCCESS"
} catch {
    Write-Log "UNINSTALL FAILURE: $_" -Level "ERROR"
    exit 1
}
