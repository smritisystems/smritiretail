"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

#!/usr/bin/env python3
"""
Project      : SMRITI Retail OS
Module       : Layout Governance Linter (SLGP-001 v2.0 Compliance Engine)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 5.4.0
"""

import os
import sys
import re

PROHIBITED_PATTERNS = [
    (r'\bh-screen\b', "Rule SLGP-R2: Prohibited 'h-screen'. Use 'h-full' or 'flex-1 min-h-0'."),
    (r'\b100vh\b', "Rule SLGP-R2: Prohibited '100vh'. Use 'h-full' or 'flex-1 min-h-0'."),
    (r'\bmin-h-screen\b', "Rule SLGP-R2: Prohibited 'min-h-screen'. Use 'w-full h-full'."),
    (r'\bw-screen\b', "Rule SLGP-R6: Prohibited 'w-screen'. Use 'w-full'."),
    (r'\b100vw\b', "Rule SLGP-R6: Prohibited '100vw'. Use 'w-full'.")
]

ALLOWED_EXCEPTIONS = [
    "App.tsx",
    "layout_manager.tsx",
    "layoutService.ts",
    "LayoutInspectorOverlay.tsx",
    "LoginScreen.tsx",
    "PasswordResetScreen.tsx",
    "SmritiOfficialWebsite.tsx",
    "SmritiLiveDocsPortal.tsx",
    "CustomerWorkspacePortal.tsx",
    "TaxInvoicePrintPage.tsx",
    "SEDSAppShell.tsx",
    "SEEFDialog.tsx"
]

def scan_file(filepath):
    errors = []
    basename = os.path.basename(filepath)
    if basename in ALLOWED_EXCEPTIONS:
        return errors

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    for line_num, line in enumerate(lines, 1):
        # Skip comment lines
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue

        for pattern, msg in PROHIBITED_PATTERNS:
            if re.search(pattern, line):
                errors.append(f"  {filepath}:{line_num}: {msg}\n    Line: {stripped}")

    return errors

def main():
    target_dir = os.path.join(os.getcwd(), "src")
    if not os.path.exists(target_dir):
        print(f"Directory not found: {target_dir}")
        sys.exit(1)

    print("=== SMRITI LAYOUT GOVERNANCE LINTER (SLGP-001 v2.0) ===")
    total_files = 0
    all_errors = []

    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith(".tsx") or file.endswith(".ts") or file.endswith(".jsx") or file.endswith(".js"):
                total_files += 1
                filepath = os.path.join(root, file)
                errs = scan_file(filepath)
                all_errors.extend(errs)

    print(f"Scanned {total_files} component files in src/...")

    if all_errors:
        print(f"\n[FAIL] LINTER FAILED: Found {len(all_errors)} Layout Rule Violations:\n")
        for err in all_errors:
            print(err)
        sys.exit(1)
    else:
        print("\n[OK] LINTER PASSED: Zero layout governance violations found in src/.")
        sys.exit(0)

if __name__ == "__main__":
    main()
