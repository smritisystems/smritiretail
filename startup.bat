@echo off
REM Project      : SMRITI Retail OS
REM Repository   : SMRITIRetailNX
REM Organization : AITDL NETWORKS
REM 
REM Founders
REM 
REM * Pushpa Devi Jawahar Mallah
REM   * Founder & Chairperson
REM   * Phone: +91 9324117007
REM   * Email: founder@aitdl.com
REM 
REM * Jawahar Ramkripal Mallah
REM   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
REM   * Email: founder@aitdl.com
REM 
REM * Websites: aitdl.com | erpnbook.com | smritibooks.com
REM 
REM * Version    : 3.1.0
REM * Created    : 2026-07-11
REM * Modified   : 2026-07-11
REM * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
REM * License    : Proprietary Commercial Software

echo =====================================================================
echo SMRITI Retail OS - Automatic Docker Startup Launcher
echo =====================================================================

REM 1. Verify Docker CLI is accessible
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker CLI was not found. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM 2. Check if Docker Daemon is active
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [SMRITI] Docker daemon is not running. Attempting to start Docker Desktop...
    
    REM Launch Docker Desktop from standard install path
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo [ERROR] Docker Desktop path not found. Please start Docker Desktop manually.
        pause
        exit /b 1
    )
    
    echo Waiting for Docker daemon to become responsive...
    :wait_loop
    timeout /t 5 >nul
    docker info >nul 2>nul
    if %errorlevel% neq 0 goto wait_loop
)

echo [SMRITI] Docker daemon is active. Starting containers...
cd /d "%~dp0"
docker compose up -d

echo =====================================================================
echo SMRITI Retail OS running in the background.
echo API endpoint: http://localhost:3000
echo =====================================================================
timeout /t 5 >nul
