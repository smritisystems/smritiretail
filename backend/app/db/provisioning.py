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
    maintenance_db: str = "postgres"
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
                
            return {
                "status": "SUCCESS",
                "db_name": db_name,
                "created": created,
                "message": status_msg
            }
        finally:
            await conn.close()
    except Exception as e:
        return {
            "status": "ERROR",
            "db_name": db_name,
            "created": False,
            "error": str(e)
        }
