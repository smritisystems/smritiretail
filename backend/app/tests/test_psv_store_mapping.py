"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.1
Created      : 2026-10-16
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Test Suite   : Conditional Store Code & PSV Account Resolution Integration Tests
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text, select, func
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.crm import Customer, CustomerDeliveryLocation, CustomerRelationship
from app.models.psv import PSVParty, PSVStockBalance, PSVStockEvent
from app.models.inventory import StockMovement
from app.repositories.customer import CustomerRepository
from app.core.security import create_access_token, hash_password
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.tests.conftest import clear_db
from fastapi import HTTPException
from app.core.sales_channels import (
    channel_requires_store_location,
    get_channel_capabilities,
    DEFAULT_CHANNEL_CAPABILITIES,
)
from app.services.psv_projection import PSVProjectionService
from app.services.billing_catalog_service import BillingCatalogService
from app.services.crm import CrmService
from app.schemas.crm import CustomerCreate, CustomerUpdate


async def _create_test_environment(db_session):
    s = uuid.uuid4().hex[:6]
    company = Company(
        id=f"comp-psv-{s}",
        name=f"PSV Store Test Company {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    branch = Branch(
        id=f"br-psv-{s}",
        company_id=company.id,
        name=f"PSV Branch {s}",
        code=f"BR-PSV-{s}",
        is_active=True,
    )
    db_session.add_all([company, branch])
    await db_session.commit()

    user = User(
        id=f"usr-psv-{s}",
        username=f"psv_admin_{s}",
        email=f"psv_{s}@smriti.test",
        hashed_password=hash_password("P@ssword123"),
        role=UserRole.MANAGER,
        is_active=True,
        is_deleted=False,
        company_id=company.id,
        branch_id=branch.id,
    )
    customer = Customer(
        id=f"cust-{s}",
        company_id=company.id,
        code=f"RIL-{s}",
        name=f"Reliance Retail Ltd {s}",
        customer_type="MODERN_TRADE",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([user, customer])
    await db_session.commit()

    delivery_loc = CustomerDeliveryLocation(
        id=f"cdl-{s}",
        company_id=company.id,
        customer_id=customer.id,
        store_code="T97D",
        location_name="Smart Bazaar Thane",
        city="Thane",
        state="Maharashtra",
        status="ACTIVE",
        is_deleted=False,
    )
    db_session.add(delivery_loc)
    await db_session.commit()
    return company, branch, user, customer, delivery_loc


def _auth_headers(user: User):
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": user.company_id,
        "branch_id": user.branch_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}", "X-Company-ID": user.company_id}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


# =========================================================================
# 1. CHANNEL CAPABILITIES LOGIC & REST ENDPOINT
# =========================================================================

def test_sales_channel_capabilities_logic():
    """Verify sales channels defaults and store requirement logic."""
    assert channel_requires_store_location("MODERN_TRADE") is True
    assert channel_requires_store_location("GENERAL_TRADE") is False
    assert channel_requires_store_location("B2B_WHOLESALE") is False
    assert channel_requires_store_location("POS_RETAIL") is False
    assert channel_requires_store_location("ECOMMERCE") is False
    assert channel_requires_store_location(None) is False
    assert channel_requires_store_location("NON_EXISTENT") is False

    mt_cap = get_channel_capabilities("MODERN_TRADE")
    assert mt_cap["requires_store_location"] is True

    b2b_cap = get_channel_capabilities("B2B_WHOLESALE")
    assert b2b_cap["requires_store_location"] is False


@pytest.mark.asyncio
async def test_get_channel_capabilities_api_endpoint(db_session):
    """Verify GET /api/v1/sales/channel-capabilities returns canonical channel configs."""
    company, branch, user, _, _ = await _create_test_environment(db_session)
    _set_tenant(db_session, company.id, branch.id)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sales/channel-capabilities", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    channel_map = {item["channel"]: item for item in payload}
    assert "MODERN_TRADE" in channel_map
    assert channel_map["MODERN_TRADE"]["requires_store_location"] is True
    assert "B2B_WHOLESALE" in channel_map
    assert channel_map["B2B_WHOLESALE"]["requires_store_location"] is False


# =========================================================================
# 2. RESOLVE OR CREATE PSV PARTY SERVICE METHOD
# =========================================================================

@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_creates_new_with_zero_stock_ledger(db_session):
    """Verify new PSV party creation and zero stock ledger movements."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)

    res = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        delivery_location_id=loc.id,
    )

    assert res["is_newly_created"] is True
    assert res["psv_party_id"] is not None
    assert res["company_id"] == company.id
    assert res["delivery_location_id"] == loc.id
    assert res["host_customer_id"] == customer.id
    assert res["store_code"] == "T97D"
    assert res["name"] == customer.name

    # Zero stock movements verification (PSV is shadow-only projection)
    mvt_count = await db_session.scalar(
        select(func.count(StockMovement.id)).where(StockMovement.company_id == company.id)
    )
    assert mvt_count == 0


@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_idempotent_reuse(db_session):
    """Verify that calling resolve multiple times returns the exact same party with is_newly_created=False."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)

    res1 = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        delivery_location_id=loc.id,
    )
    assert res1["is_newly_created"] is True

    res2 = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        delivery_location_id=loc.id,
    )
    assert res2["is_newly_created"] is False
    assert res2["psv_party_id"] == res1["psv_party_id"]


@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_links_legacy_unlinked_party(db_session):
    """Verify that an unlinked historical PSV party matching customer & store code is safely linked."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)

    # Pre-create unlinked party (e.g. from legacy manual PSV onboarding)
    legacy_party = PSVParty(
        id=f"psv-legacy-{uuid.uuid4().hex[:6]}",
        company_id=company.id,
        name="Legacy Thane Store",
        location="Thane",
        host_customer_id=customer.id,
        store_code="T97D",
        delivery_location_id=None,
        status="Healthy",
    )
    db_session.add(legacy_party)
    await db_session.commit()

    res = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=db_session,
        company_id=company.id,
        customer_id=customer.id,
        delivery_location_id=loc.id,
    )

    assert res["is_newly_created"] is False
    assert res["psv_party_id"] == legacy_party.id
    assert res["delivery_location_id"] == loc.id


@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_rejects_inactive_or_deleted_location(db_session):
    """Verify that inactive or soft-deleted delivery locations are rejected with clean error."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)

    loc.status = "INACTIVE"
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await PSVProjectionService.resolve_or_create_store_psv_party(
            session=db_session,
            company_id=company.id,
            customer_id=customer.id,
            delivery_location_id=loc.id,
        )
    assert exc_info.value.status_code == 400
    assert "inactive or deleted" in exc_info.value.detail


@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_rejects_customer_mismatch(db_session):
    """Verify that a delivery location belonging to customer A cannot be resolved for customer B."""
    company, branch, user, customerA, locA = await _create_test_environment(db_session)

    customerB = Customer(
        id=f"cust-b-{uuid.uuid4().hex[:6]}",
        company_id=company.id,
        code="CUST-OTHER",
        name="Other Retailer",
        is_active=True,
    )
    db_session.add(customerB)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await PSVProjectionService.resolve_or_create_store_psv_party(
            session=db_session,
            company_id=company.id,
            customer_id=customerB.id,
            delivery_location_id=locA.id,
        )
    assert exc_info.value.status_code == 400
    assert "does not belong" in exc_info.value.detail


@pytest.mark.asyncio
async def test_resolve_or_create_store_psv_party_rejects_cross_tenant_access(db_session):
    """Verify that delivery locations in another company cannot be accessed."""
    companyA, branchA, userA, customerA, locA = await _create_test_environment(db_session)

    # Different company
    other_company = Company(
        id=f"comp-other-{uuid.uuid4().hex[:6]}",
        name="Other Corp",
        gst_number="27ZZZZZ9999Z1Z1",
        is_active=True,
    )
    db_session.add(other_company)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await PSVProjectionService.resolve_or_create_store_psv_party(
            session=db_session,
            company_id=other_company.id,
            customer_id=customerA.id,
            delivery_location_id=locA.id,
        )
    assert exc_info.value.status_code == 403
    assert "tenant boundary" in exc_info.value.detail


# =========================================================================
# 3. HTTP ENDPOINT POST /api/v1/psv/resolve-store-party
# =========================================================================

@pytest.mark.asyncio
async def test_api_resolve_store_party_endpoint(db_session):
    """Verify POST /api/v1/psv/resolve-store-party HTTP contract."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)
    _set_tenant(db_session, company.id, branch.id)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First call: creates the party
        res1 = await client.post(
            "/api/v1/psv/resolve-store-party",
            json={"customer_id": customer.id, "delivery_location_id": loc.id},
            headers=headers,
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["store_code"] == "T97D"
        assert data1["delivery_location_id"] == loc.id
        assert data1["is_newly_created"] is True

        # Second call: idempotent return
        res2 = await client.post(
            "/api/v1/psv/resolve-store-party",
            json={"customer_id": customer.id, "delivery_location_id": loc.id},
            headers=headers,
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["psv_party_id"] == data1["psv_party_id"]
        assert data2["is_newly_created"] is False


@pytest.mark.asyncio
async def test_api_resolve_store_party_handles_validation_error(db_session):
    """Verify POST /api/v1/psv/resolve-store-party returns 400 on customer mismatch."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)
    _set_tenant(db_session, company.id, branch.id)
    headers = _auth_headers(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/psv/resolve-store-party",
            json={"customer_id": "cust-wrong-id", "delivery_location_id": loc.id},
            headers=headers,
        )
        assert res.status_code == 400
        assert "does not belong" in res.json().get("detail", "")


# =========================================================================
# 4. DATABASE LEVEL UNIQUE CONSTRAINT INTEGRITY
# =========================================================================

@pytest.mark.asyncio
async def test_psv_party_db_partial_unique_index_enforcement(db_session):
    """Verify that the database partial unique index rejects duplicate (company_id, delivery_location_id)."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)

    party1 = PSVParty(
        id=f"psv-idx-1-{uuid.uuid4().hex[:6]}",
        company_id=company.id,
        name="Thane Store Party 1",
        location="Thane",
        delivery_location_id=loc.id,
        host_customer_id=customer.id,
        store_code="T97D",
        status="Healthy",
    )
    db_session.add(party1)
    await db_session.commit()

    party2 = PSVParty(
        id=f"psv-idx-2-{uuid.uuid4().hex[:6]}",
        company_id=company.id,
        name="Thane Store Party 2",
        location="Thane",
        delivery_location_id=loc.id,
        host_customer_id=customer.id,
        store_code="T97D",
        status="Healthy",
    )
    db_session.add(party2)

    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


# =========================================================================
# 5. SECURITY & TENANT ISOLATION REJECTION TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_api_resolve_store_party_rejects_header_tampering(db_session):
    """Verify that tampering with X-Company-ID header is rejected with 403 Forbidden."""
    company, branch, user, customer, loc = await _create_test_environment(db_session)
    old_gt = app.dependency_overrides.pop(get_tenant_context, None)
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        headers = _auth_headers(user)
        headers["X-Company-ID"] = "COMP-SPOOF-999"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/psv/resolve-store-party",
                json={"customer_id": customer.id, "delivery_location_id": loc.id},
                headers=headers,
            )
            assert res.status_code == 403
            assert res.json().get("error_code") == "SMRITI-PERM-001" or "denied" in res.json().get("detail", "").lower() or "forbidden" in res.json().get("detail", "").lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        if old_gt:
            app.dependency_overrides[get_tenant_context] = old_gt


# =========================================================================
# 6. INVENTORY ISOLATION & ZERO STOCK MUTATIONS GATE
# =========================================================================

@pytest.mark.asyncio
async def test_resolve_store_party_guarantees_zero_stock_mutations(db_session):
    """
    CRITICAL GATE: Verify that resolving a store code into a PSV Party
    creates ZERO inventory movements, ZERO stock balance rows, and ZERO stock events.
    Store resolution must be strictly non-mutating with respect to inventory.
    """
    company, branch, user, customer, loc = await _create_test_environment(db_session)
    _set_tenant(db_session, company.id, branch.id)
    headers = _auth_headers(user)

    from app.models.psv import PSVStockEvent, PSVStockBalance
    mvt_count_before = (await db_session.execute(select(func.count(StockMovement.id)))).scalar() or 0
    evt_count_before = (await db_session.execute(select(func.count(PSVStockEvent.event_id)))).scalar() or 0
    bal_count_before = (await db_session.execute(select(func.count(PSVStockBalance.id)))).scalar() or 0

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/psv/resolve-store-party",
            json={"customer_id": customer.id, "delivery_location_id": loc.id},
            headers=headers,
        )
        assert res.status_code == 200

    mvt_count_after = (await db_session.execute(select(func.count(StockMovement.id)))).scalar() or 0
    evt_count_after = (await db_session.execute(select(func.count(PSVStockEvent.event_id)))).scalar() or 0
    bal_count_after = (await db_session.execute(select(func.count(PSVStockBalance.id)))).scalar() or 0

    assert mvt_count_after == mvt_count_before
    assert evt_count_after == evt_count_before
    assert bal_count_after == bal_count_before


# =========================================================================
# 7. CANONICAL SALES POSTING & SALES CHANNEL PERSISTENCE TESTS
# =========================================================================

@pytest.mark.asyncio
async def test_canonical_sales_posting_persists_sales_channel(db_session):
    """Verify that posting a transaction with sales_channel='MODERN_TRADE' stores it on SalesInvoice."""
    from decimal import Decimal
    from app.models.inventory import Product, ProductBatchStock, Warehouse
    from app.models.item_master import Item, ItemVariant
    from app.schemas.canonical_posting import (
        CanonicalPostingRequest,
        CanonicalPostingContext,
        CanonicalPostingLineItem,
        CanonicalTenderItem,
    )
    from app.models.sales import SalesInvoice
    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter

    company, branch, user, customer, loc = await _create_test_environment(db_session)
    s = uuid.uuid4().hex[:6]

    warehouse = Warehouse(
        id=f"wh-{s}",
        company_id=company.id,
        branch_id=branch.id,
        code=f"WH_{s}".upper()[:16],
        name="Test WH",
        pincode="400001",
        state="Maharashtra",
        is_active=True,
    )
    item = Item(
        id=f"itm-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_code=f"PRD-{s}".upper()[:20],
        item_name="Test Product MT",
        category="General",
        primary_uom="NOS",
        uom="NOS",
        selling_price=Decimal("1000.00"),
        mrp=Decimal("1000.00"),
        is_active=True,
    )
    db_session.add_all([warehouse, item])
    await db_session.flush()

    variant = ItemVariant(
        id=f"var-{s}",
        company_id=company.id,
        item_id=item.id,
        variant_sku=f"PRD-{s}".upper()[:20],
        variant_name="Test Product MT Variant",
        selling_price=Decimal("1000.00"),
        mrp=Decimal("1000.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        name="Test Product MT",
        code=f"PRD-{s}".upper()[:20],
        barcode=f"BAR-{s}".upper()[:20],
        category="General",
        mrp=Decimal("1000.00"),
        price=Decimal("1000.00"),
        gst_percentage=Decimal("18.00"),
        stock=Decimal("100.00"),
        is_active=True,
    )
    db_session.add(prod)
    await db_session.flush()

    pbs = ProductBatchStock(
        id=f"pbs-{s}",
        uuid=f"pbs-{s}",
        company_id=company.id,
        branch_id=branch.id,
        product_id=prod.id,
        warehouse_id=warehouse.id,
        batch_no="BATCH-001",
        quantity=Decimal("100.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("1000.00"),
        sale_rate=Decimal("1000.00"),
    )
    db_session.add(pbs)
    await db_session.commit()

    idemp_key = f"IDEMP-MT-{s}"
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id=company.id,
            branch_id=branch.id,
            warehouse_id=warehouse.id,
            idempotency_key=idemp_key,
            sales_channel="MODERN_TRADE",
        ),
        sales_channel="MODERN_TRADE",
        customer_id=customer.id,
        customer_name=customer.name,
        delivery_location_id=loc.id,
        delivery_store_code=loc.store_code,
        payment_mode="CASH",
        place_of_supply="27",
        items=[
            CanonicalPostingLineItem(
                product_id=prod.id,
                variant_id=variant.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("2.00"),
                unit_price=Decimal("1000.00"),
                disc_pct=Decimal("0.00"),
                is_tax_inclusive=True,
                gst_rate=Decimal("18.00"),
                mrp=Decimal("1000.00"),
                batch_no="BATCH-001",
            )
        ],
        tenders=[
            CanonicalTenderItem(tender_type="CASH", amount=Decimal("2000.00"))
        ],
    )

    res = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db_session,
        req=req,
        idempotency_key=idemp_key,
        commit=True,
    )
    assert res.success is True
    assert res.invoice_no is not None

    inv_res = await db_session.execute(
        select(SalesInvoice).where(SalesInvoice.invoice_no == res.invoice_no)
    )
    invoice = inv_res.scalars().first()
    assert invoice is not None
    assert invoice.sales_channel == "MODERN_TRADE"


@pytest.mark.asyncio
async def test_parent_child_store_pos_invoice_projects_to_correct_psv_party(db_session):
    """Exercise customer hierarchy, store billing, canonical stock, and PSV together."""
    from decimal import Decimal

    from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
    from app.models.item_master import Item, ItemVariant
    from app.models.sales import SalesInvoice
    from app.schemas.canonical_posting import (
        CanonicalPostingContext,
        CanonicalPostingLineItem,
        CanonicalPostingRequest,
        CanonicalTenderItem,
    )
    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter

    company, branch, user, original_customer, _ = await _create_test_environment(db_session)
    suffix = uuid.uuid4().hex[:6].upper()
    tenant = TenantContext(company_id=company.id, branch_id=branch.id, role=user.role)
    crm = CrmService(db_session, tenant)

    parent = await crm.create_customer(
        CustomerCreate(
            name=f"Lifecycle Parent {suffix}",
            code=f"PAR-{suffix}",
            mobile=f"98{uuid.uuid4().int % 100000000:08d}",
            show_child_customers_in_billing=False,
        ),
        current_user=user,
    )
    standalone = await crm.create_customer(
        CustomerCreate(
            name=f"Lifecycle Standalone {suffix}",
            code=f"STD-{suffix}",
            mobile=f"96{uuid.uuid4().int % 100000000:08d}",
        ),
        current_user=user,
    )
    children = []
    locations = []
    for index in (1, 2):
        child = await crm.create_customer(
            CustomerCreate(
                name=f"Lifecycle Child {index} {suffix}",
                code=f"CH{index}-{suffix}",
                mobile=f"97{uuid.uuid4().int % 100000000:08d}",
                parent_customer_id=parent.id,
            ),
            current_user=user,
        )
        location = CustomerDeliveryLocation(
            id=f"cdl-{suffix.lower()}-{index}",
            company_id=company.id,
            customer_id=child.id,
            store_code=f"S{suffix[:4]}{index}",
            location_name=f"Lifecycle Store {index} {suffix}",
            city="Gorakhpur",
            state="Uttar Pradesh",
            state_code="09",
            status="ACTIVE",
            is_deleted=False,
        )
        db_session.add(location)
        children.append(child)
        locations.append(location)
    await db_session.commit()

    assert original_customer.is_dependant is False
    assert standalone.is_dependant is False
    assert all(child.is_dependant is True for child in children)
    for child in children:
        relationship = (await db_session.execute(select(CustomerRelationship).where(
            CustomerRelationship.parent_customer_id == parent.id,
            CustomerRelationship.dependant_customer_id == child.id,
            CustomerRelationship.company_id == company.id,
            CustomerRelationship.is_deleted.is_(False),
        ))).scalar_one()
        assert relationship.relation == "Child"
    billing_hidden = await BillingCatalogService.get_customers(
        session=db_session, company_id=company.id, q=suffix
    )
    hidden_ids = {customer.id for customer in billing_hidden.items}
    assert parent.id in hidden_ids
    assert standalone.id in hidden_ids
    assert not ({child.id for child in children} & hidden_ids)
    customer_repo = CustomerRepository(db_session, tenant)
    assert await customer_repo.get_billing_visible_id(children[0].id) is None

    await crm.update_customer(parent.id, CustomerUpdate(show_child_customers_in_billing=True))
    billing_visible = await BillingCatalogService.get_customers(
        session=db_session, company_id=company.id, q=suffix
    )
    visible_ids = {customer.id for customer in billing_visible.items}
    assert {child.id for child in children} <= visible_ids
    assert standalone.id in visible_ids
    assert await customer_repo.get_billing_visible_id(children[0].id) == children[0].id

    parties = []
    for child, location in zip(children, locations, strict=True):
        resolved = await PSVProjectionService.resolve_or_create_store_psv_party(
            session=db_session,
            company_id=company.id,
            customer_id=child.id,
            delivery_location_id=location.id,
            branch_id=branch.id,
        )
        party = await db_session.get(PSVParty, resolved["psv_party_id"])
        assert party is not None
        assert party.host_customer_id == child.id
        assert party.host_customer_id != parent.id
        assert party.delivery_location_id == location.id
        assert party.store_code == location.store_code
        parties.append(party)
    await db_session.commit()

    warehouse = Warehouse(
        id=f"wh-{suffix.lower()}",
        company_id=company.id,
        branch_id=branch.id,
        code=f"WH-{suffix}",
        name=f"Lifecycle Warehouse {suffix}",
        pincode="273001",
        state="Uttar Pradesh",
        is_active=True,
    )
    item = Item(
        id=f"itm-{suffix.lower()}",
        company_id=company.id,
        branch_id=branch.id,
        item_code=f"SKU-{suffix}",
        item_name=f"Lifecycle Item {suffix}",
        category="General",
        primary_uom="NOS",
        uom="NOS",
        selling_price=Decimal("1000.00"),
        mrp=Decimal("1000.00"),
        is_active=True,
    )
    db_session.add_all([warehouse, item])
    await db_session.flush()
    variant = ItemVariant(
        id=f"var-{suffix.lower()}",
        company_id=company.id,
        item_id=item.id,
        variant_sku=f"SKU-{suffix}",
        variant_name=f"Lifecycle Item Variant {suffix}",
        selling_price=Decimal("1000.00"),
        mrp=Decimal("1000.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()
    product = Product(
        id=f"prd-{suffix.lower()}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        name=item.item_name,
        code=item.item_code,
        barcode=f"BAR-{suffix}",
        category="General",
        mrp=Decimal("1000.00"),
        price=Decimal("1000.00"),
        gst_percentage=Decimal("0.00"),
        stock=Decimal("10.00"),
        is_active=True,
    )
    db_session.add(product)
    await db_session.flush()
    batch = ProductBatchStock(
        id=f"pbs-{suffix.lower()}",
        uuid=f"pbs-{suffix.lower()}",
        company_id=company.id,
        branch_id=branch.id,
        product_id=product.id,
        warehouse_id=warehouse.id,
        batch_no=f"B-{suffix}",
        quantity=Decimal("10.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("1000.00"),
        sale_rate=Decimal("1000.00"),
    )
    db_session.add(batch)
    await db_session.commit()

    idempotency_key = f"LIFECYCLE-{suffix}"
    request = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id=company.id,
            branch_id=branch.id,
            warehouse_id=warehouse.id,
            idempotency_key=idempotency_key,
            source_channel="POS_RETAIL",
            sales_channel="MODERN_TRADE",
        ),
        customer_id=children[0].id,
        customer_name=children[0].name,
        delivery_location_id=locations[0].id,
        items=[CanonicalPostingLineItem(
            product_id=product.id,
            variant_id=variant.id,
            code=product.code,
            name=product.name,
            quantity=Decimal("2.00"),
            unit_price=Decimal("1000.00"),
            gst_rate=Decimal("0.00"),
            is_tax_inclusive=True,
            mrp=Decimal("1000.00"),
            batch_no=batch.batch_no,
        )],
        tenders=[CanonicalTenderItem(tender_type="CASH", amount=Decimal("2000.00"))],
        payment_mode="CASH",
    )
    posted = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db_session, req=request, idempotency_key=idempotency_key, commit=True
    )
    assert posted.success is True
    assert posted.customer_id == children[0].id

    invoice = await db_session.get(SalesInvoice, posted.invoice_id)
    assert invoice is not None
    assert invoice.customer_id == children[0].id
    assert invoice.delivery_location_id == locations[0].id
    assert invoice.delivery_store_code == locations[0].store_code

    event = (await db_session.execute(select(PSVStockEvent).where(
        PSVStockEvent.invoice_id == invoice.id,
        PSVStockEvent.company_id == company.id,
    ))).scalar_one()
    assert event.psv_party_id == parties[0].id
    assert event.host_customer_id == children[0].id
    assert event.delivery_location_id == locations[0].id
    assert event.store_code_snapshot == locations[0].store_code
    assert event.quantity == Decimal("2.00")
    balance = (await db_session.execute(select(PSVStockBalance).where(
        PSVStockBalance.company_id == company.id,
        PSVStockBalance.psv_party_id == parties[0].id,
        PSVStockBalance.sku == product.code,
    ))).scalar_one()
    assert balance.billed_qty == Decimal("2.00")
    assert balance.current_balance == Decimal("2.00")
    reconciliation = await PSVProjectionService.get_quantity_reconciliation(
        session=db_session,
        company_id=company.id,
        invoice_id=invoice.id,
    )
    assert reconciliation.summary.total_items == 1
    assert reconciliation.summary.total_document_qty == Decimal("2.0000")
    assert reconciliation.items[0].party_id == parties[0].id
    assert reconciliation.items[0].store_code == locations[0].store_code
    assert await db_session.scalar(select(func.count(PSVStockEvent.event_id)).where(
        PSVStockEvent.invoice_id == invoice.id
    )) == 1

    stock_movement = (await db_session.execute(select(StockMovement).where(
        StockMovement.reference_doc_id == invoice.id,
        StockMovement.company_id == company.id,
    ))).scalar_one()
    assert stock_movement.movement_type == "OUTWARD_SALE"
    assert stock_movement.quantity == Decimal("2.00")
    persisted_batch = await db_session.get(ProductBatchStock, batch.id)
    assert persisted_batch.quantity == Decimal("8.00")

    replay = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db_session, req=request, idempotency_key=idempotency_key, commit=True
    )
    assert replay.is_replayed is True
    assert replay.invoice_id == invoice.id
    assert await db_session.scalar(select(func.count(SalesInvoice.id)).where(
        SalesInvoice.company_id == company.id,
        SalesInvoice.customer_id == children[0].id,
        SalesInvoice.id == invoice.id,
    )) == 1
    assert await db_session.scalar(select(func.count(PSVStockEvent.event_id)).where(
        PSVStockEvent.invoice_id == invoice.id
    )) == 1


@pytest.mark.asyncio
async def test_canonical_sales_posting_defaults_sales_channel_to_b2b_wholesale(db_session):
    """Verify that posting a transaction without sales_channel defaults to B2B_WHOLESALE."""
    from decimal import Decimal
    from app.models.inventory import Product, ProductBatchStock, Warehouse
    from app.models.sales import SalesInvoice
    from app.models.item_master import Item, ItemVariant
    from app.schemas.canonical_posting import (
        CanonicalPostingRequest,
        CanonicalPostingContext,
        CanonicalPostingLineItem,
        CanonicalTenderItem,
    )
    from app.services.canonical_sales_writer import CanonicalSalesPostingWriter

    company, branch, user, customer, loc = await _create_test_environment(db_session)
    s = uuid.uuid4().hex[:6]

    warehouse = Warehouse(
        id=f"wh-{s}",
        company_id=company.id,
        branch_id=branch.id,
        code=f"WH_{s}".upper()[:16],
        name="Test WH 2",
        pincode="400001",
        state="Maharashtra",
        is_active=True,
    )
    item = Item(
        id=f"itm-def-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_code=f"PRD-{s}".upper()[:20],
        item_name="Test Product Default",
        category="General",
        primary_uom="NOS",
        uom="NOS",
        selling_price=Decimal("500.00"),
        mrp=Decimal("500.00"),
        is_active=True,
    )
    db_session.add_all([warehouse, item])
    await db_session.flush()

    variant = ItemVariant(
        id=f"var-def-{s}",
        company_id=company.id,
        item_id=item.id,
        variant_sku=f"PRD-{s}".upper()[:20],
        variant_name="Test Product Default Variant",
        selling_price=Decimal("500.00"),
        mrp=Decimal("500.00"),
        is_active=True,
    )
    db_session.add(variant)
    await db_session.flush()

    prod = Product(
        id=f"prd-{s}",
        company_id=company.id,
        branch_id=branch.id,
        item_id=item.id,
        item_variant_id=variant.id,
        name="Test Product Default",
        code=f"PRD-{s}".upper()[:20],
        barcode=f"BAR-{s}".upper()[:20],
        category="General",
        mrp=Decimal("500.00"),
        price=Decimal("500.00"),
        gst_percentage=Decimal("5.00"),
        stock=Decimal("100.00"),
        is_active=True,
    )
    db_session.add(prod)
    await db_session.flush()

    pbs = ProductBatchStock(
        id=f"pbs-{s}",
        uuid=f"pbs-{s}",
        company_id=company.id,
        branch_id=branch.id,
        product_id=prod.id,
        warehouse_id=warehouse.id,
        batch_no="BATCH-DEFAULT",
        quantity=Decimal("100.00"),
        reserved_quantity=Decimal("0.00"),
        damaged_quantity=Decimal("0.00"),
        mrp=Decimal("500.00"),
        sale_rate=Decimal("500.00"),
    )
    db_session.add(pbs)
    await db_session.commit()

    idemp_key = f"IDEMP-DEF-{s}"
    req = CanonicalPostingRequest(
        context=CanonicalPostingContext(
            company_id=company.id,
            branch_id=branch.id,
            warehouse_id=warehouse.id,
            idempotency_key=idemp_key,
        ),
        customer_id=customer.id,
        customer_name=customer.name,
        payment_mode="CASH",
        place_of_supply="27",
        items=[
            CanonicalPostingLineItem(
                product_id=prod.id,
                variant_id=variant.id,
                code=prod.code,
                name=prod.name,
                quantity=Decimal("1.00"),
                unit_price=Decimal("500.00"),
                disc_pct=Decimal("0.00"),
                is_tax_inclusive=True,
                gst_rate=Decimal("5.00"),
                mrp=Decimal("500.00"),
                batch_no="BATCH-DEFAULT",
            )
        ],
        tenders=[
            CanonicalTenderItem(tender_type="CASH", amount=Decimal("500.00"))
        ],
    )

    res = await CanonicalSalesPostingWriter.post_sales_transaction(
        session=db_session,
        req=req,
        idempotency_key=idemp_key,
        commit=True,
    )
    assert res.success is True

    inv_res = await db_session.execute(
        select(SalesInvoice).where(SalesInvoice.invoice_no == res.invoice_no)
    )
    invoice = inv_res.scalars().first()
    assert invoice is not None
    assert invoice.sales_channel == "B2B_WHOLESALE"
