"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.49.5
* Created    : 2026-07-11
* Modified   : 2026-10-02
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import json
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.supplier_payment import SupplierPayment
from ..models.purchase import Supplier, PurchaseBill
from ..api.deps import TenantContext
from ..schemas.supplier_payment import SupplierPaymentCreate
from .unified_ledger import UnifiedAccountingLedgerService
from .outbox_service import OutboxService


class SupplierPaymentService:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    @staticmethod
    def _extract_allocations(notes: Optional[str]) -> List[Dict[str, Any]]:
        """Extracts JSON allocation manifest embedded in payment notes."""
        if not notes or "__ALLOCATIONS__:" not in notes:
            return []
        try:
            part = notes.split("__ALLOCATIONS__:", 1)[1].strip()
            if "\n" in part:
                part = part.split("\n", 1)[0]
            if " [CANCELLED:" in part:
                part = part.split(" [CANCELLED:", 1)[0]
            return json.loads(part)
        except Exception:
            return []

    async def _get_supplier(self, supplier_id: str) -> Supplier:
        res = await self.db.execute(
            select(Supplier).where(
                Supplier.id         == supplier_id,
                Supplier.company_id == self.tenant.company_id,
                or_(
                    Supplier.branch_id == self.tenant.branch_id,
                    Supplier.branch_id.is_(None),
                ),
                Supplier.is_deleted == False,
            )
        )
        s = res.scalars().first()
        if not s:
            raise HTTPException(status_code=404, detail="Supplier not found.")
        return s

    async def record_payment(
        self,
        req: SupplierPaymentCreate,
        created_by: Optional[str] = None,
    ) -> SupplierPayment:
        """
        Record a payment to a supplier, knock off open purchase bills, decrement
        supplier.outstanding atomically, and post double-entry GL vouchers.

        Rules:
        1. Supplier must exist in this tenant.
        2. amount > 0 (enforced by schema validator).
        3. amount must not exceed supplier.outstanding (overpayment guard).
        4. Purchase bills allocated must belong to the supplier and tenant.
        5. Double-entry GL voucher (SUPPLIER_PAYMENT) is generated atomically:
           DR 2010 (Accounts Payable / Creditor)
           CR 1010 (Cash in Hand) or 1020 (Bank Accounts)
        """
        supplier = await self._get_supplier(req.supplier_id)

        outstanding = Decimal(str(supplier.outstanding or "0.00"))
        if req.amount > outstanding:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Payment amount ₹{req.amount:,.2f} exceeds supplier outstanding "
                    f"balance of ₹{outstanding:,.2f}. "
                    "Please enter an amount equal to or less than the outstanding balance."
                ),
            )

        allocated_manifest: List[Dict[str, Any]] = []

        # Resolution Strategy 1: Explicit single bill knock-off (bill_id)
        if req.bill_id:
            bill_stmt = select(PurchaseBill).where(
                PurchaseBill.id == req.bill_id,
                PurchaseBill.supplier_id == req.supplier_id,
                PurchaseBill.company_id == self.tenant.company_id,
                PurchaseBill.is_deleted == False,
            )
            bill = (await self.db.execute(bill_stmt)).scalar_one_or_none()
            if not bill:
                raise HTTPException(
                    status_code=404,
                    detail=f"Purchase bill {req.bill_id} not found for this supplier.",
                )
            if bill.status in ("CANCELLED", "DRAFT"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot allocate payment to a purchase bill in {bill.status} status.",
                )

            unpaid = max(
                Decimal("0.00"),
                Decimal(str(bill.total_amount or 0)) - Decimal(str(bill.paid_amount or 0)),
            )
            if unpaid <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Purchase bill {bill.bill_no or bill.id} is already fully paid.",
                )

            alloc_amt = min(req.amount, unpaid).quantize(Decimal("0.01"))
            bill.paid_amount = (Decimal(str(bill.paid_amount or 0)) + alloc_amt).quantize(Decimal("0.01"))
            if bill.paid_amount >= Decimal(str(bill.total_amount or 0)):
                bill.status = "PAID"
            bill.modified_at = datetime.now(timezone.utc)
            allocated_manifest.append({
                "bill_id": bill.id,
                "bill_no": bill.bill_no,
                "amount": str(alloc_amt),
            })

        # Resolution Strategy 2: Explicit multi-bill allocations
        elif req.allocations:
            alloc_sum = sum(a.amount for a in req.allocations)
            if alloc_sum > req.amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Total allocation amount ₹{alloc_sum} exceeds payment amount ₹{req.amount}.",
                )

            for alloc in req.allocations:
                bill_stmt = select(PurchaseBill).where(
                    PurchaseBill.id == alloc.bill_id,
                    PurchaseBill.supplier_id == req.supplier_id,
                    PurchaseBill.company_id == self.tenant.company_id,
                    PurchaseBill.is_deleted == False,
                )
                bill = (await self.db.execute(bill_stmt)).scalar_one_or_none()
                if not bill:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Purchase bill {alloc.bill_id} not found for this supplier.",
                    )
                if bill.status in ("CANCELLED", "DRAFT"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot allocate payment to purchase bill {bill.bill_no or bill.id} in {bill.status} status.",
                    )

                unpaid = max(
                    Decimal("0.00"),
                    Decimal(str(bill.total_amount or 0)) - Decimal(str(bill.paid_amount or 0)),
                )
                if alloc.amount > unpaid:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Allocation amount ₹{alloc.amount} exceeds unpaid balance "
                            f"₹{unpaid} for bill {bill.bill_no or bill.id}."
                        ),
                    )

                bill.paid_amount = (Decimal(str(bill.paid_amount or 0)) + alloc.amount).quantize(Decimal("0.01"))
                if bill.paid_amount >= Decimal(str(bill.total_amount or 0)):
                    bill.status = "PAID"
                bill.modified_at = datetime.now(timezone.utc)
                allocated_manifest.append({
                    "bill_id": bill.id,
                    "bill_no": bill.bill_no,
                    "amount": str(alloc.amount),
                })

        # Resolution Strategy 3: Automatic FIFO knock-off across open POSTED bills
        elif req.auto_allocate:
            bill_stmt = (
                select(PurchaseBill)
                .where(
                    PurchaseBill.supplier_id == req.supplier_id,
                    PurchaseBill.company_id == self.tenant.company_id,
                    PurchaseBill.is_deleted == False,
                    PurchaseBill.status == "POSTED",
                    PurchaseBill.paid_amount < PurchaseBill.total_amount,
                )
                .order_by(
                    PurchaseBill.bill_date.asc().nullslast(),
                    PurchaseBill.created_at.asc(),
                )
            )
            open_bills = (await self.db.execute(bill_stmt)).scalars().all()
            remaining_payment = req.amount
            for bill in open_bills:
                if remaining_payment <= Decimal("0.00"):
                    break
                unpaid = max(
                    Decimal("0.00"),
                    Decimal(str(bill.total_amount or 0)) - Decimal(str(bill.paid_amount or 0)),
                )
                if unpaid <= Decimal("0.00"):
                    continue
                alloc_amt = min(remaining_payment, unpaid).quantize(Decimal("0.01"))
                bill.paid_amount = (Decimal(str(bill.paid_amount or 0)) + alloc_amt).quantize(Decimal("0.01"))
                if bill.paid_amount >= Decimal(str(bill.total_amount or 0)):
                    bill.status = "PAID"
                bill.modified_at = datetime.now(timezone.utc)
                allocated_manifest.append({
                    "bill_id": bill.id,
                    "bill_no": bill.bill_no,
                    "amount": str(alloc_amt),
                })
                remaining_payment -= alloc_amt

        # Format notes with structured allocation manifest
        final_notes = req.notes or ""
        if allocated_manifest:
            manifest_tag = f"__ALLOCATIONS__:{json.dumps(allocated_manifest)}"
            final_notes = f"{final_notes}\n{manifest_tag}".strip()

        payment = SupplierPayment(
            id=req.id,
            supplier_id=req.supplier_id,
            amount=req.amount,
            payment_mode=req.payment_mode,
            payment_date=req.payment_date,
            reference_no=req.reference_no,
            notes=final_notes if final_notes else None,
            is_active=True,
            is_deleted=False,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            created_by=created_by,
        )
        self.db.add(payment)

        # Atomically decrement outstanding
        supplier.outstanding = (outstanding - req.amount).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        # Flush session so payment & bill updates are visible to GL service in active txn
        await self.db.flush()

        # Post authoritative double-entry general ledger voucher
        voucher = await UnifiedAccountingLedgerService.post_supplier_payment_to_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            payment_id=payment.id,
            branch_id=self.tenant.branch_id,
            created_by=created_by,
        )

        # Record Transactional Outbox event atomically within same DB transaction
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "SUPPLIER_PAYMENT_PROCESSED",
                "payment_id": payment.id,
                "supplier_id": payment.supplier_id,
                "amount": str(payment.amount),
                "company_code": self.tenant.company_id,
                "voucher_id": voucher.id if voucher else None,
                "allocations": allocated_manifest,
            },
            causation_id=payment.id,
        )

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A payment with this ID already exists.",
            )
        await self.db.refresh(payment)

        # Attach dynamic attributes for response schema
        payment.allocated_bills = allocated_manifest
        payment.journal_voucher_id = voucher.id if voucher else None
        return payment

    async def cancel_payment(
        self,
        payment_id: str,
        reason: Optional[str] = None,
        cancelled_by: Optional[str] = None,
    ) -> SupplierPayment:
        """
        Cancels/voids a supplier payment:
        1. Posts compensating reversal GL voucher (DR 1010/1020 / CR 2010).
        2. Re-instates supplier.outstanding balance.
        3. Reverts knocked-off purchase bills (decrementing paid_amount, restoring status to POSTED).
        4. Marks payment inactive (is_active = False).
        5. Stages SUPPLIER_PAYMENT_CANCELLED outbox event.
        """
        payment = await self.get_payment(payment_id)
        if not payment.is_active:
            # Idempotent return if already cancelled
            payment.allocated_bills = self._extract_allocations(payment.notes)
            return payment

        supplier = await self._get_supplier(payment.supplier_id)

        # 1. Reverse double-entry GL voucher
        reversal_voucher = await UnifiedAccountingLedgerService.reverse_supplier_payment_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            payment_id=payment.id,
            branch_id=self.tenant.branch_id,
            reason=reason,
            cancelled_by=cancelled_by,
        )

        # 2. Re-instate supplier outstanding balance
        current_outstanding = Decimal(str(supplier.outstanding or "0.00"))
        supplier.outstanding = (current_outstanding + Decimal(str(payment.amount or "0.00"))).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        # 3. Revert bill knock-offs
        allocations = self._extract_allocations(payment.notes)
        for alloc in allocations:
            bill_id = alloc.get("bill_id")
            alloc_amt = Decimal(str(alloc.get("amount", 0)))
            if not bill_id or alloc_amt <= Decimal("0.00"):
                continue

            bill_stmt = select(PurchaseBill).where(
                PurchaseBill.id == bill_id,
                PurchaseBill.company_id == self.tenant.company_id,
                PurchaseBill.is_deleted == False,
            )
            bill = (await self.db.execute(bill_stmt)).scalar_one_or_none()
            if bill:
                bill_paid = Decimal(str(bill.paid_amount or 0))
                bill.paid_amount = max(Decimal("0.00"), (bill_paid - alloc_amt).quantize(Decimal("0.01")))
                if bill.status == "PAID" and bill.paid_amount < Decimal(str(bill.total_amount or 0)):
                    bill.status = "POSTED"
                bill.modified_at = datetime.now(timezone.utc)

        # 4. Mark payment as cancelled
        payment.is_active = False
        cancel_suffix = f"[CANCELLED: {reason or 'Payment voided'}]"
        payment.notes = f"{payment.notes or ''} {cancel_suffix}".strip()
        payment.modified_at = datetime.now(timezone.utc)
        payment.deleted_by = cancelled_by

        # 5. Record outbox cancellation event
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "SUPPLIER_PAYMENT_CANCELLED",
                "payment_id": payment.id,
                "supplier_id": payment.supplier_id,
                "amount": str(payment.amount),
                "company_code": self.tenant.company_id,
                "reversal_voucher_id": reversal_voucher.id if reversal_voucher else None,
                "reason": reason,
            },
            causation_id=payment.id,
        )

        await self.db.commit()
        await self.db.refresh(payment)

        # Attach dynamic attributes for response schema
        payment.allocated_bills = allocations
        payment.journal_voucher_id = reversal_voucher.id if reversal_voucher else None
        return payment

    async def list_payments(self, supplier_id: Optional[str] = None) -> List[SupplierPayment]:
        q = select(SupplierPayment).where(
            SupplierPayment.company_id == self.tenant.company_id,
            SupplierPayment.branch_id  == self.tenant.branch_id,
            SupplierPayment.is_deleted == False,
        ).order_by(SupplierPayment.created_at.desc())
        if supplier_id:
            q = q.where(SupplierPayment.supplier_id == supplier_id)
        res = await self.db.execute(q)
        payments = res.scalars().all()
        for p in payments:
            p.allocated_bills = self._extract_allocations(p.notes)
        return payments

    async def get_payment(self, payment_id: str) -> SupplierPayment:
        res = await self.db.execute(
            select(SupplierPayment).where(
                SupplierPayment.id         == payment_id,
                SupplierPayment.company_id == self.tenant.company_id,
                SupplierPayment.branch_id  == self.tenant.branch_id,
                SupplierPayment.is_deleted == False,
            )
        )
        p = res.scalars().first()
        if not p:
            raise HTTPException(status_code=404, detail="Payment record not found.")
        p.allocated_bills = self._extract_allocations(p.notes)
        return p
