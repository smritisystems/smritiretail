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
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.payment_ledger import PaymentTransaction, PaymentAllocation
from app.services.payments_engine import PaymentsEngine
from app.schemas.payments import (
    PaymentTenderItem,
    ProcessPaymentRequest,
    PaymentRefundRequest,
    PaymentAllocationRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_multi_tender_split_payment_processing():
    """Verify split multi-tender payment processing creates atomic transactions and allocations."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    invoice_id = f"INV-SPLIT-{unique_suffix.upper()}"
    idempotency_key = f"IDEM-PAY-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        req = ProcessPaymentRequest(
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=invoice_id,
            party_id=f"pty_{unique_suffix}",
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=500.0),
                PaymentTenderItem(tender_type="UPI", amount=700.0, gateway_reference=f"UPI-TXN-{unique_suffix}"),
            ],
            idempotency_key=idempotency_key,
            auto_allocate=True,
        )

        res = await PaymentsEngine.process_payment(session, "COMP-001", req, created_by="usr-super")
        assert res.status == "SUCCESS"
        assert res.total_amount == 1200.00
        assert len(res.transactions) == 2
        assert res.receipt_no is not None

        # Check allocations
        for tx in res.transactions:
            assert len(tx.allocations) == 1
            assert tx.allocations[0].invoice_id == invoice_id


@pytest.mark.asyncio
async def test_idempotency_key_duplicate_prevention():
    """Verify submitting same idempotency key returns existing records without duplicate creation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    invoice_id = f"INV-IDEM-{unique_suffix.upper()}"
    idempotency_key = f"IDEM-ONCE-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        req = ProcessPaymentRequest(
            reference_doc_type="POS_BILL",
            reference_doc_id=invoice_id,
            tenders=[PaymentTenderItem(tender_type="CARD", amount=1500.0, gateway_reference="AUTH123")],
            idempotency_key=idempotency_key,
            auto_allocate=True,
        )

        # First call
        res1 = await PaymentsEngine.process_payment(session, "COMP-001", req, created_by="usr-super")
        tx1_id = res1.transactions[0].id

        # Second call with exact same idempotency_key
        res2 = await PaymentsEngine.process_payment(session, "COMP-001", req, created_by="usr-super")
        tx2_id = res2.transactions[0].id

        assert tx1_id == tx2_id
        assert res2.total_amount == 1500.00


@pytest.mark.asyncio
async def test_full_and_partial_refund_with_balance_guard():
    """Verify full and partial refunds with balance tracking and over-refund guard."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    idempotency_key = f"IDEM-REF-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create initial ₹1000 payment
        pay_req = ProcessPaymentRequest(
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=f"INV-REF-ORIG-{unique_suffix.upper()}",
            tenders=[PaymentTenderItem(tender_type="UPI", amount=1000.0)],
            idempotency_key=idempotency_key,
        )
        pay_res = await PaymentsEngine.process_payment(session, "COMP-001", pay_req, created_by="usr-super")
        orig_tx_id = pay_res.transactions[0].id

        # 1. Partial refund ₹300 -> ₹700 remaining
        ref1 = await PaymentsEngine.process_refund(
            session=session,
            company_id="COMP-001",
            req=PaymentRefundRequest(
                payment_transaction_id=orig_tx_id,
                refund_amount=300.0,
                reason="Customer returned 1 item",
                idempotency_key=f"REF-KEY1-{unique_suffix}",
            ),
            created_by="usr-super",
        )
        assert ref1.status == "PARTIAL_REFUND"
        assert ref1.remaining_balance == 700.00

        # 2. Over-refund attempt ₹800 (when only ₹700 available) -> Must raise ValueError
        with pytest.raises(ValueError, match="exceeds available refundable balance"):
            await PaymentsEngine.process_refund(
                session=session,
                company_id="COMP-001",
                req=PaymentRefundRequest(
                    payment_transaction_id=orig_tx_id,
                    refund_amount=800.0,
                    reason="Excessive refund",
                    idempotency_key=f"REF-KEY-FAIL-{unique_suffix}",
                ),
            )

        # 3. Final refund ₹700 -> Remaining ₹0 -> status REFUND_SUCCESS
        ref2 = await PaymentsEngine.process_refund(
            session=session,
            company_id="COMP-001",
            req=PaymentRefundRequest(
                payment_transaction_id=orig_tx_id,
                refund_amount=700.0,
                reason="Customer returned remaining items",
                idempotency_key=f"REF-KEY2-{unique_suffix}",
            ),
            created_by="usr-super",
        )
        assert ref2.status == "REFUND_SUCCESS"
        assert ref2.remaining_balance == 0.00


@pytest.mark.asyncio
async def test_payment_allocation_across_invoices():
    """Verify allocating an unallocated payment across multiple invoices with limit enforcement."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    idempotency_key = f"IDEM-ALLOC-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create ₹2000 unallocated payment (auto_allocate=False)
        pay_req = ProcessPaymentRequest(
            reference_doc_type="ADVANCE_PAYMENT",
            reference_doc_id=f"ADV-{unique_suffix.upper()}",
            party_id=f"pty_{unique_suffix}",
            tenders=[PaymentTenderItem(tender_type="BANK_TRANSFER", amount=2000.0)],
            idempotency_key=idempotency_key,
            auto_allocate=False,
        )
        pay_res = await PaymentsEngine.process_payment(session, "COMP-001", pay_req, created_by="usr-super")
        tx_id = pay_res.transactions[0].id

        # 1. Allocate ₹1200 to Invoice A
        alloc1 = await PaymentsEngine.allocate_payment(
            session=session,
            company_id="COMP-001",
            payment_id=tx_id,
            req=PaymentAllocationRequest(invoice_id=f"INV-A-{unique_suffix}", allocated_amount=1200.0),
        )
        assert alloc1.allocated_amount == 1200.0

        # 2. Allocate ₹800 to Invoice B
        alloc2 = await PaymentsEngine.allocate_payment(
            session=session,
            company_id="COMP-001",
            payment_id=tx_id,
            req=PaymentAllocationRequest(invoice_id=f"INV-B-{unique_suffix}", allocated_amount=800.0),
        )
        assert alloc2.allocated_amount == 800.0

        # 3. Attempt to allocate additional ₹100 -> Must raise ValueError (payment fully allocated)
        with pytest.raises(ValueError, match="exceeds unallocated payment balance"):
            await PaymentsEngine.allocate_payment(
                session=session,
                company_id="COMP-001",
                payment_id=tx_id,
                req=PaymentAllocationRequest(invoice_id=f"INV-C-{unique_suffix}", allocated_amount=100.0),
            )


@pytest.mark.asyncio
async def test_payment_receipt_generation():
    """Verify generating structured official payment receipt."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    invoice_id = f"INV-RCPT-{unique_suffix.upper()}"
    idempotency_key = f"IDEM-RCPT-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        pay_req = ProcessPaymentRequest(
            reference_doc_type="SALES_INVOICE",
            reference_doc_id=invoice_id,
            party_id=f"pty_{unique_suffix}",
            tenders=[
                PaymentTenderItem(tender_type="CASH", amount=400.0),
                PaymentTenderItem(tender_type="CARD", amount=600.0, gateway_reference="CARD-TXN-001"),
            ],
            idempotency_key=idempotency_key,
            auto_allocate=True,
        )
        await PaymentsEngine.process_payment(session, "COMP-001", pay_req, created_by="usr-super")

        receipt = await PaymentsEngine.generate_payment_receipt(session, "COMP-001", invoice_id)
        assert receipt.total_paid == 1000.00
        assert len(receipt.tenders) == 2
        assert len(receipt.allocations) == 2
        assert receipt.receipt_no.startswith("RCP-")


@pytest.mark.asyncio
async def test_api_payments_endpoints():
    """Verify REST API payments endpoints: /process, /refund, /allocate, /receipt, /transactions."""
    unique_suffix = uuid.uuid4().hex[:4]
    invoice_id = f"INV-API-{unique_suffix.upper()}"
    idempotency_key = f"IDEM-API-{unique_suffix.upper()}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Process payment via API
        pay_res = await client.post(
            "/api/v1/payments/process",
            json={
                "reference_doc_type": "POS_BILL",
                "reference_doc_id": invoice_id,
                "tenders": [{"tender_type": "UPI", "amount": 850.0, "gateway_reference": "UPI123"}],
                "idempotency_key": idempotency_key,
                "auto_allocate": True,
            },
            headers=_get_auth_headers(),
        )
        assert pay_res.status_code == 201
        pay_data = pay_res.json()
        assert pay_data["total_amount"] == 850.0
        tx_id = pay_data["transactions"][0]["id"]

        # 2. Get Receipt via API
        rcpt_res = await client.get(
            f"/api/v1/payments/receipt/{invoice_id}",
            headers=_get_auth_headers(),
        )
        assert rcpt_res.status_code == 200
        assert rcpt_res.json()["total_paid"] == 850.0

        # 3. Query transactions via API
        query_res = await client.get(
            "/api/v1/payments/transactions",
            params={"reference_doc_id": invoice_id},
            headers=_get_auth_headers(),
        )
        assert query_res.status_code == 200
        assert len(query_res.json()) >= 1

        # 4. Refund partial payment via API
        ref_res = await client.post(
            "/api/v1/payments/refund",
            json={
                "payment_transaction_id": tx_id,
                "refund_amount": 250.0,
                "reason": "Return item",
                "idempotency_key": f"REF-API-{unique_suffix.upper()}",
            },
            headers=_get_auth_headers(),
        )
        assert ref_res.status_code == 201
        assert ref_res.json()["refund_amount"] == 250.0
        assert ref_res.json()["remaining_balance"] == 600.0
