"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from decimal import Decimal
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.pricing_payment import UnifiedPricingPaymentService
from app.models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from app.models.payment_ledger import PaymentTransaction, PaymentAllocation
from app.models.numbering import DocumentSeries, NumberingAuditLog
from app.models.item_master import Item


@pytest.fixture(autouse=True)
async def cleanup_pricing_payment_data():
    """Clean up test data across both databases before and after tests."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(PaymentAllocation).where(PaymentAllocation.invoice_id.like("TEST-INV-%")))
            await session.execute(delete(PaymentTransaction).where(PaymentTransaction.idempotency_key.like("IDEM-TEST-%")))
            await session.execute(delete(NumberingAuditLog).where(NumberingAuditLog.document_no.like("TEST-SEQ/%")))
            await session.execute(delete(DocumentSeries).where(DocumentSeries.document_type == "TEST_DOC"))
            await session.execute(delete(PriceBookEntry).where(PriceBookEntry.price_book_id.like("pb_test_%")))
            await session.execute(delete(PriceBook).where(PriceBook.code.like("PB-TEST-%")))
            await session.execute(delete(Item).where(Item.item_code.like("ITEM-PRICE-TEST-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(PaymentAllocation).where(PaymentAllocation.invoice_id.like("TEST-INV-%")))
            await session.execute(delete(PaymentTransaction).where(PaymentTransaction.idempotency_key.like("IDEM-TEST-%")))
            await session.execute(delete(NumberingAuditLog).where(NumberingAuditLog.document_no.like("TEST-SEQ/%")))
            await session.execute(delete(DocumentSeries).where(DocumentSeries.document_type == "TEST_DOC"))
            await session.execute(delete(PriceBookEntry).where(PriceBookEntry.price_book_id.like("pb_test_%")))
            await session.execute(delete(PriceBook).where(PriceBook.code.like("PB-TEST-%")))
            await session.execute(delete(Item).where(Item.item_code.like("ITEM-PRICE-TEST-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_pricing_hierarchy_price_book_and_volume_breaks():
    """Verify 4-level pricing resolution and volume breaks."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Create base Item
        item = Item(
            id="item_price_test_01",
            company_id="COMP-001",
            item_code="ITEM-PRICE-TEST-01",
            item_name="Premium Basmati Rice 5kg",
            category="Grocery",
            primary_uom="BAG",
            selling_price=Decimal("450.00"),
            mrp=Decimal("500.00"),
            cost_price=Decimal("350.00"),
            is_active=True,
            is_deleted=False
        )
        session.add(item)

        # 2. Create Wholesale Price Book
        pb = PriceBook(
            id="pb_test_wholesale_01",
            company_id="COMP-001",
            name="Wholesale Distributor Price Book",
            code="PB-TEST-WHOLESALE",
            currency="INR",
            is_default=False,
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        session.add(pb)

        # Entry 1: Standard bulk price (qty >= 1) -> Rs 420
        pbe1 = PriceBookEntry(
            id="pbe_test_01",
            company_id="COMP-001",
            price_book_id=pb.id,
            item_id=item.id,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("420.00"),
            mrp=Decimal("500.00"),
            cost_price=Decimal("350.00"),
            is_active=True,
            is_deleted=False
        )
        # Entry 2: Super bulk price (qty >= 20) -> Rs 390
        pbe2 = PriceBookEntry(
            id="pbe_test_02",
            company_id="COMP-001",
            price_book_id=pb.id,
            item_id=item.id,
            min_quantity=Decimal("20.0000"),
            selling_price=Decimal("390.00"),
            mrp=Decimal("500.00"),
            cost_price=Decimal("350.00"),
            is_active=True,
            is_deleted=False
        )
        session.add(pbe1)
        session.add(pbe2)
        await session.commit()

        # Test A: Fallback to Item Master (no price book)
        res_master = await UnifiedPricingPaymentService.resolve_pricing(
            session=session,
            item_id=item.id,
            quantity=1.0
        )
        assert float(res_master["selling_price"]) == 450.00
        assert res_master["pricing_source"] == "ITEM_MASTER"

        # Test B: Wholesale Price Book (qty = 5) -> 420.00
        res_pb_tier1 = await UnifiedPricingPaymentService.resolve_pricing(
            session=session,
            item_id=item.id,
            quantity=5.0,
            price_book_id=pb.id
        )
        assert float(res_pb_tier1["selling_price"]) == 420.00
        assert float(res_pb_tier1["volume_break_min_qty"]) == 1.0

        # Test C: Wholesale Price Book (qty = 25) -> 390.00 (Volume Break)
        res_pb_tier2 = await UnifiedPricingPaymentService.resolve_pricing(
            session=session,
            item_id=item.id,
            quantity=25.0,
            price_book_id=pb.id
        )
        assert float(res_pb_tier2["selling_price"]) == 390.00
        assert float(res_pb_tier2["volume_break_min_qty"]) == 20.0


@pytest.mark.asyncio
async def test_document_numbering_gapless_sequence_allocation():
    """Verify locked consecutive document sequence allocation and audit logs."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        doc1 = await UnifiedPricingPaymentService.allocate_document_number(
            session=session,
            company_id="COMP-001",
            document_type="TEST_DOC",
            financial_year="2026-27",
            prefix="TEST-SEQ"
        )
        doc2 = await UnifiedPricingPaymentService.allocate_document_number(
            session=session,
            company_id="COMP-001",
            document_type="TEST_DOC",
            financial_year="2026-27",
            prefix="TEST-SEQ"
        )

        assert doc1 == "TEST-SEQ/2026-27/0001"
        assert doc2 == "TEST-SEQ/2026-27/0002"

        # Verify audit log exists
        stmt = select(NumberingAuditLog).where(NumberingAuditLog.document_no == doc2)
        audit = (await session.execute(stmt)).scalar_one_or_none()
        assert audit is not None
        assert audit.action == "ALLOCATE"
        assert audit.new_value == "2"


@pytest.mark.asyncio
async def test_idempotent_multi_tender_payment_settlement():
    """Verify multi-tender payment recording and strict idempotency key deduping."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        tenders = [
            {"tender_type": "CASH", "amount": 500.00},
            {"tender_type": "UPI", "amount": 1500.00, "gateway_reference": "UPI-TXN-998877"}
        ]

        # First settlement attempt
        payments1 = await UnifiedPricingPaymentService.record_payment_settlement(
            session=session,
            company_id="COMP-001",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="TEST-INV-PAY-01",
            party_id="cust_001",
            tenders=tenders,
            idempotency_key="IDEM-TEST-KEY-001"
        )

        assert len(payments1) == 2
        assert float(payments1[0].amount) == 500.00
        assert payments1[0].tender_type == "CASH"
        assert float(payments1[1].amount) == 1500.00
        assert payments1[1].tender_type == "UPI"

        # Second settlement attempt with SAME idempotency key (network retry simulation)
        payments2 = await UnifiedPricingPaymentService.record_payment_settlement(
            session=session,
            company_id="COMP-001",
            reference_doc_type="SALES_INVOICE",
            reference_doc_id="TEST-INV-PAY-01",
            party_id="cust_001",
            tenders=tenders,
            idempotency_key="IDEM-TEST-KEY-001"
        )

        assert len(payments2) == 2
        # Must return the exact same transaction ID
        assert payments2[0].id == payments1[0].id
        assert payments2[1].id == payments1[1].id


@pytest.mark.asyncio
async def test_pricing_and_payment_tenant_isolation():
    """Verify price books and payment records do not leak across tenant databases."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        pb = PriceBook(
            id="pb_test_iso_01",
            company_id="COMP-001",
            name="Iso Price Book",
            code="PB-TEST-ISO-01",
            currency="INR",
            status="ACTIVE",
            is_active=True,
            is_deleted=False
        )
        s1.add(pb)
        await s1.commit()

    async with session_002() as s2:
        stmt = select(PriceBook).where(PriceBook.code == "PB-TEST-ISO-01")
        pb2 = (await s2.execute(stmt)).scalar_one_or_none()
        assert pb2 is None, "PriceBook from smriti001 must not leak into smriti002!"
