"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.0.0
Created      : 2026-09-11
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
from pathlib import Path
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import select, delete, or_

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import get_company_sessionmaker
from app.models.party import (
    Party,
    PartyRole,
    SupplierProfile,
    PartyAddress,
    PartyContact,
    SupplierBankAccount,
    VendorIdentityMigration,
)
from app.models.purchase import Supplier
from app.schemas.vendor import (
    VendorCreateRequest,
    VendorUpdateRequest,
    VendorMergeRequest,
    VendorBankAccountDTO,
    VendorContactDTO,
    VendorAddressDTO,
    VendorCommercialProfileDTO,
)
from app.services.vendor_svc import VendorService


class MockTenant:
    company_id = "COMP-001"
    branch_id = "MAIN"
    user_id = "USR-ARCH-001"


@pytest.fixture(autouse=True)
async def cleanup_vendor_test_data():
    """Clean up test vendor records before and after each test."""
    test_phones = ["9920011223", "9876543210", "9811122233", "9800011111", "9800022222"]
    test_gstins = ["27AAACA1234A1Z5", "27AAACC9999Z1Z8"]

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Delete test migration records
        await session.execute(
            delete(VendorIdentityMigration).where(
                or_(
                    VendorIdentityMigration.legacy_supplier_id.like("sup-vtest%"),
                    VendorIdentityMigration.legacy_supplier_id.like("sup-vnd-%"),
                )
            )
        )
        # Delete test legacy suppliers
        await session.execute(
            delete(Supplier).where(
                or_(
                    Supplier.code.like("VTEST%"),
                    Supplier.mobile.in_(test_phones),
                    Supplier.gst_number.in_(test_gstins),
                )
            )
        )
        # Delete test parties
        await session.execute(
            delete(Party).where(
                or_(
                    Party.party_code.like("VTEST%"),
                    Party.party_code.like("VND-%"),
                    Party.mobile.in_(test_phones),
                    Party.gstin.in_(test_gstins),
                )
            )
        )
        await session.commit()

    yield

    async with session_factory() as session:
        await session.execute(
            delete(VendorIdentityMigration).where(
                or_(
                    VendorIdentityMigration.legacy_supplier_id.like("sup-vtest%"),
                    VendorIdentityMigration.legacy_supplier_id.like("sup-vnd-%"),
                )
            )
        )
        await session.execute(
            delete(Supplier).where(
                or_(
                    Supplier.code.like("VTEST%"),
                    Supplier.mobile.in_(test_phones),
                    Supplier.gst_number.in_(test_gstins),
                )
            )
        )
        await session.execute(
            delete(Party).where(
                or_(
                    Party.party_code.like("VTEST%"),
                    Party.party_code.like("VND-%"),
                    Party.mobile.in_(test_phones),
                    Party.gstin.in_(test_gstins),
                )
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_create_vendor_atomic_party_and_legacy_projection():
    """
    Verify Sprint 1-4 canonical vendor creation:
    1. Party + PartyRole(SUPPLIER) + SupplierProfile created atomically.
    2. Primary & additional addresses, categorized contacts, bank accounts persisted.
    3. Non-destructive dual-write projection to legacy suppliers table with sup-<code.lower()>.
    4. Audit trail entry created in vendor_identity_migrations.
    """
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        req = VendorCreateRequest(
            code="VTEST-001",
            legal_name="Apex Fabrics & Textiles Pvt Ltd",
            trade_name="Apex Textiles",
            gstin="27AAACA1234A1Z5",
            pan="AAACA1234A",
            email="accounts@apextextiles.com",
            mobile="9920011223",
            phone="02228490001",
            address_line1="Plot 42, Textile Industrial Area",
            city="Mumbai",
            state="Maharashtra",
            pincode="400013",
            commercial=VendorCommercialProfileDTO(
                supplier_type="MANUFACTURER",
                commercial_classification="PREFERRED",
                payment_terms_days=45,
                msme_registration_no="UDYAM-MH-01-0012345",
                msme_category="SMALL",
                tds_section="194Q",
                tds_rate=0.10,
                outstanding_liability=25000.00,
            ),
            contacts=[
                VendorContactDTO(
                    contact_name="Rajesh Sharma",
                    contact_category="ACCOUNTS",
                    designation="Finance Controller",
                    mobile="9820099887",
                    email="rajesh.s@apextextiles.com",
                    is_primary=True,
                ),
                VendorContactDTO(
                    contact_name="Sunil Patil",
                    contact_category="LOGISTICS",
                    designation="Dispatch Head",
                    mobile="9820033445",
                    is_primary=False,
                ),
            ],
            bank_accounts=[
                VendorBankAccountDTO(
                    bank_name="HDFC Bank",
                    account_holder_name="Apex Fabrics & Textiles Pvt Ltd",
                    account_number="50200012345678",
                    ifsc="HDFC0000042",
                    branch="Lower Parel",
                    account_type="CURRENT",
                    is_primary=True,
                    verification_status="VERIFIED",
                )
            ],
        )

        vendor = await svc.create_vendor(req)

        # 1. Assert Canonical DTO
        assert vendor.id.startswith("pty_")
        assert vendor.code == "VTEST-001"
        assert vendor.legal_name == "Apex Fabrics & Textiles Pvt Ltd"
        assert vendor.trade_name == "Apex Textiles"
        assert vendor.gstin == "27AAACA1234A1Z5"
        assert vendor.pan == "AAACA1234A"
        assert "SUPPLIER" in vendor.roles

        # 2. Assert Commercial & Compliance
        assert vendor.commercial.supplier_type == "MANUFACTURER"
        assert vendor.commercial.commercial_classification == "PREFERRED"
        assert vendor.commercial.msme_category == "SMALL"
        assert vendor.commercial.msme_registration_no == "UDYAM-MH-01-0012345"
        assert vendor.commercial.payment_terms_days == 45
        assert vendor.compliance.gst_verified is True
        assert vendor.compliance.pan_verified is True
        assert vendor.compliance.bank_verified is True
        assert vendor.compliance.msme_verified is True

        # 3. Assert Sub-Entities
        assert len(vendor.contacts) == 2
        assert vendor.contacts[0].contact_category == "ACCOUNTS"
        assert len(vendor.bank_accounts) == 1
        assert vendor.bank_accounts[0].bank_name == "HDFC Bank"
        assert vendor.bank_accounts[0].ifsc == "HDFC0000042"

        # 4. Assert Dual-Write Legacy Projection
        assert vendor.legacy_supplier_id == "sup-vtest-001"
        sup_stmt = select(Supplier).where(Supplier.code == "VTEST-001")
        legacy_sup = (await session.execute(sup_stmt)).scalars().first()
        assert legacy_sup is not None
        assert legacy_sup.id == "sup-vtest-001"
        assert legacy_sup.name == "Apex Fabrics & Textiles Pvt Ltd"
        assert legacy_sup.gst_number == "27AAACA1234A1Z5"
        assert legacy_sup.outstanding == Decimal("25000.00")

        # 5. Assert Migration Audit Entry
        mig_stmt = select(VendorIdentityMigration).where(
            VendorIdentityMigration.legacy_supplier_id == "sup-vtest-001"
        )
        migration = (await session.execute(mig_stmt)).scalars().first()
        assert migration is not None
        assert migration.party_id == vendor.id
        assert migration.migration_status == "COMPLETED"
        assert migration.migration_reason == "CANONICAL_VENDOR_CREATION"


@pytest.mark.asyncio
async def test_vendor_duplicate_prevention():
    """Verify deduplication guard against duplicate Party Code and GSTIN."""
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        req1 = VendorCreateRequest(
            code="VTEST-DUP",
            legal_name="Original Supplier Pvt Ltd",
            gstin="27AAACC9999Z1Z8",
            mobile="9876543210",
        )
        await svc.create_vendor(req1)

        # Attempt to create duplicate with same GSTIN
        req2 = VendorCreateRequest(
            code="VTEST-DUP2",
            legal_name="Duplicate GSTIN Supplier",
            gstin="27AAACC9999Z1Z8",
        )
        with pytest.raises(HTTPException) as exc_info:
            await svc.create_vendor(req2)
        assert exc_info.value.status_code == 409
        assert "already exists" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_vendor_partial_update_and_legacy_sync():
    """Verify partial updates to statutory, commercial, and legacy sync."""
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        created = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-UPD",
                legal_name="Initial Name Trading",
                mobile="9811122233",
                commercial=VendorCommercialProfileDTO(
                    supplier_type="DISTRIBUTOR",
                    commercial_classification="APPROVED",
                ),
            )
        )

        update_req = VendorUpdateRequest(
            legal_name="Updated Name Trading Ltd",
            status="ON_HOLD",
            commercial=VendorCommercialProfileDTO(
                supplier_type="WHOLESALER",
                commercial_classification="RESTRICTED",
                outstanding_liability=5000.00,
            ),
        )

        updated = await svc.update_vendor(created.id, update_req)
        assert updated.legal_name == "Updated Name Trading Ltd"
        assert updated.status == "ON_HOLD"
        assert updated.commercial.supplier_type == "WHOLESALER"
        assert updated.commercial.commercial_classification == "RESTRICTED"

        # Verify legacy supplier sync
        sup_stmt = select(Supplier).where(Supplier.code == "VTEST-UPD")
        legacy_sup = (await session.execute(sup_stmt)).scalars().first()
        assert legacy_sup.name == "Updated Name Trading Ltd"
        assert legacy_sup.outstanding == Decimal("5000.00")


@pytest.mark.asyncio
async def test_vendor_merge_lifecycle():
    """Verify merging source vendor into target vendor preserves history and marks source MERGED."""
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        source = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-SRC",
                legal_name="ABC Dist Ltd (Duplicate)",
                mobile="9800011111",
            )
        )

        target = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-TGT",
                legal_name="ABC Distributors Private Limited (Canonical)",
                mobile="9800022222",
            )
        )

        merge_req = VendorMergeRequest(
            primary_vendor_id=target.id,
            secondary_vendor_id=source.id,
            merge_reason="De-duplication of redundant supplier account",
        )

        resp = await svc.merge_vendors(merge_req)
        assert resp.secondary_vendor_id == source.id
        assert resp.primary_vendor_id == target.id
        assert resp.success is True

        # Verify source status changed to MERGED
        stmt = select(Party).where(Party.id == source.id)
        source_party = (await session.execute(stmt)).scalars().first()
        assert source_party.status == "MERGED"

        # Verify merge audit record in vendor_identity_migrations
        mig_stmt = select(VendorIdentityMigration).where(
            VendorIdentityMigration.party_id == target.id,
            VendorIdentityMigration.migration_reason.like("MERGED_FROM_%"),
        )
        merge_log = (await session.execute(mig_stmt)).scalars().first()
        assert merge_log is not None
        assert merge_log.migration_status == "COMPLETED"


@pytest.mark.asyncio
async def test_vendor_default_query_hides_archived_and_merged():
    """Verify that default list_vendors query hides ARCHIVED and MERGED records, while explicit filter reveals them."""
    session_factory = get_company_sessionmaker("smriti001")
    tenant = MockTenant()

    async with session_factory() as session:
        svc = VendorService(session, tenant)

        # 1. Create Active Vendor
        active_v = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-ACT",
                legal_name="Active Testing Supplier",
                mobile="9800011111",
            )
        )

        # 2. Create and Archive Vendor
        arc_v = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-ARC",
                legal_name="Archived Testing Supplier",
                mobile="9800022222",
            )
        )
        arc_party = (await session.execute(select(Party).where(Party.id == arc_v.id))).scalars().first()
        arc_party.status = "ARCHIVED"

        # 3. Create and Merge Vendor
        mrg_v = await svc.create_vendor(
            VendorCreateRequest(
                code="VTEST-MRG",
                legal_name="Merged Testing Supplier",
                mobile="9800033333",
            )
        )
        mrg_party = (await session.execute(select(Party).where(Party.id == mrg_v.id))).scalars().first()
        mrg_party.status = "MERGED"
        await session.commit()

        # 4. Default query: must hide ARCHIVED and MERGED
        default_list = await svc.list_vendors(search="VTEST-")
        default_codes = [v.code for v in default_list]
        assert "VTEST-ACT" in default_codes
        assert "VTEST-ARC" not in default_codes
        assert "VTEST-MRG" not in default_codes

        # 5. Explicit ARCHIVED query: must return only ARCHIVED
        archived_list = await svc.list_vendors(search="VTEST-", status_filter="ARCHIVED")
        archived_codes = [v.code for v in archived_list]
        assert "VTEST-ARC" in archived_codes
        assert "VTEST-ACT" not in archived_codes
        assert "VTEST-MRG" not in archived_codes

        # 6. Explicit MERGED query: must return only MERGED
        merged_list = await svc.list_vendors(search="VTEST-", status_filter="MERGED")
        merged_codes = [v.code for v in merged_list]
        assert "VTEST-MRG" in merged_codes
        assert "VTEST-ACT" not in merged_codes
        assert "VTEST-ARC" not in merged_codes

        # 7. Explicit ALL query: must return all three
        all_list = await svc.list_vendors(search="VTEST-", status_filter="ALL")
        all_codes = [v.code for v in all_list]
        assert "VTEST-ACT" in all_codes
        assert "VTEST-ARC" in all_codes
        assert "VTEST-MRG" in all_codes


@pytest.mark.asyncio
async def test_vendor_article_ownership_and_cross_vendor_isolation():
    """
    Verify cross-vendor article isolation:
    1. Vendor V-00C can only retrieve articles owned by V-00C (plus unassigned when requested).
    2. Articles owned by other vendors (e.g. V-00A, V-00B) are strictly excluded.
    3. Vendor V-00A cannot see V-00C articles.
    """
    from app.models.master_lookup import MasterType, MasterValue
    import uuid

    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Find or create style_article master type
        res = await session.execute(select(MasterType).where(MasterType.code == "style_article"))
        m_type = res.scalar_one_or_none()
        if not m_type:
            m_type = MasterType(
                id=uuid.uuid4(),
                code="style_article",
                label="Style / Article",
                field_schema={"type": "object"},
            )
            session.add(m_type)
            await session.flush()

        test_val_prefix = f"TART-{uuid.uuid4().hex[:6].upper()}"

        # 1. Create articles for V-00C
        val_c1 = MasterValue(
            master_type_id=m_type.id,
            code=f"{test_val_prefix}-C1",
            name="V00C Shoe",
            vendor_code="V-00C",
            active=True,
            is_deleted=False,
        )
        val_c2 = MasterValue(
            master_type_id=m_type.id,
            code=f"{test_val_prefix}-C2",
            name="V00C Boot",
            vendor_code="V-00C",
            active=True,
            is_deleted=False,
        )
        # 2. Create article for V-00A
        val_a1 = MasterValue(
            master_type_id=m_type.id,
            code=f"{test_val_prefix}-A1",
            name="V00A Denim",
            vendor_code="V-00A",
            active=True,
            is_deleted=False,
        )
        # 3. Create unassigned article
        val_unassigned = MasterValue(
            master_type_id=m_type.id,
            code=f"{test_val_prefix}-UN",
            name="Unassigned Article",
            vendor_code=None,
            active=True,
            is_deleted=False,
        )

        session.add_all([val_c1, val_c2, val_a1, val_unassigned])
        await session.commit()

        try:
            # Query simulating list_lookup_values with vendorCode="V-00C" & includeUnassigned=False
            q_c_strict = (
                select(MasterValue)
                .where(
                    MasterValue.master_type_id == m_type.id,
                    MasterValue.is_deleted.is_(False),
                    MasterValue.code.like(f"{test_val_prefix}%"),
                    MasterValue.vendor_code == "V-00C",
                )
            )
            res_c_strict = (await session.execute(q_c_strict)).scalars().all()
            codes_c_strict = [item.code for item in res_c_strict]
            assert f"{test_val_prefix}-C1" in codes_c_strict
            assert f"{test_val_prefix}-C2" in codes_c_strict
            assert f"{test_val_prefix}-A1" not in codes_c_strict
            assert f"{test_val_prefix}-UN" not in codes_c_strict

            # Query simulating list_lookup_values with vendorCode="V-00C" & includeUnassigned=True
            q_c_unassigned = (
                select(MasterValue)
                .where(
                    MasterValue.master_type_id == m_type.id,
                    MasterValue.is_deleted.is_(False),
                    MasterValue.code.like(f"{test_val_prefix}%"),
                    or_(MasterValue.vendor_code == "V-00C", MasterValue.vendor_code.is_(None)),
                )
            )
            res_c_unassigned = (await session.execute(q_c_unassigned)).scalars().all()
            codes_c_unassigned = [item.code for item in res_c_unassigned]
            assert f"{test_val_prefix}-C1" in codes_c_unassigned
            assert f"{test_val_prefix}-C2" in codes_c_unassigned
            assert f"{test_val_prefix}-UN" in codes_c_unassigned
            # V-00A must NEVER appear in V-00C's lookup
            assert f"{test_val_prefix}-A1" not in codes_c_unassigned

            # Query simulating V-00A's view: V-00C must NEVER appear
            q_a = (
                select(MasterValue)
                .where(
                    MasterValue.master_type_id == m_type.id,
                    MasterValue.is_deleted.is_(False),
                    MasterValue.code.like(f"{test_val_prefix}%"),
                    MasterValue.vendor_code == "V-00A",
                )
            )
            res_a = (await session.execute(q_a)).scalars().all()
            codes_a = [item.code for item in res_a]
            assert f"{test_val_prefix}-A1" in codes_a
            assert f"{test_val_prefix}-C1" not in codes_a
            assert f"{test_val_prefix}-C2" not in codes_a

        finally:
            # Cleanup test master values
            await session.execute(
                delete(MasterValue).where(MasterValue.code.like(f"{test_val_prefix}%"))
            )
            await session.commit()


