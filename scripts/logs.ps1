# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

param(
    [string]$Service = "",
    [int]$Tail = 100,
    [switch]$Follow = $false
)

$argsList = @("compose", "logs", "--tail=$Tail")
if ($Follow) { $argsList += "-f" }
if ($Service) { $argsList += $Service }

Write-Host "Displaying SMRITI logs (tail: $Tail)..." -ForegroundColor Cyan
& docker @argsList
