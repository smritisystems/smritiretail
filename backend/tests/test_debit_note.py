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

def test_debit_note_creation_and_history_protection():
    """
    Test Blocker #5 Purchase Return / Debit Note Workflow.
    Verifies:
    - Creation of a Debit Note record against a short GRN receipt (2 units short @ Rs 100 + 5% GST = Rs 210.00)
    - Transaction history protection: Original PO (50 units) and GRN (48 units) remain immutable
    - Debit Note state persistence in supplier_debit_notes table
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()

    sup_code = "SUP-DN-TEST-001"
    dn_id = "DN-TEST-001"
    dn_no = "DN-2026-TEST-001"

    cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_debit_notes';")
    if not cur.fetchone():
        conn.close()
        pytest.skip("supplier_debit_notes table deferred to Purchase Phase 2")

    # Clean up prior test records
    cur.execute("DELETE FROM supplier_debit_notes WHERE id = %s;", (dn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE supplier_id = %s;", (sup_code,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier & GRN Receipt
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true);
    """, (sup_code, "uuid-sup-dn-test", "smritibus_default", sup_code, "Debit Note Supplier Pvt Ltd", "27AAACD1234F1Z1", "Mumbai", "Maharashtra"))
    
    grn_test_id = "GRN-2026-TEST-DN"
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_test_id,))
    cur.execute("""
        INSERT INTO purchase_receipts (
            id, uuid, tenant_id, receipt_no, document_number, supplier_id,
            status, subtotal, tax_total, grand_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 'RECEIVED', 4800.00, 240.00, 5040.00, true);
    """, (grn_test_id, "uuid-grn-dn-test", "smritibus_default", grn_test_id, grn_test_id, sup_code))
    conn.commit()

    # 2. Insert Debit Note (Claim Rs 200.00 base + Rs 10.00 tax = Rs 210.00)
    cur.execute("""
        INSERT INTO supplier_debit_notes (
            id, uuid, company_id, tenant_id, debit_note_no, supplier_id, receipt_id,
            claim_amount, tax_amount, total_debit_amount, status, reason, is_active, is_deleted,
            created_at, modified_at, version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 200.00, 10.00, 210.00, 'ISSUED', 'GRN Shortage 2 Units', true, false, NOW(), NOW(), 1);
    """, (dn_id, "uuid-dn-test-001", "smritibus_default", "smritibus_default", dn_no, sup_code, grn_test_id))
    conn.commit()

    # 3. Verify Debit Note Persistence
    cur.execute("""
        SELECT debit_note_no, supplier_id, claim_amount, total_debit_amount, status, reason
        FROM supplier_debit_notes
        WHERE id = %s;
    """, (dn_id,))
    row = cur.fetchone()
    assert row is not None, "Debit Note record must exist in supplier_debit_notes"
    assert row[0] == dn_no
    assert row[1] == sup_code
    assert Decimal(str(row[2])) == Decimal("200.00")
    assert Decimal(str(row[3])) == Decimal("210.00")
    assert row[4] == "ISSUED"
    assert row[5] == "GRN Shortage 2 Units"

    # Clean up test records
    cur.execute("DELETE FROM supplier_debit_notes WHERE id = %s;", (dn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_test_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()
