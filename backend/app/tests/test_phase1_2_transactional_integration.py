"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.36.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from datetime import datetime, timezone, date
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.identity.engine import IdentityEngine
from app.services.identity.validator import IdentityValidator
from app.models.sales import SalesInvoice
from app.models.purchase import PurchaseOrder
from app.models.pos import Shift
from app.models.inventory import StockMovement
from app.models.identity_registry import SmritiIdentityAlias, SmritiIdentityAllocationLog
from app.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate, PurchaseOrderResponse
from app.schemas.pos import ShiftOpen, ShiftResponse
from app.schemas.inventory import StockMovementCreate
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceResponse


@pytest.fixture
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, pool_size=5, max_overflow=5)
    return async_sessionmaker(bind=engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_transactional_identity_codes_format_and_sequence(session_factory):
    """
    Verify that transactional document entities have validly formatted SMRITI Identity Codes:
    - SAL-INV-... for sales invoices
    - PUR-ORD-... for purchase orders
    - POS-SFT-... for POS shifts
    """
    async with session_factory() as session:
        # 1. Purchase Orders
        po_res = await session.execute(
            select(PurchaseOrder.id, PurchaseOrder.identity_code, PurchaseOrder.order_no).limit(10)
        )
        pos = po_res.fetchall()
        for poid, id_code, order_no in pos:
            if id_code is not None:
                assert id_code.startswith("PUR-ORD-"), f"Unexpected PO identity code {id_code}"
                assert IdentityValidator.validate_syntax(id_code) is True
                assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 2. Sales Invoices
        inv_res = await session.execute(
            select(SalesInvoice.id, SalesInvoice.identity_code, SalesInvoice.invoice_no).limit(10)
        )
        invoices = inv_res.fetchall()
        for inv_id, id_code, inv_no in invoices:
            if id_code is not None:
                assert id_code.startswith("SAL-INV-"), f"Unexpected invoice identity code {id_code}"
                assert IdentityValidator.validate_syntax(id_code) is True
                assert await IdentityValidator.validate_identity_code(session, id_code) is True

        # 3. Shifts
        shift_res = await session.execute(
            select(Shift.id, Shift.identity_code).limit(10)
        )
        shifts = shift_res.fetchall()
        for s_id, id_code in shifts:
            if id_code is not None:
                assert id_code.startswith("POS-SFT-"), f"Unexpected shift identity code {id_code}"
                assert IdentityValidator.validate_syntax(id_code) is True
                assert await IdentityValidator.validate_identity_code(session, id_code) is True


@pytest.mark.asyncio
async def test_ledger_boundary_stock_movements_uses_uuidv7_without_sequential_code(session_factory):
    """
    Verify high-throughput ledger boundary:
    - Stock movements have technical primary key 'id' (UUIDv7)
    - Stock movements do NOT have a human sequential 'identity_code' column (zero row-locking overhead)
    - IdentityEngine.generate_technical_id() generates RFC 9562 compliant UUIDv7
    """
    async with session_factory() as session:
        # Verify schema boundary
        res = await session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'stock_movements' AND column_name IN ('id', 'identity_code')"
            )
        )
        cols = [r[0] for r in res.fetchall()]
        assert "id" in cols, "stock_movements missing technical PK 'id'"
        assert "identity_code" not in cols, "stock_movements must NOT have sequential 'identity_code' column"

        # Verify UUIDv7 technical generator
        tech_id = IdentityEngine.generate_technical_id()
        assert IdentityValidator.validate_technical_id(tech_id) is True, f"Generated ID {tech_id} is not valid UUIDv7"


@pytest.mark.asyncio
async def test_tier_1_transactional_identity_resolution(session_factory):
    """
    Verify that transactional entities resolve deterministically via Tier 1 (Allocation Log / Identity Code).
    """
    async with session_factory() as session:
        # Sample one purchase order with identity_code
        po_res = await session.execute(
            select(PurchaseOrder.id, PurchaseOrder.identity_code)
            .where(PurchaseOrder.identity_code.is_not(None))
            .limit(1)
        )
        po = po_res.fetchone()
        if po:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=po.identity_code,
            )
            assert res.found is True, f"Failed to resolve purchase order by identity code {po.identity_code}"
            assert res.canonical_id == po.id
            assert res.entity_type == "PURCHASE_ORDER"
            assert res.resolution_tier in ["TIER_1_ALLOCATION_LOG", "TIER_1_IDENTITY_CODE"]


@pytest.mark.asyncio
async def test_tier_2_historical_document_alias_resolution(session_factory):
    """
    Verify that historical document identifiers (e.g. invoice_no, order_no)
    resolve through smriti_identity_alias to canonical transactional entities.
    """
    async with session_factory() as session:
        # Find a document alias ingested during Phase 1.2
        alias_res = await session.execute(
            select(SmritiIdentityAlias)
            .where(
                SmritiIdentityAlias.source_system == "TRANSACTIONAL",
                SmritiIdentityAlias.alias_type == "HISTORICAL_DOC",
            )
            .limit(1)
        )
        alias = alias_res.scalars().first()
        if alias:
            res = await IdentityEngine.resolve_identifier(
                session=session,
                identifier=alias.alias_code,
                company_id=alias.company_id,
            )
            assert res.found is True, f"Failed to resolve document alias {alias.alias_code}"
            assert res.canonical_id == alias.entity_id
            assert res.entity_type == alias.entity_type
            assert res.resolution_tier in ["TIER_2_ALIAS", "TIER_2_HISTORICAL_ALIAS"]


def test_reject_client_supplied_persistent_id():
    """
    Verify identity governance across PurchaseOrderCreate, ShiftOpen,
    StockMovementCreate, and SalesInvoiceCreate.

    Architecture decision (2026-09-18): PurchaseOrderCreate silently strips
    a client-supplied 'id' (via normalize_po_create model_validator mode=before)
    so that Purchase Studio workflows are not broken by strict rejection.
    ShiftOpen, StockMovementCreate, and SalesInvoiceCreate still REJECT with
    ValidationError as they have no frontend Studio compatibility constraint.
    """
    # 1. PurchaseOrderCreate strips (does NOT raise) client-supplied id.
    #    The id field is normalised to None by normalize_po_create before Pydantic sees it.
    po = PurchaseOrderCreate(
        id="client-supplied-po-id",
        order_no="PO-TEST-001",
        supplier_id="sup-1",
        items=[
            PurchaseOrderItemCreate(
                product_id="prod-1",
                code="ITM-01",
                name="Test Item",
                quantity=Decimal("5.0"),
                cost_price=Decimal("100.00"),
            )
        ],
    )
    # Governance invariant: server-generated id is always None at schema level
    assert po.id is None, (
        "PurchaseOrderCreate must strip client-supplied id to None; "
        "IdentityEngine allocates the real UUID on the server side."
    )

    # 2. ShiftOpen still rejects client id
    with pytest.raises(ValidationError) as exc_shift:
        ShiftOpen(
            id="client-supplied-shift-id",
            register_id="reg-1",
            opening_balance=Decimal("100.00"),
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_shift.value)

    # 3. StockMovementCreate still rejects client id
    with pytest.raises(ValidationError) as exc_sm:
        StockMovementCreate(
            id="client-supplied-movement-id",
            product_id="prod-1",
            product_name="Test Product",
            sku="SKU-01",
            quantity=Decimal("10.0"),
            movement_type="IN",
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_sm.value)

    # 4. SalesInvoiceCreate still rejects client id
    with pytest.raises(ValidationError) as exc_inv:
        SalesInvoiceCreate(
            id="client-supplied-invoice-id",
            customer_name="Test Customer",
            items=[
                {
                    "code": "ITM-01",
                    "name": "Item 1",
                    "quantity": Decimal("1.0"),
                    "price": Decimal("50.00"),
                    "total_amount": Decimal("50.00"),
                }
            ],
        )
    assert "Persistent technical ID cannot be supplied by client" in str(exc_inv.value)


@pytest.mark.asyncio
async def test_transactional_creation_lifecycle_allocates_governed_identity(session_factory):
    """
    Verify that transactional services allocate UUIDv7 and governed identity codes
    strictly through IdentityEngine.allocate_internal().
    """
    async with session_factory() as session:
        try:
            async with session.begin():
                # 1. Allocate for PURCHASE_ORDER
                tech_id_po, code_po = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="PURCHASE_ORDER",
                    purpose="PHASE_1_2_UNIT_TEST",
                    correlation_id="test_po_alloc_1",
                )
                assert IdentityValidator.validate_technical_id(tech_id_po) is True
                assert code_po.startswith("PUR-ORD-")
                assert IdentityValidator.validate_syntax(code_po) is True

                # 2. Allocate for POS_SHIFT
                tech_id_sft, code_sft = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="POS_SHIFT",
                    purpose="PHASE_1_2_UNIT_TEST",
                    correlation_id="test_sft_alloc_1",
                )
                assert IdentityValidator.validate_technical_id(tech_id_sft) is True
                assert code_sft.startswith("POS-SFT-")
                assert IdentityValidator.validate_syntax(code_sft) is True

                # 3. Allocate for SALES_INVOICE
                tech_id_inv, code_inv = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="SALES_INVOICE",
                    purpose="PHASE_1_2_UNIT_TEST",
                    correlation_id="test_inv_alloc_1",
                )
                assert IdentityValidator.validate_technical_id(tech_id_inv) is True
                assert code_inv.startswith("SAL-INV-")
                assert IdentityValidator.validate_syntax(code_inv) is True

                # 4. Verify allocation log audit entries
                alloc_res = await session.execute(
                    select(SmritiIdentityAllocationLog).where(
                        SmritiIdentityAllocationLog.canonical_id.in_([tech_id_po, tech_id_sft, tech_id_inv])
                    )
                )
                allocs = alloc_res.scalars().all()
                assert len(allocs) == 3
        finally:
            await session.rollback()
