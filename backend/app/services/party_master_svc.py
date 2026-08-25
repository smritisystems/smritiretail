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

import uuid
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.party import (
    Party,
    PartyRole,
    CustomerProfile,
    SupplierProfile,
    PartyAddress,
    PartyContact,
    PartyRelationship,
)
from ..schemas.party_master import (
    PartyCreateRequest,
    PartyUpdateRequest,
    PartyMergeRequest,
    PartyMergeResponse,
    LegacyCustomerAdapterResponse,
    LegacySupplierAdapterResponse,
)


class UniversalPartyMasterService:
    """
    Complete Universal Party Master Service (P1.1).
    Polymorphic multi-role management, address/contact management, deduplication, merging, and legacy adapters.
    """

    @classmethod
    async def find_party_by_identifiers(
        cls,
        session: AsyncSession,
        gstin: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        party_code: Optional[str] = None,
    ) -> Optional[Party]:
        """
        Deduplication rule engine:
        Matches existing party by GSTIN -> Phone/Mobile -> Email -> Party Code.
        """
        conditions = []
        if gstin and gstin.strip():
            conditions.append(Party.gstin == gstin.strip().upper())
        if phone and phone.strip():
            p = phone.strip()
            conditions.append(or_(Party.phone == p, Party.mobile == p))
        if email and email.strip():
            conditions.append(Party.email == email.strip().lower())
        if party_code and party_code.strip():
            conditions.append(Party.party_code == party_code.strip().upper())

        if not conditions:
            return None

        stmt = (
            select(Party)
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile),
                selectinload(Party.addresses),
                selectinload(Party.contacts),
            )
            .where(or_(*conditions))
            .execution_options(populate_existing=True)
        )
        return (await session.execute(stmt)).scalars().first()

    @classmethod
    async def create_party(
        cls,
        session: AsyncSession,
        req: PartyCreateRequest,
    ) -> Party:
        """
        Atomically creates a Universal Party with multiple roles, operational profiles, addresses, and contacts.
        """
        code = req.party_code or f"PTY-{uuid.uuid4().hex[:8].upper()}"
        party_id = f"pty_{uuid.uuid4().hex[:12]}"

        party = Party(
            id=party_id,
            party_code=code,
            party_type=req.party_type,
            legal_name=req.legal_name,
            trade_name=req.trade_name or req.legal_name,
            gstin=req.gstin.upper() if req.gstin else None,
            pan=req.pan.upper() if req.pan else (req.gstin[2:12] if req.gstin and len(req.gstin) >= 12 else None),
            email=req.email.lower() if req.email else None,
            phone=req.phone,
            mobile=req.mobile or req.phone,
            city=req.city,
            state=req.state,
            pincode=req.pincode,
            address_line1=req.address_line1,
            status="ACTIVE",
            tags=req.tags,
            metadata_json=req.metadata_json,
        )
        session.add(party)
        await session.flush()

        # 1. Assign Roles (CUSTOMER, SUPPLIER, DEALER, DISTRIBUTOR, SALESMAN, TRANSPORTER, EMPLOYEE)
        for role_name in req.roles:
            role = PartyRole(
                id=f"pr_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                role_type=role_name.upper(),
                is_active=True,
            )
            session.add(role)

        # 2. Customer Profile
        if req.customer_profile or "CUSTOMER" in [r.upper() for r in req.roles]:
            cp_data = req.customer_profile
            cp = CustomerProfile(
                id=f"cp_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                customer_category=cp_data.customer_category if cp_data else "RETAIL",
                credit_limit=Decimal(str(cp_data.credit_limit if cp_data else 0.00)),
                credit_days=cp_data.credit_days if cp_data else 0,
                tax_category=cp_data.tax_category if cp_data else ("B2B" if req.gstin else "B2C"),
                is_credit_hold=cp_data.is_credit_hold if cp_data else False,
                price_tier_id=cp_data.price_tier_id if cp_data else None,
                loyalty_tier_id=cp_data.loyalty_tier_id if cp_data else None,
                outstanding_balance=Decimal(str(cp_data.outstanding_balance if cp_data else 0.00)),
            )
            session.add(cp)

        # 3. Supplier Profile
        if req.supplier_profile or "SUPPLIER" in [r.upper() for r in req.roles]:
            sp_data = req.supplier_profile
            sp = SupplierProfile(
                id=f"sp_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                supplier_type=sp_data.supplier_type if sp_data else "DISTRIBUTOR",
                payment_terms_days=sp_data.payment_terms_days if sp_data else 30,
                msme_registration_no=sp_data.msme_registration_no if sp_data else None,
                tax_treatment=sp_data.tax_treatment if sp_data else ("REGISTERED_REGULAR" if req.gstin else "UNREGISTERED"),
                outstanding_liability=Decimal(str(sp_data.outstanding_liability if sp_data else 0.00)),
            )
            session.add(sp)

        # 4. Addresses
        for addr in req.addresses:
            pa = PartyAddress(
                id=f"pa_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                address_type=addr.address_type.upper(),
                address_title=addr.address_title,
                address_line1=addr.address_line1,
                address_line2=addr.address_line2,
                city=addr.city,
                state=addr.state,
                state_code=addr.state_code,
                pincode=addr.pincode,
                country=addr.country,
                gstin=addr.gstin,
                is_primary=addr.is_primary,
            )
            session.add(pa)

        # 5. Contacts
        for contact in req.contacts:
            pc = PartyContact(
                id=f"pc_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                contact_name=contact.contact_name,
                designation=contact.designation,
                department=contact.department,
                phone=contact.phone,
                mobile=contact.mobile,
                email=contact.email,
                is_primary=contact.is_primary,
            )
            session.add(pc)

        await session.commit()
        return await cls.get_party_by_id(session, party.id)

    @classmethod
    async def get_party_by_id(cls, session: AsyncSession, party_id: str) -> Optional[Party]:
        """Fetches party by ID with all polymorphic roles, profiles, addresses, and contacts loaded."""
        stmt = (
            select(Party)
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile),
                selectinload(Party.addresses),
                selectinload(Party.contacts),
            )
            .where(Party.id == party_id)
            .execution_options(populate_existing=True)
        )
        return (await session.execute(stmt)).scalars().first()

    @classmethod
    async def list_parties(
        cls,
        session: AsyncSession,
        role_type: Optional[str] = None,
        status: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Party]:
        """Searches and lists parties with optional role and status filters."""
        stmt = (
            select(Party)
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile),
                selectinload(Party.addresses),
                selectinload(Party.contacts),
            )
            .execution_options(populate_existing=True)
        )
        if status:
            stmt = stmt.where(Party.status == status.upper())
        else:
            stmt = stmt.where(Party.status != "MERGED")

        if query:
            q = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Party.legal_name.ilike(q),
                    Party.trade_name.ilike(q),
                    Party.party_code.ilike(q),
                    Party.gstin.ilike(q),
                    Party.phone.ilike(q),
                    Party.mobile.ilike(q),
                )
            )

        if role_type:
            stmt = stmt.join(Party.roles).where(
                PartyRole.role_type == role_type.upper(),
                PartyRole.is_active == True,
            )

        stmt = stmt.order_by(Party.legal_name).limit(limit).offset(offset)
        return (await session.execute(stmt)).scalars().all()

    @classmethod
    async def add_or_toggle_role(
        cls,
        session: AsyncSession,
        party_id: str,
        role_type: str,
        is_active: bool = True,
    ) -> PartyRole:
        """Adds or activates/deactivates a polymorphic role on a party."""
        role_type_upper = role_type.upper()
        stmt = select(PartyRole).where(
            PartyRole.party_id == party_id,
            PartyRole.role_type == role_type_upper,
        )
        role = (await session.execute(stmt)).scalars().first()
        if role:
            role.is_active = is_active
        else:
            role = PartyRole(
                id=f"pr_{uuid.uuid4().hex[:12]}",
                party_id=party_id,
                role_type=role_type_upper,
                is_active=is_active,
            )
            session.add(role)

        # Update in-memory party roles if party is tracked in session
        party = (await session.execute(
            select(Party)
            .options(selectinload(Party.roles))
            .where(Party.id == party_id)
        )).scalars().first()
        if party and role not in party.roles:
            party.roles.append(role)

        # Ensure corresponding profile exists if role requires it
        if role_type_upper == "CUSTOMER":
            cp = (await session.execute(select(CustomerProfile).where(CustomerProfile.party_id == party_id))).scalars().first()
            if not cp:
                new_cp = CustomerProfile(id=f"cp_{uuid.uuid4().hex[:12]}", party_id=party_id)
                session.add(new_cp)
                if party:
                    party.customer_profile = new_cp
        elif role_type_upper == "SUPPLIER":
            sp = (await session.execute(select(SupplierProfile).where(SupplierProfile.party_id == party_id))).scalars().first()
            if not sp:
                new_sp = SupplierProfile(id=f"sp_{uuid.uuid4().hex[:12]}", party_id=party_id)
                session.add(new_sp)
                if party:
                    party.supplier_profile = new_sp

        await session.commit()
        return role

    @classmethod
    async def merge_parties(
        cls,
        session: AsyncSession,
        req: PartyMergeRequest,
    ) -> PartyMergeResponse:
        """
        Deduplication and Merge Policy Engine:
        Consolidates secondary party roles, profiles, addresses, and contacts into primary party,
        then marks secondary party as MERGED.
        """
        primary = await cls.get_party_by_id(session, req.primary_party_id)
        secondary = await cls.get_party_by_id(session, req.secondary_party_id)

        if not primary or not secondary:
            raise ValueError("Both primary and secondary party must exist to merge.")

        if primary.id == secondary.id:
            raise ValueError("Cannot merge a party into itself.")

        # 1. Consolidate Roles
        existing_primary_roles = {r.role_type for r in primary.roles if r.is_active}
        for sec_role in secondary.roles:
            if sec_role.role_type not in existing_primary_roles:
                new_role = PartyRole(
                    id=f"pr_{uuid.uuid4().hex[:12]}",
                    party_id=primary.id,
                    role_type=sec_role.role_type,
                    is_active=True,
                )
                session.add(new_role)
                primary.roles.append(new_role)
                existing_primary_roles.add(sec_role.role_type)

        # 2. Consolidate Customer Profile if primary missing it
        if secondary.customer_profile and not primary.customer_profile:
            cp = CustomerProfile(
                id=f"cp_{uuid.uuid4().hex[:12]}",
                party_id=primary.id,
                customer_category=secondary.customer_profile.customer_category,
                credit_limit=secondary.customer_profile.credit_limit,
                credit_days=secondary.customer_profile.credit_days,
                tax_category=secondary.customer_profile.tax_category,
                is_credit_hold=secondary.customer_profile.is_credit_hold,
                price_tier_id=secondary.customer_profile.price_tier_id,
                loyalty_tier_id=secondary.customer_profile.loyalty_tier_id,
                outstanding_balance=secondary.customer_profile.outstanding_balance,
            )
            session.add(cp)
            primary.customer_profile = cp
        elif secondary.customer_profile and primary.customer_profile:
            primary.customer_profile.outstanding_balance += secondary.customer_profile.outstanding_balance

        # 3. Consolidate Supplier Profile if primary missing it
        if secondary.supplier_profile and not primary.supplier_profile:
            sp = SupplierProfile(
                id=f"sp_{uuid.uuid4().hex[:12]}",
                party_id=primary.id,
                supplier_type=secondary.supplier_profile.supplier_type,
                payment_terms_days=secondary.supplier_profile.payment_terms_days,
                msme_registration_no=secondary.supplier_profile.msme_registration_no,
                tax_treatment=secondary.supplier_profile.tax_treatment,
                outstanding_liability=secondary.supplier_profile.outstanding_liability,
            )
            session.add(sp)
            primary.supplier_profile = sp
        elif secondary.supplier_profile and primary.supplier_profile:
            primary.supplier_profile.outstanding_liability += secondary.supplier_profile.outstanding_liability

        # 4. Migrate Addresses & Contacts
        for addr in secondary.addresses:
            new_addr = PartyAddress(
                id=f"pa_{uuid.uuid4().hex[:12]}",
                party_id=primary.id,
                address_type=addr.address_type,
                address_title=addr.address_title,
                address_line1=addr.address_line1,
                address_line2=addr.address_line2,
                city=addr.city,
                state=addr.state,
                state_code=addr.state_code,
                pincode=addr.pincode,
                country=addr.country,
                gstin=addr.gstin,
                is_primary=False,
            )
            session.add(new_addr)
            primary.addresses.append(new_addr)

        for contact in secondary.contacts:
            new_contact = PartyContact(
                id=f"pc_{uuid.uuid4().hex[:12]}",
                party_id=primary.id,
                contact_name=contact.contact_name,
                designation=contact.designation,
                department=contact.department,
                phone=contact.phone,
                mobile=contact.mobile,
                email=contact.email,
                is_primary=False,
            )
            session.add(new_contact)
            primary.contacts.append(new_contact)

        # 5. Mark secondary as MERGED
        secondary.status = "MERGED"
        secondary.merged_into_party_id = primary.id

        await session.commit()
        return PartyMergeResponse(
            success=True,
            primary_party_id=primary.id,
            secondary_party_id=secondary.id,
            consolidated_roles=list(existing_primary_roles),
            message=f"Party '{secondary.party_code}' successfully merged into '{primary.party_code}'.",
        )

    @classmethod
    async def get_legacy_customer_view(cls, session: AsyncSession, party_id: str) -> Optional[LegacyCustomerAdapterResponse]:
        """Compatibility adapter: Presents Universal Party as a legacy Customer object."""
        party = await cls.get_party_by_id(session, party_id)
        if not party:
            return None

        cp = party.customer_profile
        return LegacyCustomerAdapterResponse(
            id=party.id,
            code=party.party_code,
            name=party.legal_name,
            phone=party.mobile or party.phone,
            email=party.email,
            gst_number=party.gstin,
            category=cp.customer_category if cp else "RETAIL",
            credit_limit=float(cp.credit_limit) if cp else 0.0,
            credit_days=cp.credit_days if cp else 0,
            outstanding_balance=float(cp.outstanding_balance) if cp else 0.0,
            city=party.city,
            state=party.state,
            is_active=party.status == "ACTIVE",
        )

    @classmethod
    async def get_legacy_supplier_view(cls, session: AsyncSession, party_id: str) -> Optional[LegacySupplierAdapterResponse]:
        """Compatibility adapter: Presents Universal Party as a legacy Supplier object."""
        party = await cls.get_party_by_id(session, party_id)
        if not party:
            return None

        sp = party.supplier_profile
        return LegacySupplierAdapterResponse(
            id=party.id,
            code=party.party_code,
            name=party.legal_name,
            phone=party.mobile or party.phone,
            email=party.email,
            gstin=party.gstin,
            supplier_type=sp.supplier_type if sp else "DISTRIBUTOR",
            payment_terms_days=sp.payment_terms_days if sp else 30,
            tax_treatment=sp.tax_treatment if sp else "REGISTERED_REGULAR",
            outstanding_liability=float(sp.outstanding_liability) if sp else 0.0,
            city=party.city,
            state=party.state,
            is_active=party.status == "ACTIVE",
        )
