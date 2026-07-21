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
Classification: Developer & Operational SMRITI CLI Tooling
"""

import sys
import json
from pathlib import Path
from typing import Dict, Any

from app.core.extension_sdk import SmritiModuleSDK
from app.core.module_packager import ModulePackager
from app.core.security_manager import SecurityManager


class SmritiCLI:
    """Administrative & Developer Command Line Toolkit."""

    @staticmethod
    def run_command(command: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches CLI commands."""
        if command == "init":
            out_dir = SmritiModuleSDK.create_module(args["module_id"], args["name"], args.get("category", "Core Retail"), args.get("output_dir", "."))
            return {"status": "SUCCESS", "message": f"Initialized module skeleton at {out_dir}"}

        elif command == "validate":
            with open(Path(args["module_dir"]) / "module.json", "r", encoding="utf-8") as f:
                data = json.load(f)
            errs = SmritiModuleSDK.validate_manifest(data)
            return {"status": "SUCCESS" if not errs else "FAILED", "errors": errs}

        elif command == "pack":
            smx_path = ModulePackager.pack_module(args["module_dir"], args["output_smx"])
            return {"status": "SUCCESS", "smx_path": smx_path}

        elif command == "sign":
            with open(Path(args["module_dir"]) / "module.json", "r", encoding="utf-8") as f:
                data = json.load(f)
            sig = SecurityManager.sign_manifest(data)
            return {"status": "SUCCESS", "signature": sig}

        elif command == "doctor":
            return SmritiModuleSDK.doctor()

        elif command == "channels":
            return {"channels": ["Stable", "LTS", "Beta", "Preview", "Internal"]}

        else:
            return {"status": "FAILED", "error": f"Unknown CLI command '{command}'"}
