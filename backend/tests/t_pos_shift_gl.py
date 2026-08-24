"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, date
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext, get_db, get_tenant_context, get_current_user
from app.models.auth import User, UserRole
from app.models.pos import CashRegister, Shift
from app.models.sales import SalesInvoice
from app.models.accounting import JournalVoucher, GeneralLedgerEntry, Account
from app.services.pos import POSService
from app.services.unified_ledger import UnifiedAccountingLedgerService
from app.schemas.pos import ShiftOpen, ShiftClose, CashRegisterCreate


async def ensure_test_cashier(session: AsyncSession, cashier_id: str = "usr-cashier-pos") -> str:
    """Ensures a user exists in the database to satisfy Shift.cashier_id foreign key constraint."""
    stmt = select(User).where(User.id == cashier_id)
    u = (await session.execute(stmt)).scalar_one_or_none()
    if not u:
        u = User(
            id=cashier_id,
            uuid=str(uuid.uuid4()),
            username=f"cashier_{cashier_id}_{uuid.uuid4().hex[:4]}",
            email=f"{cashier_id}_{uuid.uuid4().hex[:4]}@smritibooks.com",
            hashed_password="hashed_test_password",
            role=UserRole.CASHIER,
            is_active=True,
            is_deleted=False
        )
        session.add(u)
        await session.commit()
    return cashier_id


@pytest.mark.asyncio
async def test_shift_close_zero_variance_no_adjustment_needed():
    """Verify that a shift with zero cash variance closes cleanly with no shortage/overage adjustment needed."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-c1-{unique_suffix}")

        # 1. Create Register
        pos_svc = POSService(session, tenant)
        reg_id = f"REG-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter ZeroVar {unique_suffix}",
            code=f"POS-{unique_suffix}"
        ))

        # 2. Open Shift with ₹5,000 opening cash
        shift_id = f"SH-{unique_suffix}"
        shift = await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("5000.00")),
            cashier_id=cashier_id
        )
        assert shift.status == "OPEN"
        assert shift.opening_balance == Decimal("5000.00")

        # 3. Simulate Sales Invoice of ₹1,200 Cash
        inv = SalesInvoice(
            id=f"INV-{unique_suffix}",
            invoice_no=f"POS-INV-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CASH",
            grand_total=Decimal("1200.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        session.add(inv)
        await session.flush()

        # 4. Close Shift with exact ₹6,200 cash (Zero variance)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("6200.00"), closing_notes="Perfect cash match"),
            requesting_user_id=cashier_id
        )
        assert closed_shift.status == "CLOSED"
        assert closed_shift.cash_sales_total == Decimal("1200.00")
        assert closed_shift.expected_cash == Decimal("6200.00")
        assert closed_shift.variance == Decimal("0.00")

        # 5. Check that post_shift_close_to_gl returns None for zero variance
        gl_v = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id=company_id,
            shift_id=shift_id,
            branch_id=branch_id
        )
        assert gl_v is None


@pytest.mark.asyncio
async def test_shift_close_cash_shortage_gl_balancing_posting():
    """Verify that a cash shortage (variance < 0) automatically posts Debit 5070 (Shortage) / Credit 1010 (Cash)."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-c2-{unique_suffix}")

        # 1. Create Register
        pos_svc = POSService(session, tenant)
        reg_id = f"REG-SHORT-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Short {unique_suffix}",
            code=f"PSH-{unique_suffix}"
        ))

        # 2. Open Shift with ₹4,000 opening cash
        shift_id = f"SH-SHORT-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("4000.00")),
            cashier_id=cashier_id
        )

        # 3. Simulate Cash Sale ₹2,000 -> Expected Cash = ₹6,000
        inv = SalesInvoice(
            id=f"INV-S-{unique_suffix}",
            invoice_no=f"POS-INVS-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CASH",
            grand_total=Decimal("2000.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        session.add(inv)
        await session.flush()

        # 4. Close Shift with counted cash ₹5,750 (Shortage = ₹250.00)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("5750.00"), closing_notes="Register short by 250"),
            requesting_user_id=cashier_id
        )
        assert closed_shift.status == "CLOSED"
        assert closed_shift.expected_cash == Decimal("6000.00")
        assert closed_shift.variance == Decimal("-250.00")

        # 5. Verify the posted GL voucher
        stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift_id
        )
        jv = (await session.execute(stmt)).scalar_one_or_none()
        assert jv is not None
        assert jv.voucher_type == "SHIFT_CLOSE"
        assert jv.total_debit == Decimal("250.00")
        assert jv.total_credit == Decimal("250.00")

        # Verify General Ledger Entries
        gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(gle_stmt)).scalars().all()
        assert len(entries) == 2

        acc_shortage = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "5070")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")

        shortage_entry = next(e for e in entries if e.account_id == acc_shortage.id)
        cash_entry = next(e for e in entries if e.account_id == acc_cash.id)

        assert shortage_entry.debit_amount == Decimal("250.00")
        assert shortage_entry.credit_amount == Decimal("0.00")
        assert cash_entry.debit_amount == Decimal("0.00")
        assert cash_entry.credit_amount == Decimal("250.00")


@pytest.mark.asyncio
async def test_shift_close_cash_overage_gl_balancing_posting():
    """Verify that a cash overage (variance > 0) automatically posts Debit 1010 (Cash) / Credit 4050 (Overage)."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-c3-{unique_suffix}")

        # 1. Create Register
        pos_svc = POSService(session, tenant)
        reg_id = f"REG-OVER-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Over {unique_suffix}",
            code=f"POV-{unique_suffix}"
        ))

        # 2. Open Shift with ₹3,000 opening cash
        shift_id = f"SH-OVER-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("3000.00")),
            cashier_id=cashier_id
        )

        # 3. Simulate Cash Sale ₹1,500 and Card Sale ₹1,000 -> Expected Cash = ₹4,500
        inv1 = SalesInvoice(
            id=f"INV-O1-{unique_suffix}",
            invoice_no=f"POS-INVO1-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CASH",
            grand_total=Decimal("1500.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        inv2 = SalesInvoice(
            id=f"INV-O2-{unique_suffix}",
            invoice_no=f"POS-INVO2-{unique_suffix}",
            company_id=company_id,
            branch_id=branch_id,
            shift_id=shift_id,
            payment_mode="CARD",
            grand_total=Decimal("1000.00"),
            tax_total=Decimal("0.00"),
            status="PAID",
            is_active=True,
            is_deleted=False
        )
        session.add_all([inv1, inv2])
        await session.flush()

        # 4. Close Shift with counted cash ₹4,680 (Overage = ₹180.00)
        closed_shift = await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("4680.00"), closing_notes="Register surplus of 180"),
            requesting_user_id=cashier_id
        )
        assert closed_shift.status == "CLOSED"
        assert closed_shift.cash_sales_total == Decimal("1500.00")
        assert closed_shift.card_sales_total == Decimal("1000.00")
        assert closed_shift.expected_cash == Decimal("4500.00")
        assert closed_shift.variance == Decimal("180.00")

        # 5. Verify the posted GL voucher
        stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift_id
        )
        jv = (await session.execute(stmt)).scalar_one_or_none()
        assert jv is not None
        assert jv.voucher_type == "SHIFT_CLOSE"
        assert jv.total_debit == Decimal("180.00")
        assert jv.total_credit == Decimal("180.00")

        # Verify General Ledger Entries
        gle_stmt = select(GeneralLedgerEntry).where(GeneralLedgerEntry.voucher_id == jv.id)
        entries = (await session.execute(gle_stmt)).scalars().all()
        assert len(entries) == 2

        acc_overage = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "4050")
        acc_cash = await UnifiedAccountingLedgerService.get_account_by_code(session, company_id, "1010")

        cash_entry = next(e for e in entries if e.account_id == acc_cash.id)
        overage_entry = next(e for e in entries if e.account_id == acc_overage.id)

        assert cash_entry.debit_amount == Decimal("180.00")
        assert cash_entry.credit_amount == Decimal("0.00")
        assert overage_entry.debit_amount == Decimal("0.00")
        assert overage_entry.credit_amount == Decimal("180.00")


@pytest.mark.asyncio
async def test_shift_close_gl_posting_idempotent():
    """Verify that calling post_shift_close_to_gl repeatedly returns the existing voucher and does not duplicate."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-c4-{unique_suffix}")

        pos_svc = POSService(session, tenant)
        reg_id = f"REG-IDEMP-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Idemp {unique_suffix}",
            code=f"PID-{unique_suffix}"
        ))

        shift_id = f"SH-IDEMP-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        # Close shift with ₹50 shortage
        await pos_svc.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("950.00")),
            requesting_user_id=cashier_id
        )

        # Call post_shift_close_to_gl again
        v1 = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id=company_id,
            shift_id=shift_id
        )
        v2 = await UnifiedAccountingLedgerService.post_shift_close_to_gl(
            session=session,
            company_id=company_id,
            shift_id=shift_id
        )

        assert v1 is not None
        assert v2 is not None
        assert v1.id == v2.id

        # Verify only 1 voucher exists in DB
        stmt = select(JournalVoucher).where(
            JournalVoucher.company_id == company_id,
            JournalVoucher.reference_doc_type == "POS_SHIFT",
            JournalVoucher.reference_doc_id == shift_id
        )
        vouchers = (await session.execute(stmt)).scalars().all()
        assert len(vouchers) == 1


@pytest.mark.asyncio
async def test_unclosed_shift_gl_posting_rejected():
    """Verify that attempting to post GL voucher on an OPEN shift is rejected with 400."""
    session_factory = get_company_sessionmaker("smriti001")
    company_id = "COMP-001"
    branch_id = "BR-001"
    tenant = TenantContext(company_id=company_id, branch_id=branch_id)
    unique_suffix = uuid.uuid4().hex[:6]

    async with session_factory() as session:
        cashier_id = await ensure_test_cashier(session, f"usr-c5-{unique_suffix}")

        pos_svc = POSService(session, tenant)
        reg_id = f"REG-UNCL-{unique_suffix}"
        await pos_svc.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Counter Unclosed {unique_suffix}",
            code=f"PUN-{unique_suffix}"
        ))

        shift_id = f"SH-UNCL-{unique_suffix}"
        await pos_svc.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )

        with pytest.raises(HTTPException) as exc:
            await UnifiedAccountingLedgerService.post_shift_close_to_gl(
                session=session,
                company_id=company_id,
                shift_id=shift_id
            )
        assert exc.value.status_code == 400
        assert "unclosed" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_api_pos_z_report_endpoint():
    """Verify GET /api/v1/pos/shifts/{shift_id}/z-report returns comprehensive shift summary & GL voucher link."""
    session_factory = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    mgr_id = f"usr-mgr-{unique_suffix}"

    async with session_factory() as session:
        await ensure_test_cashier(session, mgr_id)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_tenant_context():
        return TenantContext(company_id="COMP-001", branch_id="BR-001")

    async def override_get_current_user():
        return User(
            id=mgr_id,
            username=f"pos_manager_{unique_suffix}",
            role=UserRole.MANAGER,
            company_id="COMP-001",
            branch_id="BR-001"
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_tenant_context] = override_get_tenant_context
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)
    reg_id = f"REG-API-{unique_suffix}"
    shift_id = f"SH-API-{unique_suffix}"

    # 1. Create Register
    reg_res = client.post("/api/v1/registers/", json={
        "id": reg_id,
        "name": f"API Counter {unique_suffix}",
        "code": f"APIREG-{unique_suffix}"
    })
    assert reg_res.status_code == 201

    # 2. Open Shift
    open_res = client.post("/api/v1/pos/shifts/open", json={
        "id": shift_id,
        "register_id": reg_id,
        "opening_balance": 2000.00
    })
    assert open_res.status_code == 201

    # 3. Close Shift with ₹100 overage
    close_res = client.post(f"/api/v1/pos/shifts/close/{shift_id}", json={
        "closing_balance": 2100.00,
        "closing_notes": "API test close"
    })
    assert close_res.status_code == 200
    close_data = close_res.json()
    assert close_data["status"] == "CLOSED"
    assert float(close_data["variance"]) == 100.00

    # 4. Get Z-Report
    z_res = client.get(f"/api/v1/pos/shifts/{shift_id}/z-report")
    assert z_res.status_code == 200
    z_data = z_res.json()
    assert z_data["shift_id"] == shift_id
    assert z_data["status"] == "CLOSED"
    assert float(z_data["opening_balance"]) == 2000.00
    assert float(z_data["closing_balance"]) == 2100.00
    assert z_data["gl_voucher_id"] is not None
    assert z_data["gl_voucher_no"].startswith("JV-")

    # Clean up overrides
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pos_shift_gl_tenant_isolation():
    """Verify that POS shifts and GL balancing vouchers are strictly isolated between smriti001 and smriti002."""
    session_factory_1 = get_company_sessionmaker("smriti001")
    session_factory_2 = get_company_sessionmaker("smriti002")

    unique_suffix = uuid.uuid4().hex[:6]
    shift_id = f"SH-ISO-{unique_suffix}"

    async with session_factory_1() as session1:
        cashier_id = await ensure_test_cashier(session1, f"usr-iso-{unique_suffix}")
        tenant1 = TenantContext(company_id="COMP-001", branch_id="BR-001")
        pos_svc1 = POSService(session1, tenant1)
        reg_id = f"REG-ISO-{unique_suffix}"
        await pos_svc1.create_register(CashRegisterCreate(
            id=reg_id,
            name=f"Iso Counter {unique_suffix}",
            code=f"ISO-{unique_suffix}"
        ))
        await pos_svc1.open_shift(
            ShiftOpen(id=shift_id, register_id=reg_id, opening_balance=Decimal("1000.00")),
            cashier_id=cashier_id
        )
        await pos_svc1.close_shift(
            shift_id=shift_id,
            req=ShiftClose(closing_balance=Decimal("900.00")),
            requesting_user_id=cashier_id
        )

    # In smriti002, the shift must NOT exist
    async with session_factory_2() as session2:
        stmt = select(Shift).where(Shift.id == shift_id)
        res = (await session2.execute(stmt)).scalar_one_or_none()
        assert res is None

        # And GL voucher must NOT exist
        jv_stmt = select(JournalVoucher).where(JournalVoucher.reference_doc_id == shift_id)
        jv_res = (await session2.execute(jv_stmt)).scalar_one_or_none()
        assert jv_res is None
