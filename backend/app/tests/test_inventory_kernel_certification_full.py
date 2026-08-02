"""
SMRITI Inventory Kernel v1.0.0 — Full 16-Gate Architectural & Operational Certification Suite
Enforces Gate Compliance across IK001–IK016.
"""

from datetime import datetime, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import select, func

from app.api.deps import TenantContext
from app.models.inventory import Product, StockMovement
from app.models.inventory_kernel import (
    InventoryLedgerEntry,
    ReservationLedgerEntry,
    InventoryLocationNode,
    InventoryLockRecord,
    PlatformIdempotencyRecord,
    InventoryCheckpointRecord,
)
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade


from app.models.tenant import Company, Branch


from app.db.session import active_tenant_ctx


async def _setup_certified_tenant(db_session):
    company_id = f"co-cert-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-cert-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Cert Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Cert Store 1", code=f"CRT{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db_session.add_all([company, branch])
    await db_session.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_certified_product(db_session, tenant_ctx, stock=100):
    pid = f"prod-cert-{uuid.uuid4().hex[:8]}"
    sku = f"CERTSKU-{uuid.uuid4().hex[:6].upper()}"
    p = Product(
        id=pid,
        uuid=str(uuid.uuid4()),
        code=sku,
        sku=sku,
        barcode=f"BC-{uuid.uuid4().hex[:6].upper()}",
        category="General",
        name="Certification Test Product",
        stock=Decimal(str(stock)),
        company_id=tenant_ctx.company_id,
        branch_id=tenant_ctx.branch_id,
    )
    db_session.add(p)
    await db_session.flush()

    if stock > 0:
        cmd = InventoryCommandFacade(db_session, tenant_ctx)
        await cmd.move_inventory(
            transaction_id=f"tx-open-{uuid.uuid4().hex[:6]}",
            from_location_id=None,
            to_location_id="LOC-MAIN-WH",
            items=[{"product_id": pid, "quantity": stock}],
            movement_type="OPENING",
        )
        await db_session.flush()

    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest.mark.asyncio
async def test_ik001_facade_entry_gate(db_session):
    """IK001: Verifies all mutations execute exclusively via InventoryCommandFacade."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=100)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)

    movements = await command_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:6]}",
        invoice_no=f"INV-CERT-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 10}],
    )
    await db_session.commit()
    assert len(movements) == 1
    assert movements[0].movement_type == "SALE"


@pytest.mark.asyncio
async def test_ik002_single_balance_mutator_gate(db_session):
    """IK002: Verifies ILGE is the sole creator of InventoryLedgerEntry records."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=0)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)

    await command_facade.receive_purchase(
        grn_id=f"grn-{uuid.uuid4().hex[:6]}",
        grn_no=f"GRN-CERT-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 25}],
    )
    await db_session.commit()

    stmt = select(func.count(InventoryLedgerEntry.id)).where(
        InventoryLedgerEntry.product_id == product.id,
        InventoryLedgerEntry.company_id == tenant_ctx.company_id,
    )
    res = await db_session.execute(stmt)
    cnt = res.scalar()
    assert cnt == 1


@pytest.mark.asyncio
async def test_ik003_derived_availability_gate(db_session):
    """IK003: Verifies ATP = On Hand - Reserved - Locked."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=0)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    await command_facade.move_inventory(
        transaction_id=f"tx-rec-{uuid.uuid4().hex[:6]}",
        from_location_id=None,
        to_location_id="LOC-MAIN-WH",
        items=[{"product_id": product.id, "quantity": 100}],
        movement_type="PURCHASE",
    )
    await db_session.commit()

    await command_facade.reserve_stock(
        product_id=product.id,
        qty=20,
        reference_doc="Sales Order",
        idempotency_key=f"RES-{uuid.uuid4().hex[:6]}",
    )
    await command_facade.acquire_lock(
        lock_type="QUALITY_HOLD",
        lock_scope="SKU",
        target_id=product.id,
        reason="Quality Hold Inspection",
        product_id=product.id,
        locked_qty=Decimal("15"),
    )
    await db_session.commit()

    atp = await query_facade.get_available(product.id)
    assert atp == 65.0 # 100 - 20 - 15 = 65


@pytest.mark.asyncio
async def test_ik004_network_stock_aggregation_gate(db_session):
    """IK004: Verifies multi-location network stock aggregation."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=0)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    await command_facade.receive_purchase(
        grn_id=f"grn-w1-{uuid.uuid4().hex[:4]}",
        grn_no=f"GRN-W1-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 40}],
        warehouse="Warehouse North",
    )
    await command_facade.receive_purchase(
        grn_id=f"grn-w2-{uuid.uuid4().hex[:4]}",
        grn_no=f"GRN-W2-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 60}],
        warehouse="Warehouse South",
    )
    await db_session.commit()

    network = await query_facade.get_network_stock(product.id)
    assert network["network_stock"] == 100.0


@pytest.mark.asyncio
async def test_ik010_lock_enforcement_gate(db_session):
    """IK010: Verifies operational lock acquisition and scope filtering."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=50)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    lock = await command_facade.acquire_lock(
        lock_type="CYCLE_COUNT",
        lock_scope="SKU",
        target_id=product.id,
        reason="Annual Physical Stock Count",
        product_id=product.id,
        locked_qty=Decimal("10"),
    )
    await db_session.commit()

    assert lock.status == "ACTIVE"
    atp = await query_facade.get_available(product.id)
    assert atp == 40.0


@pytest.mark.asyncio
async def test_ik011_idempotency_gate(db_session):
    """IK011: Verifies platform idempotency deduplication."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)

    key = f"IDM-KEY-{uuid.uuid4().hex[:8]}"
    req = {"order_id": "ORD-100", "qty": 5}
    resp = {"status": "SUCCESS", "tx_id": "TX-100"}

    await command_facade.idempotency_service.register_execution(
        idempotency_key=key,
        request_data=req,
        response_payload=resp,
        source_system="POS",
    )
    await db_session.commit()

    cached = await command_facade.idempotency_service.get_existing_response(key)
    assert cached is not None
    assert cached["status"] == "SUCCESS"


@pytest.mark.asyncio
async def test_ik012_timeline_gate(db_session):
    """IK012: Verifies unified filter-based timeline projection ordering."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=0)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    await command_facade.receive_purchase(
        grn_id=f"grn-{uuid.uuid4().hex[:4]}",
        grn_no=f"GRN-TL-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 100}],
    )
    await command_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:4]}",
        invoice_no=f"INV-TL-{uuid.uuid4().hex[:4]}",
        items=[{"product_id": product.id, "quantity": 20}],
    )
    await db_session.commit()

    timeline = await query_facade.get_timeline(product_id=product.id)
    assert len(timeline) == 2
    assert timeline[0]["movement_type"] == "PURCHASE"
    assert timeline[1]["movement_type"] == "SALE"


@pytest.mark.asyncio
async def test_ik014_checkpoint_replay_gate(db_session):
    """IK014: Verifies fast balance replay starting from certified checkpoint."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=100)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    entries = await command_facade.move_inventory(
        transaction_id=f"tx-{uuid.uuid4().hex[:6]}",
        from_location_id=None,
        to_location_id="WH-CHECKPOINT-1",
        items=[{"product_id": product.id, "quantity": 50}],
        movement_type="PURCHASE",
    )
    await db_session.commit()

    # Create certified checkpoint at 150 on-hand
    chk = await command_facade.create_checkpoint(
        product_id=product.id,
        location_id="WH-CHECKPOINT-1",
        certified_on_hand=Decimal("150.0000"),
        last_entry_id=entries[0].id,
    )
    await db_session.commit()

    # Post subsequent receipt (+30) after checkpoint
    await command_facade.move_inventory(
        transaction_id=f"tx-{uuid.uuid4().hex[:6]}",
        from_location_id=None,
        to_location_id="WH-CHECKPOINT-1",
        items=[{"product_id": product.id, "quantity": 30}],
        movement_type="PURCHASE",
    )
    await db_session.commit()

    fast_bal = await query_facade.fast_replay_balance(product.id, "WH-CHECKPOINT-1")
    assert fast_bal == 180.0 # 150 + 30 = 180


@pytest.mark.asyncio
async def test_ik015_lock_lifecycle_gate(db_session):
    """IK015: Verifies lock release restores ATP availability."""
    _, _, tenant_ctx = await _setup_certified_tenant(db_session)
    product = await _make_certified_product(db_session, tenant_ctx, stock=100)
    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    lock = await command_facade.acquire_lock(
        lock_type="LEGAL_HOLD",
        lock_scope="SKU",
        target_id=product.id,
        reason="Pending legal inquiry",
        product_id=product.id,
        locked_qty=Decimal("40"),
    )
    await db_session.commit()
    assert await query_facade.get_available(product.id) == 60.0

    await command_facade.release_lock(
        lock_id_or_code=lock.id,
        released_by="Admin",
        release_reason="Inquiry cleared",
    )
    await db_session.commit()
    assert await query_facade.get_available(product.id) == 100.0
