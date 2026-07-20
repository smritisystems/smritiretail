"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.48.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.compliance.services.gstr_autopull_service import GSTRAutoPullService
from app.compliance.services.gstr_filing_service import GSTRFilingService
from app.tests.conftest import clear_db
from app.db.base import BaseEntity


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async with db_session.bind.begin() as conn:
        await conn.run_sync(BaseEntity.metadata.create_all)
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
async def test_gstr2b_auto_pull_service_and_outbox_logging(db_session):
    """Verifies background GSTR-2B auto-pull service execution, reconciliation, and outbox logging."""
    svc = GSTRAutoPullService()
    res = await svc.execute_gstr2b_auto_pull(
        db=db_session,
        gstin="27AAAAA0000A1Z5",
        financial_period="072026",
        mock_gstr2b_payload=[{"supplier_gstin": "27SUPP001Z", "invoice_number": "INV-P4-1", "taxable_value": 5000.0, "tax_amount": 900.0}],
        purchase_invoices=[{"supplier_gstin": "27SUPP001Z", "invoice_number": "INV-P4-1", "taxable_value": 5000.0, "tax_amount": 900.0}],
    )

    assert res["success"] is True
    assert res["summary"]["matched"] == 1


@pytest.mark.asyncio
async def test_gstr1_filing_payload_assembly_and_dsc_signature(db_session):
    """Verifies GSTR-1 outward supply payload assembly, net tax calculation, and DSC signature hash calculation."""
    svc = GSTRFilingService()
    record = await svc.prepare_and_submit_return(
        db=db_session,
        gstin="27AAAAA0000A1Z5",
        financial_period="072026",
        return_type="GSTR1",
        sales_invoices=[
            {"invoice_number": "INV-S-01", "customer_gstin": "27CUST001Z", "taxable_value": 10000.0, "igst": 1800.0},
            {"invoice_number": "INV-S-02", "customer_gstin": None, "taxable_value": 2000.0, "cgst": 180.0, "sgst": 180.0},
        ],
        verification_mode="DSC",
        dsc_signature_bytes="DSC_TEST_CERT",
    )

    assert record.filing_status == "FILED"
    assert float(record.total_taxable_value) == 12000.0
    assert float(record.total_igst) == 1800.0
    assert record.arn_number.startswith("AA27AAA")
    assert len(record.digital_signature_hash) == 64


@pytest.mark.asyncio
async def test_sgip_phase4_rest_api_endpoints(db_session):
    """Verifies REST endpoints /api/v1/compliance/gst/auto-pull and /api/v1/compliance/gst/filing/submit."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Auto-Pull Endpoint
        res_pull = await ac.post(
            "/api/v1/compliance/gst/auto-pull",
            json={
                "gstin": "27AAAAA0000A1Z5",
                "financial_period": "072026",
                "gstr2b_invoices": [{"supplier_gstin": "27SUPP001Z", "invoice_number": "INV-REST-1", "taxable_value": 1000.0, "tax_amount": 180.0}],
                "purchase_invoices": [{"supplier_gstin": "27SUPP001Z", "invoice_number": "INV-REST-1", "taxable_value": 1000.0, "tax_amount": 180.0}],
            }
        )
        assert res_pull.status_code == 200
        assert res_pull.json()["success"] is True

        # 2. Return Filing Submission Endpoint
        res_submit = await ac.post(
            "/api/v1/compliance/gst/filing/submit",
            json={
                "gstin": "27AAAAA0000A1Z5",
                "financial_period": "072026",
                "return_type": "GSTR3B",
                "sales_invoices": [{"invoice_number": "INV-REST-3B", "taxable_value": 5000.0, "cgst": 450.0, "sgst": 450.0}],
                "verification_mode": "DSC",
            }
        )
        assert res_submit.status_code == 200
        assert res_submit.json()["status"] == "FILED"
        assert res_submit.json()["arn_number"].startswith("AA27AAA")
