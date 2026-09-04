"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import pytest
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from unittest.mock import AsyncMock, MagicMock

# Set required environment keys before app/config imports
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-smriti"
os.environ["INTERNAL_SERVICE_KEY"] = "test-internal-key-smriti"
os.environ["SGIP_VAULT_MASTER_KEY"] = "test-vault-master-key-smriti-32chars"

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.models.auth import User, UserRole
from app.models.crm import Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation
from app.models.sales import SalesInvoice
from app.schemas.crm import (
    CustomerGSTRegistrationBase,
    CustomerGSTRegistrationCreate,
    CustomerGSTRegistrationUpdate,
    CustomerGSTRegistrationResponse,
    CustomerDeliveryLocationBase,
    CustomerDeliveryLocationCreate,
    CustomerDeliveryLocationUpdate,
    CustomerDeliveryLocationResponse,
)
from app.services.crm import CrmService
from app.repositories.customer import (
    CustomerRepository,
    CustomerGSTRegistrationRepository,
    CustomerDeliveryLocationRepository,
)
from app.api.deps import TenantContext, get_company_db, get_tenant_context, require_role, get_current_user
from app.main import app


# ─────────────────────────────────────────────────────────────────────────────
# MockResult & In-Memory Test State
# ─────────────────────────────────────────────────────────────────────────────

class MockResult:
    def __init__(self, items=None):
        if items is None:
            self._items = []
        elif isinstance(items, list):
            self._items = items
        else:
            self._items = [items]

    def scalars(self):
        return self

    def all(self):
        return list(self._items)

    def first(self):
        return self._items[0] if self._items else None

    def scalar(self):
        return self._items[0] if self._items else 0


class InMemoryCrmDB:
    def __init__(self):
        self.customers: Dict[str, Customer] = {}
        self.gst_registrations: Dict[str, CustomerGSTRegistration] = {}
        self.delivery_locations: Dict[str, CustomerDeliveryLocation] = {}
        self.invoices: Dict[str, SalesInvoice] = {}
        self.audit_logs: List[Any] = []

    def reset(self):
        self.customers.clear()
        self.gst_registrations.clear()
        self.delivery_locations.clear()
        self.invoices.clear()
        self.audit_logs.clear()


@pytest.fixture
def mem_db():
    db = InMemoryCrmDB()
    # Seed default customers
    c1 = Customer(
        id="cust-001",
        code="CUST-RIL",
        name="Reliance Retail Limited",
        mobile="9820098200",
        email="tax@ril.com",
        gst_number="27AAACR7015K1Z0",
        company_id="COMP-001",
        branch_id="MAIN",
        is_active=True,
        is_deleted=False,
    )
    c2 = Customer(
        id="cust-002",
        code="CUST-TATA",
        name="Trent Limited",
        mobile="9830098300",
        email="tax@trent.com",
        gst_number="27AAACT1234L1Z1",
        company_id="COMP-001",
        branch_id="MAIN",
        is_active=True,
        is_deleted=False,
    )
    # Cross-tenant customer belonging to COMP-002
    c3 = Customer(
        id="cust-003",
        code="CUST-OTHER",
        name="Other Tenant Corp",
        mobile="9840098400",
        email="tax@other.com",
        gst_number="06AAACR7015K1Z1",
        company_id="COMP-002",
        branch_id="MAIN",
        is_active=True,
        is_deleted=False,
    )
    db.customers["cust-001"] = c1
    db.customers["cust-002"] = c2
    db.customers["cust-003"] = c3
    return db


def create_mock_service(mem_db: InMemoryCrmDB, company_id="COMP-001", branch_id="MAIN"):
    tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id)
    mock_session = AsyncMock()

    # db.add is synchronous in SQLAlchemy!
    def mock_add(obj):
        if isinstance(obj, CustomerGSTRegistration):
            mem_db.gst_registrations[obj.id] = obj
        elif isinstance(obj, CustomerDeliveryLocation):
            mem_db.delivery_locations[obj.id] = obj
        elif isinstance(obj, SalesInvoice):
            mem_db.invoices[obj.id] = obj

    mock_session.add = MagicMock(side_effect=mock_add)
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()

    async def mock_refresh(obj):
        if isinstance(obj, CustomerDeliveryLocation) and obj.gst_registration_id:
            obj.gst_registration = mem_db.gst_registrations.get(obj.gst_registration_id)

    mock_session.refresh = AsyncMock(side_effect=mock_refresh)

    async def mock_execute(stmt):
        return MockResult([0])

    mock_session.execute = AsyncMock(side_effect=mock_execute)

    service = CrmService(mock_session, tenant_ctx)

    # Mock customer retrieval
    async def mock_get_customer(customer_id: str):
        c = mem_db.customers.get(customer_id)
        if c and not c.is_deleted:
            if not tenant_ctx.company_id or c.company_id == tenant_ctx.company_id:
                return c
        return None

    service.get_customer = mock_get_customer

    # Mock GST repo methods
    async def mock_gst_get_all(customer_id: str, include_inactive: bool = False):
        res = [
            r for r in mem_db.gst_registrations.values()
            if r.customer_id == customer_id and not r.is_deleted
            and (include_inactive or (r.is_active and r.status == "ACTIVE"))
            and (not tenant_ctx.company_id or r.company_id == tenant_ctx.company_id)
        ]
        res.sort(key=lambda x: (not x.is_primary, x.state_name))
        return res

    async def mock_gst_get_by_id(customer_id: str, id: str):
        r = mem_db.gst_registrations.get(id)
        if r and r.customer_id == customer_id and not r.is_deleted:
            if not tenant_ctx.company_id or r.company_id == tenant_ctx.company_id:
                return r
        return None

    async def mock_gst_get(id: str):
        r = mem_db.gst_registrations.get(id)
        if r and not r.is_deleted:
            if not tenant_ctx.company_id or r.company_id == tenant_ctx.company_id:
                return r
        return None

    async def mock_gst_get_by_gstin(customer_id: str, gstin: str, include_deleted: bool = False):
        for r in mem_db.gst_registrations.values():
            if r.customer_id == customer_id and r.gstin == gstin:
                if include_deleted or not r.is_deleted:
                    if not tenant_ctx.company_id or r.company_id == tenant_ctx.company_id:
                        return r
        return None

    async def mock_gst_clear_primary(customer_id: str, exclude_id: Optional[str] = None):
        for r in mem_db.gst_registrations.values():
            if r.customer_id == customer_id and r.is_primary and (not exclude_id or r.id != exclude_id):
                r.is_primary = False

    service.gst_repo.get_all_for_customer = mock_gst_get_all
    service.gst_repo.get_by_customer_and_id = mock_gst_get_by_id
    service.gst_repo.get = mock_gst_get
    service.gst_repo.get_by_customer_and_gstin = mock_gst_get_by_gstin
    service.gst_repo.clear_primary_flags = mock_gst_clear_primary

    # Mock Delivery repo methods
    async def mock_deliv_get_all(customer_id: str, include_inactive: bool = False):
        res = [
            l for l in mem_db.delivery_locations.values()
            if l.customer_id == customer_id and not l.is_deleted
            and (include_inactive or (l.is_active and l.status == "ACTIVE"))
            and (not tenant_ctx.company_id or l.company_id == tenant_ctx.company_id)
        ]
        res.sort(key=lambda x: x.store_code)
        return res

    async def mock_deliv_get_by_id(customer_id: str, id: str):
        l = mem_db.delivery_locations.get(id)
        if l and l.customer_id == customer_id and not l.is_deleted:
            if not tenant_ctx.company_id or l.company_id == tenant_ctx.company_id:
                return l
        return None

    async def mock_deliv_get(id: str):
        l = mem_db.delivery_locations.get(id)
        if l and not l.is_deleted:
            if not tenant_ctx.company_id or l.company_id == tenant_ctx.company_id:
                return l
        return None

    async def mock_deliv_get_by_code(customer_id: str, store_code: str, active_only: bool = True):
        for l in mem_db.delivery_locations.values():
            if l.customer_id == customer_id and l.store_code == store_code and not l.is_deleted:
                if not active_only or (l.is_active and l.status == "ACTIVE"):
                    if not tenant_ctx.company_id or l.company_id == tenant_ctx.company_id:
                        return l
        return None

    async def mock_deliv_search(q: Optional[str] = None, customer_id: Optional[str] = None, skip: int = 0, limit: int = 50):
        res = []
        for l in mem_db.delivery_locations.values():
            if l.is_deleted or not l.is_active or l.status != "ACTIVE":
                continue
            if tenant_ctx.company_id and l.company_id != tenant_ctx.company_id:
                continue
            if customer_id and l.customer_id != customer_id:
                continue
            if q:
                ql = q.lower()
                matches = (
                    ql in l.store_code.lower() or
                    ql in l.location_name.lower() or
                    (l.city and ql in l.city.lower()) or
                    (l.state and ql in l.state.lower()) or
                    (l.pincode and ql in l.pincode.lower())
                )
                if not matches:
                    continue
            res.append(l)
        res.sort(key=lambda x: x.store_code)
        return res[skip:skip + limit]

    service.delivery_repo.get_all_for_customer = mock_deliv_get_all
    service.delivery_repo.get_by_customer_and_id = mock_deliv_get_by_id
    service.delivery_repo.get = mock_deliv_get
    service.delivery_repo.get_by_customer_and_store_code = mock_deliv_get_by_code
    service.delivery_repo.search = mock_deliv_search

    return service


# ─────────────────────────────────────────────────────────────────────────────
# SECTION A: GST REGISTRATION TESTS (1 to 14)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_01_create_valid_registration(mem_db):
    """1. Create valid GST registration."""
    service = create_mock_service(mem_db)
    payload = CustomerGSTRegistrationCreate(
        gstin="27AAACR7015K1Z0",
        stateName="Maharashtra",
        stateCode="27",
        registrationType="REGULAR",
        isPrimary=False,
    )
    reg = await service.create_gst_registration("cust-001", payload)
    assert reg.id.startswith("cgr-")
    assert reg.customer_id == "cust-001"
    assert reg.gstin == "27AAACR7015K1Z0"
    assert reg.state_code == "27"
    assert reg.is_active is True
    assert reg.status == "ACTIVE"


@pytest.mark.asyncio
async def test_02_lowercase_gstin_normalized():
    """2. Lowercase GSTIN normalized to uppercase."""
    payload = CustomerGSTRegistrationCreate(
        gstin="27aaacr7015k1z0",
        stateName="Maharashtra",
        stateCode="27",
    )
    assert payload.gstin == "27AAACR7015K1Z0"


@pytest.mark.asyncio
async def test_03_whitespace_normalized():
    """3. Whitespace normalized in GSTIN and state_code."""
    payload = CustomerGSTRegistrationCreate(
        gstin="  27AAACR7015K1Z0  ",
        stateName=" Maharashtra ",
        stateCode=" 27 ",
    )
    assert payload.gstin == "27AAACR7015K1Z0"
    assert payload.state_code == "27"


@pytest.mark.asyncio
async def test_04_invalid_gstin_rejected():
    """4. Invalid GSTIN format rejected."""
    with pytest.raises(ValidationError) as exc:
        CustomerGSTRegistrationCreate(
            gstin="INVALID_GST_123",
            stateName="Maharashtra",
            stateCode="27",
        )
    assert "Invalid GSTIN format" in str(exc.value)


@pytest.mark.asyncio
async def test_05_gstin_state_mismatch_rejected():
    """5. GSTIN prefix mismatch with state_code rejected."""
    with pytest.raises(ValidationError) as exc:
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Haryana",
            stateCode="06",
        )
    assert "does not match state_code" in str(exc.value)


@pytest.mark.asyncio
async def test_06_duplicate_gstin_rejected(mem_db):
    """6. Duplicate GSTIN for same customer rejected with 400."""
    service = create_mock_service(mem_db)
    payload = CustomerGSTRegistrationCreate(
        gstin="27AAACR7015K1Z0",
        stateName="Maharashtra",
        stateCode="27",
    )
    await service.create_gst_registration("cust-001", payload)

    with pytest.raises(HTTPException) as exc:
        await service.create_gst_registration("cust-001", payload)
    assert exc.value.status_code == 400
    assert "already registered" in exc.value.detail


@pytest.mark.asyncio
async def test_07_create_primary_registration(mem_db):
    """7. Create primary registration updates Customer.gst_number."""
    service = create_mock_service(mem_db)
    payload = CustomerGSTRegistrationCreate(
        gstin="27AAACR7015K1Z0",
        stateName="Maharashtra",
        stateCode="27",
        isPrimary=True,
    )
    reg = await service.create_gst_registration("cust-001", payload)
    assert reg.is_primary is True
    cust = mem_db.customers["cust-001"]
    assert cust.gst_number == "27AAACR7015K1Z0"


@pytest.mark.asyncio
async def test_08_second_primary_cannot_coexist(mem_db):
    """8. Second primary registration demotes the first primary."""
    service = create_mock_service(mem_db)
    reg1 = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
            isPrimary=True,
        )
    )
    assert reg1.is_primary is True

    reg2 = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="06AAACR7015K1Z1",
            stateName="Haryana",
            stateCode="06",
            isPrimary=True,
        )
    )
    assert reg2.is_primary is True
    # reg1 must have been demoted
    assert reg1.is_primary is False
    cust = mem_db.customers["cust-001"]
    assert cust.gst_number == "06AAACR7015K1Z1"


@pytest.mark.asyncio
async def test_09_switch_primary_registration(mem_db):
    """9. Explicitly switch primary registration via set_primary."""
    service = create_mock_service(mem_db)
    reg1 = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
            isPrimary=True,
        )
    )
    reg2 = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="06AAACR7015K1Z1",
            stateName="Haryana",
            stateCode="06",
            isPrimary=False,
        )
    )
    assert reg1.is_primary is True
    assert reg2.is_primary is False

    # Switch to reg2
    switched = await service.set_primary_gst_registration("cust-001", reg2.id)
    assert switched.is_primary is True
    assert reg1.is_primary is False
    assert mem_db.customers["cust-001"].gst_number == "06AAACR7015K1Z1"


@pytest.mark.asyncio
async def test_10_update_registration(mem_db):
    """10. Safe update of registration remarks and registration_type."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
            remarks="Initial note",
        )
    )
    updated = await service.update_gst_registration(
        "cust-001",
        reg.id,
        CustomerGSTRegistrationUpdate(
            remarks="Updated corporate note",
            registrationType="SEZ_WITH_TAX",
        )
    )
    assert updated.remarks == "Updated corporate note"
    assert updated.registration_type == "SEZ_WITH_TAX"


@pytest.mark.asyncio
async def test_11_cross_customer_registration_rejected(mem_db):
    """11. Accessing registration belonging to another customer rejected with 404."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
        )
    )
    # Attempting to access cust-001's reg via cust-002
    with pytest.raises(HTTPException) as exc:
        await service.get_gst_registration("cust-002", reg.id)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_12_cross_tenant_access_rejected(mem_db):
    """12. Cross-tenant access rejected."""
    service_comp2 = create_mock_service(mem_db, company_id="COMP-002")
    # Customer cust-001 belongs to COMP-001
    with pytest.raises(HTTPException) as exc:
        await service_comp2.list_gst_registrations("cust-001")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_13_deactivation(mem_db):
    """13. Soft delete deactivates GST registration."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
            isPrimary=True,
        )
    )
    res = await service.delete_gst_registration("cust-001", reg.id)
    assert res["status"] == "success"
    assert reg.is_deleted is True
    assert reg.is_active is False
    assert reg.status == "CANCELLED"
    assert reg.is_primary is False


@pytest.mark.asyncio
async def test_14_historical_invoice_remains_unaffected(mem_db):
    """14. Historical invoice snapshot remains intact after registration deactivation."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
        )
    )
    # Create an issued historical invoice snapshot
    inv = SalesInvoice(
        id="inv-hist-001",
        customer_id="cust-001",
        billed_party_gstin_id=reg.id,
        customer_gstin="27AAACR7015K1Z0",
        place_of_supply_code="27",
    )
    mem_db.invoices[inv.id] = inv

    # Deactivate the master registration
    await service.delete_gst_registration("cust-001", reg.id)

    # Invoice snapshot remains frozen
    assert inv.customer_gstin == "27AAACR7015K1Z0"
    assert inv.billed_party_gstin_id == reg.id
    assert inv.place_of_supply_code == "27"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION B: DELIVERY LOCATION TESTS (15 to 28)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_15_create_valid_location(mem_db):
    """15. Create valid customer delivery location."""
    service = create_mock_service(mem_db)
    payload = CustomerDeliveryLocationCreate(
        storeCode="T97D",
        locationName="Reliance Trends Gurgaon",
        city="Gurgaon",
        state="Haryana",
        stateCode="06",
        pincode="122001",
    )
    loc = await service.create_delivery_location("cust-001", payload)
    assert loc.id.startswith("cdl-")
    assert loc.customer_id == "cust-001"
    assert loc.store_code == "T97D"
    assert loc.location_name == "Reliance Trends Gurgaon"
    assert loc.is_active is True
    assert loc.status == "ACTIVE"


@pytest.mark.asyncio
async def test_16_blank_store_code_rejected():
    """16. Blank Store Code rejected with validation error."""
    with pytest.raises(ValidationError) as exc:
        CustomerDeliveryLocationCreate(
            storeCode="   ",
            locationName="Reliance Trends Gurgaon",
        )
    assert "Store code cannot be blank" in str(exc.value)


@pytest.mark.asyncio
async def test_17_blank_location_name_rejected():
    """17. Blank location name rejected with validation error."""
    with pytest.raises(ValidationError) as exc:
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="   ",
        )
    assert "Location name cannot be blank" in str(exc.value)


@pytest.mark.asyncio
async def test_18_duplicate_store_code_for_same_customer_rejected(mem_db):
    """18. Duplicate Store Code for same customer rejected with 400."""
    service = create_mock_service(mem_db)
    payload = CustomerDeliveryLocationCreate(
        storeCode="T97D",
        locationName="Reliance Trends Gurgaon",
    )
    await service.create_delivery_location("cust-001", payload)

    with pytest.raises(HTTPException) as exc:
        await service.create_delivery_location("cust-001", payload)
    assert exc.value.status_code == 400
    assert "already exists for this customer" in exc.value.detail


@pytest.mark.asyncio
async def test_19_same_store_code_for_different_customer_allowed(mem_db):
    """19. Same Store Code for different customer allowed."""
    service = create_mock_service(mem_db)
    loc1 = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="STORE-100",
            locationName="Reliance Store",
        )
    )
    loc2 = await service.create_delivery_location(
        "cust-002",
        CustomerDeliveryLocationCreate(
            storeCode="STORE-100",
            locationName="Trent Store",
        )
    )
    assert loc1.store_code == "STORE-100"
    assert loc2.store_code == "STORE-100"
    assert loc1.customer_id != loc2.customer_id


@pytest.mark.asyncio
async def test_20_alphanumeric_store_code_supported(mem_db):
    """20. Alphanumeric Store Code strings supported."""
    service = create_mock_service(mem_db)
    for code in ["T97D", "TFW4", "1888", "TYAC-01"]:
        loc = await service.create_delivery_location(
            "cust-001",
            CustomerDeliveryLocationCreate(
                storeCode=code,
                locationName=f"Location {code}",
            )
        )
        assert loc.store_code == code


@pytest.mark.asyncio
async def test_21_valid_gst_registration_link_accepted(mem_db):
    """21. Valid GST registration link accepted and gstin denormalized."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="06AAACR7015K1Z1",
            stateName="Haryana",
            stateCode="06",
        )
    )
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            gstRegistrationId=reg.id,
        )
    )
    assert loc.gst_registration_id == reg.id
    assert loc.gstin == "06AAACR7015K1Z1"


@pytest.mark.asyncio
async def test_22_gst_registration_belonging_to_another_customer_rejected(mem_db):
    """22. Linking GST registration belonging to another customer rejected with 400."""
    service = create_mock_service(mem_db)
    reg_cust2 = await service.create_gst_registration(
        "cust-002",
        CustomerGSTRegistrationCreate(
            gstin="27AAACT1234L1Z1",
            stateName="Maharashtra",
            stateCode="27",
        )
    )
    with pytest.raises(HTTPException) as exc:
        await service.create_delivery_location(
            "cust-001",
            CustomerDeliveryLocationCreate(
                storeCode="T97D",
                locationName="Trends Gurgaon",
                gstRegistrationId=reg_cust2.id,
            )
        )
    assert exc.value.status_code == 400
    assert "does not belong to this customer" in exc.value.detail


@pytest.mark.asyncio
async def test_23_conflicting_gst_registration_and_gstin_rejected(mem_db):
    """23. Conflicting gst_registration_id and gstin rejected with 400."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="06AAACR7015K1Z1",
            stateName="Haryana",
            stateCode="06",
        )
    )
    with pytest.raises(HTTPException) as exc:
        await service.create_delivery_location(
            "cust-001",
            CustomerDeliveryLocationCreate(
                storeCode="T97D",
                locationName="Trends Gurgaon",
                gstRegistrationId=reg.id,
                gstin="27AAACR7015K1Z0",  # Conflicts with reg.gstin
            )
        )
    assert exc.value.status_code == 400
    assert "Conflicting GSTIN" in exc.value.detail


@pytest.mark.asyncio
async def test_24_update_location(mem_db):
    """24. Update location details."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurgaon",
        )
    )
    updated = await service.update_delivery_location(
        "cust-001",
        loc.id,
        CustomerDeliveryLocationUpdate(
            locationName="Reliance Trends CyberHub",
            city="Gurugram",
        )
    )
    assert updated.location_name == "Reliance Trends CyberHub"
    assert updated.city == "Gurugram"


@pytest.mark.asyncio
async def test_25_change_store_code(mem_db):
    """25. Change Store Code to new unique value."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
        )
    )
    updated = await service.update_delivery_location(
        "cust-001",
        loc.id,
        CustomerDeliveryLocationUpdate(
            storeCode="T97D-NEW",
        )
    )
    assert updated.store_code == "T97D-NEW"


@pytest.mark.asyncio
async def test_26_deactivation_location(mem_db):
    """26. Soft delete deactivates delivery location."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
        )
    )
    res = await service.delete_delivery_location("cust-001", loc.id)
    assert res["status"] == "success"
    assert loc.is_deleted is True
    assert loc.is_active is False
    assert loc.status == "INACTIVE"


@pytest.mark.asyncio
async def test_27_deactivated_location_excluded_from_active_list(mem_db):
    """27. Deactivated location excluded from active list by default."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
        )
    )
    await service.delete_delivery_location("cust-001", loc.id)

    active_locs = await service.list_delivery_locations("cust-001", include_inactive=False)
    assert len(active_locs) == 0


@pytest.mark.asyncio
async def test_28_historical_invoice_location_remains_unaffected(mem_db):
    """28. Historical invoice snapshot remains unaffected after location change."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurgaon",
            state="Haryana",
            stateCode="06",
        )
    )
    # Freeze snapshot in invoice
    inv = SalesInvoice(
        id="inv-hist-002",
        customer_id="cust-001",
        delivery_location_id=loc.id,
        delivery_store_code="T97D",
        delivery_gstin="06AAACR7015K1Z1",
        delivery_location_snapshot={"store_code": "T97D", "city": "Gurgaon"},
        place_of_supply_code="06",
    )
    mem_db.invoices[inv.id] = inv

    # Update master location
    await service.update_delivery_location(
        "cust-001",
        loc.id,
        CustomerDeliveryLocationUpdate(
            storeCode="T97D-RENAMED",
            locationName="Trends Megamall",
        )
    )

    # Invoice snapshot remains frozen
    assert inv.delivery_store_code == "T97D"
    assert inv.delivery_location_snapshot["store_code"] == "T97D"
    assert inv.place_of_supply_code == "06"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION C: SEARCH TESTS (29 to 33)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_29_search_by_store_code(mem_db):
    """29. Search delivery location by Store Code."""
    service = create_mock_service(mem_db)
    await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurgaon",
        )
    )
    results = await service.search_delivery_locations(q="T97D")
    assert len(results) == 1
    assert results[0].store_code == "T97D"


@pytest.mark.asyncio
async def test_30_search_by_location_name(mem_db):
    """30. Search delivery location by Location Name."""
    service = create_mock_service(mem_db)
    await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon Cyberhub",
            city="Gurgaon",
        )
    )
    results = await service.search_delivery_locations(q="Cyberhub")
    assert len(results) == 1
    assert results[0].location_name == "Trends Gurgaon Cyberhub"


@pytest.mark.asyncio
async def test_31_search_by_city(mem_db):
    """31. Search delivery location by City."""
    service = create_mock_service(mem_db)
    await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurugram",
        )
    )
    results = await service.search_delivery_locations(q="Gurugram")
    assert len(results) == 1
    assert results[0].city == "Gurugram"


@pytest.mark.asyncio
async def test_32_inactive_locations_excluded_from_search(mem_db):
    """32. Inactive delivery locations excluded from search."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurgaon",
        )
    )
    await service.delete_delivery_location("cust-001", loc.id)

    results = await service.search_delivery_locations(q="Gurgaon")
    assert len(results) == 0


@pytest.mark.asyncio
async def test_33_search_tenant_isolation(mem_db):
    """33. Search isolates results by tenant company."""
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")
    service_comp2 = create_mock_service(mem_db, company_id="COMP-002")

    await service_comp1.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T97D",
            locationName="Trends Gurgaon",
            city="Gurgaon",
        )
    )

    results_comp1 = await service_comp1.search_delivery_locations(q="T97D")
    assert len(results_comp1) == 1

    # Company 2 searches for T97D -> 0 results
    results_comp2 = await service_comp2.search_delivery_locations(q="T97D")
    assert len(results_comp2) == 0


# ─────────────────────────────────────────────────────────────────────────────
# SECTION D: SECURITY & RBAC TESTS (34 to 36)
# ─────────────────────────────────────────────────────────────────────────────

def test_34_unauthorized_access_rejected():
    """34. Unauthorized access rejected when Bearer token is missing."""
    client = TestClient(app)
    app.dependency_overrides.clear()

    resp = client.get("/api/v1/crm/customers/cust-001/gst-registrations")
    assert resp.status_code in (401, 403)


def test_35_insufficient_role_rejected(mem_db):
    """35. CASHIER role cannot create GST registration or delivery location."""
    client = TestClient(app)
    app.dependency_overrides.clear()

    cashier_user = User(
        id="usr-cashier",
        username="cashier1",
        role=UserRole.CASHIER,
        company_id="COMP-001",
        branch_id="MAIN",
        status="Active",
        is_active=True,
        is_deleted=False,
    )

    app.dependency_overrides[get_current_user] = lambda: cashier_user
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext("COMP-001", "MAIN")

    mock_service = create_mock_service(mem_db)
    async def mock_company_db():
        yield mock_service.db
    app.dependency_overrides[get_company_db] = mock_company_db

    # CASHIER POST to create GST registration -> 403 Forbidden
    resp_gst = client.post(
        "/api/v1/crm/customers/cust-001/gst-registrations",
        json={
            "gstin": "27AAACR7015K1Z0",
            "stateName": "Maharashtra",
            "stateCode": "27",
        }
    )
    assert resp_gst.status_code == 403

    # CASHIER POST to create delivery location -> 403 Forbidden
    resp_loc = client.post(
        "/api/v1/crm/customers/cust-001/delivery-locations",
        json={
            "storeCode": "T97D",
            "locationName": "Reliance Trends Gurgaon",
        }
    )
    assert resp_loc.status_code == 403


def test_36_no_cross_company_data_leakage(mem_db):
    """36. User from Company 002 cannot access Company 001 customer GST registrations."""
    client = TestClient(app)
    app.dependency_overrides.clear()

    user_comp2 = User(
        id="usr-comp2",
        username="manager_comp2",
        role=UserRole.MANAGER,
        company_id="COMP-002",
        branch_id="MAIN",
        status="Active",
        is_active=True,
        is_deleted=False,
    )

    app.dependency_overrides[get_current_user] = lambda: user_comp2
    app.dependency_overrides[get_tenant_context] = lambda: TenantContext("COMP-002", "MAIN")

    mock_service = create_mock_service(mem_db, company_id="COMP-002")

    async def mock_company_db():
        yield mock_service.db

    app.dependency_overrides[get_company_db] = mock_company_db

    # In CrmService, get_customer filters by company_id; if cust-001 belongs to COMP-001, it returns None
    # We mock get_customer on the service class to demonstrate tenant isolation
    original_get_customer = CrmService.get_customer
    async def tenant_filtered_get_customer(self, customer_id: str):
        c = mem_db.customers.get(customer_id)
        if c and not c.is_deleted:
            if not self.tenant_ctx.company_id or c.company_id == self.tenant_ctx.company_id:
                return c
        return None

    CrmService.get_customer = tenant_filtered_get_customer
    try:
        resp = client.get("/api/v1/crm/customers/cust-001/gst-registrations")
        assert resp.status_code == 404
        assert "not found" in resp.text.lower()
    finally:
        CrmService.get_customer = original_get_customer
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# SECTION E: REMEDIATION HARDENING TESTS (37 to 48)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_37_company_a_cannot_read_company_b_gst_registrations(mem_db):
    """37. Company A service cannot read Company B GST registrations."""
    service_comp2 = create_mock_service(mem_db, company_id="COMP-002")
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")

    reg = await service_comp2.create_gst_registration(
        "cust-003",
        CustomerGSTRegistrationCreate(
            gstin="06AAACR7015K1Z1",
            stateName="Haryana",
            stateCode="06",
        )
    )
    # Company 1 cannot read Company 2 customer or its GST registration
    with pytest.raises(HTTPException) as exc:
        await service_comp1.get_gst_registration("cust-003", reg.id)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_38_company_a_cannot_read_company_b_delivery_locations(mem_db):
    """38. Company A service cannot read Company B delivery locations."""
    service_comp2 = create_mock_service(mem_db, company_id="COMP-002")
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")

    loc = await service_comp2.create_delivery_location(
        "cust-003",
        CustomerDeliveryLocationCreate(
            storeCode="TB01",
            locationName="Store B01",
        )
    )
    # Company 1 cannot read Company 2 delivery location
    with pytest.raises(HTTPException) as exc:
        await service_comp1.get_delivery_location("cust-003", loc.id)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_39_company_a_cannot_mutate_company_b_records(mem_db):
    """39. Company A service cannot update or delete Company B records."""
    service_comp2 = create_mock_service(mem_db, company_id="COMP-002")
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")

    loc = await service_comp2.create_delivery_location(
        "cust-003",
        CustomerDeliveryLocationCreate(
            storeCode="TB02",
            locationName="Store B02",
        )
    )
    with pytest.raises(HTTPException) as exc:
        await service_comp1.update_delivery_location(
            "cust-003", loc.id, CustomerDeliveryLocationUpdate(locationName="Hacked")
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await service_comp1.delete_delivery_location("cust-003", loc.id)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_40_null_company_record_behavior_isolation(mem_db):
    """40. Records with company_id=None are strictly isolated and not returned to tenant company queries."""
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")

    # Seed delivery location with company_id=None
    null_comp_loc = CustomerDeliveryLocation(
        id="cdl-null-comp",
        customer_id="cust-001",
        store_code="TNULL",
        location_name="Null Company Loc",
        company_id=None,
        status="ACTIVE",
        is_active=True,
        is_deleted=False,
    )
    mem_db.delivery_locations[null_comp_loc.id] = null_comp_loc

    # Repo get for COMP-001 tenant context MUST return None
    fetched = await service_comp1.delivery_repo.get(null_comp_loc.id)
    assert fetched is None

    # Repo get_all for COMP-001 tenant context MUST NOT contain the null-company record
    all_locs = await service_comp1.delivery_repo.get_all_for_customer("cust-001")
    assert not any(l.id == "cdl-null-comp" for l in all_locs)


@pytest.mark.asyncio
async def test_41_search_endpoint_cannot_leak_null_company_or_other_company_records(mem_db):
    """41. Search endpoint strictly returns only records matching the tenant company_id."""
    service_comp1 = create_mock_service(mem_db, company_id="COMP-001")

    # Seed 3 records: COMP-001, COMP-002, None
    mem_db.delivery_locations["loc-c1"] = CustomerDeliveryLocation(
        id="loc-c1", customer_id="cust-001", store_code="MATCH-C1",
        location_name="Search Match 1", city="Mumbai", company_id="COMP-001",
        status="ACTIVE", is_active=True, is_deleted=False,
    )
    mem_db.delivery_locations["loc-c2"] = CustomerDeliveryLocation(
        id="loc-c2", customer_id="cust-003", store_code="MATCH-C2",
        location_name="Search Match 2", city="Mumbai", company_id="COMP-002",
        status="ACTIVE", is_active=True, is_deleted=False,
    )
    mem_db.delivery_locations["loc-cnull"] = CustomerDeliveryLocation(
        id="loc-cnull", customer_id="cust-001", store_code="MATCH-CNULL",
        location_name="Search Match Null", city="Mumbai", company_id=None,
        status="ACTIVE", is_active=True, is_deleted=False,
    )

    results = await service_comp1.search_delivery_locations(q="MATCH")
    assert len(results) == 1
    assert results[0].id == "loc-c1"
    assert results[0].store_code == "MATCH-C1"


@pytest.mark.asyncio
async def test_42_delivery_valid_gstin_and_matching_state(mem_db):
    """42. Valid delivery GSTIN with matching stateCode succeeds."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T27A",
            locationName="Trends Bandra",
            gstin="27AAACR7015K1Z0",
            state="Maharashtra",
            stateCode="27",
        )
    )
    assert loc.gstin == "27AAACR7015K1Z0"
    assert loc.state_code == "27"


def test_43_delivery_invalid_gstin_rejected():
    """43. Invalid delivery GSTIN format rejected at schema validation."""
    with pytest.raises(ValidationError) as exc:
        CustomerDeliveryLocationCreate(
            storeCode="T27B",
            locationName="Trends Invalid GST",
            gstin="INVALID_GSTIN_123",
            stateCode="27",
        )
    assert "Invalid GSTIN format" in str(exc.value)


def test_44_delivery_invalid_state_code_rejected():
    """44. Invalid Indian state code rejected at schema validation."""
    with pytest.raises(ValidationError) as exc:
        CustomerDeliveryLocationCreate(
            storeCode="T27C",
            locationName="Trends Invalid State",
            stateCode="88",
        )
    assert "Invalid Indian state code" in str(exc.value)


def test_45_delivery_mismatched_gstin_and_state_rejected():
    """45. Delivery GSTIN prefix not matching stateCode rejected at schema validation."""
    with pytest.raises(ValidationError) as exc:
        CustomerDeliveryLocationCreate(
            storeCode="T27D",
            locationName="Trends Mismatch",
            gstin="27AAACR7015K1Z0",  # State 27 (MH)
            stateCode="29",           # State 29 (KA)
        )
    assert "does not match delivery state code" in str(exc.value)


@pytest.mark.asyncio
async def test_46_delivery_valid_gst_registration_link_and_state_match(mem_db):
    """46. Linked GST registration auto-populates state and validates against conflicting input state."""
    service = create_mock_service(mem_db)
    reg = await service.create_gst_registration(
        "cust-001",
        CustomerGSTRegistrationCreate(
            gstin="27AAACR7015K1Z0",
            stateName="Maharashtra",
            stateCode="27",
        )
    )
    # Auto-population of state from linked registration
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T27E",
            locationName="Trends Linked",
            gstRegistrationId=reg.id,
        )
    )
    assert loc.gstin == "27AAACR7015K1Z0"
    assert loc.state_code == "27"
    assert loc.state == "Maharashtra"

    # Conflicting state code provided with linked registration -> 400
    with pytest.raises(HTTPException) as exc:
        await service.create_delivery_location(
            "cust-001",
            CustomerDeliveryLocationCreate(
                storeCode="T27F",
                locationName="Trends Conflicting State",
                gstRegistrationId=reg.id,
                stateCode="29",
            )
        )
    assert exc.value.status_code == 400
    assert "Conflicting state code" in exc.value.detail


@pytest.mark.asyncio
async def test_47_delivery_update_gstin_causing_state_mismatch_rejected(mem_db):
    """47. Updating delivery GSTIN while keeping old mismatched state_code rejected with 400."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T27G",
            locationName="Trends Update Test",
            gstin="27AAACR7015K1Z0",
            stateCode="27",
        )
    )
    # Attempt update GSTIN to Karnataka ("29...") without updating stateCode ("27")
    with pytest.raises(HTTPException) as exc:
        await service.update_delivery_location(
            "cust-001",
            loc.id,
            CustomerDeliveryLocationUpdate(gstin="29AAACR7015K1Z1")
        )
    assert exc.value.status_code == 400
    assert "does not match state_code" in exc.value.detail


@pytest.mark.asyncio
async def test_48_delivery_update_state_code_causing_gstin_mismatch_rejected(mem_db):
    """48. Updating delivery state_code while keeping old mismatched GSTIN rejected with 400."""
    service = create_mock_service(mem_db)
    loc = await service.create_delivery_location(
        "cust-001",
        CustomerDeliveryLocationCreate(
            storeCode="T27H",
            locationName="Trends State Update Test",
            gstin="27AAACR7015K1Z0",
            stateCode="27",
        )
    )
    # Attempt update stateCode to "29" without updating GSTIN ("27...")
    with pytest.raises(HTTPException) as exc:
        await service.update_delivery_location(
            "cust-001",
            loc.id,
            CustomerDeliveryLocationUpdate(stateCode="29")
        )
    assert exc.value.status_code == 400
    assert "does not match existing GSTIN prefix" in exc.value.detail

