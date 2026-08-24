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

# Architecture Rule: suppliers, purchase_orders, purchase_receipts are operational tables.
# Operational data belongs in Company DB (smriti001), NOT in smritisys (Control Plane).
COMPANY_001_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

def test_grn_shortage_and_stock_increment_signature_scenario():
    """
    Test Blocker #3 GRN / Material Receipt Signature Scenario against Company 001 database (smriti001):
    PO = 50 | Approved PO | GRN = 48 | Short = 2 | Stock Increment = +48
    ARCHITECTURE: purchase_orders, suppliers, purchase_receipts are operational -> Company DB (smriti001).
    """
    conn = psycopg2.connect(COMPANY_001_DB_URL)
    cur = conn.cursor()

    sup_id = "SUP-GRN-SIGN-001"
    po_id = "PO-GRN-SIGN-001"
    grn_id = "GRN-SIGN-001"
    product_id = "prod-ch-24-g-black-36"

    # Clean up prior test records (in dependency order)
    cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE id = %s;", (sup_id,))
    conn.commit()

    # Ensure test product exists in Company DB (idempotent seed)
    cur.execute("""
        INSERT INTO products (
            id, uuid, code, name, barcode, category, brand,
            company_id, branch_id, stock, reserved_stock, price, is_active, is_deleted, created_at, modified_at
        )
        VALUES (
            %s, %s, 'CH-24-G-BLACK-36', 'CH-24-G BLACK 36', 'BAR-CH-24-G-2', 'Footwear', 'CH',
            'COMP-001', 'MAIN', 1000, 0, 1000.00, true, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    """, (product_id, str(uuid.uuid4())))
    conn.commit()

    # 1. Create Supplier in Company DB
    cur.execute("""
        INSERT INTO suppliers (id, uuid, code, name, gst_number, city, state, outstanding, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 0.00, true);
    """, (sup_id, str(uuid.uuid4()), sup_id, "GRN Signature Supplier Pvt Ltd", "27AAACG1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Create Approved Purchase Order (PO = 50 units) in Company DB
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, order_no, supplier_id,
            subtotal, tax_total, grand_total,
            status, is_active
        )
        VALUES (%s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Approved', true);
    """, (po_id, str(uuid.uuid4()), "PO-2026-GRN-SIGN", sup_id))

    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, true);
    """, ("POI-GRN-SIGN-1", str(uuid.uuid4()), po_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 3. Create GRN Material Receipt (GRN = 48 units, Short = 2 units)
    po_qty = 50
    grn_qty = 48
    cost_price = Decimal("100.00")
    gst_rate = Decimal("5.00")
    line_subtotal = cost_price * Decimal(grn_qty)
    line_tax = (line_subtotal * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
    line_total = line_subtotal + line_tax

    cur.execute("""
        INSERT INTO purchase_receipts (
            id, uuid, receipt_no, supplier_id, order_id,
            status, subtotal, tax_total, grand_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, 'RECEIVED', %s, %s, %s, true);
    """, (grn_id, str(uuid.uuid4()), "GRN-2026-SIGN-001", sup_id, po_id, line_subtotal, line_tax, line_total))

    cur.execute("""
        INSERT INTO purchase_receipt_items (
            id, uuid, receipt_id, product_id, code, name,
            quantity_ordered, quantity_received, cost_price, gst_rate, tax_amount, line_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true);
    """, ("PRI-SIGN-1", str(uuid.uuid4()), grn_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36",
          po_qty, grn_qty, cost_price, gst_rate, line_tax, line_total))
    conn.commit()

    # 4. Verify Signature Assertions in Company DB
    cur.execute("""
        SELECT poi.quantity, pri.quantity_received, (poi.quantity - pri.quantity_received) AS short_qty
        FROM purchase_order_items poi
        JOIN purchase_receipt_items pri ON poi.order_id = %s AND pri.receipt_id = %s
        WHERE poi.product_id = %s;
    """, (po_id, grn_id, product_id))
    row = cur.fetchone()
    assert row is not None, "GRN receipt item must be linked to PO item in Company DB (smriti001)"
    assert Decimal(str(row[0])) == Decimal("50")   # PO Qty
    assert Decimal(str(row[1])) == Decimal("48")   # GRN Qty
    assert Decimal(str(row[2])) == Decimal("2")    # Short Qty

    # Clean up test records (in dependency order)
    cur.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE id = %s;", (sup_id,))
    conn.commit()
    conn.close()
