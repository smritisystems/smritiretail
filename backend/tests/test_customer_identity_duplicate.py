"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.26.0
 * Created      : 2026-09-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal

SMRITI Retail OS - Phase 2F Test Matrix
Authoritative Customer Identity & Duplicate Protection Test Suite (01 to 35)
"""

import asyncio
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import uuid
import random
import pytest
from datetime import datetime, date, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import select, func

os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-smriti"
os.environ["INTERNAL_SERVICE_KEY"] = "test-internal-key-smriti"
os.environ["SGIP_VAULT_MASTER_KEY"] = "test-vault-master-key-smriti-32chars"

from app.api.deps import TenantContext
from app.models.tenant import Company, Branch
from app.models.crm import (
    Customer, CustomerGroup, CustomerGSTRegistration,
    CustomerDeliveryLocation, CustomerBillingLocation, CustomerExternalIdentity,
)
from app.models.inventory import Product, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem
from app.schemas.crm import (
    CustomerCreate, CustomerUpdate,
    CustomerGSTRegistrationCreate, CustomerGSTRegistrationUpdate,
    CustomerDeliveryLocationCreate, CustomerDeliveryLocationUpdate,
    CustomerBillingLocationCreate, CustomerBillingLocationUpdate,
    CustomerExternalIdentityCreate,
    CustomerDuplicateCheckRequest, DuplicateDecision, MatchedIdentityType,
)
from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
from app.services.crm import CrmService
from app.services.sales import SalesService
from app.services.customer_identity import CustomerIdentityService

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_test_phase2c"
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

_gstin_seq = random.randint(1000, 5000)

def make_test_gstin(state_code: str = "27") -> str:
    global _gstin_seq
    _gstin_seq += 1
    return f"{state_code}AABCR{_gstin_seq:04d}A1Z5"


@pytest.fixture
def tenant_ctx() -> TenantContext:
    return TenantContext(company_id="COMP-001", branch_id="MAIN")


@pytest.fixture
def other_tenant_ctx() -> TenantContext:
    return TenantContext(company_id="COMP-OTHER", branch_id="OTHER-BR")


@pytest.fixture(autouse=True)
async def ensure_seed_companies_and_groups():
    async with TestSessionLocal() as session:
        for cid in ["COMP-001", "COMP-OTHER"]:
            c = await session.get(Company, cid)
            if not c:
                session.add(Company(
                    id=cid,
                    company_code=cid,
                    name=f"Company {cid}",
                    is_active=True,
                    is_deleted=False,
                    created_at=datetime.now(timezone.utc),
                    modified_at=datetime.now(timezone.utc)
                ))
        br = await session.get(Branch, "MAIN")
        if not br:
            session.add(Branch(
                id="MAIN", code="MAIN", name="Main Branch",
                company_id="COMP-001", is_active=True, is_deleted=False
            ))
        br_other = await session.get(Branch, "OTHER-BR")
        if not br_other:
            session.add(Branch(
                id="OTHER-BR", code="OTHER-BR", name="Other Branch",
                company_id="COMP-OTHER", is_active=True, is_deleted=False
            ))
        cg = await session.get(CustomerGroup, "CG-RETAIL")
        if not cg:
            session.add(CustomerGroup(
                id="CG-RETAIL", name="B2B Retail Test Group",
                company_id="COMP-001", credit_days=30, credit_limit=Decimal("50000.00"),
                is_deleted=False
            ))
        wh = await session.get(Warehouse, "WH-MAIN")
        if not wh:
            session.add(Warehouse(
                id="WH-MAIN", code="WH-TEST-MAIN", name="Main Test Warehouse",
                company_id="COMP-001", is_active=True, is_deleted=False
            ))
        p = await session.get(Product, "P-TEST-001")
        if not p:
            session.add(Product(
                id="P-TEST-001", code="P-TEST-001", name="Test Widget",
                price=Decimal("100.00"), mrp=Decimal("120.00"),
                category="General",
                barcode="BAR-P-TEST-001",
                company_id="COMP-001", tracking_mode="No-stock",
                is_active=True, is_deleted=False
            ))
        await session.commit()


# ===========================================================================
# 01. Unique Customer -> ALLOW
# ===========================================================================
@pytest.mark.asyncio
async def test_01_unique_customer_allow(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust_in = CustomerCreate(
            id=f"cust-u-{uid}",
            code=f"CODE-U-{uid}",
            name=f"Unique Customer {uid}",
            mobile=f"98{int(uid[:6], 16) % 90000000 + 10000000}",
            email=f"unique_{uid}@example.com",
            gst_number=make_test_gstin("27"),
            status="Active"
        )
        # Direct check
        chk = await service.identity_service.check_duplicate_customer(cust_in)
        assert chk.decision == DuplicateDecision.ALLOW

        # Creation succeeds
        created = await service.create_customer(cust_in)
        assert created.id == cust_in.id
        assert created.code == cust_in.code


# ===========================================================================
# 02. Existing Customer.id -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_02_existing_customer_id_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        first = await service.create_customer(CustomerCreate(
            id=f"cust-id-{uid}",
            code=f"CODE-ID-{uid}",
            name=f"ID Customer {uid}",
            status="Active"
        ))

        # Attempt to create customer with same ID
        duplicate_in = CustomerCreate(
            id=first.id,
            code=f"CODE-DIFF-{uid}",
            name=f"Another Customer {uid}",
            status="Active"
        )
        chk = await service.identity_service.check_duplicate_customer(duplicate_in)
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.CUSTOMER_ID

        with pytest.raises(HTTPException) as exc:
            await service.create_customer(duplicate_in)
        assert exc.value.status_code == 409


# ===========================================================================
# 03. Existing Customer.code same tenant -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_03_existing_customer_code_same_tenant_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        code = f"CODE-COLL-{uid}"
        await service.create_customer(CustomerCreate(
            id=f"cust-c1-{uid}",
            code=code,
            name=f"First Code Customer {uid}",
            status="Active"
        ))

        # Same company + same Customer.code
        duplicate_code_in = CustomerCreate(
            id=f"cust-c2-{uid}",
            code=code,
            name=f"Second Code Customer {uid}",
            status="Active"
        )
        chk = await service.identity_service.check_duplicate_customer(duplicate_code_in)
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.CUSTOMER_CODE

        with pytest.raises(HTTPException) as exc:
            await service.create_customer(duplicate_code_in)
        assert exc.value.status_code == 409


# ===========================================================================
# 04. Same Customer.code different tenant -> ALLOWED
# ===========================================================================
@pytest.mark.asyncio
async def test_04_same_customer_code_different_tenant_allowed(tenant_ctx, other_tenant_ctx):
    uid = uuid.uuid4().hex[:8]
    code = f"SHARED-{uid}"

    # Create in Tenant A
    async with TestSessionLocal() as session_a:
        service_a = CrmService(session_a, tenant_ctx)
        cust_a = await service_a.create_customer(CustomerCreate(
            id=f"cust-ta-{uid}",
            code=code,
            name=f"Tenant A Customer {uid}",
            status="Active"
        ))
        assert cust_a.code == code

    # Create in Tenant B with identical code
    async with TestSessionLocal() as session_b:
        service_b = CrmService(session_b, other_tenant_ctx)
        chk = await service_b.identity_service.check_duplicate_customer(CustomerCreate(
            id=f"cust-tb-{uid}",
            code=code,
            name=f"Tenant B Customer {uid}",
            status="Active"
        ))
        assert chk.decision == DuplicateDecision.ALLOW

        cust_b = await service_b.create_customer(CustomerCreate(
            id=f"cust-tb-{uid}",
            code=code,
            name=f"Tenant B Customer {uid}",
            status="Active"
        ))
        assert cust_b.code == code


# ===========================================================================
# 05. Same GSTIN different Customer -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_05_same_gstin_different_customer_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        gstin = make_test_gstin("27")

        # Customer 1
        cust1 = await service.create_customer(CustomerCreate(
            id=f"cust-g1-{uid}",
            code=f"CUST-G1-{uid}",
            name=f"GST Customer 1 {uid}",
            status="Active"
        ))
        await service.create_gst_registration(cust1.id, CustomerGSTRegistrationCreate(
            gstin=gstin, state_name="Maharashtra", state_code="27", is_primary=True
        ))

        # Customer 2
        cust2 = await service.create_customer(CustomerCreate(
            id=f"cust-g2-{uid}",
            code=f"CUST-G2-{uid}",
            name=f"GST Customer 2 {uid}",
            status="Active"
        ))

        # Check duplicate GSTIN across different customer
        chk = await service.identity_service.check_duplicate_gst_registration(cust2.id, gstin)
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.GSTIN
        assert chk.existing_customer.id == cust1.id

        # Registration must be blocked
        with pytest.raises(HTTPException) as exc:
            await service.create_gst_registration(cust2.id, CustomerGSTRegistrationCreate(
                gstin=gstin, state_name="Maharashtra", state_code="27", is_primary=True
            ))
        assert exc.value.status_code == 409


# ===========================================================================
# 06. Same GSTIN same Customer -> Duplicate registration
# ===========================================================================
@pytest.mark.asyncio
async def test_06_same_gstin_same_customer_duplicate_registration(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        gstin = make_test_gstin("29")

        cust = await service.create_customer(CustomerCreate(
            id=f"cust-dg-{uid}",
            code=f"CUST-DG-{uid}",
            name=f"Duplicate GST Customer {uid}",
            status="Active"
        ))
        await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=gstin, state_name="Karnataka", state_code="29", is_primary=True
        ))

        # Check duplicate GSTIN on SAME customer
        chk = await service.identity_service.check_duplicate_gst_registration(cust.id, gstin)
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.GSTIN

        with pytest.raises(HTTPException) as exc:
            await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
                gstin=gstin, state_name="Karnataka", state_code="29", is_primary=False
            ))
        assert exc.value.status_code == 409


# ===========================================================================
# 07. Different GSTIN same Corporate Customer -> ALLOW
# ===========================================================================
@pytest.mark.asyncio
async def test_07_different_gstin_same_corporate_customer_allowed(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        gst_mh = make_test_gstin("27")
        gst_dl = make_test_gstin("07")

        corp = await service.create_customer(CustomerCreate(
            id=f"corp-{uid}",
            code=f"CORP-{uid}",
            name=f"Reliance Retail Ltd {uid}",
            status="Active"
        ))

        reg1 = await service.create_gst_registration(corp.id, CustomerGSTRegistrationCreate(
            gstin=gst_mh, state_name="Maharashtra", state_code="27", is_primary=True
        ))
        reg2 = await service.create_gst_registration(corp.id, CustomerGSTRegistrationCreate(
            gstin=gst_dl, state_name="Delhi", state_code="07", is_primary=False
        ))

        regs = await service.list_gst_registrations(corp.id)
        assert len(regs) == 2
        assert {r.gstin for r in regs} == {gst_mh, gst_dl}


# ===========================================================================
# 08. Same external code + same source -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_08_same_external_code_same_source_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        ext_code = f"SAP-{uid}"

        cust1 = await service.create_customer(CustomerCreate(
            id=f"cust-ext1-{uid}", code=f"CUST-EXT1-{uid}", name=f"Ext Cust 1 {uid}", status="Active"
        ))
        await service.create_external_identity(cust1.id, CustomerExternalIdentityCreate(
            source_system="SAP", external_type="CUSTOMER", external_code=ext_code
        ))

        # Check duplicate for Cust 2
        cust2 = await service.create_customer(CustomerCreate(
            id=f"cust-ext2-{uid}", code=f"CUST-EXT2-{uid}", name=f"Ext Cust 2 {uid}", status="Active"
        ))
        chk = await service.identity_service.check_duplicate_external_identity(
            source_system="SAP", external_type="CUSTOMER", external_code=ext_code
        )
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.EXTERNAL_ID
        assert chk.existing_customer.id == cust1.id

        with pytest.raises(HTTPException) as exc:
            await service.create_external_identity(cust2.id, CustomerExternalIdentityCreate(
                source_system="SAP", external_type="CUSTOMER", external_code=ext_code
            ))
        assert exc.value.status_code == 409


# ===========================================================================
# 09. Same external code + different source -> ALLOW
# ===========================================================================
@pytest.mark.asyncio
async def test_09_same_external_code_different_source_allowed(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        code = f"EXT-{uid}"

        cust1 = await service.create_customer(CustomerCreate(
            id=f"cust-ds1-{uid}", code=f"CUST-DS1-{uid}", name=f"Diff Source 1 {uid}", status="Active"
        ))
        cust2 = await service.create_customer(CustomerCreate(
            id=f"cust-ds2-{uid}", code=f"CUST-DS2-{uid}", name=f"Diff Source 2 {uid}", status="Active"
        ))

        id1 = await service.create_external_identity(cust1.id, CustomerExternalIdentityCreate(
            source_system="SAP", external_type="CUSTOMER", external_code=code
        ))
        # Same code, different source system (Oracle)
        chk = await service.identity_service.check_duplicate_external_identity(
            source_system="ORACLE", external_type="CUSTOMER", external_code=code
        )
        assert chk.decision == DuplicateDecision.ALLOW

        id2 = await service.create_external_identity(cust2.id, CustomerExternalIdentityCreate(
            source_system="ORACLE", external_type="CUSTOMER", external_code=code
        ))
        assert id1.external_code == id2.external_code
        assert id1.source_system != id2.source_system


# ===========================================================================
# 10. Same mobile -> POSSIBLE_DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_10_same_mobile_possible_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        mobile = f"98{int(uid[:6], 16) % 90000000 + 10000000}"

        c1 = await service.create_customer(CustomerCreate(
            id=f"cust-m1-{uid}", code=f"CUST-M1-{uid}", name=f"Mobile Cust 1 {uid}", mobile=mobile, status="Active"
        ))

        c2_in = CustomerCreate(
            id=f"cust-m2-{uid}", code=f"CUST-M2-{uid}", name=f"Mobile Cust 2 {uid}", mobile=f" +91 {mobile} ", status="Active"
        )
        chk = await service.identity_service.check_duplicate_customer(c2_in)
        assert chk.decision == DuplicateDecision.POSSIBLE_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.MOBILE
        assert chk.existing_customer.id == c1.id

        # Blocked without override
        with pytest.raises(HTTPException) as exc:
            await service.create_customer(c2_in)
        assert exc.value.status_code == 409

        # Allowed with override flag
        c2_in.allow_duplicate_override = True
        c2 = await service.create_customer(c2_in)
        assert c2.id == c2_in.id


# ===========================================================================
# 11. Same email -> POSSIBLE_DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_11_same_email_possible_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        email = f"shared_{uid}@accounts.retail.com"

        c1 = await service.create_customer(CustomerCreate(
            id=f"cust-e1-{uid}", code=f"CUST-E1-{uid}", name=f"Email Cust 1 {uid}", email=email, status="Active"
        ))

        c2_in = CustomerCreate(
            id=f"cust-e2-{uid}", code=f"CUST-E2-{uid}", name=f"Email Cust 2 {uid}", email=f"  {email.upper()}  ", status="Active"
        )
        chk = await service.identity_service.check_duplicate_customer(c2_in)
        assert chk.decision == DuplicateDecision.POSSIBLE_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.EMAIL
        assert chk.existing_customer.id == c1.id


# ===========================================================================
# 12. Same name -> POSSIBLE_DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_12_same_name_possible_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        name = f"Exact Corp Name {uid}"

        c1 = await service.create_customer(CustomerCreate(
            id=f"cust-n1-{uid}", code=f"CUST-N1-{uid}", name=name, status="Active"
        ))

        c2_in = CustomerCreate(
            id=f"cust-n2-{uid}", code=f"CUST-N2-{uid}", name=f"  {name.lower()}  ", status="Active"
        )
        chk = await service.identity_service.check_duplicate_customer(c2_in)
        assert chk.decision == DuplicateDecision.POSSIBLE_DUPLICATE
        assert chk.matched_identity == MatchedIdentityType.NAME
        assert chk.existing_customer.id == c1.id


# ===========================================================================
# 13. Same Customer + same Store Code -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_13_same_customer_same_store_code_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        store_code = f"STR-{uid[:4]}"

        cust = await service.create_customer(CustomerCreate(
            id=f"cust-s1-{uid}", code=f"CUST-S1-{uid}", name=f"Store Cust {uid}", status="Active"
        ))
        await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=store_code, location_name="Site 1", address_line1="Road 1",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001"
        ))

        # Attempt to create duplicate store code under same customer
        with pytest.raises(HTTPException) as exc:
            await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
                store_code=store_code, location_name="Site 2", address_line1="Road 2",
                city="Mumbai", state="Maharashtra", state_code="27", pincode="400001"
            ))
        assert exc.value.status_code == 409


# ===========================================================================
# 14. Different Customer + same Store Code -> Allowed
# ===========================================================================
@pytest.mark.asyncio
async def test_14_different_customer_same_store_code_allowed(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        store_code = f"STORE-{uid[:4]}"

        cust1 = await service.create_customer(CustomerCreate(
            id=f"cust-diff1-{uid}", code=f"CUST-D1-{uid}", name=f"Cust 1 {uid}", status="Active"
        ))
        cust2 = await service.create_customer(CustomerCreate(
            id=f"cust-diff2-{uid}", code=f"CUST-D2-{uid}", name=f"Cust 2 {uid}", status="Active"
        ))

        loc1 = await service.create_delivery_location(cust1.id, CustomerDeliveryLocationCreate(
            store_code=store_code, location_name="Location A", address_line1="Avenue 1",
            city="Delhi", state="Delhi", state_code="07", pincode="110001"
        ))
        loc2 = await service.create_delivery_location(cust2.id, CustomerDeliveryLocationCreate(
            store_code=store_code, location_name="Location B", address_line1="Avenue 2",
            city="Delhi", state="Delhi", state_code="07", pincode="110001"
        ))

        assert loc1.store_code == loc2.store_code
        assert loc1.customer_id != loc2.customer_id


# ===========================================================================
# 15. Same GSTIN + same Store Code -> HARD DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_15_same_gstin_same_store_code_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        gstin = make_test_gstin("27")
        store_code = f"STRG-{uid[:4]}"

        cust = await service.create_customer(CustomerCreate(
            id=f"cust-gstr-{uid}", code=f"CUST-GSTR-{uid}", name=f"GST Store Cust {uid}", status="Active"
        ))
        reg = await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=gstin, state_name="Maharashtra", state_code="27"
        ))
        await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=store_code, location_name="Warehouse A", address_line1="Midc Area",
            city="Pune", state="Maharashtra", state_code="27", pincode="411001",
            gst_registration_id=reg.id
        ))

        # Check duplicate location for customer
        chk = await service.identity_service.check_duplicate_delivery_location(
            customer_id=cust.id,
            store_code=store_code,
            gstin=gstin
        )
        assert chk.decision == DuplicateDecision.HARD_DUPLICATE


# ===========================================================================
# 16. Same address + different Store Code -> POSSIBLE_DUPLICATE
# ===========================================================================
@pytest.mark.asyncio
async def test_16_same_address_different_store_code_possible_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        address = f"{uid} Commercial Hub, Sector 4"

        cust = await service.create_customer(CustomerCreate(
            id=f"cust-addr-{uid}", code=f"CUST-ADDR-{uid}", name=f"Addr Cust {uid}", status="Active"
        ))
        await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"SC-1-{uid[:3]}", location_name="Store 1", address_line1=address,
            city="Noida", state="Uttar Pradesh", state_code="09", pincode="201301"
        ))

        chk = await service.identity_service.check_duplicate_delivery_location(
            customer_id=cust.id,
            store_code=f"SC-2-{uid[:3]}",
            address_line1=address
        )
        assert chk.decision == DuplicateDecision.POSSIBLE_DUPLICATE
        assert "identical address" in chk.reason.lower()


# ===========================================================================
# 17. Billing Store duplicate -> HARD DUPLICATE according to ownership
# ===========================================================================
@pytest.mark.asyncio
async def test_17_billing_store_duplicate_hard_duplicate(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        billing_code = f"BIL-{uid[:4]}"

        cust = await service.create_customer(CustomerCreate(
            id=f"cust-bil-{uid}", code=f"CUST-BIL-{uid}", name=f"Billing Cust {uid}", status="Active"
        ))
        await service.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code=billing_code, location_name="HQ Billing", address_line1="HQ Tower",
            city="Bengaluru", state="Karnataka", state_code="29", pincode="560001"
        ))

        # Attempt to create duplicate billing store code under same customer
        with pytest.raises(HTTPException) as exc:
            await service.create_billing_location(cust.id, CustomerBillingLocationCreate(
                billing_store_code=billing_code, location_name="Duplicate HQ", address_line1="HQ Tower 2",
                city="Bengaluru", state="Karnataka", state_code="29", pincode="560001"
            ))
        assert exc.value.status_code == 409


# ===========================================================================
# 18. Multiple GST registrations -> supported
# ===========================================================================
@pytest.mark.asyncio
async def test_18_multiple_gst_registrations_supported(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-mg-{uid}", code=f"CUST-MG-{uid}", name=f"Multi GST Corp {uid}", status="Active"
        ))

        states = [("27", "Maharashtra"), ("29", "Karnataka"), ("06", "Haryana")]
        for sc, sn in states:
            await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
                gstin=make_test_gstin(sc), state_name=sn, state_code=sc
            ))

        regs = await service.list_gst_registrations(cust.id)
        assert len(regs) == 3


# ===========================================================================
# 19. Primary GST uniqueness -> enforced
# ===========================================================================
@pytest.mark.asyncio
async def test_19_primary_gst_uniqueness_enforced(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-prg-{uid}", code=f"CUST-PRG-{uid}", name=f"Primary GST Corp {uid}", status="Active"
        ))

        r1 = await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=make_test_gstin("27"), state_name="Maharashtra", state_code="27", is_primary=True
        ))
        r2 = await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=make_test_gstin("29"), state_name="Karnataka", state_code="29", is_primary=True
        ))

        # Adding r2 as primary demotes r1
        await session.refresh(r1)
        await session.refresh(r2)
        assert r2.is_primary is True
        assert r1.is_primary is False

        # Only one primary in customer
        primaries = [r for r in (await service.list_gst_registrations(cust.id)) if r.is_primary]
        assert len(primaries) == 1
        assert primaries[0].id == r2.id


# ===========================================================================
# 20. Default Shipping uniqueness -> enforced
# ===========================================================================
@pytest.mark.asyncio
async def test_20_default_shipping_uniqueness_enforced(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-ds-{uid}", code=f"CUST-DS-{uid}", name=f"Default Ship Corp {uid}", status="Active"
        ))

        l1 = await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"DS-1-{uid[:3]}", location_name="Loc 1", address_line1="Road 1",
            city="City 1", state="Maharashtra", state_code="27", pincode="400001", is_default=True
        ))
        l2 = await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"DS-2-{uid[:3]}", location_name="Loc 2", address_line1="Road 2",
            city="City 2", state="Maharashtra", state_code="27", pincode="400002", is_default=True
        ))

        await session.refresh(l1)
        await session.refresh(l2)
        assert l2.is_default is True
        assert l1.is_default is False

        def_loc = await service.delivery_repo.get_default(cust.id)
        assert def_loc.id == l2.id


# ===========================================================================
# 21. Default Billing uniqueness -> enforced
# ===========================================================================
@pytest.mark.asyncio
async def test_21_default_billing_uniqueness_enforced(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-dbl-{uid}", code=f"CUST-DBL-{uid}", name=f"Default Bill Corp {uid}", status="Active"
        ))

        b1 = await service.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code=f"BL-1-{uid[:3]}", location_name="Billing 1", address_line1="Road 1",
            city="City 1", state="Maharashtra", state_code="27", pincode="400001", is_default=True
        ))
        b2 = await service.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code=f"BL-2-{uid[:3]}", location_name="Billing 2", address_line1="Road 2",
            city="City 2", state="Maharashtra", state_code="27", pincode="400002", is_default=True
        ))

        await session.refresh(b1)
        await session.refresh(b2)
        assert b2.is_default is True
        assert b1.is_default is False

        def_bill = await service.billing_repo.get_default(cust.id)
        assert def_bill.id == b2.id


# ===========================================================================
# 22. Inactive default excluded
# ===========================================================================
@pytest.mark.asyncio
async def test_22_inactive_default_excluded(tenant_ctx):
    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-inact-{uid}", code=f"CUST-INA-{uid}", name=f"Inactive Default Corp {uid}", status="Active"
        ))

        # Delivery location deactivated
        l = await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"INA-{uid[:3]}", location_name="Inactive Loc", address_line1="Road",
            city="City", state="Maharashtra", state_code="27", pincode="400001"
        ))
        await service.delete_delivery_location(cust.id, l.id)

        with pytest.raises(HTTPException) as exc:
            await service.set_default_delivery_location(cust.id, l.id)
        assert exc.value.status_code in (400, 404)


# ===========================================================================
# 23. Manual transaction override works
# ===========================================================================
@pytest.mark.asyncio
async def test_23_manual_transaction_override_works(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-txov-{uid}", code=f"CUST-TXOV-{uid}", name=f"Override Corp {uid}", status="Active"
        ))
        b_default = await crm.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code="BL-MUM", location_name="Mumbai HO", address_line1="HO Road",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001", is_default=True
        ))
        b_branch = await crm.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code="BL-DEL", location_name="Delhi AP", address_line1="Connaught Place",
            city="Delhi", state="Delhi", state_code="07", pincode="110001", is_default=False
        ))

        # Operator overrides transaction billing location to Delhi
        inv_payload = SalesInvoiceCreate(
            invoice_no=f"INV-OV-{uid}",
            date=date.today(),
            customer_id=cust.id,
            billing_location_id=b_branch.id,
            warehouse_id="WH-MAIN",
            payment_mode="CASH",
            status="Draft",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("1"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        )
        invoice = await sales.create_sales_invoice(inv_payload)
        assert invoice.billing_location_id == b_branch.id
        assert invoice.billing_store_code == "BL-DEL"


# ===========================================================================
# 24. Invoice snapshot immutable
# ===========================================================================
@pytest.mark.asyncio
async def test_24_invoice_snapshot_immutable(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-snap-{uid}", code=f"CUST-SNAP-{uid}", name=f"Snapshot Corp {uid}", status="Active"
        ))
        reg = await crm.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=make_test_gstin("27"), state_name="Maharashtra", state_code="27", is_primary=True
        ))
        del_loc = await crm.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"STR-{uid[:4]}", location_name="Store Alpha", address_line1="Alpha Way",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001"
        ))
        bill_loc = await crm.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code=f"BIL-{uid[:4]}", location_name="Billing Alpha", address_line1="Finance Tower",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001"
        ))

        invoice = await sales.create_sales_invoice(SalesInvoiceCreate(
            invoice_no=f"INV-SNP-{uid}",
            date=date.today(),
            customer_id=cust.id,
            billed_party_gstin_id=reg.id,
            billing_location_id=bill_loc.id,
            delivery_location_id=del_loc.id,
            warehouse_id="WH-MAIN",
            payment_mode="CASH",
            status="Draft",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("2"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        ))

        assert invoice.billed_party_gstin_id == reg.id
        assert invoice.customer_gstin == reg.gstin
        assert invoice.billing_location_id == bill_loc.id
        assert invoice.billing_store_code == bill_loc.billing_store_code
        assert invoice.delivery_location_id == del_loc.id
        assert invoice.delivery_store_code == del_loc.store_code


# ===========================================================================
# 25. Customer Code change does not change Customer.id
# ===========================================================================
@pytest.mark.asyncio
async def test_25_customer_code_change_does_not_change_customer_id(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        original = await crm.create_customer(CustomerCreate(
            id=f"cust-imm-{uid}", code=f"CUST-ORIG-{uid}", name=f"Original Name {uid}", status="Active"
        ))
        imm_id = original.id

        updated = await crm.update_customer(imm_id, CustomerUpdate(code=f"CUST-NEW-{uid}"))
        assert updated.id == imm_id
        assert updated.code == f"CUST-NEW-{uid}"


# ===========================================================================
# 26. Store Code change does not alter historical invoice
# ===========================================================================
@pytest.mark.asyncio
async def test_26_store_code_change_does_not_alter_historical_invoice(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        old_store = f"OLD-STR-{uid[:4]}".upper()

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-sc-{uid}", code=f"CUST-SC-{uid}", name=f"Store Change Corp {uid}", status="Active"
        ))
        loc = await crm.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=old_store, location_name="Old Site", address_line1="Site Rd",
            city="Pune", state="Maharashtra", state_code="27", pincode="411001"
        ))

        inv = await sales.create_sales_invoice(SalesInvoiceCreate(
            invoice_no=f"INV-SC-{uid}",
            date=date.today(),
            customer_id=cust.id,
            delivery_location_id=loc.id,
            warehouse_id="WH-MAIN",
            payment_mode="CASH",
            status="Draft",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("1"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        ))
        assert inv.delivery_store_code == old_store

        # Mutate delivery location store code later
        new_store = f"NEW-STR-{uid[:3]}".upper()
        await crm.update_delivery_location(cust.id, loc.id, CustomerDeliveryLocationUpdate(store_code=new_store))

        # Historical invoice remains untouched
        inv_check = (await session.execute(select(SalesInvoice).filter(SalesInvoice.id == inv.id))).scalars().first()
        assert inv_check.delivery_store_code == old_store


# ===========================================================================
# 27. GST change does not alter historical invoice
# ===========================================================================
@pytest.mark.asyncio
async def test_27_gst_change_does_not_alter_historical_invoice(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]
        old_gstin = make_test_gstin("27")

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-gstchg-{uid}", code=f"CUST-GC-{uid}", name=f"GST Chg Corp {uid}", status="Active"
        ))
        reg = await crm.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=old_gstin, state_name="Maharashtra", state_code="27"
        ))

        inv = await sales.create_sales_invoice(SalesInvoiceCreate(
            invoice_no=f"INV-GC-{uid}",
            date=date.today(),
            customer_id=cust.id,
            billed_party_gstin_id=reg.id,
            warehouse_id="WH-MAIN",
            payment_mode="CASH",
            status="Draft",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("1"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        ))
        assert inv.customer_gstin == old_gstin

        # Update GST registration later
        new_gstin = make_test_gstin("27")
        await crm.update_gst_registration(cust.id, reg.id, CustomerGSTRegistrationUpdate(gstin=new_gstin))

        # Invoice retains historical snapshot
        inv_check = (await session.execute(select(SalesInvoice).filter(SalesInvoice.id == inv.id))).scalars().first()
        assert inv_check.customer_gstin == old_gstin


# ===========================================================================
# 28. Address change does not alter historical invoice
# ===========================================================================
@pytest.mark.asyncio
async def test_28_address_change_does_not_alter_historical_invoice(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-adchg-{uid}", code=f"CUST-AC-{uid}", name=f"Addr Chg Corp {uid}", status="Active"
        ))
        bill_loc = await crm.create_billing_location(cust.id, CustomerBillingLocationCreate(
            billing_store_code=f"BL-{uid[:4]}", location_name="Old Office", address_line1="123 Old Street",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001"
        ))

        inv = await sales.create_sales_invoice(SalesInvoiceCreate(
            invoice_no=f"INV-AC-{uid}",
            date=date.today(),
            customer_id=cust.id,
            billing_location_id=bill_loc.id,
            warehouse_id="WH-MAIN",
            payment_mode="CASH",
            status="Draft",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("1"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        ))
        historical_addr = inv.billing_address
        assert "123 Old Street" in historical_addr

        # Update billing location address
        await crm.update_billing_location(cust.id, bill_loc.id, CustomerBillingLocationUpdate(
            address_line1="999 New Plaza"
        ))

        inv_check = (await session.execute(select(SalesInvoice).filter(SalesInvoice.id == inv.id))).scalars().first()
        assert "123 Old Street" in inv_check.billing_address


# ===========================================================================
# 29. Concurrent duplicate Customer Code creation
# ===========================================================================
@pytest.mark.asyncio
async def test_29_concurrent_duplicate_customer_code_creation(tenant_ctx):
    uid = uuid.uuid4().hex[:8]
    code = f"RACE-CUST-{uid}"

    async def create_cust(idx):
        async with TestSessionLocal() as session:
            service = CrmService(session, tenant_ctx)
            return await service.create_customer(CustomerCreate(
                id=f"cust-race-{idx}-{uid}",
                code=code,
                name=f"Race Cust {idx} {uid}",
                status="Active"
            ))

    results = await asyncio.gather(create_cust(1), create_cust(2), return_exceptions=True)
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]

    assert len(successes) == 1
    assert len(failures) == 1


# ===========================================================================
# 30. Concurrent duplicate GSTIN creation
# ===========================================================================
@pytest.mark.asyncio
async def test_30_concurrent_duplicate_gstin_creation(tenant_ctx):
    uid = uuid.uuid4().hex[:8]
    gstin = make_test_gstin("27")

    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-rgst-{uid}", code=f"CUST-RGST-{uid}", name=f"Race GST Cust {uid}", status="Active"
        ))

    async def create_gst(prefix):
        async with TestSessionLocal() as session:
            service = CrmService(session, tenant_ctx)
            return await service.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
                id=f"cgr-{prefix}-{uid}", gstin=gstin, state_name="Maharashtra", state_code="27"
            ))

    results = await asyncio.gather(create_gst("1"), create_gst("2"), return_exceptions=True)
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]
    assert len(successes) == 1
    assert len(failures) == 1


# ===========================================================================
# 31. Concurrent duplicate Store Code creation
# ===========================================================================
@pytest.mark.asyncio
async def test_31_concurrent_duplicate_store_code_creation(tenant_ctx):
    uid = uuid.uuid4().hex[:8]
    store_code = f"RACE-STR-{uid[:4]}"

    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        cust = await service.create_customer(CustomerCreate(
            id=f"cust-rstr-{uid}", code=f"CUST-RSTR-{uid}", name=f"Race Store {uid}", status="Active"
        ))

    async def create_loc(prefix):
        async with TestSessionLocal() as session:
            service = CrmService(session, tenant_ctx)
            return await service.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
                id=f"cdl-{prefix}-{uid}", store_code=store_code, location_name=f"Site {prefix}",
                address_line1="Road", city="Pune", state="Maharashtra", state_code="27", pincode="411001"
            ))

    results = await asyncio.gather(create_loc("1"), create_loc("2"), return_exceptions=True)
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]
    assert len(successes) == 1
    assert len(failures) == 1


# ===========================================================================
# 32. Concurrent duplicate External ID creation
# ===========================================================================
@pytest.mark.asyncio
async def test_32_concurrent_duplicate_external_id_creation(tenant_ctx):
    uid = uuid.uuid4().hex[:8]
    ext_code = f"RACE-EXT-{uid[:4]}"

    async with TestSessionLocal() as session:
        service = CrmService(session, tenant_ctx)
        c1 = await service.create_customer(CustomerCreate(
            id=f"cust-re1-{uid}", code=f"CUST-RE1-{uid}", name=f"Race Ext 1 {uid}", status="Active"
        ))
        c2 = await service.create_customer(CustomerCreate(
            id=f"cust-re2-{uid}", code=f"CUST-RE2-{uid}", name=f"Race Ext 2 {uid}", status="Active"
        ))

    async def create_ext(cust_id, ident_id):
        async with TestSessionLocal() as session:
            service = CrmService(session, tenant_ctx)
            return await service.create_external_identity(cust_id, CustomerExternalIdentityCreate(
                id=ident_id, source_system="SAP", external_type="CUSTOMER", external_code=ext_code
            ))

    results = await asyncio.gather(
        create_ext(c1.id, f"cei-1-{uid}"),
        create_ext(c2.id, f"cei-2-{uid}"),
        return_exceptions=True
    )
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, HTTPException) and r.status_code == 409]
    assert len(successes) == 1
    assert len(failures) == 1


# ===========================================================================
# 33. Cross-company isolation
# ===========================================================================
@pytest.mark.asyncio
async def test_33_cross_company_isolation(tenant_ctx, other_tenant_ctx):
    uid = uuid.uuid4().hex[:8]

    # Customer in Tenant A
    async with TestSessionLocal() as session_a:
        service_a = CrmService(session_a, tenant_ctx)
        cust_a = await service_a.create_customer(CustomerCreate(
            id=f"cust-iso-a-{uid}", code=f"ISO-A-{uid}", name=f"Tenant A Cust {uid}", status="Active"
        ))

    # Tenant B tries to access or alter Customer A
    async with TestSessionLocal() as session_b:
        service_b = CrmService(session_b, other_tenant_ctx)
        fetched = await service_b.get_customer(cust_a.id)
        assert fetched is None  # isolated

        sales_b = SalesService(session_b, other_tenant_ctx)
        with pytest.raises(HTTPException) as exc:
            await sales_b.create_sales_invoice(SalesInvoiceCreate(
                invoice_no=f"INV-ISO-{uid}",
                date=date.today(),
                customer_id=cust_a.id,
                warehouse_id="WH-MAIN",
                payment_mode="CASH",
                status="Draft",
                items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("1"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
            ))
        assert exc.value.status_code in (400, 403, 404)


# ===========================================================================
# 34. Existing B2B Credit Billing tests remain green
# ===========================================================================
@pytest.mark.asyncio
async def test_34_existing_b2b_credit_billing_regression_check(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        sales = SalesService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-cred-{uid}", code=f"CRED-{uid}", name=f"Credit Policy Corp {uid}",
            customer_group_id="CG-RETAIL", status="Active"
        ))

        # Create credit sale
        inv = await sales.create_sales_invoice(SalesInvoiceCreate(
            invoice_no=f"INV-CR-{uid}",
            date=date.today(),
            customer_id=cust.id,
            payment_mode="CREDIT",
            warehouse_id="WH-MAIN",
            status="Completed",
            items=[SalesInvoiceItemCreate(product_id="P-TEST-001", code="P-TEST-001", name="Test Widget", quantity=Decimal("5"), price=Decimal("100.00"), gst_rate=Decimal("18.00"))],
        ))
        assert inv.payment_mode == "CREDIT"
        assert inv.grand_total == Decimal("500.00")

        # Verify outstanding incremented
        await session.refresh(cust)
        assert cust.outstanding == Decimal("500.00")


# ===========================================================================
# 35. Existing Phase 2B GST/Delivery tests remain green
# ===========================================================================
@pytest.mark.asyncio
async def test_35_existing_phase2b_gst_delivery_regression_check(tenant_ctx):
    async with TestSessionLocal() as session:
        crm = CrmService(session, tenant_ctx)
        uid = uuid.uuid4().hex[:8]

        cust = await crm.create_customer(CustomerCreate(
            id=f"cust-p2b-{uid}", code=f"P2B-{uid}", name=f"Phase 2B Cust {uid}", status="Active"
        ))
        reg = await crm.create_gst_registration(cust.id, CustomerGSTRegistrationCreate(
            gstin=make_test_gstin("27"), state_name="Maharashtra", state_code="27", is_primary=True
        ))
        loc = await crm.create_delivery_location(cust.id, CustomerDeliveryLocationCreate(
            store_code=f"P2B-{uid[:4]}", location_name="Hub", address_line1="Lane 1",
            city="Mumbai", state="Maharashtra", state_code="27", pincode="400001",
            gst_registration_id=reg.id
        ))

        assert reg.is_primary is True
        assert loc.gstin == reg.gstin
        assert loc.state_code == reg.state_code
