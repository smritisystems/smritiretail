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
        is_advance = (getattr(req, "payment_type", "STANDARD") or "STANDARD").upper() == "ADVANCE"
        supplier = await self._get_supplier(req.supplier_id)

        outstanding = Decimal(str(supplier.outstanding or "0.00"))
        if not is_advance and req.amount > outstanding:
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

        # Format notes with structured allocation manifest and advance tags
        final_notes = req.notes or ""
        if is_advance:
            final_notes = f"__PAYMENT_TYPE__:ADVANCE\n{final_notes}".strip()
            if req.purchase_order_id:
                final_notes = f"__PO_ID__:{req.purchase_order_id}\n{final_notes}".strip()
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

        # Update supplier.outstanding:
        # Standard payment decrements by full amount; advance decrements only by knocked-off bills
        alloc_total = sum(Decimal(str(a["amount"])) for a in allocated_manifest)
        if is_advance:
            if alloc_total > Decimal("0.00"):
                supplier.outstanding = max(Decimal("0.00"), outstanding - alloc_total).quantize(Decimal("0.01"))
                supplier.modified_at = datetime.now(timezone.utc)
        else:
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

        # If advance knocked off bills on creation, post knock-off GL vouchers
        if is_advance and allocated_manifest:
            for alloc in allocated_manifest:
                await UnifiedAccountingLedgerService.post_supplier_advance_knockoff_to_gl(
                    session=self.db,
                    company_id=self.tenant.company_id,
                    supplier_id=supplier.id,
                    advance_payment_id=payment.id,
                    bill_id=alloc["bill_id"],
                    amount=Decimal(str(alloc["amount"])),
                    bill_no=alloc.get("bill_no"),
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
        payment.payment_type = "ADVANCE" if is_advance else "STANDARD"
        payment.purchase_order_id = req.purchase_order_id if is_advance else None
        alloc_sum = sum(Decimal(str(a.get("amount", 0))) for a in allocated_manifest) if allocated_manifest else Decimal("0.00")
        payment.unallocated_amount = max(Decimal("0.00"), Decimal(str(payment.amount)) - alloc_sum).quantize(Decimal("0.01")) if is_advance else Decimal("0.00")
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
        is_advance = bool(payment.notes and "__PAYMENT_TYPE__:ADVANCE" in payment.notes)
        allocations = self._extract_allocations(payment.notes)
        alloc_sum = sum(Decimal(str(a.get("amount", 0))) for a in allocations)

        if is_advance:
            supplier.outstanding = (current_outstanding + alloc_sum).quantize(Decimal("0.01"))
        else:
            supplier.outstanding = (current_outstanding + Decimal(str(payment.amount or "0.00"))).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        # 3. Revert bill knock-offs
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
        payment.is_advance = is_advance
        payment.payment_type = "ADVANCE" if is_advance else "STANDARD"
        total_allocated = sum(Decimal(str(a.get("amount", 0))) for a in allocations)
        payment.unallocated_amount = max(Decimal("0.00"), Decimal(str(payment.amount or 0)) - total_allocated)
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
            is_adv = bool(p.notes and "__PAYMENT_TYPE__:ADVANCE" in p.notes)
            p.is_advance = is_adv
            p.payment_type = "ADVANCE" if is_adv else "STANDARD"
            p.purchase_order_id = None
            if p.notes and "__PO_ID__:" in p.notes:
                try:
                    p.purchase_order_id = p.notes.split("__PO_ID__:", 1)[1].split("\n", 1)[0].strip()
                except Exception:
                    pass
            total_allocated = sum(Decimal(str(a.get("amount", 0))) for a in p.allocated_bills)
            p.unallocated_amount = max(Decimal("0.00"), Decimal(str(p.amount or 0)) - total_allocated)
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
        is_adv = bool(p.notes and "__PAYMENT_TYPE__:ADVANCE" in p.notes)
        p.is_advance = is_adv
        p.payment_type = "ADVANCE" if is_adv else "STANDARD"
        p.purchase_order_id = None
        if p.notes and "__PO_ID__:" in p.notes:
            try:
                p.purchase_order_id = p.notes.split("__PO_ID__:", 1)[1].split("\n", 1)[0].strip()
            except Exception:
                pass
        total_allocated = sum(Decimal(str(a.get("amount", 0))) for a in p.allocated_bills)
        p.unallocated_amount = max(Decimal("0.00"), Decimal(str(p.amount or 0)) - total_allocated)
        return p

    async def knockoff_advance(
        self,
        supplier_id: str,
        advance_payment_id: str,
        bill_id: str,
        amount: Decimal,
        notes: Optional[str] = None,
        created_by: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Knocks off an unallocated supplier advance against an open confirmed Purchase Bill.
        Posts double-entry GL voucher (DR 2010 Creditors / CR 2050 Supplier Advance Liability),
        increments bill.paid_amount, transitions bill status to PAID if settled,
        and atomically decrements supplier.outstanding liability.
        """
        supplier = await self._get_supplier(supplier_id)

        # 1. Fetch advance payment
        stmt = select(SupplierPayment).where(
            SupplierPayment.id == advance_payment_id,
            SupplierPayment.supplier_id == supplier_id,
            SupplierPayment.company_id == self.tenant.company_id,
            SupplierPayment.is_active == True,
            SupplierPayment.is_deleted == False,
        )
        payment = (await self.db.execute(stmt)).scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=404, detail="Supplier advance payment not found.")

        # Calculate currently allocated amount from notes
        current_allocs = self._extract_allocations(payment.notes)
        total_allocated = sum(Decimal(str(a.get("amount", 0))) for a in current_allocs)
        unallocated_advance = max(Decimal("0.00"), Decimal(str(payment.amount or 0)) - total_allocated)

        if amount > unallocated_advance:
            raise HTTPException(
                status_code=400,
                detail=f"Knock-off amount ₹{amount:,.2f} exceeds unallocated advance of ₹{unallocated_advance:,.2f}."
            )

        # 2. Fetch purchase bill
        bill_stmt = select(PurchaseBill).where(
            PurchaseBill.id == bill_id,
            PurchaseBill.supplier_id == supplier_id,
            PurchaseBill.company_id == self.tenant.company_id,
            PurchaseBill.is_deleted == False,
        )
        bill = (await self.db.execute(bill_stmt)).scalar_one_or_none()
        if not bill:
            raise HTTPException(status_code=404, detail="Purchase bill not found for this supplier.")
        if bill.status == "PAID" or Decimal(str(bill.paid_amount or 0)) >= Decimal(str(bill.total_amount or 0)):
            raise HTTPException(status_code=400, detail="Purchase bill is already fully paid.")
        if bill.status in ("CANCELLED", "DRAFT"):
            raise HTTPException(status_code=400, detail=f"Cannot knock off advance against a bill in {bill.status} status.")

        unpaid = max(Decimal("0.00"), Decimal(str(bill.total_amount or 0)) - Decimal(str(bill.paid_amount or 0)))
        if amount > unpaid:
            raise HTTPException(
                status_code=400,
                detail=f"Knock-off amount ₹{amount:,.2f} exceeds unpaid bill balance of ₹{unpaid:,.2f}."
            )

        # 3. Update Bill
        alloc_amt = amount.quantize(Decimal("0.01"))
        bill.paid_amount = (Decimal(str(bill.paid_amount or 0)) + alloc_amt).quantize(Decimal("0.01"))
        if bill.paid_amount >= Decimal(str(bill.total_amount or 0)):
            bill.status = "PAID"
        bill.modified_at = datetime.now(timezone.utc)

        # 4. Update Supplier Outstanding
        supplier.outstanding = max(Decimal("0.00"), Decimal(str(supplier.outstanding or 0)) - alloc_amt).quantize(Decimal("0.01"))
        supplier.modified_at = datetime.now(timezone.utc)

        # 5. Append allocation to payment manifest
        current_allocs.append({
            "bill_id": bill.id,
            "bill_no": bill.bill_no,
            "amount": str(alloc_amt),
            "knocked_off_at": datetime.now(timezone.utc).isoformat(),
        })
        base_notes = payment.notes or ""
        if "__ALLOCATIONS__:" in base_notes:
            base_notes = base_notes.split("__ALLOCATIONS__:", 1)[0].strip()
        manifest_tag = f"__ALLOCATIONS__:{json.dumps(current_allocs)}"
        payment.notes = f"{base_notes}\n{manifest_tag}".strip()
        payment.modified_at = datetime.now(timezone.utc)

        await self.db.flush()

        # 6. Post double-entry knock-off GL voucher
        voucher = await UnifiedAccountingLedgerService.post_supplier_advance_knockoff_to_gl(
            session=self.db,
            company_id=self.tenant.company_id,
            supplier_id=supplier.id,
            advance_payment_id=payment.id,
            bill_id=bill.id,
            amount=alloc_amt,
            bill_no=bill.bill_no,
            branch_id=self.tenant.branch_id,
            created_by=created_by or user_id,
        )

        # 7. Record outbox event
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "SUPPLIER_ADVANCE_KNOCKED_OFF",
                "payment_id": payment.id,
                "bill_id": bill.id,
                "amount": str(alloc_amt),
                "voucher_id": voucher.id if voucher else None,
            },
            causation_id=f"{payment.id}_{bill.id}",
        )

        await self.db.commit()

        remaining_unallocated = (unallocated_advance - alloc_amt).quantize(Decimal("0.01"))
        return {
            "voucher_id": voucher.id if voucher else None,
            "journal_voucher_id": voucher.id if voucher else None,
            "advance_payment_id": payment.id,
            "bill_id": bill.id,
            "amount": alloc_amt,
            "amount_knocked_off": alloc_amt,
            "bill_paid_amount": bill.paid_amount,
            "bill_status": bill.status,
            "unallocated_advance": remaining_unallocated,
            "remaining_advance_balance": remaining_unallocated,
            "created_at": datetime.now(timezone.utc),
        }

