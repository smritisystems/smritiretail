"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.87.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.api.v1.reports import SMRITI_STUDIOS

def test_purchase_report_studio_catalog_completeness():
    """Verify purchase_studio catalog has all operational procurement reports."""
    assert "purchase_studio" in SMRITI_STUDIOS
    purchase_studio = SMRITI_STUDIOS["purchase_studio"]
    reports = purchase_studio.get("reports", [])
    report_ids = [r["id"] for r in reports]

    # Verify canonical reports
    assert "RPT-PUR-001" in report_ids, "Missing Purchase Summary Register"
    assert "RPT-PUR-002" in report_ids, "Missing Supplier Ledger"
    assert "RPT-PUR-003" in report_ids, "Missing Pending Delivery (Open PO) Register"
    assert "RPT-PUR-004" in report_ids, "Missing Supplier Outstanding & Exposure Report"

    rpt3 = next(r for r in reports if r["id"] == "RPT-PUR-003")
    assert rpt3["format"] == "Grid"
    assert rpt3["category"] == "Procurement Tracking"
    assert rpt3["drillDownEnabled"] is True

    rpt4 = next(r for r in reports if r["id"] == "RPT-PUR-004")
    assert rpt4["format"] == "Grid"
    assert rpt4["category"] == "Supplier Exposure"
    assert rpt4["drillDownEnabled"] is True
