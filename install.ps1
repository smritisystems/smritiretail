# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-13
# Modified     : 2026-09-23
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

param (
    [string]$Mode = "",
    [switch]$NonInteractive = $false,
    [switch]$SkipBrowser = $false,
    [switch]$FreshInstall = $false,
    [string]$VolumeName = ""
)

$ErrorActionPreference = "Continue"

function Write-Banner {
    Write-Host "=====================================================================" -ForegroundColor Cyan
    Write-Host "       SMRITI RETAIL OS - PRODUCTION-GRADE INSTALLER                 " -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Step, [string]$Title)
    Write-Host "`n[$Step] $Title..." -ForegroundColor Yellow
}

function New-SecureKey {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return ($bytes | ForEach-Object { "{0:x2}" -f $_ }) -join ''
}

function Update-EnvKey {
    param(
        [string]$FilePath,
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $FilePath)) { return }
    $lines = Get-Content $FilePath
    $found = $false
    $output = @()
    foreach ($line in $lines) {
        if ($line -match "^\s*#") {
            $output += $line
        } elseif ($line -match "^\s*$Key\s*=\s*(.*)") {
            $found = $true
            $val = $matches[1].Trim().Trim('"').Trim("'")
            if ([string]::IsNullOrWhiteSpace($val)) {
                $output += "$Key=$Value"
                Write-Host "  [OK] Injected secure $Key into $FilePath." -ForegroundColor Green
            } else {
                $output += $line
            }
        } else {
            $output += $line
        }
    }
    if (-not $found) {
        $output += "$Key=$Value"
        Write-Host "  [OK] Added secure $Key to $FilePath." -ForegroundColor Green
    }
    Set-Content -Path $FilePath -Value $output
}

function Test-PortOccupied {
    param([int]$Port)
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $false
    } catch {
        return $true
    }
}

function Show-ErrorDiagnostics {
    param(
        [Alias("FailedStep")]
        [string]$StepName = "Unknown Step",
        [Alias("Details")]
        [string]$ErrorMessage = "",
        [Alias("ErrorDetails")]
        [string]$CommandOutput = "",
        [string]$Command = ""
    )
    Write-Host ""
    Write-Host "=====================================================================" -ForegroundColor Red
    Write-Host " [ERROR OCCURRED DURING INSTALLATION] - DIAGNOSTIC LOG DUMP" -ForegroundColor Red
    Write-Host "=====================================================================" -ForegroundColor Red
    Write-Host " Failed Step : $StepName" -ForegroundColor Yellow
    if ($Command) {
        Write-Host " Command     : $Command" -ForegroundColor Yellow
    }
    if ($ErrorMessage) {
        Write-Host " Details     : $ErrorMessage" -ForegroundColor Yellow
    }
    Write-Host " Timestamp   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "---------------------------------------------------------------------" -ForegroundColor Red

    if ($CommandOutput) {
        Write-Host "`n--- Command Output / Error Traceback ---" -ForegroundColor White
        Write-Host $CommandOutput -ForegroundColor Red
    }

    Write-Host "`n--- Recent Container Logs (Last 60 lines) ---" -ForegroundColor White
    try {
        $recentLogs = docker compose -f $composeFile logs --tail=60 2>&1 | Out-String
        Write-Host $recentLogs -ForegroundColor DarkYellow
    } catch {
        Write-Host "  Could not retrieve container logs: $_" -ForegroundColor DarkGray
    }

    Write-Host "`n--- Container Statuses ---" -ForegroundColor White
    try {
        docker compose -f $composeFile ps
    } catch {}

    try {
        $logPath = "install_error.log"
        $logContent = @"
=====================================================================
SMRITI INSTALLATION ERROR LOG - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Failed Step : $StepName
Details     : $ErrorMessage
=====================================================================
COMMAND OUTPUT:
$CommandOutput

DOCKER COMPOSE LOGS:
$recentLogs
=====================================================================
"@
        Set-Content -Path $logPath -Value $logContent -Force
        Write-Host "`n Full diagnostic report saved to: $logPath" -ForegroundColor Cyan
    } catch {}

    Write-Host "=====================================================================" -ForegroundColor Red
    Write-Host " Select and copy the red error text / logs above to resolve the issue." -ForegroundColor Yellow
    Write-Host "=====================================================================`n" -ForegroundColor Red
}

# -----------------------------------------------------------------------------
# 1. OS & Hardware Architecture Detection
# -----------------------------------------------------------------------------
Write-Banner
Write-Section "1/7" "Detecting Operating System and Architecture"

$osName = (Get-CimInstance Win32_OperatingSystem).Caption
$osArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Write-Host "  Operating System : $osName" -ForegroundColor Gray
Write-Host "  Architecture     : $osArch" -ForegroundColor Gray
Write-Host "  Working Directory: $(Get-Location)" -ForegroundColor Gray

# -----------------------------------------------------------------------------
# 2. Prerequisite Checks
# -----------------------------------------------------------------------------
Write-Section "2/7" "Verifying System Prerequisites"

# Git CLI
try {
    $gitVer = (git --version 2>&1).Trim()
    Write-Host "  [OK] Git: $gitVer" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Git CLI is not found in PATH." -ForegroundColor Red
    Write-Host "  Please install Git: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Docker CLI
try {
    $dockerVer = (docker --version 2>&1).Trim()
    Write-Host "  [OK] Docker CLI: $dockerVer" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Docker CLI is not found." -ForegroundColor Red
    Write-Host "  Docker Desktop is required to run SMRITI Retail OS." -ForegroundColor Yellow
    Write-Host "  Download Docker Desktop for Windows:" -ForegroundColor Cyan
    Write-Host "  https://docs.docker.com/desktop/setup/install/windows-install/" -ForegroundColor White
    exit 1
}

# Docker Engine Daemon
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw $dockerInfo
    }
    Write-Host "  [OK] Docker Engine is running and responsive." -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Docker daemon is not running or not responsive." -ForegroundColor Red
    Write-Host "  Please ensure Docker Desktop is started and ready before continuing." -ForegroundColor Yellow
    Write-Host "  Official Docker setup: https://docs.docker.com/desktop/setup/install/windows-install/" -ForegroundColor Cyan
    exit 1
}

# Docker Compose CLI
try {
    $composeVer = (docker compose version 2>&1).Trim()
    Write-Host "  [OK] Docker Compose: $composeVer" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Docker Compose v2 is required." -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# 3. Installation Mode Selection
# -----------------------------------------------------------------------------
Write-Section "3/7" "Selecting Installation Mode"

$selectedMode = $Mode
$doFreshInstall = $FreshInstall

if (-not $selectedMode -and -not $NonInteractive) {
    Write-Host "Select installation mode:`n" -ForegroundColor White
    Write-Host "  [1] Production" -ForegroundColor Green
    Write-Host "      Stable customer runtime (Ports 2781:5432, 1981:8000, 8101:3000)`n" -ForegroundColor Gray
    Write-Host "  [2] Development" -ForegroundColor Cyan
    Write-Host "      Developer runtime with hot reload (Ports 2782:5432, 1982:8000, 8102:3000)`n" -ForegroundColor Gray
    Write-Host "  [3] Custom / Advanced" -ForegroundColor Magenta
    Write-Host "      Custom host port mappings and options`n" -ForegroundColor Gray
    Write-Host "  [4] Fresh Install (Clean Slate)" -ForegroundColor Red
    Write-Host "      Drops all volumes + rebuilds from scratch (use on new/broken machines)`n" -ForegroundColor Gray

    $choice = Read-Host "Enter choice [1-4] (Default: 1)"
    if ($choice -eq "2") {
        $selectedMode = "Development"
    } elseif ($choice -eq "3") {
        $selectedMode = "Custom"
    } elseif ($choice -eq "4") {
        $selectedMode = "Production"
        $doFreshInstall = $true
    } else {
        $selectedMode = "Production"
    }
} elseif (-not $selectedMode) {
    $selectedMode = "Production"
}

Write-Host "  Selected Mode: $selectedMode$(if ($doFreshInstall) { ' [FRESH INSTALL - volumes will be wiped]' })" -ForegroundColor Green

# Configure Ports & Compose Files based on selected mode
$composeFile = "docker-compose.yml"
$pgPort = 2781
$apiPort = 1981
$webPort = 8101
$dbContainer = "smriti-db"
$apiContainer = "smriti-api"
$webContainer = "smriti-web"
$dbName = "smritisys"

if ($selectedMode -eq "Development") {
    $composeFile = "docker-compose.dev.yml"
    $pgPort = 2782
    $apiPort = 1982
    $webPort = 8102
    $dbContainer = "smriti-dev-db"
    $apiContainer = "smriti-dev-api"
    $webContainer = "smriti-dev-web"
    $dbName = "smritisys_dev"
} elseif ($selectedMode -eq "Custom") {
    if (-not $NonInteractive) {
        $inWeb = Read-Host "Enter Web host port (Default: 8101)"
        if ($inWeb) { $webPort = [int]$inWeb }
        $inApi = Read-Host "Enter API host port (Default: 1981)"
        if ($inApi) { $apiPort = [int]$inApi }
        $inPg = Read-Host "Enter PostgreSQL host port (Default: 2781)"
        if ($inPg) { $pgPort = [int]$inPg }
    }
}

# -----------------------------------------------------------------------------
# 4. Port Conflict Probing
# -----------------------------------------------------------------------------
Write-Section "4/7" "Verifying Port Availability"

# Check if containers are already running (in which case the ports belong to SMRITI)
$activeContainers = @(docker ps --format "{{.Names}}" 2>$null)

$portsToCheck = @(
    @{ Name = "Web Frontend"; Port = $webPort; Container = $webContainer },
    @{ Name = "API Backend";  Port = $apiPort; Container = $apiContainer },
    @{ Name = "PostgreSQL";   Port = $pgPort;  Container = $dbContainer }
)

foreach ($entry in $portsToCheck) {
    $port = $entry.Port
    $name = $entry.Name
    $targetCont = $entry.Container
    
    $isOccupied = Test-PortOccupied -Port $port
    if ($isOccupied) {
        if ($activeContainers -contains $targetCont) {
            Write-Host "  [OK] Port $port is in use by running container '$targetCont' (will be reused/updated)." -ForegroundColor Green
        } else {
            Write-Host "  [CONFLICT] Port $port ($name) is currently occupied by an external process." -ForegroundColor Red
            Write-Host "  Please stop the conflicting process or choose Custom mode to assign a different port." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  [OK] Port $port ($name) is available." -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# 5. Environment Configuration
# -----------------------------------------------------------------------------
Write-Section "5/7" "Configuring Environment (.env)"

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "  [OK] Initialized .env from .env.example." -ForegroundColor Green
    } else {
        New-Item -ItemType File -Path ".env" -Force | Out-Null
        Write-Host "  [OK] Created clean .env." -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] Existing .env file detected -- preserving all user settings." -ForegroundColor Green
}

# Ensure critical secrets are populated and valid (never empty or quotes-only)
Update-EnvKey -FilePath ".env" -Key "JWT_SECRET_KEY" -Value (New-SecureKey)
Update-EnvKey -FilePath ".env" -Key "INTERNAL_SERVICE_KEY" -Value (New-SecureKey)
Update-EnvKey -FilePath ".env" -Key "SGIP_VAULT_MASTER_KEY" -Value (New-SecureKey)

# Export all .env variables directly into process environment for Docker Compose
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)") {
        $k = $matches[1]
        $v = $matches[2].Trim().Trim('"').Trim("'")
        if (-not [string]::IsNullOrWhiteSpace($k)) {
            [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
        }
    }
}

# Export port overrides to environment
$env:PORT = "$webPort"
$env:BACKEND_API_PORT = "$apiPort"
$env:POSTGRES_PORT = "$pgPort"
if ($VolumeName) {
    $env:POSTGRES_VOLUME_NAME = "$VolumeName"
    Write-Host "  [OK] Isolated PostgreSQL volume active: $VolumeName" -ForegroundColor Cyan
}

# -----------------------------------------------------------------------------
# 5.5  Company / Business Profile Setup
# -----------------------------------------------------------------------------
Write-Section "5.5/7" "Business Profile Setup"

# Null-safe helper: read a key's value from .env, returns "" if missing or empty
function Get-EnvValue {
    param([string]$FilePath, [string]$Key)
    if (-not (Test-Path $FilePath)) { return "" }
    $line = Get-Content $FilePath -ErrorAction SilentlyContinue |
            Where-Object { $_ -match "^\s*${Key}\s*=\s*(.+)" } |
            Select-Object -First 1
    if ($line -and $line -match "^\s*${Key}\s*=\s*(.+)") {
        return $matches[1].Trim().Trim('"').Trim("'")
    }
    return ""
}

$existingCompanyName = Get-EnvValue -FilePath ".env" -Key "SMRITI_COMPANY_NAME"

if ($existingCompanyName.Length -gt 0 -and -not $doFreshInstall) {
    Write-Host "  [OK] Business profile already configured in .env  -- skipping." -ForegroundColor Green
    Write-Host "       Company: $existingCompanyName" -ForegroundColor Gray
    # Re-export for seed step
    $env:SMRITI_COMPANY_NAME   = $existingCompanyName
    $env:SMRITI_COMPANY_CODE   = Get-EnvValue -FilePath ".env" -Key "SMRITI_COMPANY_CODE"
    $env:SMRITI_COMPANY_GST    = Get-EnvValue -FilePath ".env" -Key "SMRITI_COMPANY_GST"
    $env:SMRITI_BRANCH_NAME    = Get-EnvValue -FilePath ".env" -Key "SMRITI_BRANCH_NAME"
    $env:SMRITI_BRANCH_CODE    = Get-EnvValue -FilePath ".env" -Key "SMRITI_BRANCH_CODE"
    $env:SMRITI_ADMIN_USERNAME = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_USERNAME"
    $env:SMRITI_ADMIN_EMAIL    = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_EMAIL"
    $env:SMRITI_ADMIN_PASSWORD = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_PASSWORD"
} else {
    Write-Host ""
    Write-Host "  Please enter your business information." -ForegroundColor White
    Write-Host "  (Press ENTER to keep the default value shown in brackets)`n" -ForegroundColor Gray

    $defCompanyName = if ($existingCompanyName) { $existingCompanyName } else { "My Retail Store" }
    $defCompanyCode = Get-EnvValue -FilePath ".env" -Key "SMRITI_COMPANY_CODE"
    if (-not $defCompanyCode) { $defCompanyCode = "MYSTORE" }
    $defCompanyGst  = Get-EnvValue -FilePath ".env" -Key "SMRITI_COMPANY_GST"
    $defBranchName  = Get-EnvValue -FilePath ".env" -Key "SMRITI_BRANCH_NAME"
    if (-not $defBranchName) { $defBranchName = "Main Branch" }
    $defBranchCode  = Get-EnvValue -FilePath ".env" -Key "SMRITI_BRANCH_CODE"
    if (-not $defBranchCode) { $defBranchCode = "MAIN" }
    $defAdminUser   = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_USERNAME"
    if (-not $defAdminUser) { $defAdminUser = "admin" }
    $defAdminEmail  = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_EMAIL"
    if (-not $defAdminEmail) { $defAdminEmail = "admin@mystore.com" }
    $defAdminPwd    = Get-EnvValue -FilePath ".env" -Key "SMRITI_ADMIN_PASSWORD"
    if (-not $defAdminPwd) { $defAdminPwd = "Admin@123" }

    if ($NonInteractive) {
        $companyName = $defCompanyName
        $companyCode = $defCompanyCode
        $companyGst  = $defCompanyGst
        $branchName  = $defBranchName
        $branchCode  = $defBranchCode
        $adminUsername = $defAdminUser
        $adminEmail  = $defAdminEmail
        $adminPwd    = $defAdminPwd
        Write-Host "  [Non-Interactive] Using default business profile:" -ForegroundColor Cyan
        Write-Host "    Company: $companyName ($companyCode), Branch: $branchName ($branchCode), Admin: $adminUsername" -ForegroundColor Gray
    } else {
        $companyName = (Read-Host "  Company / Business Name [$defCompanyName]").Trim()
        if (-not $companyName) { $companyName = $defCompanyName }

        $companyCode = (Read-Host "  Company Short Code (letters/numbers only, no spaces) [$defCompanyCode]").Trim() -replace '\s+',''
        if (-not $companyCode) { $companyCode = $defCompanyCode }

        $companyGst = (Read-Host "  GST Number (leave blank if not applicable) [$defCompanyGst]").Trim()
        if (-not $companyGst -and $defCompanyGst) { $companyGst = $defCompanyGst }

        $branchName = (Read-Host "  Main Branch Name [$defBranchName]").Trim()
        if (-not $branchName) { $branchName = $defBranchName }

        $branchCode = (Read-Host "  Main Branch Code (letters/numbers only) [$defBranchCode]").Trim() -replace '\s+',''
        if (-not $branchCode) { $branchCode = $defBranchCode }

        Write-Host ""
        Write-Host "  --- Admin Account ---" -ForegroundColor Cyan
        $adminUsername = (Read-Host "  Admin Username [$defAdminUser]").Trim()
        if (-not $adminUsername) { $adminUsername = $defAdminUser }

        $adminEmail = (Read-Host "  Admin Email [$defAdminEmail]").Trim()
        if (-not $adminEmail) { $adminEmail = $defAdminEmail }

        $adminPwd = (Read-Host "  Admin Password [$defAdminPwd]").Trim()
        if (-not $adminPwd) { $adminPwd = $defAdminPwd }
    }

    # Save to .env
    Update-EnvKey -FilePath ".env" -Key "SMRITI_COMPANY_NAME"  -Value $companyName
    Update-EnvKey -FilePath ".env" -Key "SMRITI_COMPANY_CODE"  -Value $companyCode
    Update-EnvKey -FilePath ".env" -Key "SMRITI_COMPANY_GST"   -Value $companyGst
    Update-EnvKey -FilePath ".env" -Key "SMRITI_BRANCH_NAME"   -Value $branchName
    Update-EnvKey -FilePath ".env" -Key "SMRITI_BRANCH_CODE"   -Value $branchCode
    Update-EnvKey -FilePath ".env" -Key "SMRITI_ADMIN_USERNAME" -Value $adminUsername
    Update-EnvKey -FilePath ".env" -Key "SMRITI_ADMIN_EMAIL"    -Value $adminEmail
    Update-EnvKey -FilePath ".env" -Key "SMRITI_ADMIN_PASSWORD" -Value $adminPwd

    # Export to current process so seed picks them up via docker exec -e
    $env:SMRITI_COMPANY_NAME   = $companyName
    $env:SMRITI_COMPANY_CODE   = $companyCode
    $env:SMRITI_COMPANY_GST    = $companyGst
    $env:SMRITI_BRANCH_NAME    = $branchName
    $env:SMRITI_BRANCH_CODE    = $branchCode
    $env:SMRITI_ADMIN_USERNAME = $adminUsername
    $env:SMRITI_ADMIN_EMAIL    = $adminEmail
    $env:SMRITI_ADMIN_PASSWORD = $adminPwd

    Write-Host ""
    Write-Host "  [OK] Business profile saved:" -ForegroundColor Green
    Write-Host "       Company : $companyName ($companyCode)" -ForegroundColor Cyan
    Write-Host "       Branch  : $branchName ($branchCode)" -ForegroundColor Cyan
    Write-Host "       Admin   : $adminUsername / $adminEmail" -ForegroundColor Cyan
}

# -----------------------------------------------------------------------------
# 6. Docker Build & Startup
# -----------------------------------------------------------------------------
Write-Section "6/7" "Building and Starting SMRITI Retail OS Stack"

# Fresh Install: wipe existing volumes for a completely clean database
if ($doFreshInstall) {
    Write-Host "`n  [FRESH INSTALL] Stopping any running containers and removing volumes..." -ForegroundColor Red
    docker compose -f $composeFile down -v --remove-orphans
    Write-Host "  [OK] Old containers and volumes removed. Starting with a clean slate." -ForegroundColor Green
} else {
    # Gracefully stop without removing volumes (preserves existing data)
    docker compose -f $composeFile down --remove-orphans
    Write-Host "  [OK] Previous containers stopped (data volumes preserved)." -ForegroundColor Green
}

Write-Host "  Building required images using $composeFile..." -ForegroundColor Gray
docker compose -f $composeFile build
if ($LASTEXITCODE -ne 0) {
    Show-ErrorDiagnostics -StepName "Docker Image Build" -ErrorMessage "docker compose build failed with exit code $LASTEXITCODE."
    exit 1
}
Write-Host "  [OK] Images built successfully." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 7. Database Readiness, Bootstrap Engine & Service Verification
# -----------------------------------------------------------------------------
Write-Section "7/7" "Validating Database Readiness, Bootstrap Engine, and Service Health"

Write-Host "  Starting PostgreSQL database container ($dbContainer)..." -ForegroundColor Gray
docker compose -f $composeFile up -d $dbContainer
if ($LASTEXITCODE -ne 0) {
    Show-ErrorDiagnostics -StepName "Start Database Container" -ErrorMessage "Failed to start database container $dbContainer."
    exit 1
}

Write-Host "  Waiting for PostgreSQL database container ($dbContainer) to become healthy..." -ForegroundColor Gray
$dbReady = $false
for ($i = 1; $i -le 30; $i++) {
    $status = docker inspect $dbContainer --format '{{.State.Health.Status}}' 2>$null
    if ($status -eq "healthy") {
        $dbReady = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $dbReady) {
    Write-Host "  [WARNING] Database container took longer than expected to report healthy." -ForegroundColor Yellow
    Write-Host "`n--- PostgreSQL Container Logs (last 30 lines) ---" -ForegroundColor White
    $dbLogs = docker logs $dbContainer --tail=30 2>&1 | Out-String
    Write-Host $dbLogs -ForegroundColor Red
} else {
    Write-Host "  [OK] PostgreSQL database is healthy and ready for queries." -ForegroundColor Green
}

# Start API Backend container (suppress background migrations during explicit installer execution)
Write-Host "  Starting API backend container ($apiContainer)..." -ForegroundColor Gray
$prevSkip = $env:SKIP_MIGRATIONS
$env:SKIP_MIGRATIONS = "true"
docker compose -f $composeFile up -d $apiContainer
$env:SKIP_MIGRATIONS = $prevSkip
if ($LASTEXITCODE -ne 0) {
    Show-ErrorDiagnostics -StepName "Start API Container" -ErrorMessage "Failed to start API container $apiContainer."
    exit 1
}

# Execute Canonical Database Bootstrap Engine (Rule 4)
Write-Host "  Executing SMRITI Canonical Database Bootstrap Engine..." -ForegroundColor Gray
$bootstrapOutput = docker compose -f $composeFile exec -T `
    -e SMRITI_COMPANY_NAME="$env:SMRITI_COMPANY_NAME" `
    -e SMRITI_COMPANY_CODE="$env:SMRITI_COMPANY_CODE" `
    -e SMRITI_COMPANY_GST="$env:SMRITI_COMPANY_GST" `
    -e SMRITI_BRANCH_NAME="$env:SMRITI_BRANCH_NAME" `
    -e SMRITI_BRANCH_CODE="$env:SMRITI_BRANCH_CODE" `
    -e SMRITI_ADMIN_USERNAME="$env:SMRITI_ADMIN_USERNAME" `
    -e SMRITI_ADMIN_EMAIL="$env:SMRITI_ADMIN_EMAIL" `
    -e SMRITI_ADMIN_PASSWORD="$env:SMRITI_ADMIN_PASSWORD" `
    $apiContainer python -m app.db.bootstrap_engine 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Canonical database bootstrap completed (control plane & tenant databases provisioned)." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Database bootstrap failed with exit code $LASTEXITCODE." -ForegroundColor Red
    Show-ErrorDiagnostics -StepName "Database Bootstrap Engine" -Command "python -m app.db.bootstrap_engine" -CommandOutput ($bootstrapOutput | Out-String)
    exit 1
}

# Start remaining stack services (Web Frontend, etc.)
Write-Host "  Starting remaining services (docker compose up -d)..." -ForegroundColor Gray
docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    Show-ErrorDiagnostics -StepName "Docker Service Startup" -ErrorMessage "docker compose up -d failed with exit code $LASTEXITCODE."
    exit 1
}
Write-Host "  [OK] All containers started." -ForegroundColor Green

# Probe API Health
Write-Host "  Checking API health on http://localhost:$apiPort/health..." -ForegroundColor Gray
$apiHealthy = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:$apiPort/health" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp -and ($resp.status -eq "healthy" -or $resp.service -eq "operational")) {
            $apiHealthy = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

if ($apiHealthy) {
    Write-Host "  [OK] API is healthy and connected to database." -ForegroundColor Green
} else {
    Write-Host "  [WARNING] API health endpoint has not yet responded." -ForegroundColor Yellow
    Write-Host "`n--- smriti-api Container Logs (last 40 lines) ---" -ForegroundColor White
    $apiLogs = docker logs $apiContainer --tail=40 2>&1 | Out-String
    Write-Host $apiLogs -ForegroundColor Red
}

# Probe Web Frontend
Write-Host "  Checking Web frontend on http://localhost:$webPort/..." -ForegroundColor Gray
$webHealthy = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$webPort/" -Method Get -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $webHealthy = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
}

if ($webHealthy) {
    Write-Host "  [OK] Web frontend is live and responding (HTTP 200)." -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Web frontend has not yet responded with HTTP 200." -ForegroundColor Yellow
    Write-Host "`n--- smriti-web Container Logs (last 40 lines) ---" -ForegroundColor White
    $webLogs = docker logs $webContainer --tail=40 2>&1 | Out-String
    Write-Host $webLogs -ForegroundColor Red
}

# Run Official Installation Verification (Rule 8)
Write-Host "`n  Running Official Installation & Database Topology Verification..." -ForegroundColor Gray
$verifyOutput = docker compose -f $composeFile exec -T $apiContainer python /workspace/backend/tools/verify_installation.py --api-url "http://localhost:8000" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Installation verification PASSED (topology, routing, and operational APIs verified)." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Installation verification FAILED." -ForegroundColor Red
    Write-Host ($verifyOutput | Out-String) -ForegroundColor Red
    Show-ErrorDiagnostics -StepName "Installation Verification" -ErrorMessage "verify_installation.py detected failure in topology, routing, or APIs." -CommandOutput ($verifyOutput | Out-String)
    exit 1
}

# Display Container Status Table
Write-Host "`nActive Containers:" -ForegroundColor White
docker compose -f $composeFile ps

# Automatically launch default browser if requested
if (-not $SkipBrowser) {
    try {
        Start-Process "http://localhost:$webPort"
    } catch {
        Write-Host "  Could not automatically launch browser." -ForegroundColor Gray
    }
}

# -----------------------------------------------------------------------------
# Completion Summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " SMRITI RETAIL OS INSTALLATION COMPLETE AND READY!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "  Mode            : $selectedMode" -ForegroundColor Cyan
Write-Host "  Web Frontend    : http://localhost:$webPort" -ForegroundColor Cyan
Write-Host "  API Backend     : http://localhost:$apiPort" -ForegroundColor Cyan
Write-Host "  PostgreSQL DB   : localhost:$pgPort" -ForegroundColor Cyan
Write-Host "  API Docs        : http://localhost:$apiPort/docs" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "Management Commands:" -ForegroundColor Yellow
Write-Host "  Stop Stack      : docker compose -f $composeFile stop" -ForegroundColor Gray
Write-Host "  Start Stack     : docker compose -f $composeFile up -d" -ForegroundColor Gray
Write-Host "  View Logs       : docker compose -f $composeFile logs -f" -ForegroundColor Gray
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""
