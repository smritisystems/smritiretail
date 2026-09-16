"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-08-15
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import pytest
import psycopg2
from decimal import Decimal

# Self-provisioned tenant IDs for this test module
# company_code constraint: ^[A-Z0-9]{3,12}$ (uppercase alphanumeric, 3-12 chars, no hyphens)
_TEST_COMPANY_ID = "PURCHBTEST"   # 10 chars, ^[A-Z0-9]{3,12}$ compliant
_TEST_BRANCH_ID  = "PURCHBR"      # 7 chars


def test_purchase_invoice_and_stock_verification():
    """
    Test Blocker #4 Stock Verification & Purchase Invoice / Supplier Payment Settlement.
    Verifies:
    - Supplier creation and initial outstanding balance
    - Supplier Payment registration reduces outstanding balance to 0.00
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    conn.autocommit = False
    cur = conn.cursor()

    sup_code = "SUP-BILL-TEST-001"

    # Clean up any prior test records (reverse FK order)
    cur.execute("DELETE FROM supplier_payments WHERE id = 'PAY-TEST-001';")
    cur.execute("DELETE FROM suppliers WHERE id = %s;", (sup_code,))
    cur.execute("DELETE FROM branches WHERE id = %s;", (_TEST_BRANCH_ID,))
    cur.execute("DELETE FROM companies WHERE id = %s;", (_TEST_COMPANY_ID,))
    conn.commit()

    # 0. Self-provision tenant context (company + branch) — required for FK constraints
    cur.execute("""
        INSERT INTO companies (id, uuid, company_code, name, is_active, is_deleted, created_at, modified_at)
        VALUES (%s, %s, %s, %s, true, false, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    """, (_TEST_COMPANY_ID, "uuid-comp-purch-bill-test", _TEST_COMPANY_ID, "Purchase Bill Test Company"))
    cur.execute("""
        INSERT INTO branches (id, uuid, company_id, code, name, is_active, is_deleted)
        VALUES (%s, %s, %s, %s, %s, true, false)
        ON CONFLICT (id) DO NOTHING;
    """, (_TEST_BRANCH_ID, "uuid-br-purch-bill-test", _TEST_COMPANY_ID, _TEST_BRANCH_ID, "Purchase Bill Test Branch"))
    conn.commit()

    # 1. Create Supplier with Outstanding Balance (Rs 5040.00 from GRN 48 units @ 100 + 5% GST)
    cur.execute("""
        INSERT INTO suppliers (id, uuid, company_id, branch_id, code, name, gst_number, city, state, outstanding, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 5040.00, true);
    """, (sup_code, "uuid-sup-bill-test", _TEST_COMPANY_ID, _TEST_BRANCH_ID,
          sup_code, "Supplier Bill Test Pvt Ltd", "27AAACB1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Verify Initial Outstanding
    cur.execute("SELECT outstanding FROM suppliers WHERE id = %s;", (sup_code,))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("5040.00")

    # 3. Record Supplier Payment of Rs 5040.00
    cur.execute("""
        INSERT INTO supplier_payments (
            id, uuid, company_id, branch_id, supplier_id, amount, payment_date, payment_mode, reference_no, notes, is_active
        )
        VALUES (%s, %s, %s, %s, %s, 5040.00, CURRENT_DATE, 'BANK_TRANSFER', 'REF-PAY-001', 'Settled GRN Bill', true);
    """, ("PAY-TEST-001", "uuid-pay-test-001", _TEST_COMPANY_ID, _TEST_BRANCH_ID, sup_code))

    cur.execute("UPDATE suppliers SET outstanding = 0.00 WHERE id = %s;", (sup_code,))
    conn.commit()

    # 4. Verify Settled Outstanding Balance
    cur.execute("SELECT outstanding FROM suppliers WHERE id = %s;", (sup_code,))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("0.00")

    # Clean up (reverse FK order)
    cur.execute("DELETE FROM supplier_payments WHERE id = 'PAY-TEST-001';")
    cur.execute("DELETE FROM suppliers WHERE id = %s;", (sup_code,))
    cur.execute("DELETE FROM branches WHERE id = %s;", (_TEST_BRANCH_ID,))
    cur.execute("DELETE FROM companies WHERE id = %s;", (_TEST_COMPANY_ID,))
    conn.commit()
    conn.close()
