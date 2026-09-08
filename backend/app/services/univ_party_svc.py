"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
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

from ..models.party import Party, PartyRole, CustomerProfile, SupplierProfile
from ..models.crm import Customer, CustomerGSTRegistration, CustomerGroup
from ..models.purchase import Supplier


class UniversalPartyService:
    """
    Universal Party Master Service (P1 Section 6.1).
    Converges disparate Customer and Supplier records into unified, polymorphic Party entities.
    Supports multi-role assignment (Customer + Supplier on one legal entity), deduplication, and legacy adapters.
    """

    @classmethod
    async def get_party_by_code(
        cls,
        session: AsyncSession,
        party_code: str,
    ) -> Optional[Party]:
        """Fetches a party by unique party_code with loaded roles and profiles."""
        stmt = (
            select(Party)
            .where(
                Party.party_code == party_code.strip().upper(),
                Party.is_deleted == False,
            )
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def get_party_by_id(
        cls,
        session: AsyncSession,
        party_id: str,
    ) -> Optional[Party]:
        """Fetches a party by ID with loaded roles and profiles."""
        stmt = (
            select(Party)
            .where(
                Party.id == party_id,
                Party.is_deleted == False,
            )
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def create_party(
        cls,
        session: AsyncSession,
        company_id: str,
        party_code: str,
        legal_name: str,
        trade_name: Optional[str] = None,
        party_type: str = "ORGANIZATION",
        gstin: Optional[str] = None,
        pan: Optional[str] = None,
        email: Optional[str] = None,
        mobile: Optional[str] = None,
        roles: Optional[List[str]] = None,
        customer_data: Optional[Dict[str, Any]] = None,
        supplier_data: Optional[Dict[str, Any]] = None,
        branch_id: str = "BR-001",
    ) -> Party:
        """
        Creates or updates a Universal Party with polymorphic roles and role-specific profiles.
        Maintains non-destructive dual-write synchronization with legacy Customer and Supplier tables.
        """
        clean_code = party_code.strip().upper()
        existing = await cls.get_party_by_code(session, clean_code)

        if not existing:
            party = Party(
                id=f"pty_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                party_code=clean_code,
                party_type=party_type,
                legal_name=legal_name,
                trade_name=trade_name or legal_name,
                gstin=gstin.strip().upper() if gstin else None,
                pan=pan.strip().upper() if pan else (gstin[2:12].upper() if gstin and len(gstin) >= 12 else None),
                email=email,
                mobile=mobile,
                phone=mobile,
                status="ACTIVE",
                is_active=True,
                is_deleted=False,
            )
            session.add(party)
            await session.flush()
        else:
            party = existing
            party.legal_name = legal_name
            if trade_name:
                party.trade_name = trade_name
            if gstin:
                party.gstin = gstin.strip().upper()
            if pan:
                party.pan = pan.strip().upper()
            if email:
                party.email = email
            if mobile:
                party.mobile = mobile
                party.phone = mobile

        assigned_roles = roles or (["CUSTOMER"] if customer_data else (["SUPPLIER"] if supplier_data else ["CUSTOMER"]))

        # Assign Roles
        for role_name in assigned_roles:
            role_type = role_name.strip().upper()
            existing_role_stmt = select(PartyRole).where(
                PartyRole.party_id == party.id,
                PartyRole.role_type == role_type,
                PartyRole.is_deleted == False,
            )
            existing_role = (await session.execute(existing_role_stmt)).scalar_one_or_none()
            if not existing_role:
                new_role = PartyRole(
                    id=f"ptyr_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    party_id=party.id,
                    role_type=role_type,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(new_role)

        # Customer Profile
        if "CUSTOMER" in assigned_roles or customer_data:
            c_data = customer_data or {}
            prof_stmt = select(CustomerProfile).where(
                CustomerProfile.party_id == party.id,
                CustomerProfile.is_deleted == False,
            )
            cust_prof = (await session.execute(prof_stmt)).scalar_one_or_none()
            if not cust_prof:
                cust_prof = CustomerProfile(
                    id=f"cprof_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    party_id=party.id,
                    customer_group_id=c_data.get("customer_group_id"),
                    customer_category=c_data.get("customer_category", "RETAIL"),
                    credit_limit=c_data.get("credit_limit", 0.00),
                    credit_days=c_data.get("credit_days", 0),
                    tax_category=c_data.get("tax_category", "B2B" if party.gstin else "B2C"),
                    is_credit_hold=c_data.get("is_credit_hold", False),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(cust_prof)

        # Supplier Profile
        if "SUPPLIER" in assigned_roles or supplier_data:
            s_data = supplier_data or {}
            supp_prof_stmt = select(SupplierProfile).where(
                SupplierProfile.party_id == party.id,
                SupplierProfile.is_deleted == False,
            )
            supp_prof = (await session.execute(supp_prof_stmt)).scalar_one_or_none()
            if not supp_prof:
                supp_prof = SupplierProfile(
                    id=f"sprof_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    party_id=party.id,
                    supplier_type=s_data.get("supplier_type", "DISTRIBUTOR"),
                    payment_terms_days=s_data.get("payment_terms_days", 30),
                    msme_registration_no=s_data.get("msme_registration_no"),
                    tax_treatment=s_data.get("tax_treatment", "REGISTERED_REGULAR"),
                    is_active=True,
                    is_deleted=False,
                )
                session.add(supp_prof)

        await session.commit()
        session.expire_all()
        return await cls.get_party_by_code(session, clean_code)

    @classmethod
    async def find_existing_party_by_identifiers(
        cls,
        session: AsyncSession,
        gstin: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        party_code: Optional[str] = None
    ) -> Optional[Party]:
        """
        Deduplication rule engine:
        Matches existing party by GSTIN -> Phone/Mobile -> Email -> Party Code.
        """
        conditions = []
        if gstin and gstin.strip():
            conditions.append(Party.gstin == gstin.strip())
        if phone and phone.strip():
            p = phone.strip()
            conditions.append(or_(Party.phone == p, Party.mobile == p))
        if email and email.strip():
            conditions.append(Party.email == email.strip().lower())
        if party_code and party_code.strip():
            conditions.append(Party.party_code == party_code.strip())

        if not conditions:
            return None

        stmt = select(Party).options(
            selectinload(Party.roles),
            selectinload(Party.customer_profile),
            selectinload(Party.supplier_profile)
        ).where(or_(*conditions))
        
        return (await session.execute(stmt)).scalars().first()

    @classmethod
    async def converge_customer_to_party(
        cls,
        session: AsyncSession,
        customer: Customer
    ) -> Party:
        """
        Idempotently synchronizes a legacy Customer record into a canonical Party entity.
        """
        # 1. Search for existing party by GSTIN / phone / email / code
        code = customer.code if hasattr(customer, "code") and customer.code else f"CUST-{customer.id[:8]}"
        phone = getattr(customer, "mobile", None) or getattr(customer, "phone", None)
        registration = (await session.execute(
            select(CustomerGSTRegistration)
            .where(
                CustomerGSTRegistration.customer_id == customer.id,
                CustomerGSTRegistration.is_primary.is_(True),
                CustomerGSTRegistration.status == "ACTIVE",
                CustomerGSTRegistration.is_deleted.is_(False),
            )
        )).scalars().first()
        gstin = (registration.gstin if registration else None) or getattr(customer, "gst_number", None) or getattr(customer, "gstin", None)
        email = getattr(customer, "email", None)
        name = getattr(customer, "name", "Valued Customer")

        party = await cls.find_existing_party_by_identifiers(
            session=session,
            gstin=gstin,
            phone=phone,
            email=email,
            party_code=code
        )

        if not party:
            party = Party(
                id=f"pty_{uuid.uuid4().hex[:12]}",
                party_code=code,
                party_type="ORGANIZATION" if gstin else "INDIVIDUAL",
                legal_name=name,
                trade_name=name,
                gstin=gstin,
                phone=phone,
                mobile=phone,
                email=email,
                city=getattr(customer, "city", None),
                state=getattr(customer, "state", None),
                pincode=getattr(customer, "pincode", None),
                address_line1=getattr(customer, "address", None),
                status="ACTIVE"
            )
            session.add(party)
            await session.flush()

        # 2. Ensure CUSTOMER role exists
        role_stmt = select(PartyRole).where(
            PartyRole.party_id == party.id,
            PartyRole.role_type == "CUSTOMER"
        )
        role_match = (await session.execute(role_stmt)).scalars().first()
        if not role_match:
            role = PartyRole(
                id=f"pr_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                role_type="CUSTOMER",
                is_active=True
            )
            role.party = party
            session.add(role)

        # 3. Ensure CustomerProfile exists
        cp_stmt = select(CustomerProfile).where(CustomerProfile.party_id == party.id)
        cp_match = (await session.execute(cp_stmt)).scalars().first()
        if not cp_match:
            group = None
            if getattr(customer, "customer_group_id", None):
                group = (await session.execute(
                    select(CustomerGroup).where(CustomerGroup.id == customer.customer_group_id)
                )).scalars().first()
            cp = CustomerProfile(
                id=f"cp_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                customer_group_id=getattr(customer, "customer_group_id", None),
                customer_category="RETAIL",
                credit_limit=Decimal(str(getattr(group, "credit_limit", 0.00) or 0.00)),
                credit_days=int(getattr(group, "credit_days", 0) or 0),
                tax_category="B2B" if gstin else "B2C",
                outstanding_balance=Decimal(str(getattr(customer, "outstanding", 0.00) or 0.00))
            )
            cp.party = party
            session.add(cp)
        else:
            cp_match.customer_group_id = getattr(customer, "customer_group_id", None)
            cp_match.outstanding_balance = Decimal(str(getattr(customer, "outstanding", 0.00) or 0.00))
            cp_match.tax_category = "B2B" if gstin else "B2C"

        await session.flush()
        return party

    @classmethod
    async def converge_supplier_to_party(
        cls,
        session: AsyncSession,
        supplier: Supplier
    ) -> Party:
        """
        Idempotently synchronizes a legacy Supplier record into a canonical Party entity.
        If the supplier shares GSTIN/phone with an existing Customer, they converge into the SAME party.
        """
        code = supplier.code if hasattr(supplier, "code") and supplier.code else f"SUPP-{supplier.id[:8]}"
        gstin = getattr(supplier, "gst_number", None) or getattr(supplier, "gstin", None)
        phone = getattr(supplier, "mobile", None) or getattr(supplier, "phone", None)
        email = getattr(supplier, "email", None)
        name = getattr(supplier, "name", "Valued Supplier")

        party = await cls.find_existing_party_by_identifiers(
            session=session,
            gstin=gstin,
            phone=phone,
            email=email,
            party_code=code
        )

        if not party:
            party = Party(
                id=f"pty_{uuid.uuid4().hex[:12]}",
                party_code=code,
                party_type="ORGANIZATION" if gstin else "INDIVIDUAL",
                legal_name=name,
                trade_name=name,
                gstin=gstin,
                phone=phone,
                mobile=phone,
                email=email,
                city=getattr(supplier, "city", None),
                state=getattr(supplier, "state", None),
                pincode=getattr(supplier, "pincode", None),
                address_line1=getattr(supplier, "address", None),
                status="ACTIVE"
            )
            session.add(party)
            await session.flush()

        # 2. Ensure SUPPLIER role exists
        role_stmt = select(PartyRole).where(
            PartyRole.party_id == party.id,
            PartyRole.role_type == "SUPPLIER"
        )
        role_match = (await session.execute(role_stmt)).scalars().first()
        if not role_match:
            role = PartyRole(
                id=f"pr_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                role_type="SUPPLIER",
                is_active=True
            )
            role.party = party
            session.add(role)

        # 3. Ensure SupplierProfile exists
        sp_stmt = select(SupplierProfile).where(SupplierProfile.party_id == party.id)
        sp_match = (await session.execute(sp_stmt)).scalars().first()
        if not sp_match:
            sp = SupplierProfile(
                id=f"sp_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                supplier_type="DISTRIBUTOR",
                payment_terms_days=30,
                tax_treatment="REGISTERED_REGULAR" if gstin else "UNREGISTERED",
                outstanding_liability=Decimal(str(getattr(supplier, "outstanding", 0.00) or 0.00))
            )
            sp.party = party
            session.add(sp)

        await session.flush()
        return party

    @classmethod
    async def sync_all_legacy_parties(cls, session: AsyncSession) -> Dict[str, int]:
        """
        Batch convergence utility:
        Scans all Customers and Suppliers in the database and creates/updates Party records.
        """
        # Check table presence
        tbl_cust = await session.execute(text("SELECT to_regclass('public.customers');"))
        tbl_supp = await session.execute(text("SELECT to_regclass('public.suppliers');"))

        cust_count = 0
        supp_count = 0

        if tbl_cust.scalar():
            customers = (await session.execute(select(Customer))).scalars().all()
            for c in customers:
                await cls.converge_customer_to_party(session, c)
                cust_count += 1

        if tbl_supp.scalar():
            suppliers = (await session.execute(select(Supplier))).scalars().all()
            for s in suppliers:
                await cls.converge_supplier_to_party(session, s)
                supp_count += 1

        await session.commit()
        return {
            "customers_converged": cust_count,
            "suppliers_converged": supp_count
        }

    @classmethod
    async def get_party_with_details(cls, session: AsyncSession, party_id: str) -> Optional[Party]:
        """Fetches party by ID with all polymorphic roles and operational profiles loaded."""
        stmt = select(Party).options(
            selectinload(Party.roles),
            selectinload(Party.customer_profile),
            selectinload(Party.supplier_profile)
        ).where(Party.id == party_id)
        return (await session.execute(stmt)).scalars().first()
