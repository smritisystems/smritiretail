@echo off
REM SMRITI Adaptive Workspace Framework (SAWF v1.1) Framework Guard CI Script
echo =======================================================
echo SAWF FRAMEWORK INTEGRITY & PROTECTION GUARD CHECK
echo =======================================================

git diff --name-only HEAD~1 | findstr /i "src/framework/sawf/" > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [ALERT] CRITICAL FRAMEWORK MODIFICATION DETECTED!
    echo Files modified under src/framework/sawf/ require:
    echo  1. Architecture Decision Record (ADR)
    echo  2. Chief Systems Architect Approval
    echo  3. Automated Core Regression Test Suite Pass
    echo.
    exit /b 1
) else (
    echo.
    echo [SUCCESS] Zero SAWF framework modifications detected.
    echo Proceeding with module code review and automated type checks...
    echo.
    exit /b 0
)
