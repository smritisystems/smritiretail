<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise Cluster Status Dashboard
.DESCRIPTION
    Renders detailed status of Docker containers, health checks, ports, database connectivity, and HTTP endpoints.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File status.ps1
.NOTES
    Project      : SMRITI Retail OS
    Author       : Jawahar Ramkripal Mallah
    Designation  : Chief Systems Architect & Creator
    Email        : support@smritibooks.com
    Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
    Version      : 3.33.0
#>

$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
Set-Location $ScriptDir

Clear-Host
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "              SMRITI ENTERPRISE CLUSTER STATUS DASHBOARD             " -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "1. Docker Container Cluster Status:" -ForegroundColor Yellow
docker compose ps

Write-Host ""
Write-Host "2. Detailed Health Check Status:" -ForegroundColor Yellow
$Services = @("smriti-db", "smriti-api", "smriti-workspace")

foreach ($Svc in $Services) {
    try {
        $State = (docker inspect --format='{{json .State.Health.Status}}' $Svc 2>$null) -replace '"', ''
        if (-not $State) {
            $State = (docker inspect --format='{{json .State.Status}}' $Svc 2>$null) -replace '"', ''
        }
        
        if ($State -eq "healthy" -or $State -eq "running") {
            Write-Host "   • Container [$Svc] : " -NoNewline
            Write-Host "$State [HEALTHY]" -ForegroundColor Green
        } else {
            Write-Host "   • Container [$Svc] : " -NoNewline
            Write-Host "$State [UNHEALTHY/DOWN]" -ForegroundColor Red
        }
    } catch {
        Write-Host "   • Container [$Svc] : Not Found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. HTTP Endpoint Probes:" -ForegroundColor Yellow

# Test API
try {
    $Api = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 3
    Write-Host "   • Platform API Core (http://localhost:8000/health) : " -NoNewline
    Write-Host "HTTP 200 - Status: $($Api.status)" -ForegroundColor Green
} catch {
    Write-Host "   • Platform API Core (http://localhost:8000/health) : " -NoNewline
    Write-Host "UNAVAILABLE" -ForegroundColor Red
}

# Test Web
try {
    $Web = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec 3
    Write-Host "   • Retail Operations App (http://localhost:3000)  : " -NoNewline
    Write-Host "HTTP 200 - OK" -ForegroundColor Green
} catch {
    Write-Host "   • Retail Operations App (http://localhost:3000)  : " -NoNewline
    Write-Host "UNAVAILABLE" -ForegroundColor Red
}

Write-Host ""
