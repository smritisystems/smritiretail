from __future__ import annotations
"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

"""
test_mp001_inventory_integration.py
MP001 Marketplace Consumer Integration Architectural & Functional Verification Suite

Validates that:
1. MP001.1 Marketplace ATP Query executes via InventoryQueryFacade.can_fulfill().
2. MP001.2 Channel Reservation executes via InventoryReservationService.reserve_stock().
3. MP001.3 Marketplace Dispatch issues SALE StockMovement via InventoryCommandFacade.issue_sale().
4. MP001.4 Marketplace Return issues SALE_RETURN StockMovement via InventoryCommandFacade.return_sale().
5. MP001.5 Multi-channel Inventory Sync fetches canonical state via InventoryQueryFacade.get_canonical_state().
6. E-commerce pipeline services exhibit ZERO direct product.stock mutations or forbidden StockMovement instantiations.
"""

import re
import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade
from app.services.ecommerce_sync import ECommerceSyncPipeline
from app.models.inventory import Product, StockMovement


MP_SERVICES_ROOT = Path(__file__).parent.parent / "services"


# ---------------------------------------------------------------------------
# Setup Helpers
# ---------------------------------------------------------------------------

async def _setup_mp_tenant(db):
    """Set up isolated tenant for MP001 test suite."""
    company_id = f"co-mp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-mp-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Marketplace Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Marketplace Store", code=f"MP{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="mp-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_mp_product(db, tenant_ctx, stock=0, price=Decimal("300.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-mp-{uuid.uuid4().hex[:8]}",
        code=f"MPPROD{uuid.uuid4().hex[:8].upper()}",
        name="MP001 Test Item",
        category="General",
        brand="Generic",
        color="Red",
        size="M",
        barcode=f"BC-MP-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price,
    )
    product = await inv_service.create_product(p_in)
    if stock > 0:
        ts = int(datetime.now(timezone.utc).timestamp() * 1_000_000)
        sm = StockMovement(
            id=f"SM-{ts}-{uuid.uuid4().hex[:6]}",
            uuid=str(uuid.uuid4()),
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or product.code,
            quantity=Decimal(str(stock)),
            movement_type="OPENING",
            reference_doc_type="OPENING_BALANCE",
            reference_doc_id=product.id,
            warehouse="Default Warehouse",
            unit_cost=price,
            remarks="Opening stock fixture",
            source_module="Marketplace",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Architecture Guards (Rule #1, #7, #8) for Marketplace Services
# ---------------------------------------------------------------------------

def test_mp_services_boundary_guards():
    """Rule #1, #7 & #8 CI Guard: E-commerce pipeline MUST NOT update product.stock or instantiate StockMovement directly."""
    mp_files = [
        MP_SERVICES_ROOT / "ecommerce_sync.py",
    ]

    violations = []
    direct_stock_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*=")
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")

    for filepath in mp_files:
        if not filepath.exists():
            continue
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if clean_line.startswith("#"):
                    continue
                if direct_stock_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Direct stock mutation: {clean_line}"))
                if import_pattern.search(clean_line) or instantiation_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Forbidden StockMovement reference: {clean_line}"))

    assert not violations, f"Rule #1, #7, #8 violations found in Marketplace services: {violations}"


# ---------------------------------------------------------------------------
# Integration Gates (MP001.1 .. MP001.5)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mp001_1_marketplace_atp_and_incoming_order_gate(db_session):
    """MP001.1 & MP001.3 Gate: Incoming e-commerce order checks ATP and issues sale via facades."""
    _, _, tenant_ctx = await _setup_mp_tenant(db_session)
    product = await _make_mp_product(db_session, tenant_ctx, stock=50)

    pipeline = ECommerceSyncPipeline(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    order_payload = {
        "id": f"ord-amz-{uuid.uuid4().hex[:6]}",
        "sku": product.code,
        "quantity": 15,
    }

    res = await pipeline.process_incoming_order(channel_name="Amazon", channel_order=order_payload)
    await db_session.commit()
    await db_session.refresh(product)

    assert res["status"] == "ALLOCATED"
    assert res["quantity"] == 15

    # Verify canonical on-hand stock updated automatically to 35 (50 - 15)
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 35.0
    assert float(product.stock) == 35.0


@pytest.mark.asyncio
async def test_mp001_2_channel_reservation_and_sync_gate(db_session):
    """MP001.2 & MP001.5 Gate: Reserve stock for channel and sync canonical stock level."""
    _, _, tenant_ctx = await _setup_mp_tenant(db_session)
    product = await _make_mp_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    pipeline = ECommerceSyncPipeline(db_session, tenant_ctx)

    # Reserve 30 units for Shopify Flash Sale
    await cmd_facade.reserve_stock(
        product_id=product.id,
        qty=30,
        reference_doc="Shopify Flash Sale",
        idempotency_key=f"res-shpfy-{uuid.uuid4().hex[:6]}",
    )
    await db_session.commit()

    # Sync channel stock (Available = 100 - 30 = 70)
    sync_res = await pipeline.sync_stock_to_channels(product.id)

    assert sync_res["synced"] is True
    assert sync_res["sync_stock"] == 70.0
    assert "Shopify" in sync_res["channels_updated"]


@pytest.mark.asyncio
async def test_mp001_3_marketplace_return_and_reconciliation_cycle(db_session):
    """MP001.4 Gate: Process marketplace sale return and verify state engine reconciliation."""
    _, _, tenant_ctx = await _setup_mp_tenant(db_session)
    product = await _make_mp_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Issue Marketplace Sale -40
    await cmd_facade.issue_sale(
        invoice_id=f"inv-mp-{uuid.uuid4().hex[:6]}",
        invoice_no="INV-MP-40",
        items=[{"product_id": product.id, "quantity": 40}],
    )
    await db_session.commit()

    # 2. Return Marketplace Sale +10
    await cmd_facade.return_sale(
        return_id=f"ret-mp-{uuid.uuid4().hex[:6]}",
        return_no="RET-MP-10",
        items=[{"product_id": product.id, "quantity": 10}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    # On hand: 100 - 40 + 10 = 70
    assert float(state["on_hand"]) == 70.0
    assert float(state["available"]) == 70.0
    assert float(product.stock) == 70.0
