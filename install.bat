@echo off
REM Project      : SMRITI Retail OS
REM Author       : Jawahar Ramkripal Mallah
REM Email        : support@smritibooks.com
REM Websites     : smritibooks.com | erpnbook.com | aitdl.com
REM Version      : 3.16.0
REM Created      : 2026-09-23
REM Modified     : 2026-09-23
REM Copyright    : © SMRITIBooks.com. All Rights Reserved.
REM License      : Proprietary Commercial Software
REM Classification: Internal

setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Installation ended with error code %errorlevel%.
    pause
    exit /b %errorlevel%
)
endlocal
