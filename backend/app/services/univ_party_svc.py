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
from ..models.crm import Customer
from ..models.purchase import Supplier


class UniversalPartyService:
    """
    Universal Party Master Service (P1 Section 6.1).
    Converges disparate Customer and Supplier records into unified, polymorphic Party entities.
    Supports multi-role assignment (Customer + Supplier on one legal entity), deduplication, and legacy adapters.
    """

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
        gstin = getattr(customer, "gst_number", None) or getattr(customer, "gstin", None)
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
            cp = CustomerProfile(
                id=f"cp_{uuid.uuid4().hex[:12]}",
                party_id=party.id,
                customer_group_id=getattr(customer, "group_id", None),
                customer_category=getattr(customer, "category", "RETAIL"),
                credit_limit=Decimal(str(getattr(customer, "credit_limit", 0.00) or 0.00)),
                credit_days=int(getattr(customer, "credit_days", 0) or 0),
                tax_category="B2B" if gstin else "B2C",
                outstanding_balance=Decimal(str(getattr(customer, "outstanding_balance", 0.00) or 0.00))
            )
            cp.party = party
            session.add(cp)

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
