"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.4
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SYSADMIN PO Date Remediation Test Suite
"""

import os
import sys

_CUR_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.abspath(os.path.join(_CUR_DIR, "..", ".."))
_REPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from pydantic import ValidationError
try:
    from app.schemas.database_manager import PoDateCorrectionItem, PoDateRemediationRequest
    from app.api.v1.database_manager import DB_NAME_PATTERN
except ImportError:
    from backend.app.schemas.database_manager import PoDateCorrectionItem, PoDateRemediationRequest
    from backend.app.api.v1.database_manager import DB_NAME_PATTERN


def test_po_date_correction_item_schema():
    """Verify PoDateCorrectionItem accepts valid payloads and validates required fields."""
    item = PoDateCorrectionItem(
        order_no="PO-A-462",
        target_date="2026-06-26T10:00:00+00:00",
        bill_no="462"
    )
    assert item.order_no == "PO-A-462"
    assert item.target_date == "2026-06-26T10:00:00+00:00"
    assert item.bill_no == "462"
    assert item.order_id is None


def test_po_date_remediation_request_schema():
    """Verify PoDateRemediationRequest defaults and structure."""
    req = PoDateRemediationRequest(
        corrections=[
            PoDateCorrectionItem(order_no="PO-A-462", target_date="2026-06-26T10:00:00+00:00"),
            PoDateCorrectionItem(order_no="PO-B-LF_26-27_144", target_date="2026-07-25T10:00:00+00:00")
        ]
    )
    assert req.database == "smriti001"
    assert req.dry_run is True
    assert len(req.corrections) == 2


def test_db_name_pattern_sanitization_po():
    """Verify DB_NAME_PATTERN strictly blocks invalid characters and SQL injection attempts."""
    valid_dbs = ["smriti001", "smritisys", "smriti_test", "comp001_db"]
    invalid_dbs = [
        "smriti001; DROP TABLE purchase_orders;--",
        "smriti 001",
        "smriti-001",
        "smriti/001",
        "smriti' OR '1'='1",
        "smriti001\x00",
    ]
    for db in valid_dbs:
        assert DB_NAME_PATTERN.match(db) is not None, f"Expected {db} to be valid"

    for db in invalid_dbs:
        assert DB_NAME_PATTERN.match(db) is None, f"Expected {db} to be blocked"
