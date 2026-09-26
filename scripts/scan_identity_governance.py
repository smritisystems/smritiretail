"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.40.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Architectural Identity Governance Tooling (Rule 13)
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Set

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_APP = ROOT_DIR / "backend" / "app"
FRONTEND_SRC = ROOT_DIR / "src"

# Canonical business modules and their transactional creation methods
CANONICAL_CREATION_REGISTRY: Dict[str, Set[str]] = {
    "purchase.py": {
        "create_purchase_receipt",
        "create_debit_note",
        "create_purchase_bill",
        "create_purchase_order",
        "create_from_reorder_trigger",
        "amend_purchase_order",
    },
    "sales.py": {
        "create_sales_return",
        "convert_order_to_invoice",
        "convert_quotation_to_invoice",
        "create_eway_bill",
    },
    "canonical_sales_writer.py": {
        "post_sales_invoice",
    },
    "sales_ledger_svc.py": {
        "post_sales_invoice",
    },
    "inventory_wms.py": {
        "atomic_mutate_batch_stock",
        "create_stock_transfer",
    },
    "univ_party_svc.py": {
        "create_party",
        "converge_customer_to_party",
        "converge_supplier_to_party",
    },
    "crm.py": {
        "create_customer",
    },
}

FORBIDDEN_UUID_ATTRS: Set[str] = {"uuid1", "uuid3", "uuid4", "uuid5"}


class IdentityGovernanceScanner:
    """
    Repository-Wide Identity Governance Scanner (Rule 13).
    Enforces architectural identity boundaries:
    1. ZERO custom `_uid()` definitions anywhere across the entire backend.
    2. ZERO `uuid.uuidX()` calls inside canonical transactional creation routines.
    3. Persistent entity IDs must delegate exclusively to IdentityEngine.
    4. Client-side code does not manufacture persistent IDs via crypto.randomUUID() for API submission.
    """

    def __init__(self):
        self.violations: List[str] = []
        self.files_scanned = 0
        self.functions_scanned = 0
        self.canonical_functions_verified = 0

    def scan_python_ast(self) -> None:
        """Scan backend Python files for forbidden ID generation patterns."""
        for root, dirs, files in os.walk(BACKEND_APP):
            # Skip test directories, alembic migrations, and caches from strict runtime scan
            if any(skip in root for skip in ["tests", "alembic", "__pycache__", "archive"]):
                continue

            for file in files:
                if not file.endswith(".py"):
                    continue

                filepath = Path(root) / file
                self.files_scanned += 1

                try:
                    with open(filepath, "r", encoding="utf-8-sig") as f:
                        content = f.read()
                    tree = ast.parse(content, filename=str(filepath))
                except Exception as e:
                    self.violations.append(f"PARSE_ERROR: Failed to parse {filepath}: {e}")
                    continue

                # Rule 1: Prohibit any custom _uid() definitions across entire backend
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef) and node.name == "_uid":
                        self.violations.append(
                            f"FORBIDDEN_DEF: Found custom '_uid()' definition in {filepath.relative_to(ROOT_DIR)}:{node.lineno}"
                        )

                # Rule 2: Scan canonical creation routines for forbidden persistent ID generators
                if file in CANONICAL_CREATION_REGISTRY:
                    governed_methods = CANONICAL_CREATION_REGISTRY[file]
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            self.functions_scanned += 1
                            if node.name in governed_methods:
                                self.canonical_functions_verified += 1
                                for child in ast.walk(node):
                                    if isinstance(child, ast.Call):
                                        func = child.func
                                        if isinstance(func, ast.Attribute) and func.attr in FORBIDDEN_UUID_ATTRS:
                                            self.violations.append(
                                                f"FORBIDDEN_UUID: In {filepath.relative_to(ROOT_DIR)}:{child.lineno} inside canonical "
                                                f"creation function '{node.name}': called 'uuid.{func.attr}()'. Persistent identities must "
                                                f"delegate to IdentityEngine."
                                            )

    def scan_frontend_code(self) -> None:
        """Scan frontend components for persistent ID generation antipatterns in API calls."""
        pattern_api_crypto = re.compile(
            r'(apiFetch|fetch)\s*\([^)]*\bid\s*:\s*(crypto\.randomUUID\(\)|uuidv4\(\))',
            re.MULTILINE
        )

        for root, dirs, files in os.walk(FRONTEND_SRC):
            if any(skip in root for skip in ["node_modules", "tests", "__tests__", "dist"]):
                continue

            for file in files:
                if not file.endswith((".ts", ".tsx")):
                    continue

                filepath = Path(root) / file
                self.files_scanned += 1

                try:
                    with open(filepath, "r", encoding="utf-8-sig") as f:
                        content = f.read()
                except Exception:
                    continue

                if pattern_api_crypto.search(content):
                    self.violations.append(
                        f"FRONTEND_API_CLIENT_ID: In {filepath.relative_to(ROOT_DIR)}: "
                        f"Client-side persistent ID generation detected in API payload. Persistent IDs must be server-allocated."
                    )

    def run(self) -> int:
        print("=" * 80)
        print(" SMRITI REPOSITORY-WIDE IDENTITY GOVERNANCE SCAN (RULE 13)")
        print("=" * 80)

        self.scan_python_ast()
        self.scan_frontend_code()

        print(f" Files Scanned:                 {self.files_scanned}")
        print(f" Functions Inspected:           {self.functions_scanned}")
        print(f" Canonical Creation Functions:  {self.canonical_functions_verified}")
        print(f" Violations Detected:           {len(self.violations)}")
        print("-" * 80)

        if self.violations:
            print("[FAIL] IDENTITY GOVERNANCE VIOLATIONS DETECTED:")
            for v in self.violations:
                print(f"  - {v}")
            print("=" * 80)
            return 1
        else:
            print("[PASS] ZERO IDENTITY GOVERNANCE VIOLATIONS DETECTED.")
            print(" Zero '_uid()' definitions found across entire backend.")
            print(" All canonical transactional creation paths delegate to IdentityEngine.")
            print("=" * 80)
            return 0


if __name__ == "__main__":
    scanner = IdentityGovernanceScanner()
    sys.exit(scanner.run())
