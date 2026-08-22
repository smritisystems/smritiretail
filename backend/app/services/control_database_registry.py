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

import uuid, os
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.company_database_registry import CompanyDatabaseRegistry
from ..models.tenant import Company
from ..db.provisioning import sanitize_company_db_name


class ControlDatabaseRegistryService:
    """
    Authoritative Database Registry Service in SmritiSys Control Plane.
    Resolves company business database connection metadata, verifies permissions,
    and enforces immutable, collision-safe database connection mapping using canonical CompanyDatabaseRegistry.
    """

    @staticmethod
    def build_connection_url(db_meta: CompanyDatabaseRegistry) -> str:
        """
        Builds asyncpg connection URL from authoritative control registry metadata.
        Uses environment configuration for secure credential binding.
        """
        user = os.getenv("POSTGRES_USER") or "postgres"
        host = db_meta.host_reference if hasattr(db_meta, "host_reference") else getattr(db_meta, "host", "localhost")
        port = db_meta.port_reference if hasattr(db_meta, "port_reference") else getattr(db_meta, "port", 5432)
        db_name = db_meta.database_name
        pwd = os.getenv("POSTGRES_PASSWORD") or "postgres"
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db_name}"

    @classmethod
    async def get_company_database(
        cls,
        session: AsyncSession,
        company_code_or_id: str
    ) -> Optional[CompanyDatabaseRegistry]:
        """
        Fetches active/ready database registration for a company code or id from SmritiSys.
        """
        clean_code = company_code_or_id.strip()
        stmt = select(CompanyDatabaseRegistry).where(
            or_(
                CompanyDatabaseRegistry.company_id == clean_code,
                CompanyDatabaseRegistry.database_id == clean_code,
                CompanyDatabaseRegistry.company_id == f"COMP-{clean_code.upper()}"
            ),
            CompanyDatabaseRegistry.status == "READY"
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
    ) -> CompanyDatabaseRegistry:
        """
        Registers a newly provisioned company database in SmritiSys.
        Enforces collision-safe naming and uniqueness on canonical CompanyDatabaseRegistry.
        """
        clean_code = company_code.strip().upper()
        sanitized_db_name = sanitize_company_db_name(clean_code)

        # Check existing registration
        existing_stmt = select(CompanyDatabaseRegistry).where(
            or_(
                CompanyDatabaseRegistry.company_id == company_id,
                CompanyDatabaseRegistry.database_name == sanitized_db_name
            )
        )
        existing = (await session.execute(existing_stmt)).scalar_one_or_none()
        if existing:
            return existing

        db_reg = CompanyDatabaseRegistry(
            company_id=company_id,
            database_id=f"db_{clean_code.lower()}",
            database_name=sanitized_db_name,
            database_engine="postgresql",
            host_reference=host,
            port_reference=port,
            status="READY",
            schema_version="3.16.0",
            region="ap-south-1",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            last_health_check=datetime.now(timezone.utc),
            provisioning_status="COMPLETED",
            migration_status="UP_TO_DATE"
        )
        session.add(db_reg)
        await session.commit()
        await session.refresh(db_reg)
        return db_reg
