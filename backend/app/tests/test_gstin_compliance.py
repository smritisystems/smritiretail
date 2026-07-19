"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from pydantic import ValidationError
from app.schemas.system import BusinessInfo
from app.schemas.sre import CorporateGstinRegistryBase, SreStatutoryLedgerBase
from decimal import Decimal
from datetime import date

def test_valid_gstin_format():
    # Valid GSTIN: 27 (Maharashtra) + ABCDE1234F (PAN) + 1 (entity) + Z (default) + 5 (checksum)
    info = BusinessInfo(
        name="Valid Corp",
        gstin="27ABCDE1234F1Z5"
    )
    assert info.gstin == "27ABCDE1234F1Z5"

def test_invalid_gstin_length():
    # Less than 15 characters
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE1234F1Z")
    assert "GSTIN must be exactly 15 characters long" in str(excinfo.value)

def test_invalid_gstin_state_code():
    # Invalid state code: 98 (not 01-38 or 97, 99)
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="98ABCDE1234F1Z5")
    assert "GSTIN state code is invalid" in str(excinfo.value)

def test_invalid_gstin_embedded_pan():
    # Invalid PAN: contains 'X' instead of digit at index 7 (27ABCDE123XF1Z5)
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE123XF1Z5")
    assert "GSTIN contains an invalid embedded PAN pattern" in str(excinfo.value)

def test_invalid_gstin_default_char():
    # Thirteenth character is 'Y' instead of 'Z'
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE1234F1Y5")
    assert "GSTIN default character must be 'Z'" in str(excinfo.value)

def test_invalid_gstin_entity_code():
    # Twelfth character is invalid (special character)
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE1234F_Z5")
    assert "GSTIN entity code is invalid" in str(excinfo.value)

def test_invalid_gstin_checksum():
    # Fifteenth character is invalid (special character)
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE1234F1Z_")
    assert "GSTIN checksum is invalid" in str(excinfo.value)

def test_deliberately_wrong_checksum_digit():
    # Well-formed, but checksum digit is '6' instead of '5'
    with pytest.raises(ValidationError) as excinfo:
        BusinessInfo(name="Invalid", gstin="27ABCDE1234F1Z6")
    assert "GSTIN checksum is invalid" in str(excinfo.value)

def test_sre_schemas_gstin_validation():
    # Valid
    registry = CorporateGstinRegistryBase(
        gstin="27ABCDE1234F1Z5",
        state_code="27",
        warehouse_name="Mumbai WH"
    )
    assert registry.gstin == "27ABCDE1234F1Z5"
    
    # Invalid checksum in registry
    with pytest.raises(ValidationError) as excinfo:
        CorporateGstinRegistryBase(
            gstin="27ABCDE1234F1Z6",
            state_code="27",
            warehouse_name="Mumbai WH"
        )
    assert "GSTIN checksum is invalid" in str(excinfo.value)

def test_sre_statutory_ledger_gstin_validation():
    # Valid
    ledger = SreStatutoryLedgerBase(
        sku="SKU-1",
        batch_no="B-1",
        dispatch_id="DISP-1",
        origin_gstin_id="ORIG-1",
        destination_gstin="27ABCDE1234F1Z5",
        total_qty=Decimal("10.0"),
        approved_qty=Decimal("10.0"),
        returned_qty=Decimal("0.0"),
        unit_cost=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        tax_type_applied="IGST",
        statutory_state="Maharashtra",
        dispatch_date=date(2026, 7, 19),
        expiry_date=date(2027, 7, 19),
        is_asset_on_balance_sheet=True
    )
    assert ledger.destination_gstin == "27ABCDE1234F1Z5"

    # Invalid destination_gstin
    with pytest.raises(ValidationError) as excinfo:
        SreStatutoryLedgerBase(
            sku="SKU-1",
            batch_no="B-1",
            dispatch_id="DISP-1",
            origin_gstin_id="ORIG-1",
            destination_gstin="27ABCDE1234F1Z6", # Wrong checksum
            total_qty=Decimal("10.0"),
            approved_qty=Decimal("10.0"),
            returned_qty=Decimal("0.0"),
            unit_cost=Decimal("100.00"),
            gst_rate=Decimal("18.00"),
            tax_type_applied="IGST",
            statutory_state="Maharashtra",
            dispatch_date=date(2026, 7, 19),
            expiry_date=date(2027, 7, 19),
            is_asset_on_balance_sheet=True
        )
    assert "GSTIN checksum is invalid" in str(excinfo.value)
