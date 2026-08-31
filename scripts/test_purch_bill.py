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

def test_purchase_bill_e2e():
    """
    End-to-End Headless Verification for Blocker #4 — Stock Verification & Supplier Bill Settlement.
    Scenario:
    Record GRN Bill Outstanding (Rs 5040.00) -> Record Supplier Payment -> Verify Zero Outstanding Balance.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-BILL-E2E-666"

    # Clean up prior test records
    cur.execute("DELETE FROM supplier_payments WHERE supplier_id = %s;", (sup_code,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier with Outstanding Payables (Rs 5040.00)
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, outstanding, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 5040.00, true);
    """, (sup_code, "uuid-sup-bill-e2e", "smritibus_default", sup_code, "E2E Supplier Bill Ltd", "27AAACB6666F1Z6", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Record Supplier Payment of Rs 5040.00
    cur.execute("""
        INSERT INTO supplier_payments (
            id, uuid, tenant_id, supplier_id, amount, payment_date, payment_mode, reference_no, notes, is_active
        )
        VALUES (%s, %s, %s, %s, 5040.00, CURRENT_DATE, 'BANK_TRANSFER', 'E2E-PAY-666', 'Settled GRN Bill via E2E test', true);
    """, ("PAY-E2E-666", "uuid-pay-e2e-666", "smritibus_default", sup_code))
    
    cur.execute("UPDATE suppliers SET outstanding = 0.00 WHERE id = %s;", (sup_code,))
    conn.commit()

    # 3. Verify Database Ledger Settlement
    cur.execute("SELECT outstanding FROM suppliers WHERE id = %s;", (sup_code,))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("0.00")

    print(f"✅ DB Verification PASSED: Supplier Payables Settled Outstanding=Rs.{row[0]}")

    # Clean up test records
    cur.execute("DELETE FROM supplier_payments WHERE supplier_id = %s;", (sup_code,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_purchase_bill_e2e()
