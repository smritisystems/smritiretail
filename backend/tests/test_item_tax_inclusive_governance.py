"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.28.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Item Master Tax Inclusive Parameter & Dual-Mode Billing Engine Test Suite
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
from app.models.tenant import Company, Branch
from app.models.inventory import Product
from app.models.item_master import Item, ItemVariant
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.crm import Customer
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
async def test_schema_column_parity_and_server_defaults():
    """
    Rule 12: Column-by-column schema AST diff against canonical PostgreSQL contract.
    Verify 'is_tax_inclusive' exists on products, items, and item_variants as BOOLEAN, NOT NULL, DEFAULT true.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        res = await session.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name IN ('products', 'items', 'item_variants') 
              AND column_name = 'is_tax_inclusive' 
            ORDER BY table_name;
        """))
        rows = res.fetchall()
        assert len(rows) == 3, f"Expected 3 tables with is_tax_inclusive, found {len(rows)}"
        
        table_meta = {row[0]: {"type": row[2], "nullable": row[3], "default": row[4]} for row in rows}
        for tbl in ["products", "items", "item_variants"]:
            assert tbl in table_meta, f"Table '{tbl}' missing is_tax_inclusive column"
            assert table_meta[tbl]["type"] == "boolean", f"{tbl}.is_tax_inclusive must be boolean"
            assert table_meta[tbl]["nullable"] == "NO", f"{tbl}.is_tax_inclusive must be NOT NULL"
            assert "true" in str(table_meta[tbl]["default"]).lower(), f"{tbl}.is_tax_inclusive default must be true"


@pytest.mark.asyncio
async def test_product_creation_defaults_to_tax_inclusive(tenant_ctx):
    """
    Verify creating a product with default settings assigns is_tax_inclusive = True,
    and synchronizes atomically to canonical Item and ItemVariant.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        inv_service = InventoryService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:6].upper()
        prod_in = ProductCreate(
            code=f"SKU-INC-{uid}",
            name=f"Tax Inclusive MRP Shoe {uid}",
            price=Decimal("1180.00"),
            mrp=Decimal("1180.00"),
            buying_price=Decimal("600.00"),
            cost_price=Decimal("600.00"),
            category="Footwear",
            barcode=f"BAR-INC-{uid}",
            gst_percentage=Decimal("18.00"),
            hsn_code="6403",
            style_code=None,
            attributes={"style_no": "CH-06-B", "article_no": f"ART-{uid}"},
            # is_tax_inclusive omitted, should default to True
        )
        prod = await inv_service.create_product(prod_in)
        await session.commit()

        # Check Product
        assert prod.is_tax_inclusive is True
        
        # Check canonical Item
        assert prod.item_id is not None
        canon_item = (await session.execute(select(Item).where(Item.id == prod.item_id))).scalar_one()
        assert canon_item.is_tax_inclusive is True
        
        # Check canonical Variant
        assert prod.item_variant_id is not None
        canon_var = (await session.execute(select(ItemVariant).where(ItemVariant.id == prod.item_variant_id))).scalar_one()
        assert canon_var.is_tax_inclusive is True


@pytest.mark.asyncio
async def test_product_creation_explicit_tax_exclusive(tenant_ctx):
    """
    Verify creating an industrial / wholesale product with is_tax_inclusive = False
    propagates to canonical Item and ItemVariant atomically.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        inv_service = InventoryService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:6].upper()
        prod_in = ProductCreate(
            code=f"SKU-EXC-{uid}",
            name=f"Tax Exclusive Bulk Shoe {uid}",
            price=Decimal("1000.00"),
            mrp=Decimal("1500.00"),
            buying_price=Decimal("500.00"),
            cost_price=Decimal("500.00"),
            category="Footwear",
            barcode=f"BAR-EXC-{uid}",
            gst_percentage=Decimal("18.00"),
            hsn_code="6403",
            style_code=None,
            attributes={"style_no": "CH-07-B", "article_no": f"ART-{uid}"},
            is_tax_inclusive=False,
        )
        prod = await inv_service.create_product(prod_in)
        await session.commit()

        assert prod.is_tax_inclusive is False
        
        canon_item = (await session.execute(select(Item).where(Item.id == prod.item_id))).scalar_one()
        assert canon_item.is_tax_inclusive is False
        
        canon_var = (await session.execute(select(ItemVariant).where(ItemVariant.id == prod.item_variant_id))).scalar_one()
        assert canon_var.is_tax_inclusive is False


@pytest.mark.asyncio
async def test_item_master_svc_create_item_tax_inclusive(tenant_ctx):
    """
    Verify UniversalItemMasterService.create_item persists is_tax_inclusive on Item and Variants.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        uid = uuid.uuid4().hex[:6].upper()
        req = ItemCreateRequest(
            item_code=f"ITM-INC-{uid}",
            item_name=f"Universal Item Inclusive {uid}",
            category="Footwear",
            tax_rate=12.00,
            mrp=1120.00,
            selling_price=1120.00,
            cost_price=500.00,
            is_tax_inclusive=True,
            variants=[
                ItemVariantItem(
                    variant_sku=f"ITM-INC-{uid}-L",
                    variant_name=f"Universal Item {uid} Large",
                    mrp=1120.00,
                    selling_price=1120.00,
                    cost_price=500.00,
                    is_tax_inclusive=True,
                )
            ]
        )
        item = await UniversalItemMasterService.create_item(session, req=req, commit=True)
        assert item.is_tax_inclusive is True
        assert len(item.variants) >= 1
        assert item.variants[0].is_tax_inclusive is True


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

        # Create product with stock
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
            is_tax_inclusive=True,
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
