#!/usr/bin/env python
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — CI Guard

SMRITI Single-Door Stock Ledger AST Static Analysis Guard
═════════════════════════════════════════════════════════
Static-analysis CI validation that enforces the SINGLE-DOOR Stock Ledger Architecture.
Scans source files across backend/app/ to prevent architectural regression:

1. Direct StockMovement creation or mutation (must route exclusively through StockLedger)
2. Direct product.stock assignment (must only be managed by StockSynchronizer)
3. Raw func.sum(StockMovement.quantity) (must route through get_signed_movement_quantity_expr)

Exit codes:
    0 = PASS — No violations detected
    1 = FAIL — Violations detected

Usage:
    python scripts/ci_stock_single_door_guard.py [--root /path/to/repo]
    python scripts/ci_stock_single_door_guard.py --file path/to/file.py
"""

import ast
import os
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Set


# ---------------------------------------------------------------------------
# Allowlist Configuration
# ---------------------------------------------------------------------------

# Paths permitted to instantiate or insert StockMovement directly
ALLOWED_STOCK_MOVEMENT_PATHS: Set[str] = {
    "backend/app/services/stock_ledger.py",
}

# Paths permitted to assign to product.stock or update Product(stock=...)
ALLOWED_STOCK_ASSIGN_PATHS: Set[str] = {
    "backend/app/services/stock_synchronizer.py",
    "backend/app/services/stock_ledger.py",
}

# Paths permitted to execute raw sum on StockMovement.quantity
ALLOWED_RAW_SUM_PATHS: Set[str] = {
    "backend/app/services/stock_ledger_query.py",
    "backend/app/services/stock_ledger.py",
    "backend/app/services/stock_synchronizer.py",
}


def _normalize_path(file_path: Path, root_path: Path) -> str:
    try:
        rel = file_path.resolve().relative_to(root_path.resolve())
        return str(rel).replace("\\", "/")
    except ValueError:
        return str(file_path).replace("\\", "/")


def is_allowed(rel_path: str, allowed_set: Set[str]) -> bool:
    # Always allow alembic migrations and core database seeders
    if "/alembic/" in rel_path or "alembic/" in rel_path:
        return True
    if "/db/ctrl_seeder" in rel_path or "/db/seed" in rel_path:
        return True
    # Test files are allowed unless they are forbidden test fixtures
    if "/tests/" in rel_path or "app/tests/" in rel_path:
        if "forbidden_" not in rel_path:
            return True

    for allowed in allowed_set:
        if rel_path == allowed or rel_path.endswith(allowed):
            return True
    return False


# ---------------------------------------------------------------------------
# AST Visitors
# ---------------------------------------------------------------------------

class SingleDoorASTVisitor(ast.NodeVisitor):
    def __init__(self, rel_path: str):
        self.rel_path = rel_path
        self.violations: List[Dict[str, Any]] = []

    def visit_Call(self, node: ast.Call):
        func_name = self._get_name(node.func)

        # Violation 1: Direct StockMovement instantiation: StockMovement(...)
        if func_name == "StockMovement":
            if not is_allowed(self.rel_path, ALLOWED_STOCK_MOVEMENT_PATHS):
                self.violations.append({
                    "rule": "DIRECT_STOCK_MOVEMENT_INSTANTIATION",
                    "file": self.rel_path,
                    "line": node.lineno,
                    "col": node.col_offset,
                    "message": (
                        "Direct StockMovement(...) instantiation detected. All stock mutations "
                        "must route exclusively through StockLedger.post() or StockLedger.post_many()."
                    ),
                })

        # Violation 1b: insert(StockMovement), update(StockMovement), delete(StockMovement)
        if func_name in ("insert", "update", "delete"):
            if node.args and self._get_name(node.args[0]) == "StockMovement":
                if not is_allowed(self.rel_path, ALLOWED_STOCK_MOVEMENT_PATHS):
                    self.violations.append({
                        "rule": "DIRECT_STOCK_MOVEMENT_QUERY_MUTATION",
                        "file": self.rel_path,
                        "line": node.lineno,
                        "col": node.col_offset,
                        "message": (
                            f"Direct {func_name}(StockMovement) statement detected. "
                            "Stock ledger entries are append-only and must route through StockLedger."
                        ),
                    })

        # Violation 2b: setattr(product, 'stock', ...)
        if func_name == "setattr" and len(node.args) >= 2:
            second_arg = node.args[1]
            if isinstance(second_arg, ast.Constant) and second_arg.value == "stock":
                if not is_allowed(self.rel_path, ALLOWED_STOCK_ASSIGN_PATHS):
                    self.violations.append({
                        "rule": "DIRECT_PRODUCT_STOCK_MUTATION",
                        "file": self.rel_path,
                        "line": node.lineno,
                        "col": node.col_offset,
                        "message": (
                            "Direct setattr(..., 'stock', ...) detected. "
                            "Cached product stock must only be updated via StockSynchronizer.sync_product_stock_cache()."
                        ),
                    })

        # Violation 3: func.sum(StockMovement.quantity)
        if func_name in ("func.sum", "sum"):
            for arg in node.args:
                arg_name = self._get_name(arg)
                if "StockMovement.quantity" in arg_name or arg_name == "StockMovement.quantity":
                    if not is_allowed(self.rel_path, ALLOWED_RAW_SUM_PATHS):
                        self.violations.append({
                            "rule": "RAW_STOCK_SUM_VIOLATION",
                            "file": self.rel_path,
                            "line": node.lineno,
                            "col": node.col_offset,
                            "message": (
                                "Raw func.sum(StockMovement.quantity) detected. "
                                "Must use get_signed_movement_quantity_expr or StockLedgerQuery to handle direction signs."
                            ),
                        })

        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        # Violation 2: target.stock = ...
        for target in node.targets:
            if isinstance(target, ast.Attribute) and target.attr == "stock":
                # Check target value name; e.g. product.stock, p.stock
                t_val_name = self._get_name(target.value).lower()
                # If target is product, prod, item, p, or generic object
                if not is_allowed(self.rel_path, ALLOWED_STOCK_ASSIGN_PATHS):
                    self.violations.append({
                        "rule": "DIRECT_PRODUCT_STOCK_ASSIGNMENT",
                        "file": self.rel_path,
                        "line": node.lineno,
                        "col": node.col_offset,
                        "message": (
                            f"Direct assignment to '{self._get_name(target)}' detected. "
                            "Cached stock must only be updated via StockSynchronizer.sync_product_stock_cache()."
                        ),
                    })

        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant):
        # Check raw SQL query strings for SUM(stock_movements.quantity)
        if isinstance(node.value, str):
            val_upper = node.value.upper()
            if "SUM(STOCK_MOVEMENTS.QUANTITY)" in val_upper or "SUM(SM.QUANTITY)" in val_upper:
                if not is_allowed(self.rel_path, ALLOWED_RAW_SUM_PATHS):
                    self.violations.append({
                        "rule": "RAW_SQL_SUM_VIOLATION",
                        "file": self.rel_path,
                        "line": node.lineno,
                        "col": node.col_offset,
                        "message": (
                            "Raw SQL SUM(stock_movements.quantity) detected. "
                            "Must use signed movement quantity logic."
                        ),
                    })

        self.generic_visit(node)

    def _get_name(self, node: ast.AST) -> str:
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            val_name = self._get_name(node.value)
            return f"{val_name}.{node.attr}" if val_name else node.attr
        elif isinstance(node, ast.Call):
            return self._get_name(node.func)
        return ""


# ---------------------------------------------------------------------------
# Runner & Scanner
# ---------------------------------------------------------------------------

def check_file(file_path: Path, root_path: Path, verbose: bool = False) -> List[Dict[str, Any]]:
    rel_path = _normalize_path(file_path, root_path)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        if verbose:
            print(f"[ci_stock_single_door_guard] Skipping {rel_path}: {e}")
        return []

    try:
        tree = ast.parse(content, filename=str(file_path))
    except SyntaxError as e:
        if verbose:
            print(f"[ci_stock_single_door_guard] SyntaxError in {rel_path}: {e}")
        return []

    visitor = SingleDoorASTVisitor(rel_path)
    visitor.visit(tree)
    return visitor.violations


def main():
    parser = argparse.ArgumentParser(description="SMRITI Single-Door Stock Ledger AST Static Analysis Guard")
    parser.add_argument("--root", type=str, default=".", help="Root directory of the repository")
    parser.add_argument("--file", type=str, help="Single file to check")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    root_path = Path(args.root).resolve()

    if args.file:
        files_to_check = [Path(args.file).resolve()]
    else:
        # Scan backend/app directory
        backend_app = root_path / "backend" / "app"
        if not backend_app.exists():
            backend_app = root_path / "app"
        if not backend_app.exists():
            backend_app = root_path

        files_to_check = [
            f for f in backend_app.rglob("*.py")
            if "single_door_fixtures" not in str(f).replace("\\", "/")
        ]

    total_files = len(files_to_check)
    all_violations: List[Dict[str, Any]] = []

    for f in files_to_check:
        violations = check_file(f, root_path, verbose=args.verbose)
        if violations:
            all_violations.extend(violations)

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("==================================================================")
    print("SMRITI Single-Door Stock Ledger AST Static Analysis Guard")
    print("==================================================================")
    print(f"Scanned files : {total_files}")
    print(f"Violations    : {len(all_violations)}")
    print("------------------------------------------------------------------")

    if all_violations:
        for v in all_violations:
            print(f"FAIL: [{v['rule']}] {v['file']}:{v['line']}:{v['col']}")
            print(f"      {v['message']}\n")
        print("RESULT: FAILED -- Single-Door Stock Ledger architectural rules violated.")
        sys.exit(1)
    else:
        print("RESULT: PASSED -- 100% compliant with Single-Door Stock Ledger Architecture.")
        sys.exit(0)


if __name__ == "__main__":
    main()
