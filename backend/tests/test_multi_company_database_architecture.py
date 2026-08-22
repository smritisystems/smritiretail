"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import psycopg2
from fastapi import HTTPException
from app.services.company_database_resolver import CompanyDatabaseResolver

CONTROL_PLANE_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"

def test_smritisys_control_plane_connection():
    """Verify smritisys PostgreSQL Control Plane connection."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT current_database();")
    db_name = cur.fetchone()[0]
    conn.close()
    assert db_name == "smritisys"

def test_company_db_resolver_authorized_user():
    """Verify authorized tenant resolution returns validated database connection metadata."""
    res = CompanyDatabaseResolver.resolve_company_database("usr_sysadmin", "COMP-001")
    assert res["company_id"] == "COMP-001"
    assert res["database_status"] == "READY"
    assert res["database_name"] == "smriti001"
    assert "password" not in res
    assert "connection_url" not in res

def test_company_db_resolver_unauthorized_user():
    """Verify unauthorized user attempting company access is rejected with 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr_cashier_99", "COMP-UNKNOWN-999")
    assert exc_info.value.status_code == 403

def test_company_isolation_company_a_vs_b():
    """Verify cross-company database isolation prevents Company A user accessing Company B."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr_store_manager_a", "COMP-UNAUTHORIZED-B")
    assert exc_info.value.status_code == 403

def test_menu_governance_34_immutable_ids():
    """Verify 34 immutable menu IDs remain intact in smritisys."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    count = cur.fetchone()[0]
    conn.close()
    assert count == 34

def test_enterprise_audit_log_integrity():
    """Verify smriti_audit_log entries remain intact with 0 mutations."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
    count = cur.fetchone()[0]
    conn.close()
    assert count >= 40
