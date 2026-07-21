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
Classification: Module Packager (.smx Format)
"""

import json
import os
import zipfile
from pathlib import Path
from typing import Dict, Any, Optional

from app.core.security_manager import SecurityManager


class ModulePackager:
    """Module Packager for building distributable .smx extension packages."""

    @staticmethod
    def pack_module(module_dir: str, output_path: str) -> str:
        """Packs a module folder into a signed .smx zip distribution package."""
        mod_path = Path(module_dir)
        manifest_file = mod_path / "module.json"

        if not manifest_file.exists():
            raise FileNotFoundError(f"Manifest 'module.json' not found in {module_dir}")

        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest_dict = json.load(f)

        sig = SecurityManager.sign_manifest(manifest_dict)

        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zip_out:
            for root, _, files in os.walk(mod_path):
                for file in files:
                    fp = Path(root) / file
                    arcname = fp.relative_to(mod_path)
                    zip_out.write(fp, arcname)

            # Write signature.sha256 file
            zip_out.writestr("signature.sha256", sig)

        return str(out_path)
