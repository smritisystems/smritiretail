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
test_wms001_inventory_integration.py
WMS001 Warehouse / WMS Consumer Integration Architectural & Functional Verification Suite

Validates that:
1. Physical Stock Count audit variance reconciles stock via InventoryCommandFacade.adjust_stock().
2. Inter-warehouse transfer shipping & receiving execute via InventoryCommandFacade.transfer_out() & transfer_in().
3. WMS services exhibit ZERO direct product.stock mutations or forbidden StockMovement instantiations.
4. Cross-domain Purchase -> WMS Audit -> Stock Transfer -> Sales Cycle maintains canonical ledger integrity.
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


WMS_SERVICES_ROOT = Path(__file__).parent.parent / "services"


# ---------------------------------------------------------------------------
# Setup Helpers
# ---------------------------------------------------------------------------

async def _setup_wms_tenant(db):
    """Set up an isolated tenant for WMS WMS001 test suite."""
    company_id = f"co-wms-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-wms-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="WMS Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="WMS Central Warehouse", code=f"WMS{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="wms-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_wms_product(db, tenant_ctx, stock=0, price=Decimal("200.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-wms-{uuid.uuid4().hex[:8]}",
        code=f"WMSPROD{uuid.uuid4().hex[:8].upper()}",
        name="WMS001 Test Item",
        category="General",
        brand="Generic",
        color="Black",
        size="XL",
        barcode=f"BC-WMS-{uuid.uuid4().hex[:6].upper()}",
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
            warehouse="Central Warehouse",
            unit_cost=price,
            remarks="Opening stock fixture",
            source_module="Warehouse",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.commit()
        await db.refresh(product)
    return product


# ---------------------------------------------------------------------------
# Architecture Guards (Rule #1, #7, #8) for WMS Services
# ---------------------------------------------------------------------------

def test_wms_services_boundary_guards():
    """Rule #1, #7 & #8 CI Guard: WMS services MUST NOT update product.stock or instantiate StockMovement directly."""
    wms_files = [
        WMS_SERVICES_ROOT / "stock_audit_engine.py",
        WMS_SERVICES_ROOT / "stock_transfer_engine.py",
    ]

    violations = []
    direct_stock_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*=")
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")

    for filepath in wms_files:
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

    assert not violations, f"Rule #1, #7, #8 violations found in WMS services: {violations}"


# ---------------------------------------------------------------------------
# Integration Gates (WMS001.1, WMS001.2, WMS001.3)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_wms001_1_physical_stock_audit_adjustment_gate(db_session):
    """WMS001.1 Audit Gate: Reconcile physical stock count variance via InventoryCommandFacade.adjust_stock()."""
    _, _, tenant_ctx = await _setup_wms_tenant(db_session)
    product = await _make_wms_product(db_session, tenant_ctx, stock=100)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    audit_id = f"audit-{uuid.uuid4().hex[:8]}"
    audit_no = f"AUD-{uuid.uuid4().hex[:6].upper()}"

    # Physical count shows 92 (variance -8)
    items = [{"product_id": product.id, "variance_quantity": -8}]

    movements = await cmd_facade.adjust_stock(
        audit_id=audit_id,
        audit_no=audit_no,
        items=items,
        warehouse="Central Warehouse",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "ADJUSTMENT"
    assert abs(movements[0].quantity) == Decimal("8")
    assert getattr(movements[0], "source_module", "Warehouse") == "Warehouse"

    # Verify state engine automatically reconciles product.stock to 92
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 92.0
    assert float(state["available"]) == 92.0
    assert float(product.stock) == 92.0


@pytest.mark.asyncio
async def test_wms001_2_inter_warehouse_stock_transfer_gate(db_session):
    """WMS001.2 Stock Transfer Gate: Execute Transfer Out & Transfer In via InventoryCommandFacade."""
    _, _, tenant_ctx = await _setup_wms_tenant(db_session)
    product = await _make_wms_product(db_session, tenant_ctx, stock=50)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    transfer_id = f"xfer-{uuid.uuid4().hex[:8]}"
    transfer_no = f"XFER-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 20}]

    # 1. Dispatch Transfer Out -20 from Central Warehouse
    out_movements = await cmd_facade.transfer_out(
        transfer_id=transfer_id,
        transfer_no=transfer_no,
        items=items,
        source_warehouse="Central Warehouse",
        target_warehouse="Retail Store Branch",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(out_movements) == 1
    assert out_movements[0].movement_type == "TRANSFER_OUT"
    assert abs(out_movements[0].quantity) == Decimal("20")

    state_mid = await query_facade.get_canonical_state(product.id)
    assert float(state_mid["on_hand"]) == 30.0

    # 2. Receive Transfer In +20 at Retail Store Branch
    in_movements = await cmd_facade.transfer_in(
        transfer_id=transfer_id,
        transfer_no=transfer_no,
        items=items,
        target_warehouse="Retail Store Branch",
        source_warehouse="Central Warehouse",
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(in_movements) == 1
    assert in_movements[0].movement_type == "TRANSFER_IN"
    assert in_movements[0].quantity == Decimal("20")

    state_final = await query_facade.get_canonical_state(product.id)
    assert float(state_final["on_hand"]) == 50.0
    assert float(product.stock) == 50.0


@pytest.mark.asyncio
async def test_wms001_3_wms_to_sales_purchase_cross_domain_cycle(db_session):
    """WMS001.3 Cross-Domain Cycle: GRN Receive (100) -> Audit Adjust (-10) -> Sales Order Issue (-30) -> Return (+5)."""
    _, _, tenant_ctx = await _setup_wms_tenant(db_session)
    product = await _make_wms_product(db_session, tenant_ctx, stock=0)

    cmd_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    # 1. GRN Purchase Receive +100
    await cmd_facade.receive_purchase(
        grn_id=f"grn-wms-{uuid.uuid4().hex[:6]}",
        grn_no="GRN-WMS-100",
        items=[{"product_id": product.id, "quantity": 100}],
    )
    await db_session.commit()

    # 2. WMS Audit Adjustment -10
    await cmd_facade.adjust_stock(
        audit_id=f"aud-wms-{uuid.uuid4().hex[:6]}",
        audit_no="AUD-WMS-10",
        items=[{"product_id": product.id, "variance_quantity": -10}],
    )
    await db_session.commit()

    # 3. Sales Invoice Issue -30
    await cmd_facade.issue_sale(
        invoice_id=f"inv-wms-{uuid.uuid4().hex[:6]}",
        invoice_no="INV-WMS-30",
        items=[{"product_id": product.id, "quantity": 30}],
    )
    await db_session.commit()

    # 4. Sales Return +5
    await cmd_facade.return_sale(
        return_id=f"ret-wms-{uuid.uuid4().hex[:6]}",
        return_no="RET-WMS-5",
        items=[{"product_id": product.id, "quantity": 5}],
    )
    await db_session.commit()
    await db_session.refresh(product)

    state = await query_facade.get_canonical_state(product.id)

    # Calculation: 0 + 100 (GRN) - 10 (Audit) - 30 (Sale) + 5 (Return) = 65
    assert float(state["on_hand"]) == 65.0
    assert float(state["available"]) == 65.0
    assert float(product.stock) == 65.0
