<#
.SYNOPSIS
  SMRITI Retail OS — Backup Status & Health Inspector
.DESCRIPTION
  Inspects current protection health, scheduled backups, and active background jobs.
.PARAMETER ApiUrl
  Base URL of the FastAPI backend (Default: 'http://localhost:8000')
#>

[CmdletBinding()]
param (
    [string]$ApiUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       SMRITI Retail OS — Backup & Protection Status      " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $status = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/status" -Method Get -TimeoutSec 10
} catch {
    Write-Host "[-] Error: Failed to reach SMRITI API at $ApiUrl. Ensure FastAPI backend is running." -ForegroundColor Red
    exit 1
}

$color = if ($status.is_protected) { "Green" } else { "Yellow" }
Write-Host "  Protection Status  : " -NoNewline
Write-Host $status.protection_title -ForegroundColor $color
Write-Host "  Protection Detail  : $($status.protection_subtitle)"
Write-Host "  Last Backup Time   : $($status.last_backup_time_pretty)"
Write-Host "  Last Verified      : $(if ($status.last_backup_verified) { 'PASSED' } else { 'UNVERIFIED' })" -ForegroundColor $(if ($status.last_backup_verified) { 'Green' } else { 'Yellow' })
Write-Host "  Next Scheduled     : $($status.next_scheduled_backup_pretty)"
Write-Host "  Automatic Backup   : $(if ($status.automatic_backup_enabled) { 'ENABLED' } else { 'DISABLED' })"
Write-Host "  Total Backups      : $($status.total_backups_count)"
Write-Host ""

# Check for active running job
try {
    $activeJob = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/active-job" -Method Get -TimeoutSec 5
    if ($activeJob) {
        Write-Host "Active Job Detected:" -ForegroundColor Yellow
        Write-Host "  Job ID    : $($activeJob.job_id)"
        Write-Host "  Stage     : $($activeJob.stage) ($($activeJob.percent)%)"
        Write-Host "  Status    : $($activeJob.status)"
        Write-Host "  Message   : $($activeJob.stage_message)"
        Write-Host ""
    }
} catch {}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
