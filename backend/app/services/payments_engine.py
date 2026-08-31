"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.payment_ledger import PaymentTransaction, PaymentAllocation
from ..schemas.payments import (
    PaymentTenderItem,
    ProcessPaymentRequest,
    PaymentTransactionResponse,
    PaymentAllocationDetail,
    MultiTenderPaymentResponse,
    PaymentRefundRequest,
    PaymentRefundResponse,
    PaymentAllocationRequest,
    PaymentReceiptResponse,
    PaymentReceiptTenderLine,
)


class PaymentsEngine:
    """
    Authoritative SMRITI Payments Engine (Section 7).
    Handles multi-tender payments, idempotency gating, receipt generation,
    full/partial refund processing with balance guards, and multi-invoice allocations.
    """

    @classmethod
    async def process_payment(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ProcessPaymentRequest,
        created_by: Optional[str] = None,
    ) -> MultiTenderPaymentResponse:
        """
        Records multi-tender payment allocations atomically with strict idempotency gating.
        """
        clean_key = req.idempotency_key.strip()

        # 1. Check for existing idempotent transactions
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.company_id == company_id,
                or_(
                    PaymentTransaction.idempotency_key == clean_key,
                    PaymentTransaction.idempotency_key.like(f"{clean_key}_%")
                ),
                PaymentTransaction.is_deleted == False
            )
            .options(selectinload(PaymentTransaction.allocations))
        )
        existing = (await session.execute(stmt)).scalars().all()
        if existing:
            tx_res_list = [
                PaymentTransactionResponse(
                    id=t.id,
                    company_id=t.company_id,
                    branch_id=t.branch_id,
                    transaction_no=t.transaction_no,
                    reference_doc_type=t.reference_doc_type,
                    reference_doc_id=t.reference_doc_id,
                    party_id=t.party_id,
                    tender_type=t.tender_type,
                    amount=float(t.amount),
                    currency=t.currency or "INR",
                    status=t.status,
                    idempotency_key=t.idempotency_key,
                    gateway_reference=t.gateway_reference,
                    captured_at=t.captured_at,
                    allocations=[
                        PaymentAllocationDetail(
                            id=a.id,
                            payment_id=a.payment_id,
                            invoice_id=a.invoice_id,
                            allocated_amount=float(a.allocated_amount),
                            discount_allowed=float(a.discount_allowed or 0.0),
                            settled_at=a.settled_at,
                        )
                        for a in (t.allocations or [])
                    ]
                )
                for t in existing
            ]
            total_amt = sum(t.amount for t in tx_res_list)
            return MultiTenderPaymentResponse(
                total_amount=float(Decimal(str(total_amt)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                currency=req.currency,
                status="SUCCESS",
                idempotency_key=clean_key,
                transactions=tx_res_list,
                receipt_no=f"RCP-{existing[0].transaction_no}",
            )

        # 2. Create new transactions for each tender
        created_txs: List[PaymentTransaction] = []
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")

        for idx, tender in enumerate(req.tenders, start=1):
            tender_amt = Decimal(str(tender.amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if tender_amt <= 0:
                raise ValueError("Tender amount must be greater than zero.")

            tx_id = f"pay_{uuid.uuid4().hex[:12]}"
            tx_no = f"PAY-{date_str}-{uuid.uuid4().hex[:6].upper()}"
            sub_idempotency_key = f"{clean_key}_{idx}" if len(req.tenders) > 1 else clean_key

            tx = PaymentTransaction(
                id=tx_id,
                company_id=company_id,
                branch_id=req.branch_id,
                transaction_no=tx_no,
                reference_doc_type=req.reference_doc_type,
                reference_doc_id=req.reference_doc_id,
                party_id=req.party_id,
                tender_type=tender.tender_type.upper(),
                amount=tender_amt,
                currency=req.currency,
                idempotency_key=sub_idempotency_key,
                status="SUCCESS",
                gateway_reference=tender.gateway_reference,
                captured_at=now,
                is_active=True,
                is_deleted=False,
                created_by=created_by,
            )
            session.add(tx)

            if req.auto_allocate:
                alloc = PaymentAllocation(
                    id=f"pal_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=req.branch_id,
                    payment_id=tx_id,
                    invoice_id=req.reference_doc_id,
                    allocated_amount=tender_amt,
                    discount_allowed=Decimal("0.00"),
                    settled_at=now,
                    is_active=True,
                    is_deleted=False,
                    created_by=created_by,
                )
                session.add(alloc)

            created_txs.append(tx)

        await session.commit()

        # Re-fetch created transactions with allocations loaded
        tx_ids = [t.id for t in created_txs]
        refetch_stmt = (
            select(PaymentTransaction)
            .where(PaymentTransaction.id.in_(tx_ids))
            .options(selectinload(PaymentTransaction.allocations))
        )
        loaded_txs = (await session.execute(refetch_stmt)).scalars().all()

        tx_responses = [
            PaymentTransactionResponse(
                id=t.id,
                company_id=t.company_id,
                branch_id=t.branch_id,
                transaction_no=t.transaction_no,
                reference_doc_type=t.reference_doc_type,
                reference_doc_id=t.reference_doc_id,
                party_id=t.party_id,
                tender_type=t.tender_type,
                amount=float(t.amount),
                currency=t.currency or "INR",
                status=t.status,
                idempotency_key=t.idempotency_key,
                gateway_reference=t.gateway_reference,
                captured_at=t.captured_at,
                allocations=[
                    PaymentAllocationDetail(
                        id=a.id,
                        payment_id=a.payment_id,
                        invoice_id=a.invoice_id,
                        allocated_amount=float(a.allocated_amount),
                        discount_allowed=float(a.discount_allowed or 0.0),
                        settled_at=a.settled_at,
                    )
                    for a in (t.allocations or [])
                ]
            )
            for t in loaded_txs
        ]

        total_amount_final = sum(t.amount for t in tx_responses)
        return MultiTenderPaymentResponse(
            total_amount=float(Decimal(str(total_amount_final)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            currency=req.currency,
            status="SUCCESS",
            idempotency_key=clean_key,
            transactions=tx_responses,
            receipt_no=f"RCP-{loaded_txs[0].transaction_no}" if loaded_txs else None,
        )

    @classmethod
    async def process_refund(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PaymentRefundRequest,
        created_by: Optional[str] = None,
    ) -> PaymentRefundResponse:
        """
        Executes a full or partial refund against an existing payment transaction
        with balance and over-refund guards.
        """
        stmt = select(PaymentTransaction).where(
            PaymentTransaction.id == req.payment_transaction_id,
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.is_deleted == False
        )
        orig_tx = (await session.execute(stmt)).scalars().first()
        if not orig_tx:
            raise ValueError(f"Original payment transaction '{req.payment_transaction_id}' not found.")

        # Check total previous refunds against this transaction
        stmt_prev = select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.reference_doc_type == "PAYMENT_REFUND",
            PaymentTransaction.reference_doc_id == orig_tx.id,
            PaymentTransaction.is_deleted == False
        )
        already_refunded = Decimal(str(await session.scalar(stmt_prev) or 0.00))

        refund_req_amt = Decimal(str(req.refund_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        orig_amt = Decimal(str(orig_tx.amount))

        if already_refunded + refund_req_amt > orig_amt:
            max_avail = orig_amt - already_refunded
            raise ValueError(
                f"Refund amount ₹{refund_req_amt} exceeds available refundable balance ₹{max_avail} (Original: ₹{orig_amt}, Already Refunded: ₹{already_refunded})."
            )

        now = datetime.now(timezone.utc)
        refund_tx_id = f"pay_ref_{uuid.uuid4().hex[:12]}"
        refund_tx_no = f"REF-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        refund_tender = req.refund_tender_type.upper() if req.refund_tender_type else orig_tx.tender_type

        refund_tx = PaymentTransaction(
            id=refund_tx_id,
            company_id=company_id,
            branch_id=orig_tx.branch_id,
            transaction_no=refund_tx_no,
            reference_doc_type="PAYMENT_REFUND",
            reference_doc_id=orig_tx.id,
            party_id=orig_tx.party_id,
            tender_type=refund_tender,
            amount=refund_req_amt,
            currency=orig_tx.currency or "INR",
            idempotency_key=req.idempotency_key.strip(),
            status="SUCCESS",
            gateway_reference=f"REFUND_FOR_{orig_tx.transaction_no}",
            captured_at=now,
            is_active=True,
            is_deleted=False,
            created_by=created_by,
        )
        session.add(refund_tx)

        # Update original transaction status
        new_total_refunded = already_refunded + refund_req_amt
        if new_total_refunded >= orig_amt:
            orig_tx.status = "REFUNDED"
        else:
            orig_tx.status = "PARTIALLY_REFUNDED"

        await session.commit()

        remaining_balance = orig_amt - new_total_refunded

        return PaymentRefundResponse(
            refund_transaction_id=refund_tx_id,
            original_payment_id=orig_tx.id,
            refund_amount=float(refund_req_amt),
            remaining_balance=float(remaining_balance),
            status="REFUND_SUCCESS" if remaining_balance == Decimal("0.00") else "PARTIAL_REFUND",
            reason=req.reason,
            refunded_at=now,
        )

    @classmethod
    async def allocate_payment(
        cls,
        session: AsyncSession,
        company_id: str,
        payment_id: str,
        req: PaymentAllocationRequest,
        created_by: Optional[str] = None,
    ) -> PaymentAllocationDetail:
        """
        Distributes unallocated balance of a payment across an invoice.
        """
        stmt_pay = select(PaymentTransaction).where(
            PaymentTransaction.id == payment_id,
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.is_deleted == False
        )
        tx = (await session.execute(stmt_pay)).scalars().first()
        if not tx:
            raise ValueError(f"Payment transaction '{payment_id}' not found.")

        stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_deleted == False
        )
        already_allocated = Decimal(str(await session.scalar(stmt_alloc) or 0.00))

        alloc_req_amt = Decimal(str(req.allocated_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tx_amt = Decimal(str(tx.amount))

        if already_allocated + alloc_req_amt > tx_amt:
            unalloc = tx_amt - already_allocated
            raise ValueError(
                f"Allocation amount ₹{alloc_req_amt} exceeds unallocated payment balance ₹{unalloc} (Total: ₹{tx_amt}, Already Allocated: ₹{already_allocated})."
            )

        now = datetime.now(timezone.utc)
        alloc = PaymentAllocation(
            id=f"pal_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=tx.branch_id,
            payment_id=tx.id,
            invoice_id=req.invoice_id,
            allocated_amount=alloc_req_amt,
            discount_allowed=Decimal(str(req.discount_allowed or 0.0)),
            settled_at=now,
            is_active=True,
            is_deleted=False,
            created_by=created_by,
        )
        session.add(alloc)
        await session.commit()

        return PaymentAllocationDetail(
            id=alloc.id,
            payment_id=alloc.payment_id,
            invoice_id=alloc.invoice_id,
            allocated_amount=float(alloc.allocated_amount),
            discount_allowed=float(alloc.discount_allowed or 0.0),
            settled_at=alloc.settled_at,
        )

    @classmethod
    async def generate_payment_receipt(
        cls,
        session: AsyncSession,
        company_id: str,
        reference_doc_id: str,
    ) -> PaymentReceiptResponse:
        """
        Generates an authoritative payment receipt aggregating tender settlements and invoice allocations.
        """
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.company_id == company_id,
                or_(
                    PaymentTransaction.reference_doc_id == reference_doc_id,
                    PaymentTransaction.id == reference_doc_id
                ),
                PaymentTransaction.is_deleted == False
            )
            .options(selectinload(PaymentTransaction.allocations))
        )
        txs = (await session.execute(stmt)).scalars().all()
        if not txs:
            raise ValueError(f"No payment transactions found for reference '{reference_doc_id}'.")

        first_tx = txs[0]
        total_paid = sum(Decimal(str(t.amount)) for t in txs if t.reference_doc_type != "PAYMENT_REFUND")
        receipt_tenders = [
            PaymentReceiptTenderLine(
                tender_type=t.tender_type,
                amount=float(t.amount),
                gateway_reference=t.gateway_reference,
                transaction_no=t.transaction_no,
            )
            for t in txs
        ]

        all_allocations = []
        for t in txs:
            for a in (t.allocations or []):
                all_allocations.append(
                    PaymentAllocationDetail(
                        id=a.id,
                        payment_id=a.payment_id,
                        invoice_id=a.invoice_id,
                        allocated_amount=float(a.allocated_amount),
                        discount_allowed=float(a.discount_allowed or 0.0),
                        settled_at=a.settled_at,
                    )
                )

        receipt_no = f"RCP-{first_tx.transaction_no}"
        return PaymentReceiptResponse(
            receipt_no=receipt_no,
            receipt_date=first_tx.captured_at or datetime.now(timezone.utc),
            company_id=company_id,
            branch_id=first_tx.branch_id,
            reference_doc_type=first_tx.reference_doc_type,
            reference_doc_id=first_tx.reference_doc_id,
            party_id=first_tx.party_id,
            total_paid=float(total_paid.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            currency=first_tx.currency or "INR",
            tenders=receipt_tenders,
            allocations=all_allocations,
            status=first_tx.status,
        )

    @classmethod
    async def query_transactions(
        cls,
        session: AsyncSession,
        company_id: str,
        party_id: Optional[str] = None,
        reference_doc_id: Optional[str] = None,
        tender_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[PaymentTransactionResponse]:
        """Queries payment transactions with filters."""
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.company_id == company_id,
                PaymentTransaction.is_deleted == False
            )
            .options(selectinload(PaymentTransaction.allocations))
            .order_by(PaymentTransaction.captured_at.desc())
            .limit(limit)
        )
        if party_id:
            stmt = stmt.where(PaymentTransaction.party_id == party_id)
        if reference_doc_id:
            stmt = stmt.where(PaymentTransaction.reference_doc_id == reference_doc_id)
        if tender_type:
            stmt = stmt.where(PaymentTransaction.tender_type == tender_type.upper())
        if status:
            stmt = stmt.where(PaymentTransaction.status == status.upper())

        txs = (await session.execute(stmt)).scalars().all()
        return [
            PaymentTransactionResponse(
                id=t.id,
                company_id=t.company_id,
                branch_id=t.branch_id,
                transaction_no=t.transaction_no,
                reference_doc_type=t.reference_doc_type,
                reference_doc_id=t.reference_doc_id,
                party_id=t.party_id,
                tender_type=t.tender_type,
                amount=float(t.amount),
                currency=t.currency or "INR",
                status=t.status,
                idempotency_key=t.idempotency_key,
                gateway_reference=t.gateway_reference,
                captured_at=t.captured_at,
                allocations=[
                    PaymentAllocationDetail(
                        id=a.id,
                        payment_id=a.payment_id,
                        invoice_id=a.invoice_id,
                        allocated_amount=float(a.allocated_amount),
                        discount_allowed=float(a.discount_allowed or 0.0),
                        settled_at=a.settled_at,
                    )
                    for a in (t.allocations or [])
                ]
            )
            for t in txs
        ]
