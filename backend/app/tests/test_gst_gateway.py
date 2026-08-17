"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from sqlalchemy.future import select

from app.models.tenant import Company, Branch
from app.models.outbox import IntegrationOutboxEvent
from app.services.gst_gateway_service import GSTGatewayService
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def clean_database_fixture(db_session):
    await clear_db(db_session)
    yield
    try:
        await clear_db(db_session)
    except Exception:
        pass


@pytest.mark.asyncio
async def test_e_invoice_payload_structure():
    """Verify standard NIC E-Invoice JSON payload schema v1.1 and digital hash generation."""
    payload = GSTGatewayService.prepare_e_invoice_payload(
        invoice_no="INV-2026-001",
        invoice_date="17/08/2026",
        supplier_gstin="27ABCDE1234F1Z5",
        supplier_name="SMRITI TEST STORE",
        buyer_gstin="27XYZAB5678G2Z1",
        buyer_name="RETAIL BUYER PVT LTD",
        items=[
            {"name": "Casual Shoes", "quantity": 2, "price": 1000.0, "gst_rate": 18.0, "taxable_amount": 2000.0, "tax_total": 360.0}
        ],
        subtotal=2000.0,
        tax_total=360.0,
        grand_total=2360.0
    )
    assert payload["Version"] == "1.1"
    assert payload["DocDtls"]["No"] == "INV-2026-001"
    assert payload["SellerDtls"]["Gstin"] == "27ABCDE1234F1Z5"
    assert payload["BuyerDtls"]["Gstin"] == "27XYZAB5678G2Z1"
    assert len(payload["ItemList"]) == 1
    assert payload["ItemList"][0]["AssAmt"] == 2000.0
    assert payload["ItemList"][0]["IgstAmt"] == 360.0
    assert len(payload["_pre_payload_hash"]) == 64


@pytest.mark.asyncio
async def test_e_invoice_irn_generation_and_outbox(db_session):
    """Verify E-Invoice IRN calculation and outbox event logging."""
    res = await GSTGatewayService.generate_e_invoice_irn(
        session=db_session,
        invoice_no="INV-EINV-001",
        supplier_gstin="27ABCDE1234F1Z5",
        supplier_name="SMRITI STORE",
        buyer_gstin="27XYZAB5678G2Z1",
        buyer_name="BUYER CO",
        subtotal=1000.0,
        tax_total=180.0,
        grand_total=1180.0
    )
    assert res["success"] is True
    assert "irn" in res
    assert "SANDBOX" in res["environment"]
    assert res["live_status_declaration"] == "PENDING — LIVE MERCHANT CREDENTIALS REQUIRED"

    # Verify Outbox persistence
    q = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.causation_id == "INV-EINV-001")
    outbox_res = await db_session.execute(q)
    event = outbox_res.scalars().first()
    assert event is not None
    assert event.target_channel == "GST_QUEUE"
    assert event.payload_json["action"] == "E_INVOICE_PROCESSED"


@pytest.mark.asyncio
async def test_e_way_bill_generation_and_validity(db_session):
    """Verify E-Way Bill 12-digit number, validity calculation, and outbox persistence."""
    res = await GSTGatewayService.generate_e_way_bill(
        session=db_session,
        invoice_no="INV-EWB-001",
        transporter_id="TRANS-9988",
        vehicle_no="MH01AB1234",
        distance_km=350
    )
    assert res["success"] is True
    assert res["e_way_bill_no"].startswith("32")
    assert "valid_until" in res
    assert res["live_status_declaration"] == "PENDING — LIVE MERCHANT CREDENTIALS REQUIRED"

    # Verify Outbox persistence
    q = select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.causation_id == "INV-EWB-001")
    outbox_res = await db_session.execute(q)
    event = outbox_res.scalars().first()
    assert event is not None
    assert event.target_channel == "GST_QUEUE"
    assert event.payload_json["action"] == "E_WAY_BILL_GENERATED"
    assert event.payload_json["vehicle_no"] == "MH01AB1234"
