<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Cluster Update Tool
.DESCRIPTION
    Safely pulls git updates, rebuilds modified Docker service images, applies database schema
    migrations, updates configuration parameters, and verifies system health.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File update.ps1
.NOTES
    Project      : SMRITI Retail OS
    Author       : Jawahar Ramkripal Mallah
    Designation  : Chief Systems Architect & Creator
    Email        : support@smritibooks.com
    Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
    Version      : 3.34.0
#>

[CmdletBinding()]
param (
    [switch]$SkipGitPull,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "update.log"

function Write-Log {
    param ([string]$Message, [string]$Level = "INFO")
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $LogFile -Value "[$Timestamp] [$Level] $Message" -ErrorAction SilentlyContinue

    switch ($Level) {
        "SUCCESS" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "WARN"    { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "ERROR"   { Write-Host "[FAIL] $Message" -ForegroundColor Red }
        "PROC"    { Write-Host "[PROC] $Message" -ForegroundColor Cyan }
        Default   { Write-Host "     $Message" -ForegroundColor White }
    }
}

Clear-Host
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "                  SMRITI ENTERPRISE CLUSTER UPDATER                  " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

try {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    Set-Location $ScriptDir

    if (-not $SkipGitPull) {
        Write-Log "Checking for repository updates (git pull)..." -Level "PROC"
        try {
            $GitOut = git pull 2>&1
            Write-Log "Git sync result: $GitOut" -Level "SUCCESS"
        } catch {
            Write-Log "Git pull skipped or returned warning: $_" -Level "WARN"
        }
    }

    Write-Log "Rebuilding Docker cluster images..." -Level "PROC"
    if ($NoCache) {
        docker compose build --no-cache 2>&1 | Out-File -FilePath $LogFile -Append
    } else {
        docker compose build 2>&1 | Out-File -FilePath $LogFile -Append
    }

    Write-Log "Restarting container services with updated images..." -Level "PROC"
    docker compose up -d 2>&1 | Out-File -FilePath $LogFile -Append

    Write-Log "Applying database schema migrations..." -Level "PROC"
    docker exec smriti-api python -m alembic upgrade head 2>&1 | Out-File -FilePath $LogFile -Append
    Write-Log "Schema migrations updated." -Level "SUCCESS"

    Write-Log "Verifying cluster container status..." -Level "PROC"
    docker compose ps

    Write-Host ""
    Write-Log "SMRITI Retail OS Cluster updated successfully!" -Level "SUCCESS"
} catch {
    Write-Log "UPDATE FAILURE: $_" -Level "ERROR"
    exit 1
}
