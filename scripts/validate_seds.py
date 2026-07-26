#!/usr/bin/env python3
"""
Project      : SMRITI Business OS
Product      : SMRITI Enterprise Design System (SEDS)
Script       : SEDS CI/CD Legacy UI Enforcement Linter
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Classification: Internal CI/CD Governance Linter
"""

import os
import re
import sys

TARGET_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "components")

# Prohibited legacy Tailwind slate class patterns
PROHIBITED_PATTERNS = [
    re.compile(r'bg-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'text-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'border-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'ring-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'divide-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'from-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'to-slate-[0-9]+(/[0-9]+)?'),
    re.compile(r'via-slate-[0-9]+(/[0-9]+)?'),
]

# Excluded paths (e.g. documentation markdown or historical mocks if explicitly exempted)
EXCLUDED_SUBPATHS = [
    os.path.join("website"), # Public website product is an independent tier per AOP-002
]

def scan_file(filepath):
    violations = []
    rel_path = os.path.relpath(filepath, TARGET_DIR)
    
    # Check exclusions
    for exc in EXCLUDED_SUBPATHS:
        if exc in rel_path:
            return violations

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line_num, line in enumerate(f, 1):
            for pattern in PROHIBITED_PATTERNS:
                matches = pattern.findall(line)
                if matches or pattern.search(line):
                    match_str = pattern.search(line).group(0)
                    violations.append((rel_path, line_num, match_str, line.strip()))
    return violations

def main():
    print("======================================================================")
    print(" SMRITI Enterprise Design System (SEDS) CI/CD Governance Linter")
    print("======================================================================")
    
    total_violations = 0
    violating_files = set()
    
    abs_target = os.path.abspath(TARGET_DIR)
    print(f"Scanning target directory: {abs_target}\n")

    for root, _, files in os.walk(abs_target):
        for file in files:
            if file.endswith(".tsx") or file.endswith(".ts"):
                filepath = os.path.join(root, file)
                file_violations = scan_file(filepath)
                if file_violations:
                    violating_files.add(os.path.relpath(filepath, abs_target))
                    for rel_path, line_num, match_str, content in file_violations:
                        total_violations += 1
                        print(f"❌ [SEDS-VIOLATION] {rel_path}:{line_num} -> Found '{match_str}'")
                        print(f"   Snippet: {content[:100]}")

    print("\n----------------------------------------------------------------------")
    print(f"Total Prohibited Legacy Slate Violations: {total_violations}")
    print(f"Total Violating Files: {len(violating_files)}")
    print("----------------------------------------------------------------------")

    if total_violations > 0:
        print("\n❌ CI/CD RELEASE GATE FAILED: SEDS legacy token violations detected!")
        sys.exit(1)
    else:
        print("\n✅ CI/CD RELEASE GATE PASSED: Zero legacy UI slate violations found!")
        sys.exit(0)

if __name__ == "__main__":
    main()
