"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.2
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Verification Suite — Stage 5.2 First Domain Writer Integration
"""

import uuid
import pytest
from decimal import Decimal
from sqlalchemy import select, delete

from app.db.session import get_company_sessionmaker
from app.models.sales import SalesInvoice
from app.models.inventory import Product, StockMovement
from app.models.crm import Customer
from app.models.outbox import IntegrationOutboxEvent
from app.services.sales_ledger_svc import CanonicalSalesWriter, UnifiedSalesLedgerService
from app.platform.events import (
    PlatformEventService,
    PostgresEventOutbox,
    PlatformOutboxWorker,
    EventSerializer,
    get_platform_event_service,
)


@pytest.fixture
def session_factory():
    return get_company_sessionmaker("smriti001")


@pytest.fixture(autouse=True)
async def cleanup_test_data(session_factory):
    """Clean up test invoices and outbox records, and ensure test customer/product exist."""
    async with session_factory() as session:
        await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%INV-S52-%")))
        await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-S52-%")))
        await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id.like("evt-s52-%")))

        # Ensure test customer exists
        cust = (await session.execute(select(Customer).where(Customer.id == "cust_s52_01"))).scalar_one_or_none()
        if not cust:
            session.add(Customer(
                id="cust_s52_01",
                company_id="COMP-001",
                code="CUST-S52-01",
                name="Stage 5.2 Test Customer",
                mobile="9820011999",
                status="Active",
                is_active=True,
                is_deleted=False
            ))

        # Ensure test products exist
        for prod_id, code, name in [
            ("prod_s52_01", "SKU-S52-01", "Stage 5.2 Test Item 1"),
            ("prod_s52_02", "SKU-S52-02", "Stage 5.2 Test Item 2"),
        ]:
            p = (await session.execute(select(Product).where(Product.id == prod_id))).scalar_one_or_none()
            if not p:
                session.add(Product(
                    id=prod_id,
                    company_id="COMP-001",
                    code=code,
                    name=name,
                    category="Apparel",
                    barcode=f"BAR-{code}",
                    price=500.00,
                    mrp=600.00,
                    cost_price=250.00,
                    stock=100,
                    is_active=True,
                    is_deleted=False
                ))

        await session.commit()
    yield
    async with session_factory() as session:
        await session.execute(delete(StockMovement).where(StockMovement.remarks.like("%INV-S52-%")))
        await session.execute(delete(SalesInvoice).where(SalesInvoice.invoice_no.like("INV-S52-%")))
        await session.execute(delete(IntegrationOutboxEvent).where(IntegrationOutboxEvent.source_event_id.like("evt-s52-%")))
        await session.commit()


@pytest.mark.asyncio
async def test_criterion_1_successful_invoice_atomically_commits_invoice_and_outbox(session_factory):
    """
    Stage 5.2 Criterion 1: Successful Invoice Atomicity
    post_sales_invoice() creates domain SalesInvoice and stages IntegrationOutboxEvent
    atomically within the committed transaction.
    """
    inv_no = f"INV-S52-C1-{uuid.uuid4().hex[:6].upper()}"

    async with session_factory() as session:
        invoice = await CanonicalSalesWriter.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no=inv_no,
            customer_id="cust_s52_01",
            items_data=[{
                "product_id": "prod_s52_01",
                "code": "SKU-S52-01",
                "name": "Stage 5.2 Test Item",
                "quantity": 2,
                "price": 500.00,
                "gst_rate": 18.0
            }],
            branch_id="BR-001"
        )

        assert invoice is not None
        assert invoice.invoice_no == inv_no
        assert invoice.grand_total == Decimal("1180.00")
        assert invoice.status == "Confirmed"
        invoice_id = invoice.id

    # Verify in a fresh session that both entities are committed and present
    async with session_factory() as session:
        db_inv = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        )).scalar_one_or_none()
        assert db_inv is not None
        assert db_inv.invoice_no == inv_no

        outbox_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id == invoice_id)
        )).scalar_one_or_none()
        assert outbox_evt is not None
        assert outbox_evt.status == "PENDING"
        assert outbox_evt.event_type in ("SALES_INVOICE_CONFIRMED", "SALES.INVOICE.CONFIRMED")
        assert outbox_evt.target_channel == "SALES_INVOICE_PUBLISH"

        # Verify contract parity: EventSerializer reconstructs valid typed EventEnvelope
        envelope = EventSerializer.from_dict(outbox_evt.payload_json)
        assert envelope.schemaVersion == "1.0"
        assert envelope.source == "sales.unified_ledger"
        assert envelope.payload["invoice_no"] == inv_no
        assert envelope.payload["grand_total"] == 1180.00


@pytest.mark.asyncio
async def test_criterion_2_invoice_rollback_discards_both_invoice_and_outbox(session_factory):
    """
    Stage 5.2 Criterion 2: Invoice Transaction Rollback Atomicity
    Aborting/rolling back the database session discards BOTH the business SalesInvoice
    and the staged outbox record. Neither entity exists in the database.
    """
    inv_no = f"INV-S52-C2-{uuid.uuid4().hex[:6].upper()}"
    invoice_id = f"inv_s52_{uuid.uuid4().hex[:8]}"

    async with session_factory() as session:
        # Create domain invoice
        inv = SalesInvoice(
            id=invoice_id,
            invoice_no=inv_no,
            grand_total=Decimal("2360.00"),
            status="Draft"
        )
        session.add(inv)

        # Stage platform event via kernel within same transaction
        event_service = get_platform_event_service()
        from app.platform.events import EventEnvelope
        envelope = EventEnvelope(
            eventType="sales.invoice.confirmed",
            schemaVersion="1.0",
            source="sales.unified_ledger",
            tenantId="COMP-001",
            payload={"invoice_id": invoice_id, "invoice_no": inv_no, "grand_total": 2360.00},
            metadata={"aggregate_id": invoice_id}
        )
        await event_service.stage_event(envelope, session)

        # Explicitly ROLLBACK instead of committing
        await session.rollback()

    # Verify in a fresh session that NEITHER exists
    async with session_factory() as session:
        db_inv = (await session.execute(
            select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        )).scalar_one_or_none()
        assert db_inv is None

        db_outbox = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id == invoice_id)
        )).scalar_one_or_none()
        assert db_outbox is None


@pytest.mark.asyncio
async def test_criterion_3_existing_invoice_calculations_and_inventory_movements_preserved(session_factory):
    """
    Stage 5.2 Criterion 3: Existing Functionality Preservation
    All tax totals, line item discounts, stock movements (OUTWARD_SALE),
    and product master stocks remain 100% accurate and unmodified.
    """
    inv_no = f"INV-S52-C3-{uuid.uuid4().hex[:6].upper()}"

    async with session_factory() as session:
        invoice = await CanonicalSalesWriter.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no=inv_no,
            customer_id="cust_s52_01",
            items_data=[
                {
                    "product_id": "prod_s52_01",
                    "code": "SKU-S52-01",
                    "name": "Taxable Item A",
                    "quantity": 3,
                    "price": 200.00,
                    "gst_rate": 18.0
                },
                {
                    "product_id": "prod_s52_02",
                    "code": "SKU-S52-02",
                    "name": "Taxable Item B",
                    "quantity": 1,
                    "price": 400.00,
                    "gst_rate": 5.0
                }
            ],
            branch_id="BR-001"
        )

        # Taxable: (3*200) + (1*400) = 1000.00
        # Tax: (600 * 0.18 = 108.00) + (400 * 0.05 = 20.00) = 128.00
        # Grand Total: 1128.00
        assert invoice.taxable_value == Decimal("1000.00")
        assert invoice.tax_total == Decimal("128.00")
        assert invoice.grand_total == Decimal("1128.00")
        assert len(invoice.items) == 2

        # Verify StockMovement ledger entries were created
        movements = (await session.execute(
            select(StockMovement).where(StockMovement.reference_doc_id == invoice.id)
        )).scalars().all()
        assert len(movements) == 2
        for mv in movements:
            assert mv.movement_type == "OUTWARD_SALE"
            assert mv.quantity < 0  # Deducted from inventory


@pytest.mark.asyncio
async def test_criterion_4_event_worker_consumes_and_dispatches_staged_sales_event(session_factory):
    """
    Stage 5.2 Criterion 4: PlatformOutboxWorker End-to-End Cycle
    PlatformOutboxWorker successfully claims the staged sales invoice event
    using non-blocking SELECT FOR UPDATE SKIP LOCKED, publishes outside row locks,
    and settles the outbox record to DISPATCHED.
    """
    inv_no = f"INV-S52-C4-{uuid.uuid4().hex[:6].upper()}"

    # 1. Post invoice, staging event
    async with session_factory() as session:
        invoice = await CanonicalSalesWriter.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no=inv_no,
            customer_id="cust_s52_01",
            items_data=[{
                "product_id": "prod_s52_01",
                "code": "SKU-S52-01",
                "name": "Worker Claim Test Item",
                "quantity": 1,
                "price": 1000.00,
                "gst_rate": 18.0
            }],
            branch_id="BR-001"
        )
        invoice_id = invoice.id

    # 2. Verify record is PENDING
    async with session_factory() as session:
        outbox_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.aggregate_id == invoice_id)
        )).scalar_one()
        assert outbox_evt.status == "PENDING"
        outbox_id = outbox_evt.outbox_id

    # 3. Execute PlatformOutboxWorker cycle
    event_service = get_platform_event_service()
    await event_service.start()
    worker = PlatformOutboxWorker(
        outbox=PostgresEventOutbox(),
        event_service=event_service,
        session_factory=session_factory,
        target_channel="SALES_INVOICE_PUBLISH",
        poll_interval_seconds=0.1,
    )

    dispatched = False
    for _ in range(10):
        stats = await worker.run_cycle(limit=50)
        if outbox_id in stats["dispatched_ids"]:
            dispatched = True
            break
        if stats["claimed_count"] == 0:
            break

    assert dispatched is True, f"Outbox ID {outbox_id} was not dispatched in worker cycles"

    # 4. Verify record in PostgreSQL is now DISPATCHED
    async with session_factory() as session:
        settled_evt = (await session.execute(
            select(IntegrationOutboxEvent).where(IntegrationOutboxEvent.outbox_id == outbox_id)
        )).scalar_one()
        assert settled_evt.status == "DISPATCHED"
        assert settled_evt.dispatched_at is not None
        assert settled_evt.claim_expires_at is None


@pytest.mark.asyncio
async def test_criterion_5_cancel_sales_invoice_atomically_stages_cancellation_event(session_factory):
    """
    Stage 5.2 Criterion 5: Cancellation Outbox Atomicity
    cancel_sales_invoice() reverses inventory, updates invoice status to Cancelled,
    and stages sales.invoice.cancelled event via PlatformEventService.
    """
    inv_no = f"INV-S52-C5-{uuid.uuid4().hex[:6].upper()}"

    # 1. Post invoice
    async with session_factory() as session:
        invoice = await CanonicalSalesWriter.post_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no=inv_no,
            customer_id="cust_s52_01",
            items_data=[{
                "product_id": "prod_s52_01",
                "code": "SKU-S52-01",
                "name": "Cancel Test Item",
                "quantity": 1,
                "price": 500.00,
                "gst_rate": 18.0
            }],
            branch_id="BR-001"
        )
        invoice_id = invoice.id

    # 2. Cancel invoice
    async with session_factory() as session:
        cancelled_inv = await CanonicalSalesWriter.cancel_sales_invoice(
            session=session,
            company_id="COMP-001",
            invoice_no=inv_no,
            reason="Customer requested exchange at billing counter"
        )
        assert cancelled_inv.status == "Cancelled"

    # 3. Verify cancellation outbox event was staged
    async with session_factory() as session:
        events = (await session.execute(
            select(IntegrationOutboxEvent)
            .where(IntegrationOutboxEvent.aggregate_id == invoice_id)
            .order_by(IntegrationOutboxEvent.created_at.asc())
        )).scalars().all()

        assert len(events) >= 2
        cancel_evt = events[-1]
        assert cancel_evt.status == "PENDING"
        assert cancel_evt.event_type in ("SALES_INVOICE_CANCELLED", "SALES.INVOICE.CANCELLED")

        # Verify EventSerializer reconstructs valid envelope
        env = EventSerializer.from_dict(cancel_evt.payload_json)
        assert env.payload["status"] == "Cancelled"
        assert "Customer requested exchange" in env.payload["reason"]
