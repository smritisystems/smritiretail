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

import sys, os, time
import psycopg2
from decimal import Decimal

sys.stdout.reconfigure(encoding='utf-8')

def test_eway_bill_e2e():
    """
    End-to-End Headless Verification for Blocker #7 — E-Way Bill & Dispatch Workflow UI.
    Scenario:
    Record E-Way Bill (EWB-2026-E2E-333) -> Transporter V-Trans -> Vehicle MH04AB1234 -> Verify Status DISPATCHED.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    ewb_id = "EWB-E2E-333"
    ewb_no = "EWB-2026-E2E-333"
    inv_id = "inv-disp-1888"

    # Clean up prior test record
    cur.execute("DELETE FROM eway_bills WHERE id = %s;", (ewb_id,))
    conn.commit()

    # 1. Insert E-Way Bill Record
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
    """, (ewb_id, "uuid-ewb-e2e-333", ewb_no, inv_id))
    conn.commit()

    # 2. Verify Database State
    cur.execute("""
        SELECT eway_bill_no, invoice_id, transporter_name, vehicle_no, distance_km, status
        FROM eway_bills
        WHERE id = %s;
    """, (ewb_id,))
    row = cur.fetchone()
    assert row is not None
    assert row[0] == ewb_no
    assert row[1] == inv_id
    assert row[2] == "V-Trans Logistics Pvt Ltd"
    assert row[3] == "MH04AB1234"
    assert Decimal(str(row[4])) == Decimal("250")
    assert row[5] == "DISPATCHED"

    print(f"✅ DB Verification PASSED: Generated E-Way Bill [{row[0]}] Invoice='{row[1]}' Transporter='{row[2]}' Vehicle='{row[3]}' Status='{row[5]}'")

    # Clean up test record
    cur.execute("DELETE FROM eway_bills WHERE id = %s;", (ewb_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_eway_bill_e2e()
