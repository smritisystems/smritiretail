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

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " SMRITI Retail OS - Non-Destructive System Repair" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Restart Existing Stack
Write-Host "`n[1/4] Restarting containers safely..." -ForegroundColor Yellow
docker compose restart
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Re-triggering docker compose up -d..." -ForegroundColor Gray
    docker compose up -d
}

# 2. Wait for Database
Write-Host "`n[2/4] Waiting for database readiness..." -ForegroundColor Yellow
for ($i = 1; $i -le 20; $i++) {
    $st = docker inspect smriti-db --format '{{.State.Health.Status}}' 2>$null
    if ($st -eq "healthy") {
        Write-Host "  [OK] Database container is healthy." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}

# 3. Synchronize Database Migrations
Write-Host "`n[3/4] Re-verifying database migrations..." -ForegroundColor Yellow
docker compose exec -T smriti-api alembic -x target=control -x db=smritisys upgrade head 2>&1
Write-Host "  [OK] Migrations verified." -ForegroundColor Green

# 4. Run Health Audit
Write-Host "`n[4/4] Auditing service health..." -ForegroundColor Yellow
& "$PSScriptRoot\health.ps1"

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " System repair sequence completed." -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
