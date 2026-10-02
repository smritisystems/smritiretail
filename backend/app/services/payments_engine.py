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
from sqlalchemy import select, and_, or_, func, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.payment_ledger import PaymentTransaction, PaymentAllocation
from ..models.identity_registry import SmritiIdentityAlias
from .identity.engine import IdentityEngine
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


def _resolve_gateway_source_system(tender: PaymentTenderItem) -> str:
    """
    Derive specific external source system identifier (RAZORPAY, STRIPE, PAYTM, PINE_LABS, PHONEPE, UPI, BANK)
    when present in tender metadata. Falls back to tender_type (e.g. 'UPI', 'CARD') or 'GATEWAY' as canonical
    generic transitional source.
    """
    text_corpus = f"{tender.bank_name or ''} {tender.notes or ''} {tender.gateway_reference or ''}".upper()
    known_gateways = {
        "RAZORPAY": "RAZORPAY",
        "STRIPE": "STRIPE",
        "PAYTM": "PAYTM",
        "PINE_LABS": "PINE_LABS",
        "PINELABS": "PINE_LABS",
        "PHONEPE": "PHONEPE",
        "GPAY": "GOOGLE_PAY",
        "GOOGLEPAY": "GOOGLE_PAY",
        "BHIM": "BHIM",
        "CRED": "CRED",
        "BILLDESK": "BILLDESK",
        "CCAVENUE": "CCAVENUE",
        "CASHFREE": "CASHFREE",
    }
    for marker, canonical_source in known_gateways.items():
        if marker in text_corpus:
            return canonical_source

    if tender.tender_type in ("UPI", "CARD", "NETBANKING", "WALLET", "BANK_TRANSFER"):
        return tender.tender_type

    return "GATEWAY"


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
        commit: bool = True,
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

        try:
            for idx, tender in enumerate(req.tenders, start=1):
                tender_amt = Decimal(str(tender.amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if tender_amt <= 0:
                    raise ValueError("Tender amount must be greater than zero.")

                tx_id = IdentityEngine.generate_technical_id()
                tx_no = f"PAY-{date_str}-{uuid.uuid4().hex[:6].upper()}"
                sub_idempotency_key = f"{clean_key}_{idx}" if len(req.tenders) > 1 else clean_key

                # Customer store credit / wallet validation
                if tender.tender_type.upper() in ("CREDIT_NOTE", "WALLET", "STORE_CREDIT"):
                    from ..models.crm import Customer, CustomerCreditLedgerEntry
                    effective_cust_id = req.party_id
                    if not effective_cust_id and req.reference_doc_id:
                        from ..models.sales import SalesInvoice
                        stmt_c = select(SalesInvoice.customer_id).where(SalesInvoice.id == req.reference_doc_id, SalesInvoice.company_id == company_id)
                        effective_cust_id = await session.scalar(stmt_c)

                    if not effective_cust_id:
                        raise ValueError("Customer identification (party_id) is mandatory when tendering via STORE_CREDIT / WALLET / CREDIT_NOTE.")

                    # Phase 2: Acquire pessimistic row lock on Customer record to prevent concurrent wallet double-spend
                    stmt_cust_lock = (
                        select(Customer)
                        .where(
                            Customer.id == effective_cust_id,
                            Customer.company_id == company_id,
                        )
                        .with_for_update()
                    )
                    cust_locked = (await session.execute(stmt_cust_lock)).scalars().first()
                    if not cust_locked:
                        raise ValueError(f"Customer '{effective_cust_id}' not found for company '{company_id}'.")

                    # Calculate available credit balance
                    stmt_credit = select(
                        func.coalesce(
                            func.sum(
                                case(
                                    (CustomerCreditLedgerEntry.entry_type == "CREDIT", CustomerCreditLedgerEntry.amount),
                                    else_=-CustomerCreditLedgerEntry.amount
                                )
                            ),
                            0
                        )
                    ).where(
                        CustomerCreditLedgerEntry.customer_id == effective_cust_id,
                        CustomerCreditLedgerEntry.company_id == company_id,
                        CustomerCreditLedgerEntry.is_deleted == False
                    )
                    avail_credit = Decimal(str(await session.scalar(stmt_credit) or 0.00))

                    if tender_amt > avail_credit:
                        raise ValueError(
                            f"Tender amount ₹{tender_amt} exceeds available customer store credit / wallet balance ₹{avail_credit}."
                        )

                    # Record CustomerCreditLedgerEntry debit
                    # Phase 3: Reference identity hardening (Option B) - f"{req.reference_doc_id}:{tx_id}" ensures
                    # unique reference identity per transaction while retaining invoice traceability and preserving UNIQUE constraint.
                    credit_ref_id = f"{req.reference_doc_id}:{tx_id}" if req.reference_doc_id else tx_id
                    session.add(
                        CustomerCreditLedgerEntry(
                            id=f"ccle-{uuid.uuid4().hex[:12]}",
                            customer_id=effective_cust_id,
                            entry_date=now,
                            entry_type="DEBIT",
                            amount=tender_amt,
                            balance_after=max(Decimal("0.00"), avail_credit - tender_amt),
                            reference_type="SALES_INVOICE",
                            reference_id=credit_ref_id,
                            notes=f"Store credit / wallet redemption via {tx_no}",
                            company_id=company_id,
                            branch_id=req.branch_id,
                        )
                    )
                    await session.flush()

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

                # Ingest external processor gateway reference into alias bridge via IdentityEngine
                if tender.gateway_reference and str(tender.gateway_reference).strip():
                    clean_gw = str(tender.gateway_reference).strip()
                    source_sys = _resolve_gateway_source_system(tender)
                    await IdentityEngine.register_alias(
                        session=session,
                        entity_type="PAYMENT_TRANSACTION",
                        entity_id=tx_id,
                        alias_code=clean_gw,
                        alias_type="GATEWAY_REF",
                        source_system=source_sys,
                        canonical_identity_code=None,
                        company_id=company_id,
                        branch_id=req.branch_id,
                        notes=f"Payment gateway reference ({tender.tender_type})",
                        created_by=created_by,
                    )

                if req.auto_allocate:
                    alloc = PaymentAllocation(
                        id=IdentityEngine.generate_technical_id(),
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

                    # Synchronize invoice balance if authoritative sales invoice exists
                    if req.reference_doc_type in ("SALES_INVOICE", "POS_BILL") and req.reference_doc_id:
                        from ..models.sales import SalesInvoice
                        inv_match = (
                            await session.execute(
                                select(SalesInvoice)
                                .where(
                                    SalesInvoice.id == req.reference_doc_id,
                                    SalesInvoice.company_id == company_id,
                                    SalesInvoice.is_deleted == False
                                )
                                .with_for_update()
                            )
                        ).scalars().first()
                        if inv_match:
                            cur_paid = Decimal(str(inv_match.paid_amount or "0.00"))
                            new_paid = cur_paid + tender_amt
                            inv_match.paid_amount = new_paid
                            inv_match.balance_amount = max(Decimal("0.00"), Decimal(str(inv_match.grand_total or "0.00")) - new_paid)
                            if inv_match.balance_amount == Decimal("0.00"):
                                inv_match.status = "PAID"
                            session.add(inv_match)

                created_txs.append(tx)

            # Synchronous Payment Receipt GL (BD-03)
            from .unified_ledger import UnifiedAccountingLedgerService
            for tx in created_txs:
                await UnifiedAccountingLedgerService.post_payment_transaction_to_gl(
                    session=session,
                    company_id=company_id,
                    payment_id=tx.id,
                    branch_id=tx.branch_id,
                )

            if commit:
                await session.commit()
            else:
                await session.flush()
        except Exception:
            if commit:
                await session.rollback()
            raise

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
        commit: bool = True,
    ) -> PaymentRefundResponse:
        """
        Executes a full or partial refund against an existing payment transaction
        with balance and over-refund guards.
        """
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.id == req.payment_transaction_id,
                PaymentTransaction.company_id == company_id,
                PaymentTransaction.is_deleted == False
            )
            .with_for_update()
        )
        orig_tx = (await session.execute(stmt)).scalars().first()
        if not orig_tx:
            raise ValueError(f"Original payment transaction '{req.payment_transaction_id}' not found.")

        if orig_tx.status in ("REFUNDED", "CANCELLED", "FAILED"):
            raise ValueError(f"Payment transaction '{orig_tx.id}' with status '{orig_tx.status}' is not eligible for refund.")

        clean_key = req.idempotency_key.strip()

        # Idempotency check: return existing refund if already recorded
        stmt_existing = select(PaymentTransaction).where(
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.idempotency_key == clean_key,
            PaymentTransaction.is_deleted == False
        )
        existing_refund = (await session.execute(stmt_existing)).scalars().first()
        if existing_refund:
            stmt_prev = select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
                PaymentTransaction.company_id == company_id,
                PaymentTransaction.reference_doc_type.in_(("PAYMENT_REFUND", "CUSTOMER_ADVANCE_REFUND")),
                PaymentTransaction.reference_doc_id == orig_tx.id,
                PaymentTransaction.is_deleted == False
            )
            already_refunded = Decimal(str(await session.scalar(stmt_prev) or 0.00))
            is_adv = orig_tx.reference_doc_type == "CUSTOMER_ADVANCE"
            alloc_deduct = Decimal("0.00")
            if is_adv:
                stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
                    PaymentAllocation.payment_id == orig_tx.id,
                    PaymentAllocation.is_deleted == False
                )
                alloc_deduct = Decimal(str(await session.scalar(stmt_alloc) or 0.00))
            orig_amt = Decimal(str(orig_tx.amount))
            rem = max(Decimal("0.00"), orig_amt - alloc_deduct - already_refunded)
            return PaymentRefundResponse(
                refund_transaction_id=existing_refund.id,
                original_payment_id=orig_tx.id,
                refund_amount=float(existing_refund.amount),
                remaining_balance=float(rem),
                status="REFUND_SUCCESS" if rem == Decimal("0.00") else "PARTIAL_REFUND",
                reason=req.reason,
                refunded_at=existing_refund.captured_at or datetime.now(timezone.utc),
            )

        refund_req_amt = Decimal(str(req.refund_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if refund_req_amt <= Decimal("0.00"):
            raise ValueError("Refund amount must be greater than zero.")

        orig_amt = Decimal(str(orig_tx.amount))

        # Check total previous refunds against this transaction
        stmt_prev = select(func.coalesce(func.sum(PaymentTransaction.amount), 0)).where(
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.reference_doc_type.in_(("PAYMENT_REFUND", "CUSTOMER_ADVANCE_REFUND")),
            PaymentTransaction.reference_doc_id == orig_tx.id,
            PaymentTransaction.is_deleted == False
        )
        already_refunded = Decimal(str(await session.scalar(stmt_prev) or 0.00))

        is_advance = orig_tx.reference_doc_type == "CUSTOMER_ADVANCE"
        already_allocated = Decimal("0.00")

        if is_advance:
            # For advances, deduct allocations to invoices
            stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
                PaymentAllocation.payment_id == orig_tx.id,
                PaymentAllocation.is_deleted == False
            )
            already_allocated = Decimal(str(await session.scalar(stmt_alloc) or 0.00))
            max_avail = orig_amt - already_allocated - already_refunded
            if refund_req_amt > max_avail:
                raise ValueError(
                    f"Refund amount ₹{refund_req_amt} exceeds available unallocated advance balance ₹{max_avail} "
                    f"(Original Advance: ₹{orig_amt}, Allocated to Invoices: ₹{already_allocated}, Already Refunded: ₹{already_refunded})."
                )
            ref_doc_type = "CUSTOMER_ADVANCE_REFUND"
        else:
            max_avail = orig_amt - already_refunded
            if refund_req_amt > max_avail:
                raise ValueError(
                    f"Refund amount ₹{refund_req_amt} exceeds available refundable balance ₹{max_avail} "
                    f"(Original: ₹{orig_amt}, Already Refunded: ₹{already_refunded})."
                )
            ref_doc_type = "PAYMENT_REFUND"

        now = datetime.now(timezone.utc)
        refund_tx_id = f"pay_ref_{uuid.uuid4().hex[:12]}"
        refund_tx_no = f"REF-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        refund_tender = req.refund_tender_type.upper() if req.refund_tender_type else orig_tx.tender_type

        try:
            refund_tx = PaymentTransaction(
                id=refund_tx_id,
                company_id=company_id,
                branch_id=orig_tx.branch_id,
                transaction_no=refund_tx_no,
                reference_doc_type=ref_doc_type,
                reference_doc_id=orig_tx.id,
                party_id=orig_tx.party_id,
                tender_type=refund_tender,
                amount=refund_req_amt,
                currency=orig_tx.currency or "INR",
                idempotency_key=clean_key,
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
            threshold_amt = (orig_amt - already_allocated) if is_advance else orig_amt
            if new_total_refunded >= threshold_amt:
                orig_tx.status = "REFUNDED"
            else:
                orig_tx.status = "PARTIALLY_REFUNDED"
            session.add(orig_tx)

            # Rebalance and reinstate sales invoice if this was a direct invoice payment
            if orig_tx.reference_doc_type in ("SALES_INVOICE", "POS_BILL") and orig_tx.reference_doc_id:
                from ..models.sales import SalesInvoice
                stmt_inv = (
                    select(SalesInvoice)
                    .where(
                        SalesInvoice.id == orig_tx.reference_doc_id,
                        SalesInvoice.company_id == company_id,
                        SalesInvoice.is_deleted == False
                    )
                    .with_for_update()
                )
                inv = (await session.execute(stmt_inv)).scalars().first()
                if inv:
                    inv.paid_amount = max(Decimal("0.00"), Decimal(str(inv.paid_amount or 0.00)) - refund_req_amt)
                    inv.balance_amount = max(Decimal("0.00"), Decimal(str(inv.grand_total or 0.00)) - inv.paid_amount)
                    if inv.balance_amount > 0 and inv.status == "PAID":
                        inv.status = "POSTED"
                    session.add(inv)

            await session.flush()

            # Synchronous GL Posting for Refund
            from .unified_ledger import UnifiedAccountingLedgerService
            await UnifiedAccountingLedgerService.post_refund_transaction_to_gl(
                session=session,
                company_id=company_id,
                refund_tx_id=refund_tx.id,
                branch_id=orig_tx.branch_id,
            )

            if commit:
                await session.commit()
            else:
                await session.flush()
        except Exception:
            if commit:
                await session.rollback()
            raise

        remaining_balance = threshold_amt - new_total_refunded

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
        commit: bool = True,
    ) -> PaymentAllocationDetail:
        """
        Distributes unallocated balance of a payment across an invoice.
        """
        stmt_pay = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.id == payment_id,
                PaymentTransaction.company_id == company_id,
                PaymentTransaction.is_deleted == False
            )
            .with_for_update()
        )
        tx = (await session.execute(stmt_pay)).scalars().first()
        if not tx:
            raise ValueError(f"Payment transaction '{payment_id}' not found.")

        if tx.status != "SUCCESS":
            raise ValueError(f"Payment transaction '{payment_id}' with status '{tx.status}' is not eligible for allocation.")

        # Idempotency check if idempotency_key provided
        alloc_id = None
        if getattr(req, "idempotency_key", None):
            alloc_id = f"pal_{uuid.uuid5(uuid.NAMESPACE_DNS, f'{company_id}_{payment_id}_{req.idempotency_key}').hex[:20]}"
            stmt_existing_alloc = select(PaymentAllocation).where(
                PaymentAllocation.id == alloc_id,
                PaymentAllocation.company_id == company_id,
                PaymentAllocation.is_deleted == False
            )
            existing_alloc = (await session.execute(stmt_existing_alloc)).scalars().first()
            if existing_alloc:
                return PaymentAllocationDetail(
                    id=existing_alloc.id,
                    payment_id=existing_alloc.payment_id,
                    invoice_id=existing_alloc.invoice_id,
                    allocated_amount=float(existing_alloc.allocated_amount),
                    discount_allowed=float(existing_alloc.discount_allowed or 0.0),
                    settled_at=existing_alloc.settled_at,
                )

        alloc_req_amt = Decimal(str(req.allocated_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tx_amt = Decimal(str(tx.amount))

        if alloc_req_amt <= Decimal("0.00"):
            raise ValueError("Allocation amount must be greater than zero.")

        stmt_alloc = select(func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)).where(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_deleted == False
        )
        already_allocated = Decimal(str(await session.scalar(stmt_alloc) or 0.00))

        if already_allocated + alloc_req_amt > tx_amt:
            unalloc = tx_amt - already_allocated
            raise ValueError(
                f"Allocation amount ₹{alloc_req_amt} exceeds unallocated payment balance ₹{unalloc} (Total: ₹{tx_amt}, Already Allocated: ₹{already_allocated})."
            )

        # Validate invoice if present in database
        from ..models.sales import SalesInvoice
        stmt_inv = (
            select(SalesInvoice)
            .where(
                SalesInvoice.id == req.invoice_id,
                SalesInvoice.is_deleted == False
            )
            .with_for_update()
        )
        inv = (await session.execute(stmt_inv)).scalars().first()
        if not inv:
            raise ValueError(f"Sales invoice '{req.invoice_id}' not found.")

        if inv.company_id != company_id:
            raise ValueError(f"Cross-company allocation forbidden: invoice '{req.invoice_id}' belongs to company '{inv.company_id}', not '{company_id}'.")

        if inv.status in ("CANCELLED", "VOID"):
            raise ValueError(f"Invoice '{inv.invoice_no}' is {inv.status} and cannot receive payments or allocations.")

        if tx.party_id and inv.customer_id and str(tx.party_id).strip() != str(inv.customer_id).strip():
            raise ValueError(f"Customer mismatch: payment belongs to customer '{tx.party_id}', but invoice belongs to '{inv.customer_id}'.")

        inv_bal = Decimal(str(inv.balance_amount)) if (inv.balance_amount is not None and (Decimal(str(inv.balance_amount)) > 0 or (inv.paid_amount and Decimal(str(inv.paid_amount)) > 0))) else Decimal(str(inv.grand_total or 0.00))
        if alloc_req_amt > inv_bal:
            raise ValueError(
                f"Allocation amount ₹{alloc_req_amt} exceeds invoice outstanding balance ₹{inv_bal}."
            )
        try:
            inv.paid_amount = Decimal(str(inv.paid_amount or 0.00)) + alloc_req_amt
            inv.balance_amount = max(Decimal("0.00"), Decimal(str(inv.grand_total or 0.00)) - inv.paid_amount)
            if inv.balance_amount == Decimal("0.00"):
                inv.status = "PAID"
            session.add(inv)

            now = datetime.now(timezone.utc)
            if not alloc_id:
                alloc_id = f"pal_{uuid.uuid4().hex[:12]}"

            alloc = PaymentAllocation(
                id=alloc_id,
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
            await session.flush()

            # Synchronous Payment / Advance Knock-Off GL
            from .unified_ledger import UnifiedAccountingLedgerService
            if tx.reference_doc_type == "CUSTOMER_ADVANCE":
                await UnifiedAccountingLedgerService.post_payment_allocation_to_gl(
                    session=session,
                    company_id=company_id,
                    allocation_id=alloc.id,
                    branch_id=tx.branch_id,
                )
            else:
                await UnifiedAccountingLedgerService.post_payment_transaction_to_gl(
                    session=session,
                    company_id=company_id,
                    payment_id=tx.id,
                    branch_id=tx.branch_id,
                )

            if commit:
                await session.commit()
            else:
                await session.flush()
        except Exception:
            if commit:
                await session.rollback()
            raise

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
