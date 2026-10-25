"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-25
Modified     : 2026-10-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: E2E Customer Hierarchy & Directory Model Verification
"""

import time
import uuid
import pytest
from sqlalchemy import select

from app.api.deps import TenantContext
from app.api.v1.crm import customer_directory, list_customer_dependants
from app.db.session import _company_database_name_cache, get_company_sessionmaker
from app.models.auth import User, UserRole
from app.models.crm import CustomerRelationship
from app.schemas.crm import CustomerCreate, CustomerUpdate
from app.services.crm import CrmService

TEST_DB = "smriti_test_phase2c"
TEST_COMPANY_ID = "COMP-001"
TEST_BRANCH_ID = "BR-MAIN-001"


@pytest.fixture(autouse=True)
def ensure_test_db_routing():
    """Ensure company routes strictly to the isolated test database."""
    _company_database_name_cache[TEST_COMPANY_ID] = (TEST_DB, time.time() + 99999)
    _company_database_name_cache["001"] = (TEST_DB, time.time() + 99999)


@pytest.fixture
def tenant_ctx() -> TenantContext:
    return TenantContext(
        company_id=TEST_COMPANY_ID,
        branch_id=TEST_BRANCH_ID,
        role=UserRole.SYSADMIN,
    )


@pytest.fixture
def admin_user() -> User:
    return User(
        id="usr-audit-admin",
        username="audit_admin",
        role=UserRole.SYSADMIN,
        company_id=TEST_COMPANY_ID,
        branch_id=TEST_BRANCH_ID,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_directory_hierarchy_parent_child_and_standalone(tenant_ctx, admin_user):
    """Verify that directory responses include canonical indicators, parent info, and child counts."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    parent_code = f"PAR-{suffix}"
    child_code_1 = f"CHD1-{suffix}"
    child_code_2 = f"CHD2-{suffix}"
    standalone_code = f"STA-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # 1. Create Parent Account
        parent = await service.create_customer(CustomerCreate(
            name=f"Parent Enterprise {suffix}",
            code=parent_code,
            mobile=f"91{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)
        parent_id = parent.id

        # 2. Create Child 1 and Child 2 subordinated to Parent
        child_1 = await service.create_customer(CustomerCreate(
            name=f"Child Branch One {suffix}",
            code=child_code_1,
            mobile=f"92{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent_id,
        ), current_user=admin_user)
        child_1_id = child_1.id

        child_2 = await service.create_customer(CustomerCreate(
            name=f"Child Branch Two {suffix}",
            code=child_code_2,
            mobile=f"93{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent_id,
        ), current_user=admin_user)
        child_2_id = child_2.id

        # 3. Create Standalone Customer
        standalone = await service.create_customer(CustomerCreate(
            name=f"Standalone Merchant {suffix}",
            code=standalone_code,
            mobile=f"94{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=False,
        ), current_user=admin_user)
        standalone_id = standalone.id

        # Query directory for Parent
        dir_parent = await customer_directory(
            q=parent_code,
            skip=0,
            limit=10,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        p_row = next(r for r in dir_parent.items if r.id == parent_id)
        assert p_row.relationship_type == "parent"
        assert p_row.child_count >= 2
        assert p_row.is_dependant is False

        # Query directory for Child 1
        dir_child = await customer_directory(
            q=child_code_1,
            skip=0,
            limit=10,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        c_row = next(r for r in dir_child.items if r.id == child_1_id)
        assert c_row.relationship_type == "child"
        assert c_row.is_dependant is True
        assert c_row.parent_customer_id == parent_id
        assert c_row.parent_customer_code == parent_code
        assert c_row.parent_customer_name == f"Parent Enterprise {suffix}"
        assert c_row.primary_account_status == "Active"
        assert c_row.primary_account_is_active is True

        # Query directory for Standalone
        dir_sta = await customer_directory(
            q=standalone_code,
            skip=0,
            limit=10,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        s_row = next(r for r in dir_sta.items if r.id == standalone_id)
        assert s_row.relationship_type == "standalone"
        assert s_row.child_count == 0
        assert s_row.is_dependant is False
        assert s_row.parent_customer_name is None


@pytest.mark.asyncio
async def test_directory_hierarchy_filtering_and_sorting(tenant_ctx, admin_user):
    """Test filtering by relationship type, parent_id filter, and sorting by child_count."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    parent_code = f"FLT-PAR-{suffix}"
    child_code = f"FLT-CHD-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        parent = await service.create_customer(CustomerCreate(
            name=f"Filter Parent {suffix}",
            code=parent_code,
            mobile=f"95{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        child = await service.create_customer(CustomerCreate(
            name=f"Filter Child {suffix}",
            code=child_code,
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent.id,
        ), current_user=admin_user)

        # 1. Test parent_id filter: should return only children of this parent
        filtered_by_parent = await customer_directory(
            parent_id=parent.id,
            skip=0,
            limit=25,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        assert any(r.id == child.id for r in filtered_by_parent.items)
        assert not any(r.id == parent.id for r in filtered_by_parent.items)

        # 2. Test relationship=parent filter: parent must be present, child must not be present
        parents_only = await customer_directory(
            q=suffix,
            relationship="parent",
            skip=0,
            limit=25,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        assert any(r.id == parent.id for r in parents_only.items)
        assert not any(r.id == child.id for r in parents_only.items)

        # 3. Test relationship=child filter: child must be present, parent must not be present
        children_only = await customer_directory(
            q=suffix,
            relationship="child",
            skip=0,
            limit=25,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        assert any(r.id == child.id for r in children_only.items)
        assert not any(r.id == parent.id for r in children_only.items)

        # 4. Test sort_by=child_count descending
        sorted_dir = await customer_directory(
            q=suffix,
            sort_by="child_count",
            sort_dir="desc",
            skip=0,
            limit=25,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        items = [r for r in sorted_dir.items if r.id in (parent.id, child.id)]
        assert len(items) == 2
        assert items[0].id == parent.id
        assert items[1].id == child.id


@pytest.mark.asyncio
async def test_directory_deactivated_and_missing_parent_graceful_handling(tenant_ctx, admin_user):
    """Test graceful handling of inactive parents and unlinked/deleted parents in customer directory."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    parent_code = f"DEACT-PAR-{suffix}"
    child_code = f"DEACT-CHD-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # Create parent and child
        parent = await service.create_customer(CustomerCreate(
            name=f"To-Deactivate Parent {suffix}",
            code=parent_code,
            mobile=f"97{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        child = await service.create_customer(CustomerCreate(
            name=f"Child of Deactivated {suffix}",
            code=child_code,
            mobile=f"98{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent.id,
        ), current_user=admin_user)

        # Deactivate parent
        await service.update_customer(parent.id, CustomerUpdate(status="Inactive", is_active=False))

        # Check directory: child's parent info should reflect Inactive status
        dir_child = await customer_directory(
            q=child_code,
            skip=0,
            limit=10,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        c_row = next(r for r in dir_child.items if r.id == child.id)
        assert c_row.parent_customer_name == f"To-Deactivate Parent {suffix}"
        assert c_row.primary_account_status == "Inactive"
        assert c_row.primary_account_is_active is False

        # Soft delete parent customer relationship link to simulate missing/orphaned parent
        await session.execute(
            CustomerRelationship.__table__.update()
            .where(CustomerRelationship.dependant_customer_id == child.id)
            .values(is_deleted=True)
        )
        await session.commit()

        dir_orphaned = await customer_directory(
            q=child_code,
            skip=0,
            limit=10,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        orphaned_row = next(r for r in dir_orphaned.items if r.id == child.id)
        # Relationship to deleted parent is not joined; handles gracefully without error
        assert orphaned_row.parent_customer_name is None
        assert orphaned_row.primary_account_name is None


@pytest.mark.asyncio
async def test_cross_branch_alias_and_dependants_resolution(tenant_ctx, admin_user):
    """Verify company-level hierarchy resolution even when client queries with normalized branch alias 'MAIN'."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    parent_code = f"ALIAS-PAR-{suffix}"
    child_code = f"ALIAS-CHD-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        parent = await service.create_customer(CustomerCreate(
            name=f"Parent Corp {suffix}",
            code=parent_code,
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        child = await service.create_customer(CustomerCreate(
            name=f"Subordinate Branch {suffix}",
            code=child_code,
            mobile=f"95{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent.id,
        ), current_user=admin_user)

        # Context simulating default apiFetchV1 normalized branch header 'MAIN' vs DB branch 'BR-MAIN-001'
        alias_ctx = TenantContext(
            company_id=TEST_COMPANY_ID,
            branch_id="MAIN",
            role=UserRole.SYSADMIN,
        )

        dir_res = await customer_directory(
            q=parent_code,
            skip=0,
            limit=10,
            status="all",
            relationship="all",
            db=session,
            tenant_ctx=alias_ctx,
        )
        p_row = next(r for r in dir_res.items if r.id == parent.id)
        assert p_row.relationship_type == "parent"
        assert p_row.child_count == 1

        # Query dependants by code as well as UUID
        deps_by_id = await list_customer_dependants(parent.id, db=session, tenant_ctx=alias_ctx)
        assert len(deps_by_id) == 1
        assert deps_by_id[0].dependant_customer_code == child_code
        assert deps_by_id[0].dependant_customer_name == f"Subordinate Branch {suffix}"
        assert deps_by_id[0].dependant_customer_status == "Active"

        deps_by_code = await list_customer_dependants(parent_code, db=session, tenant_ctx=alias_ctx)
        assert len(deps_by_code) == 1
        assert deps_by_code[0].dependant_customer_code == child_code
        assert deps_by_code[0].dependant_customer_name == f"Subordinate Branch {suffix}"

