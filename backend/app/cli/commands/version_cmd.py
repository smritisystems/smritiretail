#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Version Command

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, Any

from app.cli.utils import find_repo_root, output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "version",
        help="Inspect, validate, and verify the 4-point Single Source of Truth (SSOT) version lock.",
        description="Inspects package.json, backend config.py, frontend version.ts, and CHANGELOG.md for zero-drift version parity."
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )
    parser.set_defaults(func=run_version_cmd)


def inspect_versions(repo_root: Path) -> Dict[str, Any]:
    package_json_path = repo_root / "package.json"
    config_py_path = repo_root / "backend" / "app" / "core" / "config.py"
    frontend_version_path = repo_root / "src" / "config" / "version.ts"
    changelog_path = repo_root / "CHANGELOG.md"

    versions: Dict[str, str] = {}
    missing_files = []

    # 1. package.json
    if package_json_path.exists():
        try:
            with open(package_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                versions["package_json"] = data.get("version", "")
        except Exception as e:
            versions["package_json"] = f"ERROR: {e}"
    else:
        missing_files.append("package.json")

    # 2. config.py
    if config_py_path.exists():
        try:
            content = config_py_path.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r'VERSION:\s*str\s*=\s*["\']([^"\']+)["\']', content)
            versions["backend_config_py"] = m.group(1) if m else "NOT_FOUND"
        except Exception as e:
            versions["backend_config_py"] = f"ERROR: {e}"
    else:
        missing_files.append("backend/app/core/config.py")

    # 3. version.ts
    if frontend_version_path.exists():
        try:
            content = frontend_version_path.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r'export\s+const\s+APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
            versions["frontend_version_ts"] = m.group(1) if m else "NOT_FOUND"
        except Exception as e:
            versions["frontend_version_ts"] = f"ERROR: {e}"
    else:
        missing_files.append("src/config/version.ts")

    # 4. CHANGELOG.md
    if changelog_path.exists():
        try:
            content = changelog_path.read_text(encoding="utf-8", errors="ignore")
            m = re.search(r'#{2,3}\s*\[([0-9]+\.[0-9]+\.[0-9]+[^\]]*)\]', content)
            versions["changelog_md"] = m.group(1) if m else "NOT_FOUND"
        except Exception as e:
            versions["changelog_md"] = f"ERROR: {e}"
    else:
        missing_files.append("CHANGELOG.md")

    # Check parity
    unique_versions = set(v for v in versions.values() if not v.startswith("ERROR:") and v != "NOT_FOUND")
    has_drift = len(unique_versions) > 1 or len(missing_files) > 0 or any(v in ("NOT_FOUND", "") for v in versions.values())
    canonical_version = next(iter(unique_versions)) if unique_versions else "UNKNOWN"

    return {
        "status": "PASS" if not has_drift else "DRIFT_DETECTED",
        "canonical_version": canonical_version,
        "is_synchronized": not has_drift,
        "components": versions,
        "missing_files": missing_files,
    }


def format_version_text(result: Dict[str, Any]) -> None:
    print("=====================================================================")
    print(" SMRITI Retail OS — Version SSOT Verification")
    print("=====================================================================")
    print(f" Status            : {result['status']}")
    print(f" Canonical Version : {result['canonical_version']}")
    print("---------------------------------------------------------------------")
    for comp, ver in result["components"].items():
        print(f" - {comp:<24}: {ver}")
    if result["missing_files"]:
        print(" Missing files:")
        for mf in result["missing_files"]:
            print(f"   [!] {mf}")
    print("=====================================================================")


def run_version_cmd(args: argparse.Namespace) -> int:
    repo_root = find_repo_root()
    result = inspect_versions(repo_root)
    output_result(result, as_json=args.as_json, text_formatter=format_version_text)
    return 0 if result["is_synchronized"] else 1
