"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.3
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SYSADMIN GRN Date Remediation Test Suite
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
    from app.schemas.database_manager import GrnDateCorrectionItem, GrnDateRemediationRequest
    from app.api.v1.database_manager import DB_NAME_PATTERN
except ImportError:
    from backend.app.schemas.database_manager import GrnDateCorrectionItem, GrnDateRemediationRequest
    from backend.app.api.v1.database_manager import DB_NAME_PATTERN


def test_grn_date_correction_item_schema():
    """Verify GrnDateCorrectionItem accepts valid payloads and validates required fields."""
    item = GrnDateCorrectionItem(
        receipt_no="GRN-A-462",
        target_date="2026-06-26T11:00:00+00:00",
        bill_no="462"
    )
    assert item.receipt_no == "GRN-A-462"
    assert item.target_date == "2026-06-26T11:00:00+00:00"
    assert item.bill_no == "462"
    assert item.receipt_id is None


def test_grn_date_remediation_request_schema():
    """Verify GrnDateRemediationRequest defaults and structure."""
    req = GrnDateRemediationRequest(
        corrections=[
            GrnDateCorrectionItem(receipt_no="GRN-A-462", target_date="2026-06-26T11:00:00+00:00"),
            GrnDateCorrectionItem(receipt_no="GRN-B-LF_26-27_144", target_date="2026-07-25T11:00:00+00:00")
        ]
    )
    assert req.database == "smriti001"
    assert req.dry_run is True
    assert len(req.corrections) == 2


def test_db_name_pattern_sanitization():
    """Verify DB_NAME_PATTERN prevents SQL injection in target database name parameter."""
    assert DB_NAME_PATTERN.match("smriti001") is not None
    assert DB_NAME_PATTERN.match("smritisys") is not None
    assert DB_NAME_PATTERN.match("smriti_tenant_2") is not None

    # Malicious injection strings must fail
    assert DB_NAME_PATTERN.match("smriti001; DROP TABLE users;") is None
    assert DB_NAME_PATTERN.match("smriti001' OR '1'='1") is None
    assert DB_NAME_PATTERN.match("smriti001--") is None
    assert DB_NAME_PATTERN.match("smriti/../etc") is None


if __name__ == "__main__":
    test_grn_date_correction_item_schema()
    print("PASS: test_grn_date_correction_item_schema")
    test_grn_date_remediation_request_schema()
    print("PASS: test_grn_date_remediation_request_schema")
    test_db_name_pattern_sanitization()
    print("PASS: test_db_name_pattern_sanitization")
    print("ALL 3 TESTS PASSED GREEN!")
    sys.stdout.flush()
    os._exit(0)



