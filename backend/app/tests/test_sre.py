# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.sre import CorporateGstinRegistry, SreRuleEngine, SreStatutoryLedger
from app.services.sre.sre_service import SreService


@pytest.fixture
async def sre_test_setup(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6]
    company = Company(id=f"comp-{suffix}", name=f"SRE Company {suffix}")
    branch = Branch(
        id=f"br-{suffix}",
        company_id=company.id,
        name=f"SRE Branch {suffix}",
        code=f"BR-{suffix}"
    )
    db_session.add_all([company, branch])
    await db_session.commit()

    tenant_ctx = TenantContext(
        tenant_id="test_tenant_sre",
        company_id=company.id,
        branch_id=branch.id
    )
    return db_session, tenant_ctx


@pytest.mark.asyncio
async def test_gstin_registration(sre_test_setup):
    db, ctx = sre_test_setup
    service = SreService(db, ctx)

    gstin = f"27{uuid.uuid4().hex[:11].upper()}Z1"
    warehouse = "Central Warehouse Mumbai"
    reg = await service.register_gstin(gstin, warehouse)

    assert reg.gstin == gstin
    assert reg.state_code == "27"
    assert reg.warehouse_name == warehouse
    assert reg.tenant_id == ctx.tenant_id


@pytest.mark.asyncio
async def test_compliance_rule_creation(sre_test_setup):
    db, ctx = sre_test_setup
    service = SreService(db, ctx)

    dispatch_type = f"DISPATCH_{uuid.uuid4().hex[:6].upper()}"
    rule = await service.create_compliance_rule(
        dispatch_type=dispatch_type,
        tax_timing="DEFERRED",
        max_deferral_days=180,
        required_doc="DELIVERY_CHALLAN"
    )

    assert rule.dispatch_type == dispatch_type
    assert rule.tax_timing == "DEFERRED"
    assert rule.max_deferral_days == 180
    assert rule.required_document_type == "DELIVERY_CHALLAN"


@pytest.mark.asyncio
async def test_dispatch_boundary_check_intrastate_deferred(sre_test_setup):
    db, ctx = sre_test_setup
    service = SreService(db, ctx)

    # 1. Setup GSTIN registry and rule
    gstin = f"27{uuid.uuid4().hex[:11].upper()}Z1"
    gstin_reg = await service.register_gstin(gstin, "Mumbai WH")
    dispatch_type = f"APPROVAL_{uuid.uuid4().hex[:6].upper()}"
    await service.create_compliance_rule(dispatch_type, "DEFERRED", 180, "DELIVERY_CHALLAN")

    # 2. Evaluate intrastate (both Mumbai state 27)
    payload = {
        "dispatch_id": f"disp-{uuid.uuid4().hex[:6]}",
        "origin_gstin_id": gstin_reg.id,
        "destination_gstin": "27BBBBB2222B2Z2",
        "dispatch_type": dispatch_type,
        "sku": "SKU-UNIT-01",
        "batch_no": "B1",
        "qty": 50,
        "unit_cost": 200.00,
        "gst_rate": 18.00,
        "dispatch_date": "2026-07-19"
    }

    res = await service.evaluate_dispatch_compliance(payload)
    assert res["decision"] == "DEFERRED_TAXATION"
    assert res["action_required"] == "GENERATE_DELIVERY_CHALLAN"
    assert res["expiry_date"] == "2027-01-15"  # 180 days after 2026-07-19


@pytest.mark.asyncio
async def test_dispatch_boundary_check_interstate_immediate(sre_test_setup):
    db, ctx = sre_test_setup
    service = SreService(db, ctx)

    # 1. Setup GSTIN registry and rule
    gstin = f"27{uuid.uuid4().hex[:11].upper()}Z1"
    gstin_reg = await service.register_gstin(gstin, "Mumbai WH") # State 27
    dispatch_type = f"CONSIGNMENT_{uuid.uuid4().hex[:6].upper()}"
    await service.create_compliance_rule(dispatch_type, "DEFERRED", 180, "DELIVERY_CHALLAN")

    # 2. Evaluate interstate (Mumbai 27 -> Gujarat 24)
    # Even if configured for Deferral, interstate distinct person transfers trigger immediate GST.
    payload = {
        "dispatch_id": f"disp-{uuid.uuid4().hex[:6]}",
        "origin_gstin_id": gstin_reg.id,
        "destination_gstin": "24BBBBB2222B2Z2", # State 24
        "dispatch_type": dispatch_type,
        "sku": "SKU-UNIT-02",
        "batch_no": "B2",
        "qty": 100,
        "unit_cost": 150.00,
        "gst_rate": 18.00,
        "dispatch_date": "2026-07-19"
    }

    res = await service.evaluate_dispatch_compliance(payload)
    assert res["decision"] == "IMMEDIATE_TAXATION"
    assert res["action_required"] == "GENERATE_TAX_INVOICE"
    assert res["reason"] == "Interstate stock transfer to a distinct person triggers immediate GST liability."


@pytest.mark.asyncio
async def test_compliance_scan_sweeper(sre_test_setup):
    db, ctx = sre_test_setup
    service = SreService(db, ctx)

    gstin = f"27{uuid.uuid4().hex[:11].upper()}Z1"
    gstin_reg = await service.register_gstin(gstin, "Mumbai WH")

    # Create manual statutory ledger entry that has already expired (expiry in past)
    expired_ledger = SreStatutoryLedger(
        id=str(uuid.uuid4())[:8],
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        sku="SKU-EXPIRED",
        batch_no="BEX",
        dispatch_id="disp-expired-01",
        origin_gstin_id=gstin_reg.id,
        destination_gstin="27BBBBB2222B2Z2",
        total_qty=Decimal("10.0000"),
        approved_qty=Decimal("0.0000"),
        returned_qty=Decimal("0.0000"),
        unit_cost=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        tax_type_applied="DEFERRED",
        statutory_state="TAX_DEFERRED",
        dispatch_date=date.today() - timedelta(days=200),
        expiry_date=date.today() - timedelta(days=20),
        is_asset_on_balance_sheet=True
    )
    db.add(expired_ledger)
    await db.commit()

    # Run sweeper scan
    expired_lots = await service.run_nightly_compliance_scan()
    assert len(expired_lots) == 1
    assert expired_lots[0]["dispatch_id"] == "disp-expired-01"
    assert expired_lots[0]["taxable_quantity"] == 10.0

    # Verify database state updated
    await db.refresh(expired_ledger)
    assert expired_ledger.statutory_state == "DEEMED_SUPPLY_TRIGGERED"
    assert expired_ledger.is_asset_on_balance_sheet == False
