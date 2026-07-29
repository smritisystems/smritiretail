"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.39.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.future import select

from app.main import app
from app.api.deps import get_db
from app.compliance.models.compliance import ComplianceOutbox, ComplianceAuditLog
from app.compliance.connectors.nic import NICEWayBillConnectorV1, NICEInvoiceConnectorV1
from app.compliance.services.queue_engine import ComplianceQueueEngine
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db(db_session):
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_nic_ewaybill_connector_submit_and_cancel():
    """Validates NIC E-Way Bill connector authentication, generation, and cancellation."""
    connector = NICEWayBillConnectorV1(environment="sandbox")
    creds = {"username": "TEST_GSTIN_USER", "password": "SECURE_PASSWORD"}

    token = connector.authenticate(creds)
    assert token.startswith("nic-ewb-auth-")

    payload = {
        "document_number": "INV-2026-0100",
        "total_value": 75000.00,
    }
    submit_res = connector.submit(payload, token)
    assert submit_res["success"] is True
    assert len(submit_res["ewb_number"]) == 15
    assert submit_res["status"] == "GENERATED"

    cancel_res = connector.cancel(submit_res["ewb_number"], "Order Cancelled", token)
    assert cancel_res["success"] is True
    assert cancel_res["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_nic_einvoice_connector_irn_generation():
    """Validates NIC E-Invoice connector 64-character IRN generation and signed QR code payload."""
    connector = NICEInvoiceConnectorV1(environment="sandbox")
    creds = {"username": "TEST_IRP_USER", "password": "SECURE_PASSWORD"}

    token = connector.authenticate(creds)
    assert token.startswith("nic-einv-auth-")

    payload = {
        "seller_gstin": "27ABCDE1234F1Z5",
        "document_number": "INV-2026-0200",
        "document_type": "INV",
    }
    res = connector.submit(payload, token)
    assert res["success"] is True
    assert len(res["irn"]) == 64
    assert res["signed_qr_code"].startswith("JWT_SIGNED_QR_")


@pytest.mark.asyncio
async def test_compliance_queue_engine_outbox_processing(db_session):
    """Tests background ComplianceQueueEngine outbox event retry & audit logging."""
    outbox_event = ComplianceOutbox(
        id=str(uuid.uuid4()),
        service_id="nic-ewaybill",
        state="QUEUED",
        action="GENERATE_EWAYBILL",
        payload=json.dumps({
            "document_number": "INV-2026-0300",
            "total_value": 85000.00,
        }),
        idempotency_key="idemp-nic-300",
    )
    db_session.add(outbox_event)
    await db_session.commit()

    engine = ComplianceQueueEngine(db_session)
    result = await engine.process_pending_outbox(limit=10)

    assert result["total_fetched"] == 1
    assert result["processed"] == 1
    assert result["failed"] == 0

    # Verify state updated to COMPLETED
    await db_session.refresh(outbox_event)
    assert outbox_event.state == "COMPLETED"

    # Verify audit log recorded
    audit_res = await db_session.execute(
        select(ComplianceAuditLog).where(ComplianceAuditLog.service_id == "nic-ewaybill")
    )
    audits = audit_res.scalars().all()
    assert len(audits) == 1
    assert audits[0].status_code == 200


@pytest.mark.asyncio
async def test_compliance_nic_rest_endpoints(db_session):
    """Tests FastAPI compliance endpoints for E-Way Bill generation and E-Invoice generation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. E-Way Bill Generate Endpoint
        ewb_payload = {
            "document_number": "INV-2026-0400",
            "document_date": "2026-07-20",
            "from_gstin": "27ABCDE1234F1Z5",
            "from_trd_name": "SMRITI Retail Store",
            "from_addr1": "Plot 45, MG Road",
            "from_place": "Mumbai",
            "from_pincode": 400001,
            "to_gstin": "27XYZAB5678G2Z9",
            "to_trd_name": "Apex Wholesalers",
            "to_addr1": "Sector 18",
            "to_place": "Thane",
            "to_pincode": 400601,
            "total_value": 95000.00,
            "items": [
                {
                    "product_name": "Basmati Rice 5kg",
                    "hsn_code": "10063020",
                    "quantity": 10.0,
                    "unit": "KGS",
                    "taxable_amount": 95000.00,
                }
            ]
        }
        res_ewb = await ac.post("/api/v1/compliance/ewaybill/generate", json=ewb_payload)
        assert res_ewb.status_code == 200
        ewb_data = res_ewb.json()
        assert ewb_data["success"] is True
        assert ewb_data["ewb_number"] is not None

        # 2. E-Invoice Generate Endpoint
        einv_payload = {
            "document_number": "INV-2026-0500",
            "document_date": "2026-07-20",
            "seller_gstin": "27ABCDE1234F1Z5",
            "buyer_gstin": "27XYZAB5678G2Z9",
            "total_invoice_value": 99750.00,
            "items": [
                {
                    "product_name": "Basmati Rice 5kg",
                    "hsn_code": "10063020",
                    "quantity": 10.0,
                    "unit": "KGS",
                    "taxable_amount": 95000.00,
                }
            ]
        }
        res_einv = await ac.post("/api/v1/compliance/einvoice/generate", json=einv_payload)
        assert res_einv.status_code == 200
        einv_data = res_einv.json()
        assert einv_data["success"] is True
        assert len(einv_data["irn"]) == 64
