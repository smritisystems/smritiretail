@echo off
REM SMRITI Adaptive Workspace Framework (SAWF v1.1) Framework Guard CI Script
echo =======================================================
echo SAWF FRAMEWORK INTEGRITY AND PROTECTION GUARD CHECK
echo =======================================================

git diff --name-only HEAD~1 | findstr /i "src/framework/sawf/" > nul 2>&1
if %errorlevel% equ 0 (
    echo [ALERT] CRITICAL FRAMEWORK MODIFICATION DETECTED!
    echo Files modified under src/framework/sawf/ require ADR and Architect Approval.
    exit /b 1
) else (
    echo [SUCCESS] Zero SAWF framework modifications detected.
    echo Proceeding with module code review and automated type checks...
    exit /b 0
)
