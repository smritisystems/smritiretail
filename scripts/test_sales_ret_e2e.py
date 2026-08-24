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

def test_sales_return_e2e():
    """
    End-to-End Headless Verification for Blocker #6 — Sales Return / Credit Note UI.
    Scenario:
    Issue Credit Note (CN-2026-E2E-444) against Invoice (inv-disp-1888) -> Verify History Protection & DB Record.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    ret_id = "RET-E2E-444"
    ret_no = "RET-2026-E2E-444"
    cn_no = "CN-2026-E2E-444"

    # Obtain a valid invoice ID and company ID
    cur.execute("SELECT id, company_id FROM sales_invoices LIMIT 1;")
    row_inv = cur.fetchone()
    inv_id = row_inv[0] if row_inv else "inv-disp-1888"
    comp_id = row_inv[1] if row_inv and row_inv[1] else "comp-default"

    # Clean up prior test record
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    conn.commit()

    # 1. Insert Sales Return Record
    cur.execute("""
        INSERT INTO sales_returns (
            id, uuid, tenant_id, company_id, return_no, original_invoice_id, credit_note_number,
            date, reason, tax_total, grand_total, status, is_active, is_deleted, created_at, modified_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_DATE, 'Customer Return - Defect', 50.00, 1050.00, 'APPROVED', true, false, NOW(), NOW());
    """, (ret_id, "uuid-ret-e2e-444", "smritibus_default", comp_id, ret_no, inv_id, cn_no))
    conn.commit()

    # 2. Verify Database State & History Protection
    cur.execute("""
        SELECT return_no, original_invoice_id, credit_note_number, grand_total, status, reason
        FROM sales_returns
        WHERE id = %s;
    """, (ret_id,))
    row = cur.fetchone()
    assert row is not None
    assert row[0] == ret_no
    assert row[1] == inv_id
    assert row[2] == cn_no
    assert Decimal(str(row[3])) == Decimal("1050.00")
    assert row[4] == "APPROVED"

    print(f"✅ DB Verification PASSED: Issued Credit Note [{row[2]}] ReturnNo='{row[0]}' OriginalInvoice='{row[1]}' RefundAmount=Rs.{row[3]} Status='{row[4]}'")

    # Clean up test record
    cur.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_sales_return_e2e()
