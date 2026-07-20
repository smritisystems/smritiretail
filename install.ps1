# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-13
# Modified     : 2026-07-13
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " SMRITI Retail OS - PowerShell One-Command Installer" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green

# 1. Check Prerequisites
Write-Host "[1/5] Verifying system prerequisites..." -ForegroundColor Yellow

$prereqs = @{
    "Git" = "git --version"
    "Node.js" = "node -v"
    "Python" = "python --version"
    "Docker" = "docker --version"
}

$missing = @()

foreach ($key in $prereqs.Keys) {
    $cmd = $prereqs[$key]
    try {
        $output = Invoke-Expression "$cmd 2>&1"
        Write-Host "  [OK] $key is installed ($output)" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] $key is NOT installed." -ForegroundColor Red
        $missing += $key
    }
}

if ($missing.Count -gt 0) {
    Write-Host "[WARNING] Missing prerequisites: $($missing -join ', ')." -ForegroundColor Red
    Write-Host "Please install them to ensure full functionality (Docker is highly recommended)." -ForegroundColor Yellow
}

# 2. Setup Environment Configuration File
Write-Host "[2/5] Setting up environment configuration (.env)..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  [OK] Created .env file from .env.example template." -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] .env.example template not found. Creating a default .env file..." -ForegroundColor Red
        $envContent = "PORT=3000`r`nBACKEND_API_PORT=8000`r`nPOSTGRES_USER=postgres`r`nPOSTGRES_PASSWORD=postgres`r`nPOSTGRES_DB=smriti_retail_db`r`nDATABASE_PROVIDER=postgres"
        Set-Content -Path ".env" -Value $envContent
        Write-Host "  [OK] Created default .env file." -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] .env file already exists. Skipping copy." -ForegroundColor Green
}

# 3. Create Python Virtual Environment & Install Backend Dependencies
Write-Host "[3/5] Setting up Python virtual environment and dependencies..." -ForegroundColor Yellow

# Find the best Python executable (preferring Python 3.10-3.12 over pre-release versions like 3.14)
$pythonExe = "python"
$wherePaths = where.exe python 2>$null
$pythonCandidates = @()
if ($wherePaths) {
    foreach ($p in $wherePaths) {
        if ($p -match "WindowsApps") { continue }
        $pythonCandidates += $p
    }
}
$stdPath = "C:\Users\netma\AppData\Local\Programs\Python\Python311\python.exe"
if (Test-Path $stdPath) {
    $pythonCandidates += $stdPath
}

# Select the best python path
foreach ($p in $pythonCandidates) {
    try {
        $verInfo = & $p --version 2>&1
        if ($verInfo -match "Python 3\.(10|11|12)") {
            $pythonExe = $p
            Write-Host "  Found preferred Python interpreter: $p ($verInfo)" -ForegroundColor Green
            break
        }
    } catch {}
}

if ($pythonExe -eq "python") {
    Write-Host "  Using default python interpreter from PATH." -ForegroundColor Gray
}

$recreateVenv = $false
if (Test-Path ".venv") {
    if (Test-Path ".venv\Scripts\python.exe") {
        try {
            $venvVer = & .venv\Scripts\python.exe --version 2>&1
            if ($venvVer -match "Python 3\.14") {
                Write-Host "  Existing .venv is built with unsupported Python 3.14. Re-creating..." -ForegroundColor Yellow
                $recreateVenv = $true
            }
        } catch {
            $recreateVenv = $true
        }
    } else {
        $recreateVenv = $true
    }
}

if ($recreateVenv) {
    Write-Host "  Removing old .venv..." -ForegroundColor Gray
    Remove-Item -Path ".venv" -Recurse -Force
}

if (-not (Test-Path ".venv")) {
    try {
        Write-Host "  Creating virtual environment (.venv) using $pythonExe..." -ForegroundColor Gray
        & $pythonExe -m venv .venv
        Write-Host "  [OK] Virtual environment created." -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] Failed to create virtual environment." -ForegroundColor Red
    }
} else {
    Write-Host "  [OK] Virtual environment (.venv) already exists." -ForegroundColor Green
}

if (Test-Path ".venv\Scripts\pip.exe") {
    try {
        Write-Host "  Installing Python dependencies (backend\requirements.txt)..." -ForegroundColor Gray
        & .venv\Scripts\pip install --upgrade pip
        & .venv\Scripts\pip install -r backend\requirements.txt
        Write-Host "  [OK] Python dependencies installed successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] Failed to install Python dependencies." -ForegroundColor Red
    }
} else {
    Write-Host "  [SKIP] Python pip.exe not found. Virtual environment might be corrupt." -ForegroundColor Red
}

# 4. Install Node.js Frontend Dependencies
Write-Host "[4/5] Installing frontend Node.js dependencies..." -ForegroundColor Yellow
try {
    Write-Host "  Running npm install..." -ForegroundColor Gray
    npm install
    Write-Host "  [OK] Node.js dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Failed to install Node.js dependencies." -ForegroundColor Red
}

# 5. Configure Visual Folder Branding
Write-Host "[5/5] Configuring Explorer visual folder icon (GREEN)..." -ForegroundColor Yellow

try {
    $iniPath = Join-Path (Get-Location) "desktop.ini"
    
    # Remove hidden/system attributes if file exists to overwrite it
    if (Test-Path $iniPath) {
        attrib -h -s $iniPath
    }
    
    $iniContent = "[.ShellClassInfo]`r`nIconResource=%SystemRoot%\System32\imageres.dll,85`r`nConfirmFileOp=0"
    Set-Content -Path $iniPath -Value $iniContent -Encoding Ascii
    
    # Hide and protect desktop.ini
    attrib +h +s $iniPath
    
    # Set directory attribute to Read-Only so Windows loads desktop.ini
    attrib +r (Get-Location)
    
    Write-Host "  [OK] Configured folder icon to SMRITI visual green indicator (GREEN)." -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Failed to configure Explorer folder icon." -ForegroundColor Red
}

Write-Host "======================================================================" -ForegroundColor Green
Write-Host " SMRITI Retail OS installation complete!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green

# 6. Run Database Migrations & Seed Default Data
Write-Host "[6/6] Running database migrations and seeding default accounts..." -ForegroundColor Yellow
Write-Host "  NOTE: PostgreSQL must be running for this step to succeed." -ForegroundColor Gray
Write-Host "        If PostgreSQL is not running, skip this and run manually later:" -ForegroundColor Gray
Write-Host "        .venv\Scripts\python.exe -m alembic upgrade head" -ForegroundColor Gray
Write-Host "        .venv\Scripts\python.exe -m app.db.seed" -ForegroundColor Gray

if (Test-Path ".venv\Scripts\python.exe") {
    try {
        Set-Location backend
        & ..\\.venv\Scripts\python.exe -m alembic upgrade head
        & ..\\.venv\Scripts\python.exe -m app.db.seed
        Set-Location ..
        Write-Host "  [OK] Database migrations and seed completed successfully." -ForegroundColor Green
        Write-Host "" -ForegroundColor Green
        Write-Host "  Default login accounts created:" -ForegroundColor Cyan
        Write-Host "    Username: super     Password: Smriti@1234   Role: System Admin" -ForegroundColor Cyan
        Write-Host "    Username: manager   Password: Password@123  Role: Store Manager" -ForegroundColor Cyan
        Write-Host "    Username: cashier   Password: Cashier@1234  Role: POS Cashier" -ForegroundColor Cyan
    } catch {
        Set-Location ..
        Write-Host "  [SKIP] Database seed could not run — PostgreSQL may not be running." -ForegroundColor Yellow
        Write-Host "         Run manually after starting PostgreSQL:" -ForegroundColor Yellow
        Write-Host "         cd backend && ..\\.venv\Scripts\python.exe -m alembic upgrade head && ..\\.venv\Scripts\python.exe -m app.db.seed" -ForegroundColor Gray
    }
} else {
    Write-Host "  [SKIP] Python venv not found. Run seed manually after setup." -ForegroundColor Yellow
}

Write-Host "" -ForegroundColor Green
Write-Host "To launch SMRITI Retail OS:" -ForegroundColor Yellow
Write-Host "  Run: .\\startup.bat (or docker compose up -d)" -ForegroundColor Gray
Write-Host "  Access Frontend : http://localhost:3000" -ForegroundColor Gray
Write-Host "  Access Backend  : http://localhost:8000" -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Green
