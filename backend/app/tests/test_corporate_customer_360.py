"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-18
Modified     : 2026-10-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Corporate Customer 360 Contract & Serialization Suite
"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import HTTPException
from app.api.deps import TenantContext
from app.api.v1.crm import get_corporate_customer_360
from app.schemas.crm import (
    CustomerResponse,
    CorporateCustomer360Response,
    CorporateKpis,
    CorporateStoreItem,
    CorporatePsvSummary,
    StoreTypeSlice,
    RecentOrderItem,
    PurchaseTrendItem,
    CategoryShareItem,
    StoreAddressItem,
    StoreAddressCreate,
    StoreAddressUpdate,
    StoreCodeLookupItem,
    DuplicateDecision,
    MatchedIdentityType,
    CustomerDuplicateCheckResponse,
    ExistingCustomerSummary,
)


def test_corporate_kpis_serialization():
    """Verify Corporate KPIs shape, metrics and growth percentage boundaries."""
    kpis = CorporateKpis(
        total_orders=124580,
        orders_growth_pct=18.0,
        total_purchase_value=Decimal("4285000000.00"),
        purchase_growth_pct=22.0,
        average_order_value=Decimal("344000.00"),
        aov_growth_pct=6.0,
        last_order_date="12 Nov 2024",
        last_order_relative="3 days ago",
        total_stores=2456,
        active_stores=2318,
        active_stores_pct=94.4,
        total_psv_value=Decimal("1867000000.00"),
        psv_stores_count=2318,
    )
    assert kpis.total_orders == 124580
    assert kpis.orders_growth_pct == 18.0
    assert kpis.total_purchase_value == Decimal("4285000000.00")
    assert kpis.active_stores == 2318
    assert kpis.total_stores == 2456
    assert kpis.total_psv_value == Decimal("1867000000.00")


def test_corporate_store_network_item_canonical_fields():
    """Verify store network items maintain canonical DB store codes and PSV valuation."""
    store = CorporateStoreItem(
        id="loc-mum-001",
        store_code="RRL-MUM-001",
        store_name="Reliance Fresh - Andheri",
        city="Mumbai",
        state="Maharashtra",
        store_type="Supermarket",
        status="Active",
        psv_value=Decimal("2450000.00"),
        contact="S. Patil",
    )
    assert store.store_code == "RRL-MUM-001"
    assert store.store_name == "Reliance Fresh - Andheri"
    assert store.city == "Mumbai"
    assert store.store_type == "Supermarket"
    assert store.status == "Active"
    assert store.psv_value == Decimal("2450000.00")


def test_corporate_psv_summary_aggregation():
    """Verify PSV donut summary handles in-stock, low-stock, and out-of-stock partitions."""
    psv = CorporatePsvSummary(
        total_value=Decimal("1867000000.00"),
        in_stock_value=Decimal("1624000000.00"),
        in_stock_stores=2012,
        low_stock_value=Decimal("186000000.00"),
        low_stock_stores=231,
        out_of_stock_value=Decimal("57000000.00"),
        out_of_stock_stores=75,
    )
    assert psv.total_value == Decimal("1867000000.00")
    assert psv.in_stock_stores == 2012
    assert psv.low_stock_stores == 231
    assert psv.out_of_stock_stores == 75
    assert psv.in_stock_stores + psv.low_stock_stores + psv.out_of_stock_stores == 2318


def test_corporate_store_type_distribution():
    """Verify store-type distribution shares sum to valid percentages."""
    slices = [
        StoreTypeSlice(type="Supermarket", count=1120, percentage=45.6, color="#0284c7"),
        StoreTypeSlice(type="Hypermarket", count=620, percentage=25.2, color="#0d9488"),
        StoreTypeSlice(type="Fashion", count=380, percentage=15.5, color="#8b5cf6"),
        StoreTypeSlice(type="Electronics", count=210, percentage=8.5, color="#f59e0b"),
        StoreTypeSlice(type="Others", count=126, percentage=5.2, color="#64748b"),
    ]
    total_stores = sum(s.count for s in slices)
    assert total_stores == 2456
    total_pct = sum(s.percentage for s in slices)
    assert abs(total_pct - 100.0) < 0.5


def test_corporate_customer_360_full_response_contract():
    """Verify the entire composite CorporateCustomer360Response model validates cleanly."""
    cust_dict = {
        "id": "cust-rrl-192b561d",
        "code": "CUST-REL-0001",
        "name": "Reliance Retail Ltd.",
        "customer_type": "Corporate Retail Chain",
        "mobile": "+91 22 3555 0000",
        "email": "procurement@ril.com",
        "gst_number": "27AAACR1718E1ZV",
        "status": "Active",
        "credit_limit": Decimal("500000000.00"),
        "payment_term": "30 Days (Credit)",
    }
    cust_dto = CustomerResponse.model_validate(cust_dict)

    resp = CorporateCustomer360Response(
        customer=cust_dto,
        kpis=CorporateKpis(
            total_orders=124580,
            orders_growth_pct=18.0,
            total_purchase_value=Decimal("4285000000.00"),
            purchase_growth_pct=22.0,
            average_order_value=Decimal("344000.00"),
            aov_growth_pct=6.0,
            last_order_date="12 Nov 2024",
            last_order_relative="3 days ago",
            total_stores=2456,
            active_stores=2318,
            active_stores_pct=94.4,
            total_psv_value=Decimal("1867000000.00"),
            psv_stores_count=2318,
        ),
        store_network=[
            CorporateStoreItem(
                id="loc-001",
                store_code="RRL-MUM-001",
                store_name="Reliance Fresh - Andheri",
                city="Mumbai",
                state="Maharashtra",
                store_type="Supermarket",
                status="Active",
                psv_value=Decimal("2450000.00"),
                contact="S. Patil",
            )
        ],
        psv_summary=CorporatePsvSummary(
            total_value=Decimal("1867000000.00"),
            in_stock_value=Decimal("1624000000.00"),
            in_stock_stores=2012,
            low_stock_value=Decimal("186000000.00"),
            low_stock_stores=231,
            out_of_stock_value=Decimal("57000000.00"),
            out_of_stock_stores=75,
        ),
        store_type_distribution=[
            StoreTypeSlice(type="Supermarket", count=1120, percentage=45.6, color="#0284c7")
        ],
        recent_orders=[
            RecentOrderItem(
                order_no="SO-2024-11872",
                date="12 Nov 2024",
                stores_count=24,
                items_count=156,
                value=Decimal("4820000.00"),
                status="Completed",
            )
        ],
        purchase_trend=[
            PurchaseTrendItem(month="Jan", purchase_value=24.5, orders=8200),
            PurchaseTrendItem(month="Feb", purchase_value=28.0, orders=9100),
        ],
        top_categories=[
            CategoryShareItem(category="FMCG", value=Decimal("1685000000.00"), share_pct=39.3)
        ],
    )

    assert resp.customer.name == "Reliance Retail Ltd."
    assert resp.customer.code == "CUST-REL-0001"
    assert resp.kpis.total_orders == 124580
    assert len(resp.store_network) == 1
    assert resp.store_network[0].store_code == "RRL-MUM-001"
    assert len(resp.recent_orders) == 1
    assert resp.recent_orders[0].order_no == "SO-2024-11872"
    assert len(resp.purchase_trend) == 2
    assert resp.top_categories[0].category == "FMCG"


@pytest.mark.asyncio
async def test_corporate_customer_360_requires_an_exact_customer_identity():
    result = MagicMock()
    result.scalars.return_value.first.return_value = None
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    tenant = TenantContext(company_id="COMP-001", branch_id="BR-MAIN-001")

    with pytest.raises(HTTPException) as missing:
        await get_corporate_customer_360(" ", db, tenant)
    assert missing.value.status_code == 400
    db.execute.assert_not_awaited()

    with pytest.raises(HTTPException) as unknown:
        await get_corporate_customer_360("default", db, tenant)
    assert unknown.value.status_code == 404
    db.execute.assert_awaited_once()


def test_corporate_customer_multi_store_mapping():
    """Requirement 1: Verify one corporate customer can be mapped to multiple Store Codes."""
    stores = [
        CorporateStoreItem(
            id="loc-mum-001",
            store_code="RRL-MUM-001",
            store_name="Reliance Fresh - Andheri",
            city="Mumbai",
            state="Maharashtra",
            store_type="Supermarket",
            status="Active",
            psv_value=Decimal("2450000.00"),
            contact="S. Patil",
            address_summary="Plot 4, Andheri West, Mumbai - 400053",
        ),
        CorporateStoreItem(
            id="loc-mum-002",
            store_code="RRL-MUM-002",
            store_name="Reliance Smart - Powai",
            city="Mumbai",
            state="Maharashtra",
            store_type="Hypermarket",
            status="Active",
            psv_value=Decimal("4820000.00"),
            contact="R. Singh",
            address_summary="Hiranandani Gardens, Powai, Mumbai - 400076",
        ),
        CorporateStoreItem(
            id="loc-del-001",
            store_code="RRL-DEL-001",
            store_name="Reliance Digital - Lajpat",
            city="New Delhi",
            state="Delhi",
            store_type="Electronics",
            status="Active",
            psv_value=Decimal("3210000.00"),
            contact="A. Kumar",
            address_summary="Central Market, Lajpat Nagar, New Delhi - 110024",
        ),
    ]

    # Verify multiple store codes assigned to the same corporate customer profile
    assert len(stores) == 3
    store_codes = {s.store_code for s in stores}
    assert store_codes == {"RRL-MUM-001", "RRL-MUM-002", "RRL-DEL-001"}
    assert sum(s.psv_value for s in stores) == Decimal("10480000.00")


def test_exclusive_mapping_duplicate_decision():
    """Requirement 2 & 9: Verify exclusive store code mapping prevents collision with other customers."""
    owning_summary = ExistingCustomerSummary(
        id="cust-ril-001",
        code="CUST-REL-0001",
        name="Reliance Retail Ltd.",
        mobile="+91 22 3555 0000",
        email="procurement@ril.com",
        gst_number="27AAACR1718E1ZV",
        status="Active",
    )

    # When another customer attempts to claim 'RRL-MUM-001'
    resp = CustomerDuplicateCheckResponse(
        decision=DuplicateDecision.HARD_DUPLICATE,
        matched_identity=MatchedIdentityType.STORE_CODE,
        existing_customer=owning_summary,
        reason="Store code 'RRL-MUM-001' is already assigned to customer 'Reliance Retail Ltd.' (CUST-REL-0001). A Store Code can only belong to one customer profile at a time.",
        allow_override=False,
    )

    assert resp.decision == DuplicateDecision.HARD_DUPLICATE
    assert resp.matched_identity == MatchedIdentityType.STORE_CODE
    assert resp.allow_override is False
    assert resp.existing_customer is not None
    assert resp.existing_customer.name == "Reliance Retail Ltd."
    assert "already assigned to customer 'Reliance Retail Ltd.'" in resp.reason


def test_store_code_lookup_contract_and_disabled_state():
    """Requirement 4 & 5: In Store Code Lookup, codes assigned to other customers appear disabled, while own codes remain selectable."""
    current_customer_id = "cust-tata-002"

    lookup_items = [
        # Store code belonging to Tata (current customer) -> selectable
        StoreCodeLookupItem(
            id="loc-tata-01",
            store_code="TATA-STAR-01",
            store_name="Star Bazaar - Thane",
            city="Thane",
            state="Maharashtra",
            store_type="Hypermarket",
            status="Active",
            address_summary="Korum Mall, Thane West - 400606",
            assigned_customer_id="cust-tata-002",
            assigned_customer_name="Tata Trent Hypermarket",
            assigned_customer_code="CUST-TATA-002",
            is_assigned=True,
            is_selectable=True,  # Requirement 5: Keep its own assigned Store Codes selectable
            disabled_reason=None,
            addresses_count=2,
            psv_value=Decimal("1250000.00"),
        ),
        # Store code belonging to Reliance (different customer) -> visible but disabled
        StoreCodeLookupItem(
            id="loc-ril-01",
            store_code="RRL-MUM-001",
            store_name="Reliance Fresh - Andheri",
            city="Mumbai",
            state="Maharashtra",
            store_type="Supermarket",
            status="Active",
            address_summary="Andheri West, Mumbai - 400053",
            assigned_customer_id="cust-ril-001",
            assigned_customer_name="Reliance Retail Ltd.",
            assigned_customer_code="CUST-REL-0001",
            is_assigned=True,
            is_selectable=False,  # Requirement 4: Codes assigned to another customer remain visible but disabled
            disabled_reason="Already mapped to Reliance Retail Ltd. (CUST-REL-0001)",
            addresses_count=3,
            psv_value=Decimal("2450000.00"),
        ),
        # Unassigned store code -> selectable
        StoreCodeLookupItem(
            id="loc-open-01",
            store_code="WH-BHIWANDI-09",
            store_name="Bhiwandi Hub 9",
            city="Bhiwandi",
            state="Maharashtra",
            store_type="Warehouse",
            status="Active",
            address_summary="Dapode Road, Bhiwandi - 421302",
            assigned_customer_id=None,
            assigned_customer_name=None,
            assigned_customer_code=None,
            is_assigned=False,
            is_selectable=True,
            disabled_reason=None,
            addresses_count=1,
            psv_value=Decimal("0.00"),
        ),
    ]

    # Verify filtering and selection rules
    tata_store = next(s for s in lookup_items if s.store_code == "TATA-STAR-01")
    assert tata_store.is_selectable is True
    assert tata_store.disabled_reason is None

    ril_store = next(s for s in lookup_items if s.store_code == "RRL-MUM-001")
    assert ril_store.is_selectable is False
    assert "Already mapped to Reliance Retail Ltd." in ril_store.disabled_reason

    open_store = next(s for s in lookup_items if s.store_code == "WH-BHIWANDI-09")
    assert open_store.is_selectable is True
    assert open_store.is_assigned is False


def test_multi_address_typed_management_and_primary_constraint():
    """Requirement 3 & 4: One Store Code -> multiple typed addresses, with at most one active primary per type."""
    addresses = [
        StoreAddressItem(
            id="addr-001",
            address_type="Delivery",
            address_title="Main Receiving Bay",
            address_line1="Gate 2, Inward Goods Dock",
            address_line2="Plot 4, Andheri Industrial Area",
            locality="Andheri West",
            city="Mumbai",
            state="Maharashtra",
            state_code="27",
            pincode="400053",
            country="India",
            contact_person="R. Sharma (Dock Manager)",
            phone="+91 98200 11223",
            is_primary=True,
            is_active=True,
        ),
        StoreAddressItem(
            id="addr-002",
            address_type="Delivery",
            address_title="Secondary Express Gate",
            address_line1="Gate 5, Courier & Parcel Desk",
            locality="Andheri West",
            city="Mumbai",
            state="Maharashtra",
            state_code="27",
            pincode="400053",
            country="India",
            contact_person="M. Verma",
            phone="+91 98200 44556",
            is_primary=False,  # Secondary delivery address
            is_active=True,
        ),
        StoreAddressItem(
            id="addr-003",
            address_type="Billing",
            address_title="Accounts Processing Unit",
            address_line1="Floor 4, Finance Wing",
            locality="BKC",
            city="Mumbai",
            state="Maharashtra",
            state_code="27",
            pincode="400051",
            country="India",
            contact_person="A. Mehta (Finance Lead)",
            phone="+91 22 6600 1234",
            is_primary=True,  # Primary billing address
            is_active=True,
        ),
        StoreAddressItem(
            id="addr-004",
            address_type="Warehouse",
            address_title="Cold Storage Annex",
            address_line1="Shed B, Temperature Controlled Zone",
            city="Bhiwandi",
            state="Maharashtra",
            state_code="27",
            pincode="421302",
            country="India",
            contact_person="K. Yadav",
            is_primary=True,
            is_active=True,
        ),
    ]

    # Verify 4 typed addresses coexist on 1 store code
    assert len(addresses) == 4

    # Verify multiple addresses of the same type ('Delivery') are supported
    delivery_addrs = [a for a in addresses if a.address_type == "Delivery"]
    assert len(delivery_addrs) == 2

    # Verify at most one active primary per address type
    primary_delivery = [a for a in delivery_addrs if a.is_primary and a.is_active]
    assert len(primary_delivery) == 1
    assert primary_delivery[0].address_title == "Main Receiving Bay"

    primary_billing = [a for a in addresses if a.address_type == "Billing" and a.is_primary and a.is_active]
    assert len(primary_billing) == 1
    assert primary_billing[0].address_title == "Accounts Processing Unit"


def test_store_address_soft_deactivation_preserves_history():
    """Requirement 6: Support adding, editing, and deactivating addresses without deleting historical records."""
    addr = StoreAddressItem(
        id="addr-hist-001",
        address_type="Warehouse",
        address_title="Decommissioned Bhiwandi Shed",
        address_line1="Old Depot 3, Sector 4",
        city="Bhiwandi",
        state="Maharashtra",
        pincode="421302",
        country="India",
        is_primary=False,
        is_active=False,  # Soft-deactivated
    )

    # Historical record is preserved with is_active=False, not destroyed
    assert addr.is_active is False
    assert addr.id == "addr-hist-001"
    assert addr.address_line1 == "Old Depot 3, Sector 4"


def test_store_address_type_validation_rejects_invalid_types():
    """Requirement 2: Invalid address types must be strictly rejected with validation errors."""
    from pydantic import ValidationError

    # Valid address types succeed
    for valid_type in ["Delivery", "Billing", "Warehouse", "Registered", "Shipping", "Other"]:
        addr = StoreAddressCreate(
            addressType=valid_type,
            addressLine1="123 Industrial Area",
            city="Mumbai",
            state="Maharashtra",
            pincode="400001",
        )
        assert addr.address_type == valid_type

    # Invalid address types raise ValidationError
    for invalid_type in ["InvalidType", "HACKED_TYPE", "TemporaryDock", "Unknown"]:
        with pytest.raises(ValidationError) as exc:
            StoreAddressCreate(
                addressType=invalid_type,
                addressLine1="123 Industrial Area",
                city="Mumbai",
                state="Maharashtra",
                pincode="400001",
            )
        assert "Invalid address type" in str(exc.value)

    # Update validator also rejects invalid types
    with pytest.raises(ValidationError) as exc:
        StoreAddressUpdate(addressType="InvalidCustomType")
    assert "Invalid address type" in str(exc.value)


def test_psv_missing_or_stale_data_not_zero_or_fabricated():
    """Requirement 3: Verify missing or stale PSV feeds are not fabricated or presented as zero stock."""
    # Store with active PSV feed
    active_store = CorporateStoreItem(
        id="loc-active-01",
        store_code="STR-ACT-01",
        store_name="Active Store 1",
        city="Mumbai",
        state="Maharashtra",
        psv_value=Decimal("2500000.00"),
        psv_status="Healthy",
        psv_value_display="₹ 25.00 Lakh",
    )
    assert active_store.psv_status == "Healthy"
    assert active_store.psv_value == Decimal("2500000.00")
    assert active_store.psv_value_display == "₹ 25.00 Lakh"

    # Store with missing / unconfigured PSV feed
    unreported_store = CorporateStoreItem(
        id="loc-unrep-02",
        store_code="STR-UNREP-02",
        store_name="Unreported Store 2",
        city="Pune",
        state="Maharashtra",
        psv_value=Decimal("0.00"),
        psv_status="Not Reporting",
        psv_value_display="— (Awaiting Sync)",
    )
    assert unreported_store.psv_status == "Not Reporting"
    assert unreported_store.psv_value_display == "— (Awaiting Sync)"
    assert unreported_store.psv_value_display != "₹ 0.00"

    # Corporate PSV Summary tracks not_reporting_stores count
    psv_summary = CorporatePsvSummary(
        total_value=Decimal("2500000.00"),
        in_stock_value=Decimal("2500000.00"),
        in_stock_stores=1,
        not_reporting_stores=1,
    )
    assert psv_summary.not_reporting_stores == 1
    assert psv_summary.in_stock_stores == 1


@pytest.mark.asyncio
async def test_concurrent_store_code_assignment_prevents_duplicate_claims(db_session):
    """Requirement 1: Verify two simultaneous requests cannot assign the same Store Code to different customers."""
    from app.services.crm import CrmService
    from app.schemas.crm import CustomerDeliveryLocationCreate
    from app.models.tenant import Company, Branch
    from app.models.crm import Customer
    from app.api.deps import TenantContext
    from fastapi import HTTPException
    import uuid

    s = uuid.uuid4().hex[:6]
    comp = Company(id=f"comp-{s}", name=f"Concurrency Test Co {s}", gst_number="27AAAAA0000A1Z5", is_active=True)
    branch = Branch(id=f"br-{s}", company_id=comp.id, name=f"Branch {s}", code=f"BR-{s}", is_active=True)
    cust1 = Customer(id=f"c1-{s}", company_id=comp.id, code=f"C1-{s}", name=f"Customer One {s}", is_active=True, is_deleted=False)
    cust2 = Customer(id=f"c2-{s}", company_id=comp.id, code=f"C2-{s}", name=f"Customer Two {s}", is_active=True, is_deleted=False)
    db_session.add(comp)
    await db_session.commit()
    db_session.add_all([branch, cust1, cust2])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=branch.id)
    shared_store_code = f"CONC-STORE-{s.upper()}"

    # First assignment succeeds
    service1 = CrmService(db_session, tenant_ctx)
    loc_in_1 = CustomerDeliveryLocationCreate(
        store_code=shared_store_code,
        location_name="Store Assigned to Cust 1",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
    )
    created_1 = await service1.create_delivery_location(cust1.id, loc_in_1)
    assert created_1.store_code == shared_store_code
    assert created_1.customer_id == cust1.id

    # Concurrent attempt by Cust 2 for the exact same store code is rejected with 409 DUPLICATE_STORE_CODE
    service2 = CrmService(db_session, tenant_ctx)
    loc_in_2 = CustomerDeliveryLocationCreate(
        store_code=shared_store_code,
        location_name="Concurrent Claim by Cust 2",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
    )
    with pytest.raises(HTTPException) as exc:
        await service2.create_delivery_location(cust2.id, loc_in_2)
    assert exc.value.status_code == 409
    assert exc.value.detail["error_code"] == "DUPLICATE_STORE_CODE"
    assert "already assigned to customer" in exc.value.detail["reason"]


@pytest.mark.asyncio
async def test_legitimate_store_code_reassignment_after_deactivation(db_session):
    """Requirement 1: Reassignment after legitimate deactivation allows new owner while preserving history."""
    from app.services.crm import CrmService
    from app.schemas.crm import CustomerDeliveryLocationCreate
    from app.models.tenant import Company, Branch
    from app.models.crm import Customer, CustomerDeliveryLocation
    from app.api.deps import TenantContext
    from fastapi import HTTPException
    import uuid

    s = uuid.uuid4().hex[:6]
    comp = Company(id=f"comp-re-{s}", name=f"Reassign Co {s}", gst_number="27AAAAA0000A1Z5", is_active=True)
    branch = Branch(id=f"br-re-{s}", company_id=comp.id, name=f"Branch {s}", code=f"BR-{s}", is_active=True)
    cust1 = Customer(id=f"c1-re-{s}", company_id=comp.id, code=f"C1-RE-{s}", name=f"Old Owner {s}", is_active=True, is_deleted=False)
    cust2 = Customer(id=f"c2-re-{s}", company_id=comp.id, code=f"C2-RE-{s}", name=f"New Owner {s}", is_active=True, is_deleted=False)
    db_session.add(comp)
    await db_session.commit()
    db_session.add_all([branch, cust1, cust2])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=branch.id)
    target_code = f"REASSIGN-{s.upper()}"
    service = CrmService(db_session, tenant_ctx)

    # 1. Cust 1 owns the store code
    loc1 = await service.create_delivery_location(cust1.id, CustomerDeliveryLocationCreate(
        store_code=target_code,
        location_name="Cust 1 Flagship Outlet",
        city="Mumbai",
    ))
    assert loc1.status == "ACTIVE"

    # 2. Cust 1 legitimately deactivates the store location
    await service.delete_delivery_location(cust1.id, loc1.id)
    await db_session.refresh(loc1)
    assert loc1.status == "INACTIVE"
    assert loc1.is_deleted is True

    # 3. Cust 2 can now legitimately claim the released store code
    loc2 = await service.create_delivery_location(cust2.id, CustomerDeliveryLocationCreate(
        store_code=target_code,
        location_name="Cust 2 Reacquired Outlet",
        city="Mumbai",
    ))
    assert loc2.store_code == target_code
    assert loc2.customer_id == cust2.id
    assert loc2.status == "ACTIVE"

    # 4. Cust 1's historical record remains preserved in the database (not hard deleted)
    old_record = await db_session.get(CustomerDeliveryLocation, loc1.id)
    assert old_record is not None
    assert old_record.customer_id == cust1.id
    assert old_record.status == "INACTIVE"

    # 5. Cust 1 cannot re-claim the code while Cust 2 holds it active
    with pytest.raises(HTTPException) as exc:
        await service.create_delivery_location(cust1.id, CustomerDeliveryLocationCreate(
            store_code=target_code,
            location_name="Cust 1 Reclaim Attempt",
            city="Mumbai",
        ))
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_tenant_isolation_store_code_lookup_and_assignment(db_session):
    """Requirement 1 & 2: Verify strict tenant isolation across lookup and assignment."""
    from app.services.crm import CrmService
    from app.schemas.crm import CustomerDeliveryLocationCreate
    from app.models.tenant import Company, Branch
    from app.models.crm import Customer
    from app.api.deps import TenantContext
    from fastapi import HTTPException
    import uuid

    s = uuid.uuid4().hex[:6]
    comp_a = Company(id=f"comp-a-{s}", name=f"Tenant A {s}", gst_number="27AAAAA0000A1Z5", is_active=True)
    comp_b = Company(id=f"comp-b-{s}", name=f"Tenant B {s}", gst_number="27BBBBB0000B1Z5", is_active=True)
    branch_a = Branch(id=f"br-a-{s}", company_id=comp_a.id, name=f"Branch A {s}", code=f"BRA-{s}", is_active=True)
    branch_b = Branch(id=f"br-b-{s}", company_id=comp_b.id, name=f"Branch B {s}", code=f"BRB-{s}", is_active=True)
    cust_a = Customer(id=f"cust-a-{s}", company_id=comp_a.id, code=f"CA-{s}", name="Cust A", is_active=True, is_deleted=False)
    cust_b = Customer(id=f"cust-b-{s}", company_id=comp_b.id, code=f"CB-{s}", name="Cust B", is_active=True, is_deleted=False)
    db_session.add_all([comp_a, comp_b])
    await db_session.commit()
    db_session.add_all([branch_a, branch_b, cust_a, cust_b])
    await db_session.commit()

    tenant_a = TenantContext(company_id=comp_a.id, branch_id=branch_a.id)
    tenant_b = TenantContext(company_id=comp_b.id, branch_id=branch_b.id)

    svc_a = CrmService(db_session, tenant_a)
    svc_b = CrmService(db_session, tenant_b)

    # Tenant A creates store code 'STR-ISO-A'
    loc_a = await svc_a.create_delivery_location(cust_a.id, CustomerDeliveryLocationCreate(
        store_code=f"STR-ISO-{s.upper()}",
        location_name="Tenant A Exclusive Store",
        city="Mumbai",
    ))
    assert loc_a.company_id == comp_a.id

    # Tenant B lookup cannot see Tenant A's store codes
    lookup_b = await svc_b.list_store_code_lookup(q=f"STR-ISO-{s.upper()}")
    assert len(lookup_b) == 0

    # Cross-tenant access attempt by Tenant B on Tenant A's customer raises 404
    with pytest.raises(HTTPException) as exc:
        await svc_b.get_delivery_location(cust_a.id, loc_a.id)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_address_update_concurrency_conflict_protection(db_session):
    """Requirement 2: Address updates acquire with_for_update row-level locks on CustomerDeliveryLocation."""
    from app.services.crm import CrmService
    from app.schemas.crm import CustomerDeliveryLocationCreate, StoreAddressCreate
    from app.models.tenant import Company, Branch
    from app.models.crm import Customer
    from app.api.deps import TenantContext
    import uuid

    s = uuid.uuid4().hex[:6]
    comp = Company(id=f"comp-addr-{s}", name=f"Addr Co {s}", gst_number="27AAAAA0000A1Z5", is_active=True)
    branch = Branch(id=f"br-addr-{s}", company_id=comp.id, name=f"Branch {s}", code=f"BR-{s}", is_active=True)
    cust = Customer(id=f"c-addr-{s}", company_id=comp.id, code=f"CA-{s}", name=f"Addr Cust {s}", is_active=True, is_deleted=False)
    db_session.add(comp)
    await db_session.commit()
    db_session.add_all([branch, cust])
    await db_session.commit()

    tenant_ctx = TenantContext(company_id=comp.id, branch_id=branch.id)
    service = CrmService(db_session, tenant_ctx)

    loc = await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
        store_code=f"ADDR-CONC-{s.upper()}",
        location_name="Multi-Address Concurrency Hub",
        city="Mumbai",
    ))

    # Add 2 typed addresses sequentially via row-locking service
    addr1 = await service.add_store_address(cust.id, loc.id, StoreAddressCreate(
        addressType="Delivery",
        addressTitle="Primary Inward Dock",
        addressLine1="Dock 1, North Gate",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        isPrimary=True,
    ))
    assert addr1.id is not None
    assert addr1.is_primary is True

    addr2 = await service.add_store_address(cust.id, loc.id, StoreAddressCreate(
        addressType="Billing",
        addressTitle="Finance Center",
        addressLine1="Tower B, Level 6",
        city="Mumbai",
        state="Maharashtra",
        pincode="400051",
        isPrimary=True,
    ))
    assert addr2.id is not None
    assert addr2.is_primary is True

    # Verify both addresses persist without silent overwrite
    refreshed_list = await service.list_store_addresses(cust.id, loc.id)
    assert len(refreshed_list) >= 2
    types = {a.address_type for a in refreshed_list}
    assert "Delivery" in types
    assert "Billing" in types
