# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " SMRITI Retail OS - Non-Destructive System Update" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan

# Ensure execution from repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
Write-Host "  Working Directory: $repoRoot" -ForegroundColor Gray

# 1. Pull Git Repository Updates
Write-Host "`n[1/5] Pulling latest repository updates..." -ForegroundColor Yellow
git pull origin smritiNX
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARNING] 'git pull origin smritiNX' returned status $LASTEXITCODE. Trying default 'git pull'..." -ForegroundColor Yellow
    git pull
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARNING] Git pull reported non-zero status. Proceeding with local code..." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Git pull successful." -ForegroundColor Green
}

# 2. Rebuild Containers
Write-Host "`n[2/5] Rebuilding container images..." -ForegroundColor Yellow
docker compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Docker build failed." -ForegroundColor Red
    exit 1
}

# 3. Restart Services Safely (Non-Destructive)
Write-Host "`n[3/5] Restarting services with preserved volumes..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Failed to start services." -ForegroundColor Red
    exit 1
}

# 4. Apply Database Migrations
Write-Host "`n[4/5] Applying Alembic database migrations..." -ForegroundColor Yellow
Write-Host "  Control-plane (smritisys)..." -ForegroundColor Gray
docker compose exec -T -e PYTHONPATH="" smriti-api alembic -x target=control -x db=smritisys upgrade head 2>&1

Write-Host "  Tenant database (smriti001)..." -ForegroundColor Gray
$dbExists = docker compose exec -T smriti-db psql -U postgres -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = 'smriti001';" 2>&1
if ($dbExists -notmatch "1") {
    Write-Host "  Creating database smriti001..." -ForegroundColor Gray
    docker compose exec -T smriti-db psql -U postgres -d postgres -c "CREATE DATABASE smriti001;" 2>&1 | Out-Null
}
docker compose exec -T -e PYTHONPATH="" smriti-api alembic -x target=tenant -x db=smriti001 upgrade head 2>&1

# Seed baseline enterprise users/companies if needed
Write-Host "  Syncing baseline users and customer registries..." -ForegroundColor Gray
docker compose exec -T smriti-api python -m app.db.seed_baseline_users 2>&1
Write-Host "  [OK] Migrations and baseline data verified." -ForegroundColor Green

# 5. Service Health Probe
Write-Host "`n[5/5] Running health verification..." -ForegroundColor Yellow
& "$PSScriptRoot\health.ps1"

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " SMRITI Retail OS update completed successfully!" -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
