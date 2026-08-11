"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-11
Classification: Control DB — Database Registry & Security Authorization Service
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.control.company_registry import ControlCompany, ControlCompanyDatabase, DatabaseRegistryStatus
from app.models.control.user_auth import ControlUser, ControlUserCompanyAssignment
from app.models.control.security_audit import ControlSecurityAudit


class ControlDatabaseRegistryService:
    """
    Central Database Registry & Security Authority Service.
    Resolves physically isolated Company Databases, verifies user-company assignments,
    and enforces strict credential redaction and status governance.
    """

    @staticmethod
    async def register_company_database(
        db: AsyncSession,
        company_id: str,
        company_code: str,
        company_name: str,
        db_identifier: str,
        db_host: str,
        db_port: int = 5432,
        db_name: Optional[str] = None,
        db_user: Optional[str] = "smriti_app",
        encrypted_credentials: Optional[str] = None,
        secrets_ref: Optional[str] = None,
        schema_revision: str = "v1502_tenant_prod_sku",
        schema_fingerprint: str = "INITIAL_FINGERPRINT",
    ) -> ControlCompanyDatabase:
        """
        Registers a new Company & its physical database connection metadata in Control DB.
        """
        clean_code = company_code.strip().upper()
        clean_db_name = db_name or f"smriti_company_{clean_code.lower()}"

        # 1. Verify company unique code constraint
        stmt_comp = select(ControlCompany).where(ControlCompany.company_code == clean_code)
        res_comp = await db.execute(stmt_comp)
        if res_comp.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Company with code '{clean_code}' is already registered in Control DB."
            )

        # 2. Create ControlCompany
        company = ControlCompany(
            id=company_id,
            company_code=clean_code,
            name=company_name,
            status="ACTIVE",
            is_active=True,
        )
        db.add(company)

        # 3. Create ControlCompanyDatabase
        db_entry = ControlCompanyDatabase(
            id=f"cdb-{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            company_code=clean_code,
            db_identifier=db_identifier,
            db_host=db_host,
            db_port=db_port,
            db_name=clean_db_name,
            db_user=db_user or "smriti_app",
            encrypted_credentials=encrypted_credentials,
            secrets_ref=secrets_ref,
            status=DatabaseRegistryStatus.PROVISIONING.value,
            schema_revision=schema_revision,
            schema_fingerprint=schema_fingerprint,
            last_verified_at=datetime.now(timezone.utc),
        )
        db.add(db_entry)
        await db.commit()
        await db.refresh(db_entry)
        return db_entry

    @staticmethod
    async def get_company_database(
        db: AsyncSession,
        company_code: str,
    ) -> Optional[ControlCompanyDatabase]:
        """
        Fetches database connection metadata by company_code from Control DB.
        """
        clean_code = company_code.strip().upper()
        stmt = select(ControlCompanyDatabase).where(ControlCompanyDatabase.company_code == clean_code)
        res = await db.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def verify_user_company_access(
        db: AsyncSession,
        user_id: str,
        company_code: str,
    ) -> bool:
        """
        MANDATORY SECURITY GUARD: Verifies that a user is explicitly assigned to the target company.
        Prevents arbitrary company_code parameter escalation.
        """
        clean_code = company_code.strip().upper()
        stmt = select(ControlUserCompanyAssignment).where(
            ControlUserCompanyAssignment.user_id == user_id,
            ControlUserCompanyAssignment.company_code == clean_code,
        )
        res = await db.execute(stmt)
        assignment = res.scalars().first()
        return assignment is not None

    @staticmethod
    async def update_database_status(
        db: AsyncSession,
        company_code: str,
        new_status: DatabaseRegistryStatus,
        schema_revision: Optional[str] = None,
        schema_fingerprint: Optional[str] = None,
    ) -> ControlCompanyDatabase:
        """
        Updates database lifecycle status (ACTIVE, MIGRATING, DRIFTED, etc.) and schema verification fingerprints.
        """
        db_entry = await ControlDatabaseRegistryService.get_company_database(db, company_code)
        if not db_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No company database registered for company code '{company_code}'."
            )

        db_entry.status = new_status.value
        if schema_revision:
            db_entry.schema_revision = schema_revision
        if schema_fingerprint:
            db_entry.schema_fingerprint = schema_fingerprint
        db_entry.last_verified_at = datetime.now(timezone.utc)

        db.add(db_entry)
        await db.commit()
        await db.refresh(db_entry)
        return db_entry
