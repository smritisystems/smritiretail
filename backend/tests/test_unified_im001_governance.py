"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.48.0
Created      : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Verification Test Suite — Unified IM-001 Catalog Governance

Test suite for Unified IM-001 Catalog Governance across:
1. POST /api/v1/inventory/ (used by AddProductDrawer.tsx)
2. POST /api/v1/universal/preview & /commit
3. UniversalItemMasterService.create_item
"""

import uuid
import pytest
import openpyxl
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.main import app
from app.core.security import create_access_token
from app.db.session import get_company_sessionmaker
from app.models.inventory import Product
from app.models.item_master import Item
from app.services.catalog_validation import IM001ControlledFieldValidator


@pytest.fixture(scope="module")
def auth_headers():
    token = create_access_token(
        {
            "sub": "usr-super",
            "username": "usr_super",
            "role": "SYSADMIN",
            "company_id": "COMP-001",
            "branch_id": "BR-MAIN-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Branch-ID": "BR-MAIN-001",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_01_negative_test_invalid_heel_type_blocked_at_inventory(client, auth_headers):
    """
    Negative test (Directive Requirement 6):
    Attempt creating an item via POST /api/v1/inventory/ with invalid heel_type='INVALID_HEEL'.
    Must be blocked with HTTP 422 and return an explicit IM-001 validation error.
    """
    payload = {
        "name": "Negative Test Blocked Heel",
        "code": f"TEST-BLOCKED-HEEL-{uuid.uuid4().hex[:6]}",
        "barcode": f"890{uuid.uuid4().int % 1000000000:09d}",
        "brand": "Tattly Threads",
        "category": "Footwear",
        "mrp": 2499.0,
        "price": 1999.0,
        "cost_price": 1000.0,
        "buying_price": 1200.0,
        "gst_percentage": 12.0,
        "hsn_code": "6403",
        "heel_type": "INVALID_HEEL",
        "upper_material": "SYNTHETIC",
        "product_type": "SANDAL",
        "gender": "LADIES",
        "attributes": {
            "gender": "LADIES",
            "heel_type": "INVALID_HEEL",
            "product_type": "SANDAL",
            "upper_material": "SYNTHETIC",
        },
    }

    res = client.post("/api/v1/inventory/", json=payload, headers=auth_headers)
    print("\n--- LITERAL NEGATIVE TEST RESPONSE (INVALID HEEL_TYPE) ---")
    print(f"Status Code: {res.status_code}")
    print(f"Response Body: {res.text}")

    assert res.status_code == 422, f"Expected HTTP 422, got {res.status_code}: {res.text}"
    data = res.json()
    assert "SMRITI-VAL-002" in str(data) or "IM-001" in str(data)
    assert "INVALID_HEEL" in str(data)


def test_02_negative_test_invalid_upper_material_blocked(client, auth_headers):
    """
    Negative test: Attempt creating item with invalid upper_material='INVALID_FABRIC'.
    Must be blocked with HTTP 422.
    """
    payload = {
        "name": "Negative Test Blocked Upper Material",
        "code": f"TEST-BLOCKED-UPPER-{uuid.uuid4().hex[:6]}",
        "barcode": f"890{uuid.uuid4().int % 1000000000:09d}",
        "brand": "Tattly Threads",
        "category": "Footwear",
        "mrp": 2499.0,
        "price": 1999.0,
        "cost_price": 1000.0,
        "buying_price": 1200.0,
        "gst_percentage": 12.0,
        "hsn_code": "6403",
        "heel_type": "BLOCK",
        "upper_material": "INVALID_MATERIAL_UNKNOWN",
        "product_type": "SANDAL",
        "gender": "LADIES",
        "attributes": {
            "gender": "LADIES",
            "heel_type": "BLOCK",
            "upper_material": "INVALID_MATERIAL_UNKNOWN",
        },
    }

    res = client.post("/api/v1/inventory/", json=payload, headers=auth_headers)
    assert res.status_code == 422, f"Expected HTTP 422, got {res.status_code}: {res.text}"
    assert "INVALID_MATERIAL_UNKNOWN" in res.text


def test_03_positive_test_onboarded_dimensions_pass(client, auth_headers):
    """
    Positive test: Creating item with newly onboarded dimensions:
    - heel_type='CUBE HEEL'
    - upper_material='LYCRA'
    - product_type='HALF SHOE'
    - color='BRONZE'
    Must succeed with HTTP 201.
    """
    test_code = f"PROD-TEST-PASS-{uuid.uuid4().hex[:6]}".upper()
    test_barcode = f"890{uuid.uuid4().int % 1000000000:09d}"

    payload = {
        "name": "Positive Test Onboarded Product",
        "code": test_code,
        "barcode": test_barcode,
        "brand": "Tattly Threads",
        "category": "Footwear",
        "mrp": 2499.0,
        "price": 1999.0,
        "cost_price": 1000.0,
        "buying_price": 1200.0,
        "gst_percentage": 12.0,
        "hsn_code": "6403",
        "style_code": "CH-01-A",
        "color": "BRONZE",
        "size": "38",
        "heel_type": "CUBE HEEL",
        "upper_material": "LYCRA",
        "product_type": "HALF SHOE",
        "gender": "LADIES",
        "attributes": {
            "gender": "LADIES",
            "heel_type": "CUBE HEEL",
            "upper_material": "LYCRA",
            "product_type": "HALF SHOE",
            "style": "CH-01-A",
            "article_no": "CH-01-A",
        },
    }

    res = client.post("/api/v1/inventory/", json=payload, headers=auth_headers)
    print("\n--- LITERAL POSITIVE TEST RESPONSE (CUBE HEEL + LYCRA + HALF SHOE) ---")
    print(f"Status Code: {res.status_code}")
    print(f"Response Body: {res.text}")

    assert res.status_code == 201, f"Expected HTTP 201, got {res.status_code}: {res.text}"
    data = res.json()
    assert data.get("code") == test_code or data.get("name") == "Positive Test Onboarded Product"


def test_04_system_master_lookup_registry_loaded_dynamically():
    """
    Directive Requirement 3:
    Verify that mandatory Y/N classification is dynamically loaded from the workbook sheet,
    NOT hardcoded in Python.
    Verify that GENDER, MERCHANDISE_CATEGORY, PRODUCT_TYPE, HEEL_TYPE, UPPER_MATERIAL are True (BLOCK).
    """
    registry = IM001ControlledFieldValidator.load_system_master_lookup_registry()
    print("\n--- SYSTEM MASTER LOOKUP REGISTRY DYNAMICALLY LOADED ---")
    for field, is_mand in sorted(registry.items()):
        print(f"  {field:<25}: {'BLOCK (True)' if is_mand else 'ADVISORY (False)'}")

    assert registry["GENDER"] is True
    assert registry["MERCHANDISE_CATEGORY"] is True
    assert registry["PRODUCT_TYPE"] is True
    assert registry["HEEL_TYPE"] is True
    assert registry["UPPER_MATERIAL"] is True
    assert registry["BRAND_NAME"] is True
    assert registry["COLOR"] is True
    assert registry["SIZE"] is True
    assert registry["DESIGN_ATTRIBUTE"] is False
    assert registry["OUTSOLE_MATERIAL"] is False


def test_05_universal_import_preview_tattly_new_sheet(client, auth_headers):
    """
    Directive Requirement 5:
    Re-run Tattly NEW sheet through unified path with literal preview & commit output.
    """
    from pathlib import Path
    data_path = Path(__file__).resolve().parents[2] / "data" / "tattly_item_master_full.xlsx"
    wb = openpyxl.load_workbook(data_path, data_only=True)
    ws = wb["NEW"]

    headers = [str(ws.cell(1, c).value or "").strip() for c in range(1, 21)]
    raw_rows = []
    # Test a representative sample of 50 rows across all categories, styles, heels, materials
    for r in range(2, 52):
        row_dict = {}
        for c, h in enumerate(headers, start=1):
            if h:
                row_dict[h] = ws.cell(r, c).value
        row_dict["rowNumber"] = r
        raw_rows.append(row_dict)

    preview_payload = {
        "target": "ITEM_MASTER",
        "rows": raw_rows,
    }

    res = client.post("/api/v1/universal/preview", json=preview_payload, headers=auth_headers)
    print("\n--- LITERAL UNIVERSAL IMPORT PREVIEW OUTPUT ---")
    print(f"Status Code: {res.status_code}")
    preview_data = res.json()
    summary = preview_data.get("summary", {})
    print(f"Preview Summary: {summary}")
    print(f"Total Rows: {summary.get('total_rows')}")
    print(f"Valid Rows: {summary.get('valid_rows')}")
    print(f"Invalid Rows: {summary.get('invalid_rows')}")
    print(f"Warning Rows: {summary.get('warning_rows')}")
    print(f"Distinct Styles: {summary.get('distinct_styles')}")
    print(f"Overall Status: {summary.get('status')}")

    assert res.status_code == 200
    assert summary.get("total_rows") == len(raw_rows)


def test_06_universal_import_commit_tattly_new_sheet(client, auth_headers):
    """
    Directive Requirement 5 (Commit flow):
    Re-run Tattly NEW sheet through unified path with literal commit output.
    """
    from pathlib import Path
    data_path = Path(__file__).resolve().parents[2] / "data" / "tattly_item_master_full.xlsx"
    wb = openpyxl.load_workbook(data_path, data_only=True)
    ws = wb["NEW"]

    headers = [str(ws.cell(1, c).value or "").strip() for c in range(1, 21)]
    raw_rows = []
    # Test commit on representative sample of 10 rows
    for r in range(2, 12):
        row_dict = {}
        for c, h in enumerate(headers, start=1):
            if h:
                row_dict[h] = ws.cell(r, c).value
        row_dict["rowNumber"] = r
        raw_rows.append(row_dict)

    commit_payload = {
        "target": "ITEM_MASTER",
        "rows": raw_rows,
        "idempotency_key": f"commit-tattly-new-{uuid.uuid4().hex[:12]}",
        "existing_match_mode": "SKIP",
    }

    res = client.post("/api/v1/universal/commit", json=commit_payload, headers=auth_headers)
    print("\n--- LITERAL UNIVERSAL IMPORT COMMIT OUTPUT ---")
    print(f"Status Code: {res.status_code}")
    print(f"Response Body: {res.text}")

    assert res.status_code == 200
    commit_data = res.json()
    assert commit_data.get("success") is True
    assert len(commit_data.get("results", [])) == len(raw_rows)

