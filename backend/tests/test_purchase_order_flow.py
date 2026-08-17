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

# Architecture Rule: suppliers, purchase_orders are operational tables.
# Operational data belongs in Company DB (smriti001), NOT in smritisys (Control Plane).
COMPANY_001_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

def test_purchase_order_creation_and_approval_workflow():
    """
    Test Blocker #2 Purchase Order Workflow against Company 001 database (smriti001).
    ARCHITECTURE: purchase_orders, suppliers are operational -> Company DB (smriti001). NOT smritisys.
    Scenario:
    - Create Supplier (SUP-PO-TEST-001)
    - Issue Purchase Order for 50 units @ Rs 100/unit
    - Verify PO status transitions (Draft -> Approved)
    """
    conn = psycopg2.connect(COMPANY_001_DB_URL)
    cur = conn.cursor()

    sup_id = "SUP-PO-TEST-001"
    po_id = "PO-TEST-AUDIT-500"
    product_id = "prod-ch-24-g-black-36"

    # Clean up prior test records if any (in dependency order)
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
            %s, %s, 'CH-24-G-BLACK-36', 'CH-24-G BLACK 36', 'BAR-CH-24-G-3', 'Footwear', 'CH',
            'COMP-001', 'MAIN', 1000, 0, 1000.00, true, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING;
    """, (product_id, str(uuid.uuid4())))
    conn.commit()

    # 1. Insert Test Supplier in Company DB
    cur.execute("""
        INSERT INTO suppliers (id, uuid, code, name, gst_number, city, state, outstanding, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 0.00, true);
    """, (sup_id, str(uuid.uuid4()), sup_id, "PO Test Supplier Pvt Ltd", "27AAACPO1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Insert Test Purchase Order (Draft) in Company DB
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, order_no, supplier_id,
            subtotal, tax_total, grand_total,
            status, is_active
        )
        VALUES (%s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Draft', true);
    """, (po_id, str(uuid.uuid4()), "PO-2026-TEST-500", sup_id))
    conn.commit()

    # 3. Insert Purchase Order Items (50 units) in Company DB
    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, true);
    """, ("POI-TEST-500-1", str(uuid.uuid4()), po_id, product_id, "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 4. Approve Purchase Order in Company DB
    cur.execute("""
        UPDATE purchase_orders
        SET status = 'Approved'
        WHERE id = %s;
    """, (po_id,))
    conn.commit()

    # 5. Verify PO record in Company DB
    cur.execute("""
        SELECT po.order_no, po.status, po.grand_total, poi.quantity, poi.cost_price
        FROM purchase_orders po
        JOIN purchase_order_items poi ON po.id = poi.order_id
        WHERE po.id = %s;
    """, (po_id,))
    row = cur.fetchone()
    assert row is not None, "Purchase order and items must exist in Company DB (smriti001)"
    assert row[0] == "PO-2026-TEST-500"
    assert row[1] == "Approved"
    assert Decimal(str(row[2])) == Decimal("5250.00")
    assert Decimal(str(row[3])) == Decimal("50")
    assert Decimal(str(row[4])) == Decimal("100.00")

    # Clean up test records (in dependency order)
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE id = %s;", (sup_id,))
    conn.commit()
    conn.close()
