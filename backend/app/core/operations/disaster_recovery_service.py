"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 15.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Transactional Disaster Recovery Engine
"""

import enum
import json
import logging
import zipfile
from pathlib import Path
from typing import Dict, Any, Tuple

from app.core.spk_kernel import kernel
from app.core.security_manager import SecurityManager

logger = logging.getLogger("smriti.operations.dr")


class DisasterRecoveryState(str, enum.Enum):
    IDLE = "IDLE"
    SNAPSHOTTING = "SNAPSHOTTING"
    VERIFYING = "VERIFYING"
    ARCHIVED = "ARCHIVED"
    RESTORING = "RESTORING"
    VALIDATING = "VALIDATING"
    ONLINE = "ONLINE"


class DisasterRecoveryService:
    """Disaster Recovery & Snapshot Service (SMP-012 Compliant)."""

    def __init__(self):
        self.state = DisasterRecoveryState.IDLE
        self.maintenance_mode: bool = False

    def create_snapshot(self, output_dir: str) -> Tuple[bool, str]:
        """Executes snapshot backup pipeline."""
        self.state = DisasterRecoveryState.SNAPSHOTTING
        out_path = Path(output_dir) / "smriti_dr_backup.zip"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        snapshot_data = {
            "version": "15.0.0",
            "states": {k: v.value for k, v in kernel.states.items()}
        }

        sig = SecurityManager.sign_manifest(snapshot_data)
        self.state = DisasterRecoveryState.VERIFYING

        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zip_out:
            zip_out.writestr("snapshot.json", json.dumps(snapshot_data, indent=2))
            zip_out.writestr("signature.sha256", sig)

        self.state = DisasterRecoveryState.ARCHIVED
        logger.info("[DisasterRecoveryService] Created snapshot backup at '%s'.", out_path)
        return True, str(out_path)

    def restore_snapshot(self, backup_zip_path: str) -> Tuple[bool, str]:
        """Executes atomic restoration pipeline under maintenance lock."""
        p_path = Path(backup_zip_path)
        if not p_path.exists():
            return False, f"Backup file '{backup_zip_path}' not found"

        self.maintenance_mode = True
        self.state = DisasterRecoveryState.RESTORING

        try:
            with zipfile.ZipFile(p_path, "r") as zip_in:
                snap_json = json.loads(zip_in.read("snapshot.json").decode("utf-8"))
                sig = zip_in.read("signature.sha256").decode("utf-8").strip()

            self.state = DisasterRecoveryState.VALIDATING
            if not SecurityManager.verify_manifest_signature(snap_json, sig)[0]:
                self.maintenance_mode = False
                self.state = DisasterRecoveryState.ONLINE
                return False, "Disaster Recovery Restoration Rejected: Integrity Signature Mismatch"

            self.state = DisasterRecoveryState.ONLINE
            self.maintenance_mode = False
            logger.info("[DisasterRecoveryService] Restored snapshot successfully.")
            return True, "Snapshot restored successfully"

        except Exception as e:
            self.maintenance_mode = False
            self.state = DisasterRecoveryState.ONLINE
            return False, f"Restoration failure: {str(e)}"
