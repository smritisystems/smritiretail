"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Gate 7 Exhaustive Dependency Audit & Classification Engine
"""

import os
import re
from collections import defaultdict
from typing import Dict, List, Any

TARGET_DIRS = ["backend/app", "src"]
EXTENSIONS = [".py", ".ts", ".tsx"]

KEYWORDS = [
    r"\bProduct\b",
    r"\bproducts\b",
    r"\bProductCreate\b",
    r"\bProductUpdate\b",
    r"\bproduct_id\b",
    r"/api/v1/products",
    r"/api/v1/items",
    r"\bitem_variants\b",
    r"\bItemVariant\b",
    r"\bitem_barcodes\b",
    r"\bItemBarcode\b",
    r"\bprice_book_entries\b"
]

def classify_usage(filepath: str, line: str, kw: str) -> str:
    path_lower = filepath.replace("\\", "/").lower()
    line_lower = line.lower()

    if "test" in path_lower or "mock" in path_lower:
        return "TEST_OR_SIMULATION"
    if "migration" in path_lower or "alembic" in path_lower or "script" in path_lower:
        return "MIGRATION"
    if "sales_order" in line_lower or "sales_invoice" in line_lower or "invoice_item" in line_lower or "order_item" in line_lower:
        if "product_id" in line_lower:
            return "TRANSACTION_FK"
    if "report" in path_lower or "analytics" in path_lower or "dashboard" in path_lower:
        return "REPORTING"
    if "dual_write" in line_lower or "legacy_id_mapping" in line_lower or "dual_read" in line_lower:
        return "LEGACY_COMPATIBILITY"
    if "universal_master" in path_lower or "item_master" in path_lower or "pricing" in path_lower:
        return "CANONICAL"
    if "inventory.py" in path_lower or "products.py" in path_lower:
        return "LEGACY_COMPATIBILITY"
    if "src/components" in path_lower or "src/pages" in path_lower or "src/lib" in path_lower:
        return "FRONTEND_CONSUMER"
    
    return "LEGACY_COMPATIBILITY"

def run_audit():
    findings = defaultdict(list)
    file_counts = defaultdict(int)
    classification_counts = defaultdict(int)

    for base_dir in TARGET_DIRS:
        for root, _, files in os.walk(base_dir):
            for file in files:
                if any(file.endswith(ext) for ext in EXTENSIONS):
                    filepath = os.path.join(root, file)
                    rel_path = os.path.relpath(filepath, ".").replace("\\", "/")
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                            for idx, line in enumerate(f, 1):
                                line_str = line.strip()
                                for kw in KEYWORDS:
                                    if re.search(kw, line_str):
                                        category = classify_usage(rel_path, line_str, kw)
                                        classification_counts[category] += 1
                                        file_counts[rel_path] += 1
                                        if len(findings[category]) < 100:
                                            findings[category].append({
                                                "file": rel_path,
                                                "line_num": idx,
                                                "kw": kw,
                                                "content": line_str[:120]
                                            })
                                        break
                    except Exception:
                        pass

    print("=" * 85)
    print("SMRITI GATE 7: CODEBASE-WIDE DEPENDENCY AUDIT & CLASSIFICATION MATRIX")
    print("=" * 85)
    print(f"Total Unique Files with Legacy/Canonical Master References: {len(file_counts)}")
    print("\n--- OCCURRENCE BREAKDOWN BY ARCHITECTURAL CLASSIFICATION ---")
    for cat, count in sorted(classification_counts.items(), key=lambda x: -x[1]):
        print(f"  • {cat:<25}: {count:>5} occurrences")

    print("\n--- TOP REPOSITORIES & SERVICES STILL QUERYING LEGACY PRODUCTS ---")
    top_files = sorted(file_counts.items(), key=lambda x: -x[1])[:20]
    for fp, count in top_files:
        print(f"  {count:>4} refs : {fp}")

    print("\n" + "=" * 85)

if __name__ == "__main__":
    run_audit()
