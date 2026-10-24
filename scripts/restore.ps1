<#
.SYNOPSIS
  SMRITI Retail OS — Guarded Data Recovery CLI Tool
.DESCRIPTION
  Performs pre-restoration integrity validation, reviews affected entities,
  creates an automatic safety recovery snapshot, and restores business data.
.PARAMETER BackupId
  Identifier of the recovery point to restore (e.g. 'bak-xxx').
.PARAMETER Confirm
  Bypasses manual confirmation for automated testing or unattended recovery.
.PARAMETER ApiUrl
  Base URL of the FastAPI backend (Default: 'http://localhost:8000')
#>

[CmdletBinding()]
param (
    [string]$BackupId,
    [switch]$Confirm,
    [string]$ApiUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "         SMRITI Retail OS — Guarded Recovery Tool         " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host ""

# 1. Select or list backups
if (-not $BackupId) {
    Write-Host "[*] Fetching available recovery points..." -ForegroundColor Yellow
    try {
        $history = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/history" -Method Get -TimeoutSec 10
    } catch {
        Write-Host "[-] Error: Failed to reach SMRITI API at $ApiUrl." -ForegroundColor Red
        exit 1
    }

    if (-not $history -or $history.Count -eq 0) {
        Write-Host "[-] No verified recovery points found." -ForegroundColor Yellow
        exit 0
    }

    Write-Host ""
    Write-Host "Available Recovery Points:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $history.Count; $i++) {
        $b = $history[$i]
        Write-Host "  [$i] $($b.backup_id) | $($b.backup_time_pretty) | $($b.backup_size_pretty) | $($b.storage_location)"
    }
    Write-Host ""

    $choice = Read-Host "Select index to restore (0-$($history.Count - 1))"
    if ($choice -match '^\d+$' -and [int]$choice -lt $history.Count) {
        $BackupId = $history[[int]$choice].backup_id
    } else {
        Write-Host "[-] Invalid selection." -ForegroundColor Red
        exit 1
    }
}

# 2. Review Recovery Point
Write-Host "[1/2] Verifying package checksum and integrity..." -ForegroundColor Yellow
$reviewBody = @{ backup_id = $BackupId } | ConvertTo-Json

try {
    $review = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/restore/review" -Method Post -Body $reviewBody -ContentType "application/json"
} catch {
    Write-Host "[-] Pre-restoration integrity check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "  [+] Backup Verified      : $($review.backup.verification_status)" -ForegroundColor Green
Write-Host "  [+] Creation Timestamp   : $($review.backup.created_at)" -ForegroundColor Green
Write-Host "  [+] Archive Size         : $($review.backup.backup_size_pretty)" -ForegroundColor Green
Write-Host "  [+] Included Entities    : $($review.backup.data_included)" -ForegroundColor Green
Write-Host ""
Write-Host "  [!] WARNING: $($review.warning_title)" -ForegroundColor Yellow
Write-Host "  [!] $($review.warning_body)" -ForegroundColor Yellow
Write-Host "  [+] Automatic safety snapshot will be created before applying changes." -ForegroundColor Cyan
Write-Host ""

# 3. Explicit Destructive Confirmation
if (-not $Confirm) {
    Write-Host "Are you sure you want to restore this backup?" -ForegroundColor Red
    $resp = Read-Host "Type 'RESTORE' to confirm destructive overwrite"
    if ($resp -ne "RESTORE") {
        Write-Host "[*] Recovery aborted. No data was modified." -ForegroundColor Gray
        exit 0
    }
}

# 4. Execute Restore
Write-Host "[2/2] Restoring business data from verified package..." -ForegroundColor Yellow
$execBody = @{
    backup_id = $BackupId
    confirmed_destructive_overwrite = $true
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/restore/execute" -Method Post -Body $execBody -ContentType "application/json"
} catch {
    Write-Host "[-] Recovery execution failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  [+] $($result.message)" -ForegroundColor Green
Write-Host "  [+] Restored At       : $($result.restored_at)" -ForegroundColor White
Write-Host "  [+] Target Package    : $($result.backup_id)" -ForegroundColor White
Write-Host "  [+] Safety Snapshot   : $($result.pre_restore_backup_id)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
