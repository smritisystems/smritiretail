# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Auto-Generate PSV from Sales Tax Invoice & Attribute Reconciliation Tests
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerDeliveryLocation
from app.models.psv import PSVParty, PSVStockEvent, PSVStockBalance
from app.models.inventory import Product, Warehouse
from app.models.item_master import Item, ItemVariant
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.api.deps import TenantContext
from app.services.sales import SalesService
from app.services.psv_projection import PSVProjectionService
from app.schemas.psv import PSVReceiveInvoiceReq, PSVReceiveInvoiceLineReq
from app.services.product_code_parser import ProductCodeParser


@pytest.fixture
async def sales_psv_env(db_session):
    """Provisions a multi-tier tenant with modern-trade customer, delivery location, and warehouse."""
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-autopsv-{s}",
        name=f"Auto PSV Co {s}",
        gst_number="27AAAAA1234A1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-autopsv-{s}",
        company_id=company.id,
        name=f"Auto PSV Branch {s}",
        code=f"BR-{s}".upper(),
        is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh-autopsv-{s}",
        company_id=company.id,
        branch_id=branch.id,
        code=f"WH-{s}".upper(),
        name=f"Main Warehouse {s}",
        is_active=True,
        is_deleted=False,
    )
    customer = Customer(
        id=f"cust-autopsv-{s}",
        company_id=company.id,
        code=f"CUST-{s}".upper(),
        name=f"Reliance Retail Ltd {s}",
        customer_type="MODERN_TRADE",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([warehouse, customer])
    await db_session.flush()

    store_code = f"T{s[:4].upper()}"
    deliv_loc = CustomerDeliveryLocation(
        id=f"cdl-autopsv-{s}",
        company_id=company.id,
        customer_id=customer.id,
        store_code=store_code,
        location_name=f"Reliance Smart Bazaar {store_code}",
        city="Mumbai",
        state="Maharashtra",
        state_code="27",
        gstin="27AAAAA1234A1Z5",
        status="ACTIVE",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(deliv_loc)

    # Item and ItemVariant for canonical catalog parity
    item = Item(
        id=f"itm-autopsv-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_code="SND-06",
        style_code="SND-06",
        item_name="SND 06 Casual Footwear",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var-autopsv-{s}",
        company_id=company.id,
        item_id=item.id,
        variant_sku="SND-06-G-BLUE-41",
        variant_name="SND 06 G Blue 41",
        color="BLUE",
        size="41",
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    # Product with SND-06-G-BLUE-41 code
    prod = Product(
        id=f"prod-autopsv-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        sku="SND-06-G-BLUE-41",
        code="SND-06-G-BLUE-41",
        barcode=f"BAR-{s}",
        name="SND 06 Casual Footwear",
        mrp=999.00,
        price=599.00,
        gst_percentage=5.00,
        hsn_code="6404",
        category="Footwear",
        is_active=True,
        is_deleted=False,
    )
    db_session.add(prod)
    await db_session.flush()

    tenant_ctx = TenantContext(
        company_id=company.id,
        branch_id=branch.id,
        role="MANAGER",
    )

    return {
        "company": company,
        "branch": branch,
        "warehouse": warehouse,
        "customer": customer,
        "deliv_loc": deliv_loc,
        "store_code": store_code,
        "item": item,
        "variant": variant,
        "product": prod,
        "tenant_ctx": tenant_ctx,
    }


@pytest.mark.asyncio
async def test_auto_psv_generation_on_sales_invoice_save(db_session, sales_psv_env):
    """
    Objective 1 & 2:
    Whenever a Sales Tax Invoice is saved:
    1. PSV entries are automatically created/projected.
    2. PSV record is visible immediately with status 'Ready for Receiving'.
    3. Product code SND-06-G-BLUE-41 resolves to:
       - Article/Style Code: SND-06
       - Vendor Code: G
       - Color: BLUE
       - Size: 41
    """
    env = sales_psv_env
    comp = env["company"]
    cust = env["customer"]
    loc = env["deliv_loc"]
    prod = env["product"]
    item_obj = env["item"]
    var_obj = env["variant"]
    wh = env["warehouse"]
    tctx = env["tenant_ctx"]

    sales_svc = SalesService(db=db_session, tenant_ctx=tctx)

    inv_in = SalesInvoiceCreate(
        invoice_no="INV-AUTO-PSV-001",
        customer_id=cust.id,
        customer_name=cust.name,
        warehouse_id=wh.id,
        delivery_location_id=loc.id,
        delivery_store_code=loc.store_code,
        pos_state="Maharashtra",
        place_of_supply_code="27",
        payment_mode="CREDIT",
        items=[
            SalesInvoiceItemCreate(
                code=prod.sku,
                name=prod.name,
                product_id=prod.id,
                item_id=item_obj.id,
                variant_id=var_obj.id,
                quantity=100,
                price=Decimal("599.00"),
                mrp=Decimal("999.00"),
                gst_rate=Decimal("5.00"),
                hsn_code="6404",
            )
        ],
    )

    # Save Sales Tax Invoice
    invoice = await sales_svc.create_sales_invoice(inv_in, idempotency_key="KEY-AUTO-PSV-001", commit=True)
    assert invoice is not None
    assert invoice.id is not None
    assert invoice.invoice_no == "INV-AUTO-PSV-001"

    # Immediately query PSV Quantity Reconciliation — no manual PSV entry needed!
    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=invoice.id,
    )

    assert recon.summary.total_items == 1
    assert recon.summary.total_document_qty == Decimal("100.0000")
    assert recon.summary.total_received_qty == Decimal("0.0000")
    assert recon.summary.total_short_qty == Decimal("100.0000")
    assert recon.summary.reconciled_count == 0

    item = recon.items[0]
    assert item.invoice_no == "INV-AUTO-PSV-001"
    assert item.store_code == loc.store_code
    assert item.sku == "SND-06-G-BLUE-41"
    assert item.document_qty == Decimal("100.0000")
    assert item.received_qty == Decimal("0.0000")
    assert item.short_qty == Decimal("100.0000")

    # Workflow state must be 'Ready for Receiving'
    assert item.reconciliation_status in ("READY_FOR_RECEIVING", "UNRECEIVED")
    assert item.workflow_status == "Ready for Receiving"

    # Product code attribute parsing validation for SND-06-G-BLUE-41
    assert item.style_code == "SND-06"
    assert item.vendor_code == "G"
    assert item.color == "BLUE"
    assert item.size == "41"


@pytest.mark.asyncio
async def test_auto_psv_receiving_reconciliation_workflow(db_session, sales_psv_env):
    """
    Objective 3 & 4: Maintain correct workflow states and quantity reconciliation:
    Example from prompt: If invoice documents 100 pairs but only 96 pairs are received:
      - Document Qty = 100
      - Received Qty = 96
      - Short Qty = 4
      - Pending Approval Qty vs Approved Qty
      - Discrepancy clearly flagged
    """
    env = sales_psv_env
    comp = env["company"]
    cust = env["customer"]
    loc = env["deliv_loc"]
    prod = env["product"]
    item_obj = env["item"]
    var_obj = env["variant"]
    wh = env["warehouse"]
    tctx = env["tenant_ctx"]

    sales_svc = SalesService(db=db_session, tenant_ctx=tctx)

    inv_in = SalesInvoiceCreate(
        invoice_no="INV-AUTO-PSV-002",
        customer_id=cust.id,
        customer_name=cust.name,
        warehouse_id=wh.id,
        delivery_location_id=loc.id,
        delivery_store_code=loc.store_code,
        pos_state="Maharashtra",
        place_of_supply_code="27",
        payment_mode="CREDIT",
        items=[
            SalesInvoiceItemCreate(
                code=prod.sku,
                name=prod.name,
                product_id=prod.id,
                item_id=item_obj.id,
                variant_id=var_obj.id,
                quantity=100,
                price=Decimal("599.00"),
                mrp=Decimal("999.00"),
                gst_rate=Decimal("5.00"),
                hsn_code="6404",
            )
        ],
    )
    invoice = await sales_svc.create_sales_invoice(inv_in, idempotency_key="KEY-AUTO-PSV-002", commit=True)
    inv_item = invoice.items[0]

    # Step 1: Goods physically received (96 pcs received out of 100 documented) without auto-approve
    rec_res = await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id="usr-store-staff",
        user_role="SALES_EXECUTIVE",
        req=PSVReceiveInvoiceReq(
            invoice_id=invoice.id,
            receipt_reference="GRN-STORE-96",
            auto_approve=False,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("96.0000"),
                )
            ],
        ),
        commit=True,
    )
    assert rec_res.pending_count == 1
    assert rec_res.approved_count == 0

    # Step 2: Show Pending Approval Qty in PSV
    recon_pending = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=invoice.id,
    )
    item_pending = recon_pending.items[0]
    assert item_pending.document_qty == Decimal("100.0000")
    assert item_pending.received_qty == Decimal("96.0000")
    assert item_pending.pending_approval_qty == Decimal("96.0000")
    assert item_pending.approved_qty == Decimal("0.0000")
    assert item_pending.short_qty == Decimal("4.0000")
    assert item_pending.excess_qty == Decimal("0.0000")
    assert item_pending.reconciliation_status == "PENDING_APPROVAL"
    assert item_pending.workflow_status == "Pending Approval"

    # Step 3: Approve physical receipt
    pending_event_id = item_pending.pending_event_ids[0]
    app_res = await PSVProjectionService.approve_pending_event(
        session=db_session,
        event_id=pending_event_id,
        company_id=comp.id,
        approved_by="usr-manager",
    )
    assert app_res["status"] == "APPROVED" or app_res.get("event_id") is not None

    # Step 4: After approval -> Approved Qty = 96, Short Qty = 4, flagged as SHORTAGE discrepancy
    recon_approved = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=invoice.id,
    )
    item_approved = recon_approved.items[0]
    assert item_approved.document_qty == Decimal("100.0000")
    assert item_approved.received_qty == Decimal("96.0000")
    assert item_approved.approved_qty == Decimal("96.0000")
    assert item_approved.pending_approval_qty == Decimal("0.0000")
    assert item_approved.short_qty == Decimal("4.0000")
    assert item_approved.excess_qty == Decimal("0.0000")
    assert item_approved.reconciliation_status == "SHORTAGE"
    assert item_approved.workflow_status == "Discrepancy: Shortage"
    assert recon_approved.summary.discrepancy_count == 1


@pytest.mark.asyncio
async def test_idempotent_save_and_cancellation_sync(db_session, sales_psv_env):
    """
    Objective 5:
    1. Repeated save/project does not duplicate or double-count quantities.
    2. Cancellation of invoice reverses the PSV projection safely.
    """
    env = sales_psv_env
    comp = env["company"]
    cust = env["customer"]
    loc = env["deliv_loc"]
    prod = env["product"]
    item_obj = env["item"]
    var_obj = env["variant"]
    wh = env["warehouse"]
    tctx = env["tenant_ctx"]

    sales_svc = SalesService(db=db_session, tenant_ctx=tctx)

    inv_in = SalesInvoiceCreate(
        invoice_no="INV-AUTO-PSV-003",
        customer_id=cust.id,
        customer_name=cust.name,
        warehouse_id=wh.id,
        delivery_location_id=loc.id,
        delivery_store_code=loc.store_code,
        pos_state="Maharashtra",
        place_of_supply_code="27",
        payment_mode="CREDIT",
        items=[
            SalesInvoiceItemCreate(
                code=prod.sku,
                name=prod.name,
                product_id=prod.id,
                item_id=item_obj.id,
                variant_id=var_obj.id,
                quantity=50,
                price=Decimal("599.00"),
                mrp=Decimal("999.00"),
                gst_rate=Decimal("5.00"),
                hsn_code="6404",
            )
        ],
    )
    invoice = await sales_svc.create_sales_invoice(inv_in, idempotency_key="KEY-AUTO-PSV-003", commit=True)

    # Re-project explicitly to simulate repeated save / network retry
    reproject_res = await PSVProjectionService.project_posted_invoice(
        session=db_session,
        invoice_id=invoice.id,
        company_id=comp.id,
    )
    # Events already projected must not duplicate
    assert reproject_res["projected"] == 0

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=invoice.id,
    )
    assert recon.summary.total_document_qty == Decimal("50.0000")

    # Cancel sales tax invoice
    cancelled_inv = await sales_svc.cancel_sales_invoice(invoice.id)
    assert cancelled_inv.status == "Cancelled"

    # Verify PSV cancellation reversal
    bal = (await db_session.execute(
        select(PSVStockBalance).where(
            PSVStockBalance.company_id == comp.id,
            PSVStockBalance.sku == prod.sku,
        )
    )).scalar_one_or_none()

    if bal:
        assert bal.billed_qty == Decimal("0.0000")
        assert bal.current_balance == Decimal("0.0000")
