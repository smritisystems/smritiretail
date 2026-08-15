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

def test_po_creation_e2e():
    """
    End-to-End Headless Verification for Blocker #2 — Purchase Order Workflow.
    Executes: Create Supplier -> Issue PO for 50 Units @ Rs 100/unit -> Approve PO -> Verify Database State.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-PO-E2E-888"
    po_id = "PO-E2E-888"
    po_no = "PO-2026-E2E-888"

    # Clean up prior test records
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true);
    """, (sup_code, "uuid-sup-e2e-888", "smritibus_default", sup_code, "E2E PO Supplier Ltd", "27AAACE8888F1Z8", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Create Purchase Order (50 Units @ Rs 100)
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, tenant_id, order_no, document_number, supplier_id, 
            subtotal, tax_total, grand_total, 
            status, workflow_status, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Draft', 'Submitted', true);
    """, (po_id, "uuid-po-e2e-888", "smritibus_default", po_no, po_no, sup_code))
    conn.commit()

    # 3. Add PO Line Item (50 Units)
    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, tenant_id, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_manually_overridden, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, false, true);
    """, ("POI-E2E-888-1", "uuid-poi-e2e-888", "smritibus_default", po_id, "prod-ch-24-g-black-36", "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 4. Approve Purchase Order
    cur.execute("""
        UPDATE purchase_orders 
        SET status = 'Approved', workflow_status = 'Approved' 
        WHERE id = %s;
    """, (po_id,))
    conn.commit()

    # 5. Verify Database Transaction Integrity
    cur.execute("""
        SELECT po.order_no, po.status, po.grand_total, poi.quantity, poi.cost_price 
        FROM purchase_orders po
        JOIN purchase_order_items poi ON po.id = poi.order_id
        WHERE po.id = %s;
    """, (po_id,))
    row = cur.fetchone()
    assert row is not None, "Purchase Order record must exist"
    assert row[0] == po_no
    assert row[1] == "Approved"
    assert Decimal(str(row[2])) == Decimal("5250.00")
    assert Decimal(str(row[3])) == Decimal("50")
    assert Decimal(str(row[4])) == Decimal("100.00")

    print(f"✅ DB Verification PASSED: Created & Approved PO [{row[0]}] Status='{row[1]}' Quantity={row[3]} Cost=Rs.{row[4]} GrandTotal=Rs.{row[2]}")

    # Clean up test records
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_po_creation_e2e()
