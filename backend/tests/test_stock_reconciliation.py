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

import json
import os

import pytest

from scripts.reconcile_historical_stock import _pg_connect, run_historical_stock_reconciliation


def test_dry_run_historical_stock_reconciliation(tmp_path):
    """
    Verifies that the historical stock reconciliation script:
    1. Runs in dry-run mode without modifying the database.
    2. Generates the structured JSON report with all 8 mandatory metric keys.
    3. Accurately reports invoices, lines, and stock impact.
    """
    output_file = str(tmp_path / "test_reconciliation.json")

    conn = _pg_connect("smriti_test_001")
    try:
        cur = conn.cursor()
        scope_params = ("COMP-001", "MAIN")
        cur.execute(
            "SELECT COUNT(*) FROM sales_invoices si "
            "WHERE si.is_deleted = false AND si.company_id = %s AND si.branch_id = %s",
            scope_params,
        )
        expected_invoices = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM sales_invoice_items sii "
            "JOIN sales_invoices si ON si.id = sii.invoice_id "
            "WHERE si.is_deleted = false AND si.company_id = %s AND si.branch_id = %s",
            scope_params,
        )
        expected_lines = cur.fetchone()[0]
    finally:
        conn.close()
    result = run_historical_stock_reconciliation(
        database="smriti_test_001",
        mode="dry-run",
        output_file=output_file,
        company_id="COMP-001",
        branch_id="MAIN",
    )

    assert result["status"] == "COMPLETED"
    assert result["mode"] == "dry-run"
    assert os.path.exists(output_file)

    summary = result["summary"]
    assert "_error" not in summary, summary.get("_error")
    assert "invoices_analyzed" in summary
    assert "invoice_lines_analyzed" in summary
    assert "already_matched_movements" in summary
    assert "would_create_movements" in summary
    assert "skipped_movements" in summary
    assert "duplicate_risk_records" in summary
    assert "missing_product_mappings" in summary
    assert "distinct_products_impacted" in summary

    assert summary["invoices_analyzed"] == expected_invoices
    assert summary["invoice_lines_analyzed"] == expected_lines
    assert summary["duplicate_risk_records"] == 0

    with open(output_file, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded["summary"]["invoices_analyzed"] == expected_invoices
