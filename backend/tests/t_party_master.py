"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import uuid
from decimal import Decimal
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.db.session import get_company_sessionmaker
from app.services.party_master_svc import UniversalPartyMasterService
from app.schemas.party_master import (
    PartyCreateRequest,
    PartyAddressItem,
    PartyContactItem,
    CustomerProfileData,
    SupplierProfileData,
    PartyMergeRequest,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001",
    }


@pytest.mark.asyncio
async def test_create_party_with_multi_roles():
    """Verify atomic creation of a party holding Customer, Supplier, Dealer, and Transporter roles."""
    unique_suffix = uuid.uuid4().hex[:4]
    gstin = f"27AABCT{unique_suffix.upper()}1Z5"
    async with get_company_sessionmaker("smriti001")() as session:
        req = PartyCreateRequest(
            party_code=f"PTY-TEST-{unique_suffix.upper()}",
            party_type="ORGANIZATION",
            legal_name=f"Apex Logistics & Retail Ltd {unique_suffix}",
            trade_name=f"Apex Hub {unique_suffix}",
            gstin=gstin,
            phone=f"98200{unique_suffix}",
            email=f"apex_{unique_suffix}@example.com",
            city="Mumbai",
            state="Maharashtra",
            roles=["CUSTOMER", "SUPPLIER", "DEALER", "TRANSPORTER"],
            customer_profile=CustomerProfileData(
                customer_category="WHOLESALE",
                credit_limit=500000.0,
                credit_days=45,
                tax_category="B2B",
            ),
            supplier_profile=SupplierProfileData(
                supplier_type="DISTRIBUTOR",
                payment_terms_days=60,
                tax_treatment="REGISTERED_REGULAR",
            ),
            addresses=[
                PartyAddressItem(
                    address_type="BILLING",
                    address_line1="101 Nariman Point",
                    city="Mumbai",
                    state="Maharashtra",
                    state_code="27",
                    pincode="400021",
                    is_primary=True,
                )
            ],
            contacts=[
                PartyContactItem(
                    contact_name="Ramesh Sharma",
                    designation="Logistics Head",
                    phone=f"98200{unique_suffix}",
                    email=f"ramesh_{unique_suffix}@example.com",
                    is_primary=True,
                )
            ],
        )

        party = await UniversalPartyMasterService.create_party(session, req)
        assert party is not None
        assert party.id is not None
        assert party.gstin == gstin

        # Check assigned roles
        role_types = [r.role_type for r in party.roles if r.is_active]
        assert "CUSTOMER" in role_types
        assert "SUPPLIER" in role_types
        assert "DEALER" in role_types
        assert "TRANSPORTER" in role_types

        # Check profiles
        assert party.customer_profile is not None
        assert float(party.customer_profile.credit_limit) == 500000.0
        assert party.supplier_profile is not None
        assert party.supplier_profile.payment_terms_days == 60

        # Check addresses and contacts
        assert len(party.addresses) == 1
        assert party.addresses[0].city == "Mumbai"
        assert len(party.contacts) == 1
        assert party.contacts[0].contact_name == "Ramesh Sharma"


@pytest.mark.asyncio
async def test_find_party_by_identifiers_deduplication():
    """Verify deduplication resolution matching on GSTIN, phone, or email."""
    unique_suffix = uuid.uuid4().hex[:4]
    gstin = f"27AABCD{unique_suffix.upper()}1Z1"
    phone = f"99887{unique_suffix}"
    email = f"dedup_{unique_suffix}@test.com"

    async with get_company_sessionmaker("smriti001")() as session:
        req = PartyCreateRequest(
            party_code=f"PTY-DEDUP-{unique_suffix.upper()}",
            legal_name=f"Dedup Test Corp {unique_suffix}",
            gstin=gstin,
            phone=phone,
            email=email,
            roles=["CUSTOMER"],
        )
        party = await UniversalPartyMasterService.create_party(session, req)

        # Match by GSTIN
        found_by_gst = await UniversalPartyMasterService.find_party_by_identifiers(session, gstin=gstin)
        assert found_by_gst is not None
        assert found_by_gst.id == party.id

        # Match by Phone
        found_by_phone = await UniversalPartyMasterService.find_party_by_identifiers(session, phone=phone)
        assert found_by_phone is not None
        assert found_by_phone.id == party.id

        # Match by Email
        found_by_email = await UniversalPartyMasterService.find_party_by_identifiers(session, email=email)
        assert found_by_email is not None
        assert found_by_email.id == party.id


@pytest.mark.asyncio
async def test_add_and_toggle_party_role():
    """Verify adding dynamic roles (e.g. adding SALESMAN and EMPLOYEE)."""
    unique_suffix = uuid.uuid4().hex[:4]
    async with get_company_sessionmaker("smriti001")() as session:
        req = PartyCreateRequest(
            party_code=f"PTY-ROLE-{unique_suffix.upper()}",
            legal_name=f"Role Test Ltd {unique_suffix}",
            roles=["CUSTOMER"],
        )
        party = await UniversalPartyMasterService.create_party(session, req)

        # Add SALESMAN role
        role = await UniversalPartyMasterService.add_or_toggle_role(session, party.id, "SALESMAN", True)
        assert role.role_type == "SALESMAN"
        assert role.is_active is True

        # Re-fetch party and assert updated roles
        refetched = await UniversalPartyMasterService.get_party_by_id(session, party.id)
        role_types = [r.role_type for r in refetched.roles if r.is_active]
        assert "CUSTOMER" in role_types
        assert "SALESMAN" in role_types


@pytest.mark.asyncio
async def test_party_merge_policy_consolidation():
    """Verify party merge consolidates roles, profiles, addresses, and marks secondary as MERGED."""
    unique_suffix = uuid.uuid4().hex[:4]
    async with get_company_sessionmaker("smriti001")() as session:
        # Primary Party: Customer only
        primary_req = PartyCreateRequest(
            party_code=f"PTY-PRI-{unique_suffix.upper()}",
            legal_name=f"Primary Party {unique_suffix}",
            roles=["CUSTOMER"],
            customer_profile=CustomerProfileData(credit_limit=10000.0, outstanding_balance=500.0),
        )
        primary = await UniversalPartyMasterService.create_party(session, primary_req)

        # Secondary Party: Supplier only with address
        sec_req = PartyCreateRequest(
            party_code=f"PTY-SEC-{unique_suffix.upper()}",
            legal_name=f"Secondary Party {unique_suffix}",
            roles=["SUPPLIER"],
            supplier_profile=SupplierProfileData(supplier_type="MANUFACTURER", outstanding_liability=2000.0),
            addresses=[
                PartyAddressItem(
                    address_type="WAREHOUSE",
                    address_line1="Bhiwandi Godown",
                    city="Thane",
                    state="Maharashtra",
                    pincode="421302",
                )
            ],
        )
        secondary = await UniversalPartyMasterService.create_party(session, sec_req)

        # Merge secondary into primary
        merge_res = await UniversalPartyMasterService.merge_parties(
            session,
            PartyMergeRequest(
                primary_party_id=primary.id,
                secondary_party_id=secondary.id,
                merge_reason="DUPLICATE_FOUND",
            ),
        )
        assert merge_res.success is True
        assert "CUSTOMER" in merge_res.consolidated_roles
        assert "SUPPLIER" in merge_res.consolidated_roles

        # Assert secondary is marked MERGED
        sec_updated = await UniversalPartyMasterService.get_party_by_id(session, secondary.id)
        assert sec_updated.status == "MERGED"
        assert sec_updated.merged_into_party_id == primary.id

        # Assert primary has consolidated supplier profile and warehouse address
        pri_updated = await UniversalPartyMasterService.get_party_by_id(session, primary.id)
        assert pri_updated.supplier_profile is not None
        assert pri_updated.supplier_profile.supplier_type == "MANUFACTURER"
        assert len(pri_updated.addresses) == 1
        assert pri_updated.addresses[0].city == "Thane"


@pytest.mark.asyncio
async def test_legacy_customer_and_supplier_adapters():
    """Verify legacy Customer and Supplier compatibility adapters."""
    unique_suffix = uuid.uuid4().hex[:4]
    gstin = f"27XYZAB{unique_suffix.upper()}1Z9"
    async with get_company_sessionmaker("smriti001")() as session:
        req = PartyCreateRequest(
            party_code=f"PTY-ADAPT-{unique_suffix.upper()}",
            legal_name=f"Dual Role Partner {unique_suffix}",
            gstin=gstin,
            phone="9821098210",
            email=f"adapter_{unique_suffix}@smriti.com",
            city="Pune",
            state="Maharashtra",
            roles=["CUSTOMER", "SUPPLIER"],
            customer_profile=CustomerProfileData(credit_limit=75000.0, credit_days=30),
            supplier_profile=SupplierProfileData(payment_terms_days=45, supplier_type="TRADER"),
        )
        party = await UniversalPartyMasterService.create_party(session, req)

        # Customer Adapter View
        cust_view = await UniversalPartyMasterService.get_legacy_customer_view(session, party.id)
        assert cust_view is not None
        assert cust_view.credit_limit == 75000.0
        assert cust_view.gst_number == gstin
        assert cust_view.name == f"Dual Role Partner {unique_suffix}"

        # Supplier Adapter View
        supp_view = await UniversalPartyMasterService.get_legacy_supplier_view(session, party.id)
        assert supp_view is not None
        assert supp_view.payment_terms_days == 45
        assert supp_view.gstin == gstin
        assert supp_view.supplier_type == "TRADER"


@pytest.mark.asyncio
async def test_api_party_crud_and_search_endpoints():
    """Verify REST API endpoints for listing, creating, and fetching party details."""
    unique_suffix = uuid.uuid4().hex[:4]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Party via API
        create_res = await client.post(
            "/api/v1/universal/parties",
            json={
                "party_code": f"PTY-API-{unique_suffix.upper()}",
                "legal_name": f"API Test Enterprise {unique_suffix}",
                "party_type": "ORGANIZATION",
                "gstin": f"27AAAAA{unique_suffix.upper()}1Z2",
                "roles": ["CUSTOMER", "DEALER"],
                "city": "Nagpur",
                "state": "Maharashtra",
            },
            headers=_get_auth_headers(),
        )
        assert create_res.status_code == 201
        data = create_res.json()
        party_id = data["id"]
        assert data["legal_name"] == f"API Test Enterprise {unique_suffix}"

        # 2. Get Party Details via API
        get_res = await client.get(
            f"/api/v1/universal/parties/{party_id}",
            headers=_get_auth_headers(),
        )
        assert get_res.status_code == 200
        party_data = get_res.json()
        assert party_data["id"] == party_id
        assert len(party_data["roles"]) >= 2

        # 3. Search Parties with query filter
        search_res = await client.get(
            f"/api/v1/universal/parties?query={unique_suffix}",
            headers=_get_auth_headers(),
        )
        assert search_res.status_code == 200
        search_list = search_res.json()
        assert len(search_list) >= 1
        assert search_list[0]["id"] == party_id

        # 4. Fetch Legacy Customer Adapter
        adapter_res = await client.get(
            f"/api/v1/universal/parties/{party_id}/adapter/customer",
            headers=_get_auth_headers(),
        )
        assert adapter_res.status_code == 200
        cust_adapter = adapter_res.json()
        assert cust_adapter["id"] == party_id
        assert cust_adapter["name"] == f"API Test Enterprise {unique_suffix}"
