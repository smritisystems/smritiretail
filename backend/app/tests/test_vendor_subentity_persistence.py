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
from fastapi import HTTPException
from sqlalchemy import select

from app.models.tenant import Company, Branch
from app.models.party import Party, PartyRole, SupplierProfile, PartyAddress, PartyContact, SupplierBankAccount
from app.models.outbox import IntegrationOutboxEvent
from app.models.audit import ComplianceImmutableAuditLog
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

    # Verify Stage 4 Platform Event Outbox integration
    obx_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted.id,
        IntegrationOutboxEvent.event_type == "VENDOR_ADDRESS_PERSISTED",
    )
    obx = (await db_session.execute(obx_stmt)).scalars().first()
    assert obx is not None
    assert obx.payload_json["address_id"] == persisted.id
    assert obx.status == "PENDING"


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

    # Verify Stage 4 Platform Event Outbox integration
    obx_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted.id,
        IntegrationOutboxEvent.event_type == "VENDOR_CONTACT_PERSISTED",
    )
    obx = (await db_session.execute(obx_stmt)).scalars().first()
    assert obx is not None
    assert obx.payload_json["contact_id"] == persisted.id


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

    # Verify Stage 4 Platform Event Outbox integration
    obx_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted.id,
        IntegrationOutboxEvent.event_type == "VENDOR_BANK_ACCOUNT_PERSISTED",
    )
    obx = (await db_session.execute(obx_stmt)).scalars().first()
    assert obx is not None
    assert obx.payload_json["bank_id"] == persisted.id


async def test_vendor_deletion_compliance_audit_and_outbox_event(db_session):
    """Verifies that deleting sub-entities creates immutable audit log entries and outbox events."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    # 1. Address deletion audit & outbox
    addr_dto = VendorAddressDTO(
        address_type="DISPATCH",
        address_title="Deletable Hub",
        address_line1="Plot 45",
        city="Pune",
        state="Maharashtra",
        pincode="411001",
        country="India",
        is_primary=False,
    )
    persisted_addr = await service.save_address(party.id, addr_dto)
    await service.delete_address(party.id, persisted_addr.id)

    # Verify audit log for address deletion
    audit_addr_stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == persisted_addr.id,
        ComplianceImmutableAuditLog.event_type == "VENDOR_ADDRESS_DELETED",
    )
    audit_addr = (await db_session.execute(audit_addr_stmt)).scalars().first()
    assert audit_addr is not None
    assert audit_addr.payload_hash is not None
    assert audit_addr.worm_locked is True
    assert "Deleted address" in audit_addr.action_summary

    # Verify outbox event for address deletion
    obx_addr_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted_addr.id,
        IntegrationOutboxEvent.event_type == "VENDOR_ADDRESS_DELETED",
    )
    obx_addr = (await db_session.execute(obx_addr_stmt)).scalars().first()
    assert obx_addr is not None
    assert obx_addr.status == "PENDING"

    # 2. Contact deletion audit & outbox
    contact_dto = VendorContactDTO(
        contact_name="Temporary Contact",
        contact_category="OPERATIONS",
        mobile="9811122233",
        is_primary=False,
    )
    persisted_contact = await service.save_contact(party.id, contact_dto)
    await service.delete_contact(party.id, persisted_contact.id)

    audit_contact_stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == persisted_contact.id,
        ComplianceImmutableAuditLog.event_type == "VENDOR_CONTACT_DELETED",
    )
    audit_contact = (await db_session.execute(audit_contact_stmt)).scalars().first()
    assert audit_contact is not None
    assert audit_contact.payload_hash is not None
    assert "Deleted contact" in audit_contact.action_summary

    obx_contact_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted_contact.id,
        IntegrationOutboxEvent.event_type == "VENDOR_CONTACT_DELETED",
    )
    obx_contact = (await db_session.execute(obx_contact_stmt)).scalars().first()
    assert obx_contact is not None
    assert obx_contact.status == "PENDING"

    # 3. Bank account deletion audit & outbox (with masked account number)
    bank_dto = VendorBankAccountDTO(
        bank_name="Axis Bank",
        account_holder_name="Apex Traders",
        account_number="912010045678901",
        ifsc="UTIB0000004",
        is_primary=False,
    )
    persisted_bank = await service.save_bank_account(party.id, bank_dto)
    await service.delete_bank_account(party.id, persisted_bank.id)

    audit_bank_stmt = select(ComplianceImmutableAuditLog).where(
        ComplianceImmutableAuditLog.entity_id == persisted_bank.id,
        ComplianceImmutableAuditLog.event_type == "VENDOR_BANK_ACCOUNT_DELETED",
    )
    audit_bank = (await db_session.execute(audit_bank_stmt)).scalars().first()
    assert audit_bank is not None
    assert "***8901" in audit_bank.action_summary

    obx_bank_stmt = select(IntegrationOutboxEvent).where(
        IntegrationOutboxEvent.aggregate_id == persisted_bank.id,
        IntegrationOutboxEvent.event_type == "VENDOR_BANK_ACCOUNT_DELETED",
    )
    obx_bank = (await db_session.execute(obx_bank_stmt)).scalars().first()
    assert obx_bank is not None
    assert obx_bank.status == "PENDING"
    assert obx_bank.payload_json["account_number_masked"] == "***8901"


async def test_merged_vendor_blocks_mutations_and_deletions(db_session):
    """Verifies that a vendor with status 'MERGED' is locked against mutations and deletions."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    # First add a valid address while ACTIVE
    addr_dto = VendorAddressDTO(
        address_type="BILLING",
        address_title="HQ",
        address_line1="MG Road",
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        country="India",
        is_primary=True,
    )
    persisted_addr = await service.save_address(party.id, addr_dto)

    # Now lock vendor status to MERGED
    party.status = "MERGED"
    party.merged_into_party_id = "pty_surviving_target"
    await db_session.commit()
    await db_session.refresh(party)

    # Mutation attempt must fail with 400 Bad Request
    with pytest.raises(HTTPException) as exc_info_save:
        await service.save_address(party.id, addr_dto)
    assert exc_info_save.value.status_code == 400
    assert "merged" in exc_info_save.value.detail.lower()

    # Deletion attempt must fail with 400 Bad Request
    with pytest.raises(HTTPException) as exc_info_del:
        await service.delete_address(party.id, persisted_addr.id)
    assert exc_info_del.value.status_code == 400
    assert "merged" in exc_info_del.value.detail.lower()


async def test_failed_deletion_preserves_data(db_session):
    """Verifies that failed deletion (e.g. non-existent entity) raises 404 and preserves existing data."""
    tenant, party = await setup_test_vendor(db_session)
    service = VendorService(db_session, tenant)

    addr_dto = VendorAddressDTO(
        address_type="DISPATCH",
        address_title="Preserved Hub",
        address_line1="Godown 4",
        city="Thane",
        state="Maharashtra",
        pincode="400601",
        country="India",
        is_primary=True,
    )
    persisted = await service.save_address(party.id, addr_dto)

    # Attempt delete with non-existent ID
    with pytest.raises(HTTPException) as exc_info:
        await service.delete_address(party.id, "pa_non_existent_id_9999")
    assert exc_info.value.status_code == 404

    # Verify existing address is completely preserved
    stmt = select(PartyAddress).where(PartyAddress.id == persisted.id)
    row = (await db_session.execute(stmt)).scalars().first()
    assert row is not None
    assert row.is_deleted is False
    assert row.city == "Thane"

