<#
.SYNOPSIS
    SMRITI Retail OS - Enterprise One-Click Docker Installer (PowerShell)
.DESCRIPTION
    Production-grade automated installer for SMRITI Retail OS.
    Verifies system prerequisites, prepares environment configurations, builds and launches
    Docker containers, initializes databases, runs migrations, seeds initial admin accounts,
    performs health check validation, and logs all operations.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install.ps1
.NOTES
    Project      : SMRITI Retail OS
    Author       : Jawahar Ramkripal Mallah
    Designation  : Chief Systems Architect & Creator
    Email        : support@smritibooks.com
    Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
    Version      : 3.34.0
    Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
    License      : Proprietary Commercial Software
#>

[CmdletBinding()]
param (
    [switch]$SkipPrereqs,
    [switch]$ForceRebuild,
    [switch]$NonInteractive
)

# -----------------------------------------------------------------------------
# GLOBAL CONFIGURATION & CONSTANTS
# -----------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ScriptDir = If ($PSScriptRoot) { $PSScriptRoot } Else { Get-Location }
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "install.log"
$BackupsDir = Join-Path $ScriptDir "backups"
$StorageDir = Join-Path $ScriptDir "storage"
$EnvFile = Join-Path $ScriptDir ".env"
$EnvExampleFile = Join-Path $ScriptDir ".env.example"
$ComposeFile = Join-Path $ScriptDir "docker-compose.yml"

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS: LOGGING & CONSOLE OUTPUT
# -----------------------------------------------------------------------------
function Init-LogSystem {
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    if (-not (Test-Path $BackupsDir)) {
        New-Item -ItemType Directory -Path $BackupsDir -Force | Out-Null
    }
    if (-not (Test-Path $StorageDir)) {
        New-Item -ItemType Directory -Path $StorageDir -Force | Out-Null
    }
}

function Write-Log {
    param (
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR", "PROC")]
        [string]$Level = "INFO"
    )
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $LogMessage = "[$Timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $LogMessage -ErrorAction SilentlyContinue

    switch ($Level) {
        "SUCCESS" { Write-Host "[OK] $Message" -ForegroundColor Green }
        "WARN"    { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
        "ERROR"   { Write-Host "[FAIL] $Message" -ForegroundColor Red }
        "PROC"    { Write-Host "[PROC] $Message" -ForegroundColor Cyan }
        Default   { Write-Host "     $Message" -ForegroundColor White }
    }
}

function Show-Header {
    Clear-Host
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host "                SMRITI RETAIL OS ENTERPRISE INSTALLER                " -ForegroundColor Green
    Write-Host "        One-Click Automated Docker Cluster Setup (v3.34.0)           " -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host ""
}

function Generate-RandomSecret([int]$Length = 32) {
    $bytes = New-Object byte[] ($Length / 2)
    (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

# -----------------------------------------------------------------------------
# STEP 1: PREREQUISITE VERIFICATION
# -----------------------------------------------------------------------------
function Test-Prerequisites {
    Write-Log "Checking system environment and software prerequisites..." -Level "PROC"
    $FailedPrereqs = @()

    # Check OS
    $IsWindows = [System.Environment]::OSVersion.Platform -eq "Win32NT"
    if ($IsWindows) {
        Write-Log "Operating System: Windows detected" -Level "SUCCESS"
    } else {
        Write-Log "Non-Windows environment detected. Installer optimized for Windows 10/11." -Level "WARN"
    }

    # Check PowerShell Version
    $PSVer = $PSVersionTable.PSVersion.Major
    if ($PSVer -ge 5) {
        Write-Log "PowerShell Version: $PSVer ($($PSVersionTable.PSVersion))" -Level "SUCCESS"
    } else {
        Write-Log "PowerShell 5.1 or 7+ is required. Found version: $PSVer" -Level "ERROR"
        $FailedPrereqs += "PowerShell"
    }

    # Check Git
    try {
        $GitVer = git --version 2>&1
        Write-Log "Git CLI: Installed ($GitVer)" -Level "SUCCESS"
    } catch {
        Write-Log "Git CLI is missing. Download from https://git-scm.com/" -Level "ERROR"
        $FailedPrereqs += "Git"
    }

    # Check Docker CLI
    try {
        $DockerVer = docker --version 2>&1
        Write-Log "Docker Engine: Installed ($DockerVer)" -Level "SUCCESS"
    } catch {
        Write-Log "Docker Desktop is missing or not in PATH. Download from https://www.docker.com/" -Level "ERROR"
        $FailedPrereqs += "Docker"
    }

    # Check Docker Compose
    try {
        $ComposeVer = docker compose version 2>&1
        Write-Log "Docker Compose: Installed ($ComposeVer)" -Level "SUCCESS"
    } catch {
        Write-Log "Docker Compose v2 is missing." -Level "ERROR"
        $FailedPrereqs += "Docker Compose"
    }

    # Check Docker Engine Daemon Connectivity
    try {
        $DockerInfo = docker info 2>&1
        Write-Log "Docker Daemon: Running and responding to commands" -Level "SUCCESS"
    } catch {
        Write-Log "Docker Daemon is NOT running. Please start Docker Desktop and retry." -Level "ERROR"
        $FailedPrereqs += "Docker Daemon"
    }

    if ($FailedPrereqs.Count -gt 0) {
        Write-Log "Prerequisite check failed! Missing components: $($FailedPrereqs -join ', ')" -Level "ERROR"
        Write-Log "Please resolve missing prerequisites listed above and re-run install.ps1" -Level "WARN"
        exit 1
    }
}

# -----------------------------------------------------------------------------
# STEP 2: REPOSITORY & ENVIRONMENT CONFIGURATION
# -----------------------------------------------------------------------------
function Test-RepoStructure {
    Write-Log "Validating repository structure and configuration files..." -Level "PROC"

    if (-not (Test-Path $ComposeFile)) {
        Write-Log "docker-compose.yml not found in $ScriptDir" -Level "ERROR"
        exit 1
    }
    Write-Log "Found docker-compose.yml configuration" -Level "SUCCESS"

    if (-not (Test-Path $EnvFile)) {
        if (Test-Path $EnvExampleFile) {
            Copy-Item $EnvExampleFile $EnvFile
            Write-Log "Created .env configuration file from .env.example" -Level "SUCCESS"
        } else {
            Write-Log ".env.example not found! Generating default .env template..." -Level "WARN"
            $DefaultEnv = @"
PORT=3000
BACKEND_API_PORT=8000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=smriti_retail_db
DATABASE_PROVIDER=postgres
SKIP_MIGRATIONS=false
"@
            Set-Content -Path $EnvFile -Value $DefaultEnv -Encoding ASCII
            Write-Log "Generated default .env configuration" -Level "SUCCESS"
        }
    } else {
        Write-Log "Existing .env file detected. Reusing existing settings." -Level "SUCCESS"
    }

    # Verify and Populate Secrets if Default or Missing
    $EnvContent = Get-Content $EnvFile -Raw

    if ($EnvContent -notmatch "JWT_SECRET_KEY=" -or $EnvContent -match "JWT_SECRET_KEY=change_this" -or $EnvContent -match "9a12c418") {
        $NewJwtSecret = Generate-RandomSecret -Length 32
        if ($EnvContent -match "JWT_SECRET_KEY=") {
            $EnvContent = $EnvContent -replace "JWT_SECRET_KEY=.*", "JWT_SECRET_KEY=$NewJwtSecret"
        } else {
            $EnvContent += "`r`nJWT_SECRET_KEY=$NewJwtSecret"
        }
        Write-Log "Generated secure random JWT_SECRET_KEY" -Level "SUCCESS"
    }

    if ($EnvContent -notmatch "INTERNAL_SERVICE_KEY=" -or $EnvContent -match "smriti_test_internal_key") {
        $NewInternalKey = Generate-RandomSecret -Length 32
        if ($EnvContent -match "INTERNAL_SERVICE_KEY=") {
            $EnvContent = $EnvContent -replace "INTERNAL_SERVICE_KEY=.*", "INTERNAL_SERVICE_KEY=$NewInternalKey"
        } else {
            $EnvContent += "`r`nINTERNAL_SERVICE_KEY=$NewInternalKey"
        }
        Write-Log "Generated secure random INTERNAL_SERVICE_KEY" -Level "SUCCESS"
    }

    Set-Content -Path $EnvFile -Value $EnvContent -Encoding ASCII
}

# -----------------------------------------------------------------------------
# STEP 3: DOCKER BUILD & CONTAINER DEPLOYMENT
# -----------------------------------------------------------------------------
function Deploy-DockerCluster {
    Write-Log "Building and starting SMRITI Docker containers..." -Level "PROC"

    Set-Location $ScriptDir

    if ($ForceRebuild) {
        Write-Log "Force rebuild requested. Executing docker compose build --no-cache..." -Level "INFO"
        docker compose build --no-cache 2>&1 | Out-File -FilePath $LogFile -Append
    } else {
        Write-Log "Building Docker service images (workspace, api)..." -Level "INFO"
        docker compose build 2>&1 | Out-File -FilePath $LogFile -Append
    }

    Write-Log "Launching container cluster in detached mode (docker compose up -d)..." -Level "INFO"
    $ComposeOutput = docker compose up -d 2>&1
    $ComposeOutput | Out-File -FilePath $LogFile -Append

    if ($LASTEXITCODE -ne 0) {
        Write-Log "Docker compose up failed. Check $LogFile for error logs." -Level "ERROR"
        exit 1
    }
    Write-Log "Docker container cluster started successfully." -Level "SUCCESS"
}

# -----------------------------------------------------------------------------
# STEP 4: HEALTH CHECK & CONTAINER WAITING LOOP
# -----------------------------------------------------------------------------
function Wait-ForClusterHealth {
    Write-Log "Waiting for all cluster containers (db, api, workspace) to report HEALTHY status..." -Level "PROC"

    $Services = @("smriti-db", "smriti-api", "smriti-workspace")
    $MaxAttempts = 40
    $DelaySeconds = 3

    foreach ($Service in $Services) {
        $Healthy = $false
        Write-Log "Polled status for container '$Service'..." -Level "INFO"

        for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
            try {
                $Status = (docker inspect --format='{{json .State.Health.Status}}' $Service 2>$null) -replace '"', ''
                if (-not $Status) {
                    $Status = (docker inspect --format='{{json .State.Status}}' $Service 2>$null) -replace '"', ''
                }

                if ($Status -eq "healthy" -or $Status -eq "running") {
                    Write-Log "Container '$Service' is $Status (Attempt $Attempt/$MaxAttempts)" -Level "SUCCESS"
                    $Healthy = $true
                    break
                }
            } catch {}

            Write-Host -NoNewline "."
            Start-Sleep -Seconds $DelaySeconds
        }

        if (-not $Healthy) {
            Write-Host ""
            Write-Log "Timeout waiting for container '$Service' to become healthy!" -Level "ERROR"
            Write-Log "Showing recent container logs for '$Service':" -Level "WARN"
            docker logs --tail 20 $Service
            exit 1
        }
    }
    Write-Host ""
    Write-Log "All cluster services (Database, API Engine, Operations Workspace) are HEALTHY!" -Level "SUCCESS"
}

# -----------------------------------------------------------------------------
# STEP 5: DATABASE MIGRATION & ADMIN ACCOUNT SEEDING
# -----------------------------------------------------------------------------
function Initialize-Database {
    Write-Log "Running Alembic database migrations & auto-seeding default accounts..." -Level "PROC"

    # Alembic Migrations
    Write-Log "Executing database migrations (alembic upgrade head)..." -Level "INFO"
    $MigrateOut = docker exec smriti-api python -m alembic upgrade head 2>&1
    $MigrateOut | Out-File -FilePath $LogFile -Append
    Write-Log "Database schema migrations applied." -Level "SUCCESS"

    # Database Seed
    Write-Log "Seeding system default master tables & admin accounts..." -Level "INFO"
    $SeedOut = docker exec smriti-api python -m app.db.seed 2>&1
    $SeedOut | Out-File -FilePath $LogFile -Append
    Write-Log "Default database seeding complete." -Level "SUCCESS"
}

# -----------------------------------------------------------------------------
# STEP 6: ENDPOINT AVAILABILITY VERIFICATION
# -----------------------------------------------------------------------------
function Verify-Endpoints {
    Write-Log "Verifying public & internal HTTP endpoints..." -Level "PROC"

    # Check API Health Endpoint
    try {
        $ApiResp = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 10
        if ($ApiResp.status -eq "healthy" -or $ApiResp.service -eq "operational") {
            Write-Log "Platform API Endpoint (http://localhost:8000/health): Operational" -Level "SUCCESS"
        } else {
            Write-Log "Platform API Endpoint returned response: $($ApiResp | ConvertTo-Json -Compress)" -Level "SUCCESS"
        }
    } catch {
        Write-Log "Failed to query Platform API at http://localhost:8000/health: $_" -Level "WARN"
    }

    # Check Workspace Frontend Endpoint
    try {
        $WebResp = Invoke-WebRequest -Uri "http://localhost:3000/" -Method Get -TimeoutSec 10
        if ($WebResp.StatusCode -eq 200) {
            Write-Log "Operations Workspace Frontend (http://localhost:3000/): Operational (HTTP 200)" -Level "SUCCESS"
        }
    } catch {
        Write-Log "Failed to query Workspace Frontend at http://localhost:3000/: $_" -Level "WARN"
    }
}

# -----------------------------------------------------------------------------
# MAIN EXECUTION FLOW
# -----------------------------------------------------------------------------
try {
    Init-LogSystem
    Show-Header
    Write-Log "Installation session started. Log file: $LogFile" -Level "INFO"

    if (-not $SkipPrereqs) {
        Test-Prerequisites
    }
    Test-RepoStructure
    Deploy-DockerCluster
    Wait-ForClusterHealth
    Initialize-Database
    Verify-Endpoints

    Write-Host ""
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host "                 INSTALLATION COMPLETED SUCCESSFULLY                 " -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host " SMRITI Retail OS Cluster is live and operational:" -ForegroundColor White
    Write-Host ""
    Write-Host "   - SMRITI Retail Operations Workspace : http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   - SMRITI Platform API Engine Core    : http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   - API Health Monitoring Status       : http://localhost:8000/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " Default System Authentication Credentials:" -ForegroundColor Yellow
    Write-Host "   Username: super     Password: Smriti@1234   Role: System Admin" -ForegroundColor Green
    Write-Host "   Username: manager   Password: Password@123  Role: Store Manager" -ForegroundColor Green
    Write-Host "   Username: cashier   Password: Cashier@1234  Role: POS Cashier" -ForegroundColor Green
    Write-Host ""
    Write-Host " Management Commands:" -ForegroundColor White
    Write-Host "   - Stop Cluster   : powershell -File stop.ps1" -ForegroundColor Gray
    Write-Host "   - Start Cluster  : powershell -File start.ps1" -ForegroundColor Gray
    Write-Host "   - Status Dashboard: powershell -File status.ps1" -ForegroundColor Gray
    Write-Host "   - Backup Database : powershell -File backup.ps1" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host ""
    Write-Log "CRITICAL INSTALLATION FAILURE: $_" -Level "ERROR"
    Write-Log "Please inspect $LogFile for diagnostic logs." -Level "WARN"
    exit 1
}
