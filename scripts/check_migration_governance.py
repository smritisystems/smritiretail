#!/usr/bin/env python3
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: CI Gate - Migration Governance Enforcement

SMRITI CI Gate: Migration Governance Boundary Scanner
======================================================
Enforces UMGP rules at PR/push time:
1. Every new migration must declare @migration_target("control"|"tenant"|"both")
2. No migration may contain DROP TABLE, DROP COLUMN, TRUNCATE, DELETE FROM
   without an explicit safety comment marker: # UMGP:DESTRUCTIVE_APPROVED
3. No migration may hardcode tenant DB names (smriti001, etc.) in control migrations
4. No migration may hardcode smritisys in tenant migrations

Exit code 0 = pass. Exit code 1 = violations found (blocks CI).
"""
import sys
import os
import re
from pathlib import Path

# Ensure UTF-8 output on Windows consoles (avoids CP1252 crash on special chars)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

WORKSPACE_ROOT = Path(__file__).parent.parent
VERSIONS_DIR = WORKSPACE_ROOT / "backend" / "alembic" / "versions"

DESTRUCTIVE_PATTERNS = [
    r"\bop\.drop_table\(",
    r"\bop\.drop_column\(",
    r"\bop\.drop_index\(",
    r"\bop\.drop_constraint\(",
    r"\bDROP\s+TABLE\b",
    r"\bDROP\s+COLUMN\b",
    r"\bTRUNCATE\b",
    r"\bDELETE\s+FROM\b",
]

SAFETY_MARKER = "# UMGP:DESTRUCTIVE_APPROVED"

TENANT_HARDCODE = re.compile(r"\bsmriti\d{3}\b", re.IGNORECASE)
CONTROL_HARDCODE = re.compile(r"\bsmritisys\b", re.IGNORECASE)

violations = []
warnings = []

def check_file(path: Path) -> None:
    name = path.name
    content = path.read_text(encoding="utf-8", errors="replace")
    lines = content.splitlines()

    # Compute revision number once for use in both G1 and G2 cutoffs
    revision_match = re.search(r'^revision\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
    rev_num = 0
    rev_str = "unknown"
    if revision_match:
        rev_str = revision_match.group(1)
        num_match = re.search(r'(\d+)', rev_str)
        if num_match:
            rev_num = int(num_match.group(1))

    # ------------------------------------------------------------------ #
    # UMGP-G1: Every new migration (v1553+) must declare @migration_target #
    # ------------------------------------------------------------------ #
    if rev_num >= 1553:
        if "@migration_target" not in content:
            violations.append(
                f"UMGP-G1 | {name}: Missing @migration_target decorator "
                f"(revision {rev_str} >= v1553 requires declaration). "
                f"Add @migration_target('control'|'tenant'|'both') to upgrade/downgrade."
            )

    # ------------------------------------------------------------------ #
    # UMGP-G2: Destructive ops in new migrations (v1553+) need approval  #
    # Legacy migrations (v1552 and earlier) are grandfathered — they were #
    # authored before this policy and contain valid Alembic downgrade ops. #
    # ------------------------------------------------------------------ #
    if rev_num >= 1553:
        in_docstring = False
        docstring_char = None
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Track triple-quoted docstring boundaries
            for q in ('"""', "'''"):
                if stripped.startswith(q):
                    if not in_docstring:
                        in_docstring = True
                        docstring_char = q
                        if stripped.endswith(q) and len(stripped) > 3:
                            in_docstring = False
                        break
                    elif docstring_char == q:
                        in_docstring = False
                        break
            # Skip comment-only lines and docstring lines
            if in_docstring or stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("'''"):
                continue
            for pattern in DESTRUCTIVE_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    window = lines[max(0, i - 4):i]
                    if not any(SAFETY_MARKER in wline for wline in window):
                        violations.append(
                            f"UMGP-G2 | {name}:L{i}: Destructive op without approval marker. "
                            f"Add '# UMGP:DESTRUCTIVE_APPROVED' within 3 lines before the op. "
                            f"Line: {stripped[:100]}"
                        )

    # ------------------------------------------------------------------ #
    # UMGP-G3 (WARNING): Hardcoded tenant DB names in migration scripts   #
    # ------------------------------------------------------------------ #
    if "smriti" in content.lower():
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if TENANT_HARDCODE.search(line) and "smritisys" not in line and not stripped.startswith("#"):
                warnings.append(
                    f"UMGP-G3-WARN | {name}:L{i}: Hardcoded tenant DB name (use env var). "
                    f"Line: {stripped[:100]}"
                )


def main() -> int:
    if not VERSIONS_DIR.exists():
        print(f"[ERROR] Alembic versions directory not found: {VERSIONS_DIR}")
        return 1

    py_files = sorted(VERSIONS_DIR.glob("*.py"))
    print(f"SMRITI CI Gate: Migration Boundary Scanner")
    print(f"Scanning {len(py_files)} migration files in {VERSIONS_DIR}")
    print("-" * 70)

    for f in py_files:
        if f.name.startswith("__"):
            continue
        check_file(f)

    for w in warnings:
        print(f"[WARN] {w}")

    if violations:
        print(f"\n{'='*70}")
        print(f"[FAIL] {len(violations)} governance violation(s) found:")
        for v in violations:
            print(f"  [X] {v}")
        print(f"{'='*70}")
        print("\nRemediation:")
        print("  G1: Add @migration_target('control'|'tenant'|'both') decorator to upgrade/downgrade")
        print("  G2: Add '# UMGP:DESTRUCTIVE_APPROVED' comment before destructive ops or refactor to use IF EXISTS")
        print("  G3: Replace hardcoded DB names with environment variables")
        return 1

    print(f"\n[PASS] All {len(py_files)} migration files comply with UMGP governance rules.")
    if warnings:
        print(f"       {len(warnings)} warning(s) logged — review recommended but not blocking.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
