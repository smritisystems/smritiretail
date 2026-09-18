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
Classification: Core Architectural Identity Governance Tooling
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_APP = ROOT_DIR / "backend" / "app"
FRONTEND_SRC = ROOT_DIR / "src"

# Core transactional & master domain creation functions where persistent IDs MUST be governed
GOVERNED_CREATION_FUNCTIONS = {
    "create_purchase_receipt",
    "create_debit_note",
    "create_purchase_bill",
    "create_purchase_order",
    "create_from_reorder_trigger",
    "amend_purchase_order",
    "create_eway_bill",
    "create_sales_return",
    "convert_order_to_invoice",
    "convert_quotation_to_invoice",
    "post_sales_invoice",
    "create_supplier",
    "create_customer",
    "create_party",
    "create_item",
    "record_movement",
    "atomic_mutate_batch_stock",
}

# Approved non-persistent, ephemeral, or cryptographic parameter names/contexts
ALLOWED_EPHEMERAL_NAMES = {
    "correlation_id",
    "event_id",
    "trace_id",
    "request_id",
    "session_id",
    "nonce",
    "token",
    "csrf",
    "temp_filename",
    "synthetic_id",
    "cache_key",
}

FORBIDDEN_UUID_ATTRS = {"uuid1", "uuid3", "uuid4", "uuid5"}


class IdentityGovernanceScanner:
    def __init__(self):
        self.violations: List[str] = []
        self.files_scanned = 0
        self.functions_scanned = 0

    def scan_python_ast(self) -> None:
        """Scan backend Python files for forbidden ID generation patterns."""
        for root, dirs, files in os.walk(BACKEND_APP):
            # Skip test directories and migrations from strict runtime scan
            if any(skip in root for skip in ["tests", "alembic", "__pycache__", "archive"]):
                continue

            for file in files:
                if not file.endswith(".py"):
                    continue

                filepath = Path(root) / file
                self.files_scanned += 1

                try:
                    with open(filepath, "r", encoding="utf-8") as f:
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

                # Rule 2: Scan functions for forbidden persistent ID generators
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        self.functions_scanned += 1
                        fn_name = node.name

                        # Check if function is a governed creation path
                        is_governed_creation = fn_name in GOVERNED_CREATION_FUNCTIONS

                        for child in ast.walk(node):
                            # Check call to uuid.uuidX()
                            if isinstance(child, ast.Call):
                                func = child.func
                                if isinstance(func, ast.Attribute) and func.attr in FORBIDDEN_UUID_ATTRS:
                                    # If inside governed creation path, this is a strict violation
                                    if is_governed_creation:
                                        self.violations.append(
                                            f"FORBIDDEN_UUID: In {filepath.relative_to(ROOT_DIR)}:{child.lineno} inside governed "
                                            f"function '{fn_name}': called 'uuid.{func.attr}()'. Persistent identities must "
                                            f"delegate to IdentityEngine."
                                        )

    def scan_frontend_code(self) -> None:
        """Scan frontend components for persistent ID generation antipatterns."""
        # Forbidden regexes for persistent identity generation in client code
        # e.g., allocating persistent IDs with crypto.randomUUID() when submitting forms
        pattern_crypto = re.compile(r'\b(id|invoice_id|order_id|receipt_id|customer_id)\s*:\s*(crypto\.randomUUID\(\)|uuidv4\(\))')
        pattern_date_now = re.compile(r'\b(id|invoice_id|order_id|receipt_id)\s*:\s*[`\'"].*Date\.now\(\)')

        for root, dirs, files in os.walk(FRONTEND_SRC):
            if any(skip in root for skip in ["node_modules", "tests", "__tests__", "dist"]):
                continue

            for file in files:
                if not file.endswith((".ts", ".tsx")):
                    continue

                filepath = Path(root) / file
                self.files_scanned += 1

                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                except Exception:
                    continue

                for idx, line in enumerate(lines, 1):
                    # Check for forbidden crypto.randomUUID() on persistent fields
                    if pattern_crypto.search(line):
                        self.violations.append(
                            f"FRONTEND_CLIENT_ID_GEN: In {filepath.relative_to(ROOT_DIR)}:{idx}: "
                            f"Client-side persistent ID generation detected: {line.strip()}"
                        )
                    if pattern_date_now.search(line):
                        self.violations.append(
                            f"FRONTEND_DATE_NOW_ID: In {filepath.relative_to(ROOT_DIR)}:{idx}: "
                            f"Date.now()-based ID assignment on persistent entity detected: {line.strip()}"
                        )

    def run(self) -> int:
        print("=" * 80)
        print(" SMRITI REPOSITORY-WIDE IDENTITY GOVERNANCE SCAN (RULE 13)")
        print("=" * 80)

        self.scan_python_ast()
        self.scan_frontend_code()

        print(f" Files Scanned:       {self.files_scanned}")
        print(f" Functions Inspected: {self.functions_scanned}")
        print(f" Violations Detected: {len(self.violations)}")
        print("-" * 80)

        if self.violations:
            print("[FAIL] IDENTITY GOVERNANCE VIOLATIONS DETECTED:")
            for v in self.violations:
                print(f"  - {v}")
            print("=" * 80)
            return 1
        else:
            print("[PASS] ZERO IDENTITY GOVERNANCE VIOLATIONS DETECTED.")
            print(" All persistent identity generation complies with IdentityEngine authority.")
            print("=" * 80)
            return 0


if __name__ == "__main__":
    scanner = IdentityGovernanceScanner()
    sys.exit(scanner.run())
