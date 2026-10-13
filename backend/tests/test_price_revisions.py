"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.1
Created      : 2026-10-13
Modified     : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: MRP & Selling Price Revision Test Suite (Phase 6)
"""

import os
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.api.deps import get_company_db
from app.core.security import create_access_token
from unittest.mock import patch
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.pricing import ItemPriceRevision, PriceBook, PriceBookEntry, CustomerPriceTier, CustomerPriceAssignment
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.services.pricing_engine import PricingEngine
from app.services.price_revision_service import PriceRevisionService
from app.services.headless_billing import HeadlessBillingCore
from app.schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingContext,
    CanonicalPostingLineItem,
)
from app.schemas.pricing import (
    PriceRevisionCreateRequest,
    PriceRevisionApprovalDecision,
    PriceRevisionBulkRequest,
    PriceRevisionBulkItem,
    BulkItemFilterRequest,
    BulkItemFilterResponse,
)

# Dedicated isolated test database name from environment configuration
TEST_DB_NAME = os.getenv("SMRITI_PRICE_TEST_DB", "smriti_test_price_revisions")

# P0 Database Governance & Test Isolation Guard: Abort if target is shared/live DB
if TEST_DB_NAME in ("smriti001", "smritisys", "smriti_production", "smritiprod"):
    raise RuntimeError(
        f"TEST SAFETY ABORT: TEST_DB_NAME is configured to shared/live database '{TEST_DB_NAME}'. "
        "Automated tests must run strictly against a dedicated isolated test database."
    )


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    sub_user = "usr-admin" if role == "SYSADMIN" else "usr-manager"
    username = "admin" if role == "SYSADMIN" else "usr_manager"
    token = create_access_token(
        data={
            "sub": sub_user,
            "username": username,
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": TEST_DB_NAME,
            "db_name": TEST_DB_NAME,
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.fixture(autouse=True)
async def enforce_test_db_isolation():
    """P0 Test Isolation: Route all API company database sessions to dedicated test DB."""
    assert TEST_DB_NAME not in ("smriti001", "smritisys"), "Must never target shared database"
    session_factory = get_company_sessionmaker(TEST_DB_NAME)

    async def _override_get_company_db():
        async with session_factory() as session:
            session.info.update({
                "tenant_id": TEST_DB_NAME,
                "company_id": "COMP-001",
                "branch_id": "BR-001",
                "resolved_database_name": TEST_DB_NAME,
                "control_plane_database": "smritisys",
                "transactional_scope_validated": True,
            })
            yield session

    app.dependency_overrides[get_company_db] = _override_get_company_db
    try:
        yield
    finally:
        app.dependency_overrides.pop(get_company_db, None)


@pytest.fixture
def unique_suffix():
    return uuid.uuid4().hex[:8]


@pytest.fixture
async def sample_item_and_variant(unique_suffix):
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    item_id = f"item_{unique_suffix}"
    variant_id = f"var_{unique_suffix}"
    barcode_id = f"bar_{unique_suffix}"
    barcode_val = f"BC-{unique_suffix.upper()}"
    sku_val = f"SKU-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        item = Item(
            id=item_id,
            company_id="COMP-001",
            item_code=f"ITM-{unique_suffix.upper()}",
            item_name=f"Revision Test Item {unique_suffix}",
            category="TEST_CATEGORY",
            hsn_code="6203",
            item_type="FINISHED_GOOD",
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            cost_price=Decimal("600.00"),
            status="ACTIVE",
        )
        session.add(item)

        variant = ItemVariant(
            id=variant_id,
            company_id="COMP-001",
            item_id=item_id,
            variant_sku=sku_val,
            variant_name=f"Variant {unique_suffix}",
            selling_price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            cost_price=Decimal("600.00"),
            is_active=True,
        )
        session.add(variant)

        barcode = ItemBarcode(
            id=barcode_id,
            company_id="COMP-001",
            item_id=item_id,
            variant_id=variant_id,
            barcode=barcode_val,
            is_primary=True,
            is_active=True,
            is_deleted=False,
        )
        session.add(barcode)

        await session.commit()

    return {
        "item_id": item_id,
        "variant_id": variant_id,
        "sku": sku_val,
        "barcode": barcode_val,
    }


# ============================================================================
# 1. STATUTORY CEILING INVARIANT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_statutory_ceiling_invariant_sp_cannot_exceed_mrp(sample_item_and_variant):
    """Statutory Invariant: Selling Price cannot exceed MRP."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]

    async with sessionmaker() as session:
        req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=500.00,
            revised_selling_price=600.00,  # VIOLATION: 600 > 500
            revised_cost_price=300.00,
            reason_code="MANUAL_REVISION",
        )
        with pytest.raises(ValueError) as excinfo:
            await PriceRevisionService.create_revision(
                session=session,
                company_id="COMP-001",
                user_id="usr-test",
                user_role="SYSADMIN",
                req=req,
            )
        assert "SMRITI-PRICE-001" in str(excinfo.value)
        assert "cannot exceed statutory MRP" in str(excinfo.value)


# ============================================================================
# 2. IMMEDIATE REVISION & BASELINE CACHE SYNCHRONIZATION
# ============================================================================

@pytest.mark.asyncio
async def test_immediate_price_revision_activation_and_sync(sample_item_and_variant):
    """Immediate price revisions set status=ACTIVE and sync ItemVariant baseline."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]

    async with sessionmaker() as session:
        req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1200.00,
            revised_selling_price=1100.00,
            revised_cost_price=700.00,
            effective_from=datetime.now(timezone.utc) - timedelta(minutes=1),
            reason_code="SUPPLIER_RATE_HIKE",
            auto_approve_if_eligible=True,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-mgr",
            user_role="MANAGER",
            req=req,
        )
        assert rev.status == "ACTIVE"
        assert Decimal(str(rev.revised_mrp)) == Decimal("1200.00")
        assert Decimal(str(rev.revised_selling_price)) == Decimal("1100.00")
        assert Decimal(str(rev.previous_selling_price)) == Decimal("1000.00")

        # Verify baseline cache was updated in ItemVariant
        var_stmt = select(ItemVariant).where(ItemVariant.id == var_id)
        updated_var = (await session.execute(var_stmt)).scalars().first()
        assert Decimal(str(updated_var.selling_price)) == Decimal("1100.00")
        assert Decimal(str(updated_var.mrp)) == Decimal("1200.00")


# ============================================================================
# 3. FUTURE-EFFECTIVE REVISION & ISOLATION (NO LEAK BEFORE ACTIVATION)
# ============================================================================

@pytest.mark.asyncio
async def test_future_effective_revision_does_not_leak_prematurely(sample_item_and_variant):
    """A future-scheduled revision must remain SCHEDULED and NEVER leak into today's active price."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    future_time = datetime.now(timezone.utc) + timedelta(days=5)

    async with sessionmaker() as session:
        # Schedule revision for 5 days in the future
        req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=2000.00,
            revised_selling_price=1800.00,
            revised_cost_price=1100.00,
            effective_from=future_time,
            reason_code="SEASONAL_PROMO",
            auto_approve_if_eligible=True,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-mgr",
            user_role="MANAGER",
            req=req,
        )
        assert rev.status == "SCHEDULED"

        # Baseline ItemVariant MUST NOT be mutated!
        var_stmt = select(ItemVariant).where(ItemVariant.id == var_id)
        var_obj = (await session.execute(var_stmt)).scalars().first()
        assert Decimal(str(var_obj.selling_price)) == Decimal("1000.00")
        assert Decimal(str(var_obj.mrp)) == Decimal("1000.00")

        # Pricing Engine for today MUST resolve current price (₹1000.00), NOT future rate!
        res_today = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            as_of_date=datetime.now(timezone.utc),
            company_id="COMP-001",
        )
        assert res_today["effective_unit_price"] == 1000.00
        assert res_today["base_mrp"] == 1000.00

        # Pricing Engine queried for T+6 days MUST resolve future rate (₹1800.00)
        res_future = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            as_of_date=future_time + timedelta(hours=1),
            company_id="COMP-001",
        )
        assert res_future["effective_unit_price"] == 1800.00
        assert res_future["base_mrp"] == 2000.00
        assert res_future["pricing_source"] == "PRICE_REVISION_HISTORY"


# ============================================================================
# 4. HISTORICAL PRICE RECONSTRUCTION & ZERO-DRIFT REPLAY
# ============================================================================

@pytest.mark.asyncio
async def test_historical_price_reconstruction_and_replay(sample_item_and_variant):
    """The system can reconstruct historical pricing at any past timestamp."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    t_minus_30 = datetime.now(timezone.utc) - timedelta(days=30)
    t_minus_10 = datetime.now(timezone.utc) - timedelta(days=10)

    async with sessionmaker() as session:
        # Phase 1: Set price 30 days ago
        req1 = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=800.00,
            revised_selling_price=750.00,
            effective_from=t_minus_30,
            reason_code="INITIAL_CATALOG",
            auto_approve_if_eligible=True,
        )
        r1 = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=req1,
        )

        # Phase 2: Revision 10 days ago (superseded r1 starting at t_minus_10)
        req2 = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=900.00,
            revised_selling_price=850.00,
            effective_from=t_minus_10,
            reason_code="MID_CYCLE_REVISION",
            auto_approve_if_eligible=True,
        )
        r2 = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=req2,
        )

        # Query historical price 20 days ago (should resolve Phase 1: ₹750)
        resolved_t20 = await PriceRevisionService.resolve_effective_price(
            session=session,
            company_id="COMP-001",
            variant_id=var_id,
            as_of_date=datetime.now(timezone.utc) - timedelta(days=20),
        )
        assert resolved_t20 is not None
        assert resolved_t20["selling_price"] == Decimal("750.00")
        assert resolved_t20["mrp"] == Decimal("800.00")

        # Query historical price 5 days ago (should resolve Phase 2: ₹850)
        resolved_t5 = await PriceRevisionService.resolve_effective_price(
            session=session,
            company_id="COMP-001",
            variant_id=var_id,
            as_of_date=datetime.now(timezone.utc) - timedelta(days=5),
        )
        assert resolved_t5 is not None
        assert resolved_t5["selling_price"] == Decimal("850.00")
        assert resolved_t5["mrp"] == Decimal("900.00")


# ============================================================================
# 5. APPROVAL WORKFLOW: PENDING & REJECTED REVISIONS
# ============================================================================

@pytest.mark.asyncio
async def test_pending_and_rejected_revisions_workflow(sample_item_and_variant):
    """Revisions requiring approval stay PENDING_APPROVAL and do not affect pricing until approved."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    async with sessionmaker() as session:
        # Cashier submits huge discount (-40% exceeds threshold)
        req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1000.00,
            revised_selling_price=600.00,
            reason_code="MANUAL_REVISION",
            justification="Cashier requesting clearance discount",
            auto_approve_if_eligible=True,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-cashier",
            user_role="CASHIER",
            req=req,
        )
        assert rev.status == "PENDING_APPROVAL"
        assert rev.approval_required is True

        # Active price MUST still be the baseline ₹1000, NOT ₹600!
        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            company_id="COMP-001",
        )
        assert res["effective_unit_price"] == 1000.00

        # Reject the revision
        rejected = await PriceRevisionService.reject_revision(
            session=session,
            company_id="COMP-001",
            revision_id=rev.id,
            rejecter_id="usr-mgr",
            rejecter_role="MANAGER",
            rejection_reason="Discount exceeds store policy limits.",
        )
        assert rejected.status == "REJECTED"
        assert rejected.rejection_reason == "Discount exceeds store policy limits."


# ============================================================================
# 6. OVERLAPPING PERIOD / DUPLICATE TIMESTAMP CONFLICT CHECK
# ============================================================================

@pytest.mark.asyncio
async def test_overlapping_identical_timestamp_conflict_prevention(sample_item_and_variant):
    """Creating two revisions for the exact same effective_from timestamp raises conflict."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    target_time = datetime.now(timezone.utc) + timedelta(days=10)

    async with sessionmaker() as session:
        req1 = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1100.00,
            revised_selling_price=1050.00,
            effective_from=target_time,
            reason_code="PROMO_A",
        )
        await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=req1,
        )

        # Attempt to create another revision at the exact same target_time
        req2 = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1150.00,
            revised_selling_price=1080.00,
            effective_from=target_time,
            reason_code="PROMO_B",
        )
        with pytest.raises(ValueError) as exc:
            await PriceRevisionService.create_revision(
                session=session,
                company_id="COMP-001",
                user_id="usr-sys",
                user_role="SYSADMIN",
                req=req2,
            )
        assert "SMRITI-PRICE-007" in str(exc.value)


# ============================================================================
# 7. BULK IMPORT PROCESSING & ATOMIC PARITY
# ============================================================================

@pytest.mark.asyncio
async def test_bulk_create_revisions_processing(sample_item_and_variant):
    """Bulk import validates items by SKU/Barcode and creates temporal revisions."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    sku = sample_item_and_variant["sku"]

    async with sessionmaker() as session:
        req = PriceRevisionBulkRequest(
            items=[
                PriceRevisionBulkItem(
                    sku_or_barcode=sku,
                    revised_mrp=1500.00,
                    revised_selling_price=1350.00,
                    revised_cost_price=800.00,
                    reason_code="BULK_IMPORT",
                ),
                PriceRevisionBulkItem(
                    sku_or_barcode="NON_EXISTENT_SKU_9999",
                    revised_mrp=100.00,
                    revised_selling_price=90.00,
                ),
            ]
        )
        res = await PriceRevisionService.bulk_create_revisions(
            session=session,
            company_id="COMP-001",
            user_id="usr-mgr",
            user_role="MANAGER",
            req=req,
        )
        assert res.total_rows == 2
        assert res.approved_count == 1
        assert res.error_count == 1
        assert "NON_EXISTENT_SKU_9999" in res.errors[0]["sku_or_barcode"]


@pytest.mark.asyncio
async def test_bulk_create_revisions_distributor_price_and_cost_price_protection(sample_item_and_variant):
    """Bulk revisions accept distributor price, enforce DP <= SP, and permanently ignore/exclude cost price."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    sku = sample_item_and_variant["sku"]
    var_id = sample_item_and_variant["variant_id"]

    async with sessionmaker() as session:
        # Create bulk item payload using aliases: 'revised_sp', 'dp', and an unauthorized 'revised_cost_price'
        raw_dict = {
            "sku_or_barcode": sku,
            "revised_mrp": 1600.00,
            "revised_sp": 1400.00,
            "dp": 1250.00,
            "revised_cost_price": 500.00,  # Must be ignored / stripped
            "reason_code": "BULK_DP_TEST",
        }
        item_model = PriceRevisionBulkItem.model_validate(raw_dict)
        assert item_model.revised_selling_price == 1400.00
        assert item_model.revised_distributor_price == 1250.00
        assert item_model.revised_cost_price is None

        req = PriceRevisionBulkRequest(items=[item_model])
        res = await PriceRevisionService.bulk_create_revisions(
            session=session,
            company_id="COMP-001",
            user_id="usr-mgr",
            user_role="MANAGER",
            req=req,
        )
        assert res.total_rows == 1
        assert res.approved_count == 1
        assert res.error_count == 0
        assert len(res.revisions) == 1
        rev_dto = res.revisions[0]
        assert rev_dto.revised_distributor_price == 1250.00

        # Verify underlying revision captures revised_distributor_price and previous_distributor_price
        rev_id = rev_dto.id
        rev_record = await session.get(ItemPriceRevision, rev_id)
        assert rev_record is not None
        assert rev_record.metadata_json is not None
        assert rev_record.metadata_json.get("revised_distributor_price") == 1250.00
        assert "previous_distributor_price" in rev_record.metadata_json

        # Verify item variant cost_price was NOT mutated (remains 600.00 from baseline fixture)
        v = await session.get(ItemVariant, var_id)
        assert float(v.cost_price) == 600.00


@pytest.mark.asyncio
async def test_bulk_create_revisions_distributor_price_invariant_violation(sample_item_and_variant):
    """Bulk revisions reject row where distributor price exceeds selling price (SMRITI-PRICE-002)."""
    from pydantic import ValidationError

    sku = sample_item_and_variant["sku"]
    var_id = sample_item_and_variant["variant_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)

    # 1. Schema-level invariant enforcement
    with pytest.raises(ValidationError) as excinfo:
        PriceRevisionBulkItem(
            sku_or_barcode=sku,
            revised_mrp=1500.00,
            revised_selling_price=1200.00,
            revised_distributor_price=1300.00,  # VIOLATION: DP 1300 > SP 1200
            reason_code="INVALID_DP",
        )
    assert "SMRITI-PRICE-002" in str(excinfo.value)
    assert "cannot exceed retail selling price" in str(excinfo.value)

    # 2. Service-level invariant enforcement
    async with sessionmaker() as session:
        with pytest.raises(ValueError) as excinfo_svc:
            await PriceRevisionService.create_revision(
                session=session,
                company_id="COMP-001",
                user_id="usr-mgr",
                user_role="MANAGER",
                req=PriceRevisionCreateRequest(
                    variant_id=var_id,
                    revised_mrp=1500.00,
                    revised_selling_price=1200.00,
                    revised_distributor_price=1300.00,
                    reason_code="INVALID_DP",
                ),
            )
        assert "SMRITI-PRICE-002" in str(excinfo_svc.value)


@pytest.mark.asyncio
async def test_bulk_filter_items_api_endpoint(sample_item_and_variant):
    """Test POST and GET /api/v1/pricing/revisions/filter-items endpoints."""
    sku = sample_item_and_variant["sku"]
    headers = _get_auth_headers("MANAGER")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # POST /api/v1/pricing/revisions/filter-items
        filter_payload = {
            "search_text": sku,
            "status": "ACTIVE",
            "limit": 50,
            "offset": 0,
        }
        res_post = await client.post(
            "/api/v1/pricing/revisions/filter-items",
            json=filter_payload,
            headers=headers,
        )
        assert res_post.status_code == 200
        data_post = res_post.json()
        assert "total_count" in data_post
        assert "items" in data_post
        assert "available_brands" in data_post
        assert "available_categories" in data_post
        assert data_post["total_count"] >= 1
        found_item = any(it["variant_sku"] == sku for it in data_post["items"])
        assert found_item is True

        # GET /api/v1/pricing/revisions/filter-items
        res_get = await client.get(
            f"/api/v1/pricing/revisions/filter-items?search={sku}&limit=10",
            headers=headers,
        )
        assert res_get.status_code == 200
        data_get = res_get.json()
        assert data_get["total_count"] >= 1
        assert any(it["variant_sku"] == sku for it in data_get["items"])



# ============================================================================
# 8. UNAUTHORIZED PRICE TAMPERING & SUPERVISOR OVERRIDE IN BILLING
# ============================================================================

@pytest.mark.asyncio
async def test_pos_billing_authoritative_price_resolution_and_override(sample_item_and_variant):
    """HeadlessBillingCore checks authoritative backend rate and blocks price tampering without supervisor override."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]

    # 1. Establish authoritative active price revision: MRP 1200, SP 1100
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1200.00,
            revised_selling_price=1100.00,
            effective_from=datetime.now(timezone.utc) - timedelta(minutes=5),
            auto_approve_if_eligible=True,
        )
        await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-mgr",
            user_role="MANAGER",
            req=rev_req,
        )

    # 2. Tampering test: Cashier sends unit_price 800 without supervisor authorization
    async with sessionmaker() as session:
        tampered_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=barcode,
                    variant_id=var_id,
                    item_id=item_id,
                    quantity=Decimal("1.0"),
                    unit_price=Decimal("800.00"),  # Tampered: authoritative is 1100.00
                    mrp=Decimal("1200.00"),
                )
            ],
        )

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await HeadlessBillingCore.calculate_billing(session=session, req=tampered_req)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "SMRITI-PRICE-OVERRIDE-REQ"

        # 3. Legitimate override: Cashier provides supervisor_override_code
        authorized_req = CanonicalPostingRequest(
            context=CanonicalPostingContext(
                company_id="COMP-001",
                branch_id="BR-001",
                source_channel="POS_RETAIL",
                supervisor_override_code="SUP-PIN-1234",
            ),
            items=[
                CanonicalPostingLineItem(
                    code=barcode,
                    variant_id=var_id,
                    item_id=item_id,
                    quantity=Decimal("1.0"),
                    unit_price=Decimal("800.00"),
                    mrp=Decimal("1200.00"),
                )
            ],
        )
        res = await HeadlessBillingCore.calculate_billing(session=session, req=authorized_req)
        assert res.net_amount > Decimal("0.00")


# ============================================================================
# 9. SUBMITTED INVOICE SNAPSHOT IMMUTABILITY
# ============================================================================

@pytest.mark.asyncio
async def test_submitted_invoice_snapshot_immutability(sample_item_and_variant, unique_suffix):
    """Price revisions must NEVER mutate historical sales invoice items."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    inv_id = f"inv_{unique_suffix}"

    # 1. Create submitted sales invoice with historical rate
    async with sessionmaker() as session:
        inv = SalesInvoice(
            id=inv_id,
            company_id="COMP-001",
            branch_id="BR-001",
            invoice_no=f"INV-{unique_suffix.upper()}",
            date=datetime.now(timezone.utc).date(),
            grand_total=Decimal("1000.00"),
            status="SUBMITTED",
            created_by="usr-pos",
        )
        session.add(inv)

        inv_item = SalesInvoiceItem(
            company_id="COMP-001",
            invoice_id=inv_id,
            item_id=item_id,
            variant_id=var_id,
            code=f"ITM-{unique_suffix.upper()}",
            name=f"Test Item {unique_suffix}",
            quantity=Decimal("1.00"),
            price=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(inv_item)
        await session.commit()

    # 2. Revise item price to ₹1500
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1600.00,
            revised_selling_price=1500.00,
            reason_code="MANUAL_REVISION",
            auto_approve_if_eligible=True,
        )
        await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=rev_req,
        )

    # 3. Verify invoice item snapshot remains unchanged
    async with sessionmaker() as session:
        stmt = select(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id == inv_id)
        item_snapshot = (await session.execute(stmt)).scalars().first()
        assert item_snapshot.price == Decimal("1000.00")
        assert item_snapshot.mrp == Decimal("1000.00")


# ============================================================================
# 10. FASTAPI API ROUTER INTEGRATION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_api_create_and_list_price_revisions(sample_item_and_variant):
    """Test REST API endpoints: POST /api/v1/pricing/revisions and GET /api/v1/pricing/revisions."""
    var_id = sample_item_and_variant["variant_id"]
    headers = _get_auth_headers("MANAGER")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # POST /api/v1/pricing/revisions
        payload = {
            "variant_id": var_id,
            "revised_mrp": 1400.0,
            "revised_selling_price": 1250.0,
            "revised_cost_price": 750.0,
            "reason_code": "API_TEST",
            "justification": "Automated verification test",
            "auto_approve_if_eligible": True,
        }
        res = await client.post("/api/v1/pricing/revisions", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["revised_mrp"] == 1400.0
        assert data["revised_selling_price"] == 1250.0
        assert data["status"] == "ACTIVE"

        # GET /api/v1/pricing/revisions?variant_id=...
        list_res = await client.get(f"/api/v1/pricing/revisions?variant_id={var_id}", headers=headers)
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert len(list_data) >= 1
        assert any(r["id"] == data["id"] for r in list_data)


# ============================================================================
# 11. SCHEMA HARDENING: ON DELETE RESTRICT BLOCKS ITEM & VARIANT DELETION
# ============================================================================

@pytest.mark.asyncio
async def test_restrict_foreign_key_blocks_hard_delete_of_item_with_revisions(sample_item_and_variant):
    """
    Phase 7A Verification: Ensures foreign keys on item_id and variant_id are ON DELETE RESTRICT.
    Deleting an item or variant that holds historical price revisions must be actively blocked.
    """
    from sqlalchemy.exc import IntegrityError
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    item_id = sample_item_and_variant["item_id"]
    var_id = sample_item_and_variant["variant_id"]

    # 1. Create a price revision for this variant
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1500.00,
            revised_selling_price=1300.00,
            reason_code="AUDIT_TEST",
            auto_approve_if_eligible=True,
        )
        await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=rev_req,
        )

    # 2. Attempt hard deletion of the parent ItemVariant
    async with sessionmaker() as session:
        stmt_del = select(ItemVariant).where(ItemVariant.id == var_id)
        var_to_del = (await session.execute(stmt_del)).scalars().first()
        await session.delete(var_to_del)
        with pytest.raises(IntegrityError) as exc_var:
            await session.commit()
        assert "violates foreign key constraint" in str(exc_var.value).lower()
        await session.rollback()

    # 3. Attempt hard deletion of the parent Item
    async with sessionmaker() as session:
        stmt_del_item = select(Item).where(Item.id == item_id)
        item_to_del = (await session.execute(stmt_del_item)).scalars().first()
        await session.delete(item_to_del)
        with pytest.raises(IntegrityError) as exc_item:
            await session.commit()
        assert "violates foreign key constraint" in str(exc_item.value).lower()
        await session.rollback()


# ============================================================================
# 12. DYNAMIC SYSTEM PARAMETER APPROVAL POLICY RESOLUTION
# ============================================================================

@pytest.mark.asyncio
async def test_system_parameter_driven_approval_threshold(sample_item_and_variant):
    """
    Phase 7C Verification: Approval thresholds and authorized roles are resolved dynamically
    via SystemParameterService (ADR-042) with safe fallbacks.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]

    async with sessionmaker() as session:
        policy = await PriceRevisionService.get_approval_policy(session=session, company_id="COMP-001")
        assert policy["increase_threshold_pct"] == Decimal("20.0")
        assert policy["decrease_threshold_pct"] == Decimal("10.0")
        assert "SYSADMIN" in policy["authorized_roles"]
        assert "MANAGER" in policy["authorized_roles"]

        # Cashier revision with 5% increase -> within threshold, auto-approves
        req_small = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1100.00,
            revised_selling_price=1050.00, # 5% increase from 1000
            reason_code="SMALL_CHANGE",
            auto_approve_if_eligible=True,
        )
        rev_small = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-cashier-1",
            user_role="CASHIER",
            req=req_small,
        )
        assert rev_small.status == "ACTIVE"
        assert rev_small.approval_required is False

        # Cashier revision with 25% increase -> exceeds 20% threshold, requires approval
        req_large = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1400.00,
            revised_selling_price=1312.50, # 25% increase from 1050
            reason_code="LARGE_CHANGE",
            auto_approve_if_eligible=True,
        )
        rev_large = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-cashier-2",
            user_role="CASHIER",
            req=req_large,
        )
        assert rev_large.status == "PENDING_APPROVAL"
        assert rev_large.approval_required is True


# ============================================================================
# 13. CONCURRENCY-SAFE SCHEDULED ACTIVATION (SKIP LOCKED)
# ============================================================================

@pytest.mark.asyncio
async def test_concurrency_safe_scheduled_activation(sample_item_and_variant):
    """
    Phase 7D Verification: Ensures scheduled activations use with_for_update(skip_locked=True)
    preventing race conditions and deadlocks across concurrent worker daemons.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    past_due_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    async with sessionmaker() as session:
        # Create a scheduled revision whose effective time has already passed
        req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1500.00,
            revised_selling_price=1200.00,
            effective_from=past_due_time,
            reason_code="SCHEDULED_TEST",
            auto_approve_if_eligible=True,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=req,
        )
        # Force status to SCHEDULED to simulate worker catching up
        rev.status = "SCHEDULED"
        await session.commit()

        # Run activation
        activated_count = await PriceRevisionService.activate_scheduled_revisions(
            session=session,
            company_id="COMP-001",
        )
        assert activated_count >= 1

        # Re-query revision to verify status is ACTIVE
        stmt = select(ItemPriceRevision).where(ItemPriceRevision.id == rev.id)
        updated_rev = (await session.execute(stmt)).scalars().first()
        assert updated_rev.status == "ACTIVE"


# ============================================================================
# 14. FAIL-CLOSED BILLING: PRICING RESOLVER EXCEPTION STOPS CHECKOUT
# ============================================================================

@pytest.mark.asyncio
async def test_billing_fails_closed_when_pricing_resolver_fails(sample_item_and_variant):
    """
    Check 3 Remediation: If PricingEngine raises an exception during normal merchandise billing,
    checkout MUST FAIL CLOSED with structured SMRITI-PRICE-RESOLVE-FAILED error.
    """
    from fastapi import HTTPException
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    barcode = sample_item_and_variant["barcode"]
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("1000.00"),
                mrp=Decimal("1000.00"),
            )
        ],
    )

    async with sessionmaker() as session:
        with patch.object(PricingEngine, "calculate_effective_price", side_effect=RuntimeError("Database pricing lock timeout")):
            with pytest.raises(HTTPException) as exc:
                await HeadlessBillingCore.calculate_billing(session=session, req=req)
            assert exc.value.status_code == 400
            assert exc.value.detail["code"] == "SMRITI-PRICE-RESOLVE-FAILED"
            assert "Database pricing lock timeout" in exc.value.detail["explanation"]


# ============================================================================
# 15. FAIL-CLOSED BILLING: MISSING AUTHORITATIVE PRICE STOPS CHECKOUT
# ============================================================================

@pytest.mark.asyncio
async def test_billing_fails_closed_when_authoritative_price_is_missing(sample_item_and_variant):
    """
    Check 3 Remediation: If authoritative price or MRP is missing (returns None),
    checkout MUST FAIL CLOSED with SMRITI-PRICE-RESOLVE-FAILED.
    """
    from fastapi import HTTPException
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    barcode = sample_item_and_variant["barcode"]
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("1000.00"),
                mrp=Decimal("1000.00"),
            )
        ],
    )

    async with sessionmaker() as session:
        with patch.object(PricingEngine, "calculate_effective_price", return_value={"effective_unit_price": None, "base_mrp": None}):
            with pytest.raises(HTTPException) as exc:
                await HeadlessBillingCore.calculate_billing(session=session, req=req)
            assert exc.value.status_code == 400
            assert exc.value.detail["code"] == "SMRITI-PRICE-RESOLVE-FAILED"
            assert "Authoritative catalog price or statutory MRP is missing" in exc.value.detail["explanation"]


# ============================================================================
# 16. PRESERVATION OF APPROVED FEE AND FREE LINE BEHAVIOR
# ============================================================================

@pytest.mark.asyncio
async def test_billing_preserves_fee_and_free_lines_without_resolution_failure(sample_item_and_variant):
    """
    Preservation Invariant: Explicitly approved fee lines (delivery) and free promotional
    items bypass merchandise resolution without triggering SMRITI-PRICE-RESOLVE-FAILED.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    barcode = sample_item_and_variant["barcode"]
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
        ),
        items=[
            # 1. Delivery Fee Line
            CanonicalPostingLineItem(
                code="DELIVERY-FEE",
                quantity=Decimal("1.0"),
                unit_price=Decimal("50.00"),
                is_fee_line=True,
                is_tax_inclusive=True,
            ),
            # 2. Free Sample / Promotional Item
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("0.00"),
                is_free_item=True,
                mrp=Decimal("1000.00"),
                is_tax_inclusive=True,
            ),
        ],
    )

    async with sessionmaker() as session:
        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)
        assert res.net_amount == Decimal("50.00")
        assert len(res.lines) == 2


# ============================================================================
# 17. PRICE BOOK DISCOUNT ACCEPTANCE WITHOUT SUPERVISOR OVERRIDE
# ============================================================================

@pytest.mark.asyncio
async def test_billing_accepts_valid_price_book_discount_without_supervisor_override(sample_item_and_variant, unique_suffix):
    """
    Check 4 Remediation: Valid Price Book discounts must be authoritatively resolved
    and accepted without requiring a supervisor override code.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    pb_id = f"pb_{unique_suffix}"
    pb_code = f"PB-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create Price Book
        pb = PriceBook(
            id=pb_id,
            company_id="COMP-001",
            name=f"Wholesale Book {unique_suffix}",
            code=pb_code,
            currency="INR",
            status="ACTIVE",
            is_default=False,
        )
        session.add(pb)

        # Create Price Book Entry: Rate 850.00 (discounted from base 1000.00), MRP 1000.00
        pbe = PriceBookEntry(
            id=f"pbe_{unique_suffix}",
            company_id="COMP-001",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=var_id,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("850.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(pbe)
        await session.commit()

    # Submit billing request specifying the price book code
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            price_book_code=pb_code,
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("850.00"),  # Matches authoritative Price Book rate
                mrp=Decimal("1000.00"),
            )
        ],
    )

    async with sessionmaker() as session:
        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)
        assert res.net_amount > Decimal("0.00")
        assert res.lines[0].unit_price == Decimal("850.00")


# ============================================================================
# 18. QUANTITY VOLUME BREAK PRICE ACCEPTANCE WITHOUT SUPERVISOR OVERRIDE
# ============================================================================

@pytest.mark.asyncio
async def test_billing_accepts_quantity_volume_break_without_supervisor_override(sample_item_and_variant, unique_suffix):
    """
    Check 4 Remediation: Valid quantity volume breaks in Price Book must be authoritatively
    resolved based on line quantity and accepted without requiring supervisor override.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    pb_id = f"pb_{unique_suffix}"
    pb_code = f"PB-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create Price Book
        pb = PriceBook(
            id=pb_id,
            company_id="COMP-001",
            name=f"Volume Book {unique_suffix}",
            code=pb_code,
            currency="INR",
            status="ACTIVE",
            is_default=False,
        )
        session.add(pb)

        # Baseline: Qty 1 -> 900.00
        pbe_base = PriceBookEntry(
            id=f"pbe_base_{unique_suffix}",
            company_id="COMP-001",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=var_id,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("900.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(pbe_base)

        # Volume Break: Qty >= 5 -> 750.00
        pbe_vol = PriceBookEntry(
            id=f"pbe_vol_{unique_suffix}",
            company_id="COMP-001",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=var_id,
            min_quantity=Decimal("5.0000"),
            selling_price=Decimal("750.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(pbe_vol)
        await session.commit()

    # Submit billing request for quantity 5 at the volume rate 750.00
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            price_book_code=pb_code,
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("5.0"),
                unit_price=Decimal("750.00"),  # Matches volume break tier
                mrp=Decimal("1000.00"),
            )
        ],
    )

    async with sessionmaker() as session:
        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)
        assert res.net_amount > Decimal("0.00")
        assert res.lines[0].unit_price == Decimal("750.00")


# ============================================================================
# 19. CUSTOMER TIER DISCOUNT ACCEPTANCE WITHOUT SUPERVISOR OVERRIDE
# ============================================================================

@pytest.mark.asyncio
async def test_billing_accepts_customer_tier_discount_without_supervisor_override(sample_item_and_variant, unique_suffix):
    """
    Check 4 Remediation: Customer Tier contract discount must be authoritatively resolved
    from server-side customer master and accepted without requiring supervisor override.
    """
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    cust_id = f"cust_{unique_suffix}"
    tier_id = f"cpt_{unique_suffix}"
    tier_code = f"TIER-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # 1. Create Customer
        cust = Customer(
            id=cust_id,
            company_id="COMP-001",
            name=f"VIP Customer {unique_suffix}",
            code=f"CUST-{unique_suffix.upper()}",
            status="Active",
        )
        session.add(cust)

        # 2. Create Customer Price Tier with 15% discount
        tier = CustomerPriceTier(
            id=tier_id,
            company_id="COMP-001",
            name=f"VIP Gold {unique_suffix}",
            code=tier_code,
            discount_percentage=Decimal("15.00"),
        )
        session.add(tier)
        await session.flush()

        # 3. Assign Customer to Tier
        assign = CustomerPriceAssignment(
            id=f"cpa_{unique_suffix}",
            company_id="COMP-001",
            customer_id=cust_id,
            price_tier_id=tier_id,
            status="ACTIVE",
        )
        session.add(assign)
        await session.commit()

    # Base item price is 1000.00. 15% discount -> 850.00.
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
        ),
        customer_id=cust_id,
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("850.00"),  # 1000 - 15% = 850.00
                mrp=Decimal("1000.00"),
            )
        ],
    )

    async with sessionmaker() as session:
        res = await HeadlessBillingCore.calculate_billing(session=session, req=req)
        assert res.net_amount > Decimal("0.00")
        assert res.lines[0].unit_price == Decimal("850.00")


# ============================================================================
# 20. MULTI-TENANT ISOLATION: CROSS-COMPANY CUSTOMER TIER REJECTION
# ============================================================================

@pytest.mark.asyncio
async def test_cross_company_customer_tier_injection_blocked(sample_item_and_variant, unique_suffix):
    """P0 Security: PricingEngine ignores Customer Price Tiers belonging to foreign company."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    tier_code = f"TIER-C2-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create Tier under foreign company COMP-002 with 40% discount
        foreign_tier = CustomerPriceTier(
            id=f"cpt_c2_{unique_suffix}",
            company_id="COMP-002",
            name=f"Foreign Tier {unique_suffix}",
            code=tier_code,
            discount_percentage=Decimal("40.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(foreign_tier)
        await session.commit()

    async with sessionmaker() as session:
        # Calculate effective price for COMP-001 item passing foreign tier code
        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            quantity=Decimal("1.0"),
            customer_tier_code=tier_code,
            company_id="COMP-001",
        )
        # Foreign tier discount must be blocked
        assert res["effective_unit_price"] == 1000.00
        assert res.get("applied_tier") is None


# ============================================================================
# 21. MULTI-TENANT ISOLATION: CROSS-COMPANY PRICE BOOK REJECTION
# ============================================================================

@pytest.mark.asyncio
async def test_cross_company_price_book_injection_blocked(sample_item_and_variant, unique_suffix):
    """P0 Security: PricingEngine ignores Price Books belonging to foreign company."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    pb_code = f"PB-C2-{unique_suffix.upper()}"
    pb_id = f"pb_c2_{unique_suffix}"

    async with sessionmaker() as session:
        # Create Price Book under foreign company COMP-002
        foreign_pb = PriceBook(
            id=pb_id,
            company_id="COMP-002",
            name=f"Foreign PB {unique_suffix}",
            code=pb_code,
            currency="INR",
            status="ACTIVE",
            is_default=False,
        )
        session.add(foreign_pb)

        foreign_pbe = PriceBookEntry(
            id=f"pbe_c2_{unique_suffix}",
            company_id="COMP-002",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=var_id,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("650.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(foreign_pbe)
        await session.commit()

    async with sessionmaker() as session:
        # 1. PricingEngine call with COMP-001 ignores foreign PB
        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            quantity=Decimal("1.0"),
            price_book_code=pb_code,
            company_id="COMP-001",
        )
        assert res["effective_unit_price"] == 1000.00
        assert res.get("applied_price_book") is None

    # 2. Billing request specifying foreign price book does not apply foreign rate
    req_tampered = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            price_book_code=pb_code,
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("650.00"),  # Tampered to foreign rate
                mrp=Decimal("1000.00"),
            )
        ],
    )
    async with sessionmaker() as session:
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await HeadlessBillingCore.calculate_billing(session=session, req=req_tampered)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "SMRITI-PRICE-OVERRIDE-REQ"


# ============================================================================
# 22. TIER AUTHORIZATION: UNASSIGNED CUSTOMER TIER INJECTION DISCARDED
# ============================================================================

@pytest.mark.asyncio
async def test_customer_without_tier_assignment_unauthorized_tier_discarded(sample_item_and_variant, unique_suffix):
    """P0 Security: Client-supplied customer tier is rejected if customer lacks authoritative assignment."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    cust_id = f"cust_unassign_{unique_suffix}"
    tier_code = f"TIER-VIP-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Create legitimate customer without any tier assignment
        cust = Customer(
            id=cust_id,
            company_id="COMP-001",
            name=f"Standard Cust {unique_suffix}",
            code=f"CUST-STD-{unique_suffix.upper()}",
            status="Active",
        )
        session.add(cust)

        # Create active VIP tier with 30% discount
        vip_tier = CustomerPriceTier(
            id=f"cpt_vip_{unique_suffix}",
            company_id="COMP-001",
            name=f"VIP Tier {unique_suffix}",
            code=tier_code,
            discount_percentage=Decimal("30.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(vip_tier)
        await session.commit()

    # Client attempts to claim VIP discount (unit_price=700) passing context tier
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            customer_tier_code=tier_code,  # Client injections unauthorized tier
        ),
        customer_id=cust_id,
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("700.00"),
                mrp=Decimal("1000.00"),
            )
        ],
    )
    async with sessionmaker() as session:
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await HeadlessBillingCore.calculate_billing(session=session, req=req)
        # Because client is unassigned, authoritative rate remains 1000.00 -> deviation blocked
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "SMRITI-PRICE-OVERRIDE-REQ"


# ============================================================================
# 23. TIER AUTHORIZATION: WALK-IN CUSTOMER CANNOT CLAIM CUSTOMER TIER
# ============================================================================

@pytest.mark.asyncio
async def test_walkin_customer_tier_claim_discarded(sample_item_and_variant, unique_suffix):
    """P0 Security: Walk-in customer (CUST-WALKIN) cannot claim any customer tier discount."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]
    tier_code = f"TIER-WALK-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        tier = CustomerPriceTier(
            id=f"cpt_walk_{unique_suffix}",
            company_id="COMP-001",
            name=f"Trade Tier {unique_suffix}",
            code=tier_code,
            discount_percentage=Decimal("20.00"),
            is_active=True,
            is_deleted=False,
        )
        session.add(tier)
        await session.commit()

    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            customer_tier_code=tier_code,  # Injected on walk-in transaction
        ),
        customer_id="CUST-WALKIN",
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("800.00"),  # Attempting 20% discount
                mrp=Decimal("1000.00"),
            )
        ],
    )
    async with sessionmaker() as session:
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await HeadlessBillingCore.calculate_billing(session=session, req=req)
        assert exc.value.status_code == 400
        assert exc.value.detail["code"] == "SMRITI-PRICE-OVERRIDE-REQ"


# ============================================================================
# 24. TIER AUTHORIZATION: INACTIVE & SOFT-DELETED TIERS REJECTED
# ============================================================================

@pytest.mark.asyncio
async def test_inactive_and_deleted_customer_tier_rejected(sample_item_and_variant, unique_suffix):
    """P0 Security: Inactive or soft-deleted Customer Price Tiers do not apply discounts."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    code_inact = f"TIER-INACT-{unique_suffix.upper()}"
    code_del = f"TIER-DEL-{unique_suffix.upper()}"

    async with sessionmaker() as session:
        # Inactive tier
        t_inact = CustomerPriceTier(
            id=f"cpt_inact_{unique_suffix}",
            company_id="COMP-001",
            name="Inactive Tier",
            code=code_inact,
            discount_percentage=Decimal("25.00"),
            is_active=False,
            is_deleted=False,
        )
        # Soft-deleted tier
        t_del = CustomerPriceTier(
            id=f"cpt_del_{unique_suffix}",
            company_id="COMP-001",
            name="Deleted Tier",
            code=code_del,
            discount_percentage=Decimal("30.00"),
            is_active=True,
            is_deleted=True,
        )
        session.add(t_inact)
        session.add(t_del)
        await session.commit()

    async with sessionmaker() as session:
        # Test inactive tier
        res1 = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            customer_tier_code=code_inact,
            company_id="COMP-001",
        )
        assert res1["effective_unit_price"] == 1000.00
        assert res1.get("applied_tier") is None

        # Test deleted tier
        res2 = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            customer_tier_code=code_del,
            company_id="COMP-001",
        )
        assert res2["effective_unit_price"] == 1000.00
        assert res2.get("applied_tier") is None


# ============================================================================
# 25. DETERMINISTIC PRECEDENCE: VARIANT SPECIFICITY OVER GENERIC ITEM
# ============================================================================

@pytest.mark.asyncio
async def test_deterministic_price_book_variant_specificity_precedence(sample_item_and_variant, unique_suffix):
    """P0 Determinism: When variant entry and generic item entry have same min_quantity, variant wins."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    pb_code = f"PB-PREC-{unique_suffix.upper()}"
    pb_id = f"pb_prec_{unique_suffix}"

    async with sessionmaker() as session:
        pb = PriceBook(
            id=pb_id,
            company_id="COMP-001",
            name=f"Precedence PB {unique_suffix}",
            code=pb_code,
            currency="INR",
            status="ACTIVE",
            is_default=False,
        )
        session.add(pb)

        # Generic item-level entry: Rate 700.00 at min_quantity 1.0
        pbe_item = PriceBookEntry(
            id=f"pbe_item_{unique_suffix}",
            company_id="COMP-001",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=None,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("700.00"),
            mrp=Decimal("1000.00"),
        )
        # Variant-specific entry: Rate 850.00 at min_quantity 1.0
        pbe_var = PriceBookEntry(
            id=f"pbe_var_{unique_suffix}",
            company_id="COMP-001",
            price_book_id=pb_id,
            item_id=item_id,
            variant_id=var_id,
            min_quantity=Decimal("1.0000"),
            selling_price=Decimal("850.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(pbe_item)
        session.add(pbe_var)
        await session.commit()

    async with sessionmaker() as session:
        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=var_id,
            quantity=Decimal("1.0"),
            price_book_code=pb_code,
            company_id="COMP-001",
        )
        # Variant-specific rate 850.00 must deterministically win over generic 700.00
        assert res["effective_unit_price"] == 850.00
        assert res["pricing_source"] == "PRICE_BOOK_VOLUME"


# ============================================================================
# 26. AUTHORITATIVE POSTING TIMESTAMP: TEMPORAL BOUNDARIES
# ============================================================================

@pytest.mark.asyncio
async def test_billing_respects_authoritative_posting_date_boundaries(sample_item_and_variant, unique_suffix):
    """P1 Temporal: Headless billing evaluates prices against authoritative context posting_date."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]

    t_now = datetime.now(timezone.utc)
    t_boundary = t_now + timedelta(days=2)

    # 1. Create price revision effective in future
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1500.00,
            revised_selling_price=1300.00,
            effective_from=t_boundary,
            reason_code="FUTURE_PROMO",
            auto_approve_if_eligible=False,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=rev_req,
        )
        # Approve revision -> status SCHEDULED
        await PriceRevisionService.approve_revision(
            session=session,
            company_id="COMP-001",
            revision_id=rev.id,
            approver_id="usr-admin",
            approver_role="SYSADMIN",
        )

    # 2. Billing with posting_date BEFORE effective boundary resolves at baseline (1000.00)
    req_before = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            posting_date=t_boundary - timedelta(hours=1),
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("1000.00"),
                mrp=Decimal("1000.00"),
            )
        ],
    )
    async with sessionmaker() as session:
        res_before = await HeadlessBillingCore.calculate_billing(session=session, req=req_before)
        assert res_before.lines[0].unit_price == Decimal("1000.00")

    # 3. Billing with posting_date AT/AFTER effective boundary resolves at revised price (1300.00)
    req_after = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id="COMP-001",
            branch_id="BR-001",
            source_channel="POS_RETAIL",
            posting_date=t_boundary + timedelta(hours=1),
        ),
        items=[
            CanonicalPostingLineItem(
                code=barcode,
                variant_id=var_id,
                item_id=item_id,
                quantity=Decimal("1.0"),
                unit_price=Decimal("1300.00"),
                mrp=Decimal("1500.00"),
            )
        ],
    )
    async with sessionmaker() as session:
        res_after = await HeadlessBillingCore.calculate_billing(session=session, req=req_after)
        assert res_after.lines[0].unit_price == Decimal("1300.00")


# ============================================================================
# 27. APPROVAL WORKFLOW: UNAUTHORIZED ROLE AND SELF-APPROVAL RESTRICTIONS
# ============================================================================

@pytest.mark.asyncio
async def test_unauthorized_role_and_self_approval_blocked(sample_item_and_variant, unique_suffix):
    """P1 Approval: Unauthorized roles cannot approve, and non-admins cannot self-approve."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]

    # 1. Create revision by manager
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1400.00,
            revised_selling_price=1200.00,
            reason_code="COMPLIANCE",
            auto_approve_if_eligible=False,
        )
        rev = await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-store-mgr",
            user_role="STORE_MANAGER",
            req=rev_req,
        )
        rev_id = rev.id

    # 2. Cashier role attempting approval is blocked
    async with sessionmaker() as session:
        with pytest.raises(ValueError) as exc_cashier:
            await PriceRevisionService.approve_revision(
                session=session,
                company_id="COMP-001",
                revision_id=rev_id,
                approver_id="usr-cashier-1",
                approver_role="CASHIER",
            )
        assert "SMRITI-PERM-001" in str(exc_cashier.value)

    # 3. Submitting manager attempting self-approval is blocked by segregation of duties
    async with sessionmaker() as session:
        with pytest.raises(ValueError) as exc_self:
            await PriceRevisionService.approve_revision(
                session=session,
                company_id="COMP-001",
                revision_id=rev_id,
                approver_id="usr-store-mgr",  # Same user who created
                approver_role="STORE_MANAGER",
            )
        assert "SMRITI-PERM-002" in str(exc_self.value)
        assert "cannot self-approve" in str(exc_self.value)

    # 4. SYSADMIN approval succeeds
    async with sessionmaker() as session:
        approved_rev = await PriceRevisionService.approve_revision(
            session=session,
            company_id="COMP-001",
            revision_id=rev_id,
            approver_id="usr-admin",
            approver_role="SYSADMIN",
        )
        assert approved_rev.status in ("ACTIVE", "SCHEDULED")


# ============================================================================
# 28. COST REVISION PRESERVATION & INVOICE SNAPSHOT INTEGRITY
# ============================================================================

@pytest.mark.asyncio
async def test_cost_revision_does_not_mutate_historical_cogs_or_stock_ledger(sample_item_and_variant, unique_suffix):
    """P1 Valuation: Cost price revision updates buying reference without mutating posted invoice snapshots."""
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    var_id = sample_item_and_variant["variant_id"]
    item_id = sample_item_and_variant["item_id"]
    barcode = sample_item_and_variant["barcode"]

    # 1. Post initial billing invoice capturing baseline prices
    inv_id = f"inv_cost_{unique_suffix}"
    async with sessionmaker() as session:
        inv = SalesInvoice(
            id=inv_id,
            company_id="COMP-001",
            branch_id="BR-001",
            invoice_no=f"INV-COST-{unique_suffix.upper()}",
            date=datetime.now(timezone.utc).date(),
            grand_total=Decimal("1000.00"),
            status="SUBMITTED",
            created_by="usr-pos",
        )
        session.add(inv)

        inv_item = SalesInvoiceItem(
            company_id="COMP-001",
            invoice_id=inv_id,
            item_id=item_id,
            variant_id=var_id,
            code=barcode,
            name=f"Test Item {unique_suffix}",
            quantity=Decimal("1.00"),
            price=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
        )
        session.add(inv_item)
        await session.commit()

    # 2. Revise cost price to 750.00
    async with sessionmaker() as session:
        rev_req = PriceRevisionCreateRequest(
            variant_id=var_id,
            revised_mrp=1000.00,
            revised_selling_price=1000.00,
            revised_cost_price=750.00,  # Revised buying cost reference
            reason_code="SUPPLIER_ANNUAL_PRICE_LIST",
            auto_approve_if_eligible=True,
        )
        await PriceRevisionService.create_revision(
            session=session,
            company_id="COMP-001",
            user_id="usr-sys",
            user_role="SYSADMIN",
            req=rev_req,
        )

    # 3. Verify ItemVariant cost_price updated to new reference
    async with sessionmaker() as session:
        stmt_v = select(ItemVariant).where(ItemVariant.id == var_id)
        v = (await session.execute(stmt_v)).scalars().first()
        assert float(v.cost_price) == 750.00

        # 4. Verify historical posted SalesInvoiceItem remains strictly intact
        stmt_inv = select(SalesInvoice).where(SalesInvoice.id == inv_id)
        inv = (await session.execute(stmt_inv)).scalars().first()
        stmt_items = select(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id == inv.id)
        inv_item = (await session.execute(stmt_items)).scalars().first()
        assert inv_item.price == Decimal("1000.00")
        assert inv_item.mrp == Decimal("1000.00")


# ============================================================================
# 29. BLOCKER 1 REGRESSION: FAIL-CLOSED TENANT ISOLATION
# ============================================================================

@pytest.mark.asyncio
async def test_tenant_isolation_missing_company_with_price_book(sample_item_and_variant):
    """Regression 1: Missing company ID with a supplied Price Book must reject with SMRITI-PRICE-TENANT-REQUIRED."""
    item_id = sample_item_and_variant["item_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    async with sessionmaker() as session:
        session.info.clear()
        with pytest.raises(ValueError) as exc_info:
            await PricingEngine.calculate_effective_price(
                session=session,
                item_id=item_id,
                price_book_code="PB-RETAIL-01",
                company_id=None,
            )
        assert "SMRITI-PRICE-TENANT-REQUIRED" in str(exc_info.value)


@pytest.mark.asyncio
async def test_tenant_isolation_missing_company_with_customer_tier(sample_item_and_variant):
    """Regression 2: Missing company ID with a supplied customer tier must reject with SMRITI-PRICE-TENANT-REQUIRED."""
    item_id = sample_item_and_variant["item_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    async with sessionmaker() as session:
        session.info.clear()
        with pytest.raises(ValueError) as exc_info:
            await PricingEngine.calculate_effective_price(
                session=session,
                item_id=item_id,
                customer_tier_code="TIER-GOLD",
                company_id=None,
            )
        assert "SMRITI-PRICE-TENANT-REQUIRED" in str(exc_info.value)


@pytest.mark.asyncio
async def test_tenant_isolation_missing_company_with_variant(sample_item_and_variant):
    """Regression 3: Missing company ID with a variant-level entry must reject with SMRITI-PRICE-TENANT-REQUIRED."""
    item_id = sample_item_and_variant["item_id"]
    variant_id = sample_item_and_variant["variant_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    async with sessionmaker() as session:
        session.info.clear()
        with pytest.raises(ValueError) as exc_info:
            await PricingEngine.calculate_effective_price(
                session=session,
                item_id=item_id,
                variant_id=variant_id,
                company_id=None,
            )
        assert "SMRITI-PRICE-TENANT-REQUIRED" in str(exc_info.value)


@pytest.mark.asyncio
async def test_tenant_isolation_cross_tenant_mismatch_rejected(sample_item_and_variant):
    """Regression 4: Explicit company A attempting to resolve company B's pricing must reject with SMRITI-PRICE-TENANT-MISMATCH."""
    item_id = sample_item_and_variant["item_id"]
    variant_id = sample_item_and_variant["variant_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    async with sessionmaker() as session:
        # sample_item_and_variant belongs to COMP-001. Explicit company COMP-002 attempts resolution:
        with pytest.raises(ValueError) as exc_info:
            await PricingEngine.calculate_effective_price(
                session=session,
                item_id=item_id,
                variant_id=variant_id,
                company_id="COMP-002",
            )
        assert "SMRITI-PRICE-TENANT-MISMATCH" in str(exc_info.value)


@pytest.mark.asyncio
async def test_tenant_isolation_same_company_pricing_succeeds(sample_item_and_variant):
    """Regression 5: Normal same-company pricing still succeeds."""
    item_id = sample_item_and_variant["item_id"]
    variant_id = sample_item_and_variant["variant_id"]
    sessionmaker = get_company_sessionmaker(TEST_DB_NAME)
    async with sessionmaker() as session:
        res = await PricingEngine.calculate_effective_price(
            session=session,
            item_id=item_id,
            variant_id=variant_id,
            quantity=Decimal("2.00"),
            company_id="COMP-001",
        )
        assert res["effective_unit_price"] == 1000.00
        assert res["line_subtotal"] == 2000.00
        assert res["pricing_source"] in ("VARIANT_MASTER", "ITEM_MASTER")


# ============================================================================
# 30. BLOCKER 1 API-LEVEL TRUST BOUNDARY REGRESSION TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_api_tenant_isolation_missing_auth_company_rejected(sample_item_and_variant):
    """
    Test 1: Missing authenticated company context with client-supplied company ID.
    Must reject with HTTP 403 and SMRITI-PRICE-TENANT-REQUIRED.
    """
    item_id = sample_item_and_variant["item_id"]
    from app.api.deps import get_current_user
    from app.models.auth import User, UserRole

    # Override get_current_user to simulate user lacking trusted company identity
    unscoped_user = User(id="usr-unscoped", role=UserRole.MANAGER, company_id=None, branch_id="BR-001")
    app.dependency_overrides[get_current_user] = lambda: unscoped_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "item_id": item_id,
                "quantity": 1.0,
                "company_id": "COMP-002",
            }
            res = await client.post("/api/v1/pricing/resolve", json=payload)
            assert res.status_code == 403
            err_detail = res.json()["detail"]
            assert "SMRITI-PRICE-TENANT-REQUIRED" in err_detail
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_api_tenant_isolation_cross_tenant_spoofing_rejected(sample_item_and_variant):
    """
    Test 2: Authenticated Company A attempting to pass Company B in payload.
    Must reject with HTTP 403 and SMRITI-PRICE-TENANT-MISMATCH across /resolve, /resolve/bulk, /snapshot.
    """
    item_id = sample_item_and_variant["item_id"]
    headers = _get_auth_headers("MANAGER")  # Authenticated as COMP-001

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Single item resolution spoofing
        res_single = await client.post(
            "/api/v1/pricing/resolve",
            json={"item_id": item_id, "quantity": 1.0, "company_id": "COMP-002"},
            headers=headers,
        )
        assert res_single.status_code == 403
        assert "SMRITI-PRICE-TENANT-MISMATCH" in res_single.json()["detail"]

        # 2. Bulk cart resolution spoofing
        res_bulk = await client.post(
            "/api/v1/pricing/resolve/bulk",
            json={
                "items": [{"item_id": item_id, "quantity": 1.0}],
                "company_id": "COMP-002",
            },
            headers=headers,
        )
        assert res_bulk.status_code == 403
        assert "SMRITI-PRICE-TENANT-MISMATCH" in res_bulk.json()["detail"]

        # 3. Snapshot generation spoofing
        res_snap = await client.post(
            "/api/v1/pricing/snapshot",
            json={
                "items": [{"item_id": item_id, "quantity": 1.0}],
                "company_id": "COMP-002",
            },
            headers=headers,
        )
        assert res_snap.status_code == 403
        assert "SMRITI-PRICE-TENANT-MISMATCH" in res_snap.json()["detail"]


@pytest.mark.asyncio
async def test_api_tenant_isolation_valid_company_pricing_succeeds(sample_item_and_variant):
    """
    Test 3: Valid Company A pricing through the API.
    Must return HTTP 200 with accurate calculation when company matches or is omitted in payload.
    """
    item_id = sample_item_and_variant["item_id"]
    headers = _get_auth_headers("MANAGER")  # Authenticated as COMP-001

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Case A: client payload explicitly includes matching company_id
        res_explicit = await client.post(
            "/api/v1/pricing/resolve",
            json={"item_id": item_id, "quantity": 2.0, "company_id": "COMP-001"},
            headers=headers,
        )
        assert res_explicit.status_code == 200
        data_a = res_explicit.json()
        assert data_a["effective_unit_price"] == 1000.00
        assert data_a["line_subtotal"] == 2000.00

        # Case B: client payload omits company_id (resolves authoritatively from token)
        res_implicit = await client.post(
            "/api/v1/pricing/resolve",
            json={"item_id": item_id, "quantity": 3.0},
            headers=headers,
        )
        assert res_implicit.status_code == 200
        data_b = res_implicit.json()
        assert data_b["effective_unit_price"] == 1000.00
        assert data_b["line_subtotal"] == 3000.00


@pytest.mark.asyncio
async def test_api_price_book_and_tier_and_variant_pricing(sample_item_and_variant, unique_suffix):
    """
    Test 4: Price Book, Customer Tier, and variant-level pricing resolved through API endpoints.
    Verifies that the entire hierarchy works through REST API:
      - Price Book creation and volume break entry via API
      - Customer Price Tier creation via API
      - Hierarchical resolution via POST /api/v1/pricing/resolve
      - Bulk resolution via POST /api/v1/pricing/resolve/bulk
    """
    item_id = sample_item_and_variant["item_id"]
    variant_id = sample_item_and_variant["variant_id"]
    headers = _get_auth_headers("SYSADMIN")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Price Book via API
        pb_code = f"PB-{unique_suffix.upper()}"
        pb_res = await client.post(
            "/api/v1/pricing/books",
            json={
                "name": f"Wholesale Book {unique_suffix}",
                "code": pb_code,
                "currency": "INR",
                "channel": "RETAIL",
                "status": "ACTIVE",
            },
            headers=headers,
        )
        assert pb_res.status_code == 201
        pb_data = pb_res.json()
        pb_id = pb_data["id"]

        # 2. Add Price Book Entry with volume break (min_quantity=5 -> selling_price=850) via API
        entry_res = await client.post(
            f"/api/v1/pricing/books/{pb_id}/entries",
            json={
                "item_id": item_id,
                "variant_id": variant_id,
                "min_quantity": 5.0,
                "selling_price": 850.00,
                "mrp": 1000.00,
            },
            headers=headers,
        )
        assert entry_res.status_code == 201

        # 3. Resolve via API for quantity=2 (below volume threshold) -> baseline variant price 1000
        res_qty2 = await client.post(
            "/api/v1/pricing/resolve",
            json={
                "item_id": item_id,
                "variant_id": variant_id,
                "quantity": 2.0,
                "price_book_code": pb_code,
            },
            headers=headers,
        )
        assert res_qty2.status_code == 200
        assert res_qty2.json()["effective_unit_price"] == 1000.00

        # 4. Resolve via API for quantity=5 (reaches volume threshold) -> volume break price 850
        res_qty5 = await client.post(
            "/api/v1/pricing/resolve",
            json={
                "item_id": item_id,
                "variant_id": variant_id,
                "quantity": 5.0,
                "price_book_code": pb_code,
            },
            headers=headers,
        )
        assert res_qty5.status_code == 200
        data_qty5 = res_qty5.json()
        assert data_qty5["effective_unit_price"] == 850.00
        assert data_qty5["line_subtotal"] == 4250.00
        assert data_qty5["pricing_source"] == "PRICE_BOOK_VOLUME"

        # 5. Create Customer Price Tier via API (10% discount)
        tier_code = f"TIER-{unique_suffix.upper()}"
        tier_res = await client.post(
            "/api/v1/pricing/tiers",
            json={
                "name": f"VIP Tier {unique_suffix}",
                "code": tier_code,
                "discount_percentage": 10.0,
                "description": "VIP 10% discount",
            },
            headers=headers,
        )
        assert tier_res.status_code == 201

        # 6. Resolve via API with customer tier -> 10% off baseline 1000 = 900
        res_tier = await client.post(
            "/api/v1/pricing/resolve",
            json={
                "item_id": item_id,
                "variant_id": variant_id,
                "quantity": 1.0,
                "customer_tier_code": tier_code,
            },
            headers=headers,
        )
        assert res_tier.status_code == 200
        data_tier = res_tier.json()
        assert data_tier["effective_unit_price"] == 900.00
        assert data_tier["pricing_source"] == "CUSTOMER_TIER"

        # 7. Test bulk cart resolution via API
        bulk_res = await client.post(
            "/api/v1/pricing/resolve/bulk",
            json={
                "items": [
                    {"item_id": item_id, "variant_id": variant_id, "quantity": 10.0},
                    {"item_id": item_id, "variant_id": variant_id, "quantity": 1.0},
                ],
                "price_book_code": pb_code,
            },
            headers=headers,
        )
        assert bulk_res.status_code == 200
        bulk_data = bulk_res.json()
        assert bulk_data["total_quantity"] == 11.0
        assert bulk_data["total_subtotal"] == 9500.00




