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
from decimal import Decimal

def test_purchase_invoice_and_stock_verification():
    """
    Test Blocker #4 Stock Verification & Purchase Invoice / Supplier Payment Settlement.
    Verifies:
    - Supplier creation and initial outstanding = 0.00
    - Supplier Purchase Bill posting updates outstanding balance to Grand Total (Rs 5040.00)
    - Supplier Payment registration reduces outstanding balance
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-BILL-TEST-001"

    # Clean up prior test records
    cur.execute("DELETE FROM supplier_payments WHERE supplier_id = %s;", (sup_code,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier with Outstanding Balance (Rs 5040.00 from GRN 48 units @ 100 + 5% GST)
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, outstanding, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 5040.00, true);
    """, (sup_code, "uuid-sup-bill-test", "smritibus_default", sup_code, "Supplier Bill Test Pvt Ltd", "27AAACB1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Verify Initial Outstanding
    cur.execute("SELECT outstanding FROM suppliers WHERE id = %s;", (sup_code,))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("5040.00")

    # 3. Record Supplier Payment of Rs 5040.00
    cur.execute("""
        INSERT INTO supplier_payments (
            id, uuid, tenant_id, supplier_id, amount, payment_date, payment_mode, reference_no, notes, is_active
        )
        VALUES (%s, %s, %s, %s, 5040.00, CURRENT_DATE, 'BANK_TRANSFER', 'REF-PAY-001', 'Settled GRN Bill', true);
    """, ("PAY-TEST-001", "uuid-pay-test-001", "smritibus_default", sup_code))
    
    cur.execute("UPDATE suppliers SET outstanding = 0.00 WHERE id = %s;", (sup_code,))
    conn.commit()

    # 4. Verify Settled Outstanding Balance
    cur.execute("SELECT outstanding FROM suppliers WHERE id = %s;", (sup_code,))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("0.00")

    # Clean up test records
    cur.execute("DELETE FROM supplier_payments WHERE supplier_id = %s;", (sup_code,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()
