"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 14.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Phase 20 SMRITI Marketplace Engine

test_marketplace_engine.py — Integration test suite for Layer 4 Marketplace Engine.
"""

import tempfile
from pathlib import Path
import pytest

from app.core.marketplace.catalog_service import CatalogService
from app.core.marketplace.compatibility_service import CompatibilityService
from app.core.marketplace.security_service import SecurityService
from app.core.security_manager import SecurityManager
from app.core.marketplace.package_manager import PackageManager, PackageState

from app.core.marketplace.smriti_cli import SmritiCLI
from app.core.marketplace.providers.filesystem_provider import FilesystemRepositoryProvider
from app.core.extension_sdk import SmritiModuleSDK
from app.core.module_packager import ModulePackager


@pytest.mark.asyncio
async def test_catalog_aggregation_and_providers():
    """Verify CatalogService aggregates feeds across registered providers."""
    service = CatalogService()
    catalog = await service.get_aggregated_catalog("Stable")
    assert len(catalog) >= 2
    assert catalog[0]["publisher"] == "SMRITI Official"

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create local repo
        SmritiModuleSDK.create_module("custom_ext", "Custom Extension", "Financial", tmp_dir)
        fs_provider = FilesystemRepositoryProvider(tmp_dir)
        service.register_provider(fs_provider)

        agg = await service.get_aggregated_catalog("Stable")
        assert len(agg) >= 3
        mod_ids = [item["module_id"] for item in agg]
        assert "custom_ext" in mod_ids


@pytest.mark.asyncio
async def test_compatibility_service_evaluator():
    """Verify CompatibilityService evaluates SMP/SPK version matrices and dependencies."""
    valid_manifest = {
        "min_platform": "12.1.0",
        "depends_on": [],
        "conflicts_with": []
    }
    is_comp, errs = CompatibilityService.evaluate_manifest(valid_manifest, ["sales", "pos"])
    assert is_comp is True
    assert len(errs) == 0

    missing_dep_manifest = {
        "min_platform": "12.1.0",
        "depends_on": ["non_existent_module"]
    }
    is_comp_inv, errs_inv = CompatibilityService.evaluate_manifest(missing_dep_manifest, ["sales"])
    assert is_comp_inv is False
    assert "Missing required dependency" in errs_inv[0]


@pytest.mark.asyncio
async def test_security_service_triad():
    """Verify SecurityService integrity, authenticity, and trust validation."""
    manifest = {"id": "demo", "trust_tier": "FIRST_PARTY"}
    sig = SecurityManager.sign_manifest(manifest)

    # 1. Integrity
    assert SecurityService.verify_integrity(manifest, sig) is True

    # 2. Authenticity
    is_auth, msg_a = SecurityService.verify_authenticity("SMRITI_PUB_1", "-----BEGIN CERTIFICATE-----")
    assert is_auth is True

    # 3. Trust Tier
    is_trust, msg_t = SecurityService.verify_trust_tier("COMMUNITY", is_enterprise_mode=True)
    assert is_trust is False
    assert "Enterprise strict policy" in msg_t


@pytest.mark.asyncio
async def test_package_manager_atomic_lifecycle():
    """Verify PackageManager 7-stage state machine and atomic install."""
    pkg_mgr = PackageManager()

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create and pack valid module
        SmritiModuleSDK.create_module("test_pkg", "Test Package", "Core Retail", tmp_dir)
        smx_path = Path(tmp_dir) / "test_pkg.smx"
        ModulePackager.pack_module(str(Path(tmp_dir) / "test_pkg"), str(smx_path))

        success, msg = await pkg_mgr.install_package(str(smx_path))
        assert success is True
        assert pkg_mgr.package_states.get("test_pkg") == PackageState.ENABLED

        # Rollback check
        rolled = await pkg_mgr.rollback_package("test_pkg")
        assert rolled is True
        assert pkg_mgr.package_states.get("test_pkg") in [PackageState.ROLLED_BACK, PackageState.FAILED]


@pytest.mark.asyncio
async def test_smriti_cli_commands():
    """Verify SmritiCLI administrative & developer commands."""
    res_channels = SmritiCLI.run_command("channels", {})
    assert "Stable" in res_channels["channels"]

    res_doc = SmritiCLI.run_command("doctor", {})
    assert res_doc["status"] == "HEALTHY"
