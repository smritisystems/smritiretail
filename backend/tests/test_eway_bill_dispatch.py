"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.22.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import uuid
import pytest
import psycopg2
from decimal import Decimal

# Architecture Rule: eway_bills is an operational table.
# Operational data belongs in Company DB (smriti001), NOT in smritisys (Control Plane).
COMPANY_001_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

def test_eway_bill_dispatch_workflow():
    """
    Test Blocker #7 E-Way Bill & Dispatch Workflow against Company 001 database (smriti001).
    ARCHITECTURE: eway_bills is operational data -> Company DB (smriti001). NOT smritisys.
    Verifies:
    - Creation of an E-Way Bill record for invoice dispatch
    - Transport metadata persistence (vehicle_no, transporter_name, distance_km, status='DISPATCHED')
    """
    conn = psycopg2.connect(COMPANY_001_DB_URL)
    cur = conn.cursor()

    ewb_id = "EWB-TEST-001"
    ewb_no = "EWB-2026-TEST-001"
    inv_id = "inv-test-ewb-001"

    # Clean up prior test records
    cur.execute("DELETE FROM eway_bills WHERE id = %s;", (ewb_id,))
    cur.execute("DELETE FROM sales_invoices WHERE id = %s;", (inv_id,))
    conn.commit()

    # Ensure referenced invoice exists in Company DB (idempotent seed)
    cur.execute("""
        INSERT INTO sales_invoices (
            id, uuid, company_id, branch_id, invoice_no, date, customer_id,
            tax_total, grand_total, is_interstate, version, status, is_active, is_deleted, created_at, modified_at
        )
        VALUES (
            %s, %s, 'COMP-001', 'MAIN', 'INV-TEST-EWB-001', CURRENT_DATE, 'cust-ril-1888',
            360.00, 2360.00, false, 1, 'DISPATCHED', true, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    """, (inv_id, str(uuid.uuid4())))
    conn.commit()

    # 1. Insert E-Way Bill Record in Company DB
    cur.execute("""
        INSERT INTO eway_bills (
            id, uuid, eway_bill_no, invoice_id, consignment_value,
            transporter_id, transporter_name, transport_mode, vehicle_no, distance_km,
            valid_from, valid_until, status, created_at, modified_at, is_active, is_deleted, version
        )
        VALUES (
            %s, %s, %s, %s, 111434.00,
            'TRP-VTRANS-001', 'V-Trans Logistics Pvt Ltd', 'Road', 'MH04AB1234', 250,
            NOW(), NOW() + INTERVAL '3 days', 'DISPATCHED', NOW(), NOW(), true, false, 1
        );
    """, (ewb_id, str(uuid.uuid4()), ewb_no, inv_id))
    conn.commit()

    # 2. Verify E-Way Bill Persistence in Company DB
    cur.execute("""
        SELECT eway_bill_no, invoice_id, transporter_name, vehicle_no, distance_km, status
        FROM eway_bills
        WHERE id = %s;
    """, (ewb_id,))
    row = cur.fetchone()
    assert row is not None, "E-Way Bill record must exist in Company DB (smriti001) eway_bills table"
    assert row[0] == ewb_no
    assert row[1] == inv_id
    assert row[2] == "V-Trans Logistics Pvt Ltd"
    assert row[3] == "MH04AB1234"
    assert Decimal(str(row[4])) == Decimal("250")
    assert row[5] == "DISPATCHED"

    # Clean up test records
    cur.execute("DELETE FROM eway_bills WHERE id = %s;", (ewb_id,))
    cur.execute("DELETE FROM sales_invoices WHERE id = %s;", (inv_id,))
    conn.commit()
    conn.close()
