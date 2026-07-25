<#
.SYNOPSIS
    SMRITI Retail OS - Real-Time Container Log Streamer
.DESCRIPTION
    Streams real-time Docker container stdout/stderr logs.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File logs.ps1 -Service api
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
    [ValidateSet("all", "api", "workspace", "db")]
    [string]$Service = "all",
    [int]$Lines = 100,
    [switch]$NoFollow
)

$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
Set-Location $ScriptDir

Clear-Host
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "               SMRITI ENTERPRISE CONTAINER LOG VIEWER                " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

$FollowFlag = If ($NoFollow) { "" } Else { "-f" }

if ($Service -eq "all") {
    Write-Host "Streaming logs for ALL cluster services (Ctrl+C to stop)..." -ForegroundColor Cyan
    docker compose logs --tail $Lines $FollowFlag
} else {
    Write-Host "Streaming logs for service '$Service' (Ctrl+C to stop)..." -ForegroundColor Cyan
    docker compose logs --tail $Lines $FollowFlag $Service
}
