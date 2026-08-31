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

import pytest
import psycopg2

def test_supplier_database_schema_and_crud():
    """
    Test Blocker #1 Supplier Master Creation against PostgreSQL database.
    Verifies that supplier record can be inserted and fetched cleanly.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()

    # Check suppliers table existence
    cur.execute("""
        SELECT count(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'suppliers';
    """)
    assert cur.fetchone()[0] == 1, "suppliers table must exist in public schema"

    # Insert safe test supplier
    test_code = "SUP-TEST-AUDIT-001"
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (test_code, test_code))
    
    cur.execute("""
        INSERT INTO suppliers (id, uuid, company_id, branch_id, code, name, gst_number, mobile, email, city, state, outstanding, is_active, is_deleted)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0.00, true, false);
    """, (test_code, "test-supplier-uuid-12345", "COMP-001", "MAIN", test_code, "Test Audit Supplier Pvt Ltd", "27AABCT1234F1Z5", "+91 9820098200", "audit@testsupplier.com", "Mumbai", "Maharashtra"))
    conn.commit()

    # Query back inserted supplier
    cur.execute("SELECT name, gst_number, city FROM suppliers WHERE code = %s;", (test_code,))
    row = cur.fetchone()
    assert row is not None, "Inserted supplier must exist in database"
    assert row[0] == "Test Audit Supplier Pvt Ltd"
    assert row[1] == "27AABCT1234F1Z5"
    assert row[2] == "Mumbai"

    # Clean up safe test supplier
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (test_code,))
    conn.commit()
    conn.close()
