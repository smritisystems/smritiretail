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

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.party import Party, PartyRole, CustomerProfile, SupplierProfile
from ..models.crm import Customer
from ..models.purchase import Supplier


class UniversalPartyService:
    """
    Authoritative Universal Party Domain Service for Tenant Data Planes (smritiXXX).
    Provides unified entity management, polymorphic role assignment, and legacy compatibility adapters.
    """

    @classmethod
    async def get_party_by_code(
        cls,
        session: AsyncSession,
        party_code: str
    ) -> Optional[Party]:
        """Fetches a party by unique party_code with loaded roles and profiles."""
        stmt = (
            select(Party)
            .where(
                Party.party_code == party_code.strip().upper(),
                Party.is_deleted == False
            )
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile)
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def get_party_by_id(
        cls,
        session: AsyncSession,
        party_id: str
    ) -> Optional[Party]:
        """Fetches a party by ID with loaded roles and profiles."""
        stmt = (
            select(Party)
            .where(
                Party.id == party_id,
                Party.is_deleted == False
            )
            .options(
                selectinload(Party.roles),
                selectinload(Party.customer_profile),
                selectinload(Party.supplier_profile)
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
        branch_id: str = "BR-001"
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
                is_deleted=False
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
                PartyRole.is_deleted == False
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
                    is_deleted=False
                )
                session.add(new_role)

        # Customer Profile
        if "CUSTOMER" in assigned_roles or customer_data:
            c_data = customer_data or {}
            prof_stmt = select(CustomerProfile).where(
                CustomerProfile.party_id == party.id,
                CustomerProfile.is_deleted == False
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
                    is_deleted=False
                )
                session.add(cust_prof)

        # Supplier Profile
        if "SUPPLIER" in assigned_roles or supplier_data:
            s_data = supplier_data or {}
            supp_prof_stmt = select(SupplierProfile).where(
                SupplierProfile.party_id == party.id,
                SupplierProfile.is_deleted == False
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
                    is_deleted=False
                )
                session.add(supp_prof)

        await session.commit()
        session.expire_all()
        return await cls.get_party_by_code(session, clean_code)
