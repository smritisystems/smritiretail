"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for SMRITI Platform Kernel (SPK) & SMP-001 Capabilities

test_capability_manager.py — Test suite for SPK Kernel, Module Manager (SCM), and 4-Pillar Verification.
"""

import pytest
from fastapi import HTTPException
from app.core.spk_kernel import kernel, ModuleState, require_capability


@pytest.mark.asyncio
async def test_spk_kernel_initialization_and_defaults():
    """Verify kernel initializes default core retail modules in ENABLED state."""
    assert kernel.is_module_enabled("sales") is True
    assert kernel.is_module_enabled("pos") is True
    assert kernel.is_module_enabled("inventory") is True
    assert kernel.is_module_enabled("advanced_accounting") is False


@pytest.mark.asyncio
async def test_critical_module_protection_prevents_disable():
    """Verify critical platform modules (e.g. sales) cannot be disabled."""
    with pytest.raises(HTTPException) as exc_info:
        await kernel.toggle_module("sales", False)

    assert exc_info.value.status_code == 400
    assert "SMRITI-CAP-002" in exc_info.value.detail


@pytest.mark.asyncio
async def test_prerequisite_dependency_auto_enable():
    """Verify enabling advanced_accounting automatically enables basic_accounting."""
    assert kernel.is_module_enabled("basic_accounting") is False
    assert kernel.is_module_enabled("advanced_accounting") is False

    await kernel.toggle_module("advanced_accounting", True)

    assert kernel.is_module_enabled("advanced_accounting") is True
    assert kernel.is_module_enabled("basic_accounting") is True


@pytest.mark.asyncio
async def test_dependent_module_prevents_disabling_prerequisite():
    """Verify basic_accounting cannot be disabled while advanced_accounting depends on it."""
    with pytest.raises(HTTPException) as exc_info:
        await kernel.toggle_module("basic_accounting", False)

    assert exc_info.value.status_code == 400
    assert "SMRITI-CAP-003" in exc_info.value.detail

    # Clean up state: disable advanced_accounting first
    await kernel.toggle_module("advanced_accounting", False)
    assert kernel.is_module_enabled("advanced_accounting") is False


@pytest.mark.asyncio
async def test_capability_profile_application():
    """Verify one-click profile switching (RETAIL_LITE vs ENTERPRISE)."""
    kernel.apply_profile("RETAIL_LITE")
    assert kernel.is_module_enabled("sales") is True
    assert kernel.is_module_enabled("advanced_accounting") is False

    kernel.apply_profile("ENTERPRISE")
    assert kernel.is_module_enabled("sales") is True
    assert kernel.is_module_enabled("advanced_accounting") is True

    # Revert to default RETAIL_LITE
    kernel.apply_profile("RETAIL_LITE")


@pytest.mark.asyncio
async def test_fastapi_capability_guard_rejection():
    """Verify capability guard returns SMRITI-CAP-001 403 when feature module is disabled."""
    guard = require_capability("advanced_accounting")
    kernel.states["advanced_accounting"] = ModuleState.DISABLED

    with pytest.raises(HTTPException) as exc_info:
        guard()

    assert exc_info.value.status_code == 403
    assert "SMRITI-CAP-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_spk_kernel_diagnostics_telemetry():
    """Verify telemetry & health diagnostic numbers are populated."""
    diag = kernel.get_kernel_diagnostics()
    assert diag["spk_version"] == "12.1.0"
    assert diag["smp_specification"] == "1.0"
    assert diag["total_registered_modules"] >= 5
    assert diag["memory_footprint_mb"] > 0
