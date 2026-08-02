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

﻿"""
test_architecture_rule1.py
RC2 Platform Rule #1 Architectural Guard

Fails the build if any service file contains a direct assignment to
`product.stock` or `prod.stock` (or equivalent) outside the explicitly
approved allowlist.

Rule: No engine may update `products.stock` directly except through the
Inventory State reconciliation pipeline (trg_inventory_state_reconciliation).

This test is NOT marked asyncio -- it is a pure static-analysis test.
It runs in under 1 second and must pass before any PR3 batch merges.
"""

import re
import pytest
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Root of the backend source tree (relative to this file: tests/ -> app/ -> backend/)
SERVICES_ROOT = Path(__file__).parent.parent / "services"

# Files that are PERMITTED to contain direct stock mutations.
# Each entry is a (relative_path_suffix, reason) tuple.
ALLOWLIST: list[tuple[str, str]] = [
    # The reconciliation pipeline comment block -- contains the rule text, no assignment
    ("inventory/state_engine.py", "RC2 reconciliation pipeline -- comment only, no assignment"),
    # Legacy fix script -- deprecated, carries explicit warning header
    ("../fix_stock_trigger.py", "Deprecated emergency-only script with deprecation header"),
]

# Regex that matches direct product.stock assignment patterns
# Matches: product.stock =, product.stock +=, product.stock -=, prod.stock =, p.stock =
DIRECT_MUTATION_PATTERN = re.compile(
    r"\b(?:product|prod|p)\.stock\s*(?:[+\-]?=)"
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _is_allowlisted(filepath: Path) -> bool:
    """Return True if the file path matches any allowlist entry."""
    filepath_str = str(filepath).replace("\\", "/")
    for suffix, _ in ALLOWLIST:
        if filepath_str.endswith(suffix.replace("\\", "/")):
            return True
    return False


def _scan_services() -> list[tuple[str, int, str]]:
    """
    Walk SERVICES_ROOT and return (filepath, lineno, line_content)
    for every direct stock mutation found outside the allowlist.
    """
    violations: list[tuple[str, int, str]] = []

    if not SERVICES_ROOT.exists():
        return violations

    for py_file in sorted(SERVICES_ROOT.rglob("*.py")):
        if _is_allowlisted(py_file):
            continue

        lines = py_file.read_text(encoding="utf-8", errors="replace").splitlines()
        for lineno, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("'''"):
                continue
            if DIRECT_MUTATION_PATTERN.search(line):
                violations.append((str(py_file), lineno, line.rstrip()))

    return violations


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

def test_no_direct_product_stock_mutations():
    """
    RC2 Platform Rule #1 Guard.

    Asserts that no service file directly mutates `products.stock` outside
    the Inventory State reconciliation pipeline.

    If this test fails, a Rule #1 violation has been introduced. Fix it by:
    1. Removing the direct product.stock assignment.
    2. Ensuring the service inserts a StockMovement record with the correct
       movement_type. The trigger updates products.stock automatically.
    3. If the file must be temporarily exempt, add it to ALLOWLIST above with
       a clear reason and a PR reference.
    """
    violations = _scan_services()

    if violations:
        report_lines = [
            "",
            "=" * 65,
            "RC2 RULE #1 VIOLATION -- Direct product.stock mutation detected",
            "=" * 65,
            "",
            "Rule: products.stock may ONLY be modified by trigger",
            "      trg_inventory_state_reconciliation via stock_movements INSERT.",
            "",
            f"Found {len(violations)} violation(s):",
            "",
        ]
        for filepath, lineno, line in violations:
            report_lines.append(f"  {filepath}:{lineno}")
            report_lines.append(f"    {line.strip()}")
            report_lines.append("")

        report_lines += [
            "Fix: Remove the direct assignment. Insert a StockMovement record",
            "     with the correct movement_type. The trigger handles the rest.",
            "",
            "Allowlist exceptions are in ALLOWLIST at the top of this file.",
            "=" * 65,
        ]

        pytest.fail("\n".join(report_lines))
