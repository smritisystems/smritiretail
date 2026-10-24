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

# 4. Canonical Database Bootstrap Engine (Control + Multi-Tenant Migrations & Seeding)
Write-Host "`n[4/5] Executing SMRITI Canonical Database Bootstrap Engine..." -ForegroundColor Yellow
$bootstrapOutput = docker compose exec -T smriti-api python -m app.db.bootstrap_engine 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Canonical database bootstrap completed (control plane & tenant databases verified)." -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Database bootstrap failed." -ForegroundColor Red
    Write-Host ($bootstrapOutput | Out-String) -ForegroundColor Red
    exit 1
}

# 5. Service Health Probe
Write-Host "`n[5/5] Running health verification..." -ForegroundColor Yellow
& "$PSScriptRoot\health.ps1"

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " SMRITI Retail OS update completed successfully!" -ForegroundColor Green
Write-Host "=====================================================================`n" -ForegroundColor Green
