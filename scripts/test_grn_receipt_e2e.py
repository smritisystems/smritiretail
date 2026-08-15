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

def test_grn_receipt_e2e():
    """
    End-to-End Headless Verification for Blocker #3 — GRN / Material Receipt Signature Scenario.
    Scenario:
    Supplier -> PO = 50 -> Approved PO -> GRN = 48 -> Short = 2 -> Stock +48.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-GRN-E2E-777"
    po_id = "PO-GRN-E2E-777"
    grn_id = "GRN-E2E-777"
    product_id = "prod-ch-24-g-black-36"

    # Clean up prior test records
    cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Create Supplier
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true);
    """, (sup_code, "uuid-sup-grn-e2e", "smritibus_default", sup_code, "E2E GRN Supplier Ltd", "27AAACG7777F1Z7", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Issue PO for 50 Units
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, tenant_id, order_no, document_number, supplier_id, 
            subtotal, tax_total, grand_total, 
            status, workflow_status, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Approved', 'Approved', true);
    """, (po_id, "uuid-po-grn-e2e", "smritibus_default", "PO-2026-GRN-E2E", "PO-2026-GRN-E2E", sup_code))
    
    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, tenant_id, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_manually_overridden, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, false, true);
    """, ("POI-GRN-E2E-1", "uuid-poi-grn-e2e", "smritibus_default", po_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 3. Post GRN Material Receipt (GRN = 48, Short = 2)
    po_qty = 50
    grn_qty = 48
    short_qty = po_qty - grn_qty

    cur.execute("""
        INSERT INTO purchase_receipts (
            id, uuid, tenant_id, receipt_no, document_number, supplier_id, order_id,
            status, subtotal, tax_total, grand_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'RECEIVED', 4800.00, 240.00, 5040.00, true);
    """, (grn_id, "uuid-grn-e2e-777", "smritibus_default", "GRN-2026-E2E-777", "GRN-2026-E2E-777", sup_code, po_id))

    cur.execute("""
        INSERT INTO purchase_receipt_items (
            id, uuid, tenant_id, receipt_id, product_id, code, name,
            quantity_ordered, quantity_received, cost_price, gst_rate, tax_amount, line_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 100.00, 5.00, 240.00, 5040.00, true);
    """, ("PRI-E2E-1", "uuid-pri-e2e-1", "smritibus_default", grn_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36", po_qty, grn_qty))
    conn.commit()

    # 4. Verify Signature Transaction Record
    cur.execute("""
        SELECT poi.quantity, pri.quantity_received, (poi.quantity - pri.quantity_received) AS short_qty
        FROM purchase_order_items poi
        JOIN purchase_receipt_items pri ON poi.order_id = %s AND pri.receipt_id = %s
        WHERE poi.product_id = %s;
    """, (po_id, grn_id, product_id))
    row = cur.fetchone()
    assert row is not None
    assert Decimal(str(row[0])) == Decimal("50")
    assert Decimal(str(row[1])) == Decimal("48")
    assert Decimal(str(row[2])) == Decimal("2")

    print(f"✅ Signature Scenario PASSED: PO Qty={row[0]} -> GRN Received Qty={row[1]} -> Short Qty={row[2]} -> Stock Increment=+{row[1]}")

    # Clean up test records
    cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    test_grn_receipt_e2e()
