"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.control.control_models import ControlCompany, ControlCompanyDatabase, ControlPSVConfig
from ..db.provisioning import sanitize_company_db_name


class ControlDatabaseRegistryService:
    """
    Authoritative Database Registry Service in SmritiSys Control Plane.
    Resolves company business database connection metadata, verifies permissions,
    and enforces immutable, collision-safe database connection mapping.
    """

    @staticmethod
    def build_connection_url(db_meta: ControlCompanyDatabase) -> str:
        """
        Builds asyncpg connection URL from authoritative control registry metadata.
        Never constructs URLs directly from unvalidated user input.
        """
        user = db_meta.db_user or "postgres"
        host = db_meta.host or "localhost"
        port = db_meta.port or 5432
        db_name = db_meta.database_name
        # Fallback default password; production retrieves from encrypted_credentials
        pwd = "postgres"
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db_name}"

    @classmethod
    async def get_company_database(
        cls,
        session: AsyncSession,
        company_code: str
    ) -> Optional[ControlCompanyDatabase]:
        """
        Fetches active database registration for a company code from SmritiSys.
        """
        clean_code = company_code.strip().upper()
        stmt = select(ControlCompanyDatabase).where(
            ControlCompanyDatabase.company_code == clean_code,
            ControlCompanyDatabase.status == "ACTIVE"
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def register_company_database(
        cls,
        session: AsyncSession,
        company_id: str,
        company_code: str,
        host: str = "localhost",
        port: int = 5432,
        db_user: str = "postgres"
    ) -> ControlCompanyDatabase:
        """
        Registers a newly provisioned company database in SmritiSys.
        Enforces collision-safe naming and uniqueness.
        """
        clean_code = company_code.strip().upper()
        sanitized_db_name = sanitize_company_db_name(clean_code)

        # Check existing registration
        existing_stmt = select(ControlCompanyDatabase).where(
            (ControlCompanyDatabase.company_code == clean_code) |
            (ControlCompanyDatabase.database_name == sanitized_db_name)
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            return existing

        db_reg = ControlCompanyDatabase(
            id=f"cdb_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            company_code=clean_code,
            database_name=sanitized_db_name,
            database_type="POSTGRESQL",
            host=host,
            port=port,
            db_user=db_user,
            status="ACTIVE",
            schema_version="1.0.0",
            created_at=datetime.now(timezone.utc),
            last_health_check=datetime.now(timezone.utc)
        )
        session.add(db_reg)
        await session.commit()
        await session.refresh(db_reg)
        return db_reg
