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

import re
import asyncio
import os
import subprocess
import sys
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import asyncpg


def sanitize_company_db_name(company_code: str) -> str:
    """
    Sanitizes company code into a collision-safe immutable PostgreSQL database identifier.
    Example: 'TATTLY' -> 'Smritibus_TATTLY', 'ABC-01' -> 'Smritibus_ABC01'
    """
    clean_code = re.sub(r'[^A-Za-z0-9]', '', company_code).upper()
    if not clean_code:
        clean_code = "DEFAULT"
    return f"Smritibus_{clean_code}"


async def provision_postgresql_database(
    db_name: str,
    pg_host: str = "localhost",
    pg_port: int = 5432,
    pg_user: str = "postgres",
    pg_password: str = "postgres",
    maintenance_db: str = "postgres",
    migrate: bool = False
) -> Dict[str, Any]:
    """
    Asynchronously creates a new PostgreSQL database if it does not already exist.
    """
    conn_url = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{maintenance_db}"
    
    try:
        conn = await asyncpg.connect(conn_url)
        try:
            # Check if database already exists
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)",
                db_name
            )
            
            if not exists:
                # PostgreSQL requires CREATE DATABASE outside a transaction block
                # asyncpg execute without transaction handles raw DDL
                safe_db_name = f'"{db_name}"'
                await conn.execute(f"CREATE DATABASE {safe_db_name}")
                created = True
                status_msg = f"Database {db_name} successfully provisioned."
            else:
                created = False
                status_msg = f"Database {db_name} already exists."
                
            result = {
                "status": "SUCCESS",
                "db_name": db_name,
                "created": created,
                "message": status_msg
            }

            if migrate and created:
                backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
                env = os.environ.copy()
                env["DATABASE_URL"] = (
                    f"postgresql+asyncpg://{pg_user}:{pg_password}@"
                    f"{pg_host}:{pg_port}/{db_name}"
                )

                def run_alembic(target_revision: str) -> None:
                    completed = subprocess.run(
                        [sys.executable, "-m", "alembic", "-x", f"db={db_name}", "upgrade", target_revision],
                        cwd=backend_dir,
                        env=env,
                        capture_output=True,
                        text=True,
                    )
                    if completed.returncode != 0:
                        raise RuntimeError(
                            f"Alembic upgrade failed for Company DB '{db_name}' at {target_revision}: "
                            f"{completed.stdout}\n{completed.stderr}"
                        )

                # v1403 reads sales_orders.po_number, so the prerequisite belongs
                # between the historical schema and the reconciliation revisions.
                run_alembic("v1402_legacy_reconcile")
                from .bootstrap import bootstrap_company_database_prerequisites
                from sqlalchemy import create_engine

                with create_engine(
                    f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{db_name}"
                ).begin() as company_connection:
                    bootstrap_result = bootstrap_company_database_prerequisites(
                        company_connection,
                        db_name=db_name,
                    )
                run_alembic("head")
                result["bootstrap"] = bootstrap_result

            return result
        finally:
            await conn.close()
    except Exception as e:
        return {
            "status": "ERROR",
            "db_name": db_name,
            "created": False,
            "error": str(e)
        }
