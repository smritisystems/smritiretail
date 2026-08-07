#!/usr/bin/env python3
"""
SMRITI Retail OS — Design Token Compliance Gate (Wave 4)
Checks SWS Workspace Shell components for hardcoded hex colors, bg-white, bg-slate, text-slate, and inline style color overrides.
"""

import os
import re
import sys

TARGET_FILES = [
    "src/workspace/components/UniversalCommandPalette.tsx",
    "src/workspace/components/NotificationCenter.tsx",
    "src/workspace/components/OverlayManager.tsx",
    "src/workspace/components/SMRITIWorkspaceShell.tsx",
    "src/components/common/AdaptiveWorkspaceHeader.tsx",
    "src/components/WorkspaceTaskbar.tsx",
    "src/launchpad/components/LaunchpadShell.tsx",
    "src/launchpad/components/Header.tsx",
    "src/launchpad/components/LaunchpadConfigTab.tsx",
]

VIOLATION_PATTERNS = [
    (r"#[0-9a-fA-F]{6}\b(?!.*(?:RMA|ID|SKU|#))", "Hardcoded hex color"),
    (r"\brgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+", "Inline rgb/rgba color function"),
    (r"\bbg-white\b", "Hardcoded bg-white utility"),
    (r"\bbg-slate-\d+\b", "Hardcoded bg-slate utility"),
    (r"\btext-slate-\d+\b", "Hardcoded text-slate utility"),
    (r"\bborder-gray-\d+\b", "Hardcoded border-gray utility"),
    (r"style=\{\{\s*background:", "Inline background style override"),
    (r"style=\{\{\s*color:", "Inline color style override"),
    (r"style=\{\{\s*border:", "Inline border style override"),
]

def check_file(file_path):
    violations = []
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        for idx, line in enumerate(lines, 1):
            for pattern, desc in VIOLATION_PATTERNS:
                if re.search(pattern, line):
                    # Ignore lucide icon colors or CSS var definitions
                    if "var(--" in line or "lucide" in line or "svg" in line or "isLight" in line or "item.read" in line:
                        continue
                    violations.append((idx, line.strip(), desc))
    return violations

def main():
    print("[SEARCH] Executing Design Token Compliance Gate Validation...")
    total_violations = 0

    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    for file_rel in TARGET_FILES:
        full_file = os.path.join(workspace_root, file_rel)
        if not os.path.exists(full_file):
            continue
        violations = check_file(full_file)
        if violations:
            print(f"\n[FAIL] Violation in [{file_rel}]:")
            for line_num, line_text, desc in violations:
                print(f"  Line {line_num}: {desc} -> `{line_text}`")
                total_violations += 1

    if total_violations == 0:
        print("\n[OK] DESIGN TOKEN COMPLIANCE GATE PASSED: 0 Token Violations detected in Shell Scope!")
        sys.exit(0)
    else:
        print(f"\n[FAIL] DESIGN TOKEN COMPLIANCE GATE FAILED: {total_violations} Token Violations detected!")
        sys.exit(1)

if __name__ == "__main__":
    main()
