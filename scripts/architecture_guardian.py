#!/usr/bin/env python3
"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Architecture Audit & Governance Tool
"""

import os
import re
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

def run_architecture_audit():
    print("=" * 80)
    print(" [SMRITI ARCHITECTURE GUARDIAN AUDIT REPORT]")
    print("=" * 80)

    # 1. Count Domain Modules across 4 Tiers
    core_dir = WORKSPACE_ROOT / "backend" / "app"
    frontend_dir = WORKSPACE_ROOT / "src"
    
    platform_api_modules = 0
    workspace_modules = 0
    portal_modules = 0
    website_modules = 0

    if core_dir.exists():
        for item in core_dir.rglob("*.py"):
            if item.is_file() and not item.name.startswith("__"):
                platform_api_modules += 1

    if frontend_dir.exists():
        for item in frontend_dir.rglob("*.tsx"):
            path_str = str(item).lower()
            if "website" in path_str or "landing" in path_str:
                website_modules += 1
            elif "portal" in path_str or "license" in path_str:
                portal_modules += 1
            else:
                workspace_modules += 1

    print(f"\nFour-Tier Module Inventory Breakdown:")
    print(f"  [+] 1. SMRITI Website (Marketing & Docs):      {website_modules}")
    print(f"  [+] 2. SMRITI Portal (Customer Self-Service):  {portal_modules}")
    print(f"  [+] 3. SMRITI Workspace (Retail Operations):  {workspace_modules}")
    print(f"  [+] 4. SMRITI Platform API (Core Engine):     {platform_api_modules}")

    issues = []

    # 2. Check for Direct Raw Fetch in Frontend (bypassing apiFetch / apiFetchV1)
    fetch_pattern = re.compile(r'\bfetch\s*\(')
    if frontend_dir.exists():
        for file in frontend_dir.rglob("*.ts*"):
            if file.name in ["apiFetch.ts", "apiFetchV1.ts", "patchFetch.ts"]:
                continue
            try:
                content = file.read_text(encoding="utf-8", errors="ignore")
                matches = fetch_pattern.findall(content)
                if matches:
                    rel_path = file.relative_to(WORKSPACE_ROOT)
                    issues.append(f"[-] Raw `fetch()` detected in `{rel_path}` -- MUST use `apiFetch.ts` or `apiFetchV1.ts`.")
            except Exception:
                pass

    # 3. Check for Direct DB Engine Creation outside backend/app/db
    if core_dir.exists():
        for file in core_dir.rglob("*.py"):
            if "backend/app/db" in file.as_posix() or "backend/app/tests" in file.as_posix():
                continue
            try:
                content = file.read_text(encoding="utf-8", errors="ignore")
                if "create_async_engine" in content and "sessionmaker" in content:
                    rel_path = file.relative_to(WORKSPACE_ROOT)
                    issues.append(f"[-] Direct DB engine initialization in `{rel_path}` -- MUST use `backend/app/db/session.py`.")
            except Exception:
                pass

    print("\nArchitecture Boundary Scan Results:")
    if not issues:
        print("  [+] PERFECT ARCHITECTURE HEALTH -- Zero boundary violations detected!")
    else:
        print(f"  [!] Found {len(issues)} issue(s):")
        for issue in issues:
            print(f"    {issue}")

    print("\n" + "=" * 80)
    print(" AUDIT STATUS: COMPLETED SUCCESSFULLY")
    print("=" * 80)
    return 0

if __name__ == "__main__":
    sys.exit(run_architecture_audit())
