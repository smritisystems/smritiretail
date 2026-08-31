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

import os
import re
import uuid
import asyncio
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncEngine
from sqlalchemy.pool import NullPool
from alembic.config import Config
from alembic import command

from ..core.config import settings
from .session import _company_engines, _company_sessionmakers, _verified_company_databases
from ..models.auth import User, UserRole
from ..models.tenant import Company, Branch
from ..services.unified_ledger import UnifiedAccountingLedgerService


class EphemeralTenantHarness:
    """
    Authoritative Multi-Tenant Ephemeral Database CI/CD Test Harness.
    Dynamically provisions isolated PostgreSQL databases, executes symmetrical
    Alembic migrations, validates clean-slate schema parity, and guarantees tear-down.
    """

    @classmethod
    def _get_pg_admin_connection_info(cls) -> Dict[str, Any]:
        parsed = urlparse(settings.DATABASE_URL)
        return {
            "user": os.getenv("POSTGRES_USER") or parsed.username or "postgres",
            "password": os.getenv("POSTGRES_PASSWORD") or parsed.password or "postgres",
            "host": os.getenv("POSTGRES_HOST") or parsed.hostname or "localhost",
            "port": int(os.getenv("POSTGRES_PORT") or parsed.port or 5432),
            "dbname": "postgres"  # Maintenance database for DDL
        }

    @classmethod
    def generate_ephemeral_db_name(cls, prefix: str = "smrititst") -> str:
        """
        Generates a 9-character compliant tenant database name matching the regex ^smriti[a-z0-9]{3}$.
        """
        suffix = uuid.uuid4().hex[:3].lower()
        return f"smriti{suffix}"

    @classmethod
    def create_ephemeral_database(cls, db_name: str) -> Dict[str, Any]:
        """
        Creates a clean PostgreSQL database outside transaction block.
        """
        conn_info = cls._get_pg_admin_connection_info()
        conn = psycopg2.connect(**conn_info)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        try:
            # Check if exists
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (db_name,))
            exists = cur.fetchone() is not None
            if not exists:
                cur.execute(f'CREATE DATABASE "{db_name}";')
            return {
                "status": "SUCCESS",
                "db_name": db_name,
                "created": not exists,
                "message": f"Ephemeral database {db_name} ready."
            }
        finally:
            cur.close()
            conn.close()

    @classmethod
    def drop_ephemeral_database(cls, db_name: str) -> Dict[str, Any]:
        """
        Force-terminates active connections and drops the ephemeral database.
        """
        # 1. Dispose any cached SQLAlchemy engines
        if db_name in _company_engines:
            eng = _company_engines.pop(db_name)
            try:
                eng.sync_engine.dispose()
            except Exception:
                pass

        if db_name in _company_sessionmakers:
            _company_sessionmakers.pop(db_name, None)

        _verified_company_databases.discard(db_name)

        # 2. Terminate connections and drop via psycopg2
        conn_info = cls._get_pg_admin_connection_info()
        conn = psycopg2.connect(**conn_info)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        try:
            # Terminate connections to db_name
            cur.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid();",
                (db_name,)
            )
            cur.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE);')
            return {
                "status": "SUCCESS",
                "db_name": db_name,
                "dropped": True,
                "message": f"Ephemeral database {db_name} dropped cleanly."
            }
        finally:
            cur.close()
            conn.close()

    @classmethod
    def run_alembic_upgrade(cls, db_name: str, revision: str = "head") -> None:
        """
        Programmatically executes Alembic upgrade on the target database via clean subprocess.
        """
        import sys
        import subprocess
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cmd = [sys.executable, "-m", "alembic", "-x", f"db={db_name}", "upgrade", revision]
        res = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Alembic upgrade failed on {db_name}:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")

    @classmethod
    def run_alembic_downgrade(cls, db_name: str, revision: str = "base") -> None:
        """
        Programmatically executes Alembic downgrade on the target database via clean subprocess.
        """
        import sys
        import subprocess
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cmd = [sys.executable, "-m", "alembic", "-x", f"db={db_name}", "downgrade", revision]
        res = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"Alembic downgrade failed on {db_name}:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")

    @classmethod
    def get_ephemeral_sessionmaker(cls, db_name: str) -> async_sessionmaker:
        """
        Creates an isolated async sessionmaker for the ephemeral database.
        """
        conn_info = cls._get_pg_admin_connection_info()
        user = conn_info["user"]
        password = conn_info["password"]
        host = conn_info["host"]
        port = conn_info["port"]

        url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"
        eng = create_async_engine(url, poolclass=NullPool, echo=False)

        _company_engines[db_name] = eng
        sm = async_sessionmaker(bind=eng, class_=AsyncSession, expire_on_commit=False)
        _company_sessionmakers[db_name] = sm
        _verified_company_databases.add(db_name)
        return sm

    @classmethod
    async def get_table_names(cls, session: AsyncSession) -> List[str]:
        """
        Inspects and returns all non-system table names in the database.
        """
        conn = await session.connection()
        return await conn.run_sync(lambda sync_conn: sa.inspect(sync_conn).get_table_names())

    @classmethod
    async def seed_baseline_tenant_environment(
        cls,
        session: AsyncSession,
        company_id: str = "COMP-EPHEM-01",
        branch_id: str = "BR-EPHEM-01",
        company_name: str = "Ephemeral Retail India Pvt Ltd",
        branch_name: str = "Flagship Store"
    ) -> Dict[str, Any]:
        """
        Seeds standard Chart of Accounts, Company, Branch, and Default System User into clean database.
        """
        # 1. Company & Branch
        comp = Company(
            id=company_id,
            uuid=str(uuid.uuid4()),
            name=company_name,
            gst_number="27AABCU9603R1ZM",
            is_active=True,
            is_deleted=False
        )
        branch = Branch(
            id=branch_id,
            uuid=str(uuid.uuid4()),
            code="MAIN",
            name=branch_name,
            company_id=company_id,
            is_active=True,
            is_deleted=False
        )
        session.add_all([comp, branch])
        await session.flush()

        # 2. System Users
        admin_user = User(
            id=f"usr-admin-{uuid.uuid4().hex[:6]}",
            uuid=str(uuid.uuid4()),
            username=f"admin_{uuid.uuid4().hex[:4]}",
            email=f"admin_{uuid.uuid4().hex[:4]}@smritibooks.com",
            hashed_password="hashed_admin_password",
            role=UserRole.SYSADMIN,
            company_id=company_id,
            branch_id=branch_id,
            is_active=True,
            is_deleted=False
        )
        cashier_user = User(
            id=f"usr-cashier-{uuid.uuid4().hex[:6]}",
            uuid=str(uuid.uuid4()),
            username=f"cashier_{uuid.uuid4().hex[:4]}",
            email=f"cashier_{uuid.uuid4().hex[:4]}@smritibooks.com",
            hashed_password="hashed_cashier_password",
            role=UserRole.CASHIER,
            company_id=company_id,
            branch_id=branch_id,
            is_active=True,
            is_deleted=False
        )
        session.add_all([admin_user, cashier_user])
        await session.flush()

        # 3. Seed Chart of Accounts
        accounts = await UnifiedAccountingLedgerService.seed_default_chart_of_accounts(
            session=session,
            company_id=company_id,
            branch_id=branch_id
        )

        await session.commit()
        return {
            "company_id": company_id,
            "branch_id": branch_id,
            "admin_user_id": admin_user.id,
            "cashier_user_id": cashier_user.id,
            "accounts_count": len(accounts)
        }

