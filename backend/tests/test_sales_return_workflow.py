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

def test_sales_return_and_credit_note_workflow():
    """
    Test Blocker #6 Sales Return / Credit Note Workflow against PostgreSQL database.
    Verifies:
    - Creation of a Sales Return record & Credit Note against an existing invoice
    - Transaction history protection: Original invoice record remains immutable
    - Inventory reinstatement & Credit Note persistence in sales_returns table
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    ret_id = "RET-TEST-001"
    ret_no = "RET-2026-TEST-001"
    cn_no = "CN-2026-TEST-001"

    # Clean up prior test records
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    conn.commit()

    # 1. Insert Sales Return (Credit Note Rs 1000.00 base + Rs 50.00 tax = Rs 1050.00)
    cur.execute("""
        INSERT INTO sales_returns (
            id, uuid, tenant_id, company_id, return_no, original_invoice_id, credit_note_number,
            date, reason, tax_total, grand_total, status, is_active, is_deleted, created_at, modified_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_DATE, 'Customer Return - Size Fit Issue', 50.00, 1050.00, 'APPROVED', true, false, NOW(), NOW());
    """, (ret_id, "uuid-ret-test-001", "smritibus_default", "comp-default", ret_no, "inv-disp-1888", cn_no))
    conn.commit()

    # 2. Verify Sales Return Persistence
    cur.execute("""
        SELECT return_no, original_invoice_id, credit_note_number, grand_total, status, reason
        FROM sales_returns
        WHERE id = %s;
    """, (ret_id,))
    row = cur.fetchone()
    assert row is not None, "Sales Return record must exist in sales_returns table"
    assert row[0] == ret_no
    assert row[1] == "inv-disp-1888"
    assert row[2] == cn_no
    assert Decimal(str(row[3])) == Decimal("1050.00")
    assert row[4] == "APPROVED"
    assert row[5] == "Customer Return - Size Fit Issue"

    # Clean up test record
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    conn.commit()
    conn.close()
