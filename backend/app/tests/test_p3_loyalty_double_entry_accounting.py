"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

"""
Phase P3 Customer Loyalty Points Double-Entry Accounting & POS Redemption Test Suite.
Verifies:
1. Idempotent COA auto-provisioning of accounts 2070 (Liability), 5080 (Expense), and 4060 (Revenue).
2. Points accrual produces balanced JournalVoucher with DR 5080 / CR 2070 and party_id = customer_id.
3. Points redemption at POS/checkout produces balanced JournalVoucher with DR 2070 / CR 1030 with zero cash impact.
4. Concurrency & Overdraft Guard: Pessimistic row locking on LoyaltyMember blocks over-redemption.
5. Non-enrolled customer loyalty tender fails closed with business-friendly error.
6. Points reversal on return/clawback produces balanced JournalVoucher with DR 2070 / CR 5080.
7. Points expiry (breakage recognition) produces balanced JournalVoucher with DR 2070 / CR 4060.
8. POSService loyalty balance calculation and multi-tender POS checkout with loyalty points.
9. POS checkout over-redemption guard raises 400 fail-closed.
10. Loyalty tender refund reinstates member points and posts reverse GL voucher.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
import pytest
from fastapi import HTTPException
from sqlalchemy import select, func

from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.models.loyalty import LoyaltyTier, LoyaltyMember, LoyaltyPointsLedger
from app.models.payment_ledger import PaymentTransaction
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.models.pos import CashRegister, Shift
from app.models.inventory import Product
from app.models.profitability import ProductCostValuation
from app.api.deps import TenantContext
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.services.payments_engine import PaymentsEngine
from app.services.pos import POSService
from app.schemas.payments import (
    ProcessPaymentRequest,
    PaymentTenderItem,
    PaymentRefundRequest,
)
from app.schemas.pos import (
    POSCheckoutRequest,
    POSCheckoutItem,
    POSTenderItem,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

async def _setup_test_environment(db, suffix: str):
    cid = f"COMP-P3-{suffix}"
    bid = f"BR-P3-{suffix}"
    code_part = uuid.uuid4().hex[:6].upper()

    company = Company(
        id=cid,
        company_code=f"C{code_part}",
        name=f"P3 Loyalty Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=f"B{code_part}",
        company_id=cid,
        name=f"P3 Loyalty Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    from app.models.inventory import Warehouse
    warehouse = Warehouse(
        id=f"wh-p3-{suffix}",
        company_id=cid,
        branch_id=bid,
        code=f"WH-P3-{suffix[:4].upper()}",
        name=f"P3 Warehouse {suffix}",
        address="POS Test Warehouse",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([company, branch])
    await db.flush()
    db.add(warehouse)
    await db.commit()

    user = User(
        id=f"usr-p3-{suffix}",
        username=f"user_p3_{suffix}",
        email=f"p3_{suffix}@smritibooks.com",
        hashed_password="mock_hash",
        role=UserRole.MANAGER,
        company_id=cid,
        branch_id=bid,
        is_active=True,
        is_deleted=False,
    )
    customer = Customer(
        id=f"CUST-P3-{suffix}",
        company_id=cid,
        branch_id=bid,
        name=f"P3 Customer {suffix}",
        mobile=f"98765{suffix[:5]}",
        email=f"customer_p3_{suffix}@example.com",
        is_active=True,
        is_deleted=False,
    )
    db.add_all([user, customer])
    await db.commit()

    tenant_ctx = TenantContext(company_id=cid, branch_id=bid)
    return company, branch, user, customer, tenant_ctx


async def _setup_loyalty_tier(db, company_id: str, name: str = "Gold", ratio: Decimal = Decimal("1.00")):
    tier_id = f"tier-p3-{uuid.uuid4().hex[:8]}"
    tier = LoyaltyTier(
        id=tier_id,
        company_id=company_id,
        name=f"{name}-{uuid.uuid4().hex[:6]}",
        min_spend=Decimal("1000.00"),
        earn_multiplier=Decimal("1.50"),
        redemption_ratio=ratio,
        is_active=True,
        is_deleted=False,
    )
    db.add(tier)
    await db.commit()
    await db.refresh(tier)
    return tier


async def _enroll_customer(db, company_id: str, customer_id: str, tier_id: str, initial_points: Decimal = Decimal("0.00")):
    member_id = f"lm-p3-{uuid.uuid4().hex[:8]}"
    member = LoyaltyMember(
        id=member_id,
        company_id=company_id,
        customer_id=customer_id,
        loyalty_tier_id=tier_id,
        card_number=f"CARD-{uuid.uuid4().hex[:8].upper()}",
        total_points_earned=initial_points,
        total_points_redeemed=Decimal("0.00"),
        current_points_balance=initial_points,
        total_lifetime_spend=Decimal("0.00"),
        is_active=True,
        is_deleted=False,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def _setup_sales_invoice(db, company_id: str, branch_id: str, customer_id: str, grand_total: Decimal = Decimal("500.00")):
    inv_id = f"inv-p3-{uuid.uuid4().hex[:8]}"
    inv = SalesInvoice(
        id=inv_id,
        company_id=company_id,
        branch_id=branch_id,
        invoice_no=f"INV-P3-{uuid.uuid4().hex[:6].upper()}",
        date=date.today(),
        customer_id=customer_id,
        customer_name="P3 Customer",
        grand_total=grand_total,
        paid_amount=Decimal("0.00"),
        balance_amount=grand_total,
        status="Submitted",
        is_active=True,
        is_deleted=False,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

async def test_p3_coa_provisioning_loyalty_accounts(db_session):
    """
    Test 1: Verify idempotent COA auto-provisioning for 2070, 5080, and 4060.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)

    # First run of seed_default_chart_of_accounts
    await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
        db_session, company.id, branch.id
    )

    # Verify accounts are registered
    acc_2070 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company.id, "2070")
    assert acc_2070 is not None
    assert acc_2070.account_name == "Customer Loyalty Points Liability"
    assert acc_2070.account_type == "LIABILITY"
    assert acc_2070.root_type == "LIABILITY"
    assert acc_2070.party_type == "CUSTOMER"

    acc_5080 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company.id, "5080")
    assert acc_5080 is not None
    assert acc_5080.account_name == "Customer Loyalty & Reward Program Expense"
    assert acc_5080.account_type == "EXPENSE"
    assert acc_5080.root_type == "EXPENSE"

    acc_4060 = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company.id, "4060")
    assert acc_4060 is not None
    assert acc_4060.account_name == "Loyalty Points Breakage & Expiry Income"
    assert acc_4060.account_type == "REVENUE"
    assert acc_4060.root_type == "INCOME"

    # Second run to assert strict idempotency
    await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
        db_session, company.id, branch.id
    )
    acc_2070_again = await UnifiedAccountingLedgerService.get_account_by_code(db_session, company.id, "2070")
    assert acc_2070_again.id == acc_2070.id


async def test_p3_loyalty_points_accrual_gl_posting(db_session):
    """
    Test 2: Points accrual creates balanced JournalVoucher DR 5080 / CR 2070 with zero cash impact.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    inv = await _setup_sales_invoice(db_session, company.id, branch.id, customer.id, Decimal("1000.00"))

    # Accrue 150 points with monetary value of ₹150.00
    points = Decimal("150.00")
    monetary_val = Decimal("150.00")

    voucher = await UnifiedAccountingLedgerService.post_loyalty_accrual_to_gl(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        points=points,
        monetary_value=monetary_val,
        reference_invoice_id=inv.id,
        reference_invoice_no=inv.invoice_no,
        branch_id=branch.id,
        created_by=user.username,
    )
    await db_session.commit()

    assert voucher is not None
    assert voucher.voucher_type == "LOYALTY_ACCRUAL"
    assert voucher.total_debit == monetary_val
    assert voucher.total_credit == monetary_val
    assert voucher.is_posted is True

    # Inspect General Ledger entries
    stmt_gle = select(GeneralLedgerEntry).where(
        GeneralLedgerEntry.voucher_id == voucher.id,
        GeneralLedgerEntry.is_deleted == False
    )
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    # Map by account code
    acc_map = {}
    for e in entries:
        acc = await db_session.get(Account, e.account_id)
        acc_map[acc.account_code] = e

    assert "5080" in acc_map
    assert "2070" in acc_map
    assert acc_map["5080"].debit_amount == monetary_val
    assert acc_map["5080"].credit_amount == Decimal("0.00")
    assert acc_map["2070"].debit_amount == Decimal("0.00")
    assert acc_map["2070"].credit_amount == monetary_val
    assert acc_map["2070"].party_id == customer.id

    # Verify idempotency on second call
    voucher_replayed = await UnifiedAccountingLedgerService.post_loyalty_accrual_to_gl(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        points=points,
        monetary_value=monetary_val,
        reference_invoice_id=inv.id,
        reference_invoice_no=inv.invoice_no,
        branch_id=branch.id,
        created_by=user.username,
    )
    assert voucher_replayed.id == voucher.id


async def test_p3_loyalty_points_redemption_payments_engine(db_session):
    """
    Test 3: Points redemption via PaymentsEngine deducts member points and posts DR 2070 / CR 1030 with zero cash impact.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    tier = await _setup_loyalty_tier(db_session, company.id, name="Platinum", ratio=Decimal("1.00"))
    member = await _enroll_customer(db_session, company.id, customer.id, tier.id, initial_points=Decimal("300.00"))
    inv = await _setup_sales_invoice(db_session, company.id, branch.id, customer.id, Decimal("500.00"))

    # Multi-tender: ₹100 via LOYALTY, ₹400 via CASH
    tenders = [
        PaymentTenderItem(tender_type="LOYALTY", amount=100.00, notes="Loyalty points tender"),
        PaymentTenderItem(tender_type="CASH", amount=400.00, notes="Cash tender"),
    ]
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=customer.id,
        tenders=tenders,
        idempotency_key=f"IDEMP-P3-{uuid.uuid4().hex[:8]}",
        branch_id=branch.id,
        auto_allocate=True,
    )

    res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company.id,
        req=pay_req,
        created_by=user.username,
        commit=True,
    )

    assert res.status == "SUCCESS"
    assert Decimal(str(res.total_amount)) == Decimal("500.00")
    assert len(res.transactions) == 2

    # Check member points balance
    await db_session.refresh(member)
    assert member.current_points_balance == Decimal("200.00")
    assert member.total_points_redeemed == Decimal("100.00")

    # Check LoyaltyPointsLedger entry
    stmt_lpl = select(LoyaltyPointsLedger).where(
        LoyaltyPointsLedger.member_id == member.id,
        LoyaltyPointsLedger.transaction_type == "REDEEM",
        LoyaltyPointsLedger.is_deleted == False
    )
    lpl = (await db_session.execute(stmt_lpl)).scalars().first()
    assert lpl is not None
    assert lpl.points == Decimal("-100.00")
    assert lpl.reference_invoice_id == inv.id

    # Check GL postings for LOYALTY transaction
    loyalty_tx = next(t for t in res.transactions if t.tender_type == "LOYALTY")
    stmt_v = select(JournalVoucher).where(
        JournalVoucher.reference_doc_id == loyalty_tx.id,
        JournalVoucher.company_id == company.id,
        JournalVoucher.is_deleted == False
    )
    voucher = (await db_session.execute(stmt_v)).scalars().first()
    assert voucher is not None
    assert voucher.total_debit == Decimal("100.00")
    assert voucher.total_credit == Decimal("100.00")

    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    gle_map = {}
    for e in entries:
        acc = await db_session.get(Account, e.account_id)
        gle_map[acc.account_code] = e

    # DR 2070 (Customer Loyalty Points Liability), CR 1030 (Accounts Receivable)
    assert "2070" in gle_map
    assert "1030" in gle_map
    assert gle_map["2070"].debit_amount == Decimal("100.00")
    assert gle_map["2070"].credit_amount == Decimal("0.00")
    assert gle_map["1030"].debit_amount == Decimal("0.00")
    assert gle_map["1030"].credit_amount == Decimal("100.00")
    assert gle_map["2070"].party_id == customer.id


async def test_p3_loyalty_redemption_overdraft_guard(db_session):
    """
    Test 4: Pessimistic lock & balance guard fails closed if tender exceeds available points.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    tier = await _setup_loyalty_tier(db_session, company.id, name="Silver", ratio=Decimal("1.00"))
    member = await _enroll_customer(db_session, company.id, customer.id, tier.id, initial_points=Decimal("50.00"))
    inv = await _setup_sales_invoice(db_session, company.id, branch.id, customer.id, Decimal("500.00"))

    # Attempt to redeem ₹100 when only 50 points (₹50) exist
    tenders = [
        PaymentTenderItem(tender_type="LOYALTY", amount=100.00),
    ]
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=customer.id,
        tenders=tenders,
        idempotency_key=f"IDEMP-P3-OVER-{uuid.uuid4().hex[:8]}",
        branch_id=branch.id,
    )

    with pytest.raises(ValueError) as exc_info:
        await PaymentsEngine.process_payment(
            session=db_session,
            company_id=company.id,
            req=pay_req,
            created_by=user.username,
            commit=True,
        )

    assert "exceeds available customer loyalty balance" in str(exc_info.value)

    # Balance must remain untouched
    await db_session.refresh(member)
    assert member.current_points_balance == Decimal("50.00")
    assert member.total_points_redeemed == Decimal("0.00")


async def test_p3_loyalty_redemption_non_enrolled_customer_fails(db_session):
    """
    Test 5: Non-enrolled customer attempting loyalty tender fails closed.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    inv = await _setup_sales_invoice(db_session, company.id, branch.id, customer.id, Decimal("200.00"))

    tenders = [
        PaymentTenderItem(tender_type="LOYALTY", amount=50.00),
    ]
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=customer.id,
        tenders=tenders,
        idempotency_key=f"IDEMP-P3-NOTENROLLED-{uuid.uuid4().hex[:8]}",
        branch_id=branch.id,
    )

    with pytest.raises(ValueError) as exc_info:
        await PaymentsEngine.process_payment(
            session=db_session,
            company_id=company.id,
            req=pay_req,
            created_by=user.username,
            commit=True,
        )

    assert "is not enrolled in the loyalty program" in str(exc_info.value)


async def test_p3_loyalty_points_reversal_gl_posting(db_session):
    """
    Test 6: Points reversal on return/clawback creates balanced JournalVoucher DR 2070 / CR 5080.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)

    points = Decimal("50.00")
    monetary_val = Decimal("50.00")
    ret_id = f"ret-p3-{uuid.uuid4().hex[:8]}"

    voucher = await UnifiedAccountingLedgerService.post_loyalty_reversal_to_gl(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        points=points,
        monetary_value=monetary_val,
        reference_return_id=ret_id,
        reference_return_no=f"RET-{suffix[:6]}",
        branch_id=branch.id,
        created_by=user.username,
    )
    await db_session.commit()

    assert voucher is not None
    assert voucher.voucher_type == "LOYALTY_REVERSAL"
    assert voucher.total_debit == monetary_val
    assert voucher.total_credit == monetary_val

    # Inspect lines: DR 2070 (Liability), CR 5080 (Expense)
    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    gle_map = {}
    for e in entries:
        acc = await db_session.get(Account, e.account_id)
        gle_map[acc.account_code] = e

    assert "2070" in gle_map
    assert "5080" in gle_map
    assert gle_map["2070"].debit_amount == monetary_val
    assert gle_map["2070"].credit_amount == Decimal("0.00")
    assert gle_map["5080"].debit_amount == Decimal("0.00")
    assert gle_map["5080"].credit_amount == monetary_val


async def test_p3_loyalty_points_expiry_breakage_gl_posting(db_session):
    """
    Test 7: Points expiry (breakage) creates balanced JournalVoucher DR 2070 / CR 4060.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)

    points = Decimal("75.00")
    monetary_val = Decimal("75.00")
    expiry_id = f"exp-p3-{uuid.uuid4().hex[:8]}"

    voucher = await UnifiedAccountingLedgerService.post_loyalty_expiry_to_gl(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        points=points,
        monetary_value=monetary_val,
        expiry_reference_id=expiry_id,
        branch_id=branch.id,
        created_by=user.username,
    )
    await db_session.commit()

    assert voucher is not None
    assert voucher.voucher_type == "LOYALTY_EXPIRY"
    assert voucher.total_debit == monetary_val
    assert voucher.total_credit == monetary_val

    # Inspect lines: DR 2070 (Liability), CR 4060 (Breakage Income)
    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == voucher.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    gle_map = {}
    for e in entries:
        acc = await db_session.get(Account, e.account_id)
        gle_map[acc.account_code] = e

    assert "2070" in gle_map
    assert "4060" in gle_map
    assert gle_map["2070"].debit_amount == monetary_val
    assert gle_map["2070"].credit_amount == Decimal("0.00")
    assert gle_map["4060"].debit_amount == Decimal("0.00")
    assert gle_map["4060"].credit_amount == monetary_val


async def test_p3_pos_service_loyalty_balance_and_checkout(db_session):
    """
    Test 8 & 9: POSService loyalty balance lookup and POS checkout with loyalty split tender.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    pos_svc = POSService(db_session, tenant_ctx)

    # 1. Non-enrolled balance check
    bal_un = await pos_svc.get_customer_loyalty_balance(customer.id)
    assert bal_un["is_enrolled"] is False
    assert bal_un["current_points_balance"] == Decimal("0.00")

    # 2. Enroll and set up points
    tier = await _setup_loyalty_tier(db_session, company.id, name="Diamond", ratio=Decimal("1.00"))
    member = await _enroll_customer(db_session, company.id, customer.id, tier.id, initial_points=Decimal("250.00"))

    # 3. Enrolled balance check
    bal_en = await pos_svc.get_customer_loyalty_balance(customer.id)
    assert bal_en["is_enrolled"] is True
    assert bal_en["current_points_balance"] == Decimal("250.00")
    assert bal_en["available_monetary_value"] == Decimal("250.00")

    # 4. Setup Shift and CashRegister for POS checkout
    reg = CashRegister(
        id=f"reg-p3-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"POS Register {suffix}",
        code=f"REG-{suffix[:4].upper()}",
        is_active=True,
        is_deleted=False,
    )
    shift = Shift(
        id=f"shift-p3-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        register_id=reg.id,
        cashier_id=user.id,
        status="OPEN",
        opened_at=datetime.now(timezone.utc),
        opening_balance=Decimal("1000.00"),
        is_active=True,
        is_deleted=False,
    )
    prod = Product(
        id=f"prod-p3-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        name=f"Product P3 {suffix}",
        category="General",
        code=f"SKU-P3-{suffix}",
        sku=f"SKU-P3-{suffix}",
        barcode=f"BAR-P3-{suffix}",
        mrp=Decimal("200.00"),
        cost_price=Decimal("80.00"),
        stock=Decimal("100.00"),
        is_active=True,
        is_deleted=False,
    )
    pcv = ProductCostValuation(
        id=f"pcv-p3-{suffix}",
        company_id=company.id,
        branch_id=branch.id,
        product_id=prod.id,
        weighted_average_cost=Decimal("80.00"),
        purchase_cost=Decimal("80.00"),
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([reg, shift, prod, pcv])
    await db_session.commit()

    # 5. Over-redemption in pos_checkout should raise HTTPException(400)
    over_checkout = POSCheckoutRequest(
        invoice_no=f"POS-INV-OVER-{suffix}",
        shift_id=shift.id,
        customer_id=customer.id,
        customer_name=customer.name,
        payment_mode="SPLIT",
        grand_total=Decimal("300.00"),
        items=[
            POSCheckoutItem(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("2"),
                price=Decimal("150.00"),
                mrp=Decimal("200.00"),
            )
        ],
        tenders=[
            POSTenderItem(tender_type="LOYALTY", amount=Decimal("280.00")), # Exceeds 250 available
            POSTenderItem(tender_type="CASH", amount=Decimal("20.00")),
        ]
    )
    with pytest.raises(HTTPException) as exc_info:
        await pos_svc.pos_checkout(over_checkout)
    assert exc_info.value.status_code == 400
    assert "exceeds available customer loyalty points balance" in str(exc_info.value.detail)

    # 6. Valid checkout: ₹100 LOYALTY + remaining CASH
    valid_checkout = POSCheckoutRequest(
        invoice_no=f"POS-INV-OK-{suffix}",
        shift_id=shift.id,
        customer_id=customer.id,
        customer_name=customer.name,
        payment_mode="SPLIT",
        grand_total=Decimal("300.00"),
        items=[
            POSCheckoutItem(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("2"),
                price=Decimal("150.00"),
                mrp=Decimal("200.00"),
            )
        ],
        tenders=[
            POSTenderItem(tender_type="LOYALTY", amount=Decimal("100.00")),
            POSTenderItem(tender_type="CASH", amount=Decimal("200.00")),
        ]
    )
    checkout_res = await pos_svc.pos_checkout(valid_checkout)
    assert checkout_res is not None
    inv_created = checkout_res["invoice"]
    assert inv_created is not None

    # Points balance must be 250 - 100 = 150
    bal_after = await pos_svc.get_customer_loyalty_balance(customer.id)
    assert bal_after["current_points_balance"] == Decimal("150.00")
    assert bal_after["available_monetary_value"] == Decimal("150.00")


async def test_p3_loyalty_payment_refund_reinstates_points_and_gl(db_session):
    """
    Test 10: Refund of a loyalty payment reinstates member points and generates reverse GL voucher.
    """
    suffix = uuid.uuid4().hex[:8]
    company, branch, user, customer, tenant_ctx = await _setup_test_environment(db_session, suffix)
    tier = await _setup_loyalty_tier(db_session, company.id, name="Elite", ratio=Decimal("1.00"))
    member = await _enroll_customer(db_session, company.id, customer.id, tier.id, initial_points=Decimal("200.00"))
    inv = await _setup_sales_invoice(db_session, company.id, branch.id, customer.id, Decimal("100.00"))

    # Pay full invoice with loyalty points
    tenders = [
        PaymentTenderItem(tender_type="LOYALTY", amount=100.00, notes="Loyalty full payment"),
    ]
    pay_req = ProcessPaymentRequest(
        reference_doc_type="SALES_INVOICE",
        reference_doc_id=inv.id,
        party_id=customer.id,
        tenders=tenders,
        idempotency_key=f"IDEMP-P3-REF-{uuid.uuid4().hex[:8]}",
        branch_id=branch.id,
        auto_allocate=True,
    )
    pay_res = await PaymentsEngine.process_payment(
        session=db_session,
        company_id=company.id,
        req=pay_req,
        created_by=user.username,
        commit=True,
    )
    assert pay_res.status == "SUCCESS"
    loyalty_tx = pay_res.transactions[0]

    # Verify points decremented to 100
    await db_session.refresh(member)
    assert member.current_points_balance == Decimal("100.00")

    # Refund the loyalty payment
    ref_req = PaymentRefundRequest(
        payment_transaction_id=loyalty_tx.id,
        refund_amount=100.00,
        reason="Customer returned goods paid via loyalty",
        idempotency_key=f"IDEMP-P3-REFUND-{uuid.uuid4().hex[:8]}",
    )
    ref_res = await PaymentsEngine.process_refund(
        session=db_session,
        company_id=company.id,
        req=ref_req,
        created_by=user.username,
        commit=True,
    )
    assert ref_res.status == "REFUND_SUCCESS"
    assert ref_res.remaining_balance == 0.0

    # Points must be reinstated to 200
    await db_session.refresh(member)
    assert member.current_points_balance == Decimal("200.00")

    # Verify LoyaltyPointsLedger reversal entry
    stmt_lpl = select(LoyaltyPointsLedger).where(
        LoyaltyPointsLedger.member_id == member.id,
        LoyaltyPointsLedger.transaction_type == "REVERSAL",
        LoyaltyPointsLedger.is_deleted == False
    )
    lpl_rev = (await db_session.execute(stmt_lpl)).scalars().first()
    assert lpl_rev is not None
    assert lpl_rev.points == Decimal("100.00")

    # Verify GL voucher for the refund
    stmt_rv = select(JournalVoucher).where(
        JournalVoucher.reference_doc_id == ref_res.refund_transaction_id,
        JournalVoucher.company_id == company.id,
        JournalVoucher.is_deleted == False
    )
    refund_voucher = (await db_session.execute(stmt_rv)).scalars().first()
    assert refund_voucher is not None
    assert refund_voucher.total_debit == Decimal("100.00")
    assert refund_voucher.total_credit == Decimal("100.00")

    # Lines: DR 1030 (Accounts Receivable reinstated), CR 2070 (Loyalty Points Liability restored)
    stmt_gle = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == refund_voucher.id)
    entries = (await db_session.execute(stmt_gle)).scalars().all()
    assert len(entries) == 2

    gle_map = {}
    for e in entries:
        acc = await db_session.get(Account, e.account_id)
        gle_map[acc.account_code] = e

    assert "1030" in gle_map
    assert "2070" in gle_map
    assert gle_map["1030"].debit_amount == Decimal("100.00")
    assert gle_map["1030"].credit_amount == Decimal("0.00")
    assert gle_map["2070"].debit_amount == Decimal("0.00")
    assert gle_map["2070"].credit_amount == Decimal("100.00")
