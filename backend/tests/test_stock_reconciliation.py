"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import json
import pytest
from scripts.reconcile_historical_stock import run_historical_stock_reconciliation


def test_dry_run_historical_stock_reconciliation(tmp_path):
    """
    Verifies that the historical stock reconciliation script:
    1. Runs in dry-run mode without modifying the database.
    2. Generates the structured JSON report with all 8 mandatory metric keys.
    3. Accurately reports invoices, lines, and stock impact.
    """
    output_file = str(tmp_path / "test_reconciliation.json")

    result = run_historical_stock_reconciliation(
        database="smriti001",
        mode="dry-run",
        output_file=output_file,
        company_id="COMP-001",
        branch_id="MAIN",
    )

    assert result["status"] == "COMPLETED"
    assert result["mode"] == "dry-run"
    assert os.path.exists(output_file)

    summary = result["summary"]
    assert "invoices_analyzed" in summary
    assert "invoice_lines_analyzed" in summary
    assert "already_matched_movements" in summary
    assert "would_create_movements" in summary
    assert "skipped_movements" in summary
    assert "duplicate_risk_records" in summary
    assert "missing_product_mappings" in summary
    assert "distinct_products_impacted" in summary

    assert summary["invoices_analyzed"] == 120
    assert summary["invoice_lines_analyzed"] == 6661
    assert summary["duplicate_risk_records"] == 0

    with open(output_file, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["summary"]["invoices_analyzed"] == 120
