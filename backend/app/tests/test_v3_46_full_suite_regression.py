"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.46.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
import asyncio
from decimal import Decimal
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.models.auth import User
from app.models.product_identity import ProductIdentity
from app.models.security import SMRITIRole
from app.services.rebalancing_service import StockRebalancingService
from app.services.security import SecurityService
from app.services.identity_service import ProductIdentityService
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
async def test_full_platform_v3_46_integrated_suite(db_session):
    """
    Executes an integrated regression test across v3.40.0 through v3.45.0 modules:
    1. Multi-Store Stock Rebalancing
    2. SSACF Security Scope Resolution
    3. SGIP GST Reconciliation
    4. PIE GS1 Mod-10 Barcode Assignment
    5. Strangler-Fig Cutover Status Check
    6. PIE Matrix Variant Resolution
    """
    # 1. Stock Rebalancing
    reb_svc = StockRebalancingService()
    recs = await reb_svc.calculate_rebalancing_recommendations(
        db=db_session,
        source_branch_id="br-headquarters",
        target_branch_id="br-downtown",
        min_threshold_qty=10,
    )
    assert isinstance(recs, list)

    # 2. SSACF Security Scopes
    sec_svc = SecurityService(db_session)
    user = User(id="usr-reg-01", email="reg@smriti.com", hashed_password="pwd", is_platform_admin=True)
    db_session.add(user)
    await db_session.commit()
    scopes = await sec_svc.get_effective_permission_scopes(user.id)
    assert isinstance(scopes, dict)

    # 3. SGIP GST Reconciliation
    gst_svc = GSTReconciliationService()
    reconciled = await gst_svc.reconcile_gstr2b(
        db=db_session,
        gstin="27AAAAA0000A1Z5",
        financial_period="072026",
        purchase_invoices=[{"supplier_gstin": "27SUPP1Z1", "invoice_number": "INV-REG-1", "taxable_value": 1000.0, "tax_amount": 180.0}],
        gstr2b_invoices=[{"supplier_gstin": "27SUPP1Z1", "invoice_number": "INV-REG-1", "taxable_value": 1000.0, "tax_amount": 180.0}],
    )
    assert len(reconciled) == 1
    assert reconciled[0].reconciliation_status == "MATCHED"

    # 4. PIE Barcode & SKU Assignment
    pie_svc = ProductIdentityService()
    identity = await pie_svc.assign_gs1_barcode(
        db=db_session,
        product_id="prod-reg-01",
        sku_business_key="SKU-REG-SUITE-001",
        name="Regression Item",
        category="Test",
        brand="SMRITI",
    )
    assert len(identity.barcode) == 13
    assert identity.barcode.startswith("8901000")

    # 5. PIE Variant Resolution
    variants = await pie_svc.generate_variant_skus(
        db=db_session,
        parent_product_id="prod-reg-01",
        parent_sku="SKU-REG-SUITE-001",
        variants=[{"size": "XL", "color": "Black"}],
    )
    assert len(variants) == 1
    assert variants[0]["variant_sku"] == "SKU-REG-SUITE-001-BLACK-XL"

    # 6. Strangler-Fig Cutover HTTP API Verification
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health/cutover")
        assert res.status_code == 200
        data = res.json()
        assert data["migration_progress_percent"] == 100.0
        assert data["system_of_record"] == "FastAPI + Postgres"
