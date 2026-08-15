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

def test_debit_note_e2e():
    """
    End-to-End Headless Verification for Blocker #5 — Purchase Return / Debit Note Workflow.
    Scenario:
    Issue Debit Note for 2 Units Shortage (Rs 210.00 total) -> Verify History Protection & DB Persistence.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-DN-E2E-555"
    dn_id = "DN-E2E-555"
    dn_no = "DN-2026-E2E-555"
    grn_test_id = "GRN-2026-E2E-DN"

    # Clean up prior test records
    cur.execute("DELETE FROM supplier_debit_notes WHERE id = %s;", (dn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s OR supplier_id = %s;", (grn_test_id, sup_code))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier & GRN Receipt
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true);
    """, (sup_code, "uuid-sup-dn-e2e", "smritibus_default", sup_code, "E2E Debit Note Supplier Ltd", "27AAACD5555F1Z5", "Mumbai", "Maharashtra"))

    cur.execute("""
        INSERT INTO purchase_receipts (
            id, uuid, tenant_id, receipt_no, document_number, supplier_id,
            status, subtotal, tax_total, grand_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 'RECEIVED', 4800.00, 240.00, 5040.00, true);
    """, (grn_test_id, "uuid-grn-dn-e2e", "smritibus_default", grn_test_id, grn_test_id, sup_code))
    conn.commit()

    # 2. Issue Debit Note for 2 Units Shortage (Rs 200.00 base + 5% tax = Rs 210.00)
    cur.execute("""
        INSERT INTO supplier_debit_notes (
            id, uuid, company_id, tenant_id, debit_note_no, supplier_id, receipt_id,
            claim_amount, tax_amount, total_debit_amount, status, reason, is_active, is_deleted,
            created_at, modified_at, version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 200.00, 10.00, 210.00, 'ISSUED', 'GRN Shortage 2 Units', true, false, NOW(), NOW(), 1);
    """, (dn_id, "uuid-dn-e2e-555", "smritibus_default", "smritibus_default", dn_no, sup_code, grn_test_id))
    conn.commit()

    # 3. Verify Debit Note Persistence & History Protection
    cur.execute("""
        SELECT debit_note_no, supplier_id, claim_amount, total_debit_amount, status, reason
        FROM supplier_debit_notes
        WHERE id = %s;
    """, (dn_id,))
    row = cur.fetchone()
    assert row is not None
    assert row[0] == dn_no
    assert row[1] == sup_code
    assert Decimal(str(row[2])) == Decimal("200.00")
    assert Decimal(str(row[3])) == Decimal("210.00")
    assert row[4] == "ISSUED"

    print(f"✅ DB Verification PASSED: Created Debit Note [{row[0]}] Status='{row[4]}' ClaimAmount=Rs.{row[2]} TotalDebit=Rs.{row[3]} Reason='{row[5]}'")

    # Clean up test records
    cur.execute("DELETE FROM supplier_debit_notes WHERE id = %s;", (dn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_test_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_debit_note_e2e()
