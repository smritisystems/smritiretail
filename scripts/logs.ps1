<#
.SYNOPSIS
  SMRITI Retail OS — Backup Job Log Inspector & Streamer
.DESCRIPTION
  Retrieves and live-streams persistent structured logs for any backup job.
.PARAMETER JobId
  The backup job identifier (e.g. 'job-xxx'). If omitted, retrieves latest job.
.PARAMETER Tail
  Number of log entries to retrieve (Default: 50).
.PARAMETER Follow
  Continuously tail logs until job completes.
.PARAMETER ApiUrl
  Base URL of the FastAPI backend (Default: 'http://localhost:8000')
#>

[CmdletBinding()]
param (
    [string]$JobId,
    [int]$Tail = 50,
    [switch]$Follow,
    [string]$ApiUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

if (-not $JobId) {
    # Discover latest active or completed job
    try {
        $active = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/active-job" -Method Get -TimeoutSec 5
        if ($active) {
            $JobId = $active.job_id
        }
    } catch {}
}

if (-not $JobId) {
    Write-Host "[-] Error: Please specify a -JobId to inspect logs." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== SMRITI Backup Logs for Job: $JobId ===" -ForegroundColor Cyan
Write-Host ""

$seenCount = 0

try {
    do {
        try {
            $resp = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backup/jobs/$JobId/logs?tail=$Tail" -Method Get -TimeoutSec 5
            $logs = $resp.logs
            if ($logs.Count -gt $seenCount) {
                for ($i = $seenCount; $i -lt $logs.Count; $i++) {
                    $entry = $logs[$i]
                    $color = "Gray"
                    if ($entry.level -eq "SUCCESS") { $color = "Green" }
                    elseif ($entry.level -eq "WARN") { $color = "Yellow" }
                    elseif ($entry.level -eq "ERROR") { $color = "Red" }
                    Write-Host "[$($entry.timestamp)] [$($entry.level)] [$($entry.stage)] $($entry.message)" -ForegroundColor $color
                }
                $seenCount = $logs.Count
            }

            if ($resp.status -in @("SUCCESS", "FAILED", "CANCELLED", "INTERRUPTED", "completed", "failed")) {
                break
            }
        } catch {
            Write-Host "[-] Failed to fetch logs: $($_.Exception.Message)" -ForegroundColor Red
            break
        }

        if ($Follow) {
            Start-Sleep -Milliseconds 800
        }
    } while ($Follow)
} catch {
    Write-Host ""
}

Write-Host ""
