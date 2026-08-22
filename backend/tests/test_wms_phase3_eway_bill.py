"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from datetime import datetime, date, timedelta
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.api.deps import TenantContext
from app.models.inventory import Warehouse, ProductBatchStock, StockTransfer, StockTransferItem, Product
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.crm import Customer
from app.models.tenant import Company
from app.services.eway_bill_service import EWayBillService


TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"


@pytest.fixture
async def async_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.fixture
def tenant_ctx():
    return TenantContext(
        company_id="COMP-001",
        branch_id="BR-001"
    )


@pytest.mark.asyncio
async def test_transfer_eway_bill_and_delivery_challan_generation(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test generating NIC GST E-Way Bill JSON payload and Rule 55 Delivery Challan
    for an Inter-Godown Stock Transfer Order.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-eway-{unique_suffix}"
    transfer_id = f"st-eway-{unique_suffix}"
    transfer_no = f"STO-EWAY-{unique_suffix.upper()}"

    try:
        # 1. Insert product
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"E-Way Test Appliance {unique_suffix}",
            code=f"EWAY-{unique_suffix.upper()}",
            sku=f"SKU-EWAY-{unique_suffix.upper()}",
            category="Appliances",
            barcode=f"BAR-{unique_suffix.upper()}",
            stock=100,
            hsn_code="8415",
            cost_price=5000.0,
            price=7500.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        # 2. Insert Stock Transfer
        transfer = StockTransfer(
            id=transfer_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_no=transfer_no,
            source_warehouse_id="wh-central-001",
            dest_warehouse_id="wh-shop-001",
            status="DRAFT",
            transporter_name="VRL Logistics Ltd",
            vehicle_number="MH-04-AB-1234",
            lr_number=f"LR-{unique_suffix.upper()}",
            notes="High value inter-godown transit"
        )
        async_db.add(transfer)

        # 3. Add Item
        item = StockTransferItem(
            id=f"sti-eway-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_id=transfer_id,
            product_id=prod_id,
            batch_no=f"BATCH-EWAY-{unique_suffix.upper()}",
            quantity_dispatched=10.0,
            unit_cost=5000.0
        )
        async_db.add(item)
        await async_db.commit()

        # 4. Generate E-Way Bill Payload
        service = EWayBillService(async_db, tenant_ctx)
        eway_payload = await service.generate_transfer_eway_bill_payload(
            transfer_id=transfer_id,
            trans_distance_km=120,
            trans_mode="1",
            strict_validation=False
        )

        assert eway_payload["version"] == "1.0.0"
        bill = eway_payload["billLists"][0]
        assert bill["docType"] == "CHL" # Delivery Challan
        assert bill["subSupplyType"] == "8" # Others
        assert bill["docNo"] == transfer_no
        assert bill["transDistance"] == 120
        assert bill["transporterName"] == "VRL Logistics Ltd"
        assert bill["vehicleNo"] == "MH-04-AB-1234"
        assert bill["totalValue"] == 50000.0
        assert len(bill["itemList"]) == 1
        assert bill["itemList"][0]["hsnCode"] == 8415
        assert bill["itemList"][0]["quantity"] == 10.0
        assert bill["itemList"][0]["taxableAmount"] == 50000.0

        # 5. Generate Rule 55 Delivery Challan
        challan = await service.generate_delivery_challan(transfer_id)
        assert challan["challan_title"] == "DELIVERY CHALLAN"
        assert "Rule 55" in challan["statutory_subtitle"]
        assert challan["transfer_no"] == transfer_no
        assert challan["transport"]["transporter_name"] == "VRL Logistics Ltd"
        assert challan["transport"]["vehicle_number"] == "MH-04-AB-1234"
        assert challan["summary"]["total_quantity"] == 10.0
        assert challan["summary"]["total_value"] == 50000.0

    finally:
        await async_db.execute(text("DELETE FROM stock_transfer_items WHERE transfer_id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM stock_transfers WHERE id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_sales_invoice_eway_bill_generation(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test generating NIC GST E-Way Bill JSON payload for a B2B Sales Invoice exceeding threshold.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-b2b-{unique_suffix}"
    inv_id = f"inv-b2b-{unique_suffix}"
    inv_no = f"INV-B2B-{unique_suffix.upper()}"
    custom_customer_created = False
    cust_id = None

    try:
        # 1. Product
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Commercial Machinery {unique_suffix}",
            code=f"MACH-{unique_suffix.upper()}",
            sku=f"SKU-MACH-{unique_suffix.upper()}",
            category="Machinery",
            barcode=f"BAR-M-{unique_suffix.upper()}",
            stock=50,
            hsn_code="8479",
            cost_price=40000.0,
            price=60000.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        # 1.5 Get or create valid Customer
        res_cust = await async_db.execute(
            select(Customer).where(Customer.company_id == tenant_ctx.company_id, Customer.is_deleted == False).limit(1)
        )
        customer = res_cust.scalars().first()
        if not customer:
            cust_id = f"cust-test-{unique_suffix}"
            customer = Customer(
                id=cust_id,
                uuid=str(uuid.uuid4()),
                company_id=tenant_ctx.company_id,
                branch_id=tenant_ctx.branch_id,
                name="Apex Retail Distributors",
                phone="9876543210",
                gstin="27AABCU9603R1ZM",
                address="Commercial Complex, Sector 17",
                city="Mumbai"
            )
            async_db.add(customer)
            await async_db.flush()
            custom_customer_created = True

        # 2. B2B Sales Invoice
        invoice = SalesInvoice(
            id=inv_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            invoice_no=inv_no,
            customer_id=customer.id,
            warehouse_id="wh-central-001",
            payment_mode="BANK_TRANSFER",
            status="PAID",
            taxable_value=60000.0,
            tax_total=10800.0,
            grand_total=70800.0
        )
        async_db.add(invoice)

        # 3. Item
        inv_item = SalesInvoiceItem(
            invoice_id=inv_id,
            product_id=prod_id,
            code=f"MACH-{unique_suffix.upper()}",
            batch_no=f"BATCH-MACH-{unique_suffix.upper()}",
            name=f"Commercial Machinery {unique_suffix}",
            quantity=1.0,
            price=60000.0,
            taxable_value=60000.0,
            gst_rate=18.0,
            cgst_amount=5400.0,
            sgst_amount=5400.0,
            igst_amount=0.0,
            tax_amount=10800.0,
            total_amount=70800.0
        )
        async_db.add(inv_item)
        await async_db.commit()

        # 4. Generate Invoice E-Way Bill
        service = EWayBillService(async_db, tenant_ctx)
        eway_payload = await service.generate_invoice_eway_bill_payload(
            invoice_id=inv_id,
            transporter_name="Safexpress Logistics",
            vehicle_no="MH-12-PQ-9999",
            lr_number=f"SAFE-LR-{unique_suffix.upper()}",
            trans_distance_km=250,
            strict_validation=False
        )

        bill = eway_payload["billLists"][0]
        assert bill["docType"] == "INV" # Tax Invoice
        assert bill["subSupplyType"] == "1" # Supply
        assert bill["docNo"] == inv_no
        assert bill["transDistance"] == 250
        assert bill["transporterName"] == "Safexpress Logistics"
        assert bill["vehicleNo"] == "MH-12-PQ-9999"
        assert bill["totalValue"] == 60000.0
        assert bill["cgstValue"] == 5400.0
        assert bill["sgstValue"] == 5400.0
        assert bill["totInvValue"] == 70800.0
        assert len(bill["itemList"]) == 1
        assert bill["itemList"][0]["hsnCode"] == 8479
        assert bill["itemList"][0]["quantity"] == 1.0

    finally:
        await async_db.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :iid"), {"iid": inv_id})
        await async_db.execute(text("DELETE FROM sales_invoices WHERE id = :iid"), {"iid": inv_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        if custom_customer_created and cust_id:
            await async_db.execute(text("DELETE FROM customers WHERE id = :cid"), {"cid": cust_id})
        await async_db.commit()


@pytest.mark.asyncio
async def test_strict_statutory_validation_rejections(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Test that strict_validation=True properly rejects:
    1. Products without valid HSN code (raises HTTP 422 SMRITI-STAT-002)
    2. Road transport transfers without vehicle numbers (raises HTTP 422 SMRITI-STAT-004)
    """
    from fastapi import HTTPException
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-nohsn-{unique_suffix}"
    transfer_id = f"st-strict-{unique_suffix}"
    transfer_no = f"STO-STRICT-{unique_suffix.upper()}"

    try:
        # 1. Insert product WITHOUT HSN code
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"No-HSN Item {unique_suffix}",
            code=f"NOHSN-{unique_suffix.upper()}",
            sku=f"SKU-NOHSN-{unique_suffix.upper()}",
            category="Appliances",
            barcode=f"BAR-{unique_suffix.upper()}",
            stock=10,
            hsn_code=None, # Missing HSN
            cost_price=1000.0,
            price=1500.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        # 2. Insert Stock Transfer without vehicle number
        transfer = StockTransfer(
            id=transfer_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_no=transfer_no,
            source_warehouse_id="wh-central-001",
            dest_warehouse_id="wh-shop-001",
            status="DRAFT",
            transporter_name=None,
            vehicle_number=None, # Missing Vehicle Number
            lr_number=None,
        )
        async_db.add(transfer)

        # 3. Add Item
        item = StockTransferItem(
            id=f"sti-strict-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_id=transfer_id,
            product_id=prod_id,
            batch_no=f"BATCH-STRICT-{unique_suffix.upper()}",
            quantity_dispatched=5.0,
            unit_cost=1000.0
        )
        async_db.add(item)
        await async_db.commit()

        service = EWayBillService(async_db, tenant_ctx)

        # Case A: Strict mode on missing vehicle number -> HTTPException 422
        with pytest.raises(HTTPException) as exc_vehicle:
            await service.generate_transfer_eway_bill_payload(
                transfer_id=transfer_id,
                trans_mode="1",
                strict_validation=True
            )
        assert exc_vehicle.value.status_code == 422
        assert "SMRITI-STAT-004" in exc_vehicle.value.detail

        # Now fix vehicle number and assert missing HSN is rejected on E-Way payload
        transfer.vehicle_number = "MH-04-AB-9999"
        await async_db.commit()

        with pytest.raises(HTTPException) as exc_hsn:
            await service.generate_transfer_eway_bill_payload(
                transfer_id=transfer_id,
                trans_mode="1",
                strict_validation=True
            )
        assert exc_hsn.value.status_code == 422
        assert "SMRITI-STAT-002" in exc_hsn.value.detail

        # Case B: Delivery Challan in strict mode also rejects missing HSN
        with pytest.raises(HTTPException) as exc_dc_hsn:
            await service.generate_delivery_challan(
                transfer_id=transfer_id,
                strict_validation=True
            )
        assert exc_dc_hsn.value.status_code == 422
        assert "SMRITI-STAT-002" in exc_dc_hsn.value.detail

    finally:
        await async_db.execute(text("DELETE FROM stock_transfer_items WHERE transfer_id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM stock_transfers WHERE id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()


def test_gstin_checksum_algorithm_precision():
    """
    Verify statutory GSTN Luhn Mod 36 checksum calculation across valid and invalid GSTINs.
    """
    from app.services.eway_bill_service import compute_gstin_checksum, is_valid_gstin_checksum

    # Valid Indian statutory GSTINs
    assert is_valid_gstin_checksum("27AAXFT2508H1ZR") is True
    assert is_valid_gstin_checksum("27AAACT2727Q1ZW") is True
    assert is_valid_gstin_checksum("27AABCU9603R1ZN") is True
    assert is_valid_gstin_checksum("07AAAAA0000A1Z4") is True
    assert is_valid_gstin_checksum("29AAAAA0000A1ZY") is True
    assert is_valid_gstin_checksum("33AAAAA0000A1Z9") is True

    # Mutated check digits must return False
    assert is_valid_gstin_checksum("27AAXFT2508H1ZX") is False
    assert is_valid_gstin_checksum("27AAACT2727Q1ZX") is False
    assert is_valid_gstin_checksum("27AABCU9603R1ZM") is False

    # Checksum computation directly
    assert compute_gstin_checksum("27AAXFT2508H1Z") == "R"
    assert compute_gstin_checksum("27AAACT2727Q1Z") == "W"


@pytest.mark.asyncio
async def test_strict_statutory_mode_config_toggle(async_db: AsyncSession, tenant_ctx: TenantContext):
    """
    Verify that settings.STRICT_STATUTORY_MODE controls default strict validation behavior.
    """
    from app.core.config import settings
    from fastapi import HTTPException
    unique_suffix = uuid.uuid4().hex[:8]
    prod_id = f"prod-cfg-{unique_suffix}"
    transfer_id = f"st-cfg-{unique_suffix}"
    transfer_no = f"STO-CFG-{unique_suffix.upper()}"

    original_mode = settings.STRICT_STATUTORY_MODE
    try:
        # Insert product without HSN
        product = Product(
            id=prod_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            name=f"Config Test Item {unique_suffix}",
            code=f"CFG-{unique_suffix.upper()}",
            sku=f"SKU-CFG-{unique_suffix.upper()}",
            category="Appliances",
            barcode=f"BAR-CFG-{unique_suffix.upper()}",
            stock=10,
            hsn_code=None,
            cost_price=1000.0,
            price=1500.0,
            gst_percentage=18.0
        )
        async_db.add(product)

        transfer = StockTransfer(
            id=transfer_id,
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_no=transfer_no,
            source_warehouse_id="wh-central-001",
            dest_warehouse_id="wh-shop-001",
            status="DRAFT",
            vehicle_number="MH-04-TR-1000"
        )
        async_db.add(transfer)

        item = StockTransferItem(
            id=f"sti-cfg-{unique_suffix}",
            uuid=str(uuid.uuid4()),
            company_id=tenant_ctx.company_id,
            branch_id=tenant_ctx.branch_id,
            transfer_id=transfer_id,
            product_id=prod_id,
            batch_no=f"BATCH-CFG-{unique_suffix.upper()}",
            quantity_dispatched=2.0,
            unit_cost=1000.0
        )
        async_db.add(item)
        await async_db.commit()

        service = EWayBillService(async_db, tenant_ctx)

        # 1. When STRICT_STATUTORY_MODE is False -> passes with warnings if strict_validation=False/None
        settings.STRICT_STATUTORY_MODE = False
        payload_loose = await service.generate_transfer_eway_bill_payload(transfer_id=transfer_id)
        assert payload_loose["compliance"]["status"] == "WITH_WARNINGS"

        # 1b. When STRICT_STATUTORY_MODE is False but strict_validation=True -> opt-in strict rejection
        with pytest.raises(HTTPException) as exc_optin:
            await service.generate_transfer_eway_bill_payload(transfer_id=transfer_id, strict_validation=True)
        assert exc_optin.value.status_code == 422

        # 2. When STRICT_STATUTORY_MODE is True -> raises HTTPException 422 even if strict_validation=False
        settings.STRICT_STATUTORY_MODE = True
        with pytest.raises(HTTPException) as exc_info:
            await service.generate_transfer_eway_bill_payload(transfer_id=transfer_id)
        assert exc_info.value.status_code == 422
        assert "SMRITI-STAT-002" in exc_info.value.detail

        with pytest.raises(HTTPException) as exc_override:
            # Client passing strict_validation=False in production cannot bypass statutory rules
            await service.generate_transfer_eway_bill_payload(transfer_id=transfer_id, strict_validation=False)
        assert exc_override.value.status_code == 422
        assert "SMRITI-STAT-002" in exc_override.value.detail

    finally:
        settings.STRICT_STATUTORY_MODE = original_mode
        await async_db.execute(text("DELETE FROM stock_transfer_items WHERE transfer_id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM stock_transfers WHERE id = :tid"), {"tid": transfer_id})
        await async_db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id})
        await async_db.commit()



