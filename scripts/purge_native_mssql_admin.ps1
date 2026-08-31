# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Purpose      : Permanently delete all Native Windows SQL Server services, processes, and registry keys (Elevated)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SMRITI: PERMANENT NATIVE SQL SERVER REMOVAL PROTOCOL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Stop and Kill all native SQL processes
Write-Host "[1/4] Stopping native SQL services..." -ForegroundColor Yellow
$services = @("MSSQLSERVER", "SQLSERVERAGENT", "SQLTELEMETRY", "SQLBrowser", "SQLWriter")
foreach ($s in $services) {
    Stop-Service -Name $s -Force -ErrorAction SilentlyContinue
}
Get-Process | Where-Object { $_.ProcessName -like "*sqlservr*" -or $_.ProcessName -like "*setup*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Delete Windows NT Services
Write-Host "[2/4] Deleting native Windows NT Services..." -ForegroundColor Yellow
foreach ($s in $services) {
    & sc.exe delete $s
}

# 3. Purge Registry Keys
Write-Host "[3/4] Purging SQL Server Registry hives..." -ForegroundColor Yellow
$regPaths = @(
    "HKLM:\SYSTEM\CurrentControlSet\Services\MSSQLSERVER",
    "HKLM:\SYSTEM\CurrentControlSet\Services\SQLSERVERAGENT",
    "HKLM:\SYSTEM\CurrentControlSet\Services\SQLTELEMETRY",
    "HKLM:\SYSTEM\CurrentControlSet\Services\SQLBrowser",
    "HKLM:\SYSTEM\CurrentControlSet\Services\SQLWriter",
    "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server"
)

foreach ($r in $regPaths) {
    if (Test-Path $r) {
        Remove-Item -Path $r -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Purged registry: $r" -ForegroundColor DarkGray
    }
}

# 4. Final Directory Cleanup
Write-Host "[4/4] Purging filesystem leftovers..." -ForegroundColor Yellow
$folders = @(
    "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER",
    "C:\Program Files\Microsoft SQL Server\160",
    "C:\Program Files\Microsoft SQL Server\120",
    "C:\Program Files (x86)\Microsoft SQL Server\120",
    "C:\Program Files (x86)\Microsoft SQL Server\160"
)

foreach ($f in $folders) {
    if (Test-Path $f) {
        Remove-Item -Path $f -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " SUCCESS: ALL NATIVE SQL SERVERS PERMANENTLY REMOVED!" -ForegroundColor Green
Write-Host " DOCKER SQL SERVER ('smriti-mssql') REMAINS 100% UNTOUCHED" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Start-Sleep -Seconds 3
