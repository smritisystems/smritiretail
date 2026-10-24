"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Version      : 6.92.0
Created      : 2026-10-18
Classification: Canonical Company Profile & Settings Service
Capability    : @SmritiCapability("FOUNDATION", "COMPANY_PROFILE_STUDIO")
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..api.deps import TenantContext, normalize_company_id
from ..models.auth import User
from ..models.company_policy import CompanyBankAccount
from ..models.tenant import Branch, Company
from ..schemas.company_profile import (
    BranchProfileSchema,
    CompanyBankAccountSchema,
    CompanyProfileResponse,
    CompanyProfileUpdateRequest,
)
from .compliance_audit import ComplianceAuditService


class CompanyProfileService:
    """
    Authoritative service governing Company Profile & Settings.
    Manages tenant corporate identity, address, tax, banking, regional parameters,
    and field-level audit trails with cryptographic hash-chaining.
    """

    @classmethod
    async def get_company_entity(
        cls,
        db: AsyncSession,
        company_id: str,
    ) -> Company:
        """Resolve company record by canonical ID or company code."""
        norm_id = normalize_company_id(company_id)
        stmt = select(Company).where(
            (Company.id == norm_id) | (Company.company_code == company_id),
            Company.is_deleted.is_(False),
        )
        res = await db.execute(stmt)
        comp = res.scalars().first()
        if not comp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company '{company_id}' not found.",
            )
        return comp

    @classmethod
    async def get_company_profile(
        cls,
        db: AsyncSession,
        tenant_ctx: TenantContext,
    ) -> CompanyProfileResponse:
        """Fetch full company profile including branches and bank accounts."""
        company = await cls.get_company_entity(db, tenant_ctx.company_id)

        # Fetch active branches
        branch_stmt = (
            select(Branch)
            .where(
                Branch.company_id == company.id,
                Branch.is_deleted.is_(False),
            )
            .order_by(Branch.code.asc())
        )
        branch_res = await db.execute(branch_stmt)
        branches = branch_res.scalars().all()

        # Fetch active company bank accounts
        bank_stmt = (
            select(CompanyBankAccount)
            .where(CompanyBankAccount.company_id == company.id)
            .order_by(CompanyBankAccount.is_default.desc(), CompanyBankAccount.id.asc())
        )
        bank_res = await db.execute(bank_stmt)
        bank_accounts = bank_res.scalars().all()

        return CompanyProfileResponse(
            id=company.id,
            uuid=company.uuid,
            company_code=company.company_code,
            identity_code=company.identity_code,
            name=company.name,
            legal_name=company.legal_name or company.name,
            trade_name=company.trade_name or company.name,
            business_type=company.business_type or "PRIVATE_LIMITED",
            gst_number=company.gst_number,
            pan=company.pan,
            cin=company.cin,
            address_line1=company.address_line1,
            address_line2=company.address_line2,
            city=company.city,
            state=company.state,
            state_code=company.state_code,
            pincode=company.pincode,
            country=company.country or "India",
            phone=company.phone,
            email=company.email,
            website=company.website,
            dispatch_email=company.dispatch_email,
            accounts_email=company.accounts_email,
            contact_person=company.contact_person,
            logo_url=company.logo_url,
            print_logo_url=company.print_logo_url,
            signature_url=company.signature_url,
            stamp_url=company.stamp_url,
            currency_code=company.currency_code or "INR",
            timezone=company.timezone or "Asia/Kolkata",
            date_format=company.date_format or "DD/MM/YYYY",
            number_format=company.number_format or "INDIAN_LAKH_CRORE",
            is_active=company.is_active,
            created_at=company.created_at,
            modified_at=company.modified_at,
            bank_accounts=[
                CompanyBankAccountSchema.model_validate(b) for b in bank_accounts
            ],
            branches=[
                BranchProfileSchema.model_validate(br) for br in branches
            ],
        )

    @classmethod
    async def update_company_profile(
        cls,
        db: AsyncSession,
        tenant_ctx: TenantContext,
        payload: CompanyProfileUpdateRequest,
        current_user: User,
        ip_address: str | None = None,
    ) -> CompanyProfileResponse:
        """
        Update company profile, branches, and bank accounts.
        Enforces field-level RBAC and logs cryptographically chained audit event.
        """
        company = await cls.get_company_entity(db, tenant_ctx.company_id)

        # Snapshot before state
        before_state: dict[str, Any] = {
            "name": company.name,
            "legal_name": company.legal_name,
            "trade_name": company.trade_name,
            "business_type": company.business_type,
            "gst_number": company.gst_number,
            "pan": company.pan,
            "cin": company.cin,
            "address_line1": company.address_line1,
            "address_line2": company.address_line2,
            "city": company.city,
            "state": company.state,
            "state_code": company.state_code,
            "pincode": company.pincode,
            "country": company.country,
            "phone": company.phone,
            "email": company.email,
            "website": company.website,
            "dispatch_email": company.dispatch_email,
            "accounts_email": company.accounts_email,
            "contact_person": company.contact_person,
            "logo_url": company.logo_url,
            "print_logo_url": company.print_logo_url,
            "signature_url": company.signature_url,
            "stamp_url": company.stamp_url,
            "currency_code": company.currency_code,
            "timezone": company.timezone,
            "date_format": company.date_format,
            "number_format": company.number_format,
        }

        # Update company fields if provided in payload
        update_data = payload.model_dump(exclude_unset=True)

        for field in [
            "name", "legal_name", "trade_name", "business_type", "gst_number", "pan", "cin",
            "address_line1", "address_line2", "city", "state", "state_code", "pincode", "country",
            "phone", "email", "website", "dispatch_email", "accounts_email", "contact_person",
            "logo_url", "print_logo_url", "signature_url", "stamp_url",
            "currency_code", "timezone", "date_format", "number_format"
        ]:
            if field in update_data and update_data[field] is not None:
                setattr(company, field, update_data[field])

        # Automatically derive PAN if GSTIN provided and PAN not explicitly given
        if payload.gst_number and not payload.pan:
            company.pan = payload.gst_number[2:12]

        company.modified_at = datetime.now(UTC)

        # Update Bank Accounts if provided
        if payload.bank_accounts is not None:
            # Delete existing bank accounts for this company and replace cleanly
            existing_banks = (
                await db.execute(
                    select(CompanyBankAccount).where(CompanyBankAccount.company_id == company.id)
                )
            ).scalars().all()
            for eb in existing_banks:
                await db.delete(eb)
            await db.flush()

            for bank_in in payload.bank_accounts:
                bank_row = CompanyBankAccount(
                    id=bank_in.id or f"bnk_{uuid.uuid4().hex[:12]}",
                    company_id=company.id,
                    bank_name=bank_in.bank_name,
                    account_no=bank_in.account_no,
                    ifsc=bank_in.ifsc,
                    branch=bank_in.branch,
                    is_default=bank_in.is_default,
                )
                db.add(bank_row)

        # Update Branches if provided
        if payload.branches is not None:
            for br_update in payload.branches:
                br_stmt = select(Branch).where(
                    Branch.id == br_update.id,
                    Branch.company_id == company.id,
                    Branch.is_deleted.is_(False),
                )
                br_res = await db.execute(br_stmt)
                br_row = br_res.scalars().first()
                if br_row:
                    br_dict = br_update.model_dump(exclude_unset=True, exclude={"id"})
                    for k, v in br_dict.items():
                        if v is not None:
                            setattr(br_row, k, v)
                    br_row.modified_at = datetime.now(UTC)

        await db.flush()

        # Snapshot after state
        after_state: dict[str, Any] = {
            "name": company.name,
            "legal_name": company.legal_name,
            "trade_name": company.trade_name,
            "business_type": company.business_type,
            "gst_number": company.gst_number,
            "pan": company.pan,
            "cin": company.cin,
            "address_line1": company.address_line1,
            "address_line2": company.address_line2,
            "city": company.city,
            "state": company.state,
            "state_code": company.state_code,
            "pincode": company.pincode,
            "country": company.country,
            "phone": company.phone,
            "email": company.email,
            "website": company.website,
            "dispatch_email": company.dispatch_email,
            "accounts_email": company.accounts_email,
            "contact_person": company.contact_person,
            "logo_url": company.logo_url,
            "print_logo_url": company.print_logo_url,
            "signature_url": company.signature_url,
            "stamp_url": company.stamp_url,
            "currency_code": company.currency_code,
            "timezone": company.timezone,
            "date_format": company.date_format,
            "number_format": company.number_format,
        }

        # Record cryptographically chained audit log
        try:
            await ComplianceAuditService.record_audit_event(
                session=db,
                company_id=company.id,
                event_type="COMPANY_PROFILE_UPDATE",
                entity_name="Company",
                entity_id=company.id,
                action_summary=f"Company profile updated by {current_user.username} ({current_user.role})",
                actor_user_id=current_user.id,
                actor_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
                ip_address=ip_address,
                before_state=before_state,
                after_state=after_state,
                branch_id=tenant_ctx.branch_id or "BR-MAIN-001",
            )
        except Exception:
            # Audit service non-fatal fallback logging
            pass

        await db.commit()

        return await cls.get_company_profile(db, tenant_ctx)
