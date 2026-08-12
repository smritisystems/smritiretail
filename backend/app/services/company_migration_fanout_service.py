"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-12
Classification: Company Migration Fan-Out & Schema Drift Detection Service
"""

import asyncio
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.db.company_base import CompanyBase
from app.models.control import ControlCompanyDatabase, DatabaseRegistryStatus
from app.services.control_database_registry import ControlDatabaseRegistryService


@dataclass
class DatabaseSchemaDriftReport:
    company_code: str
    db_name: str
    is_in_sync: bool
    missing_tables: List[str] = field(default_factory=list)
    extra_tables: List[str] = field(default_factory=list)
    missing_columns: Dict[str, List[str]] = field(default_factory=dict)
    status: str = "IN_SYNC"  # IN_SYNC, DRIFTED, CRITICAL


@dataclass
class FanoutMigrationResult:
    company_code: str
    db_name: str
    success: bool
    message: str


class CompanyMigrationFanoutService:
    """
    CompanyMigrationFanoutService — Orchestrates DDL schema migrations across
    physically isolated company databases registered in Control DB.
    """

    @classmethod
    async def run_migration_fanout(
        cls,
        control_db: AsyncSession,
        target_company_codes: Optional[List[str]] = None,
    ) -> List[FanoutMigrationResult]:
        """
        Applies CompanyBase DDL schema updates to all target active physical company databases.
        """
        stmt = select(ControlCompanyDatabase).where(
            ControlCompanyDatabase.status == DatabaseRegistryStatus.ACTIVE.value
        )
        if target_company_codes:
            clean_targets = [c.strip().upper() for c in target_company_codes]
            stmt = stmt.where(ControlCompanyDatabase.company_code.in_(clean_targets))

        res = await control_db.execute(stmt)
        databases = res.scalars().all()

        results: List[FanoutMigrationResult] = []
        enums_ddl = text("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN 
                    CREATE TYPE userrole AS ENUM ('SYSADMIN', 'MANAGER', 'CASHIER', 'REPORT_USER', 'VIEWER'); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'databaseregistrystatus') THEN 
                    CREATE TYPE databaseregistrystatus AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'MIGRATING', 'FAILED', 'DRIFTED', 'ARCHIVED'); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'masterhubstatus') THEN 
                    CREATE TYPE masterhubstatus AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED'); 
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'masterhubimportstatus') THEN 
                    CREATE TYPE masterhubimportstatus AS ENUM ('ACCEPTED', 'REJECTED', 'CONFLICT', 'UPDATE_AVAILABLE'); 
                END IF;
            END $$;
        """)

        for db_meta in databases:
            try:
                conn_url = ControlDatabaseRegistryService.build_connection_url(db_meta)
                engine = create_async_engine(conn_url, isolation_level="AUTOCOMMIT")

                async with engine.connect() as conn:
                    await conn.execute(enums_ddl)
                    await conn.run_sync(lambda sync_conn: CompanyBase.metadata.create_all(sync_conn, checkfirst=True))

                await engine.dispose()
                results.append(FanoutMigrationResult(
                    company_code=db_meta.company_code,
                    db_name=db_meta.db_name,
                    success=True,
                    message="Schema migration synchronized successfully."
                ))
            except Exception as e:
                results.append(FanoutMigrationResult(
                    company_code=db_meta.company_code,
                    db_name=db_meta.db_name,
                    success=False,
                    message=f"Migration fanout failed: {str(e)}"
                ))

        return results


class CompanySchemaDriftDetector:
    """
    CompanySchemaDriftDetector — Inspects physical PostgreSQL database tables and columns
    against CompanyBase.metadata definitions to detect schema drift.
    """

    @classmethod
    async def inspect_company_database_drift(
        cls,
        control_db: AsyncSession,
        company_code: str,
    ) -> DatabaseSchemaDriftReport:
        """
        Inspects physical schema of a single company DB against CompanyBase.metadata.
        """
        clean_code = company_code.strip().upper()
        db_meta = await ControlDatabaseRegistryService.get_company_database(control_db, clean_code)
        if not db_meta:
            raise HTTPException(status_code=404, detail=f"Company database configuration for company_code '{clean_code}' not found in registry.")

        conn_url = ControlDatabaseRegistryService.build_connection_url(db_meta)
        engine = create_async_engine(conn_url)

        expected_tables = set(CompanyBase.metadata.tables.keys())

        def _sync_inspect(sync_conn) -> DatabaseSchemaDriftReport:
            inspector = inspect(sync_conn)
            actual_tables = set(inspector.get_table_names())

            missing_tables = sorted(list(expected_tables - actual_tables))
            extra_tables = sorted(list(actual_tables - expected_tables - {"alembic_version", "spatial_ref_sys"}))
            missing_columns: Dict[str, List[str]] = {}

            for table_name in expected_tables.intersection(actual_tables):
                expected_cols = {c.name for c in CompanyBase.metadata.tables[table_name].columns}
                actual_cols = {c["name"] for c in inspector.get_columns(table_name)}
                cols_missing = sorted(list(expected_cols - actual_cols))
                if cols_missing:
                    missing_columns[table_name] = cols_missing

            is_in_sync = (len(missing_tables) == 0 and len(missing_columns) == 0)
            status = "IN_SYNC" if is_in_sync else "DRIFTED"

            return DatabaseSchemaDriftReport(
                company_code=clean_code,
                db_name=db_meta.db_name,
                is_in_sync=is_in_sync,
                missing_tables=missing_tables,
                extra_tables=extra_tables,
                missing_columns=missing_columns,
                status=status,
            )

        try:
            async with engine.connect() as conn:
                report = await conn.run_sync(_sync_inspect)
            return report
        finally:
            await engine.dispose()
