# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

param(
    [int]$WebPort = 8101,
    [int]$ApiPort = 1981,
    [int]$DbPort = 2781
)

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " SMRITI Retail OS - Service Health Audit" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Container Status
Write-Host "`n[1/4] Docker Containers:" -ForegroundColor Yellow
docker compose ps

# 2. Database Connectivity
Write-Host "`n[2/4] PostgreSQL Probe (localhost:$DbPort):" -ForegroundColor Yellow
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $DbPort)
    $tcp.Close()
    Write-Host "  [OK] PostgreSQL port $DbPort is listening and accepting connections." -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Cannot connect to PostgreSQL on port $DbPort." -ForegroundColor Red
}

# 3. API Health
Write-Host "`n[3/4] API Health Probe (http://localhost:$ApiPort/health):" -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $res = Invoke-RestMethod -Uri "http://localhost:$ApiPort/health" -Method Get -TimeoutSec 5
    $sw.Stop()
    Write-Host "  [OK] API responded in $($sw.ElapsedMilliseconds)ms: status=$($res.status), database=$($res.database)" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] API health probe failed: $_" -ForegroundColor Red
}

# 4. Web Frontend
Write-Host "`n[4/4] Web Frontend Probe (http://localhost:$WebPort/):" -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $res = Invoke-WebRequest -Uri "http://localhost:$WebPort/" -Method Get -TimeoutSec 5 -UseBasicParsing
    $sw.Stop()
    Write-Host "  [OK] Web frontend responded HTTP $($res.StatusCode) in $($sw.ElapsedMilliseconds)ms." -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Web frontend probe failed: $_" -ForegroundColor Red
}

Write-Host "`n=====================================================================`n" -ForegroundColor Cyan
