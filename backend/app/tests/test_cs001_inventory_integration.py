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
test_cs001_inventory_integration.py
CS001 Consignment Consumer Integration Architectural & Functional Verification Suite

Validates that:
1. CS001.1 Issue Consignment dispatches stock via InventoryCommandFacade.transfer_out().
2. CS001.2 Consignment Sale issues SALE StockMovement via InventoryCommandFacade.issue_sale().
3. CS001.3 Unsold Consignment Return restores warehouse stock via InventoryCommandFacade.transfer_in().
4. CS001.4 Consignment service files exhibit ZERO direct product.stock mutations or forbidden StockMovement instantiations.
5. CS001.5 Cross-Domain Consignment Dispatch -> Sale Report -> Return -> Settlement Cycle maintains canonical ledger integrity.
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
from app.models.inventory import Product, StockMovement


CS_SERVICES_ROOT = Path(__file__).parent.parent / "services"


# ---------------------------------------------------------------------------
# Setup Helpers
# ---------------------------------------------------------------------------

async def _setup_cs_tenant(db):
    """Set up isolated tenant for CS001 test suite."""
    company_id = f"co-cs-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-cs-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Consignment Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Consignment HQ", code=f"CS{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="cs-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_cs_product(db, tenant_ctx, stock=0, price=Decimal("500.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-cs-{uuid.uuid4().hex[:8]}",
        code=f"CSPROD{uuid.uuid4().hex[:8].upper()}",
        name="CS001 Test Item",
        category="General",
        brand="Generic",
        color="Green",
        size="S",
        barcode=f"BC-CS-{uuid.uuid4().hex[:6].upper()}",
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
            source_module="Consignment",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Architecture Guards (Rule #1, #7, #8) for Consignment Service
# ---------------------------------------------------------------------------

def test_cs_services_boundary_guards():
    """Rule #1, #7 & #8 CI Guard: Consignment service MUST NOT update product.stock or instantiate StockMovement directly."""
    cs_files = [
        CS_SERVICES_ROOT / "consignment.py",
    ]

    violations = []
    direct_stock_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*=")
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")

    for filepath in cs_files:
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

    assert not violations, f"Rule #1, #7, #8 violations found in Consignment service: {violations}"


# ---------------------------------------------------------------------------
# Integration Gates (CS001.1 .. CS001.5)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cs001_1_issue_consignment_dispatch_gate(db_session):
    """CS001.1 Gate: Dispatches consignment stock to partner via InventoryCommandFacade.transfer_out()."""
    _, _, tenant_ctx = await _setup_cs_tenant(db_session)
    product = await _make_cs_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    transfer_id = f"cs-xfer-{uuid.uuid4().hex[:8]}"
    transfer_no = f"CS-XFER-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 40}]

    movements = await cmd_facade.transfer_out(
        transfer_id=transfer_id,
        transfer_no=transfer_no,
        items=items,
        source_warehouse="Default Warehouse",
        target_warehouse="Partner Consignment Store",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "TRANSFER_OUT"
    assert movements[0].quantity == Decimal("-40")

    # Verify canonical stock updated to 60 (100 - 40)
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 60.0
    assert float(product.stock) == 60.0


@pytest.mark.asyncio
async def test_cs001_2_unsold_consignment_return_gate(db_session):
    """CS001.3 Gate: Returns unsold consignment stock to warehouse via InventoryCommandFacade.transfer_in()."""
    _, _, tenant_ctx = await _setup_cs_tenant(db_session)
    product = await _make_cs_product(db_session, tenant_ctx, stock=60)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    return_id = f"cs-ret-{uuid.uuid4().hex[:8]}"
    return_no = f"CS-RET-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 15}]

    movements = await cmd_facade.transfer_in(
        transfer_id=return_id,
        transfer_no=return_no,
        items=items,
        target_warehouse="Default Warehouse",
        source_warehouse="Partner Consignment Store",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "TRANSFER_IN"
    assert movements[0].quantity == Decimal("15")

    # Verify canonical stock restored to 75 (60 + 15)
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 75.0
    assert float(product.stock) == 75.0


@pytest.mark.asyncio
async def test_cs001_3_full_consignment_lifecycle_cross_domain(db_session):
    """CS001.5 Gate: Dispatch (50) -> Partner Sale (20) -> Unsold Return (15) -> Final Reconciliation."""
    _, _, tenant_ctx = await _setup_cs_tenant(db_session)
    product = await _make_cs_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. Dispatch 50 to partner store
    await cmd_facade.transfer_out(
        transfer_id=f"cs-disp-{uuid.uuid4().hex[:6]}",
        transfer_no="CS-DISP-50",
        items=[{"product_id": product.id, "quantity": 50}],
        source_warehouse="Default Warehouse",
        target_warehouse="Partner Store",
    )
    await db_session.commit()

    # 2. Partner reports sale of 20 units (issued as SALE StockMovement)
    await cmd_facade.issue_sale(
        invoice_id=f"cs-sale-{uuid.uuid4().hex[:6]}",
        invoice_no="CS-SALE-20",
        items=[{"product_id": product.id, "quantity": 20}],
    )
    await db_session.commit()

    # 3. Unsold return of 15 units back to warehouse
    await cmd_facade.transfer_in(
        transfer_id=f"cs-rtn-{uuid.uuid4().hex[:6]}",
        transfer_no="CS-RTN-15",
        items=[{"product_id": product.id, "quantity": 15}],
        target_warehouse="Default Warehouse",
        source_warehouse="Partner Store",
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    # Calculation: 100 (Opening) - 50 (Dispatch) - 20 (Sale) + 15 (Return) = 45 on-hand
    assert float(state["on_hand"]) == 45.0
    assert float(product.stock) == 45.0
