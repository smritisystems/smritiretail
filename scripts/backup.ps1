<#
.SYNOPSIS
  SMRITI Retail OS — Master Backup CLI Tool
.DESCRIPTION
  Initiates a verified system backup, monitors live progress, and streams structured logs.
.PARAMETER StorageLocation
  Destination type: 'local', 'gdrive', or 'onedrive' (Default: 'local')
.PARAMETER NonInteractive
  Bypasses interactive confirmation for automated cron/task execution.
.PARAMETER ApiUrl
  Base URL of the FastAPI backend (Default: 'http://localhost:8000')
.EXAMPLE
  .\scripts\backup.ps1
  .\scripts\backup.ps1 -StorageLocation local -NonInteractive
#>

[CmdletBinding()]
param (
    [string]$StorageLocation = "local",
    [switch]$NonInteractive,
    [string]$ApiUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

function Write-SmritiHeader {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "         SMRITI Retail OS — Master Backup Engine          " -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-SmritiHeader

# 1. Preflight Check
Write-Host "[1/3] Performing preflight storage and lock checks..." -ForegroundColor Yellow
try {
    $preflight = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/preflight" -Method Get -TimeoutSec 10
} catch {
    Write-Host "[-] Error: Failed to reach SMRITI API at $ApiUrl. Ensure FastAPI backend is running." -ForegroundColor Red
    exit 1
}

if (-not $preflight.passed) {
    Write-Host "[-] Preflight check failed: $($preflight.message)" -ForegroundColor Red
    exit 1
}

Write-Host "  [+] Free Disk Space      : $($preflight.free_space_pretty)" -ForegroundColor Green
Write-Host "  [+] Destination Path     : $($preflight.destination_path)" -ForegroundColor Green
Write-Host "  [+] Target Storage Mode  : $StorageLocation" -ForegroundColor Green
Write-Host ""

# 2. Confirmation
if (-not $NonInteractive) {
    Write-Host "Create System Backup?" -ForegroundColor Yellow
    Write-Host "This will create a backup of the configured SMRITI Retail OS databases,"
    Write-Host "application configuration, and required persistent files."
    Write-Host "Normal billing can continue consistently during the operation."
    Write-Host ""
    $confirm = Read-Host "Proceed with backup? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "[*] Backup cancelled by user." -ForegroundColor Gray
        exit 0
    }
    Write-Host ""
}

# 3. Trigger Backup Job
Write-Host "[2/3] Initiating asynchronous background backup..." -ForegroundColor Yellow
$body = @{
    storage_location = $StorageLocation
    include_files    = $true
} | ConvertTo-Json

try {
    $job = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/create" -Method Post -Body $body -ContentType "application/json"
} catch {
    Write-Host "[-] Error initiating backup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$jobId = $job.job_id
Write-Host "  [+] Backup Job Queued: $jobId" -ForegroundColor Green
Write-Host ""

# 4. Live Progress & Log Monitoring
Write-Host "[3/3] Monitoring live backup execution..." -ForegroundColor Yellow
$seenLogs = 0

try {
    while ($true) {
        $status = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/jobs/$jobId" -Method Get -TimeoutSec 5
        
        # Fetch incremental logs
        try {
            $logsResp = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/jobs/$jobId/logs?tail=100" -Method Get -TimeoutSec 5
            $allLogs = $logsResp.logs
            if ($allLogs.Count -gt $seenLogs) {
                for ($i = $seenLogs; $i -lt $allLogs.Count; $i++) {
                    $entry = $allLogs[$i]
                    $color = "Gray"
                    if ($entry.level -eq "SUCCESS") { $color = "Green" }
                    elseif ($entry.level -eq "WARN") { $color = "Yellow" }
                    elseif ($entry.level -eq "ERROR") { $color = "Red" }
                    Write-Host "  [$($entry.stage)] $($entry.message)" -ForegroundColor $color
                }
                $seenLogs = $allLogs.Count
            }
        } catch {}

        # Render stage and progress percentage
        Write-Progress -Activity "SMRITI Backup Execution ($($status.stage))" `
                       -Status "$($status.stage_message) [$($status.percent)%]" `
                       -PercentComplete $status.percent

        if ($status.status -eq "SUCCESS" -or $status.status -eq "completed") {
            Write-Progress -Activity "SMRITI Backup Execution" -Completed
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Green
            Write-Host "  [+] Backup completed and verified successfully!" -ForegroundColor Green
            Write-Host "  [+] Backup ID    : $($status.backup_result.backup_id)" -ForegroundColor White
            Write-Host "  [+] Archive Size : $($status.backup_result.backup_size_pretty)" -ForegroundColor White
            Write-Host "  [+] Destination  : $($status.backup_result.storage_location)" -ForegroundColor White
            Write-Host "  [+] SHA-256 Hash : $($status.backup_result.sha256_hash)" -ForegroundColor DarkGray
            Write-Host "==========================================================" -ForegroundColor Green
            exit 0
        }

        if ($status.status -eq "FAILED" -or $status.status -eq "CANCELLED" -or $status.status -eq "INTERRUPTED") {
            Write-Progress -Activity "SMRITI Backup Execution" -Completed
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Red
            Write-Host "  [-] Backup $($status.status): $($status.error_message)" -ForegroundColor Red
            Write-Host "  [-] Your previous verified recovery point was preserved." -ForegroundColor Yellow
            Write-Host "==========================================================" -ForegroundColor Red
            exit 1
        }

        Start-Sleep -Milliseconds 700
    }
} finally {
    Write-Progress -Activity "SMRITI Backup Execution" -Completed
}
