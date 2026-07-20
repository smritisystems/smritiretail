"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from decimal import Decimal
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.compliance.models.reconciliation import GSTReconciliationRecord
from app.compliance.services.gst_recon_service import GSTReconciliationService
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
async def test_gst_reconciliation_service_logic(db_session):
    """Verifies GST purchase register vs GSTR-2B reconciliation matching statuses."""
    svc = GSTReconciliationService()

    purchase_invoices = [
        {"supplier_gstin": "27SUPPLIER1111Z1", "invoice_number": "INV-100", "taxable_value": 1000.00, "tax_amount": 180.00},
        {"supplier_gstin": "27SUPPLIER2222Z2", "invoice_number": "INV-200", "taxable_value": 2000.00, "tax_amount": 360.00},
        {"supplier_gstin": "27SUPPLIER3333Z3", "invoice_number": "INV-300", "taxable_value": 5000.00, "tax_amount": 900.00},
    ]

    gstr2b_invoices = [
        {"supplier_gstin": "27SUPPLIER1111Z1", "invoice_number": "INV-100", "taxable_value": 1000.00, "tax_amount": 180.00},  # MATCHED
        {"supplier_gstin": "27SUPPLIER2222Z2", "invoice_number": "INV-200", "taxable_value": 2000.00, "tax_amount": 300.00},  # MISMATCHED_AMOUNT
        {"supplier_gstin": "27SUPPLIER4444Z4", "invoice_number": "INV-400", "taxable_value": 1500.00, "tax_amount": 270.00},  # MISSING_IN_PURCHASE
    ]

    recs = await svc.reconcile_gstr2b(
        db=db_session,
        gstin="27AAAAA0000A1Z5",
        financial_period="072026",
        purchase_invoices=purchase_invoices,
        gstr2b_invoices=gstr2b_invoices,
    )

    assert len(recs) == 4
    statuses = {r.invoice_number: r.reconciliation_status for r in recs}
    assert statuses["INV-100"] == "MATCHED"
    assert statuses["INV-200"] == "MISMATCHED_AMOUNT"
    assert statuses["INV-300"] == "MISSING_IN_GSTR2B"
    assert statuses["INV-400"] == "MISSING_IN_PURCHASE"


@pytest.mark.asyncio
async def test_gst_reconcile_rest_api_endpoint(db_session):
    """Verifies POST /api/v1/compliance/gst/reconcile REST endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/compliance/gst/reconcile",
            json={
                "gstin": "27AAAAA0000A1Z5",
                "financial_period": "072026",
                "purchase_invoices": [
                    {"supplier_gstin": "27SUPPLIER1111Z1", "invoice_number": "INV-500", "taxable_value": 500.00, "tax_amount": 90.00}
                ],
                "gstr2b_invoices": [
                    {"supplier_gstin": "27SUPPLIER1111Z1", "invoice_number": "INV-500", "taxable_value": 500.00, "tax_amount": 90.00}
                ],
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["total_processed"] == 1
        assert data["records"][0]["status"] == "MATCHED"
