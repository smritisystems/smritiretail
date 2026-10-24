"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Test Suite   : PSV Sales Tax Invoice Quantity Reconciliation & Receiving Integration Tests
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerDeliveryLocation
from app.models.psv import PSVParty, PSVStockEvent, PSVStockBalance
from app.models.inventory import Product, Warehouse
from app.models.item_master import Item, ItemVariant
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.core.security import create_access_token, hash_password
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.services.psv_projection import PSVProjectionService
from app.schemas.psv import (
    PSVReceiveInvoiceReq,
    PSVReceiveInvoiceLineReq,
)


async def _setup_reconciliation_env(db_session):
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-recon-{s}",
        name=f"PSV Recon Co {s}",
        gst_number="27AAAAA1234A1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-recon-{s}",
        company_id=company.id,
        name=f"PSV Recon Branch {s}",
        code=f"BR-{s}".upper(),
        is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.flush()

    manager = User(
        id=f"mgr-recon-{s}",
        username=f"mgr_{s}",
        email=f"mgr_{s}@smriti.test",
        hashed_password=hash_password("P@ssword123"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    staff = User(
        id=f"stf-recon-{s}",
        username=f"stf_{s}",
        email=f"stf_{s}@smriti.test",
        hashed_password=hash_password("P@ssword123"),
        role=UserRole.SALES_EXECUTIVE,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    customer = Customer(
        id=f"cust-recon-{s}",
        company_id=company.id,
        code=f"CUST-{s}".upper(),
        name=f"Reliance Retail Ltd {s}",
        customer_type="MODERN_TRADE",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([manager, staff, customer])
    await db_session.flush()

    store_code = f"T{s[:4].upper()}"
    deliv_loc = CustomerDeliveryLocation(
        id=f"cdl-recon-{s}",
        company_id=company.id,
        customer_id=customer.id,
        store_code=store_code,
        location_name=f"Reliance Smart Bazaar {store_code}",
        city="Mumbai",
        state="Maharashtra",
        status="ACTIVE",
        is_deleted=False,
    )
    db_session.add(deliv_loc)
    await db_session.flush()

    # Create Product with canonical style_code, color, size
    item = Item(
        id=f"itm-recon-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_code=f"STYLE-{s}".upper(),
        style_code=f"ART-{s}".upper(),
        item_name="Tattly Classic Boot",
        category="Footwear",
        primary_uom="PRS",
        uom="PRS",
        is_active=True,
    )
    db_session.add(item)
    await db_session.flush()

    variant = ItemVariant(
        id=f"var-recon-{s}",
        company_id=company.id,
        item_id=item.id,
        variant_sku=f"SKU-BOOT-{s}-BLK-08".upper(),
        variant_name="Tattly Classic Boot Black 08",
        color="Black",
        size="08",
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd-recon-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        code=f"SKU-BOOT-{s}-BLK-08".upper(),
        sku=f"SKU-BOOT-{s}-BLK-08".upper(),
        barcode=f"BAR-BOOT-{s}".upper(),
        name="Tattly Classic Boot Black Size 8",
        style_code=f"ART-{s}".upper(),
        color="Black",
        size="08",
        mrp=Decimal("2499.00"),
        price=Decimal("1999.00"),
        category="Footwear",
        is_active=True,
    )
    db_session.add(prod)
    await db_session.flush()

    # Create PSV Party
    party_res = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=db_session,
        company_id=company.id,
        delivery_location_id=deliv_loc.id,
        customer_id=customer.id,
        branch_id=branch.id,
    )
    party_id = party_res["psv_party_id"]

    # Create Sales Tax Invoice
    invoice = SalesInvoice(
        id=f"inv-recon-{s}",
        company_id=company.id,
        branch_id=branch.id,
        invoice_no=f"TT2026-2027/{s.upper()}",
        date=date(2026, 10, 19),
        customer_id=customer.id,
        customer_name=customer.name,
        delivery_location_id=deliv_loc.id,
        delivery_store_code=deliv_loc.store_code,
        status="Posted",
        grand_total=Decimal("199900.00"),
    )
    db_session.add(invoice)
    await db_session.flush()

    inv_item = SalesInvoiceItem(
        invoice_id=invoice.id,
        product_id=prod.id,
        item_id=item.id,
        variant_id=variant.id,
        code=prod.code,
        name=prod.name,
        quantity=Decimal("100.0000"),
        price=Decimal("1999.00"),
        mrp=Decimal("2499.00"),
        total_amount=Decimal("199900.00"),
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add(inv_item)
    await db_session.commit()

    return {
        "company": company,
        "branch": branch,
        "manager": manager,
        "staff": staff,
        "customer": customer,
        "delivery_loc": deliv_loc,
        "item": item,
        "variant": variant,
        "prod": prod,
        "party_id": party_id,
        "invoice": invoice,
        "inv_item": inv_item,
    }


def _auth_header(user: User):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": user.company_id,
    }


@pytest.mark.asyncio
async def test_reconciliation_unreceived_invoice_projection(db_session):
    """
    Verify that posting an invoice projects Document Qty into PSV reconciliation
    with status UNRECEIVED, Short Qty = Document Qty, and Received Qty = 0.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    party_id = env["party_id"]

    # 1. Ensure invoice is projected
    proj_res = await PSVProjectionService.project_posted_invoice(
        session=db_session,
        invoice_id=inv.id,
        company_id=comp.id,
    )
    assert proj_res["status"] == "PROJECTED"
    assert proj_res["projected"] == 1
    await db_session.commit()

    # 2. Query reconciliation
    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    assert recon.summary.total_items == 1
    assert recon.summary.total_document_qty == Decimal("100.0000")
    assert recon.summary.total_received_qty == Decimal("0.0000")
    assert recon.summary.total_short_qty == Decimal("100.0000")
    assert recon.summary.total_excess_qty == Decimal("0.0000")
    assert recon.summary.reconciled_count == 0

    item = recon.items[0]
    assert item.invoice_no == inv.invoice_no
    assert item.party_id == party_id
    assert item.style_code == env["prod"].style_code
    assert item.color == "Black"
    assert item.size == "08"
    assert item.document_qty == Decimal("100.0000")
    assert item.received_qty == Decimal("0.0000")
    assert item.short_qty == Decimal("100.0000")
    assert item.reconciliation_status in ("READY_FOR_RECEIVING", "UNRECEIVED")
    assert item.workflow_status == "Ready for Receiving"


@pytest.mark.asyncio
async def test_reconciliation_exact_receipt_reconciled(db_session):
    """
    Verify receiving exact quantity (100 pcs) marked auto_approve by Manager
    reconciles item to RECONCILED with zero shortage and zero excess.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]

    # Record exact receipt
    rec_res = await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            receipt_reference="GRN-RELIANCE-001",
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("100.0000"),
                )
            ],
        ),
        commit=True,
    )
    assert rec_res.status == "RECORDED"
    assert rec_res.approved_count == 1
    assert rec_res.pending_count == 0

    # Query reconciliation
    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    assert recon.summary.total_items == 1
    assert recon.summary.reconciled_count == 1
    assert recon.summary.discrepancy_count == 0
    assert recon.summary.total_approved_qty == Decimal("100.0000")
    assert recon.summary.total_short_qty == Decimal("0.0000")

    item = recon.items[0]
    assert item.document_qty == Decimal("100.0000")
    assert item.received_qty == Decimal("100.0000")
    assert item.approved_qty == Decimal("100.0000")
    assert item.pending_approval_qty == Decimal("0.0000")
    assert item.short_qty == Decimal("0.0000")
    assert item.excess_qty == Decimal("0.0000")
    assert item.reconciliation_status == "RECONCILED"


@pytest.mark.asyncio
async def test_reconciliation_partial_receipt_shortage(db_session):
    """
    Verify partial physical receipt (60 pcs against 100 pcs invoiced)
    calculates Short Qty = 40 pcs and status = SHORTAGE.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]

    # Record 60 received
    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("60.0000"),
                )
            ],
        ),
        commit=True,
    )

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.document_qty == Decimal("100.0000")
    assert item.received_qty == Decimal("60.0000")
    assert item.approved_qty == Decimal("60.0000")
    assert item.short_qty == Decimal("40.0000")
    assert item.excess_qty == Decimal("0.0000")
    assert item.reconciliation_status == "SHORTAGE"
    assert recon.summary.discrepancy_count == 1


@pytest.mark.asyncio
async def test_reconciliation_excess_receipt(db_session):
    """
    Verify excess physical receipt (120 pcs against 100 pcs invoiced)
    calculates Excess Qty = 20 pcs, Short Qty = 0, and status = EXCESS.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]

    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("120.0000"),
                )
            ],
        ),
        commit=True,
    )

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.document_qty == Decimal("100.0000")
    assert item.received_qty == Decimal("120.0000")
    assert item.approved_qty == Decimal("120.0000")
    assert item.short_qty == Decimal("0.0000")
    assert item.excess_qty == Decimal("20.0000")
    assert item.reconciliation_status == "EXCESS"


@pytest.mark.asyncio
async def test_reconciliation_pending_approval_and_promotion(db_session):
    """
    Verify receiving recorded as PENDING approval:
    1. Keeps pending quantity visible in reconciliation.
    2. Does NOT increase live PSVStockBalance.received_qty.
    3. Promoting via PATCH /events/{event_id}/approve moves qty to approved and updates stock balance.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    stf = env["staff"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]
    party_id = env["party_id"]

    # 1. Staff records receiving without auto_approve -> defaults to PENDING
    rec_res = await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=stf.id,
        user_role="SALES_EXECUTIVE",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            auto_approve=False,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("50.0000"),
                )
            ],
        ),
        commit=True,
    )
    assert rec_res.pending_count == 1
    assert rec_res.approved_count == 0
    event_id = rec_res.event_ids[0]

    # Verify live stock balance received_qty is STILL 0 (unapproved goods do NOT inflate stock!)
    bal = (await db_session.execute(
        select(PSVStockBalance).where(
            PSVStockBalance.company_id == comp.id,
            PSVStockBalance.psv_party_id == party_id,
            PSVStockBalance.sku == env["prod"].code,
        )
    )).scalar_one_or_none()
    assert bal is not None
    assert bal.received_qty == Decimal("0.0000")

    # 2. Query reconciliation: shows pending_approval_qty = 50, approved_qty = 0, status = PENDING_APPROVAL
    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.pending_approval_qty == Decimal("50.0000")
    assert item.approved_qty == Decimal("0.0000")
    assert item.received_qty == Decimal("50.0000")
    assert item.reconciliation_status == "PENDING_APPROVAL"
    assert event_id in item.pending_event_ids

    # 3. Manager approves the event
    app_res = await PSVProjectionService.approve_pending_event(
        session=db_session,
        event_id=event_id,
        company_id=comp.id,
        approved_by=mgr.id,
    )
    await db_session.commit()

    # 4. Verify live balance received_qty now reflects 50 pcs
    await db_session.refresh(bal)
    assert bal.received_qty == Decimal("50.0000")

    # 5. Query reconciliation: pending is 0, approved is 50
    recon_after = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item_after = recon_after.items[0]
    assert item_after.pending_approval_qty == Decimal("0.0000")
    assert item_after.approved_qty == Decimal("50.0000")
    assert item_after.short_qty == Decimal("50.0000")
    assert item_after.reconciliation_status == "SHORTAGE"


@pytest.mark.asyncio
async def test_reconciliation_multiple_receipt_deliveries(db_session):
    """
    Verify multiple sequential deliveries against the same invoice line:
    Delivery 1: 40 units (Approved).
    Delivery 2: 30 units (Pending).
    Result: Approved = 40, Pending = 30, Received = 70, Short = 30, Status = PENDING_APPROVAL.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]

    # Delivery 1: 40 approved
    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            receipt_reference="DELIVERY-TRUCK-1",
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("40.0000"),
                )
            ],
        ),
        commit=True,
    )

    # Delivery 2: 30 pending
    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            receipt_reference="DELIVERY-TRUCK-2",
            auto_approve=False,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("30.0000"),
                )
            ],
        ),
        commit=True,
    )

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.events_count == 2
    assert item.approved_qty == Decimal("40.0000")
    assert item.pending_approval_qty == Decimal("30.0000")
    assert item.received_qty == Decimal("70.0000")
    assert item.short_qty == Decimal("30.0000")
    assert item.reconciliation_status == "PENDING_APPROVAL"


@pytest.mark.asyncio
async def test_reconciliation_rejections_tracking(db_session):
    """
    Verify physical receipt recording 90 received and 10 rejected during inspection.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    inv_item = env["inv_item"]

    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=str(inv_item.id),
                    received_qty=Decimal("90.0000"),
                    rejected_qty=Decimal("10.0000"),
                    rejection_reason="Damaged footwear soles in transit",
                )
            ],
        ),
        commit=True,
    )

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.received_qty == Decimal("90.0000")
    assert item.approved_qty == Decimal("90.0000")
    assert item.rejected_qty == Decimal("10.0000")
    assert item.short_qty == Decimal("10.0000")


@pytest.mark.asyncio
async def test_reconciliation_variant_matching(db_session):
    """
    Verify matching can occur by Article/Style + Color + Size when invoice_line_id is omitted.
    """
    env = await _setup_reconciliation_env(db_session)
    comp = env["company"]
    mgr = env["manager"]
    inv = env["invoice"]
    prod = env["prod"]

    await PSVProjectionService.record_invoice_receipt(
        session=db_session,
        company_id=comp.id,
        user_id=mgr.id,
        user_role="MANAGER",
        req=PSVReceiveInvoiceReq(
            invoice_id=inv.id,
            auto_approve=True,
            items=[
                PSVReceiveInvoiceLineReq(
                    invoice_line_id=None,
                    style_code=prod.style_code,
                    color="Black",
                    size="08",
                    received_qty=Decimal("100.0000"),
                )
            ],
        ),
        commit=True,
    )

    recon = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=comp.id,
        invoice_id=inv.id,
    )
    item = recon.items[0]
    assert item.received_qty == Decimal("100.0000")
    assert item.reconciliation_status == "RECONCILED"


@pytest.mark.asyncio
async def test_reconciliation_multi_tenant_isolation(db_session):
    """
    Verify multi-tenant isolation: Company A cannot view or manipulate Company B's reconciliation records.
    """
    env_a = await _setup_reconciliation_env(db_session)
    env_b = await _setup_reconciliation_env(db_session)

    # Company A reconciliation should only return Company A's items
    recon_a = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=env_a["company"].id,
    )
    for itm in recon_a.items:
        assert itm.invoice_id == env_a["invoice"].id
        assert itm.invoice_id != env_b["invoice"].id

    # Trying to record receipt against Company B's invoice using Company A context fails with 404
    with pytest.raises(Exception) as exc_info:
        await PSVProjectionService.record_invoice_receipt(
            session=db_session,
            company_id=env_a["company"].id,
            user_id=env_a["manager"].id,
            user_role="MANAGER",
            req=PSVReceiveInvoiceReq(
                invoice_id=env_b["invoice"].id,
                items=[PSVReceiveInvoiceLineReq(received_qty=Decimal("10.0000"))],
            ),
        )
    assert "404" in str(exc_info.value)
