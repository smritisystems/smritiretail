"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-26
Modified     : 2026-10-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: E2E N-Tier Customer Hierarchy & Bulk Assignment Verification
"""

import time
import uuid
import pytest
from sqlalchemy import select

from app.api.deps import TenantContext
from app.api.v1.crm import (
    get_customer_hierarchy_tree,
    bulk_assign_customer_dependants,
    list_assignable_children,
)
from app.db.session import _company_database_name_cache, get_company_sessionmaker
from app.models.auth import User, UserRole
from app.models.crm import Customer, CustomerRelationship
from app.schemas.crm import (
    CustomerCreate,
    BulkAssignDependantsRequest,
)
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
async def test_ntier_recursive_hierarchy_expansion(tenant_ctx, admin_user):
    """Verify 3-tier hierarchy: Root Holding -> Zonal Hub -> 2 Store Outlets."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    hold_code = f"HOLD-{suffix}"
    zonal_code = f"ZONAL-{suffix}"
    store1_code = f"STR1-{suffix}"
    store2_code = f"STR2-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # 1. Create Root Holding (Tier 0)
        hold = await service.create_customer(CustomerCreate(
            name=f"Apex Holding Corp {suffix}",
            code=hold_code,
            mobile=f"90{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        # 2. Create Zonal Hub (Tier 1) subordinated to Apex Holding
        zonal = await service.create_customer(CustomerCreate(
            name=f"North Zone Hub {suffix}",
            code=zonal_code,
            mobile=f"91{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=hold.id,
        ), current_user=admin_user)

        # 3. Create Store Outlets 1 & 2 (Tier 2) subordinated to Zonal Hub
        store1 = await service.create_customer(CustomerCreate(
            name=f"Delhi Central Store {suffix}",
            code=store1_code,
            mobile=f"92{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=zonal.id,
        ), current_user=admin_user)

        store2 = await service.create_customer(CustomerCreate(
            name=f"Noida Hub Store {suffix}",
            code=store2_code,
            mobile=f"93{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=zonal.id,
        ), current_user=admin_user)

        await session.commit()

        # Call get_customer_hierarchy_tree starting from the deepest leaf node: Store 1
        tree = await get_customer_hierarchy_tree(
            customer_id=store1.id,
            db=session,
            tenant_ctx=tenant_ctx,
        )

        assert tree.target_customer_id == store1.id
        assert tree.is_multi_tier is True
        assert tree.total_nodes == 4
        assert tree.max_depth == 2

        # Verify root is Apex Holding
        root = tree.root
        assert root.id == hold.id
        assert root.code == hold_code
        assert root.depth == 0
        assert root.relationship_type == "root"
        assert len(root.children) == 1

        # Verify Tier 1 is Zonal Hub
        zonal_node = root.children[0]
        assert zonal_node.id == zonal.id
        assert zonal_node.code == zonal_code
        assert zonal_node.depth == 1
        assert len(zonal_node.children) == 2

        # Verify Tier 2 children under Zonal Hub
        child_codes = {c.code for c in zonal_node.children}
        assert store1_code in child_codes
        assert store2_code in child_codes
        for c in zonal_node.children:
            assert c.depth == 2
            assert c.parent_customer_id == zonal.id


@pytest.mark.asyncio
async def test_bulk_assign_dependants_atomic(tenant_ctx, admin_user):
    """Verify bulk assigning multiple standalone accounts to a parent hub."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    parent_code = f"HUB-{suffix}"
    cand1_code = f"CND1-{suffix}"
    cand2_code = f"CND2-{suffix}"
    cand3_code = f"CND3-{suffix}"

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # 1. Create Parent Hub
        parent = await service.create_customer(CustomerCreate(
            name=f"Regional Hub {suffix}",
            code=parent_code,
            mobile=f"94{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        # 2. Create 3 standalone accounts
        cand1 = await service.create_customer(CustomerCreate(
            name=f"Standalone Store A {suffix}",
            code=cand1_code,
            mobile=f"95{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        cand2 = await service.create_customer(CustomerCreate(
            name=f"Standalone Store B {suffix}",
            code=cand2_code,
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        cand3 = await service.create_customer(CustomerCreate(
            name=f"Standalone Store C {suffix}",
            code=cand3_code,
            mobile=f"97{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        await session.commit()

        # 3. Bulk assign cand1, cand2, cand3 to parent
        req = BulkAssignDependantsRequest(
            dependant_customer_ids=[cand1.id, cand2.id, cand3.id],
            relation="Store Branch",
            apply_same_mailing=False,
            replace_existing=True,
        )

        res = await bulk_assign_customer_dependants(
            customer_id=parent.id,
            payload=req,
            db=session,
            tenant_ctx=tenant_ctx,
        )

        assert res.assigned_count == 3
        assert res.skipped_count == 0
        assert len(res.errors) == 0
        assert set(res.assigned_ids) == {cand1.id, cand2.id, cand3.id}

        # 4. Verify in DB
        rel_stmt = select(CustomerRelationship).where(
            CustomerRelationship.parent_customer_id == parent.id,
            CustomerRelationship.company_id == tenant_ctx.company_id,
            CustomerRelationship.is_deleted == False,
        )
        rels = (await session.execute(rel_stmt)).scalars().all()
        assert len(rels) == 3
        for r in rels:
            assert r.relation == "Store Branch"

        # Verify customer flags and relationship mappings
        rel_map = {r.dependant_customer_id: r.parent_customer_id for r in rels}
        for cid in [cand1.id, cand2.id, cand3.id]:
            c = (await session.execute(select(Customer).where(Customer.id == cid))).scalar_one()
            assert c.is_dependant is True
            assert rel_map.get(cid) == parent.id


@pytest.mark.asyncio
async def test_bulk_assign_cycle_prevention(tenant_ctx, admin_user):
    """Verify that attempting to assign an ancestor or self as child is rejected."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # Create Parent -> Child
        parent = await service.create_customer(CustomerCreate(
            name=f"Parent {suffix}",
            code=f"PAR-{suffix}",
            mobile=f"98{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        child = await service.create_customer(CustomerCreate(
            name=f"Child {suffix}",
            code=f"CHD-{suffix}",
            mobile=f"99{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=parent.id,
        ), current_user=admin_user)

        await session.commit()

        # Attempt to make parent a child of child (cycle!)
        req = BulkAssignDependantsRequest(
            dependant_customer_ids=[parent.id, child.id],
            relation="Cycle Attempt",
        )

        res = await bulk_assign_customer_dependants(
            customer_id=child.id,
            payload=req,
            db=session,
            tenant_ctx=tenant_ctx,
        )

        # Both should be skipped: child is self, parent is ancestor
        assert res.assigned_count == 0
        assert res.skipped_count == 2
        assert len(res.errors) >= 2


@pytest.mark.asyncio
async def test_assignable_children_candidates_exclusion(tenant_ctx, admin_user):
    """Verify that candidate list excludes self, ancestors, and direct children."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)

        # Root Holding
        root = await service.create_customer(CustomerCreate(
            name=f"Root {suffix}",
            code=f"ROT-{suffix}",
            mobile=f"81{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        # Hub (subordinated to Root)
        hub = await service.create_customer(CustomerCreate(
            name=f"Hub {suffix}",
            code=f"HUB-{suffix}",
            mobile=f"82{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=root.id,
        ), current_user=admin_user)

        # Direct Child of Hub
        direct_child = await service.create_customer(CustomerCreate(
            name=f"Direct {suffix}",
            code=f"DIR-{suffix}",
            mobile=f"83{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            is_dependant=True,
            parent_customer_id=hub.id,
        ), current_user=admin_user)

        # Standalone Candidate
        eligible = await service.create_customer(CustomerCreate(
            name=f"Eligible Candidate {suffix}",
            code=f"ELG-{suffix}",
            mobile=f"84{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)

        await session.commit()

        # Query candidates for Hub
        candidates = await list_assignable_children(
            customer_id=hub.id,
            q=suffix,
            limit=50,
            db=session,
            tenant_ctx=tenant_ctx,
        )

        cand_ids = {c.id for c in candidates}
        assert hub.id not in cand_ids  # self excluded
        assert root.id not in cand_ids  # ancestor excluded
        assert direct_child.id not in cand_ids  # direct child excluded
        assert eligible.id in cand_ids  # eligible candidate present
