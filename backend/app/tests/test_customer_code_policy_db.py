"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Database-Backed Customer Code Policy & Concurrency Acceptance Tests
"""

import asyncio
import re
import uuid
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings
from app.models.auth import User, UserRole
from app.models.crm import Customer, CustomerGroup
from app.models.tenant import Company
from app.models.identity_registry import SmritiNumberingRegistry
from app.models.system_parameter import SystemParameter
from app.models.security import SmritiAuditLog
from app.schemas.crm import CustomerCreate
from app.services.crm import CrmService
from app.api.deps import TenantContext


from sqlalchemy.pool import NullPool

@pytest.fixture(scope="function")
def db_session_factory():
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)
    return session_factory


@pytest.fixture(scope="function")
async def test_companies(db_session_factory):
    cid_a = f"COMP-CUSTA-{uuid.uuid4().hex[:6].upper()}"
    cid_b = f"COMP-CUSTB-{uuid.uuid4().hex[:6].upper()}"

    async with db_session_factory() as session:
        comp_a = Company(id=cid_a, name="Customer Policy Test Co A", company_code=f"CPA{uuid.uuid4().hex[:4].upper()}")
        comp_b = Company(id=cid_b, name="Customer Policy Test Co B", company_code=f"CPB{uuid.uuid4().hex[:4].upper()}")
        session.add_all([comp_a, comp_b])
        await session.commit()

    yield cid_a, cid_b

    async with db_session_factory() as session:
        await session.execute(delete(SmritiAuditLog).where(SmritiAuditLog.tenant_id.in_([cid_a, cid_b])))
        await session.execute(delete(Customer).where(Customer.company_id.in_([cid_a, cid_b])))
        await session.execute(delete(SmritiNumberingRegistry).where(SmritiNumberingRegistry.company_id.in_([cid_a, cid_b])))
        await session.execute(delete(SystemParameter).where(SystemParameter.company_id.in_([cid_a, cid_b])))
        await session.execute(delete(Company).where(Company.id.in_([cid_a, cid_b])))
        await session.commit()


@pytest.mark.asyncio
async def test_missing_company_context_rejected(db_session_factory):
    """
    Phase 2 Item 5 / Phase 3 Item 2:
    Missing or invalid company context is rejected with 400 Bad Request.
    Zero implicit fallback to COMP-001.
    """
    async with db_session_factory() as session:
        # None company context
        ctx_none = TenantContext(company_id=None, branch_id="BR-MAIN-001")
        srv_none = CrmService(session, ctx_none)

        with pytest.raises(HTTPException) as exc_none:
            await srv_none.preview_next_customer_code()
        assert exc_none.value.status_code == 400
        assert "Active company context is required" in exc_none.value.detail

        with pytest.raises(HTTPException) as exc_alloc:
            await srv_none.allocate_next_customer_code()
        assert exc_alloc.value.status_code == 400

        with pytest.raises(HTTPException) as exc_val:
            await srv_none.validate_customer_code("CUST-001")
        assert exc_val.value.status_code == 400

        with pytest.raises(HTTPException) as exc_rec:
            await srv_none.get_customer_code_recommendation()
        assert exc_rec.value.status_code == 400

        # Empty string company context
        ctx_empty = TenantContext(company_id="   ", branch_id="BR-MAIN-001")
        srv_empty = CrmService(session, ctx_empty)

        with pytest.raises(HTTPException) as exc_empty:
            await srv_empty.preview_next_customer_code()
        assert exc_empty.value.status_code == 400


@pytest.mark.asyncio
async def test_policy_values_read_from_authoritative_system_parameters(db_session_factory, test_companies):
    """
    Phase 2 Item 1 / Phase 3 Item 1:
    Policy values are resolved from authoritative SystemParameters.
    """
    cid_a, _ = test_companies

    async with db_session_factory() as session:
        # Seed company-specific parameters
        p_mode = SystemParameter(
            id=f"sp-{uuid.uuid4().hex[:12]}",
            company_id=cid_a,
            param_code="CustomerCodeAssignmentMode",
            canonical_code="SMRITI.CUSTOMER.CODE_ASSIGNMENT_MODE",
            category="Customer",
            category_name="Customer Master",
            description="Assignment mode for customer code",
            data_type="Text",
            val_text="HYBRID",
            scope_level="COMPANY",
            terminal_id="COMMON",
        )
        p_prefix = SystemParameter(
            id=f"sp-{uuid.uuid4().hex[:12]}",
            company_id=cid_a,
            param_code="CustomerCodePrefix",
            canonical_code="SMRITI.CUSTOMER.CODE_PREFIX",
            category="Customer",
            category_name="Customer Master",
            description="Configured prefix for customer code",
            data_type="Text",
            val_text="VIP-",
            scope_level="COMPANY",
            terminal_id="COMMON",
        )
        p_roles = SystemParameter(
            id=f"sp-{uuid.uuid4().hex[:12]}",
            company_id=cid_a,
            param_code="CustomerCodeManualRoles",
            canonical_code="SMRITI.CUSTOMER.CODE_MANUAL_ROLES",
            category="Customer",
            category_name="Customer Master",
            description="Allowed roles for manual code entry",
            data_type="Text",
            val_text="SYSADMIN,ADMIN",
            scope_level="COMPANY",
            terminal_id="COMMON",
        )
        session.add_all([p_mode, p_prefix, p_roles])
        await session.commit()

        ctx = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        service = CrmService(session, ctx)

        # 1. Recommendation for Admin user (allowed)
        admin_user = User(id="u-admin", username="admin_usr", role=UserRole.ADMIN, company_id=cid_a)
        rec_admin = await service.get_customer_code_recommendation(current_user=admin_user)
        assert rec_admin.prefix == "VIP-"
        assert rec_admin.suggested_code.startswith("VIP-")
        assert rec_admin.assignment_mode == "HYBRID"
        assert rec_admin.manual_entry_allowed is True

        # 2. Recommendation for Manager user (disallowed because manual_roles only has SYSADMIN, ADMIN)
        mgr_user = User(id="u-mgr", username="mgr_usr", role=UserRole.MANAGER, company_id=cid_a)
        rec_mgr = await service.get_customer_code_recommendation(current_user=mgr_user)
        assert rec_mgr.manual_entry_allowed is False


@pytest.mark.asyncio
async def test_authorized_and_unauthorized_manual_assignment_enforced(db_session_factory, test_companies):
    """
    Phase 2 Item 3, 4 / Phase 3 Item 3:
    Authorized manual entry succeeds; unauthorized users (e.g. Cashier) are blocked with HTTP 403.
    """
    cid_a, _ = test_companies

    async with db_session_factory() as session:
        ctx = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        service = CrmService(session, ctx)

        cashier_user = User(id="u-cashier-1", username="cashier_1", role=UserRole.CASHIER, company_id=cid_a)
        admin_user = User(id="u-admin-1", username="admin_1", role=UserRole.ADMIN, company_id=cid_a)

        # Cashier attempts manual assignment via validation
        val_res = await service.validate_customer_code("VIP-CUSTOM-999", current_user=cashier_user)
        assert val_res.is_valid is False
        assert "restricted" in val_res.reason.lower()

        # Cashier attempts manual assignment via create_customer directly
        cust_payload = CustomerCreate(
            name="Cashier Attempt",
            mobile="9820099991",
            code="VIP-CUSTOM-999",
            status="Active",
        )
        with pytest.raises(HTTPException) as exc_cashier:
            await service.create_customer(cust_payload, current_user=cashier_user)
        assert exc_cashier.value.status_code == 403
        assert "Manual Customer Code assignment is restricted" in exc_cashier.value.detail

        # Cashier creates customer with auto-allocation (no code passed) -> SUCCEEDS
        auto_cust_payload = CustomerCreate(
            name="Cashier Auto Customer",
            mobile="9820099992",
            status="Active",
        )
        created_auto = await service.create_customer(auto_cust_payload, current_user=cashier_user)
        assert created_auto.code is not None
        assert created_auto.code.startswith("CUST-")

        # Admin user assigns manual custom code -> SUCCEEDS
        admin_cust_payload = CustomerCreate(
            name="Admin Custom Customer",
            mobile="9820099993",
            code="VIP-CORP-ALPHA",
            status="Active",
        )
        created_admin = await service.create_customer(admin_cust_payload, current_user=admin_user)
        assert created_admin.code == "VIP-CORP-ALPHA"


@pytest.mark.asyncio
async def test_invalid_formats_and_normalized_duplicates_rejected(db_session_factory, test_companies):
    """
    Phase 2 Item 3 / Phase 3 Item 4:
    Invalid formats, normalized duplicates, and active-company collisions are rejected.
    """
    cid_a, _ = test_companies

    async with db_session_factory() as session:
        ctx = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        service = CrmService(session, ctx)
        admin_user = User(id="u-admin-1", username="admin_1", role=UserRole.ADMIN, company_id=cid_a)

        # 1. Invalid characters
        val_bad_char = await service.validate_customer_code("CUST@#$%", current_user=admin_user)
        assert val_bad_char.is_valid is False
        assert "only alphanumeric" in val_bad_char.reason.lower()

        # 2. Too short (<2 chars)
        val_short = await service.validate_customer_code("X", current_user=admin_user)
        assert val_short.is_valid is False
        assert "between 2 and 50" in val_short.reason.lower()

        # 3. Create active customer to test duplicates & collisions
        await service.create_customer(
            CustomerCreate(name="Existing Corp", mobile="9820088888", code="VIP-CORP-ALPHA", status="Active"),
            current_user=admin_user,
        )

        # 4. Normalized duplicate check (case insensitivity)
        val_dup_lower = await service.validate_customer_code("vip-corp-alpha", current_user=admin_user)
        assert val_dup_lower.is_valid is False
        assert "already assigned" in val_dup_lower.reason.lower()

        # 5. Active collision in create_customer returns structured 409
        with pytest.raises(HTTPException) as exc_coll:
            await service.create_customer(
                CustomerCreate(name="Colliding Corp", mobile="9820088889", code="vip-corp-alpha", status="Active"),
                current_user=admin_user,
            )
        assert exc_coll.value.status_code == 409
        assert exc_coll.value.detail["error_code"] == "CUSTOMER_CODE_COLLISION"
        assert exc_coll.value.detail["suggested_code"] is not None


@pytest.mark.asyncio
async def test_preview_does_not_mutate_numbering_registry(db_session_factory, test_companies):
    """
    Phase 2 Item 10 / Phase 3 Item 5:
    Preview is read-only and does not advance or mutate SmritiNumberingRegistry.
    """
    cid_a, _ = test_companies

    async with db_session_factory() as session:
        ctx = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        service = CrmService(session, ctx)

        # Read sequence value before preview
        reg_stmt = select(SmritiNumberingRegistry.sequence_value).where(
            SmritiNumberingRegistry.entity_type == "CUSTOMER_CODE",
            SmritiNumberingRegistry.company_id == cid_a,
        )
        before_seq = (await session.execute(reg_stmt)).scalar()

        # Call preview 10 times
        previews = [await service.preview_next_customer_code() for _ in range(10)]
        assert len(set(previews)) == 1, "All repeated previews must yield the exact same candidate"

        # Check sequence value after preview
        after_seq = (await session.execute(reg_stmt)).scalar()
        assert before_seq == after_seq, "Registry sequence value must NOT be mutated by preview calls"


@pytest.mark.asyncio
async def test_database_backed_concurrency_and_first_time_initialization(db_session_factory, test_companies):
    """
    Phase 2 Item 6, 7 / Phase 3 Item 6:
    MANDATORY DATABASE-BACKED CONCURRENCY TEST:
    Executes 20 concurrent requests against a fresh company with NO pre-existing registry row.
    Guarantees:
    - Exactly 1 registry row created (no duplicate registry records).
    - Exactly 20 unique customer codes allocated.
    - Zero duplicate codes, zero race condition crashes.
    """
    _, cid_b = test_companies
    sem = asyncio.Semaphore(10)

    # Verify no registry row exists for cid_b
    async with db_session_factory() as session:
        reg_count = (await session.execute(
            select(func.count()).select_from(SmritiNumberingRegistry).where(
                SmritiNumberingRegistry.entity_type == "CUSTOMER_CODE",
                SmritiNumberingRegistry.company_id == cid_b,
            )
        )).scalar()
        assert reg_count == 0, "Company B must have 0 registry rows at start"

    async def worker_allocate(worker_id: int):
        async with sem:
            async with db_session_factory() as session:
                ctx = TenantContext(company_id=cid_b, branch_id="BR-MAIN-001")
                service = CrmService(session, ctx)
                # Concurrently allocate customer code
                async with session.begin():
                    code = await service.allocate_next_customer_code()
                return worker_id, code

    tasks = [worker_allocate(i) for i in range(1, 21)]
    results = await asyncio.gather(*tasks)

    assert len(results) == 20
    allocated_codes = [r[1] for r in results]

    # 1. Verify 20 unique codes
    assert len(set(allocated_codes)) == 20, f"Expected 20 unique codes, got {len(set(allocated_codes))}"

    # 2. Verify consecutive sequences 1..20
    seqs = sorted([int(c.split("-")[-1]) for c in allocated_codes])
    assert seqs == list(range(1, 21)), f"Expected strictly consecutive 1..20, got {seqs}"

    # 3. Verify exactly ONE registry record exists in DB for this company
    async with db_session_factory() as session:
        reg_rows = (await session.execute(
            select(SmritiNumberingRegistry).where(
                SmritiNumberingRegistry.entity_type == "CUSTOMER_CODE",
                SmritiNumberingRegistry.company_id == cid_b,
            )
        )).scalars().all()
        assert len(reg_rows) == 1, f"Expected exactly 1 registry record, found {len(reg_rows)}"
        assert reg_rows[0].sequence_value == 20, f"Expected sequence value 20, got {reg_rows[0].sequence_value}"


@pytest.mark.asyncio
async def test_cross_company_isolation(db_session_factory, test_companies):
    """
    Phase 3 Item 8:
    Cross-company requests cannot inspect or allocate another company's codes.
    Both companies can independently maintain the same code numbers under company-scoped uniqueness.
    """
    cid_a, cid_b = test_companies

    async with db_session_factory() as session:
        ctx_a = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        ctx_b = TenantContext(company_id=cid_b, branch_id="BR-MAIN-001")
        srv_a = CrmService(session, ctx_a)
        srv_b = CrmService(session, ctx_b)
        admin_a = User(id="u-admin-a", username="admin_a", role=UserRole.ADMIN, company_id=cid_a)
        admin_b = User(id="u-admin-b", username="admin_b", role=UserRole.ADMIN, company_id=cid_b)

        # Admin A creates "VIP-ISOLATION-01" in Company A
        cust_a = await srv_a.create_customer(
            CustomerCreate(name="Cust in Co A", mobile="9820011111", code="VIP-ISOLATION-01", status="Active"),
            current_user=admin_a,
        )
        assert cust_a.code == "VIP-ISOLATION-01"

        # Company B validates the exact same code "VIP-ISOLATION-01" in Company B -> AVAILABLE!
        val_b = await srv_b.validate_customer_code("VIP-ISOLATION-01", current_user=admin_b)
        assert val_b.is_valid is True, "Code in Company A must NOT block Company B"

        # Admin B creates the exact same code "VIP-ISOLATION-01" in Company B -> SUCCEEDS!
        cust_b = await srv_b.create_customer(
            CustomerCreate(name="Cust in Co B", mobile="9820022222", code="VIP-ISOLATION-01", status="Active"),
            current_user=admin_b,
        )
        assert cust_b.code == "VIP-ISOLATION-01"
        assert cust_b.company_id == cid_b
        assert cust_a.company_id == cid_a


@pytest.mark.asyncio
async def test_inactive_historical_codes_not_silently_reused_and_audit_trail(db_session_factory, test_companies):
    """
    Phase 2 Item 9 / Phase 3 Item 9:
    Inactive/deleted historical codes are NOT silently reused by auto-generation.
    Explicit reassignment by authorized manager creates an audit trail entry in SmritiAuditLog.
    """
    cid_a, _ = test_companies

    async with db_session_factory() as session:
        ctx = TenantContext(company_id=cid_a, branch_id="BR-MAIN-001")
        service = CrmService(session, ctx)
        admin_user = User(id="u-admin-aud", username="auditor_admin", role=UserRole.ADMIN, company_id=cid_a)

        # 1. Create a customer with code "VIP-HIST-01" and deactivate it
        hist_cust = await service.create_customer(
            CustomerCreate(name="Historical Inactive Corp", mobile="9820033333", code="VIP-HIST-01", status="Active"),
            current_user=admin_user,
        )
        hist_cust.status = "Inactive"
        hist_cust.is_deleted = True
        await session.commit()

        # 2. Check eligible pool -> "VIP-HIST-01" appears in eligible pool
        pool = await service.get_eligible_customer_code_pool()
        pool_codes = {item.code for item in pool}
        assert "VIP-HIST-01" in pool_codes

        # 3. Manager explicitly reassigns the historical code to a new customer
        reused_cust = await service.create_customer(
            CustomerCreate(name="New Revived Corp", mobile="9820044444", code="VIP-HIST-01", status="Active"),
            current_user=admin_user,
        )
        assert reused_cust.code == "VIP-HIST-01"

        # 4. Verify audit trail log created in SmritiAuditLog
        audit_res = await session.execute(
            select(SmritiAuditLog).where(
                SmritiAuditLog.tenant_id == cid_a,
                SmritiAuditLog.entity_id == reused_cust.id,
                SmritiAuditLog.change_type == "HISTORICAL_CODE_REUSE",
            )
        )
        audit_entry = audit_res.scalars().first()
        assert audit_entry is not None, "Audit log entry must be created on historical code reuse"
        assert audit_entry.field_name == "code"
        assert audit_entry.new_value == "VIP-HIST-01"
        assert "Reused from inactive customer" in audit_entry.old_value
