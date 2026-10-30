"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-22
Modified     : 2026-10-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: E2E Customer Lifecycle & Billing Integration Audit
"""

import time
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select

from app.api.deps import TenantContext
from app.api.v1.crm import customer_directory, list_customer_dependants
from app.db.session import (
    _company_database_name_cache,
    get_company_sessionmaker,
)
from app.models.auth import User, UserRole
from app.models.crm import CustomerDeliveryLocation, CustomerRelationship
from app.models.inventory import Product
from app.models.item_master import Item, ItemVariant
from app.models.psv import PSVParty, PSVStockBalance, PSVStockEvent
from app.repositories.customer import CustomerRepository
from app.repositories.sales import SalesInvoiceRepository
from app.schemas.canonical_posting import (
    CanonicalPostingContext,
    CanonicalPostingLineItem,
    CanonicalPostingRequest,
    CanonicalTenderItem,
)
from app.schemas.crm import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services.billing_catalog_service import BillingCatalogService
from app.services.canonical_sales_writer import CanonicalSalesPostingWriter
from app.services.crm import CrmService
from app.services.psv_projection import PSVProjectionService

# Ensure isolated test database routing
TEST_DB = "smriti_test_phase2c"
TEST_COMPANY_ID = "COMP-001"
TEST_BRANCH_ID = "BR-MAIN-001"


@pytest.mark.asyncio
async def test_add_child_customer_persists_parent_and_directory_relationship(tenant_ctx, admin_user):
    """Creating through the parent-aware customer flow persists and returns the canonical link."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()
    parent_code = f"PAR-{suffix}"
    child_code = f"CHD-{suffix}"
    standalone_code = f"STD-{suffix}"
    parent_id = child_id = standalone_id = None

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)
        parent = await service.create_customer(CustomerCreate(
            name=f"Parent Account {suffix}",
            code=parent_code,
            mobile=f"98{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)
        child = await service.create_customer(CustomerCreate(
            name=f"Child Account {suffix}",
            code=child_code,
            mobile=f"97{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            parent_customer_id=parent.id,
        ), current_user=admin_user)
        parent_id, child_id = parent.id, child.id

        assert child.is_dependant is True
        relationship = (await session.execute(select(CustomerRelationship).where(
            CustomerRelationship.parent_customer_id == parent_id,
            CustomerRelationship.dependant_customer_id == child_id,
            CustomerRelationship.company_id == TEST_COMPANY_ID,
            CustomerRelationship.branch_id == TEST_BRANCH_ID,
            CustomerRelationship.is_deleted.is_(False),
        ))).scalar_one()
        assert relationship.relation == "Child"

        loaded_child = await service.get_customer(child_id)
        child_response = CustomerResponse.from_orm_customer(loaded_child)
        assert child_response.parent_customer_id == parent_id
        assert child_response.primary_account_code == parent_code
        assert child_response.primary_account_name == f"Parent Account {suffix}"

        parent_children = await list_customer_dependants(parent_id, db=session, tenant_ctx=tenant_ctx)
        assert any(
            row.dependant_customer_id == child_id
            and row.dependant_customer_code == child_code
            for row in parent_children
        )

        directory = await customer_directory(
            q=child_code,
            skip=0,
            limit=25,
            status="all",
            db=session,
            tenant_ctx=tenant_ctx,
        )
        directory_child = next(row for row in directory.items if row.id == child_id)
        assert directory_child.is_dependant is True
        assert directory_child.parent_customer_id == parent_id
        assert directory_child.primary_account_code == parent_code
        assert directory_child.primary_account_name == f"Parent Account {suffix}"

        # Editing the child must not silently detach it.
        await service.update_customer(child_id, CustomerUpdate(name=f"Renamed Child {suffix}"))
        assert (await session.execute(select(CustomerRelationship.id).where(
            CustomerRelationship.parent_customer_id == parent_id,
            CustomerRelationship.dependant_customer_id == child_id,
            CustomerRelationship.is_deleted.is_(False),
        ))).scalar_one_or_none() is not None
        with pytest.raises(HTTPException) as detach_info:
            await service.update_customer(child_id, CustomerUpdate(is_dependant=False))
        assert detach_info.value.status_code == 400

        standalone = await service.create_customer(CustomerCreate(
            name=f"Standalone Account {suffix}",
            code=standalone_code,
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)
        standalone_id = standalone.id
        assert standalone.is_dependant is False
        assert (await session.execute(select(CustomerRelationship.id).where(
            CustomerRelationship.dependant_customer_id == standalone_id,
            CustomerRelationship.is_deleted.is_(False),
        ))).scalar_one_or_none() is None

        # The same parent ID cannot be used from a different company or branch context.
        for invalid_context in (
            TenantContext(company_id="COMP-OTHER", branch_id=TEST_BRANCH_ID, role=UserRole.SYSADMIN),
            TenantContext(company_id=TEST_COMPANY_ID, branch_id="BR-OTHER", role=UserRole.SYSADMIN),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await CrmService(session, invalid_context).create_customer(CustomerCreate(
                    name=f"Rejected Child {suffix}",
                    mobile=f"95{uuid.uuid4().int % 100000000:08d}",
                    parent_customer_id=parent_id,
                ), current_user=admin_user)
            assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_add_child_customer_accepts_company_shared_parent(tenant_ctx, admin_user):
    """A shared parent visible through canonical tenant scoping can own a branch child."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)
        parent = await service.create_customer(CustomerCreate(
            name=f"Shared Parent {suffix}",
            code=f"SHRP-{suffix}",
            mobile=f"94{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)
        parent.branch_id = None
        await session.commit()

        child = await service.create_customer(CustomerCreate(
            name=f"Branch Child {suffix}",
            code=f"SHRC-{suffix}",
            mobile=f"93{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            parent_customer_id=parent.id,
        ), current_user=admin_user)

        relationship = (await session.execute(select(CustomerRelationship).where(
            CustomerRelationship.parent_customer_id == parent.id,
            CustomerRelationship.dependant_customer_id == child.id,
            CustomerRelationship.company_id == TEST_COMPANY_ID,
            CustomerRelationship.branch_id == TEST_BRANCH_ID,
            CustomerRelationship.is_deleted.is_(False),
        ))).scalar_one()
        assert relationship.relation == "Child"
        assert child.is_dependant is True


@pytest.mark.asyncio
async def test_child_store_resolves_to_child_psv_party_without_inventory_side_effects(tenant_ctx, admin_user):
    """PSV binds a child's store to the child ID and does not roll stock up to its parent."""
    sessionmaker = get_company_sessionmaker(TEST_DB)
    suffix = uuid.uuid4().hex[:8].upper()
    child_id = location_id = None

    async with sessionmaker() as session:
        service = CrmService(session, tenant_ctx)
        parent = await service.create_customer(CustomerCreate(
            name=f"PSV Parent {suffix}",
            code=f"PSVP-{suffix}",
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
            status="Active",
        ), current_user=admin_user)
        child = await service.create_customer(CustomerCreate(
            name=f"PSV Child Store {suffix}",
            code=f"PSVC-{suffix}",
            mobile=f"95{uuid.uuid4().int % 100000000:08d}",
            status="Active",
            parent_customer_id=parent.id,
        ), current_user=admin_user)
        location = CustomerDeliveryLocation(
            id=f"cdl-psv-{suffix.lower()}",
            company_id=TEST_COMPANY_ID,
            customer_id=child.id,
            store_code=f"S{suffix[:6]}",
            location_name=f"Child Store {suffix}",
            city="Gorakhpur",
            state="Uttar Pradesh",
            status="ACTIVE",
            is_deleted=False,
        )
        session.add(location)
        await session.commit()
        child_id, location_id = child.id, location.id

        before_events = await session.scalar(select(func.count(PSVStockEvent.event_id)))
        before_balances = await session.scalar(select(func.count(PSVStockBalance.id)))

        result = await PSVProjectionService.resolve_or_create_store_psv_party(
            session=session,
            company_id=TEST_COMPANY_ID,
            customer_id=child.id,
            delivery_location_id=location.id,
        )
        await session.commit()

        assert result["host_customer_id"] == child.id
        assert result["delivery_location_id"] == location.id
        assert result["host_customer_id"] != parent.id
        party = (await session.execute(
            select(PSVParty).where(PSVParty.id == result["psv_party_id"])
        )).scalar_one()
        assert party.host_customer_id == child.id
        assert party.delivery_location_id == location.id
        assert await session.scalar(select(func.count(PSVStockEvent.event_id))) == before_events
        assert await session.scalar(select(func.count(PSVStockBalance.id))) == before_balances

    # Resolve again after reloading the persisted customer/store relationship.
    async with sessionmaker() as session:
        persisted_location = (await session.execute(
            select(CustomerDeliveryLocation).where(CustomerDeliveryLocation.id == location_id)
        )).scalar_one()
        second_result = await PSVProjectionService.resolve_or_create_store_psv_party(
            session=session,
            company_id=TEST_COMPANY_ID,
            customer_id=child_id,
            delivery_location_id=persisted_location.id,
        )
        assert second_result["host_customer_id"] == child_id
        assert second_result["is_newly_created"] is False



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


def _gen_valid_gstin(digit_seq: int) -> str:
    """Generates an Indian statutory GSTIN adhering to 15-char regex."""
    num_part = (digit_seq % 9000) + 1000
    return f"27AABCT{num_part}F1Z5"


@pytest.mark.asyncio
async def test_phase3_customer_creation_validation_and_persistence(tenant_ctx, admin_user):
    """
    PHASE 3 AUDIT:
    - Required-field validation.
    - GSTIN format validation.
    - Duplicate customer handling (mobile & customer code collision).
    - Database persistence and retrieval with exact identities.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB)
    unique_suffix = uuid.uuid4().hex[:6].upper()
    seq = uuid.uuid4().int % 10000
    test_code = f"AUD-{unique_suffix}"
    test_mobile = f"98{uuid.uuid4().int % 100000000:08d}"
    test_gstin = _gen_valid_gstin(seq)

    # 1. Validation: Invalid GSTIN format rejection
    with pytest.raises(ValidationError):
        CustomerCreate(
            name="Invalid GSTIN Customer",
            code=f"INV-{unique_suffix}",
            gst_number="INVALID_GSTIN_123",
        )

    # 2. Validation: Customer creation via CrmService
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        cust_payload = CustomerCreate(
            name=f"E2E Audit Corp {unique_suffix}",
            code=test_code,
            mobile=test_mobile,
            email=f"audit_{unique_suffix.lower()}@smrititest.com",
            gst_number=test_gstin,
            tags=["VIP", "E2E_AUDIT"],
            status="Active",
        )
        created_cust = await crm_service.create_customer(cust_payload, current_user=admin_user)
        assert created_cust is not None
        assert created_cust.id is not None
        assert created_cust.code == test_code
        assert created_cust.name == f"E2E Audit Corp {unique_suffix}"
        assert created_cust.mobile == test_mobile
        assert created_cust.gst_number == test_gstin
        assert created_cust.company_id == TEST_COMPANY_ID
        saved_id = created_cust.id

    # 3. Duplicate Handling: Code collision must raise 409
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        dup_code_payload = CustomerCreate(
            name="Duplicate Code Corp",
            code=test_code,  # Same code
            mobile=f"97{uuid.uuid4().int % 100000000:08d}",
        )
        with pytest.raises(HTTPException) as exc_info:
            await crm_service.create_customer(dup_code_payload, current_user=admin_user)
        assert exc_info.value.status_code == 409
        err_detail = exc_info.value.detail
        assert "COLLISION" in str(err_detail) or "already assigned" in str(err_detail)

    # 4. Duplicate Handling: Mobile collision must raise 409
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        dup_mobile_payload = CustomerCreate(
            name="Duplicate Mobile Corp",
            code=f"AUD2-{unique_suffix}",
            mobile=test_mobile,  # Same mobile
        )
        with pytest.raises(HTTPException) as exc_info:
            await crm_service.create_customer(dup_mobile_payload, current_user=admin_user)
        assert exc_info.value.status_code == 409
        assert "DUPLICATE" in str(exc_info.value.detail)

    # 5. Database Persistence & Direct Retrieval Verification
    async with sessionmaker() as session:
        repo = CustomerRepository(session, tenant_ctx)
        retrieved = await repo.get(saved_id)
        assert retrieved is not None
        assert retrieved.id == saved_id
        assert retrieved.code == test_code
        assert retrieved.mobile == test_mobile
        assert retrieved.gst_number == test_gstin
        assert retrieved.status == "Active"
        assert retrieved.is_deleted is False


@pytest.mark.asyncio
async def test_phase4_customer_edit_concurrency_and_persistence(tenant_ctx, admin_user):
    """
    PHASE 4 AUDIT:
    - Edit existing customer fields.
    - Optimistic concurrency locking (expected_modified_at mismatch raises 409).
    - Successful persistence of modifications.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB)
    unique_suffix = uuid.uuid4().hex[:6].upper()

    # Create customer for editing
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        created = await crm_service.create_customer(
            CustomerCreate(
                name=f"Edit Test Customer {unique_suffix}",
                code=f"EDT-{unique_suffix}",
                mobile=f"96{uuid.uuid4().int % 100000000:08d}",
                email=f"orig_{unique_suffix.lower()}@test.com",
            ),
            current_user=admin_user,
        )
        cust_id = created.id
        initial_modified_at = created.modified_at

    # 1. Optimistic Locking Test: Stale expected_modified_at must raise 409
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        stale_time = (initial_modified_at or datetime.now(UTC)) - timedelta(hours=2)
        with pytest.raises(HTTPException) as exc_info:
            await crm_service.update_customer(
                cust_id,
                CustomerUpdate(
                    name="Conflicted Update",
                    expected_modified_at=stale_time,
                ),
            )
        assert exc_info.value.status_code == 409
        assert "CONCURRENT_MODIFICATION_DETECTED" in str(exc_info.value.detail)

    # 2. Valid Update: Modify email, profile_notes, tags
    new_email = f"updated_{unique_suffix.lower()}@test.com"
    new_notes = "Updated via E2E Lifecycle Audit"
    new_tags = ["PREMIUM", "VERIFIED"]

    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        updated = await crm_service.update_customer(
            cust_id,
            CustomerUpdate(
                email=new_email,
                profile_notes=new_notes,
                tags=new_tags,
                expected_modified_at=initial_modified_at,
            ),
        )
        assert updated.email == new_email
        assert updated.profile_notes == new_notes
        assert updated.tags == new_tags

    # 3. Direct DB Verification of Updated State
    async with sessionmaker() as session:
        repo = CustomerRepository(session, tenant_ctx)
        persisted = await repo.get(cust_id)
        assert persisted.email == new_email
        assert persisted.profile_notes == new_notes
        assert persisted.tags == new_tags


@pytest.mark.asyncio
async def test_phase5_billing_pos_customer_selection_and_parent_child_visibility(tenant_ctx, admin_user):
    """
    PHASE 5 AUDIT:
    - Standalone customer lookup in billing customer directory.
    - Parent customer controls child customer visibility:
      * When parent.show_child_customers_in_billing == False: Child HIDDEN from billing directory.
      * When parent.show_child_customers_in_billing == True: Child VISIBLE in billing directory.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB)
    unique_suffix = uuid.uuid4().hex[:6].upper()

    parent_code = f"PAR-{unique_suffix}"
    child_code = f"CHD-{unique_suffix}"
    standalone_code = f"STD-{unique_suffix}"

    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)

        # 1. Create Parent Customer with show_child_customers_in_billing = False
        parent = await crm_service.create_customer(
            CustomerCreate(
                name=f"Parent Corp {unique_suffix}",
                code=parent_code,
                mobile=f"95{uuid.uuid4().int % 100000000:08d}",
                show_child_customers_in_billing=False,
            ),
            current_user=admin_user,
        )

        # 2. Create Child Customer with is_dependant = True
        child = await crm_service.create_customer(
            CustomerCreate(
                name=f"Child Branch {unique_suffix}",
                code=child_code,
                mobile=f"94{uuid.uuid4().int % 100000000:08d}",
                is_dependant=True,
            ),
            current_user=admin_user,
        )

        # A customer created without the relationship remains an independent billable account.
        standalone = await crm_service.create_customer(
            CustomerCreate(
                name=f"Standalone Account {unique_suffix}",
                code=standalone_code,
                mobile=f"93{uuid.uuid4().int % 100000000:08d}",
            ),
            current_user=admin_user,
        )

        # 3. Create Parent-Child Relationship link
        rel = CustomerRelationship(
            id=f"rel-{uuid.uuid4().hex[:12]}",
            parent_customer_id=parent.id,
            dependant_customer_id=child.id,
            relation="Branch",
            company_id=TEST_COMPANY_ID,
            is_active=True,
            is_deleted=False,
        )
        session.add(rel)
        await session.commit()
        parent_id = parent.id
        child_id = child.id
        standalone_id = standalone.id

    # 4. Billing Directory Search: Child MUST BE HIDDEN (Parent setting = False)
    async with sessionmaker() as session:
        catalog_res = await BillingCatalogService.get_customers(
            session=session,
            company_id=TEST_COMPANY_ID,
            q=unique_suffix,
        )
        found_ids = {c.id for c in catalog_res.items}
        assert parent_id in found_ids, "Parent customer must appear in billing directory"
        assert child_id not in found_ids, "Child customer MUST BE HIDDEN when parent setting is False"
        assert standalone_id in found_ids, "Independent customer must remain available for billing"

    # 5. Enable visibility on Parent Customer
    async with sessionmaker() as session:
        crm_service = CrmService(session, tenant_ctx)
        await crm_service.update_customer(
            parent_id,
            CustomerUpdate(show_child_customers_in_billing=True),
        )

    # 6. Billing Directory Search: Child MUST NOW BE VISIBLE
    async with sessionmaker() as session:
        catalog_res2 = await BillingCatalogService.get_customers(
            session=session,
            company_id=TEST_COMPANY_ID,
            q=unique_suffix,
        )
        found_ids2 = {c.id for c in catalog_res2.items}
        assert parent_id in found_ids2, "Parent customer must appear in billing directory"
        assert child_id in found_ids2, "Child customer MUST BE VISIBLE when parent setting is True"
        assert standalone_id in found_ids2, "Independent customer must remain available for billing"


@pytest.mark.asyncio
async def test_phase6_sales_invoice_creation_child_guard_and_retrieval(tenant_ctx, admin_user):
    """
    PHASE 6 AUDIT:
    - Child Customer Checkout Guard: Attempting checkout on child customer when parent setting is False
      must be rejected with SMRITI-CUST-042.
    - Authorized Invoice Posting: Post invoice via CanonicalSalesPostingWriter with line items and tenders.
    - Direct Database Persistence & Repository Retrieval: Verify all customer attributes and amounts.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB)
    unique_suffix = uuid.uuid4().hex[:6].upper()
    seq = uuid.uuid4().int % 10000

    parent_code = f"PAR6-{unique_suffix}"
    child_code = f"CHD6-{unique_suffix}"
    standalone_code = f"STD6-{unique_suffix}"
    valid_gstin = _gen_valid_gstin(seq)
    prod_code = f"SKU-{unique_suffix}"
    prod_barcode = f"BAR-{unique_suffix}"

    async with sessionmaker() as session:
        # Create dedicated test item, variant and product in DB
        item = Item(
            id=f"itm-{unique_suffix.lower()}",
            item_code=f"ITM-{unique_suffix}",
            item_name=f"Audit Item {unique_suffix}",
            item_type="FINISHED_GOOD",
            tracking_mode="NONE",
            is_batch_tracked=False,
            is_serial_tracked=False,
            tax_rate=Decimal("18.00"),
            company_id=TEST_COMPANY_ID,
            is_active=True,
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        variant = ItemVariant(
            id=f"var-{unique_suffix.lower()}",
            item_id=item.id,
            company_id=TEST_COMPANY_ID,
            variant_sku=prod_code,
            variant_name=f"Audit Variant {unique_suffix}",
            selling_price=Decimal("1500.00"),
            mrp=Decimal("1899.00"),
            cost_price=Decimal("900.00"),
            tax_rate=Decimal("18.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(variant)
        await session.flush()

        product = Product(
            id=f"prod-{unique_suffix.lower()}",
            code=prod_code,
            sku=prod_code,
            barcode=prod_barcode,
            name=f"Audit Product {unique_suffix}",
            item_id=item.id,
            item_variant_id=variant.id,
            price=Decimal("1500.00"),
            mrp=Decimal("1899.00"),
            gst_percentage=Decimal("18.00"),
            hsn_code="640411",
            category="Footwear",
            stock=100,
            company_id=TEST_COMPANY_ID,
            branch_id=TEST_BRANCH_ID,
            is_active=True,
            is_deleted=False,
        )
        session.add(product)
        await session.commit()

        crm_service = CrmService(session, tenant_ctx)

        # 1. Create Parent with show_child_customers_in_billing = False
        parent = await crm_service.create_customer(
            CustomerCreate(
                name=f"Parent Enterprise {unique_suffix}",
                code=parent_code,
                mobile=f"93{uuid.uuid4().int % 100000000:08d}",
                show_child_customers_in_billing=False,
            ),
            current_user=admin_user,
        )

        # 2. Create Child Customer
        child = await crm_service.create_customer(
            CustomerCreate(
                name=f"Child Enterprise {unique_suffix}",
                code=child_code,
                mobile=f"92{uuid.uuid4().int % 100000000:08d}",
                is_dependant=True,
            ),
            current_user=admin_user,
        )

        # 3. Create Standalone Customer for successful checkout
        standalone = await crm_service.create_customer(
            CustomerCreate(
                name=f"Standalone Client {unique_suffix}",
                code=standalone_code,
                mobile=f"91{uuid.uuid4().int % 100000000:08d}",
                gst_number=valid_gstin,
                tags=["DIRECT_RETAIL"],
            ),
            current_user=admin_user,
        )

        # Link Child to Parent
        rel = CustomerRelationship(
            id=f"rel-{uuid.uuid4().hex[:12]}",
            parent_customer_id=parent.id,
            dependant_customer_id=child.id,
            relation="Branch",
            company_id=TEST_COMPANY_ID,
            is_active=True,
            is_deleted=False,
        )
        session.add(rel)
        await session.commit()

        child_id = child.id
        standalone_id = standalone.id
        standalone_name = standalone.name
        standalone_gstin = standalone.gst_number

    # 4. Child Checkout Guard Test: Attempt checkout on child when parent disabled
    async with sessionmaker() as session:
        bad_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                source_channel="POS_RETAIL",
                idempotency_key=f"idem-chd-{uuid.uuid4().hex}",
            ),
            customer_id=child_id,
            customer_name="Child Enterprise",
            items=[
                CanonicalPostingLineItem(
                    code=prod_code,
                    quantity=Decimal("1.00"),
                    unit_price=Decimal("1500.00"),
                    gst_rate=Decimal("18.00"),
                    hsn_code="640411",
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("1770.00"),
                )
            ],
        )
        with pytest.raises(HTTPException) as exc_info:
            await CanonicalSalesPostingWriter.post_sales_transaction(
                session=session,
                req=bad_req,
                idempotency_key=bad_req.context.idempotency_key,
                commit=False,
            )
        assert exc_info.value.status_code == 400
        assert "SMRITI-CUST-042" in str(exc_info.value.detail)

    # 5. Successful Sales Invoice Creation for Authorized Standalone Customer
    idemp_key = f"idem-std-{uuid.uuid4().hex}"
    async with sessionmaker() as session:
        good_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id=TEST_COMPANY_ID,
                branch_id=TEST_BRANCH_ID,
                source_channel="POS_RETAIL",
                idempotency_key=idemp_key,
            ),
            customer_id=standalone_id,
            customer_name=standalone_name,
            customer_gstin=standalone_gstin,
            items=[
                CanonicalPostingLineItem(
                    code=prod_code,
                    name=f"Audit Product {unique_suffix}",
                    quantity=Decimal("2.00"),
                    unit_price=Decimal("1500.00"),
                    gst_rate=Decimal("18.00"),
                    hsn_code="640411",
                )
            ],
            tenders=[
                CanonicalTenderItem(
                    tender_type="CASH",
                    amount=Decimal("3000.00"),
                )
            ],
        )
        posting_result = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=session,
            req=good_req,
            idempotency_key=idemp_key,
            commit=True,
        )
        assert posting_result.success is True
        assert posting_result.invoice_id is not None
        assert posting_result.invoice_no is not None
        assert posting_result.customer_id == standalone_id
        assert posting_result.net_amount == Decimal("3000.00")
        committed_inv_id = posting_result.invoice_id
        committed_inv_no = posting_result.invoice_no

    # 6. Invoice Retrieval and Customer Linkage Verification
    async with sessionmaker() as session:
        repo = SalesInvoiceRepository(session, TenantContext(company_id=TEST_COMPANY_ID, branch_id=None))

        # Retrieve by invoice ID
        inv_by_id = await repo.get(committed_inv_id)
        assert inv_by_id is not None
        assert inv_by_id.id == committed_inv_id
        assert inv_by_id.invoice_no == committed_inv_no
        assert inv_by_id.customer_id == standalone_id
        assert inv_by_id.customer_name == standalone_name
        assert inv_by_id.customer_gstin == standalone_gstin
        assert len(inv_by_id.items) == 1
        assert Decimal(str(inv_by_id.items[0].quantity)) == Decimal("2.00")
        assert Decimal(str(inv_by_id.items[0].price)) == Decimal("1500.00")
        assert Decimal(str(inv_by_id.grand_total)) == Decimal("3000.00")

        # Retrieve by invoice number
        inv_by_no = await repo.get(committed_inv_no)
        assert inv_by_no is not None
        assert inv_by_no.id == committed_inv_id
        assert inv_by_no.customer_id == standalone_id
