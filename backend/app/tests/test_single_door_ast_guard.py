"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Single-Door Stock Ledger AST Static Analysis Guard Verification Tests
"""

import sys
from pathlib import Path

# Add scripts directory to path to import guard directly
repo_root = Path(__file__).resolve().parent.parent.parent.parent
scripts_dir = repo_root / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

import ci_stock_single_door_guard as guard


def test_ast_guard_detects_forbidden_direct_insert():
    fixture = repo_root / "backend" / "app" / "tests" / "single_door_fixtures" / "forbidden_direct_insert.py"
    violations = guard.check_file(fixture, repo_root)
    assert len(violations) >= 1
    rules = [v["rule"] for v in violations]
    assert "DIRECT_STOCK_MOVEMENT_INSTANTIATION" in rules


def test_ast_guard_detects_forbidden_stock_assign():
    fixture = repo_root / "backend" / "app" / "tests" / "single_door_fixtures" / "forbidden_stock_assign.py"
    violations = guard.check_file(fixture, repo_root)
    assert len(violations) >= 1
    rules = [v["rule"] for v in violations]
    assert "DIRECT_PRODUCT_STOCK_ASSIGNMENT" in rules


def test_ast_guard_detects_forbidden_raw_sum():
    fixture = repo_root / "backend" / "app" / "tests" / "single_door_fixtures" / "forbidden_raw_sum.py"
    violations = guard.check_file(fixture, repo_root)
    assert len(violations) >= 1
    rules = [v["rule"] for v in violations]
    assert "RAW_STOCK_SUM_VIOLATION" in rules


def test_ast_guard_allows_compliant_single_door():
    fixture = repo_root / "backend" / "app" / "tests" / "single_door_fixtures" / "allowed_single_door.py"
    violations = guard.check_file(fixture, repo_root)
    assert len(violations) == 0
