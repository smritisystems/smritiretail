"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.90.0
Created      : 2026-10-23
Modified     : 2026-10-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Sales Posting Writer Customer PO Parity Test Suite (WF-04)
"""

import os
import sys
import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Force testing flags and isolated test database
os.environ["TESTING"] = "1"
pg_port = int(os.getenv("POSTGRES_PORT", "2781"))

from sqlalchemy import select, delete, text
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.api.deps import TenantContext
from app.db.session import get_company_sessionmaker
from app.models.auth import User
from app.models.tenant import Company, Branch
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, Warehouse
from app.models.crm import Customer, CustomerGroup, CustomerDeliveryLocation
from app.models.pos import Shift, CashRegister
from app.models.customer_po import (
    CustomerPurchaseOrder,
    CustomerPurchaseOrderLine,
    CustomerPOInvoiceAllocation,
)
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.schemas.pos import POSCheckoutRequest, POSCheckoutItem, POSTenderItem
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.pos import POSService


TEST_DB_NAME = "smriti_test_phase2c"
TEST_COMPANY_ID = "COMP-001"
TEST_BRANCH_ID = "MAIN"
TEST_SHIFT_ID = "shift_cpo_parity_01"
TEST_REGISTER_ID = "reg_cpo_parity_01"
TEST_CUST_ID = "cust_cpo_canon_01"
TEST_PROD1_ID = "prod_cpo_canon_01"
TEST_PROD2_ID = "prod_cpo_canon_02"
TEST_LOC_ID = "cdl_cpo_canon_01"


@pytest.fixture(scope="module", autouse=True)
async def setup_cpo_parity_master_data():
    """Seed test company, branch, shift, customer, delivery location, and products in smriti_test_phase2c."""
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        # 1. Company & Branch
        comp = (await session.execute(select(Company).where(Company.id == TEST_COMPANY_ID))).scalar_one_or_none()
        if not comp:
            comp = Company(id=TEST_COMPANY_ID, name="SMRITI Test Retail Co", company_code="001", gst_number="27AAACA0001A1Z5")
            session.add(comp)

        branch = (await session.execute(select(Branch).where(Branch.id == TEST_BRANCH_ID))).scalar_one_or_none()
        if not branch:
            branch = Branch(id=TEST_BRANCH_ID, company_id=TEST_COMPANY_ID, name="Main Store", code="MAIN")
            session.add(branch)

        await session.flush()

        # 1b. Cashier User
        user_rec = (await session.execute(select(User).where(User.is_active == True, User.is_deleted == False))).scalars().first()
        if not user_rec:
            user_rec = User(
                id="usr-cpo-cashier",
                uuid=str(uuid.uuid4()),
                username="cashier_cpo_test",
                email="cashier_cpo@smritibooks.com",
                hashed_password="hash",
                role="CASHIER",
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                status="ACTIVE",
                employment_type="FULL_TIME",
                country="India",
                is_active=True,
                is_deleted=False,
            )
            session.add(user_rec)
            await session.flush()
        cashier_id = user_rec.id

        # 2. Register & Shift
        reg = (await session.execute(select(CashRegister).where(CashRegister.id == TEST_REGISTER_ID))).scalar_one_or_none()
        if not reg:
            reg = CashRegister(
                id=TEST_REGISTER_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                name="Parity Counter 1",
                code="REG-PARITY-01",
                is_active=True,
                is_deleted=False,
            )
            session.add(reg)

        await session.flush()

        shift = (await session.execute(select(Shift).where(Shift.id == TEST_SHIFT_ID))).scalar_one_or_none()
        if not shift:
            shift = Shift(
                id=TEST_SHIFT_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                register_id=TEST_REGISTER_ID,
                cashier_id=cashier_id,
                status="OPEN",
                opened_at=datetime.now(timezone.utc),
                opening_balance=Decimal("500.00"),
                is_active=True,
                is_deleted=False,
            )
            session.add(shift)
        else:
            shift.status = "OPEN"
            shift.cashier_id = cashier_id

        await session.flush()

        # 3. Customer
        cust = (await session.execute(select(Customer).where(Customer.id == TEST_CUST_ID))).scalar_one_or_none()
        if not cust:
            cust = Customer(
                id=TEST_CUST_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                code="CUST-CPO-01",
                name="Reliance Retail Modern Trade",
                mobile="9820199999",
                gst_number="27AABCR1234F1ZR",
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust)

        # 4. Customer Delivery Location
        loc = (await session.execute(select(CustomerDeliveryLocation).where(CustomerDeliveryLocation.id == TEST_LOC_ID))).scalar_one_or_none()
        if not loc:
            loc = CustomerDeliveryLocation(
                id=TEST_LOC_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                customer_id=TEST_CUST_ID,
                store_code="STR-MUM-001",
                location_name="Reliance Andheri Mega Store",
                state_code="27",
                status="ACTIVE",
                country="India",
                is_active=True,
                is_deleted=False,
            )
            session.add(loc)

        # 5. Canonical Items, Variants, and Barcodes
        from app.models.item_master import Item, ItemVariant, ItemBarcode
        from app.models.inventory import ProductBatchStock

        itm1 = (await session.execute(select(Item).where(Item.id == "itm_cpo_canon_01"))).scalar_one_or_none()
        if not itm1:
            itm1 = Item(
                id="itm_cpo_canon_01",
                company_id=TEST_COMPANY_ID,
                item_code="SKU-CPO-01",
                item_name="SMRITI Executive Formal Shirt",
                category="Apparel",
                is_active=True,
                is_deleted=False,
            )
            session.add(itm1)

        itm2 = (await session.execute(select(Item).where(Item.id == "itm_cpo_canon_02"))).scalar_one_or_none()
        if not itm2:
            itm2 = Item(
                id="itm_cpo_canon_02",
                company_id=TEST_COMPANY_ID,
                item_code="SKU-CPO-02",
                item_name="SMRITI Classic Trousers",
                category="Apparel",
                is_active=True,
                is_deleted=False,
            )
            session.add(itm2)

        await session.flush()

        var1 = (await session.execute(select(ItemVariant).where(ItemVariant.id == "var_cpo_canon_01"))).scalar_one_or_none()
        if not var1:
            var1 = ItemVariant(
                id="var_cpo_canon_01",
                company_id=TEST_COMPANY_ID,
                item_id="itm_cpo_canon_01",
                variant_sku="SKU-CPO-01",
                variant_name="SMRITI Executive Formal Shirt",
                selling_price=Decimal("100.00"),
                mrp=Decimal("118.00"),
                is_active=True,
                is_deleted=False,
            )
            session.add(var1)

        var2 = (await session.execute(select(ItemVariant).where(ItemVariant.id == "var_cpo_canon_02"))).scalar_one_or_none()
        if not var2:
            var2 = ItemVariant(
                id="var_cpo_canon_02",
                company_id=TEST_COMPANY_ID,
                item_id="itm_cpo_canon_02",
                variant_sku="SKU-CPO-02",
                variant_name="SMRITI Classic Trousers",
                selling_price=Decimal("200.00"),
                mrp=Decimal("236.00"),
                is_active=True,
                is_deleted=False,
            )
            session.add(var2)

        bar1 = (await session.execute(select(ItemBarcode).where(ItemBarcode.id == "bar_cpo_canon_01"))).scalar_one_or_none()
        if not bar1:
            bar1 = ItemBarcode(
                id="bar_cpo_canon_01",
                company_id=TEST_COMPANY_ID,
                variant_id="var_cpo_canon_01",
                item_id="itm_cpo_canon_01",
                barcode="8901112223331",
                barcode_type="EAN13",
                is_primary=True,
                is_active=True,
                is_deleted=False,
            )
            session.add(bar1)

        bar2 = (await session.execute(select(ItemBarcode).where(ItemBarcode.id == "bar_cpo_canon_02"))).scalar_one_or_none()
        if not bar2:
            bar2 = ItemBarcode(
                id="bar_cpo_canon_02",
                company_id=TEST_COMPANY_ID,
                variant_id="var_cpo_canon_02",
                item_id="itm_cpo_canon_02",
                barcode="8901112223332",
                barcode_type="EAN13",
                is_primary=True,
                is_active=True,
                is_deleted=False,
            )
            session.add(bar2)

        await session.flush()

        # 6. Legacy Products with Dual-Key Mapping
        p1 = (await session.execute(select(Product).where(Product.id == TEST_PROD1_ID))).scalar_one_or_none()
        if not p1:
            p1 = Product(
                id=TEST_PROD1_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                item_id="itm_cpo_canon_01",
                item_variant_id="var_cpo_canon_01",
                code="SKU-CPO-01",
                sku="SKU-CPO-01",
                name="SMRITI Executive Formal Shirt",
                price=Decimal("100.00"),
                mrp=Decimal("118.00"),
                gst_percentage=Decimal("18.00"),
                hsn_code="6205",
                category="Apparel",
                barcode="8901112223331",
                stock=500,
                is_active=True,
                is_deleted=False,
            )
            session.add(p1)
        else:
            p1.item_id = "itm_cpo_canon_01"
            p1.item_variant_id = "var_cpo_canon_01"

        p2 = (await session.execute(select(Product).where(Product.id == TEST_PROD2_ID))).scalar_one_or_none()
        if not p2:
            p2 = Product(
                id=TEST_PROD2_ID,
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                item_id="itm_cpo_canon_02",
                item_variant_id="var_cpo_canon_02",
                code="SKU-CPO-02",
                sku="SKU-CPO-02",
                name="SMRITI Classic Trousers",
                price=Decimal("200.00"),
                mrp=Decimal("236.00"),
                gst_percentage=Decimal("18.00"),
                hsn_code="6203",
                category="Apparel",
                barcode="8901112223332",
                stock=500,
                is_active=True,
                is_deleted=False,
            )
            session.add(p2)
        else:
            p2.item_id = "itm_cpo_canon_02"
            p2.item_variant_id = "var_cpo_canon_02"

        # 7. Warehouses & Batch Stocks
        wh = (await session.execute(select(Warehouse).where(Warehouse.company_id == TEST_COMPANY_ID, Warehouse.is_active == True, Warehouse.is_deleted == False))).scalars().first()
        if not wh:
            wh = Warehouse(
                id="wh_cpo_main_01",
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                name="Main Distribution Warehouse",
                code="WH-CPO-01",
                is_active=True,
                is_deleted=False,
            )
            session.add(wh)
            await session.flush()

        for pid in [TEST_PROD1_ID, TEST_PROD2_ID]:
            pbs = (await session.execute(
                select(ProductBatchStock).where(
                    ProductBatchStock.company_id == TEST_COMPANY_ID,
                    ProductBatchStock.warehouse_id == wh.id,
                    ProductBatchStock.product_id == pid,
                    ProductBatchStock.batch_no == "DEFAULT",
                    ProductBatchStock.is_deleted == False,
                )
            )).scalars().first()
            if not pbs:
                pbs = ProductBatchStock(
                    id=f"pbs-{pid}-{wh.id}",
                    uuid=str(uuid.uuid4()),
                    company_id=TEST_COMPANY_ID,
                    branch_id=TEST_BRANCH_ID,
                    warehouse_id=wh.id,
                    product_id=pid,
                    batch_no="DEFAULT",
                    quantity=Decimal("1000.0000"),
                    reserved_quantity=Decimal("0.0000"),
                    damaged_quantity=Decimal("0.0000"),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(pbs)
            else:
                pbs.quantity = Decimal("1000.0000")

        await session.commit()


@pytest.mark.asyncio
async def test_01_valid_customer_po_billing_and_balance_decrement():
    """
    Test 1: Valid Customer PO billing decrement and allocation creation.
    - PO with 2 lines (Line 1: 10 ordered, Line 2: 5 ordered).
    - Bill 4 units of Line 1 through CanonicalSalesPostingWriter.
    - Verify remaining qty = 6, status = PARTIALLY_BILLED, CustomerPOInvoiceAllocation created,
      and invoice fields snapshotted correctly.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_test_{suffix}"
        line1_id = f"cpol_1_{suffix}"
        line2_id = f"cpol_2_{suffix}"
        po_no = f"PO-CANON-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("15.0000"),
            remaining_quantity=Decimal("15.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("2000.00"),
            remaining_value=Decimal("2000.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "BLOCK"},
            is_active=True,
            is_deleted=False,
        )
        line1 = CustomerPurchaseOrderLine(
            id=line1_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("10.0000"),
            quantity_remaining=Decimal("10.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            hsn_code="6205",
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        line2 = CustomerPurchaseOrderLine(
            id=line2_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="2",
            product_id=TEST_PROD2_ID,
            code="SKU-CPO-02",
            description="SMRITI Classic Trousers",
            quantity_ordered=Decimal("5.0000"),
            quantity_remaining=Decimal("5.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("200.00"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            hsn_code="6203",
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line1, line2])
        await session.commit()

        # Post transaction for 4 units of line 1
        # 4 units * 100 base = 400.00 taxable + 18% GST (72.00) = 472.00
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-PO-1-{suffix}",
                client_invoice_no=f"INV-PO1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("4.0000"),
                    unit_price=Decimal("100.00"),
                    mrp=Decimal("118.00"),
                    gst_rate=Decimal("18.00"),
                    hsn_code="6205",
                    is_tax_inclusive=False,
                    customer_po_line_id=line1_id,
                    source_line_type="CUSTOMER_PO_LINE",
                    source_line_id=line1_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("472.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=True)
        assert res.success is True
        assert res.net_amount == Decimal("472.00")

        # Refresh and verify PO line state
        await session.refresh(line1)
        assert line1.quantity_billed == Decimal("4.0000")
        assert line1.quantity_remaining == Decimal("6.0000")
        assert line1.line_status == "PARTIALLY_BILLED"

        # Verify PO header state
        await session.refresh(po)
        assert po.billed_quantity == Decimal("4.0000")
        assert po.remaining_quantity == Decimal("11.0000")
        assert po.status == "PARTIALLY_BILLED"

        # Verify allocation record
        alloc = (await session.execute(
            select(CustomerPOInvoiceAllocation).where(
                CustomerPOInvoiceAllocation.customer_po_id == po_id,
                CustomerPOInvoiceAllocation.customer_po_line_id == line1_id,
            )
        )).scalar_one_or_none()
        assert alloc is not None
        assert alloc.allocated_quantity == Decimal("4.0000")
        assert alloc.invoice_id == res.invoice_id
        assert alloc.customer_po_number == po_no

        # Verify invoice snapshot fields
        inv = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == res.invoice_id))).scalar_one_or_none()
        assert inv is not None
        assert inv.customer_po_id == po_id
        assert inv.po_reference == po_no
        assert inv.customer_po_number_snapshot == po_no


@pytest.mark.asyncio
async def test_02_exhausted_customer_po_quantities_rejection():
    """
    Test 2: Rejection when Customer PO line is exhausted.
    - Bill the remaining 6 units of line 1 from previous test.
    - Line becomes FULLY_BILLED with remaining quantity 0.
    - Attempting to bill 1 additional unit raises 409 Conflict.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_exh_{suffix}"
        line_id = f"cpol_exh_{suffix}"
        po_no = f"PO-EXH-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("5.0000"),
            remaining_quantity=Decimal("5.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "BLOCK"},
            is_active=True,
            is_deleted=False,
        )
        line = CustomerPurchaseOrderLine(
            id=line_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("5.0000"),
            quantity_remaining=Decimal("5.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line])
        await session.commit()

        # Step 1: Bill exactly 5 units to exhaust the line
        req1 = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-EXH-1-{suffix}",
                client_invoice_no=f"INV-EXH1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("5.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("590.00"))
            ],
        )
        res1 = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req1, commit=True)
        assert res1.success is True

        await session.refresh(line)
        assert line.quantity_remaining == Decimal("0.0000")
        assert line.line_status == "FULLY_BILLED"

        # Step 2: Attempt to bill 1 more unit against exhausted line -> must raise 409
        req2 = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-EXH-2-{suffix}",
                client_invoice_no=f"INV-EXH2-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("118.00"))
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req2, commit=False)
        assert exc_info.value.status_code == 409
        assert "Overbilling blocked" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_03_overbilling_prevention_under_block_policy():
    """
    Test 3: Overbilling blocked under BLOCK policy.
    - PO line has remaining quantity = 5.
    - Transaction requests 8 units without supervisor authorization.
    - Must be rejected with 409 Conflict.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_blk_{suffix}"
        line_id = f"cpol_blk_{suffix}"
        po_no = f"PO-BLK-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("5.0000"),
            remaining_quantity=Decimal("5.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "BLOCK"},
            is_active=True,
            is_deleted=False,
        )
        line = CustomerPurchaseOrderLine(
            id=line_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("5.0000"),
            quantity_remaining=Decimal("5.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line])
        await session.commit()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-BLK-1-{suffix}",
                client_invoice_no=f"INV-BLK1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("8.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("944.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=False)
        assert exc_info.value.status_code == 409
        assert "Overbilling blocked" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_04_supervisor_authorization_override_under_allow_with_authorization():
    """
    Test 4: Supervisor authorization override under ALLOW_WITH_AUTHORIZATION policy.
    - PO policy is ALLOW_WITH_AUTHORIZATION.
    - Billing 8 units (ordered = 5) without supervisor code raises 409.
    - Providing supervisor_override_code allows the overbilling and succeeds.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_auth_{suffix}"
        line_id = f"cpol_auth_{suffix}"
        po_no = f"PO-AUTH-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("5.0000"),
            remaining_quantity=Decimal("5.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "ALLOW_WITH_AUTHORIZATION"},
            is_active=True,
            is_deleted=False,
        )
        line = CustomerPurchaseOrderLine(
            id=line_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("5.0000"),
            quantity_remaining=Decimal("5.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("500.00"),
            remaining_value=Decimal("500.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line])
        await session.commit()

        # Step 1: Attempt overbilling without supervisor override -> 409
        req_unauth = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-AUTH-1-{suffix}",
                client_invoice_no=f"INV-AUTH1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("8.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("944.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_unauth, commit=False)
        assert exc_info.value.status_code == 409
        assert "Supervisor override required" in str(exc_info.value.detail)

        # Step 2: Overbilling with supervisor override code -> SUCCESS
        req_auth = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-AUTH-2-{suffix}",
                client_invoice_no=f"INV-AUTH2-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
                supervisor_override_code="SUP-AUTH-OVERRIDE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("8.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("944.00"))
            ],
        )

        res_auth = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_auth, commit=True)
        assert res_auth.success is True

        await session.refresh(line)
        # quantity_billed is CAPPED at the DB constraint ceiling (ordered + cancelled = 5.0000).
        # Under ALLOW_WITH_AUTHORIZATION the overrun is recorded in CustomerPOInvoiceAllocation,
        # not in the CPO line's billed_quantity column.
        assert line.quantity_billed == Decimal("5.0000"), (
            f"Expected billed_quantity capped at ordered+cancelled ceiling (5.0000), got {line.quantity_billed}"
        )
        assert line.quantity_remaining == Decimal("0.0000"), (
            f"Expected remaining_quantity=0 after ceiling hit, got {line.quantity_remaining}"
        )
        assert line.line_status == "FULLY_BILLED", (
            f"Expected FULLY_BILLED, got {line.line_status}"
        )

        # Verify the CustomerPOInvoiceAllocation recorded the FULL billed quantity (8.0000)
        # and the authorized overrun (3.0000) in allocation_metadata.
        from sqlalchemy import select as sa_select
        from app.models.customer_po import CustomerPOInvoiceAllocation
        alloc_res = await session.execute(
            sa_select(CustomerPOInvoiceAllocation).where(
                CustomerPOInvoiceAllocation.customer_po_id == po_id,
                CustomerPOInvoiceAllocation.customer_po_line_id == line_id,
            )
        )
        alloc = alloc_res.scalars().first()
        assert alloc is not None, "CustomerPOInvoiceAllocation must exist for authorized overbilling"
        assert alloc.allocated_quantity == Decimal("8.0000"), (
            f"Allocation must store the TRUE billed qty (8.0000), got {alloc.allocated_quantity}"
        )
        assert alloc.allocation_metadata.get("policy") == "ALLOW_WITH_AUTHORIZATION", (
            f"Allocation metadata must record the policy, got {alloc.allocation_metadata}"
        )
        assert alloc.allocation_metadata.get("authorized_overrun_qty") == "3.0000", (
            f"Allocation metadata must record authorized_overrun_qty='3.0000', got {alloc.allocation_metadata}"
        )


@pytest.mark.asyncio
async def test_05_modern_trade_store_location_enforcement():
    """
    Test 5: Modern Trade delivery location and store code enforcement.
    - Billing under sales_channel="MODERN_TRADE" requires both delivery location and store code.
    - Missing store code/location raises 400 Bad Request.
    - When provided, posting succeeds.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]

        # Step 1: Missing delivery location & store code -> 400 Bad Request
        req_missing = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-MT-1-{suffix}",
                client_invoice_no=f"INV-MT1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="MODERN_TRADE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            sales_channel="MODERN_TRADE",
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("118.00"))
            ],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_missing, commit=False)
        assert exc_info.value.status_code == 400
        assert "Modern Trade billing requires both delivery location and store code" in str(exc_info.value.detail)

        # Step 2: With valid delivery_location_id and delivery_store_code -> SUCCESS
        req_valid = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-MT-2-{suffix}",
                client_invoice_no=f"INV-MT2-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="MODERN_TRADE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            sales_channel="MODERN_TRADE",
            delivery_location_id=TEST_LOC_ID,
            delivery_store_code="STR-MUM-001",
            billing_store_code="STR-MUM-001",
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("1.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("118.00"))
            ],
        )

        res_valid = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req_valid, commit=True)
        assert res_valid.success is True


@pytest.mark.asyncio
async def test_06_atomic_rollback_on_transaction_failure():
    """
    Test 6: Atomic rollback guarantees zero orphan allocations and zero balance mutations.
    - PO line with remaining qty = 10.
    - Transaction execution aborted before commit.
    - Assert that PO line balances remain unchanged and no allocations are saved.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_rb_{suffix}"
        line_id = f"cpol_rb_{suffix}"
        po_no = f"PO-RB-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("10.0000"),
            remaining_quantity=Decimal("10.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "BLOCK"},
            is_active=True,
            is_deleted=False,
        )
        line = CustomerPurchaseOrderLine(
            id=line_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("10.0000"),
            quantity_remaining=Decimal("10.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line])
        await session.commit()

        # Execute with commit=False, then roll back session
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                shift_id=TEST_SHIFT_ID,
                idempotency_key=f"IDEM-RB-1-{suffix}",
                client_invoice_no=f"INV-RB1-{suffix.upper()}",
                source_channel="B2B_WHOLESALE",
                sales_channel="B2B_WHOLESALE",
            ),
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po_id=po_id,
            po_reference_no=po_no,
            items=[
                CanonicalPostingLineItem(
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    product_id=TEST_PROD1_ID,
                    quantity=Decimal("3.0000"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CREDIT", amount=Decimal("354.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session=session, req=req, commit=False)
        assert res.success is True

        # Now simulate transaction abort / rollback
        await session.rollback()

        # Re-fetch from DB to verify immutability on rollback
        line_after = (await session.execute(
            select(CustomerPurchaseOrderLine).where(CustomerPurchaseOrderLine.id == line_id)
        )).scalar_one_or_none()
        assert line_after.quantity_billed == Decimal("0.0000")
        assert line_after.quantity_remaining == Decimal("10.0000")
        assert line_after.line_status == "OPEN"

        allocs = (await session.execute(
            select(CustomerPOInvoiceAllocation).where(CustomerPOInvoiceAllocation.customer_po_id == po_id)
        )).scalars().all()
        assert len(allocs) == 0


@pytest.mark.asyncio
async def test_07_pos_checkout_with_customer_po_integration():
    """
    Test 7: Direct POS checkout integration via POSService.pos_checkout.
    - Submit POSCheckoutRequest with customer_po_id and item customer_po_line_id.
    - Verify successful invoice creation, line balance decrement, and CustomerPOInvoiceAllocation.
    """
    session_factory = get_company_sessionmaker(TEST_DB_NAME)
    async with session_factory() as session:
        suffix = uuid.uuid4().hex[:6]
        po_id = f"cpo_pos_{suffix}"
        line_id = f"cpol_pos_{suffix}"
        po_no = f"PO-POS-{suffix.upper()}"

        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_id=TEST_CUST_ID,
            po_number=po_no,
            po_date=date.today(),
            currency="INR",
            status="OPEN",
            ordered_quantity=Decimal("10.0000"),
            remaining_quantity=Decimal("10.0000"),
            billed_quantity=Decimal("0.0000"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            billing_policy_snapshot={"overbilling_policy": "BLOCK"},
            is_active=True,
            is_deleted=False,
        )
        line = CustomerPurchaseOrderLine(
            id=line_id,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            customer_po_id=po_id,
            line_number="1",
            product_id=TEST_PROD1_ID,
            code="SKU-CPO-01",
            description="SMRITI Executive Formal Shirt",
            quantity_ordered=Decimal("10.0000"),
            quantity_remaining=Decimal("10.0000"),
            quantity_billed=Decimal("0.0000"),
            unit_price=Decimal("100.00"),
            ordered_value=Decimal("1000.00"),
            remaining_value=Decimal("1000.00"),
            billed_value=Decimal("0.00"),
            gst_rate=Decimal("18.00"),
            line_status="OPEN",
            is_active=True,
            is_deleted=False,
        )
        session.add_all([po, line])
        await session.commit()

        tenant = TenantContext(company_id=TEST_COMPANY_ID, branch_id=TEST_BRANCH_ID)
        pos_svc = POSService(session, tenant)

        checkout_req = POSCheckoutRequest(
            client_tx_uuid=f"TX-POS-{suffix}",
            invoice_no=f"INV-POS-{suffix.upper()}",
            shift_id=TEST_SHIFT_ID,
            customer_id=TEST_CUST_ID,
            customer_name="Reliance Retail Modern Trade",
            customer_po=po_no,
            customer_po_id=po_id,
            customer_po_reference=po_no,
            sales_channel="B2B_WHOLESALE",
            payment_mode="CREDIT",
            grand_total=Decimal("236.00"),
            tenders=[
                POSTenderItem(tender_type="CREDIT", amount=Decimal("236.00"))
            ],
            items=[
                POSCheckoutItem(
                    product_id=TEST_PROD1_ID,
                    code="SKU-CPO-01",
                    name="SMRITI Executive Formal Shirt",
                    quantity=Decimal("2.0000"),
                    price=Decimal("100.00"),
                    mrp=Decimal("118.00"),
                    gst_rate=Decimal("18.00"),
                    is_tax_inclusive=False,
                    customer_po_line_id=line_id,
                    source_line_type="CUSTOMER_PO_LINE",
                    source_line_id=line_id,
                )
            ],
        )

        res = await pos_svc.pos_checkout(checkout_req)
        assert res["cached"] is False
        inv = res["invoice"]
        assert inv.grand_total == Decimal("236.00")
        assert inv.customer_po_id == po_id
        assert inv.po_reference == po_no

        await session.refresh(line)
        assert line.quantity_billed == Decimal("2.0000")
        assert line.quantity_remaining == Decimal("8.0000")
        assert line.line_status == "PARTIALLY_BILLED"

        alloc = (await session.execute(
            select(CustomerPOInvoiceAllocation).where(
                CustomerPOInvoiceAllocation.customer_po_id == po_id,
                CustomerPOInvoiceAllocation.customer_po_line_id == line_id,
            )
        )).scalar_one_or_none()
        assert alloc is not None
        assert alloc.allocated_quantity == Decimal("2.0000")
        assert alloc.invoice_id == inv.id
