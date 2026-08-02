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
test_pos001_inventory_integration.py
POS001 POS Consumer Integration Architectural & Functional Verification Suite

Validates that:
1. POS checkout issues StockMovement(SALE) via InventoryCommandFacade.issue_pos_sale().
2. POS queries ATP stock via InventoryQueryFacade.can_fulfill() & get_canonical_state().
3. POS services exhibit ZERO direct product.stock mutations or forbidden StockMovement instantiations.
4. Cross-domain Purchase -> Sales -> POS checkout flow maintains canonical identity across triggers.
"""

import re
import uuid
from pathlib import Path
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from app.db.session import active_tenant_ctx
from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.services.inventory import InventoryService
from app.schemas.inventory import ProductCreate
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade
from app.models.inventory import Product, StockMovement


POS_SERVICES_ROOT = Path(__file__).parent.parent / "services"


# ---------------------------------------------------------------------------
# Setup Helpers
# ---------------------------------------------------------------------------

async def _setup_pos_tenant(db):
    """Set up an isolated tenant for POS POS001 test suite."""
    company_id = f"co-pos-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-pos-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="POS Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="POS Store 1", code=f"POS{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="pos-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_pos_product(db, tenant_ctx, stock=0, price=Decimal("150.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-pos-{uuid.uuid4().hex[:8]}",
        code=f"POSPROD{uuid.uuid4().hex[:8].upper()}",
        name="POS001 Test Item",
        category="General",
        brand="Generic",
        color="Blue",
        size="L",
        barcode=f"BC-POS-{uuid.uuid4().hex[:6].upper()}",
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
            source_module="POS",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Architecture Guards (Rule #1, #7, #8) for POS Domain
# ---------------------------------------------------------------------------

def test_pos_services_boundary_guards():
    """Rule #1, #7 & #8 CI Guard: POS services MUST NOT update product.stock or instantiate StockMovement directly."""
    pos_files = [
        POS_SERVICES_ROOT / "pos.py",
        POS_SERVICES_ROOT / "pos_engine.py",
    ]

    violations = []
    direct_stock_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*=")
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")

    for filepath in pos_files:
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

    assert not violations, f"Rule #1, #7, #8 violations found in POS services: {violations}"


# ---------------------------------------------------------------------------
# Integration Gates (POS001.1, POS001.2, POS001.3)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pos001_1_quick_checkout_gate(db_session):
    """POS001.1 Quick Checkout Gate: Issue POS SALE via InventoryCommandFacade.issue_pos_sale()."""
    _, _, tenant_ctx = await _setup_pos_tenant(db_session)
    product = await _make_pos_product(db_session, tenant_ctx, stock=50)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    receipt_id = f"pos-inv-{uuid.uuid4().hex[:8]}"
    receipt_no = f"POS-REC-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 15}]

    movements = await cmd_facade.issue_pos_sale(
        receipt_id=receipt_id,
        receipt_no=receipt_no,
        items=items,
        warehouse="Default Warehouse",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "SALE"
    assert abs(movements[0].quantity) == Decimal("15")
    assert movements[0].source_module == "POS"

    # Verify trigger reconciled product.stock automatically to 35 (50 - 15)
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 35.0
    assert float(state["available"]) == 35.0
    assert float(product.stock) == 35.0


@pytest.mark.asyncio
async def test_pos001_2_pos_atp_availability_gate(db_session):
    """POS001.2 ATP Gate: POS checks ATP availability via InventoryQueryFacade.can_fulfill()."""
    _, _, tenant_ctx = await _setup_pos_tenant(db_session)
    product = await _make_pos_product(db_session, tenant_ctx, stock=20)

    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # Check fulfill 15 (should succeed)
    res_pass = await query_facade.can_fulfill(product.id, qty=15)
    assert res_pass["can_fulfill"] is True
    assert float(res_pass["available_qty"]) == 20.0

    # Check fulfill 25 (should fail)
    res_fail = await query_facade.can_fulfill(product.id, qty=25)
    assert res_fail["can_fulfill"] is False
    assert float(res_fail["available_qty"]) == 20.0


@pytest.mark.asyncio
async def test_pos001_3_full_pos_sales_purchase_cross_domain(db_session):
    """Full Cross-Domain Flow: GRN Receive (100) -> Sales Reserve (20) -> POS Checkout (30) -> Purchase Return (10)."""
    _, _, tenant_ctx = await _setup_pos_tenant(db_session)
    product = await _make_pos_product(db_session, tenant_ctx, stock=0)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Purchase GRN Receive +100
    await cmd_facade.receive_purchase(
        grn_id=f"grn-pos-{uuid.uuid4().hex[:6]}",
        grn_no=f"GRN-POS-100",
        items=[{"product_id": product.id, "quantity": 100}],
    )
    await db_session.commit()

    # 2. Sales Order Reserve 20
    await cmd_facade.reserve_stock(
        product_id=product.id,
        qty=20,
        reference_doc="Sales Order",
        idempotency_key=f"SO-POS-{uuid.uuid4().hex[:6]}",
    )

    # 3. POS Counter Sale Checkout -30
    await cmd_facade.issue_pos_sale(
        receipt_id=f"pos-rec-{uuid.uuid4().hex[:6]}",
        receipt_no=f"POS-REC-30",
        items=[{"product_id": product.id, "quantity": 30}],
    )
    await db_session.commit()

    # 4. Purchase Return -10
    await cmd_facade.return_purchase(
        return_id=f"dn-pos-{uuid.uuid4().hex[:6]}",
        return_no=f"DN-POS-10",
        items=[{"product_id": product.id, "quantity": 10}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    # On Hand: 0 + 100 (GRN) - 30 (POS) - 10 (Purchase Return) = 60
    # Reserved: 20
    # Available: 60 - 20 = 40
    assert float(state["on_hand"]) == 60.0
    assert float(state["reserved"]) == 20.0
    assert float(state["available"]) == 40.0
    assert float(product.stock) == 60.0
