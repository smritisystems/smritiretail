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

def test_control_plane_db_connection_target():
    """Verify Control Plane session always targets smritisys."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT current_database();")
    db_name = cur.fetchone()[0]
    conn.close()
    assert db_name == "smritisys"

def test_company_db_runtime_routing_allow():
    """Verify Company A authorized routing returns READY company database target."""
    res = CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-001")
    assert res["company_id"] == "COMP-001"
    assert res["database_status"] == "READY"

def test_company_db_runtime_routing_company_a_vs_b():
    """Verify Company A user requesting Company B receives 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr_store_manager_a", "COMP-UNAUTHORIZED-B")
    assert exc_info.value.status_code == 403

def test_company_db_runtime_routing_unassigned():
    """Verify unassigned user receives 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr_random", "COMP-999")
    assert exc_info.value.status_code == 403

def test_company_db_runtime_routing_suspended():
    """Verify suspended company status receives 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-SUSPENDED-001")
    assert exc_info.value.status_code == 403

def test_company_db_runtime_routing_unknown():
    """Verify unknown company receives 403 Forbidden."""
    with pytest.raises(HTTPException) as exc_info:
        CompanyDatabaseResolver.resolve_company_database("usr-admin", "COMP-UNKNOWN-XYZ")
    assert exc_info.value.status_code == 403

def test_no_business_endpoint_accidental_smritisys_mutation():
    """Verify business transaction tables cannot be accidentally mutated in smritisys."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    menus_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
    audit_cnt = cur.fetchone()[0]
    conn.close()
    assert menus_cnt == 34
    assert audit_cnt >= 40
