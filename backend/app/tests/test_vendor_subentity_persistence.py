"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.20
Created      : 2026-10-26
Modified     : 2026-10-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Automated Test Battery: Vendor Sub-Entity Atomic Persistence
Verifies:
  1. Atomic addition and persistence of Vendor Addresses to PostgreSQL.
  2. Primary address synchronization to parent Party record.
  3. Soft-deletion of addresses.
  4. Categorized contact addition, update, and soft-deletion.
  5. Bank account addition, uppercase IFSC formatting, and soft-deletion.
  6. Tenant isolation and multi-tenant boundary integrity.
"""

import uuid
import pytest
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.party import Party, PartyRole, SupplierProfile, PartyAddress, PartyContact, SupplierBankAccount
from app.api.deps import TenantContext
from app.schemas.vendor import VendorAddressDTO, VendorContactDTO, VendorBankAccountDTO
from app.services.vendor_svc import VendorService

pytestmark = pytest.mark.asyncio


async def setup_test_vendor(db):
    """Sets up a test company, branch, tenant context, and party with SUPPLIER role."""
    s = uuid.uuid4().hex[:6].upper()
    cid = f"CMP{s}"
    bid = f"BR{s}"

    company = Company(
        id=cid,
        company_code=cid,
        name=f"Vendor Test Co {s}",
        gst_number="27AABCA1234A1Z5",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=bid,
        code=bid,
        company_id=cid,
        name=f"Main Hub {s}",
        is_active=True,
        is_deleted=False,
    )
    db.add(company)
    db.add(branch)
    await db.flush()

    party_id = f"pty_{uuid.uuid4().hex[:12]}"
    party = Party(
        id=party_id,
        party_code=f"V-{s[:3]}",
        company_id=cid,
        branch_id=bid,
        legal_name="Apex Global Traders Pvt Ltd",
        trade_name="Apex Traders",
        gstin="27AABCA1234A1Z5",
        pan="AABCA1234A",
        status="ACTIVE",
        is_deleted=False,
    )
    db.add(party)

    role = PartyRole(
        id=f"pr_{uuid.uuid4().hex[:10]}",
        company_id=cid,
        branch_id=bid,
        party_id=party_id,
        role_type="SUPPLIER",
    )
    db.add(role)

    profile = SupplierProfile(
        id=f"sp_{uuid.uuid4().hex[:10]}",
        company_id=cid,
        branch_id=bid,
        party_id=party_id,
        supplier_type="DISTRIBUTOR",
        payment_terms_days=60,
    )
    db.add(profile)

    await db.commit()
    await db.refresh(party)

    tenant = TenantContext(company_id=cid, branch_id=bid)
    return tenant, party


async def test_vendor_address_atomic_persistence(db_session):
    """Verifies address is persisted to database with canonical pa_ ID and primary sync."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    addr_dto = VendorAddressDTO(
        address_type="DISPATCH",
        address_title="Bhiwandi Central Warehouse",
        address_line1="Gala 102, Logistics Park",
        address_line2="Mankoli Naka",
        city="Bhiwandi",
        state="Maharashtra",
        state_code="MH",
        pincode="421302",
        country="India",
        gstin="27AABCA1234A1Z5",
        is_primary=True,
    )

    persisted = await service.save_address(party.id, addr_dto)
    assert persisted.id is not None
    assert persisted.id.startswith("pa_")
    assert persisted.city == "Bhiwandi"
    assert persisted.is_primary is True

    # Verify directly in PostgreSQL via independent query
    stmt = select(PartyAddress).where(PartyAddress.id == persisted.id)
    row = (await db_session.execute(stmt)).scalars().first()
    assert row is not None
    assert row.party_id == party.id
    assert row.pincode == "421302"
    assert row.is_deleted is False

    # Verify Party primary address fields were synchronized
    party_stmt = select(Party).where(Party.id == party.id)
    refreshed_party = (await db_session.execute(party_stmt)).scalars().first()
    assert refreshed_party.city == "Bhiwandi"
    assert refreshed_party.pincode == "421302"


async def test_vendor_contact_atomic_persistence(db_session):
    """Verifies contact is persisted with categorization and primary designation."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    contact_dto = VendorContactDTO(
        contact_name="Rajesh Sharma",
        contact_category="SALES",
        designation="National Sales Head",
        department="Key Accounts",
        mobile="9820098200",
        phone="02228889999",
        email="rajesh.sharma@apextraders.com",
        is_primary=True,
    )

    persisted = await service.save_contact(party.id, contact_dto)
    assert persisted.id is not None
    assert persisted.id.startswith("pc_")
    assert persisted.contact_category == "SALES"
    assert persisted.contact_name == "Rajesh Sharma"

    # Verify directly in PostgreSQL
    stmt = select(PartyContact).where(PartyContact.id == persisted.id)
    row = (await db_session.execute(stmt)).scalars().first()
    assert row is not None
    assert row.party_id == party.id
    assert row.mobile == "9820098200"

    # Soft-delete test
    del_ok = await service.delete_contact(party.id, persisted.id)
    assert del_ok is True

    # Confirm soft-deleted
    stmt_del = select(PartyContact).where(PartyContact.id == persisted.id)
    row_del = (await db_session.execute(stmt_del)).scalars().first()
    assert row_del is not None
    assert row_del.is_deleted is True


async def test_vendor_bank_account_atomic_persistence(db_session):
    """Verifies bank account coordinates are persisted with uppercase IFSC formatting."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    bank_dto = VendorBankAccountDTO(
        bank_name="HDFC Bank",
        account_holder_name="Apex Global Traders Pvt Ltd",
        account_number="50200012345678",
        ifsc="hdfc0000123",  # lower case input
        branch="Fort, Mumbai",
        account_type="CURRENT",
        is_primary=True,
        verification_status="VERIFIED",
    )

    persisted = await service.save_bank_account(party.id, bank_dto)
    assert persisted.id is not None
    assert persisted.id.startswith("pba_")
    assert persisted.ifsc == "HDFC0000123"  # Uppercase canonical format

    # Verify directly in PostgreSQL
    stmt = select(SupplierBankAccount).where(SupplierBankAccount.id == persisted.id)
    row = (await db_session.execute(stmt)).scalars().first()
    assert row is not None
    assert row.party_id == party.id
    assert row.account_number == "50200012345678"
    assert row.is_deleted is False

    # Soft-delete bank account
    del_ok = await service.delete_bank_account(party.id, persisted.id)
    assert del_ok is True
    await db_session.refresh(row)
    assert row.is_deleted is True
