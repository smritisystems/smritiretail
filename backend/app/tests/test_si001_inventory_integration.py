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
test_si001_inventory_integration.py
SI_001 Sales Integration Architectural & Functional Verification Suite

Validates that:
1. Sales consumes InventoryAvailabilityService for can_fulfill queries.
2. Sales consumes InventoryReservationService for reserve / release operations.
3. SalesInvoice issue creates StockMovement(SALE) via InventoryCommandFacade.issue_sale() and relies on trigger reconciliation.
4. SalesReturn creates StockMovement(SALE_RETURN) via InventoryCommandFacade.return_sale() and relies on trigger reconciliation.
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
from app.services.inventory.facades import InventoryCommandFacade, InventoryQueryFacade
from app.models.inventory import Product, StockMovement


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
        code=f"SLSPROD{uuid.uuid4().hex[:8].upper()}",
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
        await db.commit()
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


def test_rule7_consumer_dependency_boundary_guard():
    """Rule #7 CI Guard: Consumer services MUST NOT import StockMovement or calculate available stock manually."""
    consumer_files = [
        SALES_SERVICES_ROOT / "sales.py",
        SALES_SERVICES_ROOT / "sales_orchestrator.py",
    ]
    import_pattern = re.compile(r"import\s+StockMovement\b|from\s+[\w\.]+\s+import\s+[\w\s,]*StockMovement\b")
    instantiation_pattern = re.compile(r"\bStockMovement\(")
    manual_atp_pattern = re.compile(r"\b(?:product|prod|p)\.stock\s*-\s*(?:product|prod|p)\.reserved_stock\b")

    violations = []

    for filepath in consumer_files:
        if not filepath.exists():
            continue
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if clean_line.startswith("#"):
                    continue
                if import_pattern.search(clean_line) or instantiation_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Forbidden StockMovement reference: {clean_line}"))
                if manual_atp_pattern.search(clean_line):
                    violations.append((filepath.name, i, f"Forbidden manual ATP calculation: {clean_line}"))

    assert not violations, f"Rule #7 Consumer Dependency Boundary violations found: {violations}"


def test_rule8_consumer_instantiation_boundary_guard():
    """
    Rule #8 CI Guard: Consumer modules MUST NOT instantiate kernel-internal types.

    Consumer modules MAY use:
        InventoryCommandFacade, InventoryQueryFacade,
        InventoryReservationService, InventoryAvailabilityService

    Consumer modules MUST NOT instantiate:
        StockMovement(...)       — kernel-internal ledger entry
        MovementBehavior(...)    — kernel-internal taxonomy definition
        MovementTypeRegistry(...)— kernel-internal registry
        InventoryStateService(...) / InventoryStateEngine(...)  — kernel-internal engine

    This enforces dependency DIRECTION, not just import presence.
    A consumer that imports-but-does-not-instantiate the facade is still
    allowed (e.g., type annotations).  A consumer that instantiates a
    kernel-internal type has broken the architectural boundary regardless of
    whether it also imports the facade.
    """
    consumer_files = [
        SALES_SERVICES_ROOT / "sales.py",
        SALES_SERVICES_ROOT / "sales_orchestrator.py",
    ]

    # Patterns: match direct constructor calls (ClassName( at token boundary).
    # Does not flag string literals, type annotations, or isinstance() checks.
    forbidden_instantiation_patterns = [
        (re.compile(r"(?<!\w)StockMovement\s*\("),       "StockMovement(...)"),
        (re.compile(r"(?<!\w)MovementBehavior\s*\("),     "MovementBehavior(...)"),
        (re.compile(r"(?<!\w)MovementTypeRegistry\s*\("), "MovementTypeRegistry(...)"),
        (re.compile(r"(?<!\w)InventoryStateService\s*\("),"InventoryStateService(...)"),
        (re.compile(r"(?<!\w)InventoryStateEngine\s*\("), "InventoryStateEngine(...)"),
    ]

    violations = []

    for filepath in consumer_files:
        if not filepath.exists():
            continue
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for i, line in enumerate(f, 1):
                clean_line = line.strip()
                if clean_line.startswith("#"):
                    continue
                for pattern, label in forbidden_instantiation_patterns:
                    if pattern.search(clean_line):
                        violations.append((filepath.name, i, f"Forbidden instantiation [{label}]: {clean_line}"))

    assert not violations, f"Rule #8 Consumer Instantiation Boundary violations found: {violations}"


@pytest.mark.asyncio
async def test_si001_dispatch_gate_facade_usage(db_session):
    """SI_001.5 Dispatch Gate: Verify Dispatch/Sales consume InventoryQueryFacade for stock state."""
    _, _, tenant_ctx = await _setup_sales_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=100)

    query_facade = InventoryQueryFacade(db_session, tenant_ctx)
    can_dispatch_result = await query_facade.can_fulfill(product.id, qty=25)
    state = await query_facade.get_canonical_state(product.id)

    assert can_dispatch_result["can_fulfill"] is True
    assert state["on_hand"] == 100.0
    assert state["available"] == 100.0


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


@pytest.mark.asyncio
async def test_si001_invoice_issue_gate(db_session):
    """SI_001.3 Invoice Issue Gate: Issue SALE via InventoryCommandFacade."""
    _, _, tenant_ctx = await _setup_sales_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=100)

    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    invoice_id = f"inv-{uuid.uuid4().hex[:8]}"
    invoice_no = f"INV-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 15}]

    movements = await command_facade.issue_sale(
        invoice_id=invoice_id,
        invoice_no=invoice_no,
        items=items,
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "SALE"
    assert abs(movements[0].quantity) == Decimal("15")

    # Verify trigger reconciled product.stock automatically
    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 85.0
    assert float(state["available"]) == 85.0


@pytest.mark.asyncio
async def test_si001_sales_return_gate(db_session):
    """SI_001.4 Sales Return Gate: Issue SALE_RETURN via InventoryCommandFacade."""
    _, _, tenant_ctx = await _setup_sales_tenant(db_session)
    product = await _make_product(db_session, tenant_ctx, stock=85)

    command_facade = InventoryCommandFacade(db_session, tenant_ctx)
    query_facade = InventoryQueryFacade(db_session, tenant_ctx)

    return_id = f"ret-{uuid.uuid4().hex[:8]}"
    return_no = f"RET-{uuid.uuid4().hex[:6].upper()}"
    items = [{"product_id": product.id, "quantity": 5}]

    movements = await command_facade.return_sale(
        return_id=return_id,
        return_no=return_no,
        items=items,
    )
    await db_session.commit()
    await db_session.refresh(product)

    assert len(movements) == 1
    assert movements[0].movement_type == "SALE_RETURN"
    assert movements[0].quantity == Decimal("5")

    state = await query_facade.get_canonical_state(product.id)
    assert float(state["on_hand"]) == 90.0
    assert float(state["available"]) == 90.0
