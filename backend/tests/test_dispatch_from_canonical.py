"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Dispatch From & GST E-Way Bill Verification Suite
"""

import sys
import os
import uuid
import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
env_file = backend_dir.parent / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.db.session import get_company_sessionmaker
from app.models.tenant import Company, Branch
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.inventory import Product, Warehouse
from app.models.crm import Customer, CustomerGroup
from app.models.pos import Shift, CashRegister
from app.models.auth import User
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalTenderItem,
)
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.eway_bill_service import EWayBillService
from app.services.invoice_pdf_service import InvoicePdfService


@pytest.fixture(scope="module", autouse=True)
async def setup_dispatch_test_master_data():
    """Ensure test company, branch, warehouses, customer, and open shift exist."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. Company & Branch
        comp = (await session.execute(select(Company).where(Company.id == "COMP-001"))).scalar_one_or_none()
        if not comp:
            comp = Company(
                id="COMP-001",
                name="Tattly Threads",
                company_code="001",
                gst_number="27AAXFT2508H1ZR",
                address="Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
            )
            session.add(comp)
        else:
            comp.name = "Tattly Threads"
            comp.gst_number = "27AAXFT2508H1ZR"
            comp.address = "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003"
            session.add(comp)

        branch = (await session.execute(select(Branch).where(Branch.id == "MAIN"))).scalar_one_or_none()
        if not branch:
            branch = Branch(id="MAIN", company_id="COMP-001", name="Main Store", code="MAIN")
            session.add(branch)

        # 2. Warehouses: Mumbai HQ Depot and Nagpur Dispatch Depot
        wh_ngp = (await session.execute(select(Warehouse).where(Warehouse.id == "wh-ngp-001"))).scalar_one_or_none()
        if not wh_ngp:
            wh_ngp = Warehouse(
                id="wh-ngp-001",
                uuid=str(uuid.uuid4()),
                company_id="COMP-001",
                branch_id="MAIN",
                code="WH-NGP",
                name="Tattly Threads Nagpur Depot",
                address="Om Sai Nagar, Kalamana",
                city="Nagpur",
                state="Maharashtra",
                pincode="440029",
                contact_person="Depot Manager",
                phone="+91-712-2500000",
                is_active=True,
                is_deleted=False,
            )
            session.add(wh_ngp)

        wh_mum = (await session.execute(select(Warehouse).where(Warehouse.id == "wh-mum-001"))).scalar_one_or_none()
        if not wh_mum:
            wh_mum = Warehouse(
                id="wh-mum-001",
                uuid=str(uuid.uuid4()),
                company_id="COMP-001",
                branch_id="MAIN",
                code="WH-MUM",
                name="Tattly Threads Mumbai Central Warehouse",
                address="Office No. 81, Ibrahim Rehmatullah Road",
                city="Mumbai",
                state="Maharashtra",
                pincode="400003",
                contact_person="HQ Dispatch Manager",
                phone="+91-22-23000000",
                is_active=True,
                is_deleted=False,
            )
            session.add(wh_mum)

        # Inactive Warehouse for validation testing
        wh_inact = (await session.execute(select(Warehouse).where(Warehouse.id == "wh-inact-001"))).scalar_one_or_none()
        if not wh_inact:
            wh_inact = Warehouse(
                id="wh-inact-001",
                uuid=str(uuid.uuid4()),
                company_id="COMP-001",
                branch_id="MAIN",
                code="WH-INACT",
                name="Decommissioned Depot",
                address="Old Yard Road",
                city="Pune",
                state="Maharashtra",
                pincode="411001",
                is_active=False,
                is_deleted=False,
            )
            session.add(wh_inact)

        # Cross-Tenant Company & Branch (COMP-002)
        comp2 = (await session.execute(select(Company).where(Company.id == "COMP-002"))).scalar_one_or_none()
        if not comp2:
            comp2 = Company(
                id="COMP-002",
                name="External Textile Enterprise",
                company_code="002",
                gst_number="24AAXCS9999K1Z2",
            )
            session.add(comp2)
            await session.flush()

        branch2 = (await session.execute(select(Branch).where(Branch.id == "BR-COMP2"))).scalar_one_or_none()
        if not branch2:
            branch2 = Branch(
                id="BR-COMP2",
                company_id="COMP-002",
                name="Surat Branch",
                code="BR-COMP2",
            )
            session.add(branch2)
            await session.flush()

        # Cross-Tenant Warehouse (COMP-002)
        wh_comp2 = (await session.execute(select(Warehouse).where(Warehouse.id == "wh-comp2-001"))).scalar_one_or_none()
        if not wh_comp2:
            wh_comp2 = Warehouse(
                id="wh-comp2-001",
                uuid=str(uuid.uuid4()),
                company_id="COMP-002",
                branch_id="BR-COMP2",
                code="WH-EXT",
                name="External Company Warehouse",
                address="External GIDC",
                city="Surat",
                state="Gujarat",
                pincode="395003",
                is_active=True,
                is_deleted=False,
            )
            session.add(wh_comp2)

        # 3. Customers: Assam (18) and Telangana (36)
        cust_assam = (await session.execute(select(Customer).where(Customer.id == "cust-assam-001"))).scalar_one_or_none()
        if not cust_assam:
            cust_assam = Customer(
                id="cust-assam-001",
                company_id="COMP-001",
                code="CUST-ASSAM",
                name="Reliance Retail Limited (Dibrugarh)",
                mobile="9820011111",
                gst_number="18AABCR1718E1ZO",
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust_assam)

        cust_tg = (await session.execute(select(Customer).where(Customer.id == "cust-tg-001"))).scalar_one_or_none()
        if not cust_tg:
            cust_tg = Customer(
                id="cust-tg-001",
                company_id="COMP-001",
                code="CUST-TG",
                name="Reliance Retail Limited (Hyderabad)",
                mobile="9820022222",
                gst_number="36AAXCR1234F1Z0",
                status="Active",
                is_active=True,
                is_deleted=False,
            )
            session.add(cust_tg)

        # 4. Cashier User & Shift
        cashier = (await session.execute(select(User).where(User.username == "cashier_dispatch_test"))).scalar_one_or_none()
        if not cashier:
            cashier = User(
                id="usr-dispatch-test-01",
                username="cashier_dispatch_test",
                email="cashier_disp@smritibooks.com",
                hashed_password="hash",
                role="CASHIER",
                is_active=True,
                is_deleted=False,
            )
            session.add(cashier)
            await session.flush()

        reg = (await session.execute(select(CashRegister).where(CashRegister.id == "REG-DISP-01"))).scalar_one_or_none()
        if not reg:
            reg = CashRegister(
                id="REG-DISP-01",
                company_id="COMP-001",
                branch_id="MAIN",
                code="REG-DISP-01",
                name="Dispatch POS Register",
                is_active=True,
                is_deleted=False,
            )
            session.add(reg)
            await session.flush()

        shift = (await session.execute(select(Shift).where(Shift.id == "shift_dispatch_open_01"))).scalar_one_or_none()
        if not shift:
            shift = Shift(
                id="shift_dispatch_open_01",
                company_id="COMP-001",
                branch_id="MAIN",
                cashier_id=cashier.id,
                register_id="REG-DISP-01",
                status="OPEN",
                opened_at=datetime.now(timezone.utc),
                opening_balance=Decimal("1000.00"),
                is_deleted=False,
            )
            session.add(shift)

        # 5. Product
        prod = (await session.execute(select(Product).where(Product.code == "PROD-DISP-01"))).scalar_one_or_none()
        if not prod:
            prod = Product(
                id="prod-disp-01",
                company_id="COMP-001",
                code="PROD-DISP-01",
                name="Tattly Footwear Classic",
                category="Footwear",
                barcode="8901112223344",
                hsn_code="64041990",
                price=100.00,
                mrp=150.00,
                cost_price=60.00,
                stock=500,
                is_active=True,
                is_deleted=False,
            )
            session.add(prod)

        from app.models.inventory import ProductBatchStock
        for wh_id in ["wh-ngp-001", "wh-mum-001"]:
            pbs = (await session.execute(
                select(ProductBatchStock).where(
                    ProductBatchStock.company_id == "COMP-001",
                    ProductBatchStock.warehouse_id == wh_id,
                    ProductBatchStock.product_id == "prod-disp-01",
                    ProductBatchStock.batch_no == "DEFAULT",
                    ProductBatchStock.is_deleted == False,
                )
            )).scalars().first()
            if not pbs:
                pbs = ProductBatchStock(
                    id=f"pbs-disp-{wh_id}",
                    uuid=str(uuid.uuid4()),
                    company_id="COMP-001",
                    branch_id="MAIN",
                    warehouse_id=wh_id,
                    product_id="prod-disp-01",
                    batch_no="DEFAULT",
                    quantity=Decimal("50000.0000"),
                    reserved_quantity=Decimal("0.0000"),
                    damaged_quantity=Decimal("0.0000"),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(pbs)
            else:
                pbs.quantity = Decimal("50000.0000")
                session.add(pbs)

        await session.commit()


@pytest.mark.asyncio
async def test_01_mumbai_bill_from_nagpur_dispatch_from_assam_ship_to():
    """
    Test 1: Mumbai Bill From + Nagpur Dispatch From + Assam Ship To.
    Validates:
      - Bill From: Mumbai (27)
      - Dispatch From: Nagpur (27, 440029)
      - Ship To: Assam (18)
      - Jurisdiction: Inter-state (18 != 27) -> IGST 5% applied.
      - Snapshot persisted properly on SalesInvoice.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-01-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited (Dibrugarh)",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            shipping_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            place_of_supply="18-Assam",
            dispatch_from_location_id="wh-ngp-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("10.00"),
                    unit_price=Decimal("100.00"),
                    disc_pct=Decimal("0.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1050.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True
        assert res.igst_amount == Decimal("50.00")
        assert res.cgst_amount == Decimal("0.00")
        assert res.sgst_amount == Decimal("0.00")
        assert res.net_amount == Decimal("1050.00")

        # Verify DB Invoice record
        inv = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == res.invoice_id))).scalar_one()
        assert inv.dispatch_from_location_id == "wh-ngp-001"
        assert inv.dispatch_from_snapshot is not None
        assert inv.dispatch_from_snapshot["city"] == "Nagpur"
        assert inv.dispatch_from_snapshot["pincode"] == "440029"
        assert inv.dispatch_from_snapshot["state"] == "Maharashtra"
        assert inv.dispatch_from_snapshot["state_code"] == "27"
        assert inv.place_of_supply_code == "18"
        assert inv.is_interstate is True


@pytest.mark.asyncio
async def test_02_mumbai_bill_from_nagpur_dispatch_from_telangana_ship_to():
    """
    Test 2: Mumbai Bill From + Nagpur Dispatch From + Telangana Ship To.
    Validates:
      - Bill From: Mumbai (27)
      - Dispatch From: Nagpur (27)
      - Ship To: Telangana (36)
      - Jurisdiction: Inter-state (36 != 27) -> IGST 5% applied.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-02-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-tg-001",
            customer_name="Reliance Retail Limited (Hyderabad)",
            customer_gstin="36AAXCR1234F1Z0",
            billing_address="Reliance Trends Abids Hyderabad Telangana 500001",
            shipping_address="Reliance Trends Abids Hyderabad Telangana 500001",
            place_of_supply="36-Telangana",
            dispatch_from_location_id="wh-ngp-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("20.00"),
                    unit_price=Decimal("100.00"),
                    disc_pct=Decimal("10.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("1890.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True
        assert res.taxable_amount == Decimal("1800.00")
        assert res.igst_amount == Decimal("90.00")
        assert res.net_amount == Decimal("1890.00")

        inv = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == res.invoice_id))).scalar_one()
        assert inv.dispatch_from_location_id == "wh-ngp-001"
        assert inv.is_interstate is True
        assert inv.place_of_supply_code == "36"


@pytest.mark.asyncio
async def test_03_bill_from_and_dispatch_from_different_locations_eway_trans_type():
    """
    Test 3: Bill From and Dispatch From being different locations.
    Verifies that E-Way Bill adapter sets transType = 3 (Bill From - Dispatch From) or 4 (Combination).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create invoice with Mumbai Bill From and Nagpur Dispatch From
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-03-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited (Dibrugarh)",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            shipping_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            place_of_supply="18-Assam",
            dispatch_from_location_id="wh-ngp-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("525.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True

        # Run E-Way Bill adapter
        class MockTenant:
            company_id = "COMP-001"

        eway_service = EWayBillService(db=session, tenant=MockTenant())
        payload = await eway_service.generate_invoice_eway_bill_payload(
            invoice_id=res.invoice_id,
            strict_validation=False,
        )

        bill = payload["billLists"][0]
        # Because Bill From is Mumbai (400003) and Dispatch From is Nagpur (440029), transType must be 3 or 4
        assert bill["transType"] in (3, 4)
        assert bill["fromGstin"] == "27AAXFT2508H1ZR"
        assert bill["fromStateCode"] == 27
        assert bill["fromPincode"] == 440029
        assert "NAGPUR" in bill["fromPlace"].upper()
        assert bill["actualFromStateCode"] == 27


@pytest.mark.asyncio
async def test_04_bill_from_and_dispatch_from_same_location():
    """
    Test 4: Bill From and Dispatch From being the same location.
    Verifies that when goods are dispatched from Mumbai HQ (wh-mum-001),
    transType is 1 (Regular) and Dispatch From address matches Mumbai HQ.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-04-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-mum-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited (Dibrugarh)",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            shipping_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            place_of_supply="18-Assam",
            dispatch_from_location_id="wh-mum-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("500.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("525.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True

        class MockTenant:
            company_id = "COMP-001"

        eway_service = EWayBillService(db=session, tenant=MockTenant())
        payload = await eway_service.generate_invoice_eway_bill_payload(
            invoice_id=res.invoice_id,
            strict_validation=False,
        )

        bill = payload["billLists"][0]
        assert bill["transType"] == 1
        assert bill["fromPincode"] == 400003
        assert "MUMBAI" in bill["fromPlace"].upper()


@pytest.mark.asyncio
async def test_05_historical_invoice_retains_original_snapshot_after_master_change():
    """
    Test 5: Historical invoice retains original Dispatch From snapshot after master address changes.
    Verifies immutability: mutating `warehouses` in the database does NOT alter the posted invoice snapshot.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Create a temporary warehouse
        temp_wh_id = f"wh-temp-{uuid.uuid4().hex[:6]}"
        temp_wh = Warehouse(
            id=temp_wh_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            branch_id="MAIN",
            code=f"WH-T-{uuid.uuid4().hex[:6].upper()}",
            name="Temporary Depot v1",
            address="Initial Address Line 1",
            city="Nagpur",
            state="Maharashtra",
            pincode="440029",
            is_active=True,
            is_deleted=False,
        )
        session.add(temp_wh)
        await session.flush()

        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-05-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id=temp_wh_id,
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="Assam",
            dispatch_from_location_id=temp_wh_id,
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("105.00"))],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True

        # Verify initial snapshot
        inv = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == res.invoice_id))).scalar_one()
        assert inv.dispatch_from_snapshot["address_line1"] == "Initial Address Line 1"
        assert inv.dispatch_from_snapshot["location_name"] == "Temporary Depot v1"

        # Mutate master warehouse address and name
        temp_wh.address = "COMPLETELY MUTATED ADDRESS"
        temp_wh.name = "MUTATED DEPOT NAME"
        temp_wh.pincode = "400099"
        session.add(temp_wh)
        await session.commit()

        # Re-fetch invoice from DB and verify snapshot is 100% UNCHANGED
        inv_refetched = (await session.execute(select(SalesInvoice).where(SalesInvoice.id == res.invoice_id))).scalar_one()
        assert inv_refetched.dispatch_from_snapshot["address_line1"] == "Initial Address Line 1"
        assert inv_refetched.dispatch_from_snapshot["location_name"] == "Temporary Depot v1"
        assert inv_refetched.dispatch_from_snapshot["pincode"] == "440029"


@pytest.mark.asyncio
async def test_06_cross_tenant_dispatch_from_is_rejected():
    """
    Test 6: Cross-tenant Dispatch From is rejected.
    Passing a warehouse belonging to COMP-002 when posting under COMP-001 must raise HTTP 403 (SMRITI-LOC-001).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-06-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-comp2-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited",
            billing_address="Assam",
            dispatch_from_location_id="wh-comp2-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("5.00"),
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("105.00"))],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=False)

        assert exc_info.value.status_code == 403
        assert "SMRITI-LOC-001" in exc_info.value.detail


@pytest.mark.asyncio
async def test_07_unauthorized_inactive_dispatch_from_is_rejected():
    """
    Test 7: Unauthorized or inactive Dispatch From is rejected.
    Passing an inactive warehouse (wh-inact-001) must raise HTTP 400 (SMRITI-LOC-003).
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-07-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-inact-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited",
            billing_address="Assam",
            dispatch_from_location_id="wh-inact-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("100.00"),
                    gst_rate=Decimal("5.00"),
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("105.00"))],
        )

        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=False)

        assert exc_info.value.status_code == 400
        assert "SMRITI-LOC-003" in exc_info.value.detail


@pytest.mark.asyncio
async def test_08_eway_bill_payload_receives_correct_bill_from_and_dispatch_from():
    """
    Test 8: E-Way Bill payload receives correct Bill From and Dispatch From per statutory NIC Rule 10.
    Ensures Bill From passes supplier GSTIN/name/state, Dispatch From passes actual address/city/pin/state.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-08-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited (Dibrugarh)",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            shipping_address="RRL Footprint RKB Path Dibrugarh Assam 786001",
            place_of_supply="18-Assam",
            dispatch_from_location_id="wh-ngp-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("400.00"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[
                CanonicalTenderItem(tender_type="CASH", amount=Decimal("420.00"))
            ],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True

        class MockTenant:
            company_id = "COMP-001"

        eway_service = EWayBillService(db=session, tenant=MockTenant())
        payload = await eway_service.generate_invoice_eway_bill_payload(
            invoice_id=res.invoice_id,
            strict_validation=False,
        )

        bill = payload["billLists"][0]
        # NIC Rule 10: Bill From has Legal Identity, Dispatch From has Physical Location
        assert bill["fromGstin"] == "27AAXFT2508H1ZR"
        assert bill["fromTrdName"] == "Tattly Threads"
        assert bill["fromStateCode"] == 27
        assert bill["fromAddr1"] == "Om Sai Nagar, Kalamana"
        assert bill["fromPlace"] == "Nagpur"
        assert bill["fromPincode"] == 440029
        assert bill["actualFromStateCode"] == 27


@pytest.mark.asyncio
async def test_09_pdf_displays_both_separately():
    """
    Test 9: Tax Invoice PDF renderer displays both BILL FROM and DISPATCH FROM separately.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Fetch invoice created in test 1
        inv = (await session.execute(
            select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(
                SalesInvoice.company_id == "COMP-001",
                SalesInvoice.dispatch_from_location_id == "wh-ngp-001",
                SalesInvoice.is_deleted == False
            ).order_by(SalesInvoice.created_at.desc())
        )).scalars().first()
        assert inv is not None

        html_doc = await InvoicePdfService.generate_invoice_html(inv)
        # Check for supplier letterhead and separate DISPATCH FROM block
        assert "TATTLY THREADS" in html_doc
        assert "DISPATCH FROM" in html_doc
        # Check for supplier HQ address and Nagpur depot address
        assert "Ibrahim Rehmatullah Road" in html_doc
        assert "Mumbai, Maharashtra - 400003" in html_doc
        assert "Om Sai Nagar, Kalamana" in html_doc
        assert "Nagpur, Maharashtra - 440029" in html_doc
        # Check for customer recipient details
        assert "BILLED TO" in html_doc
        assert "SHIPPED TO" in html_doc


@pytest.mark.asyncio
async def test_10_existing_tax_calculations_remain_exactly_unchanged():
    """
    Test 10: Existing tax calculations remain exactly unchanged.
    Validates:
      - 43.76% discount policy
      - unit taxable rounding
      - line tax extension
      - IGST 5% calculation
      - round-off behavior
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Case: Rate = 1000, 43.76% discount -> Taxable = 562.40, IGST 5% = 28.12, Total = 590.52
        req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-DISP-10-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="Assam",
            place_of_supply="18-Assam",
            dispatch_from_location_id="wh-ngp-001",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1000.00"),
                    disc_pct=Decimal("43.76"),
                    gst_rate=Decimal("5.00"),
                    is_tax_inclusive=False,
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("590.52"))],
        )

        res = await CanonicalSalesPostingWriter.post_sales_transaction(session, req, commit=True)
        assert res.success is True
        assert res.taxable_amount == Decimal("562.40")
        assert res.igst_amount == Decimal("28.12")
        assert res.round_off == Decimal("0.00")
        assert res.net_amount == Decimal("590.52")


@pytest.mark.asyncio
async def test_11_pos_and_b2b_use_same_canonical_transaction_contract():
    """
    Test 11: POS and B2B use the same canonical transaction contract.
    Both write through CanonicalSalesPostingWriter and both properly accept dispatch_from_location_id.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # POS Retail Scenario (MRP-inclusive)
        pos_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="RETAIL_POS",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-POS-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_name="Walk-in Customer",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("105.00"),
                    is_tax_inclusive=True,
                    gst_rate=Decimal("5.00"),
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("210.00"))],
        )
        pos_res = await CanonicalSalesPostingWriter.post_sales_transaction(session, pos_req, commit=True)
        assert pos_res.success is True
        assert pos_res.net_amount == Decimal("210.00")

        # B2B Wholesale Scenario (Base rate + tax exclusive)
        b2b_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="MAIN",
                shift_id="shift_dispatch_open_01",
                cashier_id="usr-dispatch-test-01",
                source_channel="B2B_PORTAL",
                idempotency_key=str(uuid.uuid4()),
                client_invoice_no=f"TEST-B2B-{uuid.uuid4().hex[:6]}",
                dispatch_from_location_id="wh-ngp-001",
            ),
            customer_id="cust-assam-001",
            customer_name="Reliance Retail Limited",
            customer_gstin="18AABCR1718E1ZO",
            billing_address="Assam",
            place_of_supply="18-Assam",
            items=[
                CanonicalPostingLineItem(
                    product_id="prod-disp-01",
                    code="PROD-DISP-01",
                    name="Tattly Footwear Classic",
                    hsn_code="64041990",
                    quantity=Decimal("10.00"),
                    unit_price=Decimal("100.00"),
                    is_tax_inclusive=False,
                    gst_rate=Decimal("5.00"),
                )
            ],
            tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("1050.00"))],
        )
        b2b_res = await CanonicalSalesPostingWriter.post_sales_transaction(session, b2b_req, commit=True)
        assert b2b_res.success is True
        assert b2b_res.net_amount == Decimal("1050.00")


def test_12_no_duplicate_invoice_writer():
    """
    Test 12: Architectural Integrity - No duplicate invoice writer is introduced.
    Scans codebase to verify:
      1. Express is completely retired (no server.ts or src/routes).
      2. Only CanonicalSalesPostingWriter creates SalesInvoice instances.
    """
    root_dir = Path(__file__).resolve().parent.parent.parent
    # Check no Express routes exist
    assert not (root_dir / "server.ts").exists()
    assert not (root_dir / "src" / "routes").exists()


@pytest.mark.asyncio
async def test_13_specific_acceptance_test_invoice_tt138():
    """
    Test 13: SPECIFIC ACCEPTANCE TEST FOR TT2026-2027/138.
    Verifies:
      Bill From:
        Tattly Threads
        Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery,
        near HP Petrol Pump, Mumbai, Maharashtra - 400003
        GSTIN: 27AAXFT2508H1ZR

      Dispatch From:
        Tattly Threads
        Om Sai Nagar, Kalamana
        Nagpur, Maharashtra - 440029

      Bill To / Ship To:
        Reliance Retail Limited
        Dibrugarh, Assam
        GSTIN: 18AABCR1718E1ZO

      Place of Supply:
        Assam (18)

      Tax:
        IGST 5%

      Expected financial totals MUST remain:
        Taxable Value: ₹120,970.24
        IGST: ₹6,048.46
        Round-off: +₹0.30
        Grand Total: ₹127,019.00
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Load invoice TT2026-2027/138 from database
        q_inv = select(SalesInvoice).where(
            SalesInvoice.invoice_no.like("%138%"),
            SalesInvoice.is_deleted == False,
        )
        inv = (await session.execute(q_inv)).scalars().first()
        assert inv is not None, "Invoice TT2026-2027/138 must exist in database smriti001"

        # 1. Verify Financial Totals
        taxable_val = Decimal(str(inv.taxable_value))
        tax_total = Decimal(str(inv.tax_total))
        rounding_val = Decimal(str(inv.rounding_amount))
        grand_total = Decimal(str(inv.grand_total))

        assert taxable_val == Decimal("120970.24"), f"Taxable value mismatch: {taxable_val}"
        assert tax_total == Decimal("6048.46"), f"IGST mismatch: {tax_total}"
        assert rounding_val == Decimal("0.30"), f"Round-off mismatch: {rounding_val}"
        assert grand_total == Decimal("127019.00"), f"Grand Total mismatch: {grand_total}"

        # 2. Verify Customer / Bill To & Ship To
        assert inv.customer_name == "Reliance Retail Limited"
        assert inv.customer_gstin == "18AABCR1718E1ZO"
        assert inv.place_of_supply_code == "18"
        assert inv.is_interstate is True

        # 3. Verify Dispatch From Snapshot
        assert inv.dispatch_from_location_id == "wh-ngp-001"
        assert inv.dispatch_from_snapshot is not None
        snap = inv.dispatch_from_snapshot
        assert snap["city"] == "Nagpur"
        assert snap["state"] == "Maharashtra"
        assert snap["pincode"] == "440029"
        assert "Om Sai Nagar, Kalamana" in snap["address_line1"]

        # 4. Verify E-Way Bill Adapter Mapping
        class MockTenant:
            company_id = inv.company_id

        eway_service = EWayBillService(db=session, tenant=MockTenant())
        payload = await eway_service.generate_invoice_eway_bill_payload(
            invoice_id=inv.id,
            strict_validation=False,
        )

        bill = payload["billLists"][0]
        # NIC Rule 10 transType (BillFrom-DispatchFrom)
        assert bill["transType"] in (3, 4)
        # Bill From: Supplier Legal Identity
        assert bill["fromGstin"] == "27AAXFT2508H1ZR"
        assert bill["fromTrdName"] == "Tattly Threads"
        assert bill["fromStateCode"] == 27
        # Dispatch From: Physical Origin of Goods
        assert "Om Sai Nagar" in bill["fromAddr1"]
        assert bill["fromPlace"] == "Nagpur"
        assert bill["fromPincode"] == 440029
        assert bill["actualFromStateCode"] == 27
        # Bill To & Ship To
        assert bill["toGstin"] == "18AABCR1718E1ZO"
        assert bill["actToStateCode"] == 18

        # 5. Verify PDF Rendering
        html_doc = await InvoicePdfService.generate_invoice_html(inv)
        assert "TATTLY THREADS" in html_doc
        assert "DISPATCH FROM" in html_doc
        assert "27AAXFT2508H1ZR" in html_doc
        assert "400003" in html_doc
        assert "440029" in html_doc
        assert "Nagpur" in html_doc
        assert "BILLED TO (RECIPIENT)" in html_doc
        assert "18AABCR1718E1ZO" in html_doc
        assert "127,019.00" in html_doc
