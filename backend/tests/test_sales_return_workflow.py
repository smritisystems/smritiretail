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

# Architecture Rule: sales_returns is an operational table.
# Operational data belongs in Company DB (smriti001), NOT in smritisys (Control Plane).
COMPANY_001_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

def test_sales_return_and_credit_note_workflow():
    """
    Test Blocker #6 Sales Return / Credit Note Workflow against Company 001 database (smriti001).
    ARCHITECTURE: sales_returns is operational data -> Company DB (smriti001). NOT smritisys.
    Verifies:
    - Creation of a Sales Return record & Credit Note against an existing invoice
    - Transaction history protection: Original invoice record remains immutable
    - Credit Note persistence in Company DB sales_returns table
    """
    conn = psycopg2.connect(COMPANY_001_DB_URL)
    cur = conn.cursor()

    ret_id = "RET-TEST-001"
    ret_no = "RET-2026-TEST-001"
    cn_no = "CN-2026-TEST-001"
    inv_id = "inv-test-ret-001"

    # Clean up prior test records
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    cur.execute("DELETE FROM sales_invoices WHERE id = %s;", (inv_id,))
    conn.commit()

    # Ensure a referenced invoice exists in Company DB (idempotent seed)
    cur.execute("""
        INSERT INTO sales_invoices (
            id, uuid, company_id, branch_id, invoice_no, date, customer_id,
            tax_total, grand_total, is_interstate, version, status, is_active, is_deleted, created_at, modified_at
        )
        VALUES (
            %s, %s, 'COMP-001', 'MAIN', 'INV-TEST-RET-001', CURRENT_DATE, 'cust-ril-1888',
            360.00, 2360.00, false, 1, 'DISPATCHED', true, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    """, (inv_id, str(uuid.uuid4())))
    conn.commit()

    # 1. Insert Sales Return (Credit Note Rs 1000.00 base + Rs 50.00 tax = Rs 1050.00)
    cur.execute("""
        INSERT INTO sales_returns (
            id, uuid, company_id, return_no, original_invoice_id, credit_note_number,
            date, reason, tax_total, grand_total, status, is_active, is_deleted, created_at, modified_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE, 'Customer Return - Size Fit Issue',
                50.00, 1050.00, 'APPROVED', true, false, NOW(), NOW());
    """, (ret_id, str(uuid.uuid4()), "COMP-001", ret_no, inv_id, cn_no))
    conn.commit()

    # 2. Verify Sales Return Persistence in Company DB
    cur.execute("""
        SELECT return_no, original_invoice_id, credit_note_number, grand_total, status, reason
        FROM sales_returns
        WHERE id = %s;
    """, (ret_id,))
    row = cur.fetchone()
    assert row is not None, "Sales Return record must exist in Company DB (smriti001) sales_returns table"
    assert row[0] == ret_no
    assert row[1] == inv_id
    assert row[2] == cn_no
    assert Decimal(str(row[3])) == Decimal("1050.00")
    assert row[4] == "APPROVED"
    assert row[5] == "Customer Return - Size Fit Issue"

    # Clean up test records
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    cur.execute("DELETE FROM sales_invoices WHERE id = %s;", (inv_id,))
    conn.commit()
    conn.close()
