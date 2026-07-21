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
Classification: Authoritative Compatibility Evaluator
"""

import sys
from typing import Dict, Any, List, Tuple


class CompatibilityService:
    """Authoritative Evaluator for SMP/SPK version matrices and module dependencies."""

    CURRENT_SMP_VERSION = "1.0"
    CURRENT_SPK_VERSION = "12.1.0"

    @classmethod
    def evaluate_manifest(cls, manifest_dict: Dict[str, Any], enabled_modules: List[str]) -> Tuple[bool, List[str]]:
        """Evaluates whether a package manifest can be installed on the current platform."""
        rejections = []

        # 1. Platform Min/Max Check
        min_p = manifest_dict.get("min_platform", "12.1.0")
        if min_p > cls.CURRENT_SPK_VERSION:
            rejections.append(f"Requires SPK Platform version {min_p} or higher (current: {cls.CURRENT_SPK_VERSION})")

        # 2. Python Runtime Check
        py_ver = f"{sys.version_info.major}.{sys.version_info.minor}"
        if sys.version_info.major < 3 or sys.version_info.minor < 10:
            rejections.append(f"Requires Python 3.10+ (current: {py_ver})")

        # 3. Dependency Prerequisites Check
        depends = manifest_dict.get("depends_on", [])
        for dep in depends:
            if dep not in enabled_modules:
                rejections.append(f"Missing required dependency module: '{dep}'")

        # 4. Conflict Check
        conflicts = manifest_dict.get("conflicts_with", [])
        for conf in conflicts:
            if conf in enabled_modules:
                rejections.append(f"Conflicts with active module: '{conf}'")

        is_compatible = len(rejections) == 0
        return is_compatible, rejections
