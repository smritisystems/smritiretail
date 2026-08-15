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
from app.services.company_database_provisioner import CompanyDatabaseProvisioner

CONTROL_PLANE_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"

def test_provisioning_dry_run_alphanumeric_abc():
    """Verify dry-run provisioning plan for Alphanumeric Code ABC produces smritiABC."""
    provisioner = CompanyDatabaseProvisioner(dry_run=True)
    plan = provisioner.run_dry_run_provisioning("COMP-ABC", "SMRITI Alpha Store", company_code="ABC")
    assert plan["company_code"] == "ABC"
    assert plan["database_name"] == "smritiABC"
    assert plan["dry_run"] is True
    assert plan["database_mutations"] == 0
    assert plan["company_databases_created"] == 0

def test_provisioning_dry_run_alphanumeric_mum():
    """Verify dry-run provisioning plan for Alphanumeric Code MUM produces smritiMUM."""
    provisioner = CompanyDatabaseProvisioner(dry_run=True)
    plan = provisioner.run_dry_run_provisioning("COMP-MUM", "SMRITI Mumbai Store", company_code="MUM")
    assert plan["company_code"] == "MUM"
    assert plan["database_name"] == "smritiMUM"

def test_provisioning_reserved_codes_rejected():
    """Verify 000 and SYS codes are permanently reserved and rejected by provisioner."""
    provisioner = CompanyDatabaseProvisioner(dry_run=True)
    with pytest.raises(ValueError) as exc_000:
        provisioner.run_dry_run_provisioning("COMP-000", "Reserved Zero Company", company_code="000")
    assert "reserved" in str(exc_000.value)

    with pytest.raises(ValueError) as exc_sys:
        provisioner.run_dry_run_provisioning("COMP-SYS", "Reserved Control Plane", company_code="SYS")
    assert "reserved" in str(exc_sys.value)

def test_no_unapproved_company_databases_exist():
    """Verify smriti001 exists as reference DB while smritiABC/smritiMUM do not exist."""
    conn = psycopg2.connect(CONTROL_PLANE_URL)
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datname IN ('smritiABC', 'smritiMUM', 'smritiSYS');")
    dbs = cur.fetchall()
    conn.close()
    assert len(dbs) == 0, f"Expected 0 unapproved databases created, found {dbs}"
