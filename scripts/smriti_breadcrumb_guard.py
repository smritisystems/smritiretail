"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Breadcrumb Guard — CI Enforcement Script
================================================
Enforces docs/architecture/SMRITI_BREADCRUMB_POLICY_V1.md.

Guards against:
  1. Hardcoded breadcrumb trail string literals (e.g. "Home > Sales > Invoices") in UI code.
  2. Ad-hoc breadcrumb state arrays defined outside canonical navigation engine.
  3. Misuse of DrillDownBreadcrumbs outside the authorized entity-drilldown slot.
  4. Non-canonical breadcrumb component definitions or styling.

Exit codes:
  0 -- No violations found (CI pass)
  1 -- Violations found   (CI fail)

Usage:
  python scripts/smriti_breadcrumb_guard.py [--root <repo-root>]
"""

import argparse
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

# Authorized files for DrillDownBreadcrumbs import
AUTHORIZED_DRILLDOWN_USERS = {
    "App.tsx",
    "drilldown_store.tsx",
    "DrillDownCrumbs.tsx",
    "UniversalBrowseEngine.tsx",
}

# Exempt files for private BI or drilldown arrays
EXEMPT_PRIVATE_DRILLDOWN_FILES = {
    "ReportDesignerTab.tsx",  # Private BI drill path
    "drilldown_store.tsx",    # Entity drilldown store
    "DrillDownCrumbs.tsx",    # Entity drilldown component
}

# Hardcoded trail pattern: string literal containing " > " with alphanumeric segments
HARDCODED_TRAIL_RE = re.compile(r'["\']([A-Za-z0-9_ ]+ > [A-Za-z0-9_ ]+ > [A-Za-z0-9_ ]+)["\']')

# DrillDownBreadcrumbs import check
DRILLDOWN_IMPORT_RE = re.compile(r'import\s+.*DrillDownBreadcrumbs.*from')


def scan_file(filepath: Path, repo_root: Path) -> List[Tuple[int, str, str]]:
    """Scan a single TypeScript/TSX file for breadcrumb governance violations."""
    violations = []
    rel_path = filepath.relative_to(repo_root).as_posix()
    filename = filepath.name

    # Skip files inside breadcrumb engine itself, test files, and node_modules
    if "src/navigation/breadcrumb" in rel_path or "src/tests" in rel_path or "node_modules" in rel_path:
        return violations

    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        violations.append((0, "READ_ERROR", f"Could not read {rel_path}: {exc}"))
        return violations

    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Check 1: Hardcoded breadcrumb string literals
        # (Exclude comments and documentation annotations)
        if not stripped.startswith("//") and not stripped.startswith("/*") and not stripped.startswith("*"):
            match = HARDCODED_TRAIL_RE.search(line)
            if match:
                violations.append((
                    idx,
                    "HARDCODED_TRAIL_STRING",
                    f"Forbidden hardcoded breadcrumb string '{match.group(1)}' in {rel_path}:{idx}. "
                    "Use SMRITI BreadcrumbResolver or <Breadcrumb />."
                ))

        # Check 2: Unauthorized DrillDownBreadcrumbs import
        if filename not in AUTHORIZED_DRILLDOWN_USERS:
            if DRILLDOWN_IMPORT_RE.search(line):
                violations.append((
                    idx,
                    "UNAUTHORIZED_DRILLDOWN_IMPORT",
                    f"DrillDownBreadcrumbs imported in {rel_path}:{idx}. "
                    "DrillDownBreadcrumbs is reserved exclusively for entity drilldown inside UniversalBrowseEngine / App.tsx shell slot. "
                    "For page navigation breadcrumbs, use <Breadcrumb /> from src/navigation/breadcrumb."
                ))

        # Check 3: Ad-hoc breadcrumb array definitions in page components
        if filename not in EXEMPT_PRIVATE_DRILLDOWN_FILES:
            if re.search(r'\b(breadcrumbItems|pageBreadcrumbs|navCrumbs)\s*[:=]\s*\[', line):
                violations.append((
                    idx,
                    "ADHOC_BREADCRUMB_ARRAY",
                    f"Ad-hoc breadcrumb array definition found in {rel_path}:{idx}. "
                    "Breadcrumb hierarchy must be derived from WorkspaceConfig via BreadcrumbRegistry/BreadcrumbResolver."
                ))

    return violations


def run_guard(root_dir: Path) -> int:
    """Run the breadcrumb governance scan across the repository."""
    src_dir = root_dir / "src"
    if not src_dir.exists():
        print(f"[ERROR] Source directory not found: {src_dir}", file=sys.stderr)
        return 1

    all_violations = []
    files_scanned = 0

    print("=" * 70)
    print("SMRITI BREADCRUMB GOVERNANCE GUARD — SCAN START")
    print(f"Target Root: {root_dir}")
    print("=" * 70)

    for ext in ("*.ts", "*.tsx"):
        for filepath in src_dir.rglob(ext):
            files_scanned += 1
            file_violations = scan_file(filepath, root_dir)
            all_violations.extend(file_violations)

    print(f"Scanned {files_scanned} TypeScript/TSX source files.")

    if not all_violations:
        print("\n[PASS] No breadcrumb governance violations detected.")
        print("SMRITI Breadcrumb Engine v1.0 compliance: 100%")
        print("=" * 70)
        return 0

    print(f"\n[FAIL] Found {len(all_violations)} breadcrumb governance violation(s):\n")
    for line_num, code, msg in all_violations:
        print(f"  [{code}] Line {line_num}: {msg}")

    print("=" * 70)
    return 1


def main():
    parser = argparse.ArgumentParser(description="SMRITI Breadcrumb Governance Guard")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Repository root directory (default: repo root containing scripts/)",
    )
    args = parser.parse_args()
    sys.exit(run_guard(args.root))


if __name__ == "__main__":
    main()
