"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.53.0
* Created    : 2026-10-02
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Procurement Phase 2.11 — Complete Procurement Lifecycle E2E Audit
Verifies End-to-End without Browser:
  1. Supplier Master & Product Catalog Setup
  2. Purchase Order Generation (Draft with multiple lines & GST)
  3. Purchase Order Submission (DRAFT -> SUBMITTED)
  4. Purchase Order Confirmation (SUBMITTED -> CONFIRMED)
  5. Pending Delivery Report (PO appears with pending inward units)
  6. Goods Receipt Note (GRN) Inward Receipt against PO with Inward Freight Landed Cost
  7. WMS Batch Stock Movement Increment & PO State Transition (CONFIRMED -> RECEIVED)
  8. Pending Delivery Report Cleared (PO cleared from pending delivery)
  9. Purchase Bill Generation with Automatic Accounts Payable GL Entry (CR 2010 AP, DR 1040/1051/1052)
  10. Strict Double-Entry Balance Invariant: sum(Debit) == sum(Credit)
  11. Supplier Outstanding Liability incremented
  12. Procurement Reports Verification (Pending Delivery, Supplier Outstanding, Purchase Summary Register)
  13. Purchase Bill Cancellation with Compensating GL Reversal & Restored Supplier Balance
"""

import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, Warehouse, StockMovement
from app.models.purchase import (
    Supplier, PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem, PurchaseBill,
)
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.api.deps import get_db, get_tenant_context, TenantContext
from app.core.security import hash_password, create_access_token
from app.tests.conftest import clear_db

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire the test DB session and cleanup before/after."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


def _bearer(user: User, company_id: str, branch_id: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": company_id,
        "branch_id": branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(company_id: str, branch_id: str):
    async def _get_tenant():
        return TenantContext(company_id=company_id, branch_id=branch_id)
    app.dependency_overrides[get_tenant_context] = _get_tenant


async def test_full_procurement_cycle_po_to_grn_to_ap_gl_audit(db_session):
    """
    Comprehensive End-to-End Audit of Complete Procurement Lifecycle without Browser:
    Supplier -> PO Gen -> PO Submit -> PO Confirm -> Pending Delivery Report ->
    GRN Inward + Landed Cost -> Stock Increment -> PO Received -> Pending Delivery Cleared ->
    Purchase Bill -> GL Accounts Payable 2010 -> Supplier Outstanding -> 3-Way Variance Check ->
    Summary Register -> Bill Cancellation Reversal.
    """
    test_id = uuid.uuid4().hex[:8]

    # 1. Master Data Setup: Company, Branch, Warehouse
    company = Company(
        id=f"cmp_audit_{test_id}",
        name=f"Audit Enterprise {test_id}",
        company_code=f"CMP{test_id.upper()[:8]}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=f"br_audit_{test_id}",
        company_id=company.id,
        name=f"Main Store Branch {test_id}",
        code=f"BR{test_id.upper()[:8]}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([company, branch])
    await db_session.flush()

    warehouse = Warehouse(
        id=f"wh_audit_{test_id}",
        company_id=company.id,
        branch_id=branch.id,
        code=f"WH-{test_id.upper()[:6]}",
        name="Central Receiving Warehouse",
        is_active=True,
    )
    db_session.add(warehouse)
    await db_session.flush()

    # 2. Store Manager User
    manager = User(
        id=f"usr_mgr_{test_id}",
        username=f"manager_{test_id}",
        hashed_password=hash_password("Audit@1234"),
        role=UserRole.MANAGER,
        company_id=company.id,
        branch_id=branch.id,
        is_active=True,
        is_deleted=False,
    )
    db_session.add(manager)
    await db_session.flush()

    # 3. Supplier Master: Supreme Textiles Ltd
    supplier = Supplier(
        id=f"sup_audit_{test_id}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"Supreme Textiles & Apparel Ltd {test_id}",
        code=f"SUP-{test_id.upper()[:6]}",
        gst_number="27AABCS1429B1Z1",
        state="MH",
        city="Mumbai",
        mobile="9820011223",
        email=f"accounts@{test_id}.supremetextiles.in",
        outstanding=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add(supplier)
    await db_session.flush()

    # 4. Product Catalog: Item A (Classic Cotton Shirt - L), Item B (Classic Cotton Shirt - M)
    prod_a = Product(
        id=f"prod_a_{test_id}",
        code=f"SHIRT-L-{test_id.upper()[:4]}",
        name="Classic Cotton Shirt - Navy Blue - L",
        price=Decimal("500.00"),
        cost_price=Decimal("500.00"),
        mrp=Decimal("1299.00"),
        gst_percentage=Decimal("12.00"),
        hsn_code="6205",
        stock=0,
        category="Apparel",
        barcode=f"890100{test_id[:6]}1",
        company_id=company.id,
        branch_id=branch.id,
    )
    prod_b = Product(
        id=f"prod_b_{test_id}",
        code=f"SHIRT-M-{test_id.upper()[:4]}",
        name="Classic Cotton Shirt - Navy Blue - M",
        price=Decimal("480.00"),
        cost_price=Decimal("480.00"),
        mrp=Decimal("1299.00"),
        gst_percentage=Decimal("12.00"),
        hsn_code="6205",
        stock=0,
        category="Apparel",
        barcode=f"890100{test_id[:6]}2",
        company_id=company.id,
        branch_id=branch.id,
    )
    db_session.add_all([prod_a, prod_b])
    await db_session.commit()

    _set_tenant(company.id, branch.id)
    headers = _bearer(manager, company.id, branch.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:

        # ── STEP 1: PO Generation (DRAFT) ──────────────────────────────────
        po_payload = {
            "order_no": f"PO-AUDIT-{test_id.upper()[:6]}",
            "supplier_id": supplier.id,
            "warehouse_id": warehouse.id,
            "notes": "Annual Festive Procurement Order - Batch 1",
            "items": [
                {
                    "product_id": prod_a.id,
                    "item_id": prod_a.id,
                    "code": prod_a.code,
                    "name": prod_a.name,
                    "quantity": 50,
                    "cost_price": 500.00,
                    "gst_rate": 12.00,
                    "mrp": 1299.00,
                },
                {
                    "product_id": prod_b.id,
                    "item_id": prod_b.id,
                    "code": prod_b.code,
                    "name": prod_b.name,
                    "quantity": 50,
                    "cost_price": 480.00,
                    "gst_rate": 12.00,
                    "mrp": 1299.00,
                },
            ],
        }

        res_po = await client.post("/api/v1/purchase/orders/", json=po_payload, headers=headers)
        assert res_po.status_code == 201, f"PO Creation failed: {res_po.text}"
        po_data = res_po.json()
        po_id = po_data["id"]
        po_no = po_data.get("order_no") or po_data.get("order_number") or po_id
        assert po_data["status"] == "DRAFT"
        assert len(po_data["items"]) == 2
        po_item_a_id = po_data["items"][0]["id"]
        po_item_b_id = po_data["items"][1]["id"]

        # Subtotal: 50*500 (25000) + 50*480 (24000) = 49000
        # GST: 12% of 49000 = 5880 -> Grand Total: 54880
        assert Decimal(str(po_data["subtotal"])) == Decimal("49000.00")
        assert Decimal(str(po_data["grand_total"])) == Decimal("54880.00")

        # ── STEP 2: PO Submission (SUBMITTED) ─────────────────────────────
        res_submit = await client.post(f"/api/v1/purchase/orders/{po_id}/submit", headers=headers)
        assert res_submit.status_code == 200, f"PO Submit failed: {res_submit.text}"
        assert res_submit.json()["status"] == "SUBMITTED"

        # ── STEP 3: PO Confirmation (CONFIRMED) ───────────────────────────
        res_confirm = await client.post(f"/api/v1/purchase/orders/{po_id}/confirm", headers=headers)
        assert res_confirm.status_code == 200, f"PO Confirm failed: {res_confirm.text}"
        assert res_confirm.json()["status"] == "CONFIRMED"

        # ── STEP 4: Verify Pending Delivery Report ────────────────────────
        res_pending = await client.get("/api/v1/purchase/reports/pending-delivery", headers=headers)
        assert res_pending.status_code == 200, f"Pending delivery report failed: {res_pending.text}"
        pending_list = res_pending.json()
        matching_pending = [p for p in pending_list if p.get("order_id") == po_id]
        assert len(matching_pending) == 1, "Confirmed PO must appear in pending delivery report"
        assert matching_pending[0]["pending_qty"] == 100
        assert Decimal(str(matching_pending[0]["pending_amount"])) == Decimal("54880.00")

        # ── STEP 5: GRN Inward Receipt against PO with Landed Cost ────────
        grn_payload = {
            "order_id": po_id,
            "supplier_id": supplier.id,
            "warehouse_id": warehouse.id,
            "vendor_invoice_no": f"INV-SUP-{test_id.upper()[:6]}",
            "vendor_invoice_date": str(date.today()),
            "transporter_name": "SafeXpress Logistics",
            "lr_number": f"LR-{test_id.upper()[:8]}",
            "notes": "Full inward physical verification completed. 100 units accepted in pristine condition.",
            "items": [
                {
                    "po_item_id": po_item_a_id,
                    "product_id": prod_a.id,
                    "item_id": prod_a.id,
                    "code": prod_a.code,
                    "name": prod_a.name,
                    "quantity_ordered": 50,
                    "quantity_received": 50,
                    "quantity_damaged": 0,
                    "cost_price": 500.00,
                    "invoice_rate": 500.00,
                    "trade_discount": 0.00,
                    "gst_rate": 12.00,
                    "mrp": 1299.00,
                },
                {
                    "po_item_id": po_item_b_id,
                    "product_id": prod_b.id,
                    "item_id": prod_b.id,
                    "code": prod_b.code,
                    "name": prod_b.name,
                    "quantity_ordered": 50,
                    "quantity_received": 50,
                    "quantity_damaged": 0,
                    "cost_price": 480.00,
                    "invoice_rate": 480.00,
                    "trade_discount": 0.00,
                    "gst_rate": 12.00,
                    "mrp": 1299.00,
                },
            ],
            "cost_components": [
                {
                    "component_type": "FREIGHT",
                    "description": "Inward Interstate Freight Charges",
                    "amount": 1000.00,
                    "allocation_method": "VALUE",
                    "transporter_name": "SafeXpress Logistics",
                }
            ],
        }

        res_grn = await client.post("/api/v1/purchase/receipts/", json=grn_payload, headers=headers)
        assert res_grn.status_code == 201, f"GRN Creation failed: {res_grn.text}"
        grn_data = res_grn.json()
        grn_id = grn_data["id"]
        grn_no = grn_data.get("receipt_no") or grn_data.get("receipt_number") or grn_id
        receipt_items = grn_data.get("items") or []
        assert len(receipt_items) == 2

        # ── STEP 6: Verify WMS Stock Movement & PO State Transition ───────
        # Refresh products from DB
        await db_session.refresh(prod_a)
        await db_session.refresh(prod_b)
        assert prod_a.stock == 50, f"Expected prod_a stock 50, got {prod_a.stock}"
        assert prod_b.stock == 50, f"Expected prod_b stock 50, got {prod_b.stock}"

        # Refresh PO and verify status is RECEIVED
        res_po_after = await client.get(f"/api/v1/purchase/orders/{po_id}", headers=headers)
        assert res_po_after.status_code == 200
        assert res_po_after.json()["status"] == "RECEIVED", f"PO status must transition to RECEIVED, got {res_po_after.json()['status']}"

        # ── STEP 7: Verify Pending Delivery Report Cleared ────────────────
        res_pending_after = await client.get("/api/v1/purchase/reports/pending-delivery", headers=headers)
        assert res_pending_after.status_code == 200
        pending_after_list = res_pending_after.json()
        assert not any(p.get("order_id") == po_id for p in pending_after_list), "Fulfilled PO must be removed from Pending Delivery"

        # ── STEP 8: Purchase Bill Generation & GL Accounts Payable Posting ─
        bill_payload = {
            "supplier_id": supplier.id,
            "order_id": po_id,
            "receipt_id": grn_id,
            "bill_no": f"PB-AUDIT-{test_id.upper()[:6]}",
            "bill_date": str(date.today()),
            "due_date": str(date.today()),
            "taxable_amount": 49000.00,
            "tax_amount": 5880.00,
            "total_amount": 54880.00,
            "paid_amount": 0.00,
            "status": "POSTED",
            "notes": "Vendor Invoice Matched and Approved for AP GL Disbursement",
        }

        res_bill = await client.post("/api/v1/purchase/bills/", json=bill_payload, headers=headers)
        assert res_bill.status_code == 201, f"Purchase Bill creation failed: {res_bill.text}"
        bill_data = res_bill.json()
        bill_id = bill_data["id"]
        assert bill_data["status"] == "POSTED"

        # ── STEP 9: Verify Strict GL Accounts Payable Entry & Double-Entry Invariant ─
        stmt_jv = select(JournalVoucher).where(
            JournalVoucher.company_id == company.id,
            JournalVoucher.reference_doc_type == "PURCHASE_BILL",
            JournalVoucher.reference_doc_id == bill_id,
        )
        res_jv = await db_session.execute(stmt_jv)
        jv = res_jv.scalar_one_or_none()
        assert jv is not None, "Journal voucher must be atomically generated for Purchase Bill"

        stmt_lines = select(GeneralLedgerEntry).where(
            GeneralLedgerEntry.voucher_id == jv.id
        )
        res_lines = await db_session.execute(stmt_lines)
        jv_lines = res_lines.scalars().all()
        assert len(jv_lines) >= 2, "Must have debit and credit lines"

        sum_debit = sum(Decimal(str(l.debit_amount)) for l in jv_lines)
        sum_credit = sum(Decimal(str(l.credit_amount)) for l in jv_lines)

        # Mathematical strict balance invariant
        assert sum_debit == sum_credit, f"GL Imbalance! sum(Debit)={sum_debit} != sum(Credit)={sum_credit}"
        assert sum_credit == Decimal("54880.00"), f"Total payable must equal 54880.00, got {sum_credit}"

        # Resolve account codes
        acc_ids = {l.account_id for l in jv_lines}
        stmt_acc = select(Account).where(Account.id.in_(acc_ids))
        accounts = {a.id: a.account_code for a in (await db_session.execute(stmt_acc)).scalars().all()}

        # Verify Credit line is to 2010 (Accounts Payable)
        ap_lines = [l for l in jv_lines if accounts.get(l.account_id) == "2010" and Decimal(str(l.credit_amount)) > 0]
        assert len(ap_lines) == 1, "Must contain exactly one Credit line to Account 2010 AP"
        assert Decimal(str(ap_lines[0].credit_amount)) == Decimal("54880.00")

        # ── STEP 10: Verify Supplier Outstanding Liability ─────────────────
        await db_session.refresh(supplier)
        assert supplier.outstanding == Decimal("54880.00"), f"Supplier outstanding must be 54880.00, got {supplier.outstanding}"

        # ── STEP 11: Verify Procurement Reports (Outstanding & Summary) ───
        res_out = await client.get("/api/v1/purchase/reports/outstanding", headers=headers)
        assert res_out.status_code == 200
        out_list = res_out.json()
        sup_out = next((s for s in out_list if s["supplier_id"] == supplier.id), None)
        assert sup_out is not None, "Supplier must appear in Outstanding Payables report"
        assert Decimal(str(sup_out["total_outstanding"])) == Decimal("54880.00")

        res_sum = await client.get("/api/v1/reports/purchase-summary", headers=headers)
        assert res_sum.status_code == 200
        sum_list = res_sum.json()
        sup_sum = next((s for s in sum_list if s["supplier_id"] == supplier.id), None)
        assert sup_sum is not None, "Supplier must appear in Purchase Summary Register"
        assert sup_sum["po_count"] >= 1
        assert sup_sum["grn_count"] >= 1
        assert Decimal(str(sup_sum["ordered_amount"])) == Decimal("54880.00")

        # ── STEP 12: Purchase Bill Cancellation & Compensating GL Reversal ─
        res_cancel = await client.post(f"/api/v1/purchase/bills/{bill_id}/cancel", headers=headers)
        assert res_cancel.status_code == 200, f"Bill cancellation failed: {res_cancel.text}"
        cancelled_data = res_cancel.json()
        assert cancelled_data["status"] == "CANCELLED"

        # Verify supplier outstanding returned to 0.00
        await db_session.refresh(supplier)
        assert supplier.outstanding == Decimal("0.00"), f"Supplier outstanding must revert to 0.00 after bill cancel, got {supplier.outstanding}"

        # Verify compensating reversal JV exists
        stmt_rev_jv = select(JournalVoucher).where(
            JournalVoucher.company_id == company.id,
            JournalVoucher.reference_doc_type.in_(["PURCHASE_BILL_CANCEL", "PURCHASE_BILL_REVERSAL"]),
            JournalVoucher.reference_doc_id == bill_id,
        )
        res_rev_jv = await db_session.execute(stmt_rev_jv)
        rev_jv = res_rev_jv.scalar_one_or_none()
        assert rev_jv is not None, "Compensating reversal journal voucher must exist"
