@echo off
REM Project      : SMRITI Retail OS
REM Author       : Jawahar Ramkripal Mallah
REM Email        : support@smritibooks.com
REM Websites     : smritibooks.com | erpnbook.com | aitdl.com
REM Version      : 3.17.0
REM Created      : 2026-09-23
REM Modified     : 2026-09-23
REM Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
REM License      : Proprietary Commercial Software
REM Classification: Internal

setlocal
cd /d "%~dp0"

echo.
echo =====================================================================
echo        SMRITI RETAIL OS - ONE-CLICK INSTALLER
echo =====================================================================
echo.
echo  Select installation type:
echo.
echo  [1] Normal Install / Update      (keeps existing data)
echo  [2] Fresh Install  (Clean Slate) (wipes DB - use on NEW machine only)
echo.
set /p CHOICE="Enter choice [1 or 2] (Default: 1): "

if "%CHOICE%"=="2" (
    echo.
    echo  [!] FRESH INSTALL selected - all database volumes will be wiped.
    echo.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Mode "Production" -FreshInstall
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -Mode "Production"
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation ended with error code %errorlevel%.
    pause
    exit /b %errorlevel%
)
endlocal
