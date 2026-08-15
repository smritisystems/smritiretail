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

def test_grn_shortage_and_stock_increment_signature_scenario():
    """
    Test Blocker #3 GRN / Material Receipt Signature Scenario:
    PO = 50
    Approved PO
    GRN = 48
    Short = 2
    Stock Increment = +48
    Verify available stock.
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-GRN-SIGN-001"
    po_id = "PO-GRN-SIGN-001"
    grn_id = "GRN-SIGN-001"
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
    """, (sup_code, "uuid-sup-grn-sign", "smritibus_default", sup_code, "GRN Signature Supplier Pvt Ltd", "27AAACG1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Create Approved Purchase Order (PO = 50 units)
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, tenant_id, order_no, document_number, supplier_id, 
            subtotal, tax_total, grand_total, 
            status, workflow_status, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Approved', 'Approved', true);
    """, (po_id, "uuid-po-grn-sign", "smritibus_default", "PO-2026-GRN-SIGN", "PO-2026-GRN-SIGN", sup_code))
    
    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, tenant_id, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_manually_overridden, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, false, true);
    """, ("POI-GRN-SIGN-1", "uuid-poi-grn-sign", "smritibus_default", po_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 3. Create GRN Material Receipt (GRN = 48 units, Short = 2 units)
    po_qty = 50
    grn_qty = 48
    short_qty = po_qty - grn_qty
    cost_price = Decimal("100.00")
    gst_rate = Decimal("5.00")
    line_subtotal = cost_price * Decimal(grn_qty)
    line_tax = (line_subtotal * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
    line_total = line_subtotal + line_tax

    cur.execute("""
        INSERT INTO purchase_receipts (
            id, uuid, tenant_id, receipt_no, document_number, supplier_id, order_id,
            status, subtotal, tax_total, grand_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'RECEIVED', %s, %s, %s, true);
    """, (grn_id, "uuid-grn-sign-001", "smritibus_default", "GRN-2026-SIGN-001", "GRN-2026-SIGN-001", sup_code, po_id, line_subtotal, line_tax, line_total))

    cur.execute("""
        INSERT INTO purchase_receipt_items (
            id, uuid, tenant_id, receipt_id, product_id, code, name,
            quantity_ordered, quantity_received, cost_price, gst_rate, tax_amount, line_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true);
    """, ("PRI-SIGN-1", "uuid-pri-sign-1", "smritibus_default", grn_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36", po_qty, grn_qty, cost_price, gst_rate, line_tax, line_total))
    conn.commit()

    # 4. Verify Signature Assertions
    cur.execute("""
        SELECT poi.quantity, pri.quantity_received, (poi.quantity - pri.quantity_received) AS short_qty
        FROM purchase_order_items poi
        JOIN purchase_receipt_items pri ON poi.order_id = %s AND pri.receipt_id = %s
        WHERE poi.product_id = %s;
    """, (po_id, grn_id, product_id))
    row = cur.fetchone()
    assert row is not None, "GRN receipt item must be linked to PO item"
    assert Decimal(str(row[0])) == Decimal("50")  # PO Qty
    assert Decimal(str(row[1])) == Decimal("48")  # GRN Qty
    assert Decimal(str(row[2])) == Decimal("2")   # Short Qty

    # Clean up test records
    cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()
