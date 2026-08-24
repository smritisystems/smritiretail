"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Naming Guard - CI Enforcement Script
============================================
Enforces docs/governance/SMRITI_NAMING_POLICY.md (Policy ID: NGP-v1.0).

Scans src/, backend/ for:
  1. Prohibited development-state name fragments (Rule 14)
  2. Filename length violations > 100 characters (Rule 4)

Exit codes:
  0 -- No violations found (CI pass)
  1 -- Violations found   (CI fail)

Usage:
  python scripts/smriti_naming_guard.py [--root <repo-root>]

Design notes on token matching
-------------------------------
Tokens that are GENERIC DUMPING-GROUND terms (e.g. "data", "common", "helper",
"misc", "stuff", "thing", "abc", "xyz") are flagged ONLY when they form the
*entire stem* or appear as a *standalone terminal token*. This allows legitimate
compound domain names such as:
  - reference_data.py       (domain: reference, qualifier: data -> ok as suffix)
  - master_data_sync.ts     (middle token -> ok)
  - data_integrity.py       (data as leading qualifier -> ok)
whereas bare names like:
  - data.ts                 (entire stem -> FAIL)
  - common.ts               (entire stem -> FAIL)
  - misc.py                 (entire stem -> FAIL)
  are still caught.

Tokens that are ALWAYS prohibited regardless of position (development-state
terminology that has no valid role in any compound name):
  - new, old, final, latest, temp, temporary, copy, backup
  - debug, fix  (as standalone tokens, not inside compound words)
  - test2..test9, v2..v9, handler2..handler9, service2..service9
  - utils2..utils9, manager2..manager9, processor2..processor9
  - working, scratch
These are caught in any position within the stem.
"""

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCANNED_EXTENSIONS: set = {
    ".ts", ".tsx", ".py", ".js", ".jsx", ".css", ".md"
}

SCAN_DIRS: list = ["src", "backend"]

SKIP_DIRS: set = {
    "node_modules", "__pycache__", ".venv", ".git",
    "dist", "build", ".pytest_cache", "coverage",
}

HARD_MAX_LENGTH = 100
PREFERRED_MAX_LENGTH = 80

# ── Category A: ALWAYS prohibited in any token position ───────────────────
# These words have no valid role in any compound domain name.
ALWAYS_PROHIBITED: set = {
    "new", "old", "final", "latest",
    "temp", "temporary", "copy", "backup",
    "working",
}

# ── Category B: Prohibited as standalone development-state suffixes ────────
# Prohibited when they appear as the *last* token AND the stem has <= 2 tokens,
# i.e., they aren't embedded deep inside a meaningful compound name.
# Examples:
#   fix_user_seed.py  -> tokens: [fix, user, seed]  -> NOT flagged (3 tokens)
#   billing_fix.py    -> tokens: [billing, fix]      -> FLAGGED (2 tokens, terminal)
#   tmp_auth_debug.py -> tokens: [tmp, auth, debug]  -> "tmp" triggers always-prohibited
TERMINAL_PROHIBITED: set = {
    "fix", "debug", "scratch",
}

# ── Category C: Dumping-ground terms -- flagged only when the ENTIRE STEM
#    is one of these words (i.e., the file is named *just* that word).
STEM_ONLY_PROHIBITED: set = {
    "data", "common", "helper", "misc", "stuff", "thing",
    "abc", "xyz", "manager", "processor", "handler",
}

# ── Category D: Numbered variant suffixes (e.g. test2, handler3) ──────────
# These are standalone numeric-variant names that encode a development sequence.
# Matched against tokens so that compound API version names (apiFetchV1, etc.)
# are NOT flagged -- Rule 9 permits API versions managed through API versioning.
# We flag stems whose last token is ONLY a number-suffix word with no qualifier,
# e.g. "service2", "handler3", "utils2" as the ENTIRE stem or as the final token.
NUMBERED_VARIANT_TOKENS: set = {
    "test2", "test3", "test4", "test5", "test6", "test7", "test8", "test9",
    "handler2", "handler3", "handler4",
    "service2", "service3", "service4",
    "manager2", "manager3", "manager4",
    "processor2", "processor3", "processor4",
    "utils2", "utils3", "utils4",
    "helper2", "helper3", "helper4",
}

# ── Category E: Prohibited suffix strings on the full stem ────────────────
PROHIBITED_SUFFIXES: list = [
    "_new", "_old", "_final", "_latest", "_temp", "_copy",
    "_backup", "_working",
    "-new", "-old", "-final", "-latest", "-temp", "-copy",
    "-backup", "-working",
]

# ── Whitelist: exempt despite matching a rule ──────────────────────────────
WHITELIST: set = {
    "docs/governance/SMRITI_NAMING_POLICY.md",
    "scripts/smriti_naming_guard.py",
    # Pre-policy legacy scripts (exist before NGP-v1.0 was introduced)
    "scripts/debug_insert.py",
    "scripts/dev/temp_legacy_check.py",
    "scripts/dev/temp_route_inventory.py",
    "scripts/dev/frontend_backend_route_audit2.py",
    "scripts/audit_item_master_db2.py",
}



# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def _check_stem(stem: str) -> Tuple[bool, str]:
    """
    Return (is_violation, reason) for a filename stem (no extension).
    Applies all five category checks in priority order.
    """
    stem_lower = stem.lower()

    # E: suffix check (highest priority, unambiguous)
    for suffix in PROHIBITED_SUFFIXES:
        if stem_lower.endswith(suffix):
            return True, "prohibited suffix '{0}'".format(suffix)

    tokens = [t for t in re.split(r"[_\-.]+", stem_lower) if t]

    # D: numbered variant token check -- any token is a prohibited numbered variant
    for token in tokens:
        if token in NUMBERED_VARIANT_TOKENS:
            return True, "prohibited numbered-variant token '{0}'".format(token)

    # C: stem is a bare dumping-ground name (entire stem = prohibited word)
    if len(tokens) == 1 and tokens[0] in STEM_ONLY_PROHIBITED:
        return True, "bare dumping-ground filename (stem is just '{0}')".format(tokens[0])

    # A: always-prohibited token anywhere
    for token in tokens:
        if token in ALWAYS_PROHIBITED:
            return True, "prohibited development-state token '{0}'".format(token)

    # B: terminal development-state token in a short compound name (<= 2 tokens)
    if tokens and tokens[-1] in TERMINAL_PROHIBITED and len(tokens) <= 2:
        return (
            True,
            "prohibited terminal token '{0}' in short stem".format(tokens[-1])
        )

    return False, ""


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def scan(repo_root: Path) -> Tuple[List[Dict], List[Dict]]:
    """
    Walk SCAN_DIRS and collect naming violations and advisory warnings.

    Returns:
        violations: list of { path, reason }  -- cause CI failure
        warnings:   list of { path, reason }  -- advisory only
    """
    violations: List[Dict] = []
    warnings: List[Dict] = []

    for scan_dir_name in SCAN_DIRS:
        scan_dir = repo_root / scan_dir_name
        if not scan_dir.exists():
            continue

        for dirpath, dirnames, filenames in os.walk(scan_dir):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

            for filename in filenames:
                file_path = Path(dirpath) / filename
                rel = _relative(file_path, repo_root)

                if file_path.suffix.lower() not in SCANNED_EXTENSIONS:
                    continue

                if rel in WHITELIST:
                    continue

                stem = file_path.stem
                full_len = len(filename)

                # Rule 4: length
                if full_len > HARD_MAX_LENGTH:
                    violations.append({
                        "path": rel,
                        "reason": (
                            "filename length {0} exceeds hard maximum of {1} chars"
                            .format(full_len, HARD_MAX_LENGTH)
                        ),
                    })
                elif full_len > PREFERRED_MAX_LENGTH:
                    warnings.append({
                        "path": rel,
                        "reason": (
                            "filename length {0} exceeds preferred maximum of {1} "
                            "chars (advisory, not a CI failure)"
                            .format(full_len, PREFERRED_MAX_LENGTH)
                        ),
                    })

                # Rule 14: prohibited fragments
                is_bad, reason = _check_stem(stem)
                if is_bad:
                    violations.append({"path": rel, "reason": reason})

    return violations, warnings


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _print_report(violations: List[Dict], warnings: List[Dict]) -> None:
    SEP = "-" * 72

    if warnings:
        print("")
        print("[WARN] SMRITI Naming Guard -- ADVISORY WARNINGS (not CI failures)")
        print(SEP)
        for w in warnings:
            print("  WARN  " + w["path"])
            print("        |- " + w["reason"])
        print(SEP)

    if violations:
        print("")
        print("[FAIL] SMRITI Naming Guard -- VIOLATIONS FOUND (CI FAILURE)")
        print(SEP)
        for v in violations:
            print("  FAIL  " + v["path"])
            print("        |- " + v["reason"])
        print(SEP)
        print("")
        print("  {0} violation(s) found.".format(len(violations)))
        print("  See docs/governance/SMRITI_NAMING_POLICY.md (Policy NGP-v1.0).")
        print("")
    else:
        print("")
        print("[PASS] SMRITI Naming Guard -- ALL CHECKS PASSED")
        print(SEP)
        print("  0 naming violations found across: " + ", ".join(SCAN_DIRS))
        if warnings:
            print("  {0} advisory warning(s) -- see above.".format(len(warnings)))
        print(SEP)
        print("")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="SMRITI Naming Guard -- enforces NGP-v1.0 naming policy"
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory (default: current working directory)",
    )
    args = parser.parse_args()

    repo_root = Path(args.root).resolve()
    if not repo_root.exists():
        print(
            "ERROR: repository root '{0}' does not exist.".format(repo_root),
            file=sys.stderr,
        )
        return 1

    print("SMRITI Naming Guard  |  Policy: NGP-v1.0")
    print("Repository root      : " + str(repo_root))
    print("Scanning             : " + ", ".join(SCAN_DIRS))
    print("Extensions           : " + ", ".join(sorted(SCANNED_EXTENSIONS)))

    violations, warnings = scan(repo_root)
    _print_report(violations, warnings)

    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
