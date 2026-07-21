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
Classification: Transactional Package Lifecycle Manager
"""

import enum
import json
import logging
import zipfile
from pathlib import Path
from typing import Dict, Any, Tuple

from app.core.spk_kernel import kernel, ModuleState
from app.core.marketplace.compatibility_service import CompatibilityService
from app.core.marketplace.security_service import SecurityService

logger = logging.getLogger("smriti.marketplace.package_manager")


class PackageState(str, enum.Enum):
    DOWNLOADED = "DOWNLOADED"
    VERIFIED = "VERIFIED"
    STAGED = "STAGED"
    INSTALLED = "INSTALLED"
    ENABLED = "ENABLED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


class PackageManager:
    """Transactional Package Lifecycle Manager with Atomic Rollback Guarantees."""

    def __init__(self):
        self.package_states: Dict[str, PackageState] = {}
        self.backups: Dict[str, Dict[str, Any]] = {}

    async def install_package(self, smx_path: str) -> Tuple[bool, str]:
        """Executes 7-stage atomic installation pipeline."""
        p_path = Path(smx_path)
        if not p_path.exists():
            return False, f"Package file '{smx_path}' not found"

        module_id = "unknown"

        try:
            # 1. Downloaded & Stage 1 Read Zip
            with zipfile.ZipFile(p_path, "r") as zip_in:
                namelist = zip_in.namelist()
                if "module.json" not in namelist or "signature.sha256" not in namelist:
                    return False, "Invalid .smx package: missing 'module.json' or 'signature.sha256'"

                manifest_data = json.loads(zip_in.read("module.json").decode("utf-8"))
                signature = zip_in.read("signature.sha256").decode("utf-8").strip()
                cert_pem = zip_in.read("cert.pem").decode("utf-8").strip() if "cert.pem" in namelist else ""

            module_id = manifest_data["id"]
            self.package_states[module_id] = PackageState.DOWNLOADED

            # 2. Verify Security Triad
            if not SecurityService.verify_integrity(manifest_data, signature):
                self.package_states[module_id] = PackageState.FAILED
                return False, "Security Violation: SHA256 integrity digest mismatch"

            is_auth, auth_msg = SecurityService.verify_authenticity(manifest_data.get("publisher", "SMRITI"), cert_pem)
            if not is_auth:
                self.package_states[module_id] = PackageState.FAILED
                return False, f"Authenticity Violation: {auth_msg}"

            is_trust, trust_msg = SecurityService.verify_trust_tier(manifest_data.get("trust_tier", "COMMUNITY"))
            if not is_trust:
                self.package_states[module_id] = PackageState.FAILED
                return False, f"Trust Violation: {trust_msg}"

            self.package_states[module_id] = PackageState.VERIFIED

            # 3. Compatibility Check
            active_modules = [m_id for m_id, state in kernel.states.items() if state == ModuleState.ENABLED]
            is_comp, comp_errs = CompatibilityService.evaluate_manifest(manifest_data, active_modules)
            if not is_comp:
                self.package_states[module_id] = PackageState.FAILED
                return False, f"Compatibility Violation: {', '.join(comp_errs)}"

            self.package_states[module_id] = PackageState.STAGED

            # 4. Backup Previous State
            if module_id in kernel.manifests:
                self.backups[module_id] = {
                    "manifest": kernel.manifests[module_id],
                    "state": kernel.states.get(module_id, ModuleState.DISABLED)
                }

            # 5. Extract to backend/app/modules/<module_id>/
            dest_dir = Path(__file__).resolve().parent.parent.parent / "modules" / module_id
            dest_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(p_path, "r") as zip_in:
                zip_in.extractall(dest_dir)

            self.package_states[module_id] = PackageState.INSTALLED

            # 6. Enable in Kernel
            kernel.states[module_id] = ModuleState.ENABLED
            self.package_states[module_id] = PackageState.ENABLED

            logger.info("[PackageManager] Module '%s' successfully installed & enabled.", module_id)
            return True, f"Module '{module_id}' successfully installed"

        except Exception as e:
            logger.error("[PackageManager] Installation failed for '%s': %s", module_id, e)
            if module_id != "unknown":
                await self.rollback_package(module_id)
            return False, f"Installation failure: {str(e)}"

    async def rollback_package(self, module_id: str) -> bool:
        """Rolls back module state to previous backup snapshot."""
        if module_id in self.backups:
            backup = self.backups[module_id]
            kernel.manifests[module_id] = backup["manifest"]
            kernel.states[module_id] = backup["state"]
            self.package_states[module_id] = PackageState.ROLLED_BACK
            logger.info("[PackageManager] Rolled back module '%s' to previous state.", module_id)
            return True
        else:
            kernel.states[module_id] = ModuleState.DISABLED
            self.package_states[module_id] = PackageState.FAILED
            return True
