"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.31.0
Created      : 2026-09-16
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Governance & DevOps Tooling
"""

import sys
import json
import re
import argparse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

PACKAGE_JSON_PATH = ROOT_DIR / "package.json"
CONFIG_PY_PATH = ROOT_DIR / "backend" / "app" / "core" / "config.py"
FRONTEND_VERSION_PATH = ROOT_DIR / "src" / "config" / "version.ts"
CHANGELOG_PATH = ROOT_DIR / "CHANGELOG.md"


def get_package_json_version() -> str:
    with open(PACKAGE_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("version", "")


def get_config_py_version() -> str:
    with open(CONFIG_PY_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'VERSION:\s*str\s*=\s*["\']([^"\']+)["\']', content)
    if m:
        return m.group(1)
    return ""


def get_frontend_version() -> str:
    with open(FRONTEND_VERSION_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'export\s+const\s+APP_VERSION\s*=\s*["\']([^"\']+)["\']', content)
    if m:
        return m.group(1)
    return ""


def get_changelog_version() -> str:
    with open(CHANGELOG_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'###\s*\[([0-9]+\.[0-9]+\.[0-9]+[^\]]*)\]', content)
    if m:
        return m.group(1)
    return ""


def set_package_json_version(new_version: str):
    with open(PACKAGE_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["version"] = new_version
    with open(PACKAGE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def set_config_py_version(new_version: str):
    with open(CONFIG_PY_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = re.sub(
        r'(VERSION:\s*str\s*=\s*["\'])[^"\']+(["\'])',
        rf"\g<1>{new_version}\g<2>",
        content
    )
    with open(CONFIG_PY_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)


def set_frontend_version(new_version: str):
    with open(FRONTEND_VERSION_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(
        r'(export\s+const\s+APP_VERSION\s*=\s*["\'])[^"\']+(["\'])',
        rf"\g<1>{new_version}\g<2>",
        content
    )
    content = re.sub(
        r'(export\s+const\s+ENTERPRISE_BILLING_SUITE_VERSION\s*=\s*["\'])[^"\']+(["\'])',
        rf"\g<1>{new_version}\g<2>",
        content
    )
    with open(FRONTEND_VERSION_PATH, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    parser = argparse.ArgumentParser(description="Validate or bump SMRITI version across SSOT files.")
    parser.add_argument("--bump", type=str, help="Bump all locations to the specified semantic version")
    args = parser.parse_args()

    if args.bump:
        new_v = args.bump.strip()
        print(f"Bumping SMRITI Version SSOT to: {new_v}")
        set_package_json_version(new_v)
        set_config_py_version(new_v)
        set_frontend_version(new_v)
        print("Updated package.json, backend/app/core/config.py, and src/config/version.ts")

    pkg_v = get_package_json_version()
    cfg_v = get_config_py_version()
    fe_v = get_frontend_version()
    chg_v = get_changelog_version()

    print("--- SMRITI Version SSOT Inspection ---")
    print(f"package.json          : {pkg_v}")
    print(f"backend/core/config.py: {cfg_v}")
    print(f"src/config/version.ts : {fe_v}")
    print(f"CHANGELOG.md (head)   : {chg_v}")

    mismatches = []
    if pkg_v != cfg_v:
        mismatches.append(f"package.json ({pkg_v}) != config.py ({cfg_v})")
    if pkg_v != fe_v:
        mismatches.append(f"package.json ({pkg_v}) != version.ts ({fe_v})")
    if pkg_v != chg_v:
        mismatches.append(f"package.json ({pkg_v}) != CHANGELOG.md ({chg_v})")

    if mismatches:
        print("\n[FAIL] Version drift detected:")
        for m in mismatches:
            print(f"  - {m}")
        sys.exit(1)
    else:
        print(f"\n[PASS] Version SSOT consistent across all boundaries: {pkg_v}")
        sys.exit(0)


if __name__ == "__main__":
    main()
