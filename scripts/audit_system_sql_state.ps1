# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " 1. CHECKING NATIVE WINDOWS SQL SERVICES" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
$services = Get-Service -Name MSSQLSERVER, SQLSERVERAGENT, SQLTELEMETRY, SQLBrowser, SQLWriter -ErrorAction SilentlyContinue
if ($services) {
    $services | Select-Object Name, DisplayName, Status, StartType | Format-Table -AutoSize
} else {
    Write-Host "SUCCESS: Zero native SQL Server Windows services found (All Deleted)." -ForegroundColor Green
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " 2. CHECKING RUNNING SQL PROCESSES" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
$procs = Get-Process | Where-Object { $_.ProcessName -like "*sqlservr*" -or $_.ProcessName -like "*SetupARP*" -or $_.ProcessName -like "*sqlwriter*" }
if ($procs) {
    $procs | Select-Object Id, ProcessName, CPU, WorkingSet64 | Format-Table -AutoSize
} else {
    Write-Host "SUCCESS: Zero native SQL Server processes running." -ForegroundColor Green
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " 3. CHECKING SQL SERVER REGISTRY HIVES" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
$reg1 = Test-Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server"
$reg2 = Test-Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server"
Write-Host "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server exists: $reg1"
Write-Host "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Microsoft SQL Server exists: $reg2"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " 4. CHECKING DOCKER CONTAINER STATUS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " 5. TESTING DOCKER SQL SERVER LIVE CONNECTIVITY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
docker exec smriti-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "netmanthan@123" -C -Q "
SELECT 
    @@SERVERNAME AS [Server_Name],
    SERVERPROPERTY('ProductVersion') AS [Version],
    SERVERPROPERTY('Edition') AS [Edition];
SELECT name, compatibility_level, state_desc FROM sys.databases;
"
