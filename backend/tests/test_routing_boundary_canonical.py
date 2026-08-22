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

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import psycopg2
from fastapi import HTTPException
from app.services.company_database_resolver import (
    CompanyDatabaseResolver,
    validate_company_database_name,
    generate_company_database_name
)
from app.db.session import resolve_company_database_name

CONTROL_PLANE_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"


def test_authorized_user_reaches_assigned_database():
    """Verify that an authorized user successfully reaches their assigned database."""
    res = CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-001")
    assert res["company_id"] == "COMP-001"
    assert res["database_name"] == "smriti001"
    assert res["database_status"] == "READY"
    assert "smriti001" in res["connection_url"]


def test_unauthorized_user_access_rejected_403():
    """Verify that a user without assignment to a company receives 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr_random_unassigned", "COMP-001")
    assert exc_info.value.status_code == 403
    assert "not authorized" in exc_info.value.detail.lower()


def test_unregistered_company_rejected_with_zero_demo_fallback():
    """Verify that querying an unseeded/unregistered company fails closed with 403 (no demo fallback)."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-NONEXISTENT-999")
    assert exc_info.value.status_code == 403
    assert "unknown or not registered" in exc_info.value.detail.lower()


def test_suspended_company_database_access_denied_403():
    """Verify that a suspended company database is blocked with 403 Forbidden."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Seed temporary suspended company & registry entry
        cur.execute("""
            INSERT INTO companies (id, uuid, name, is_active, is_deleted)
            VALUES ('COMP-SUSP-TEST', 'uuid-susp-test', 'Suspended Co', true, false)
            ON CONFLICT (id) DO UPDATE SET is_active = true;
        """)
        cur.execute("""
            INSERT INTO user_company_assignments (id, uuid, user_id, company_id, is_default, is_active, is_deleted)
            VALUES ('uca-susp-test', 'uuid-uca-susp-test', 'usr-admin', 'COMP-SUSP-TEST', false, true, false)
            ON CONFLICT (id) DO NOTHING;
        """)
        cur.execute("""
            INSERT INTO company_database_registries (company_id, database_id, database_name, status)
            VALUES ('COMP-SUSP-TEST', 'db-susp-test', 'smritiSUS', 'SUSPENDED')
            ON CONFLICT (company_id) DO UPDATE SET status = 'SUSPENDED';
        """)

        with pytest.raises(HTTPException) as exc_info:
            CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-SUSP-TEST")
        assert exc_info.value.status_code == 403
        assert "suspended" in exc_info.value.detail.lower() or "status 'suspended'" in exc_info.value.detail.lower()

    finally:
        cur.execute("DELETE FROM user_company_assignments WHERE id = 'uca-susp-test';")
        cur.execute("DELETE FROM company_database_registries WHERE company_id = 'COMP-SUSP-TEST';")
        cur.execute("DELETE FROM companies WHERE id = 'COMP-SUSP-TEST';")
        conn.close()


def test_resolver_rejects_arbitrary_database_names():
    """Verify that resolver refuses arbitrary/invalid database strings."""
    assert not validate_company_database_name("arbitrary_db")
    assert not validate_company_database_name("smriti_invalid_name")
    assert not validate_company_database_name("smriti000")  # 000 reserved
    assert not validate_company_database_name("smritiSYS")  # SYS reserved for control plane
    assert not validate_company_database_name("smriti1234")  # 4 chars invalid
    assert validate_company_database_name("smriti001")
    assert validate_company_database_name("smriti002")
    assert validate_company_database_name("smriti003")


@pytest.mark.asyncio
async def test_session_resolver_fails_closed_on_unregistered_company():
    """Verify that async resolve_company_database_name fails closed on unregistered company."""
    with pytest.raises(HTTPException) as exc_info:
        await resolve_company_database_name("COMP-UNKNOWN-RANDOM-888")
    assert exc_info.value.status_code == 403
    assert "not found" in exc_info.value.detail.lower() or "access denied" in exc_info.value.detail.lower()
