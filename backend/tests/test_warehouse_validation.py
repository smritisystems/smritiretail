"""
Author: Jawahar Ramkripal Mallah
Designation: Chief Systems Architect & Creator
Email: support@smritibooks.com
Websites: smritibooks.com | erpnbook.com | aitdl.com
Version: 4.16.0
Created: 2026-09-10
Copyright: © SMRITIBooks.com. All Rights Reserved.
License: Proprietary Commercial Software
Classification: Internal

Warehouse & Godown Domain Architecture Validation Tests.
Verifies:
1. Pincode regex validation (6-digit Indian PIN).
2. State validation against GST State Code mappings.
3. Address fields inheritance across masters_tier2 and wms schemas.
4. CashRegister warehouse_id foreign key & relationship.
"""

import pytest
from pydantic import ValidationError
from app.schemas.wms import WarehouseCreate, WarehouseUpdate, WarehouseResponse
from app.schemas.masters_tier2 import (
    WarehouseCreate as M2WarehouseCreate,
    WarehouseUpdate as M2WarehouseUpdate,
    WarehouseResponse as M2WarehouseResponse,
)
from app.schemas.pos import CashRegisterCreate, CashRegisterResponse
from app.models.pos import CashRegister
from app.models.inventory import Warehouse


def test_warehouse_valid_address_and_pincode():
    wh = WarehouseCreate(
        code="WH-TEST-001",
        name="Test Nagpur Depot",
        address="Plot 45, Kalmeshwar Industrial Area",
        city="Nagpur",
        state="Maharashtra",
        pincode="440001",
        country="India",
        is_central_godown=True,
    )
    assert wh.code == "WH-TEST-001"
    assert wh.pincode == "440001"
    assert wh.state == "Maharashtra"
    assert wh.is_central_godown is True


def test_warehouse_state_gst_code_formatting():
    wh = WarehouseCreate(
        code="WH-TEST-002",
        name="Test Mumbai Depot",
        address="Bhiwandi Hub",
        city="Bhiwandi",
        state="27-Maharashtra",
        pincode="421302",
    )
    assert wh.state == "Maharashtra"
    assert wh.pincode == "421302"


def test_warehouse_invalid_pincode_raises_validation_error():
    with pytest.raises(ValidationError) as exc:
        WarehouseCreate(
            code="WH-TEST-003",
            name="Invalid Pin Depot",
            address="Some road",
            city="Delhi",
            state="Delhi",
            pincode="11000",  # Only 5 digits
        )
    assert "PIN code must be exactly 6 Indian postal digits" in str(exc.value)

    with pytest.raises(ValidationError) as exc2:
        WarehouseCreate(
            code="WH-TEST-004",
            name="Alpha Pin Depot",
            address="Some road",
            city="Delhi",
            state="Delhi",
            pincode="11000A",  # Non-digit
        )
    assert "PIN code must be exactly 6 Indian postal digits" in str(exc2.value)


def test_warehouse_invalid_state_raises_validation_error():
    with pytest.raises(ValidationError) as exc:
        WarehouseCreate(
            code="WH-TEST-005",
            name="Invalid State Depot",
            address="Some road",
            city="Atlantis",
            state="AtlantisProvince",
            pincode="123456",
        )
    assert "Invalid Indian State/UT" in str(exc.value)


def test_masters_tier2_warehouse_inherits_and_validates():
    wh = M2WarehouseCreate(
        code="WH-M2-001",
        name="Tier2 Depot",
        address="GIDC Estate",
        city="Surat",
        state="Gujarat",
        pincode="395001",
        contact_person="Ramesh Patel",
        phone="9876543210",
        is_central_godown=False,
    )
    assert wh.code == "WH-M2-001"
    assert wh.city == "Surat"
    assert wh.state == "Gujarat"
    assert wh.contact_person == "Ramesh Patel"

    with pytest.raises(ValidationError):
        M2WarehouseCreate(
            code="WH-M2-002",
            name="Bad Pin",
            address="Road",
            city="Surat",
            state="Gujarat",
            pincode="ABCDEF",
        )


def test_cash_register_warehouse_id_schema():
    reg = CashRegisterCreate(
        id="REG-TEST-01",
        code="REG-TEST-01",
        name="Front Counter 1",
        warehouse="wh-central-001",
        warehouse_id="wh-central-001",
    )
    assert reg.warehouse_id == "wh-central-001"
    assert reg.warehouse == "wh-central-001"


def test_cash_register_model_relationship():
    # Verify SQLAlchemy model attributes and foreign key
    assert hasattr(CashRegister, "warehouse_id")
    assert hasattr(CashRegister, "warehouse_rel")
    cols = {c.name: c for c in CashRegister.__table__.columns}
    assert "warehouse_id" in cols
    col = cols["warehouse_id"]
    assert col.nullable is True
    fk = list(col.foreign_keys)[0]
    assert fk.target_fullname == "warehouses.id"
