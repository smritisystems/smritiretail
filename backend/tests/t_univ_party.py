"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker
from app.services.party_service import UniversalPartyService
from app.models.party import Party, PartyRole, CustomerProfile, SupplierProfile


@pytest.fixture(autouse=True)
async def cleanup_test_parties():
    """Clean up test parties before and after each test."""
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(Party).where(Party.party_code.like("PTY-%")))
            await session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as session:
            await session.execute(delete(Party).where(Party.party_code.like("PTY-%")))
            await session.commit()


@pytest.mark.asyncio
async def test_create_and_fetch_universal_party_customer():
    """Verify creating a party with CUSTOMER role and customer profile."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        party = await UniversalPartyService.create_party(
            session=session,
            company_id="COMP-001",
            party_code="PTY-CUST-SOLO-01",
            legal_name="Apex Retail Traders Pvt Ltd",
            trade_name="Apex Superstore",
            gstin="27AAACA1234A1Z5",
            pan="AAACA1234A",
            email="contact@apexsuperstore.com",
            mobile="9820011223",
            roles=["CUSTOMER"],
            customer_data={
                "customer_category": "WHOLESALE",
                "credit_limit": 500000.00,
                "credit_days": 30,
                "tax_category": "B2B"
            }
        )

        assert party is not None
        assert party.party_code == "PTY-CUST-SOLO-01"
        assert party.legal_name == "Apex Retail Traders Pvt Ltd"
        assert len(party.roles) == 1
        assert party.roles[0].role_type == "CUSTOMER"
        assert party.customer_profile is not None
        assert float(party.customer_profile.credit_limit) == 500000.00
        assert party.customer_profile.tax_category == "B2B"
        assert party.supplier_profile is None


@pytest.mark.asyncio
async def test_expand_party_to_dual_role_supplier():
    """Verify extending an existing party to dual role (CUSTOMER + SUPPLIER) without row duplication."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # 1. First create party with CUSTOMER role
        party = await UniversalPartyService.create_party(
            session=session,
            company_id="COMP-001",
            party_code="PTY-DUAL-ROLE-02",
            legal_name="Metro Global Distributors LLP",
            roles=["CUSTOMER"],
            customer_data={"customer_category": "RETAIL"}
        )
        assert len(party.roles) == 1
        assert party.supplier_profile is None

        # 2. Update existing party with SUPPLIER role as well
        party = await UniversalPartyService.create_party(
            session=session,
            company_id="COMP-001",
            party_code="PTY-DUAL-ROLE-02",
            legal_name="Metro Global Distributors LLP",
            roles=["CUSTOMER", "SUPPLIER"],
            supplier_data={
                "supplier_type": "DISTRIBUTOR",
                "payment_terms_days": 45,
                "msme_registration_no": "UDYAM-MH-01-0012345"
            }
        )

        assert party is not None
        assert party.party_code == "PTY-DUAL-ROLE-02"
        
        # Verify dual roles
        role_types = [r.role_type for r in party.roles]
        assert "CUSTOMER" in role_types
        assert "SUPPLIER" in role_types
        assert len(role_types) == 2

        # Verify both profiles exist on single party
        assert party.customer_profile is not None
        assert party.supplier_profile is not None
        assert party.supplier_profile.supplier_type == "DISTRIBUTOR"
        assert party.supplier_profile.payment_terms_days == 45


@pytest.mark.asyncio
async def test_party_tenant_isolation():
    """Verify party created in smriti001 is completely isolated from smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        await UniversalPartyService.create_party(
            session=s1,
            company_id="COMP-001",
            party_code="PTY-ISO-03",
            legal_name="Isolated Company Tenant Ltd",
            roles=["CUSTOMER"]
        )
        p1 = await UniversalPartyService.get_party_by_code(s1, "PTY-ISO-03")
        assert p1 is not None

    async with session_002() as s2:
        p2 = await UniversalPartyService.get_party_by_code(s2, "PTY-ISO-03")
        assert p2 is None, "Expected party from smriti001 not to exist in smriti002!"
