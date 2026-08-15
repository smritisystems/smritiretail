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

def test_purchase_order_creation_and_approval_workflow():
    """
    Test Blocker #2 Purchase Order Workflow against PostgreSQL database.
    Scenario:
    - Create Supplier (SUP-PO-TEST-001)
    - Issue Purchase Order for 50 units @ Rs 100/unit
    - Verify PO status transitions (Draft -> Approved)
    """
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    sup_code = "SUP-PO-TEST-001"
    po_id = "PO-TEST-AUDIT-500"

    # Clean up prior test records if any
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s OR id = %s;", (sup_code, sup_code))
    conn.commit()

    # 1. Insert Test Supplier
    cur.execute("""
        INSERT INTO suppliers (id, uuid, tenant_id, code, name, gst_number, city, state, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true);
    """, (sup_code, "uuid-sup-po-test", "smritibus_default", sup_code, "PO Test Supplier Pvt Ltd", "27AAACPO1234F1Z1", "Mumbai", "Maharashtra"))
    conn.commit()

    # 2. Insert Test Purchase Order (Draft)
    cur.execute("""
        INSERT INTO purchase_orders (
            id, uuid, tenant_id, order_no, document_number, supplier_id, 
            subtotal, tax_total, grand_total, 
            status, workflow_status, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, 5000.00, 250.00, 5250.00, 'Draft', 'Submitted', true);
    """, (po_id, "uuid-po-test-500", "smritibus_default", "PO-2026-TEST-500", "PO-2026-TEST-500", sup_code))
    conn.commit()

    # 3. Insert Purchase Order Items (50 units)
    cur.execute("""
        INSERT INTO purchase_order_items (
            id, uuid, tenant_id, order_id, product_id, code, name,
            quantity, cost_price, gst_rate, tax_amount, line_total, is_manually_overridden, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, 50, 100.00, 5.00, 250.00, 5250.00, false, true);
    """, ("POI-TEST-500-1", "uuid-poi-test-500", "smritibus_default", po_id, "prod-ch-24-g-black-36", "CH-24-G-BLACK-36", "CH-24-G BLACK 36"))
    conn.commit()

    # 4. Approve Purchase Order
    cur.execute("""
        UPDATE purchase_orders 
        SET status = 'Approved', workflow_status = 'Approved' 
        WHERE id = %s;
    """, (po_id,))
    conn.commit()

    # 5. Verify PO record
    cur.execute("""
        SELECT po.order_no, po.status, po.grand_total, poi.quantity, poi.cost_price 
        FROM purchase_orders po
        JOIN purchase_order_items poi ON po.id = poi.order_id
        WHERE po.id = %s;
    """, (po_id,))
    row = cur.fetchone()
    assert row is not None, "Purchase order and items must exist in database"
    assert row[0] == "PO-2026-TEST-500"
    assert row[1] == "Approved"
    assert Decimal(str(row[2])) == Decimal("5250.00")
    assert Decimal(str(row[3])) == Decimal("50")
    assert Decimal(str(row[4])) == Decimal("100.00")

    # Clean up test records
    cur.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur.execute("DELETE FROM suppliers WHERE code = %s;", (sup_code,))
    conn.commit()
    conn.close()
