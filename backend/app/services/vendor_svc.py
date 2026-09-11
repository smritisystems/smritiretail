"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-09-11
Modified     : 2026-09-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import select, or_, and_, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.party import (
    Party,
    PartyRole,
    SupplierProfile,
    PartyAddress,
    PartyContact,
    SupplierBankAccount,
    VendorIdentityMigration,
)
from ..models.purchase import Supplier
from ..core.governance import smriti_capability
from ..schemas.vendor import (
    VendorSummary,
    VendorDetail,
    VendorCreateRequest,
    VendorUpdateRequest,
    VendorBankAccountDTO,
    VendorContactDTO,
    VendorAddressDTO,
    VendorCommercialProfileDTO,
    VendorComplianceProfileDTO,
    VendorMergeRequest,
    VendorMergeResponse,
    VendorStatus,
)


@smriti_capability(
    entity="vendor",
    capability="vendor.service",
    role="CANONICAL",
    description="Canonical Application Service for Vendor 360 Workspace and Universal Party Master",
    decision_id="ADR-VEND-01",
)
class VendorService:
    """
    Canonical Application Service for Vendor 360 Workspace and Universal Party Master.
    Coordinates contract-first DTO transformations, atomic multi-entity transactions,
    deduplication, dual-write projection to legacy suppliers table, and vendor merges.
    """

    def __init__(self, db: AsyncSession, tenant=None):
        self.db = db
        self.tenant = tenant

    # ─────────────────────────────────────────────────────────────────────────
    # DTO Mapping Helpers
    # ─────────────────────────────────────────────────────────────────────────

    @classmethod
    def _to_vendor_detail(cls, party: Party) -> VendorDetail:
        sp = party.supplier_profile
        gstin = party.gstin
        pan = party.pan

        commercial = VendorCommercialProfileDTO(
            supplier_type=getattr(sp, "supplier_type", "DISTRIBUTOR") if sp else "DISTRIBUTOR",
            payment_terms_days=getattr(sp, "payment_terms_days", 30) if sp else 30,
            msme_registration_no=getattr(sp, "msme_registration_no", None) if sp else None,
            msme_category=getattr(sp, "msme_category", "NOT_APPLICABLE") if sp else "NOT_APPLICABLE",
            commercial_classification=getattr(sp, "commercial_classification", "APPROVED") if sp else "APPROVED",
            tds_section=getattr(sp, "tds_section", "194Q") if sp else "194Q",
            tds_rate=float(getattr(sp, "tds_rate", 0.10) or 0.10) if sp else 0.10,
            tax_treatment=getattr(sp, "tax_treatment", "REGISTERED_REGULAR") if sp else "REGISTERED_REGULAR",
            outstanding_liability=float(getattr(sp, "outstanding_liability", 0.0) or 0.0) if sp else 0.0,
        )

        v_flags = (getattr(sp, "verification_flags", {}) if sp else {}) or {
            "gst_verified": bool(gstin and len(gstin) == 15),
            "pan_verified": bool(pan and len(pan) == 10),
            "bank_verified": any(b.verification_status == "VERIFIED" for b in (party.bank_accounts or [])),
            "msme_verified": bool(getattr(sp, "msme_registration_no", None)),
        }
        compliance = VendorComplianceProfileDTO(
            gstin=gstin,
            pan=pan,
            msme_registration_no=getattr(sp, "msme_registration_no", None) if sp else None,
            msme_category=getattr(sp, "msme_category", "NOT_APPLICABLE") if sp else "NOT_APPLICABLE",
            verification_flags=v_flags,
            gst_verified=bool(v_flags.get("gst_verified")),
            pan_verified=bool(v_flags.get("pan_verified")),
            bank_verified=bool(v_flags.get("bank_verified")),
            msme_verified=bool(v_flags.get("msme_verified")),
        )

        contacts = [
            VendorContactDTO(
                id=c.id,
                contact_name=c.contact_name,
                contact_category=getattr(c, "contact_category", "GENERAL") or "GENERAL",
                designation=c.designation,
                department=c.department,
                phone=c.phone,
                mobile=c.mobile,
                email=c.email,
                is_primary=c.is_primary,
            )
            for c in (party.contacts or [])
            if not c.is_deleted
        ]

        addresses = [
            VendorAddressDTO(
                id=a.id,
                address_type=a.address_type,
                address_title=a.address_title,
                address_line1=a.address_line1,
                address_line2=a.address_line2,
                city=a.city,
                state=a.state,
                state_code=a.state_code,
                pincode=a.pincode,
                country=a.country,
                gstin=a.gstin,
                is_primary=a.is_primary,
            )
            for a in (party.addresses or [])
            if not a.is_deleted
        ]

        banks = [
            VendorBankAccountDTO(
                id=b.id,
                bank_name=b.bank_name,
                account_holder_name=b.account_holder_name,
                account_number=b.account_number,
                ifsc=b.ifsc,
                branch=b.branch,
                account_type=b.account_type,
                is_primary=b.is_primary,
                verification_status=b.verification_status,
                verified_at=b.verified_at,
            )
            for b in (party.bank_accounts or [])
            if not b.is_deleted
        ]

        roles = [r.role_type for r in (party.roles or []) if not r.is_deleted and r.is_active]

        return VendorDetail(
            id=party.id,
            code=party.party_code,
            legal_name=party.legal_name,
            trade_name=party.trade_name,
            party_type=party.party_type,
            gstin=party.gstin,
            pan=party.pan,
            email=party.email,
            phone=party.phone,
            mobile=party.mobile,
            address_line1=party.address_line1,
            city=party.city,
            state=party.state,
            pincode=party.pincode,
            status=party.status,
            merged_into_party_id=party.merged_into_party_id,
            legacy_supplier_id=f"sup-{party.party_code.lower()}",
            commercial=commercial,
            compliance=compliance,
            contacts=contacts,
            addresses=addresses,
            bank_accounts=banks,
            roles=roles,
            tags=party.tags or [],
        )

    @classmethod
    def _to_vendor_summary(cls, party: Party) -> VendorSummary:
        sp = party.supplier_profile
        return VendorSummary(
            id=party.id,
            code=party.party_code,
            legal_name=party.legal_name,
            trade_name=party.trade_name,
            gstin=party.gstin,
            pan=party.pan,
            mobile=party.mobile or party.phone,
            email=party.email,
            city=party.city,
            state=party.state,
            status=party.status,
            commercial_classification=getattr(sp, "commercial_classification", "APPROVED") if sp else "APPROVED",
            supplier_type=getattr(sp, "supplier_type", "DISTRIBUTOR") if sp else "DISTRIBUTOR",
            outstanding=float(getattr(sp, "outstanding_liability", 0.0) or 0.0) if sp else 0.0,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Queries
    # ─────────────────────────────────────────────────────────────────────────

    async def list_vendors(
        self,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[VendorSummary]:
        """Lists vendors belonging to current tenant, filtered by role SUPPLIER."""
        stmt = (
            select(Party)
            .join(Party.roles)
            .options(
                selectinload(Party.supplier_profile),
            )
            .where(
                PartyRole.role_type == "SUPPLIER",
                PartyRole.is_active == True,
                PartyRole.is_deleted == False,
                Party.is_deleted == False,
            )
        )

        if status_filter:
            stmt = stmt.where(Party.status == status_filter.upper())

        if search and search.strip():
            q = f"%{search.strip().upper()}%"
            stmt = stmt.where(
                or_(
                    Party.party_code.ilike(q),
                    Party.legal_name.ilike(q),
                    Party.trade_name.ilike(q),
                    Party.gstin.ilike(q),
                    Party.pan.ilike(q),
                    Party.mobile.ilike(q),
                    Party.city.ilike(q),
                )
            )

        stmt = stmt.order_by(Party.legal_name.asc()).limit(limit).offset(offset)
        res = await self.db.execute(stmt)
        parties = res.scalars().all()
        return [self._to_vendor_summary(p) for p in parties]

    async def get_vendor_by_id(self, vendor_id: str) -> VendorDetail:
        """Fetches a complete Vendor 360 profile by Universal Party ID or legacy supplier ID."""
        stmt = (
            select(Party)
            .options(
                selectinload(Party.roles),
                selectinload(Party.supplier_profile),
                selectinload(Party.addresses),
                selectinload(Party.contacts),
                selectinload(Party.bank_accounts),
            )
            .where(
                or_(Party.id == vendor_id, Party.party_code == vendor_id),
                Party.is_deleted == False,
            )
        )
        party = (await self.db.execute(stmt)).scalars().first()

        # Fallback check against migration ledger if legacy supplier ID supplied
        if not party:
            mig_stmt = select(VendorIdentityMigration).where(
                VendorIdentityMigration.legacy_supplier_id == vendor_id
            )
            mig = (await self.db.execute(mig_stmt)).scalars().first()
            if mig:
                return await self.get_vendor_by_id(mig.party_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor '{vendor_id}' was not found in SMRITI Universal Master.",
            )

        return self._to_vendor_detail(party)

    # ─────────────────────────────────────────────────────────────────────────
    # Atomic Create / Update
    # ─────────────────────────────────────────────────────────────────────────

    async def create_vendor(self, req: VendorCreateRequest) -> VendorDetail:
        """
        Atomically creates a Vendor into Universal Party Master:
        1. Creates Party record.
        2. Assigns SUPPLIER role.
        3. Creates SupplierProfile with statutory, MSME, and commercial settings.
        4. Adds primary addresses and categorized contacts.
        5. Adds bank accounts.
        6. Projects into legacy 'suppliers' table with migration audit mapping.
        """
        clean_code = (req.code or f"VND-{uuid.uuid4().hex[:6].upper()}").strip().upper()
        clean_gstin = req.gstin.strip().upper() if req.gstin else None
        clean_pan = req.pan.strip().upper() if req.pan else (clean_gstin[2:12] if clean_gstin and len(clean_gstin) >= 12 else None)

        # Deduplication Rule Engine: Check existing party
        conditions = [Party.party_code == clean_code]
        if clean_gstin:
            conditions.append(Party.gstin == clean_gstin)
        if clean_pan:
            conditions.append(Party.pan == clean_pan)
        if req.mobile and req.mobile.strip():
            m = req.mobile.strip()
            conditions.append(or_(Party.mobile == m, Party.phone == m))

        dup_stmt = select(Party).where(or_(*conditions), Party.is_deleted == False)
        existing_party = (await self.db.execute(dup_stmt)).scalars().first()

        if existing_party:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A party with matching Code, GSTIN, PAN, or Mobile already exists: '{existing_party.party_code} - {existing_party.legal_name}'.",
            )

        party_id = f"pty_{uuid.uuid4().hex[:12]}"
        company_id = getattr(self.tenant, "company_id", None)
        branch_id = getattr(self.tenant, "branch_id", None)

        party = Party(
            id=party_id,
            company_id=company_id,
            branch_id=branch_id,
            party_code=clean_code,
            party_type=req.party_type,
            legal_name=req.legal_name.strip(),
            trade_name=(req.trade_name or req.legal_name).strip(),
            gstin=clean_gstin,
            pan=clean_pan,
            email=req.email.strip().lower() if req.email else None,
            phone=req.phone.strip() if req.phone else None,
            mobile=req.mobile.strip() if req.mobile else None,
            address_line1=req.address_line1,
            address_line2=req.address_line2,
            city=req.city,
            state=req.state,
            pincode=req.pincode,
            country="India",
            status=req.status or "ACTIVE",
            tags=req.tags,
            metadata_json={},
        )
        self.db.add(party)
        await self.db.flush()

        # Role assignment: SUPPLIER
        role = PartyRole(
            id=f"pr_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            party_id=party.id,
            role_type="SUPPLIER",
            is_active=True,
        )
        self.db.add(role)

        # SupplierProfile creation
        comm = req.commercial
        profile = SupplierProfile(
            id=f"sp_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            party_id=party.id,
            supplier_type=comm.supplier_type if comm else "DISTRIBUTOR",
            payment_terms_days=comm.payment_terms_days if comm else 30,
            msme_registration_no=comm.msme_registration_no if comm else None,
            msme_category=comm.msme_category if comm else "NOT_APPLICABLE",
            commercial_classification=comm.commercial_classification if comm else "APPROVED",
            tds_section=comm.tds_section if comm else "194Q",
            tds_rate=Decimal(str(comm.tds_rate if comm else 0.10)),
            tax_treatment=comm.tax_treatment if comm else ("REGISTERED_REGULAR" if clean_gstin else "UNREGISTERED"),
            outstanding_liability=Decimal(str(comm.outstanding_liability if comm else 0.00)),
            verification_flags={
                "gst_verified": bool(clean_gstin and len(clean_gstin) == 15),
                "pan_verified": bool(clean_pan and len(clean_pan) == 10),
                "bank_verified": any(b.verification_status == "VERIFIED" for b in req.bank_accounts),
                "msme_verified": bool(comm and comm.msme_registration_no),
            },
        )
        self.db.add(profile)

        # Primary Address
        if req.address_line1 or req.city:
            addr = PartyAddress(
                id=f"pa_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                party_id=party.id,
                address_type="BILLING",
                address_title="Registered Office",
                address_line1=req.address_line1 or "N/A",
                address_line2=req.address_line2,
                city=req.city or "N/A",
                state=req.state or "N/A",
                pincode=req.pincode or "000000",
                country="India",
                gstin=clean_gstin,
                is_primary=True,
            )
            self.db.add(addr)

        # Additional Addresses
        for a_dto in req.addresses:
            addr = PartyAddress(
                id=f"pa_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                party_id=party.id,
                address_type=a_dto.address_type,
                address_title=a_dto.address_title,
                address_line1=a_dto.address_line1,
                address_line2=a_dto.address_line2,
                city=a_dto.city,
                state=a_dto.state,
                state_code=a_dto.state_code,
                pincode=a_dto.pincode,
                country=a_dto.country or "India",
                gstin=a_dto.gstin or clean_gstin,
                is_primary=a_dto.is_primary,
            )
            self.db.add(addr)

        # Contacts with categorization
        for c_dto in req.contacts:
            contact = PartyContact(
                id=f"pc_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                party_id=party.id,
                contact_name=c_dto.contact_name,
                contact_category=c_dto.contact_category or "GENERAL",
                designation=c_dto.designation,
                department=c_dto.department,
                phone=c_dto.phone,
                mobile=c_dto.mobile,
                email=c_dto.email,
                is_primary=c_dto.is_primary,
            )
            self.db.add(contact)

        # Bank Accounts
        for b_dto in req.bank_accounts:
            bank = SupplierBankAccount(
                id=f"pba_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                party_id=party.id,
                bank_name=b_dto.bank_name,
                account_holder_name=b_dto.account_holder_name,
                account_number=b_dto.account_number,
                ifsc=b_dto.ifsc.strip().upper(),
                branch=b_dto.branch,
                account_type=b_dto.account_type or "CURRENT",
                is_primary=b_dto.is_primary,
                verification_status=b_dto.verification_status or "PENDING",
                verified_at=b_dto.verified_at,
            )
            self.db.add(bank)

        # ─────────────────────────────────────────────────────────────────────
        # Sprint 4 Projection: Non-destructive dual-write to legacy suppliers
        # ─────────────────────────────────────────────────────────────────────
        legacy_sup_id = f"sup-{party.party_code.lower()}"
        legacy_supplier = Supplier(
            id=legacy_sup_id,
            company_id=company_id,
            branch_id=branch_id,
            name=party.legal_name,
            code=party.party_code,
            gst_number=party.gstin,
            mobile=party.mobile or party.phone,
            email=party.email,
            address=party.address_line1,
            city=party.city,
            state=party.state,
            pincode=party.pincode,
            outstanding=profile.outstanding_liability,
        )
        self.db.add(legacy_supplier)

        # Migration audit record
        migration_audit = VendorIdentityMigration(
            id=f"vim_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            legacy_supplier_id=legacy_sup_id,
            party_id=party.id,
            migration_status="COMPLETED",
            migration_reason="CANONICAL_VENDOR_CREATION",
            migrated_at=datetime.now(timezone.utc),
            migrated_by=getattr(self.tenant, "user_id", "SYSTEM"),
            details_json={
                "vendor_code": party.party_code,
                "legal_name": party.legal_name,
                "gstin": party.gstin,
            },
        )
        self.db.add(migration_audit)

        await self.db.commit()
        return await self.get_vendor_by_id(party.id)

    async def update_vendor(self, vendor_id: str, req: VendorUpdateRequest) -> VendorDetail:
        """Partially updates vendor profile, statutory attributes, and syncs legacy table."""
        stmt = (
            select(Party)
            .options(
                selectinload(Party.supplier_profile),
                selectinload(Party.contacts),
                selectinload(Party.addresses),
                selectinload(Party.bank_accounts),
            )
            .where(Party.id == vendor_id, Party.is_deleted == False)
        )
        party = (await self.db.execute(stmt)).scalars().first()
        if not party:
            raise HTTPException(status_code=404, detail=f"Vendor '{vendor_id}' not found.")

        if req.legal_name is not None:
            party.legal_name = req.legal_name.strip()
        if req.trade_name is not None:
            party.trade_name = req.trade_name.strip()
        if req.gstin is not None:
            party.gstin = req.gstin.strip().upper() if req.gstin else None
        if req.pan is not None:
            party.pan = req.pan.strip().upper() if req.pan else None
        if req.email is not None:
            party.email = req.email.strip().lower() if req.email else None
        if req.mobile is not None:
            party.mobile = req.mobile.strip() if req.mobile else None
        if req.phone is not None:
            party.phone = req.phone.strip() if req.phone else None
        if req.status is not None:
            party.status = req.status.upper()
        if req.address_line1 is not None:
            party.address_line1 = req.address_line1
        if req.city is not None:
            party.city = req.city
        if req.state is not None:
            party.state = req.state
        if req.pincode is not None:
            party.pincode = req.pincode
        if req.tags is not None:
            party.tags = req.tags

        # Update SupplierProfile
        sp = party.supplier_profile
        if req.commercial and sp:
            c = req.commercial
            if c.supplier_type is not None:
                sp.supplier_type = c.supplier_type
            if c.payment_terms_days is not None:
                sp.payment_terms_days = c.payment_terms_days
            if c.msme_registration_no is not None:
                sp.msme_registration_no = c.msme_registration_no
            if c.msme_category is not None:
                sp.msme_category = c.msme_category
            if c.commercial_classification is not None:
                sp.commercial_classification = c.commercial_classification
            if c.tds_section is not None:
                sp.tds_section = c.tds_section
            if c.tds_rate is not None:
                sp.tds_rate = Decimal(str(c.tds_rate))
            if c.tax_treatment is not None:
                sp.tax_treatment = c.tax_treatment
            if c.outstanding_liability is not None:
                sp.outstanding_liability = Decimal(str(c.outstanding_liability))

        # Dual-write sync to legacy suppliers table
        leg_stmt = select(Supplier).where(
            or_(Supplier.code == party.party_code, Supplier.id == f"sup-{party.party_code.lower()}")
        )
        legacy_sup = (await self.db.execute(leg_stmt)).scalars().first()
        if legacy_supplier := legacy_sup:
            legacy_supplier.name = party.legal_name
            legacy_supplier.gst_number = party.gstin
            legacy_supplier.mobile = party.mobile or party.phone
            legacy_supplier.email = party.email
            legacy_supplier.address = party.address_line1
            legacy_supplier.city = party.city
            legacy_supplier.state = party.state
            legacy_supplier.pincode = party.pincode
            if sp:
                legacy_supplier.outstanding = sp.outstanding_liability

        await self.db.commit()
        return await self.get_vendor_by_id(party.id)

    # ─────────────────────────────────────────────────────────────────────────
    # Vendor Merge Utility
    # ─────────────────────────────────────────────────────────────────────────

    async def merge_vendors(self, req: VendorMergeRequest) -> VendorMergeResponse:
        """
        Merges secondary vendor into primary vendor:
        1. Repoints secondary references and preserves transaction auditability.
        2. Marks secondary party status as 'MERGED' with merged_into_party_id set.
        3. Never physically deletes historical vendor data.
        """
        if req.primary_vendor_id == req.secondary_vendor_id:
            raise HTTPException(status_code=400, detail="Cannot merge a vendor into itself.")

        p_stmt = select(Party).options(selectinload(Party.supplier_profile)).where(Party.id == req.primary_vendor_id)
        s_stmt = select(Party).options(selectinload(Party.supplier_profile)).where(Party.id == req.secondary_vendor_id)

        primary = (await self.db.execute(p_stmt)).scalars().first()
        secondary = (await self.db.execute(s_stmt)).scalars().first()

        if not primary or not secondary:
            raise HTTPException(status_code=404, detail="Primary or secondary vendor not found.")

        # Re-link secondary addresses and contacts
        await self.db.execute(
            update(PartyAddress)
            .where(PartyAddress.party_id == secondary.id)
            .values(party_id=primary.id, is_primary=False)
        )
        await self.db.execute(
            update(PartyContact)
            .where(PartyContact.party_id == secondary.id)
            .values(party_id=primary.id, is_primary=False)
        )
        await self.db.execute(
            update(SupplierBankAccount)
            .where(SupplierBankAccount.party_id == secondary.id)
            .values(party_id=primary.id, is_primary=False)
        )

        # Mark secondary as MERGED
        secondary.status = "MERGED"
        secondary.merged_into_party_id = primary.id

        # Record merge in identity migration ledger
        merge_audit = VendorIdentityMigration(
            id=f"vim_{uuid.uuid4().hex[:12]}",
            company_id=getattr(self.tenant, "company_id", None),
            branch_id=getattr(self.tenant, "branch_id", None),
            legacy_supplier_id=secondary.party_code,
            party_id=primary.id,
            migration_status="COMPLETED",
            migration_reason=f"MERGED_FROM_{secondary.party_code}:{req.merge_reason}",
            migrated_at=datetime.now(timezone.utc),
            migrated_by=getattr(self.tenant, "user_id", "SYSTEM"),
            details_json={
                "source_vendor_id": secondary.id,
                "source_vendor_code": secondary.party_code,
                "target_vendor_id": primary.id,
                "target_vendor_code": primary.party_code,
                "merge_reason": req.merge_reason,
            },
        )
        self.db.add(merge_audit)

        await self.db.commit()
        return VendorMergeResponse(
            success=True,
            primary_vendor_id=primary.id,
            secondary_vendor_id=secondary.id,
            message=f"Successfully converged vendor '{secondary.party_code}' into '{primary.party_code}'.",
        )
