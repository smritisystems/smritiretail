# =============================================================================
# SMRITI Retail OS - Root PowerShell Update Entrypoint
# Usage: .\update.ps1
# =============================================================================

$targetScript = Join-Path $PSScriptRoot "scripts\update.ps1"

if (-not (Test-Path $targetScript)) {
    Write-Host "[ERROR] Update script not found at: $targetScript" -ForegroundColor Red
    exit 1
}

# Run the update script with bypass permissions
& $targetScript

