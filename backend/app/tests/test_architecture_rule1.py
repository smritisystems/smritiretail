"""
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

    If this test fails:
      1. Inspect the reported file and line number.
      2. If it is a real mutation, refactor to delegate to
         `trg_inventory_state_reconciliation`.
      3. If it is a legitimate false positive (e.g. a comment or test helper),
         add it to ALLOWLIST above with a clear justification.
    """
    violations = _scan_services()
    assert not violations, (
        f"RC2 Platform Rule #1 Violation: {len(violations)} unapproved direct stock mutation(s) found:\n"
        + "\n".join(f"  {path}:{line} -> {content}" for path, line, content in violations)
    )
