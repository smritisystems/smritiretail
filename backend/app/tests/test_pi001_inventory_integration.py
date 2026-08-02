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
test_pi001_inventory_integration.py
PI_001 Purchase Integration Architectural & Functional Verification Suite

Validates that:
1. Purchase Goods Receipt (GRN) creates StockMovement(PURCHASE) via InventoryCommandFacade.receive_purchase().
2. Purchase Debit Note / Return creates StockMovement(PURCHASE_RETURN) via InventoryCommandFacade.return_purchase().
3. Purchase services contain ZERO direct product.stock assignments or forbidden StockMovement instantiations.
4. Cross-domain Purchase-to-Sales flow (Receive Purchase -> Reserve -> Issue Sale -> Return Sale) maintains canonical identity.
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


PURCHASE_SERVICES_ROOT = Path(__file__).parent.parent / "services"


# ---------------------------------------------------------------------------
# Setup Helpers
# ---------------------------------------------------------------------------

async def _setup_purchase_tenant(db):
    """Set up an isolated tenant for Purchase PI_001 test suite."""
    company_id = f"co-pur-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-pur-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Purchase Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Purchase Store 1", code=f"PUR{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="pur-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_product(db, tenant_ctx, stock=0, price=Decimal("250.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-pur-{uuid.uuid4().hex[:8]}",
        code=f"PURPROD{uuid.uuid4().hex[:8].upper()}",
        name="PI_001 Test Item",
        category="General",
        brand="Generic",
        color="Green",
        size="M",
        barcode=f"BC-PUR-{uuid.uuid4().hex[:6].upper()}",
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
            source_module="Purchase",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Architecture Guards (Rule #1, #7, #8) for Purchase Domain
# ---------------------------------------------------------------------------

def test_purchase_services_boundary_guards():
    """Rule #1, #7 & #8 CI Guard: Purchase services MUST NOT update product.stock or instantiate StockMovement directly."""
    purchase_files = list(PURCHASE_SERVICES_ROOT.glob("*purchase*.py"))

    violations = []
    direct_stock_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*=")
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")

    for filepath in purchase_files:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if clean_line.startswith("#"):
                    continue
                if direct_stock_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Direct stock mutation: {clean_line}"))
                if import_pattern.search(clean_line) or instantiation_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Forbidden StockMovement reference: {clean_line}"))

    assert not violations, f"Rule #1, #7, #8 violations found in Purchase services: {violations}"


# ---------------------------------------------------------------------------
# Integration Gates (PI_001.1 & PI_001.2)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pi001_1_grn_goods_receipt_gate(db_session):
    """PI_001.1 Goods Receipt (GRN) Gate: Receive PURCHASE via InventoryCommandFacade.receive_purchase()."""
    _, _, tenant_ctx = await _setup_purchase_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=0)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    grn_id = f"grn-{uuid.uuid4().hex[:8]}"
    grn_no = f"GRN-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 100}]

    movements = await cmd_facade.receive_purchase(
        grn_id=grn_id,
        grn_no=grn_no,
        items=items,
        warehouse="Default Warehouse",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "PURCHASE"
    assert movements[0].quantity == Decimal("100")

    # Verify trigger reconciled product.stock automatically to 100
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 100.0
    assert float(state["available"]) == 100.0
    assert float(product.stock) == 100.0


@pytest.mark.asyncio
async def test_pi001_2_purchase_return_gate(db_session):
    """PI_001.2 Purchase Return Gate: Return PURCHASE_RETURN via InventoryCommandFacade.return_purchase()."""
    _, _, tenant_ctx = await _setup_purchase_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    return_id = f"dn-{uuid.uuid4().hex[:8]}"
    return_no = f"DN-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 25}]

    movements = await cmd_facade.return_purchase(
        return_id=return_id,
        return_no=return_no,
        items=items,
        warehouse="Default Warehouse",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "PURCHASE_RETURN"
    assert abs(movements[0].quantity) == Decimal("25")

    # Verify trigger reconciled product.stock automatically to 75 (100 - 25)
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 75.0
    assert float(state["available"]) == 75.0
    assert float(product.stock) == 75.0


@pytest.mark.asyncio
async def test_pi001_3_purchase_to_sales_cross_domain_cycle(db_session):
    """Full Cross-Domain Cycle: GRN Receive (150) -> Sales Reserve (30) -> Sales Invoice Issue (20) -> Purchase Return (10)."""
    _, _, tenant_ctx = await _setup_purchase_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=0)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Purchase GRN Receive +150
    await cmd_facade.receive_purchase(
        grn_id=f"grn-{uuid.uuid4().hex[:8]}",
        grn_no=f"GRN-FULL-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 150}],
    )
    await db_session.commit()

    # 2. Sales Reserve 30
    await cmd_facade.reserve_stock(
        product_id=product.id,
        qty=30,
        reference_doc="Sales Order",
        idempotency_key=f"SO-PUR-{uuid.uuid4().hex[:6]}",
    )

    # 3. Sales Invoice Issue 20
    await cmd_facade.issue_sale(
        invoice_id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no=f"INV-PUR-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 20}],
    )
    await db_session.commit()

    # 4. Purchase Return -10
    await cmd_facade.return_purchase(
        return_id=f"dn-{uuid.uuid4().hex[:8]}",
        return_no=f"DN-FULL-{uuid.uuid4().hex[:4].upper()}",
        items=[{"product_id": product.id, "quantity": 10}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    # On Hand: 0 + 150 (GRN) - 20 (Sale) - 10 (Purchase Return) = 120
    # Reserved: 30
    # Available: 120 - 30 = 90
    assert float(state["on_hand"]) == 120.0
    assert float(state["reserved"]) == 30.0
    assert float(state["available"]) == 90.0
    assert float(product.stock) == 120.0
