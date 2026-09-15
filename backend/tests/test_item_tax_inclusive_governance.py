"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.28.1
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Item Master Tax Inclusive Parameter & Dual-Mode Billing Engine Test Suite

Test Coverage:
  1. Schema AST parity — verifies is_tax_inclusive is on NEW tables (item_barcodes,
     customer_groups, sales_invoice_items, customers) per migration v1456.
     Confirms it is ABSENT from products, items, item_variants (removed by v1456).
  2. ItemBarcode-level tax policy creation and retrieval.
  3. Item Master Service creates items without is_tax_inclusive on Item/ItemVariant.
  4. Canonical writer 3-tier tax resolution: line override → barcode → customer →
     price group → channel default.
  5. Tax-inclusive (MRP) vs tax-exclusive (base-rate) GST math correctness.
  6. Channel default: POS_RETAIL → inclusive, B2B_SALES → exclusive.
  7. Mixed-cart (inclusive + exclusive lines) combined tax totals.
  8. Statutory MRP ceiling enforcement (Legal Metrology Act compliance).
  9. POS end-to-end checkout with inclusive MRP and stock deduction.
"""

import sys
import os
import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Ensure required environment variables
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

from sqlalchemy import select, text
from fastapi import HTTPException

from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext
from app.models.inventory import Product
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.crm import Customer, CustomerGroup
from app.models.pricing import CustomerPriceTier
from app.models.pos import Shift, CashRegister
from app.models.auth import User
from app.schemas.inventory import ProductCreate
from app.schemas.item_master import ItemCreateRequest, ItemVariantItem
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.schemas.pos import POSCheckoutRequest, POSCheckoutItem
from app.services.inventory import InventoryService
from app.services.item_master_svc import UniversalItemMasterService
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.pos import POSService


@pytest.fixture(scope="module")
def tenant_ctx():
    return TenantContext(company_id="COMP-001", branch_id="BR-001")


@pytest.mark.asyncio
async def test_schema_column_parity_v1456_contract():
    """
    Rule 12: Column-by-column schema AST diff against canonical PostgreSQL contract.

    After migration v1456:
    - is_tax_inclusive MUST be present on: item_barcodes, customer_groups,
      sales_invoice_items, customers.
    - is_tax_inclusive MUST be ABSENT from: products, items, item_variants
      (these were dropped by v1456 to remove monolithic catalog-level tax policy).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Verify new tables have the column
        res_new = await session.execute(text("""
            SELECT table_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name IN ('item_barcodes', 'customer_groups',
                                 'sales_invoice_items', 'customers')
              AND column_name = 'is_tax_inclusive'
            ORDER BY table_name;
        """))
        new_rows = res_new.fetchall()
        new_tables = {row[0] for row in new_rows}
        type_map = {row[0]: row[1] for row in new_rows}

        for tbl in ["item_barcodes", "customer_groups", "sales_invoice_items", "customers"]:
            assert tbl in new_tables, (
                f"'{tbl}' is missing is_tax_inclusive after v1456 migration. "
                f"Run: alembic upgrade v1456_tax_inclusive_barcode_group_customer_snapshot"
            )
            assert type_map[tbl] == "boolean", (
                f"{tbl}.is_tax_inclusive must be boolean, got: {type_map[tbl]}"
            )

        # 2. Verify old catalog master tables NO LONGER have the column
        res_old = await session.execute(text("""
            SELECT table_name
            FROM information_schema.columns
            WHERE table_name IN ('products', 'items', 'item_variants')
              AND column_name = 'is_tax_inclusive';
        """))
        old_rows = res_old.fetchall()
        old_tables = {row[0] for row in old_rows}

        assert len(old_tables) == 0, (
            f"is_tax_inclusive still present on catalog master tables after v1456 drop: "
            f"{old_tables}. These columns must be removed."
        )


@pytest.mark.asyncio
async def test_barcode_level_tax_policy_creation():
    """
    Verify that is_tax_inclusive can be set on ItemBarcode (the actual sellable SKU).
    Tests all three states: True (inclusive), False (exclusive), None (defer to hierarchy).
    Uses the UniversalItemMasterService to create the parent Item correctly (avoids
    raw ORM NOT NULL constraint issues from undeclared DB-level constraints).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:8].upper()

        # Create parent item via service to satisfy all DB constraints
        req = ItemCreateRequest(
            item_code=f"ITEM-BC-{uid}",
            item_name=f"Barcode Tax Test Item {uid}",
            category="Footwear",
            tax_rate=18.00,
            mrp=1180.00,
            selling_price=1180.00,
            cost_price=600.00,
            variants=[
                ItemVariantItem(
                    variant_sku=f"ITEM-BC-{uid}-STD",
                    variant_name=f"Barcode Tax Test Item {uid} Std",
                    mrp=1180.00,
                    selling_price=1180.00,
                    cost_price=600.00,
                )
            ]
        )
        item = await UniversalItemMasterService.create_item(session, req=req, commit=True)
        assert item is not None

        # Now add barcodes with explicit tax policies directly
        bc_inc = ItemBarcode(
            id=f"BC-INC-{uid}",
            item_id=item.id,
            barcode=f"BAR-INC-{uid}",
            company_id="COMP-001",
            branch_id="BR-001",
            is_tax_inclusive=True,
            is_deleted=False,
        )
        bc_exc = ItemBarcode(
            id=f"BC-EXC-{uid}",
            item_id=item.id,
            barcode=f"BAR-EXC-{uid}",
            company_id="COMP-001",
            branch_id="BR-001",
            is_tax_inclusive=False,
            is_deleted=False,
        )
        bc_none = ItemBarcode(
            id=f"BC-NONE-{uid}",
            item_id=item.id,
            barcode=f"BAR-NONE-{uid}",
            company_id="COMP-001",
            branch_id="BR-001",
            is_tax_inclusive=None,
            is_deleted=False,
        )
        session.add_all([bc_inc, bc_exc, bc_none])
        await session.commit()

        assert await session.scalar(
            select(ItemBarcode.is_tax_inclusive).where(ItemBarcode.id == bc_inc.id)
        ) is True, "Barcode with is_tax_inclusive=True must persist as True"

        assert await session.scalar(
            select(ItemBarcode.is_tax_inclusive).where(ItemBarcode.id == bc_exc.id)
        ) is False, "Barcode with is_tax_inclusive=False must persist as False"

        assert await session.scalar(
            select(ItemBarcode.is_tax_inclusive).where(ItemBarcode.id == bc_none.id)
        ) is None, "Barcode with is_tax_inclusive=None must persist as NULL"


@pytest.mark.asyncio
async def test_item_master_svc_create_item_no_tax_inclusive_on_item_variant():
    """
    Verify UniversalItemMasterService.create_item works correctly and that
    Item / ItemVariant models do NOT carry is_tax_inclusive (removed by v1456).
    Tax policy now lives on ItemBarcode, Customer, CustomerGroup, CustomerPriceTier.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6].upper()
        req = ItemCreateRequest(
            item_code=f"ITM-SVC-{uid}",
            item_name=f"Universal Item Tax Test {uid}",
            category="Footwear",
            tax_rate=12.00,
            mrp=1120.00,
            selling_price=1120.00,
            cost_price=500.00,
            variants=[
                ItemVariantItem(
                    variant_sku=f"ITM-SVC-{uid}-L",
                    variant_name=f"Universal Item {uid} Large",
                    mrp=1120.00,
                    selling_price=1120.00,
                    cost_price=500.00,
                )
            ]
        )
        item = await UniversalItemMasterService.create_item(session, req=req, commit=True)
        assert item is not None, "Item creation must succeed"
        assert len(item.variants) >= 1, "Item must have at least one variant"
        # Item and ItemVariant must NOT carry is_tax_inclusive (dropped by v1456)
        assert not hasattr(item, "is_tax_inclusive"), (
            "Item model must NOT have is_tax_inclusive attribute (removed by v1456 migration)"
        )
        assert not hasattr(item.variants[0], "is_tax_inclusive"), (
            "ItemVariant model must NOT have is_tax_inclusive attribute (removed by v1456 migration)"
        )


@pytest.mark.asyncio
async def test_canonical_sales_posting_tax_inclusive_mrp():
    """
    Test statutory retail MRP tax inclusive calculation:
    Unit Price: ₹1,180.00 (inclusive of 18% GST)
    Quantity: 1
    Taxable Value: ₹1,000.00
    CGST (9%): ₹90.00
    SGST (9%): ₹90.00
    Total Tax: ₹180.00
    Grand Total: ₹1,180.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-INC-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="Walk-in Retail Buyer",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            place_of_supply_code="27",
            items=[
                CanonicalPostingLineItem(
                    code=f"SKU-LINE-INC-{uid}",
                    name="Retail MRP Inclusive Shoe",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                    is_fee_line=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("1180.00"),
                )
            ],
        )

        resp = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert resp.invoice_no == inv_no
        assert resp.net_amount == Decimal("1180.00")
        assert resp.taxable_amount == Decimal("1000.00")
        assert resp.tax_total == Decimal("180.00")
        assert resp.success is True


@pytest.mark.asyncio
async def test_canonical_sales_posting_tax_exclusive_wholesale():
    """
    Test B2B wholesale base rate tax exclusive calculation:
    Unit Price: ₹1,000.00 (exclusive of 18% GST)
    Quantity: 1
    Taxable Value: ₹1,000.00
    CGST (9%): ₹90.00
    SGST (9%): ₹90.00
    Total Tax: ₹180.00
    Grand Total: ₹1,180.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-EXC-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="B2B_SALES",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="B2B Wholesale Trader",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            place_of_supply_code="27",
            items=[
                CanonicalPostingLineItem(
                    code=f"SKU-LINE-EXC-{uid}",
                    name="Wholesale Base Rate Line",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1000.00"),
                    mrp=Decimal("1500.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    is_fee_line=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("1180.00"),
                )
            ],
        )

        resp = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert resp.invoice_no == inv_no
        assert resp.taxable_amount == Decimal("1000.00")
        assert resp.tax_total == Decimal("180.00")
        assert resp.net_amount == Decimal("1180.00")


@pytest.mark.asyncio
async def test_canonical_sales_posting_mixed_cart():
    """
    Test mixed cart with:
    Line 1: Retail item ₹1,180.00 MRP inclusive (18% GST -> Taxable ₹1000, Tax ₹180)
    Line 2: Service fee ₹500.00 base exclusive (18% GST -> Taxable ₹500, Tax ₹90)
    Combined Taxable: ₹1,500.00
    Combined Tax: ₹270.00
    Combined Grand Total: ₹1,770.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-MIXED-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="Walk-in Mixed Cart Buyer",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            place_of_supply_code="27",
            items=[
                CanonicalPostingLineItem(
                    code=f"SKU-INC-L1-{uid}",
                    name="Inclusive MRP Product",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                    is_fee_line=True,
                ),
                CanonicalPostingLineItem(
                    code=f"SKU-EXC-L2-{uid}",
                    name="Exclusive Alteration Fee",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("500.00"),
                    mrp=Decimal("500.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    is_fee_line=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("1770.00"),
                )
            ],
        )

        resp = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert resp.net_amount == Decimal("1770.00")
        assert resp.taxable_amount == Decimal("1500.00")
        assert resp.tax_total == Decimal("270.00")


# ---------------------------------------------------------------------------
# TEST: Channel Default — POS_RETAIL must default to inclusive
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_channel_default_pos_retail_is_tax_inclusive():
    """
    When is_tax_inclusive is None on the line item and no barcode/customer policy
    exists, POS_RETAIL channel must default to is_tax_inclusive=True.

    ₹1,180.00 on POS_RETAIL without explicit flag → taxable = ₹1,000.00 (inclusive math).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-CHDEF-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="Default Channel Buyer",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            place_of_supply_code="27",
            items=[
                CanonicalPostingLineItem(
                    code=f"FEE-CHDEF-{uid}",
                    name="Default Channel Item",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=None,  # NOT set — derive from channel
                    is_fee_line=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1180.00"))
            ],
        )

        resp = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert resp.taxable_amount == Decimal("1000.00"), (
            f"POS_RETAIL channel default must be inclusive; expected taxable=1000, got {resp.taxable_amount}"
        )
        assert resp.tax_total == Decimal("180.00"), (
            f"POS_RETAIL channel default must yield tax=180; got {resp.tax_total}"
        )


@pytest.mark.asyncio
async def test_channel_default_b2b_is_tax_exclusive():
    """
    When is_tax_inclusive is None on the line item and no barcode/customer policy
    exists, B2B_SALES channel must default to is_tax_inclusive=False.

    ₹1,000.00 on B2B_SALES without explicit flag → taxable=₹1,000.00 (exclusive math),
    tax=₹180.00, grand total=₹1,180.00.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-B2BDEF-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="B2B_SALES",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="Default B2B Trader",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            place_of_supply_code="27",
            items=[
                CanonicalPostingLineItem(
                    code=f"FEE-B2BDEF-{uid}",
                    name="Default B2B Item",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1000.00"),
                    mrp=Decimal("1500.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=None,  # NOT set — derive from channel
                    is_fee_line=True,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1180.00"))
            ],
        )

        resp = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert resp.taxable_amount == Decimal("1000.00"), (
            f"B2B_SALES default must be exclusive; expected taxable=1000, got {resp.taxable_amount}"
        )
        assert resp.tax_total == Decimal("180.00"), (
            f"B2B_SALES default must yield tax=180; got {resp.tax_total}"
        )
        assert resp.net_amount == Decimal("1180.00"), (
            f"B2B_SALES grand total must be 1180; got {resp.net_amount}"
        )


@pytest.mark.asyncio
async def test_statutory_mrp_ceiling_enforcement():
    """
    Verify Legal Metrology Act statutory mandate:
    Attempting to post a selling price exceeding the statutory MRP must be rejected with 400.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6]
        inv_no = f"INV-OVERMRP-{uid}"

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
                client_invoice_no=inv_no,
                idempotency_key=inv_no,
                allow_negative_stock=True,
            ),
            customer_name="Consumer Protection Test",
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            items=[
                CanonicalPostingLineItem(
                    code=f"SKU-OVERMRP-{uid}",
                    name="Illegal Price Gouging Item",
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("1250.00"),
                    mrp=Decimal("1000.00"),  # Statutory ceiling
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                    is_fee_line=True,
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("1250.00"))],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)

        assert exc_info.value.status_code == 400
        assert "cannot exceed statutory MRP" in exc_info.value.detail


@pytest.mark.asyncio
async def test_pos_checkout_with_tax_inclusive_catalog_item(tenant_ctx):
    """
    End-to-end POS checkout test:
    1. Open shift.
    2. Add product with is_tax_inclusive = True and 18% GST (MRP ₹1180).
    3. Execute pos_checkout with price = ₹1180 and is_tax_inclusive = True.
    4. Verify grand_total is exactly ₹1180.00, stock is deducted, and invoice is committed.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6].upper()

        # Create product with stock (no is_tax_inclusive on Product — it was dropped by v1456)
        inv_svc = InventoryService(session, tenant_ctx)
        prod = await inv_svc.create_product(ProductCreate(
            code=f"POS-PROD-{uid}",
            name=f"POS Retail Shoe {uid}",
            price=Decimal("1180.00"),
            mrp=Decimal("1180.00"),
            stock=10,
            buying_price=Decimal("600.00"),
            cost_price=Decimal("600.00"),
            category="Footwear",
            barcode=f"POS-BAR-{uid}",
            gst_percentage=Decimal("18.00"),
            hsn_code="6403",
            style_code=None,
            attributes={"style_no": "CH-08-J", "article_no": f"POS-ART-{uid}"},
        ))
        await session.commit()

        # Create CashRegister and Open shift
        reg = CashRegister(
            id=f"reg-{uid}",
            name=f"POS Counter {uid}",
            code=f"REG-{uid}",
            is_active=True,
            is_deleted=False,
            company_id="COMP-001",
            branch_id="BR-001",
        )
        session.add(reg)
        await session.commit()

        # Fetch valid cashier user
        user_res = await session.execute(
            select(User.id).where(User.company_id == "COMP-001", User.is_active == True).limit(1)
        )
        cashier_id = user_res.scalar_one_or_none()
        if not cashier_id:
            all_users = await session.execute(select(User.id).limit(1))
            cashier_id = all_users.scalar_one_or_none() or "usr_manager"

        shift = Shift(
            id=f"sh-{uid}",
            register_id=reg.id,
            cashier_id=cashier_id,
            status="OPEN",
            opened_at=datetime.now(timezone.utc),
            opening_balance=Decimal("1000.00"),
            cash_sales_total=Decimal("0"),
            card_sales_total=Decimal("0"),
            upi_sales_total=Decimal("0"),
            total_sales=Decimal("0"),
            total_invoices="0",
            is_active=True,
            is_deleted=False,
            company_id="COMP-001",
            branch_id="BR-001",
        )
        session.add(shift)
        await session.commit()

        pos_svc = POSService(session, tenant_ctx)
        checkout_req = POSCheckoutRequest(
            invoice_no=f"POS-INV-{uid}",
            shift_id=shift.id,
            payment_mode="CASH",
            grand_total=Decimal("1180.00"),
            billing_address="Mumbai, MH",
            shipping_address="Mumbai, MH",
            items=[
                POSCheckoutItem(
                    product_id=prod.id,
                    code=prod.code,
                    name=prod.name,
                    quantity=Decimal("1.00"),
                    price=Decimal("1180.00"),
                    mrp=Decimal("1180.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=True,
                )
            ]
        )

        result = await pos_svc.pos_checkout(checkout_req)
        assert result["invoice"] is not None
        assert Decimal(str(result["invoice"].grand_total)) == Decimal("1180.00")
        assert Decimal(str(result["invoice"].tax_total)) == Decimal("180.00")
        assert Decimal(str(result["invoice"].taxable_value)) == Decimal("1000.00")

        # Verify stock was deducted from 10 to 9
        await session.refresh(prod)
        assert prod.stock == 9
