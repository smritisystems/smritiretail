#!/usr/bin/env python3
"""
Project      : SMRITI Retail OS
Module       : SSOT Architecture Linter (GR-001 & ADR-003 Compliance Engine)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 5.4.0
"""

import os
import sys
import re

CROSS_MODULE_IMPORT_PATTERN = r'from\s+app\.modules\.\w+\.repositories\s+import'

def scan_python_file(filepath):
    errors = []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    for line_num, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if re.search(CROSS_MODULE_IMPORT_PATTERN, line):
            errors.append(
                f"  {filepath}:{line_num}: Violation of ADR-008 & Rule GR-003: Prohibited direct cross-module repository import.\n"
                f"    Line: {stripped}"
            )
    return errors

def main():
    backend_dir = os.path.join(os.getcwd(), "backend", "app")
    print("=== SMRITI SSOT ARCHITECTURE LINTER (GR-001 & ADR-003) ===")
    
    if not os.path.exists(backend_dir):
        print(f"Directory not found: {backend_dir}")
        sys.exit(1)

    py_files = 0
    all_errors = []

    for root, _, files in os.walk(backend_dir):
        for file in files:
            if file.endswith(".py"):
                py_files += 1
                filepath = os.path.join(root, file)
                errs = scan_python_file(filepath)
                all_errors.extend(errs)

    print(f"Scanned {py_files} Python backend files in backend/app/...")

    if all_errors:
        print(f"\n[FAIL] ARCHITECTURE LINTER FAILED: Found {len(all_errors)} SSOT Rule Violations:\n")
        for err in all_errors:
            print(err)
        sys.exit(1)
    else:
        print("\n[OK] ARCHITECTURE LINTER PASSED: Zero cross-module repository coupling violations found.")
        sys.exit(0)

if __name__ == "__main__":
    main()
