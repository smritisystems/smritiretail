@echo off
REM =============================================================================
REM Project      : SMRITI Retail OS
REM Author       : Jawahar Ramkripal Mallah
REM Designation  : Chief Systems Architect & Creator
REM Email        : support@smritibooks.com
REM Websites     : smritibooks.com | erpnbook.com | aitdl.com
REM Version      : 3.17.0
REM Created      : 2026-09-23
REM Modified     : 2026-09-23
REM Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
REM License      : Proprietary Commercial Software
REM Classification: Internal
REM =============================================================================

setlocal
cd /d "%~dp0"

echo.
echo =====================================================================
echo        SMRITI RETAIL OS - 1-CLICK SYSTEM UPDATE
echo =====================================================================
echo.
echo  This will:
echo   1. Pull the latest code updates from GitHub (branch smritiNX)
echo   2. Rebuild the frontend / backend containers
echo   3. Apply any new database migrations automatically
echo   4. Restart all services with full data preservation (NO DATA LOSS)
echo   5. Verify system and container health
echo.
pause

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1"

if %errorlevel% neq 0 (
    echo.
    echo =====================================================================
    echo  [ERROR] Update failed with error code %errorlevel%.
    echo =====================================================================
    pause
    exit /b %errorlevel%
)

echo.
echo =====================================================================
echo  System is updated and running at http://localhost:8101
echo =====================================================================
pause
