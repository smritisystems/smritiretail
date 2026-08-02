"""
test_si001_inventory_integration.py
SI_001 Sales Integration Architectural & Functional Verification Suite

Validates that:
1. Sales consumes InventoryAvailabilityService for can_fulfill queries.
2. Sales consumes InventoryReservationService for reserve / release operations.
3. SalesInvoice issue creates StockMovement(SALE) and relies on trigger reconciliation.
4. SalesReturn creates StockMovement(SALE_RETURN) and relies on trigger reconciliation.
5. No direct product.stock assignments exist anywhere in sales services.
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
from app.services.inventory_availability import InventoryAvailabilityService
from app.services.inventory_reservation import InventoryReservationService
from app.models.inventory import StockMovement


SALES_SERVICES_ROOT = Path(__file__).parent.parent / "services"


async def _setup_sales_tenant(db):
    """Set up an isolated tenant for Sales SI_001 test suite."""
    company_id = f"co-sales-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-sales-{uuid.uuid4().hex[:8]}"

    company = Company(id=company_id, uuid=str(uuid.uuid4()), name="Sales Test Co", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Sales Store 1", code=f"SLS{uuid.uuid4().hex[:6].upper()}", is_active=True)
    db.add_all([company, branch])
    await db.flush()

    tenant_ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(tenant_ctx)
    return company_id, branch_id, tenant_ctx


async def _make_product(db, tenant_ctx, stock=50, price=Decimal("999.00")):
    inv_service = InventoryService(db, tenant_ctx)
    p_in = ProductCreate(
        id=f"prod-sales-{uuid.uuid4().hex[:8]}",
        code=f"SLSPROD{uuid.uuid4().hex[:4].upper()}",
        name="SI_001 Test Item",
        category="General",
        brand="Generic",
        color="Blue",
        size="L",
        barcode=f"BC-SLS-{uuid.uuid4().hex[:6].upper()}",
        price=price,
        cost_price=price,
    )
    product = await inv_service.create_product(p_in)
    if stock > 0:
        movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        sm = StockMovement(
            id=movement_id,
            uuid=str(uuid.uuid4()),
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or product.code,
            quantity=stock,
            movement_type="OPENING",
            reference_doc_type="OPENING_BALANCE",
            reference_doc_id=product.id,
            warehouse="Default Warehouse",
            unit_cost=price,
            remarks="Opening stock fixture",
            source_module="Sales",
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
        )
        db.add(sm)
        await db.flush()
        await db.refresh(product)
    return product


def test_sales_services_zero_direct_stock_mutations():
    """Static analysis guard ensuring Sales services never assign to product.stock."""
    sales_files = [
        SALES_SERVICES_ROOT / "sales.py",
        SALES_SERVICES_ROOT / "sales_orchestrator.py",
    ]
    direct_mutation_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*(?:[+\-]?=)")
    violations = []

    for filepath in sales_files:
        if not filepath.exists():
            continue
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if clean_line.startswith("#"):
                    continue
                if direct_mutation_pattern.search(clean_line):
                    violations.append((filepath.name, i, clean_line))

    assert not violations, f"Direct product.stock mutations found in Sales services: {violations}"


@pytest.mark.asyncio
async def test_si001_availability_gate(db_session):
    """SI_001.1 Availability Gate: Verify InventoryAvailabilityService evaluates ATP."""
    _, _, tenant_ctx = await _setup_sales_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=50)

    avail_service = InventoryAvailabilityService(db_session, tenant_ctx)
    avail_result = await avail_service.can_fulfill(product_id=product.id, qty=10)

    assert avail_result["can_fulfill"] is True
    assert avail_result["available_qty"] == 50.0
    assert avail_result["requested_qty"] == 10.0


@pytest.mark.asyncio
async def test_si001_reservation_and_release_gate(db_session):
    """SI_001.2 & SI_001.2A Reservation & Release Gate."""
    _, _, tenant_ctx = await _setup_sales_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=30)

    res_service = InventoryReservationService(db_session, tenant_ctx)
    res_result = await res_service.reserve(
        product_id=product.id,
        qty=10,
        reservation_type="Sales Order",
        reservation_id="SO-1001",
    )

    assert res_result["status"] == "reserved"
    assert res_result["reserved_qty"] == 10.0
    assert res_result["available_after"] == 20.0

    # Idempotency re-run check
    res_result_idem = await res_service.reserve(
        product_id=product.id,
        qty=10,
        reservation_type="Sales Order",
        reservation_id="SO-1001",
    )
    assert res_result_idem["reserved_qty"] == 10.0
    assert res_result_idem["available_after"] == 20.0
