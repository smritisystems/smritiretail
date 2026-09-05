"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-09-03
Modified     : 2026-09-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import pytest
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import HTTPException
from sqlalchemy import select, inspect
from app.db.session import get_company_sessionmaker
from app.api.deps import TenantContext
from app.models.crm import Customer, CustomerGroup
from app.schemas.crm import CustomerCreate, CustomerResponse
from app.services.crm import CrmService
from app.repositories.customer import CustomerRepository


def _get_tenant_context() -> TenantContext:
    return TenantContext(
        company_id="COMP-001",
        branch_id="MAIN"
    )


@pytest.mark.asyncio
async def test_corporate_customer_creation_and_response_mapping():
    """
    Requirements 1, 2, 3, 4:
    - Corporate customer created with customer_group_id=CG-Corporate
    - Response contains correctly mapped credit_limit, credit_days, unlimited_credit, credit_hold
    - No MissingGreenlet during response serialization
    - customer_group_id persists correctly
    """
    suffix = uuid.uuid4().hex[:6]
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        service = CrmService(session, tenant_ctx)
        payload = CustomerCreate(
            name=f"Corporate Test Corp {suffix}",
            customer_group_id="CG-Corporate",
            mobile=f"98{suffix[:8]}",
            email=f"corp_{suffix}@example.com",
            gst_number="29AABCT1332L1ZV",
            status="Active"
        )

        # 1. Create customer
        created = await service.create_customer(payload)
        assert created is not None
        assert created.customer_group_id == "CG-Corporate"

        # 2. Validate response mapping with CustomerResponse (No MissingGreenlet)
        resp = CustomerResponse.model_validate(created)
        assert resp.id == created.id
        assert resp.name == created.name
        assert resp.customer_group_id == "CG-Corporate"

        # Credit policy mapped from CG-Corporate
        assert resp.credit_days == 60
        assert resp.credit_limit is not None
        assert resp.unlimited_credit is not None
        assert resp.credit_hold is not None


@pytest.mark.asyncio
async def test_customer_group_remains_authoritative():
    """
    Requirement 5:
    - Modifying CustomerGroup credit policy reflects in CustomerResponse
    - Demonstrates CustomerGroup is the authoritative single source of truth
    """
    suffix = uuid.uuid4().hex[:6]
    cg_id = f"cg-auth-{suffix}"
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        # Create unique group
        group = CustomerGroup(
            id=cg_id,
            company_id="COMP-001",
            name=f"Authoritative Group {suffix}",
            credit_limit=Decimal("750000.00"),
            credit_days=45,
            unlimited_credit=False,
            credit_hold=False,
            is_active=True,
            is_deleted=False
        )
        session.add(group)
        await session.commit()

        service = CrmService(session, tenant_ctx)
        payload = CustomerCreate(
            name=f"Authoritative Client {suffix}",
            customer_group_id=cg_id,
            mobile=f"97{suffix[:8]}",
            status="Active"
        )
        created = await service.create_customer(payload)
        resp1 = CustomerResponse.model_validate(created)
        assert resp1.credit_limit == Decimal("750000.00")
        assert resp1.credit_days == 45

        # Update CustomerGroup credit policy directly
        group_res = await session.execute(select(CustomerGroup).filter(CustomerGroup.id == cg_id))
        cg_loaded = group_res.scalars().first()
        cg_loaded.credit_limit = Decimal("1000000.00")
        cg_loaded.credit_days = 90
        await session.commit()

        # Re-fetch customer and verify CustomerResponse inherits new policy
        reloaded = await service.get_customer(created.id)
        resp2 = CustomerResponse.model_validate(reloaded)
        assert resp2.credit_limit == Decimal("1000000.00")
        assert resp2.credit_days == 90


@pytest.mark.asyncio
async def test_invalid_customer_group_id_handling():
    """
    Requirement 6:
    - Invalid customer_group_id sets customer_group_id=None gracefully
    - Serializes with None for credit policy fields without error
    """
    suffix = uuid.uuid4().hex[:6]
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        service = CrmService(session, tenant_ctx)
        payload = CustomerCreate(
            name=f"Invalid Group Cust {suffix}",
            customer_group_id=f"cg-nonexistent-{suffix}",
            mobile=f"96{suffix[:8]}",
            status="Active"
        )
        created = await service.create_customer(payload)
        assert created.customer_group_id is None

        resp = CustomerResponse.model_validate(created)
        assert resp.customer_group_id is None
        assert resp.credit_limit is None
        assert resp.credit_days is None


@pytest.mark.asyncio
async def test_duplicate_mobile_constraint():
    """
    Requirement 7:
    - Duplicate mobile number raises HTTPException 400
    """
    suffix = uuid.uuid4().hex[:6]
    test_mobile = f"95{suffix[:8]}"
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        service = CrmService(session, tenant_ctx)
        payload1 = CustomerCreate(
            name=f"Mobile Cust A {suffix}",
            mobile=test_mobile,
            status="Active"
        )
        await service.create_customer(payload1)

        payload2 = CustomerCreate(
            name=f"Mobile Cust B {suffix}",
            mobile=test_mobile,
            status="Active"
        )
        with pytest.raises(HTTPException) as exc:
            await service.create_customer(payload2)
        assert exc.value.status_code == 400
        assert "mobile" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_customer_list_and_search_serialization():
    """
    Requirements 8, 9:
    - Customer list repository / endpoint serializes successfully
    - Customer search repository / endpoint serializes successfully
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        repo = CustomerRepository(session, tenant_ctx)
        
        # Test get_all list
        customers = await repo.get_all(skip=0, limit=20)
        assert len(customers) > 0
        serialized_list = [CustomerResponse.model_validate(c) for c in customers]
        assert len(serialized_list) == len(customers)

        # Test search
        search_res = await repo.search(q="Reliance", limit=10)
        serialized_search = [CustomerResponse.model_validate(c) for c in search_res]
        assert len(serialized_search) == len(search_res)


def test_no_duplicate_credit_policy_columns_on_customer_model():
    """
    Requirement 12:
    - Verify that credit_limit, credit_days, unlimited_credit, credit_hold
      are NOT columns on the Customer ORM table.
    """
    mapper = inspect(Customer)
    column_names = [col.key for col in mapper.columns]
    
    assert "credit_limit" not in column_names, "credit_limit must not be a column on Customer"
    assert "credit_days" not in column_names, "credit_days must not be a column on Customer"
    assert "unlimited_credit" not in column_names, "unlimited_credit must not be a column on Customer"
    assert "credit_hold" not in column_names, "credit_hold must not be a column on Customer"
    assert "customer_group_id" in column_names, "customer_group_id must be a column on Customer"


def test_audit_log_rbac_preservation():
    """
    Requirement 11:
    - Verify GET /audit-logs strictly requires MANAGER or SYSADMIN,
      ensuring CASHIER receives 403 Forbidden.
    """
    from app.api.v1.system import router
    for route in router.routes:
        if getattr(route, "path", None) == "/audit-logs" and "GET" in getattr(route, "methods", set()):
            # Inspect route dependencies
            dep_calls = [d.dependency for d in route.dependencies]
            # Must not allow CASHIER
            assert len(dep_calls) > 0
            # Check dependency closure/args
            for d in route.dependencies:
                closure_vars = getattr(d.dependency, "__closure__", None)
                if closure_vars:
                    for cell in closure_vars:
                        val = cell.cell_contents
                        if isinstance(val, (list, tuple, set)):
                            from app.models.auth import UserRole
                            assert UserRole.CASHIER not in val, "CASHIER must not have access to GET /audit-logs"
                            assert UserRole.MANAGER in val, "MANAGER must have access to GET /audit-logs"
                            assert UserRole.SYSADMIN in val, "SYSADMIN must have access to GET /audit-logs"


@pytest.mark.asyncio
async def test_response_serialization_without_preloaded_group_no_missing_greenlet():
    """
    Negative regression test:
    Verify response serialization for:
    1. Customer with eagerly loaded CustomerGroup.
    2. Customer without preloaded CustomerGroup (simulated lazyload).
       Must NOT cause MissingGreenlet or DetachedInstanceError.
       Returns policy fields as None since no group was eagerly preloaded.
    3. Plain dictionary mapping:
       CustomerResponse.model_validate(plain_mapping) validates cleanly without
       accessing SQLAlchemy relationship state.
    """
    from sqlalchemy.orm import selectinload, lazyload

    session_factory = get_company_sessionmaker("smriti001")

    # 1. Customer with eagerly loaded CustomerGroup
    async with session_factory() as session:
        res1 = await session.execute(
            select(Customer)
            .options(selectinload(Customer.group))
            .filter(Customer.is_deleted == False)
            .limit(1)
        )
        c1 = res1.scalars().first()
        if c1:
            resp1 = CustomerResponse.model_validate(c1)
            assert resp1.id == c1.id
            if c1.customer_group_id:
                assert (
                    resp1.credit_limit is not None
                    or resp1.credit_days is not None
                    or resp1.unlimited_credit is not None
                )

    # 2. Customer WITHOUT preloaded CustomerGroup in a fresh session
    async with session_factory() as session:
        res2 = await session.execute(
            select(Customer)
            .options(lazyload(Customer.group))
            .filter(Customer.is_deleted == False)
            .limit(1)
        )
        c2 = res2.scalars().first()
        if c2:
            resp2 = CustomerResponse.model_validate(c2)
            assert resp2.id == c2.id
            # Policy fields must be None without raising MissingGreenlet
            assert resp2.credit_limit is None
            assert resp2.credit_days is None
            assert resp2.unlimited_credit is None
            assert resp2.credit_hold is None

    # 3. Plain dictionary mapping (zero SQLAlchemy relationship access)
    plain_dict = {
        "id": "cust-plain-dto-001",
        "name": "Plain DTO Customer",
        "customer_group_id": "CG-Corporate",
        "credit_limit": Decimal("500000.00"),
        "credit_days": 30,
        "unlimited_credit": False,
        "credit_hold": False,
        "status": "Active",
    }
    resp3 = CustomerResponse.model_validate(plain_dict)
    assert resp3.id == "cust-plain-dto-001"
    assert resp3.credit_limit == Decimal("500000.00")
    assert resp3.credit_days == 30
    assert resp3.unlimited_credit is False
    assert resp3.credit_hold is False


@pytest.mark.asyncio
async def test_customer_get_all_deterministic_ordering():
    """
    Test 5 — Backend Ordering Contract:
    Verify CustomerRepository.get_all() returns customers deterministically ordered
    by created_at ASC, id ASC for stable presentation.
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant_ctx = _get_tenant_context()

    async with session_factory() as session:
        repo = CustomerRepository(session, tenant_ctx)
        customers = await repo.get_all(skip=0, limit=50)

        assert len(customers) > 0

        # Verify created_at is non-decreasing throughout the list
        for i in range(len(customers) - 1):
            curr_c = customers[i]
            next_c = customers[i + 1]
            if curr_c.created_at and next_c.created_at:
                assert curr_c.created_at <= next_c.created_at
                if curr_c.created_at == next_c.created_at:
                    assert curr_c.id <= next_c.id



