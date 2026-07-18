# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Version      : 3.31.0
# Modified     : 2026-07-19
# Copyright    : © SMRITIBooks.com. All Rights Reserved.

import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.consignment import ConsignmentPartner
from app.models.sre import SreRuleEngine
from app.models.dispatch import StockDispatch, StockDispatchLine, DispatchApprovalEvent
from app.schemas.dispatch import StockDispatchCreate, StockDispatchLineCreate
from app.services.dispatch_service import DispatchService
from app.services.sre.sre_service import SreService


@pytest.fixture
async def dispatch_test_setup(db_session: AsyncSession):
    suffix = uuid.uuid4().hex[:6]
    company = Company(id=f"comp-{suffix}", name=f"Dispatch Company {suffix}", is_active=True)
    
    db_session.add(company)
    await db_session.commit()
    
    branch = Branch(
        id=f"br-{suffix}",
        company_id=company.id,
        name=f"Dispatch Branch {suffix}",
        code=f"BR-{suffix}",
        is_active=True
    )
    partner = ConsignmentPartner(
        id=f"part-{suffix}",
        name=f"Consignment Partner {suffix}",
        code=f"PART-{suffix}",
        status="Active"
    )
    
    db_session.add_all([branch, partner])
    await db_session.commit()
    
    product = Product(
        id=f"prod-{suffix}",
        code=f"PCODE_{suffix}",
        name=f"Dispatch Product {suffix}",
        category="Apparel",
        barcode=f"BC_{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        price=Decimal("100.00"),
        stock=Decimal("100.00"),
        is_active=True
    )
    db_session.add(product)
    await db_session.commit()

    tenant_ctx = TenantContext(
        tenant_id="test_tenant_dispatch",
        company_id=company.id,
        branch_id=branch.id
    )
    
    # Pre-register GSTIN and rule for SRE matching
    sre_service = SreService(db_session, tenant_ctx)
    gstin = f"27{uuid.uuid4().hex[:11].upper()}Z1"
    gstin_reg = await sre_service.register_gstin(gstin, "Mumbai WH")
    
    # Check if rule exists before creating
    existing_rule = await db_session.execute(
        select(SreRuleEngine).filter(
            SreRuleEngine.dispatch_type == "SALE_ON_APPROVAL",
            SreRuleEngine.is_deleted == False
        )
    )
    if not existing_rule.scalars().first():
        await sre_service.create_compliance_rule("SALE_ON_APPROVAL", "DEFERRED", 180, "DELIVERY_CHALLAN")

    return db_session, tenant_ctx, partner, product, gstin_reg


@pytest.mark.asyncio
async def test_create_dispatch_updates_stock(dispatch_test_setup):
    db, ctx, partner, product, gstin_reg = dispatch_test_setup
    service = DispatchService(db, ctx)

    payload = StockDispatchCreate(
        dispatch_type="SALE_ON_APPROVAL",
        partner_id=partner.id,
        dispatch_date=date.today(),
        notes="Test Dispatch Note",
        items=[
            StockDispatchLineCreate(
                product_id=product.id,
                sku=product.code,
                name=product.name,
                qty_sent=Decimal("20.00"),
                rate=Decimal("150.00"),
                gst_rate=Decimal("18.00")
            )
        ]
    )

    dispatch = await service.create_dispatch(
        payload=payload,
        origin_gstin_id=gstin_reg.id,
        destination_gstin="27BBBBB2222B2Z2",
        ip_address="127.0.0.1"
    )

    await db.refresh(dispatch, ["items"])
    assert dispatch.dispatch_type == "SALE_ON_APPROVAL"
    assert dispatch.status == "Dispatched"
    assert len(dispatch.items) == 1
    assert dispatch.items[0].qty_sent == Decimal("20.00")
    
    # Assert stock reduced in db
    await db.refresh(product)
    assert product.stock == Decimal("80.00")


@pytest.mark.asyncio
async def test_submit_sale_report(dispatch_test_setup):
    db, ctx, partner, product, gstin_reg = dispatch_test_setup
    service = DispatchService(db, ctx)

    # 1. Create dispatch
    payload = StockDispatchCreate(
        dispatch_type="SALE_ON_APPROVAL",
        partner_id=partner.id,
        dispatch_date=date.today(),
        items=[
            StockDispatchLineCreate(
                product_id=product.id,
                sku=product.code,
                name=product.name,
                qty_sent=Decimal("30.00"),
                rate=Decimal("150.00"),
                gst_rate=Decimal("18.00")
            )
        ]
    )
    dispatch = await service.create_dispatch(payload, gstin_reg.id, "27BBBBB2222B2Z2")
    await db.refresh(dispatch, ["items"])
    line = dispatch.items[0]

    # 2. Submit sales report for 10 units
    report = [{"line_id": line.id, "qty_sold": 10}]
    updated = await service.submit_sale_report(dispatch.id, report)

    await db.refresh(updated, ["items"])
    assert updated.items[0].qty_invoiced == Decimal("10.00")
    assert updated.items[0].qty_on_hand == Decimal("20.00")


@pytest.mark.asyncio
async def test_process_return(dispatch_test_setup):
    db, ctx, partner, product, gstin_reg = dispatch_test_setup
    service = DispatchService(db, ctx)

    # 1. Create dispatch
    payload = StockDispatchCreate(
        dispatch_type="SALE_ON_APPROVAL",
        partner_id=partner.id,
        dispatch_date=date.today(),
        items=[
            StockDispatchLineCreate(
                product_id=product.id,
                sku=product.code,
                name=product.name,
                qty_sent=Decimal("30.00"),
                rate=Decimal("150.00"),
                gst_rate=Decimal("18.00")
            )
        ]
    )
    dispatch = await service.create_dispatch(payload, gstin_reg.id, "27BBBBB2222B2Z2")
    await db.refresh(dispatch, ["items"])
    line = dispatch.items[0]

    # 2. Return 15 units back to warehouse
    returns = [{"line_id": line.id, "qty_returned": 15}]
    updated = await service.process_return(dispatch.id, returns)

    await db.refresh(updated, ["items"])
    assert updated.items[0].qty_returned == Decimal("15.00")
    assert updated.items[0].qty_on_hand == Decimal("15.00")
    
    # Assert stock restored in db (original 100 - 30 sent + 15 returned = 85)
    await db.refresh(product)
    assert product.stock == Decimal("85.00")
