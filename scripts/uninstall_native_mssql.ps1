# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# Purpose      : Cleanly remove all Native Windows SQL Server instances, services, and remnants while preserving Docker container

Write-Host "=== 1. Stopping & Disabling Native Windows SQL Server Services ===" -ForegroundColor Cyan
$services = @("MSSQLSERVER", "SQLSERVERAGENT", "SQLTELEMETRY", "SQLBrowser", "SQLWriter")
foreach ($svc in $services) {
    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
}

# Kill any leftover sqlservr / setup processes
Get-Process | Where-Object { $_.ProcessName -like "*sqlservr*" -or $_.ProcessName -like "*setup*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "=== 2. Uninstalling SQL Server MSI Packages ===" -ForegroundColor Cyan
$packages = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
    Where-Object { 
        ($_.DisplayName -like "*SQL Server*" -or $_.DisplayName -like "*MSSQL*") -and 
        $_.DisplayName -notlike "*Management Studio*" -and 
        $_.DisplayName -notlike "*SSMS*"
    }

foreach ($pkg in $packages) {
    if ($pkg.PSChildName -match "^\{[0-9A-Fa-f\-]{36}\}$") {
        $guid = $pkg.PSChildName
        Write-Host "Uninstalling MSI package: $($pkg.DisplayName) [$guid]..." -ForegroundColor Yellow
        $proc = Start-Process "msiexec.exe" -ArgumentList "/x $guid /qn /norestart" -Wait -PassThru -NoNewWindow
        Write-Host "Result: ExitCode $($proc.ExitCode)"
    }
}

Write-Host "=== 3. Deleting Native Windows SQL Server Service Registries ===" -ForegroundColor Cyan
foreach ($svc in @("MSSQLSERVER", "SQLSERVERAGENT", "SQLTELEMETRY", "SQLBrowser", "SQLWriter")) {
    & sc.exe delete $svc
}

Write-Host "=== 4. Cleaning Temporary SQL Server Installation Folders ===" -ForegroundColor Cyan
$folders = @(
    "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER",
    "C:\Program Files\Microsoft SQL Server\160",
    "C:\Program Files\Microsoft SQL Server\120",
    "C:\Program Files (x86)\Microsoft SQL Server\120",
    "C:\Program Files (x86)\Microsoft SQL Server\160"
)

foreach ($f in $folders) {
    if (Test-Path $f) {
        Write-Host "Removing directory: $f" -ForegroundColor Yellow
        Remove-Item -Path $f -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "=== 5. Cleaning Downloaded Installer Files in Downloads ===" -ForegroundColor Cyan
$downloadFiles = Get-ChildItem "$HOME\Downloads" -Filter "*SQL*.exe" -ErrorAction SilentlyContinue
foreach ($df in $downloadFiles) {
    Write-Host "Removing downloaded installer: $($df.FullName)" -ForegroundColor Yellow
    Remove-Item -Path $df.FullName -Force -ErrorAction SilentlyContinue
}

Write-Host "=== 6. Verifying Docker SQL Server Container Status ===" -ForegroundColor Green
docker ps --filter "name=smriti-mssql"
