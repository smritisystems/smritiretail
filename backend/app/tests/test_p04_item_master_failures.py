"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.2
Created      : 2026-10-11
Modified     : 2026-10-11
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0.4 Additional Item Master and Service Failure Test Suite
               (Extends test_p03_missing_items_and_integrity.py)

Coverage matrix:
  T1  - Unregistered/UNASSIGNED barcode (status=UNASSIGNED, item_id=NULL)
  T2  - RETIRED barcode mapping (barcode row status=RETIRED — deactivated link)
  T3  - Item with no ProductBatchStock (no stock rows = unfulfillable)
  T4  - Unknown variant SKU (item exists, but specific size/colour SKU does not)
  T5  - Cross-tenant product accessed via direct product_id
  T6  - Inactive product (is_active=False)
  T7  - ProductResolutionService raises an unexpected exception (simulated service failure)
  T8  - Consolidated batch atomicity: all 5 error modes produce zero DB mutations
"""

import uuid
import pytest
from decimal import Decimal
from unittest.mock import patch, AsyncMock
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from app.core.config import settings
from app.models.tenant import Company, Branch
from app.models.auth import User
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.models.sales import SalesInvoice
from app.models.accounting import GeneralLedgerEntry
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.schemas.payments import PaymentTenderItem
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter


@pytest.fixture(scope="function")
def session_factory():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory


async def _bootstrap_item_master_fixtures(session):
    """
    Creates an isolated, fully-wired tenant with known-good and known-bad items
    covering each item master failure scenario.
    """
    s = uuid.uuid4().hex[:8]
    company_id = f"CMP-IM-{s}"
    branch_id = f"BR-IM-{s}"
    warehouse_id = f"WH-IM-{s}"
    user_id = f"USR-IM-{s}"

    comp = Company(
        id=company_id, name=f"IM Test Corp {s}",
        gst_number="27ABCDE1234F1Z5", is_active=True,
    )
    session.add(comp)
    branch = Branch(
        id=branch_id, company_id=company_id,
        name=f"IM Branch {s}", code=f"BRIM_{s}".upper()[:16], is_active=True,
    )
    session.add(branch)
    await session.flush()

    wh = Warehouse(
        id=warehouse_id, company_id=company_id, branch_id=branch_id,
        name=f"IM WH {s}", code=f"WHIM_{s}".upper()[:16],
        address="1 Test Road", city="Mumbai", state="Maharashtra", pincode="400001",
        is_active=True,
    )
    session.add(wh)

    cashier = User(
        id=user_id, company_id=company_id, branch_id=branch_id,
        username=f"cashier_im_{s}", email=f"cashier_im_{s}@smritibooks.com",
        hashed_password="mock_hash_im", is_active=True,
    )
    session.add(cashier)
    await session.flush()

    # ── Good product: fully wired item master ──────────────────────────────
    good_prod = Product(
        id=f"PRD-IM-GOOD-{s}", company_id=company_id, branch_id=branch_id,
        code=f"GOOD-SKU-{s}", barcode=f"8901200{s}", category="Footwear",
        name=f"Good Product {s}", price=Decimal("1500.00"), mrp=Decimal("1800.00"),
        gst_percentage=Decimal("12.00"), stock=Decimal("50.00"), is_active=True,
    )
    session.add(good_prod)
    await session.flush()

    good_item = Item(
        id=f"ITM-IM-GOOD-{s}", company_id=company_id, branch_id=branch_id,
        item_code=f"GOOD-SKU-{s}", item_name=f"Good Product {s}",
        category="Footwear", primary_uom="PRS", uom="PRS", is_active=True,
    )
    session.add(good_item)
    await session.flush()

    good_var = ItemVariant(
        id=f"VAR-IM-GOOD-{s}", company_id=company_id, item_id=good_item.id,
        variant_sku=f"GOOD-SKU-{s}", variant_name=f"Good Product Size 42 {s}", is_active=True,
    )
    session.add(good_var)
    await session.flush()

    session.add(ItemBarcode(
        id=f"BC-IM-GOOD-{s}", company_id=company_id, item_id=good_item.id,
        variant_id=good_var.id, barcode=f"8901200{s}", is_primary=True,
        is_active=True, status="ASSIGNED",
    ))
    session.add(ProductBatchStock(
        id=f"pbs-im-good-{s}", uuid=f"pbs-im-good-{s}",
        company_id=company_id, branch_id=branch_id, warehouse_id=warehouse_id,
        product_id=good_prod.id, batch_no="DEFAULT",
        quantity=Decimal("50.00"), reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"), mrp=Decimal("1800.00"), sale_rate=Decimal("1500.00"),
    ))

    # ── T1: UNASSIGNED barcode (status=UNASSIGNED, item_id=NULL) ─────────
    # Satisfies check constraint: (status='UNASSIGNED' AND item_id IS NULL AND variant_id IS NULL)
    session.add(ItemBarcode(
        id=f"BC-IM-UNASSIGNED-{s}", company_id=company_id,
        item_id=None, variant_id=None,
        barcode=f"8902100{s}", is_primary=False, is_active=True,
        status="UNASSIGNED",  # Required by ck_item_barcodes_assignment_target
    ))

    # ── T2: RETIRED barcode mapping (link deactivated via status=RETIRED) ─
    retired_bc_prod = Product(
        id=f"PRD-IM-RETBC-{s}", company_id=company_id, branch_id=branch_id,
        code=f"RETBC-SKU-{s}",
        # Intentionally different barcode value from the retired ItemBarcode row (8903300{s}).
        # This prevents the legacy resolver from finding this product when scanner sends 8903300{s}.
        barcode=f"RETBC-INTERNAL-{s}",
        category="Footwear",
        name=f"Retired Barcode Product {s}", price=Decimal("800.00"), mrp=Decimal("900.00"),
        gst_percentage=Decimal("12.00"), stock=Decimal("10.00"), is_active=True,
    )
    session.add(retired_bc_prod)
    await session.flush()

    retired_bc_item = Item(
        id=f"ITM-IM-RETBC-{s}", company_id=company_id, branch_id=branch_id,
        item_code=f"RETBC-SKU-{s}", item_name=f"Retired BC Product {s}",
        category="Footwear", primary_uom="PRS", uom="PRS", is_active=True,
    )
    session.add(retired_bc_item)
    await session.flush()

    retired_bc_var = ItemVariant(
        id=f"VAR-IM-RETBC-{s}", company_id=company_id, item_id=retired_bc_item.id,
        variant_sku=f"RETBC-SKU-{s}", variant_name=f"Retired BC Variant {s}", is_active=True,
    )
    session.add(retired_bc_var)
    await session.flush()

    session.add(ItemBarcode(
        id=f"BC-IM-RETBC-{s}", company_id=company_id,
        item_id=retired_bc_item.id, variant_id=retired_bc_var.id,
        barcode=f"8903300{s}", is_primary=True,
        is_active=False, is_deleted=True,    # deleted → invisible to canonical query (is_deleted=false filter)
        status="RETIRED",
    ))

    # ── T3: Item with no ProductBatchStock ────────────────────────────────
    no_stock_prod = Product(
        id=f"PRD-IM-NOSTOCK-{s}", company_id=company_id, branch_id=branch_id,
        code=f"NOSTOCK-SKU-{s}", barcode=f"8904400{s}", category="Accessories",
        name=f"No Stock Product {s}", price=Decimal("300.00"), mrp=Decimal("350.00"),
        gst_percentage=Decimal("5.00"), stock=Decimal("0.00"), is_active=True,
    )
    session.add(no_stock_prod)
    await session.flush()

    no_stock_item = Item(
        id=f"ITM-IM-NOSTOCK-{s}", company_id=company_id, branch_id=branch_id,
        item_code=f"NOSTOCK-SKU-{s}", item_name=f"No Stock Product {s}",
        category="Accessories", primary_uom="PCS", uom="PCS", is_active=True,
    )
    session.add(no_stock_item)
    await session.flush()

    no_stock_var = ItemVariant(
        id=f"VAR-IM-NOSTOCK-{s}", company_id=company_id, item_id=no_stock_item.id,
        variant_sku=f"NOSTOCK-SKU-{s}", variant_name=f"No Stock Variant {s}", is_active=True,
    )
    session.add(no_stock_var)
    await session.flush()

    session.add(ItemBarcode(
        id=f"BC-IM-NOSTOCK-{s}", company_id=company_id,
        item_id=no_stock_item.id, variant_id=no_stock_var.id,
        barcode=f"8904400{s}", is_primary=True, is_active=True, status="ASSIGNED",
    ))
    # Intentionally NO ProductBatchStock for no_stock_prod

    # ── T5: Cross-tenant product (different company) ─────────────────────
    other_comp = Company(
        id=f"CMP-OTHER-{s}", name=f"Other Corp {s}",
        gst_number="29ABCDE1234F1Z5", is_active=True,
    )
    session.add(other_comp)
    await session.flush()

    other_branch = Branch(
        id=f"BR-OTHER-{s}", company_id=other_comp.id,
        name=f"Other Branch {s}", code=f"BROTH_{s}".upper()[:16], is_active=True,
    )
    session.add(other_branch)
    await session.flush()

    cross_prod = Product(
        id=f"PRD-IM-CROSS-{s}", company_id=other_comp.id, branch_id=other_branch.id,
        code=f"CROSS-SKU-{s}", barcode=f"8905500{s}", category="Footwear",
        name=f"Cross-Tenant Product {s}", price=Decimal("2000.00"), mrp=Decimal("2500.00"),
        gst_percentage=Decimal("18.00"), stock=Decimal("5.00"), is_active=True,
    )
    session.add(cross_prod)

    # ── T6: Inactive product ──────────────────────────────────────────────
    inactive_prod = Product(
        id=f"PRD-IM-INACT-{s}", company_id=company_id, branch_id=branch_id,
        code=f"INACT-SKU-{s}", barcode=f"8906600{s}", category="Footwear",
        name=f"Inactive Product {s}", price=Decimal("1200.00"), mrp=Decimal("1400.00"),
        gst_percentage=Decimal("12.00"), stock=Decimal("0.00"), is_active=False,
    )
    session.add(inactive_prod)

    await session.commit()

    return {
        "company_id": company_id, "branch_id": branch_id,
        "warehouse_id": warehouse_id, "user_id": user_id,
        "good_product": good_prod,
        "unassigned_barcode": f"8902100{s}",    # T1
        "retired_bc_barcode": f"8903300{s}",    # T2
        "no_stock_product": no_stock_prod,       # T3
        "cross_product": cross_prod,             # T5
        "inactive_product": inactive_prod,       # T6
        "s": s,
    }


def _make_req(fx, product_id=None, code=None, barcode=None, unit_price="1500.00", gst_rate="12.00"):
    return CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id=fx["company_id"], branch_id=fx["branch_id"],
            warehouse_id=fx["warehouse_id"], cashier_id=fx["user_id"],
            source_channel="POS_RETAIL",
            idempotency_key=f"idemp-im-{uuid.uuid4().hex[:8]}",
        ),
        items=[CanonicalPostingLineItem(
            product_id=product_id, code=code or barcode, barcode=barcode,
            quantity=Decimal("1.00"), unit_price=Decimal(unit_price), gst_rate=Decimal(gst_rate),
        )],
        tenders=[PaymentTenderItem(tender_type="CASH", amount=Decimal(unit_price))],
    )


async def _assert_zero_mutations(session, company_id: str, label: str = ""):
    inv_count = await session.scalar(select(func.count()).select_from(SalesInvoice).where(SalesInvoice.company_id == company_id))
    stk_count = await session.scalar(select(func.count()).select_from(StockMovement).where(StockMovement.company_id == company_id))
    gl_count = await session.scalar(select(func.count()).select_from(GeneralLedgerEntry).where(GeneralLedgerEntry.company_id == company_id))
    ctx = f" [{label}]" if label else ""
    assert inv_count == 0, f"Expected 0 invoices{ctx}, got {inv_count}"
    assert stk_count == 0, f"Expected 0 stock movements{ctx}, got {stk_count}"
    assert gl_count == 0, f"Expected 0 GL entries{ctx}, got {gl_count}"


# =============================================================================
# T1: UNASSIGNED barcode (status=UNASSIGNED, item_id=NULL)
# =============================================================================
@pytest.mark.asyncio
async def test_p04_unassigned_barcode_rejected_zero_mutations(session_factory):
    """
    T1: Barcode registered in item_barcodes with status=UNASSIGNED (not yet linked to any item).
    Scanner input produces no invoice, no stock movement, no GL entry.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, barcode=fx["unassigned_barcode"])
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code == 400
        await _assert_zero_mutations(session, fx["company_id"], "T1-unassigned-barcode")


# =============================================================================
# T2: RETIRED barcode mapping
# =============================================================================
@pytest.mark.asyncio
async def test_p04_retired_barcode_mapping_rejected_zero_mutations(session_factory):
    """
    T2: Barcode row marked status=RETIRED and is_deleted=True (deactivated link).
    The canonical query filters is_deleted=false so this barcode is invisible.
    Legacy resolver also does not find it. Produces zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, barcode=fx["retired_bc_barcode"], unit_price="800.00", gst_rate="12.00")
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code == 400
        await _assert_zero_mutations(session, fx["company_id"], "T2-retired-barcode")


# =============================================================================
# T3: Item with no batch stock (unfulfillable)
# =============================================================================
@pytest.mark.asyncio
async def test_p04_no_stock_item_rejected_zero_mutations(session_factory):
    """
    T3: Item exists in Item Master with a valid variant and barcode, but no ProductBatchStock row.
    Cannot be fulfilled — billing rejects with stock-shortage or zero-stock error.
    Produces zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, product_id=fx["no_stock_product"].id,
                        code=fx["no_stock_product"].code, unit_price="300.00", gst_rate="5.00")
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code in (400, 422)
        await _assert_zero_mutations(session, fx["company_id"], "T3-no-stock")


# =============================================================================
# T4: Unknown variant SKU (size/colour not registered)
# =============================================================================
@pytest.mark.asyncio
async def test_p04_unknown_variant_sku_rejected_zero_mutations(session_factory):
    """
    T4: Item exists in Item Master with valid variants, but the requested SKU
    (representing a specific size/colour combination) is not registered.
    Produces zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        unknown_variant_sku = f"GOOD-SIZE99-COLOUR-NONE-{fx['s']}"
        req = _make_req(fx, code=unknown_variant_sku)
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code == 400
        await _assert_zero_mutations(session, fx["company_id"], "T4-unknown-variant")


# =============================================================================
# T5: Cross-tenant product accessed by direct product_id
# =============================================================================
@pytest.mark.asyncio
async def test_p04_cross_tenant_item_rejected_zero_mutations(session_factory):
    """
    T5: product_id references a product belonging to a different company/tenant.
    Asserts HTTPException 400 or 403 and zero mutations in the requesting company.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, product_id=fx["cross_product"].id,
                        code=fx["cross_product"].code, unit_price="2000.00", gst_rate="18.00")
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code in (400, 403)
        await _assert_zero_mutations(session, fx["company_id"], "T5-cross-tenant")


# =============================================================================
# T6: Inactive product
# =============================================================================
@pytest.mark.asyncio
async def test_p04_inactive_product_rejected_zero_mutations(session_factory):
    """
    T6: product_id references a product where is_active=False.
    Asserts PRODUCT_INACTIVE rejection and zero mutations.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, product_id=fx["inactive_product"].id,
                        code=fx["inactive_product"].code, unit_price="1200.00", gst_rate="12.00")
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert exc_info.value.status_code == 400
        error_detail = str(exc_info.value.detail)
        assert (
            "PRODUCT_INACTIVE" in error_detail or
            "inactive" in error_detail.lower() or
            "PRODUCT_NOT_FOUND" in error_detail
        )
        await _assert_zero_mutations(session, fx["company_id"], "T6-inactive-product")


# =============================================================================
# T7: ProductResolutionService unexpected service / DB failure
# =============================================================================
@pytest.mark.asyncio
async def test_p04_item_lookup_service_failure_rejected_zero_mutations(session_factory):
    """
    T7: ProductResolutionService.validate_line() raises an unexpected RuntimeError
    (simulating a DB timeout or infrastructure fault). Asserts no partial DB state.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        req = _make_req(fx, product_id=fx["good_product"].id, code=fx["good_product"].code)
        with patch(
            "app.services.product_resolution_service.ProductResolutionService.validate_line",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Simulated DB connection timeout during item lookup"),
        ):
            with pytest.raises((HTTPException, RuntimeError, Exception)):
                await CanonicalSalesPostingWriter.post_sales_transaction(
                    session=session, req=req, commit=True
                )
        await _assert_zero_mutations(session, fx["company_id"], "T7-service-failure")


# =============================================================================
# T8: Batch atomicity — all error modes produce zero mutations in aggregate
# =============================================================================
@pytest.mark.asyncio
async def test_p04_item_master_failures_never_produce_partial_state(session_factory):
    """
    T8: Runs all 5 deterministic error scenarios in sequence against a single
    database session and asserts that the requesting tenant has zero invoices,
    zero stock movements, and zero GL entries after all failures.
    """
    async with session_factory() as session:
        fx = await _bootstrap_item_master_fixtures(session)
        company_id = fx["company_id"]

        scenarios = [
            ("unassigned_bc",   None,                          fx["unassigned_barcode"],    "1500.00", "18.00"),
            ("retired_bc",      None,                          fx["retired_bc_barcode"],    "800.00",  "12.00"),
            ("unknown_variant", None,                          f"GOODS-SIZE99-UNKNOWN-{fx['s']}", "1500.00", "12.00"),
            ("cross_tenant",    fx["cross_product"].id,        fx["cross_product"].code,    "2000.00", "18.00"),
            ("inactive_prod",   fx["inactive_product"].id,     fx["inactive_product"].code, "1200.00", "12.00"),
        ]

        for label, prod_id, code, price, gst in scenarios:
            req = CanonicalPostingRequest(
                context=CanonicalPostingContext(
                    company_id=company_id, branch_id=fx["branch_id"],
                    warehouse_id=fx["warehouse_id"], cashier_id=fx["user_id"],
                    source_channel="POS_RETAIL",
                    idempotency_key=f"idemp-batch-{label}-{uuid.uuid4().hex[:8]}",
                ),
                items=[CanonicalPostingLineItem(
                    product_id=prod_id, code=code,
                    barcode=code if not prod_id else None,
                    quantity=Decimal("1.00"), unit_price=Decimal(price), gst_rate=Decimal(gst),
                )],
                tenders=[PaymentTenderItem(tender_type="CASH", amount=Decimal(price))],
            )
            try:
                await CanonicalSalesPostingWriter.post_sales_transaction(
                    session=session, req=req, commit=True
                )
                assert False, f"Scenario '{label}' should have raised an exception but succeeded"
            except (HTTPException, Exception):
                pass

        await _assert_zero_mutations(session, company_id, "T8-batch-atomicity")
