"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import pytest
import uuid
from decimal import Decimal
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import Supplier
from app.services.supplier import SupplierService
from app.repositories.supplier import SupplierRepository
from app.api.deps import TenantContext
from app.db.session import active_tenant_ctx
from app.schemas.purchase import (
    SupplierCreate,
    SupplierTaxProfileCreate,
    SupplierComplianceProfileCreate,
    SupplierPaymentProfileCreate,
    SupplierCreditProfileCreate,
    SupplierBankDetailsCreate,
    SupplierAddressCreate,
    SupplierContactCreate,
)


async def _setup_supplier_tenant(db_session: AsyncSession) -> TenantContext:
    from app.models.tenant import Company, Branch
    company_id = f"cmp-{uuid.uuid4().hex[:8]}"
    branch_id = f"br-{uuid.uuid4().hex[:8]}"

    comp = Company(id=company_id, uuid=str(uuid.uuid4()), name="Test Supplier Company", is_active=True)
    branch = Branch(id=branch_id, uuid=str(uuid.uuid4()), company_id=company_id, name="Main Branch", code=f"BR-{uuid.uuid4().hex[:4]}", is_active=True)
    db_session.add_all([comp, branch])
    await db_session.commit()

    ctx = TenantContext(tenant_id="test-tenant", company_id=company_id, branch_id=branch_id)
    active_tenant_ctx.set(ctx)
    return ctx


@pytest.mark.asyncio
async def test_create_supplier_aggregate_root_with_auto_code(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)

    supplier_in = SupplierCreate(
        name="Global Tech Distributors Pvt Ltd",
        trade_name="Global Tech",
        mobile="9876500001",
        email="info@globaltech.com",
        tax_profile=SupplierTaxProfileCreate(
            pan_number="ABCDE1234F",
            gstin="27ABCDE1234F1Z5",
            is_tds_applicable=True,
            tds_section_id="194Q",
            tds_rate=Decimal("0.10")
        ),
        compliance_profile=SupplierComplianceProfileCreate(
            msme_category="Small",
            msme_number="UDYAM-MH-00-1234567",
            verification_status="Verified"
        ),
        payment_profile=SupplierPaymentProfileCreate(
            payment_terms_id="NET30",
            payment_mode_id="NEFT",
            currency_id="INR"
        ),
        credit_profile=SupplierCreditProfileCreate(
            credit_limit=Decimal("500000.00"),
            credit_days=30,
            opening_balance=Decimal("15000.00"),
            opening_balance_type="Cr"
        ),
        bank_details=[
            SupplierBankDetailsCreate(
                bank_name="State Bank of India",
                branch_name="BKC Mumbai",
                account_name="Global Tech Distributors",
                account_number="300123456789",
                ifsc_code="SBIN0001234",
                is_primary=True
            )
        ],
        addresses=[
            SupplierAddressCreate(
                address_type_id="Billing",
                building_name="Tech Park Tower A",
                street="Bandra Kurla Complex",
                city="Mumbai",
                state="Maharashtra",
                pincode="400051",
                is_primary=True
            )
        ],
        contacts=[
            SupplierContactCreate(
                contact_type_id="Accounts",
                name="Rakesh Sharma",
                designation="Accounts Manager",
                mobile="9876500002",
                email="accounts@globaltech.com",
                is_primary=True
            )
        ]
    )

    created = await service.create_supplier(supplier_in)

    assert created is not None
    assert created.code == "SUP-100001"
    assert created.name == "Global Tech Distributors Pvt Ltd"
    assert created.tax_profile is not None
    assert created.tax_profile.gstin == "27ABCDE1234F1Z5"
    assert created.compliance_profile is not None
    assert created.compliance_profile.msme_category == "Small"
    assert created.payment_profile is not None
    assert created.payment_profile.payment_terms_id == "NET30"
    assert created.credit_profile is not None
    assert created.credit_profile.credit_limit == Decimal("500000.00")
    assert len(created.bank_details) == 1
    assert created.bank_details[0].ifsc_code == "SBIN0001234"
    assert len(created.addresses) == 1
    assert len(created.contacts) == 1


@pytest.mark.asyncio
async def test_invalid_pan_gstin_and_ifsc_regex_raises_validation_error():
    # Invalid PAN
    with pytest.raises(ValidationError):
        SupplierTaxProfileCreate(pan_number="INVALID_PAN_123")

    # Invalid GSTIN
    with pytest.raises(ValidationError):
        SupplierTaxProfileCreate(gstin="INVALID_GSTIN_FORMAT")

    # Invalid IFSC
    with pytest.raises(ValidationError):
        SupplierBankDetailsCreate(
            bank_name="Test Bank",
            account_name="Test Account",
            account_number="123456",
            ifsc_code="INVALID_IFSC"
        )


@pytest.mark.asyncio
async def test_procurement_quick_search_by_code_name_tradename_mobile_gstin(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)
    repo = SupplierRepository(db_session, tenant_ctx)

    s1 = SupplierCreate(
        name="Apex Trading Enterprises",
        trade_name="Apex Retail",
        mobile="9111100001",
        tax_profile=SupplierTaxProfileCreate(gstin="27AAAAA0000A1Z5")
    )
    created1 = await service.create_supplier(s1)

    s2 = SupplierCreate(
        name="Zenith Logistics Ltd",
        trade_name="Zenith Express",
        mobile="9222200002",
        tax_profile=SupplierTaxProfileCreate(gstin="27BBBBB1111B1Z5")
    )
    await service.create_supplier(s2)

    # Search by Code
    res_code = await repo.search(q=created1.code)
    assert len(res_code) == 1
    assert res_code[0].name == "Apex Trading Enterprises"

    # Search by Trade Name
    res_trade = await repo.search(q="Zenith Express")
    assert len(res_trade) == 1
    assert res_trade[0].name == "Zenith Logistics Ltd"

    # Search by GSTIN
    res_gstin = await repo.search(q="27AAAAA0000A1Z5")
    assert len(res_gstin) == 1
    assert res_gstin[0].name == "Apex Trading Enterprises"


@pytest.mark.asyncio
async def test_single_primary_bank_account_enforcement(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)

    supplier_in = SupplierCreate(
        name="Multi Bank Vendor",
        mobile="9333300003",
        bank_details=[
            SupplierBankDetailsCreate(
                bank_name="HDFC Bank",
                account_name="Multi Bank Vendor",
                account_number="501000123456",
                ifsc_code="HDFC0000123",
                is_primary=True
            ),
            SupplierBankDetailsCreate(
                bank_name="ICICI Bank",
                account_name="Multi Bank Vendor",
                account_number="000401500999",
                ifsc_code="ICIC0000004",
                is_primary=True  # Second primary attempted
            )
        ]
    )

    created = await service.create_supplier(supplier_in)

    assert len(created.bank_details) == 2
    # Service logic must ensure only 1 primary bank account is flagged true
    primary_count = sum(1 for b in created.bank_details if b.is_primary)
    assert primary_count == 1


@pytest.mark.asyncio
async def test_duplicate_mobile_or_code_raises_http_400(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)

    s1 = SupplierCreate(
        name="Original Supplier",
        mobile="9444400004"
    )
    await service.create_supplier(s1)

    s2 = SupplierCreate(
        name="Duplicate Mobile Supplier",
        mobile="9444400004"
    )
    with pytest.raises(HTTPException) as excinfo:
        await service.create_supplier(s2)
    assert excinfo.value.status_code == 400
    assert "already exists" in str(excinfo.value.detail)


@pytest.mark.asyncio
async def test_multi_tenant_isolation_prevents_cross_company_access(db_session):
    tenant_a = await _setup_supplier_tenant(db_session)
    service_a = SupplierService(db_session, tenant_a)

    tenant_b = await _setup_supplier_tenant(db_session)
    repo_b = SupplierRepository(db_session, tenant_b)

    # Create Supplier under Tenant A
    s_a = SupplierCreate(
        name="Tenant A Confidential Supplier",
        mobile="9555500005"
    )
    await service_a.create_supplier(s_a)

    # Tenant B search by mobile -> Must return empty list
    res_b = await repo_b.search(q="9555500005")
    assert len(res_b) == 0


@pytest.mark.asyncio
async def test_soft_delete_supplier_hides_from_queries_and_preserves_audit(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)
    repo = SupplierRepository(db_session, tenant_ctx)

    s_in = SupplierCreate(
        name="Soft Delete Supplier Ltd",
        mobile="9666600006"
    )
    created = await service.create_supplier(s_in)

    # Soft delete supplier
    deleted = await service.delete_supplier(created.id)
    assert deleted is True

    # Active repository search must not return soft-deleted supplier
    search_res = await repo.search(q="9666600006")
    assert len(search_res) == 0

    # Direct database query confirms record exists with is_deleted=True for audit trail
    stmt = select(Supplier).filter(Supplier.id == created.id)
    raw_res = await db_session.execute(stmt)
    raw_supp = raw_res.scalars().first()
    assert raw_supp is not None
    assert raw_supp.is_deleted is True


@pytest.mark.asyncio
async def test_supplier_type_master_lookup_validation(db_session):
    tenant_ctx = await _setup_supplier_tenant(db_session)
    service = SupplierService(db_session, tenant_ctx)

    # Attempt to create supplier with invalid supplier_type_id
    invalid_s = SupplierCreate(
        name="Invalid Type Vendor",
        mobile="9999900009",
        supplier_type_id="NON_EXISTENT_SUPPLIER_TYPE"
    )
    with pytest.raises(HTTPException) as excinfo:
        await service.create_supplier(invalid_s)
    assert excinfo.value.status_code == 400
    assert "Master Lookup framework" in str(excinfo.value.detail)
