"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-29
Modified     : 2026-08-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.sales import SalesReturn, SalesInvoice
from ..models.payment_ledger import PaymentTransaction, PaymentAllocation
from ..models.crm import Customer
from ..services.sales_return_policy import ResolvedSalesReturnPolicy
from ..services.compliance_audit import ComplianceAuditService


class SalesReturnRefundAdapter:
    """
    Authoritative Sales Return Refund Adapter.
    Bridges Sales Return transactions to the payments and refund ledger:
    - Derives authoritative refund amount from validated return total
    - Validates allowed refund modes against resolved policy
    - Enforces idempotency linked to Sales Return identity
    - Posts refund transactions and adjusts customer store credit where applicable
    """

    @classmethod
    async def process_sales_return_refund(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: str,
        sales_return: SalesReturn,
        orig_invoice: SalesInvoice,
        policy: ResolvedSalesReturnPolicy,
        requested_refund_mode: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        actor_user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        refund_amount = Decimal(str(sales_return.grand_total)).quantize(Decimal("0.01"))
        if refund_amount <= Decimal("0.00"):
            return {
                "status": "NO_REFUND_DUE",
                "refund_amount": 0.0,
                "refund_mode": "NONE",
                "transaction_id": None,
            }

        # Policy validation for refund modes — database policy is the only operational authority.
        allowed_modes = policy.values.get("refund_modes")
        if allowed_modes is None:
            raise HTTPException(
                status_code=500,
                detail="REFUND_POLICY_NOT_CONFIGURED: missing refund_modes in the effective policy.",
            )
        if not isinstance(allowed_modes, list):
            raise HTTPException(
                status_code=500,
                detail="REFUND_POLICY_NOT_CONFIGURED: refund_modes must be a list in the effective policy.",
            )

        allowed_modes_norm = [str(m).upper() for m in allowed_modes]
        mode = (requested_refund_mode or "CREDIT_NOTE").upper()
        if mode not in allowed_modes_norm:
            raise HTTPException(
                status_code=422,
                detail=f"Refund mode '{mode}' is not permitted by return policy. Allowed modes: {allowed_modes}",
            )

        # Build deterministic refund idempotency key
        refund_idem_key = (
            f"REF-SR-{sales_return.id}"
            if not idempotency_key
            else f"REF-{idempotency_key}"
        )

        # Check for existing refund transaction (idempotency check)
        existing_stmt = select(PaymentTransaction).where(
            PaymentTransaction.company_id == company_id,
            PaymentTransaction.idempotency_key == refund_idem_key,
            PaymentTransaction.is_deleted == False,
        )
        existing_tx = (await session.execute(existing_stmt)).scalars().first()
        if existing_tx:
            return {
                "status": "REPLAYED",
                "refund_amount": float(existing_tx.amount),
                "refund_mode": existing_tx.tender_type,
                "transaction_id": existing_tx.id,
                "transaction_no": existing_tx.transaction_no,
            }

        # Determine actual tender
        if mode == "ORIGINAL_PAYMENT":
            orig_payment_mode = (orig_invoice.payment_mode or "CASH").upper()
            tender_type = orig_payment_mode
        elif mode == "CASH":
            tender_type = "CASH"
        elif mode in ("STORE_CREDIT", "CREDIT_NOTE"):
            tender_type = "CREDIT_MEMO"
        else:
            tender_type = mode

        now = datetime.now(timezone.utc)
        tx_id = f"pay_tx_{uuid.uuid4().hex[:12]}"
        tx_no = f"REF-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        refund_tx = PaymentTransaction(
            id=tx_id,
            company_id=company_id,
            branch_id=branch_id,
            transaction_no=tx_no,
            reference_doc_type="SALES_RETURN",
            reference_doc_id=sales_return.id,
            party_id=sales_return.customer_id or orig_invoice.customer_id,
            tender_type=tender_type,
            amount=refund_amount,
            currency="INR",
            idempotency_key=refund_idem_key,
            status="SUCCESS",
            gateway_reference=f"REFUND_FOR_SR_{sales_return.return_no}",
            captured_at=now,
            is_active=True,
            is_deleted=False,
            created_by=actor_user_id,
        )
        session.add(refund_tx)

        # If store credit / credit memo, update customer outstanding or credit balance if customer exists
        if mode in ("STORE_CREDIT", "CREDIT_NOTE") and sales_return.customer_id:
            cust_stmt = select(Customer).where(
                Customer.id == sales_return.customer_id,
                Customer.company_id == company_id,
                Customer.is_deleted == False,
            )
            cust = (await session.execute(cust_stmt)).scalars().first()
            if cust:
                if hasattr(cust, "outstanding") and cust.outstanding is not None:
                    cust.outstanding = max(Decimal("0.00"), cust.outstanding - refund_amount)
                    cust.modified_at = now
                    session.add(cust)

        # Record REFUND_POSTED compliance audit event
        await ComplianceAuditService.record_audit_event(
            session=session,
            company_id=company_id,
            branch_id=branch_id,
            event_type="REFUND_POSTED",
            entity_name="SalesReturn",
            entity_id=sales_return.id,
            actor_user_id=actor_user_id,
            action_summary=f"Refund of ₹{refund_amount} ({tender_type}) posted for return {sales_return.return_no}",
            after_state={
                "return_id": sales_return.id,
                "invoice_id": orig_invoice.id,
                "refund_transaction_id": tx_id,
                "refund_transaction_no": tx_no,
                "refund_amount": float(refund_amount),
                "tender_type": tender_type,
                "idempotency_key": refund_idem_key,
            },
        )

        return {
            "status": "SUCCESS",
            "refund_amount": float(refund_amount),
            "refund_mode": tender_type,
            "transaction_id": tx_id,
            "transaction_no": tx_no,
        }
