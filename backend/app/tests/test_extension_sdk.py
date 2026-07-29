"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 13.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Extension SDK, Packager (.smx), and Security Manager

test_extension_sdk.py — Pytest integration suite for Phase 19 First-Party Module Migration & SDK.
"""

import tempfile
import zipfile
from pathlib import Path
import pytest

from app.core.spk_kernel import kernel
from app.core.extension_sdk import SmritiModuleSDK
from app.core.module_packager import ModulePackager
from app.core.security_manager import SecurityManager


@pytest.mark.asyncio
async def test_first_party_modules_auto_discovered():
    """Verify that all 6 first-party modules are auto-discovered from backend/app/modules/*/module.json."""
    discovered = list(kernel.manifests.keys())
    for mod_id in ["sales", "inventory", "pos", "purchase", "crm", "accounting"]:
        assert mod_id in discovered
        manifest = kernel.manifests[mod_id]
        assert manifest.version == "13.0.0"
        assert manifest.uuid is not None


@pytest.mark.asyncio
async def test_sdk_manifest_validation_and_doctor():
    """Verify SDK manifest validation and doctor environment checks."""
    doc = SmritiModuleSDK.doctor()
    assert doc["sdk_version"] == "13.0.0"
    assert doc["status"] == "HEALTHY"
    assert len(doc["checks"]) == 3

    valid_manifest = {
        "schema_version": "1.0",
        "module_version": "13.0.0",
        "id": "test_mod",
        "uuid": "test-uuid-1234",
        "name": "Test Module",
        "category": "Core Retail",
        "module_type": "PLUGIN",
        "version": "1.0.0"
    }

    errs = SmritiModuleSDK.validate_manifest(valid_manifest)
    assert len(errs) == 0

    invalid_manifest = {"id": "bad_mod"}
    errs_inv = SmritiModuleSDK.validate_manifest(invalid_manifest)
    assert len(errs_inv) > 0


@pytest.mark.asyncio
async def test_security_manager_sha256_signatures():
    """Verify SHA256 digital signature creation and validation."""
    manifest = {"id": "crm", "version": "13.0.0", "name": "CRM Module"}
    sig = SecurityManager.sign_manifest(manifest)
    assert len(sig) == 64

    is_valid, msg = SecurityManager.verify_manifest_signature(manifest, sig)
    assert is_valid is True
    assert msg == "Signature Valid"

    tampered_sig = sig[:-4] + "0000"
    is_valid_tampered, msg_t = SecurityManager.verify_manifest_signature(manifest, tampered_sig)
    assert is_valid_tampered is False
    assert "Signature Mismatch" in msg_t


@pytest.mark.asyncio
async def test_module_packager_smx_generation():
    """Verify ModulePackager creates valid .smx zip archives containing signature.sha256."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create temp module directory
        mod_dir = Path(tmp_dir) / "demo_mod"
        SmritiModuleSDK.create_module("demo_mod", "Demo Module", "Core Retail", tmp_dir)

        # Pack into .smx package
        out_smx = Path(tmp_dir) / "demo_mod.smx"
        smx_path = ModulePackager.pack_module(str(mod_dir), str(out_smx))
        assert Path(smx_path).exists()

        # Inspect Zip Archive
        with zipfile.ZipFile(smx_path, "r") as zip_file:
            contents = zip_file.namelist()
            assert "module.json" in contents
            assert "bootstrap.py" in contents
            assert "signature.sha256" in contents
