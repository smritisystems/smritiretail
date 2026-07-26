@echo off
title SMRITI Retail OS - Barcode Printer Auto-Agent Installer
cls
echo ===================================================
echo   SMRITI Retail OS - Barcode Auto-Print Setup
echo ===================================================
echo.
echo Installing required dependencies for Python auto-spooler...
pip install pywin32
echo.
echo Setup completed! Running Auto-Print Agent...
echo.
python windows_auto_print.py
pause
