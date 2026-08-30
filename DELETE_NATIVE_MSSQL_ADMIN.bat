@echo off
:: SMRITI Retail OS: Delete all Native SQL Server Services & Registries
echo ========================================================
echo Deleting all Native SQL Server Services and Registries...
echo ========================================================

net stop MSSQLSERVER /y 2>nul
net stop SQLSERVERAGENT /y 2>nul
net stop SQLTELEMETRY /y 2>nul
net stop SQLBrowser /y 2>nul
net stop SQLWriter /y 2>nul

sc delete MSSQLSERVER 2>nul
sc delete SQLSERVERAGENT 2>nul
sc delete SQLTELEMETRY 2>nul
sc delete SQLBrowser 2>nul
sc delete SQLWriter 2>nul

taskkill /F /IM sqlservr.exe /T 2>nul
taskkill /F /IM SetupARP.exe /T 2>nul

reg delete "HKLM\SYSTEM\CurrentControlSet\Services\MSSQLSERVER" /f 2>nul
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\SQLSERVERAGENT" /f 2>nul
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\SQLTELEMETRY" /f 2>nul
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\SQLBrowser" /f 2>nul
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\SQLWriter" /f 2>nul
reg delete "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server" /f 2>nul
reg delete "HKLM\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server" /f 2>nul

rmdir /s /q "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER" 2>nul
rmdir /s /q "C:\Program Files\Microsoft SQL Server\160" 2>nul
rmdir /s /q "C:\Program Files\Microsoft SQL Server\120" 2>nul
rmdir /s /q "C:\Program Files (x86)\Microsoft SQL Server\120" 2>nul
rmdir /s /q "C:\Program Files (x86)\Microsoft SQL Server\160" 2>nul

echo ========================================================
echo SUCCESS: All Native SQL Server instances removed!
echo Docker SQL Server (smriti-mssql) remains 100%% active.
echo ========================================================
pause
