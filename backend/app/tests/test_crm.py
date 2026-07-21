"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.3.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
import pytest
from decimal import Decimal
from pydantic import ValidationError
from fastapi import HTTPException
from sqlalchemy.future import select

from app.models.crm import Customer, CustomerGroup
from app.models.tenant import Company, Branch
from app.schemas.crm import (
    CustomerCreate, CustomerTaxProfileCreate, CustomerCreditProfileCreate,
    CustomerAddressCreate, CustomerContactCreate, CustomerChannelPreferenceCreate
)
from app.services.crm import CrmService
from app.repositories.customer import CustomerRepository
from app.api.deps import TenantContext


from app.tests.conftest import clear_db

@pytest.fixture(autouse=True)
async def override_db(db_session):
    await clear_db(db_session)
    yield
    try:
        await clear_db(db_session)
    except Exception:
        pass


from app.db.session import active_tenant_ctx

async def _setup_crm_tenant(db_session):
    suffix = uuid.uuid4().hex[:8]
    comp = Company(id=f"comp_{suffix}", name=f"Company {suffix}", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br_{suffix}", company_id=comp.id, name=f"Branch {suffix}", code=f"BR-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()

    tenant_ctx = TenantContext(
        company_id=comp.id,
        branch_id=br.id,
        tenant_id=comp.id
    )
    active_tenant_ctx.set(tenant_ctx)
    return tenant_ctx


@pytest.mark.asyncio
async def test_create_customer_aggregate_root_with_auto_code(db_session):
    tenant_ctx = await _setup_crm_tenant(db_session)

    # 1. Seed CustomerGroup
    service = CrmService(db_session, tenant_ctx)
    group_in = {"name": f"Retailers_{uuid.uuid4().hex[:6]}", "credit_limit": Decimal("50000.00")}
    from app.schemas.crm import CustomerGroupCreate
    group = await service.create_customer_group(CustomerGroupCreate(id=f"grp_{uuid.uuid4().hex[:6]}", **group_in))

    # 2. Prepare Aggregate Root Payload with Child Entities
    cust_in = CustomerCreate(
        name="Apex Enterprises Ltd",
        mobile="9876543210",
        email="contact@apex.com",
        customer_group_id=group.id,
        tax_profile=CustomerTaxProfileCreate(
            pan_number="ABCDE1234F",
            gstin="27ABCDE1234F1Z5",
            is_gst_exempt=False
        ),
        credit_profile=CustomerCreditProfileCreate(
            credit_limit=Decimal("100000.00"),
            credit_days=30,
            block_sales_on_limit=True
        ),
        addresses=[
            CustomerAddressCreate(
                address_type_id="addr_billing",
                building_name="Apex Tower",
                street="MG Road",
                city="Mumbai",
                state="Maharashtra",
                pincode="400001",
                is_primary=True
            )
        ],
        contacts=[
            CustomerContactCreate(
                contact_type_id="cnt_owner",
                name="Rahul Sharma",
                designation="Director",
                mobile="9876543210",
                email="rahul@apex.com",
                is_primary=True
            )
        ]
    )

    # 3. Create via Service
    created_cust = await service.create_customer(cust_in)
    print("\n--- CREATED CUST ---:", created_cust)
    print("--- CODE ---:", created_cust.code)
    print("--- TAX PROFILE ---:", created_cust.tax_profile)
    print("--- CREDIT PROFILE ---:", created_cust.credit_profile)
    print("--- ADDRESSES ---:", created_cust.addresses)
    print("--- CONTACTS ---:", created_cust.contacts)

    assert created_cust is not None
    assert created_cust.code.startswith("CUS-")
    assert created_cust.name == "Apex Enterprises Ltd"
    assert created_cust.tax_profile is not None
    assert created_cust.tax_profile.pan_number == "ABCDE1234F"
    assert created_cust.tax_profile.gstin == "27ABCDE1234F1Z5"
    assert created_cust.credit_profile is not None
    assert Decimal(str(created_cust.credit_profile.credit_limit)) == Decimal("100000.00")
    assert len(created_cust.addresses) == 1
    assert created_cust.addresses[0].city == "Mumbai"
    assert len(created_cust.contacts) == 1
    assert created_cust.contacts[0].name == "Rahul Sharma"


@pytest.mark.asyncio
async def test_invalid_pan_and_gstin_format_raises_validation_error(db_session):
    # Test Invalid PAN Format
    with pytest.raises(ValidationError) as excinfo_pan:
        CustomerTaxProfileCreate(pan_number="INVALID_PAN")
    assert "Invalid Indian Income Tax PAN format" in str(excinfo_pan.value)

    # Test Invalid GSTIN Format
    with pytest.raises(ValidationError) as excinfo_gst:
        CustomerTaxProfileCreate(gstin="12345")
    assert "Invalid Statutory 15-character GSTIN format" in str(excinfo_gst.value)


@pytest.mark.asyncio
async def test_cashier_quick_search_by_code_mobile_pan_gstin(db_session):
    tenant_ctx = await _setup_crm_tenant(db_session)
    service = CrmService(db_session, tenant_ctx)

    cust_in = CustomerCreate(
        name="Star Retail Corp",
        mobile="9123456789",
        email="info@starretail.com",
        tax_profile=CustomerTaxProfileCreate(
            pan_number="VWXYZ9876K",
            gstin="29VWXYZ9876K1Z9"
        )
    )
    created = await service.create_customer(cust_in)

    repo = CustomerRepository(db_session, tenant_ctx)

    # Search by Code
    res_code = await repo.search(q=created.code)
    assert len(res_code) == 1
    assert res_code[0].id == created.id

    # Search by Mobile
    res_mobile = await repo.search(q="9123456789")
    assert len(res_mobile) == 1
    assert res_mobile[0].id == created.id

    # Search by PAN
    res_pan = await repo.search(q="VWXYZ9876K")
    assert len(res_pan) == 1
    assert res_pan[0].id == created.id

    # Search by GSTIN
    res_gstin = await repo.search(q="29VWXYZ9876K1Z9")
    assert len(res_gstin) == 1
    assert res_gstin[0].id == created.id


@pytest.mark.asyncio
async def test_credit_limit_check_enforces_limit_block(db_session):
    tenant_ctx = await _setup_crm_tenant(db_session)
    service = CrmService(db_session, tenant_ctx)

    cust_in = CustomerCreate(
        name="Credit Test Corp",
        mobile="9988776655",
        credit_profile=CustomerCreditProfileCreate(
            credit_limit=Decimal("5000.00"),
            block_sales_on_limit=True
        )
    )
    created = await service.create_customer(cust_in)

    # Outstanding = 0, New Invoice = 4000 (Within limit) -> Should Pass
    await service.check_credit_limit(created.id, 4000.00)

    # Outstanding = 0, New Invoice = 6000 (Exceeds limit) -> Should raise HTTP 400
    with pytest.raises(HTTPException) as excinfo:
        await service.check_credit_limit(created.id, 6000.00)
    assert excinfo.value.status_code == 400
    assert "Credit limit exceeded" in str(excinfo.value.detail)
