"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import os
import datetime
import pytest
from app.core.data_archival import DataArchivalEngine, ArchivalRecord


def _make_records():
    return [
        ArchivalRecord("INV-2023-001", "SalesInvoice", datetime.date(2023, 3, 15), {"total": 5000}),
        ArchivalRecord("INV-2023-002", "SalesInvoice", datetime.date(2023, 7, 20), {"total": 12000}),
        ArchivalRecord("INV-2025-001", "SalesInvoice", datetime.date(2025, 2, 10), {"total": 8000}),  # recent
        ArchivalRecord("PO-2023-001", "PurchaseOrder", datetime.date(2023, 5, 1), {"total": 30000}),
    ]


def test_dry_run_identifies_eligible_records():
    engine = DataArchivalEngine()
    cutoff = datetime.date(2024, 1, 1)

    manifest = engine.run_archival(_make_records(), cutoff_date=cutoff, dry_run=True)

    # 3 records before 2024
    assert manifest.records_eligible == 3
    assert manifest.records_archived == 3
    assert manifest.dry_run is True
    assert manifest.cold_storage_path is None  # dry run — no file written


def test_blocked_records_not_archived():
    engine = DataArchivalEngine()
    engine.register_open_dependencies(["INV-2023-001"])  # Block this record

    cutoff = datetime.date(2024, 1, 1)
    manifest = engine.run_archival(_make_records(), cutoff_date=cutoff, dry_run=True)

    assert "INV-2023-001" in manifest.blocked_ids
    assert "INV-2023-001" not in manifest.archived_ids
    assert manifest.records_archived == 2  # 3 eligible - 1 blocked


def test_execute_writes_cold_storage_file(tmp_path):
    engine = DataArchivalEngine()
    cutoff = datetime.date(2024, 1, 1)

    manifest = engine.run_archival(
        _make_records(),
        cutoff_date=cutoff,
        run_id="TEST-ARCH-001",
        dry_run=False,
        export_dir=str(tmp_path),
    )

    assert manifest.cold_storage_path is not None
    assert os.path.exists(manifest.cold_storage_path)

    with open(manifest.cold_storage_path, "r") as f:
        data = json.load(f)

    assert data["run_id"] == "TEST-ARCH-001"
    assert len(data["records"]) == 3
