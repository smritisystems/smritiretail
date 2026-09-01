#!/usr/bin/env python3
import psycopg2
import uuid
from datetime import datetime, date

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

# Data for SO-2026-0001
so_id = "so-2026-0001"
so_uuid = str(uuid.uuid4())
order_no = "SO-2026-0001"
order_date = date(2026, 9, 1)
customer_name = "Reliance Retail Limited"
customer_id = "CUST-001"
po_number = "PO-5182778158"
po_date = date(2026, 9, 1)
tax_total = 146.17
basic_total = 2923.36
grand_total = 3069.53
total_qty = 2.0
billed_qty = 0
pending_qty = 2.0
billed_value = 0
pending_value = 3069.53
status = "DRAFT"
fulfillment_status = "UNFULFILLED"

# Company and Branch IDs
company_id = "comp-sal-359785"
branch_id = "br-sal-359785"

# Created by and timestamp
created_by = "SYSADMIN"
created_at = datetime.utcnow()

# Insert into sales_orders
insert_so_sql = """
INSERT INTO sales_orders (
    id, uuid, order_no, date, customer_name, customer_id,
    po_number, po_date,
    tax_total, basic_total, grand_total,
    total_qty, billed_qty, pending_qty,
    billed_value, pending_value,
    status, fulfillment_status,
    company_id, branch_id,
    created_by, created_at,
    is_active, is_deleted, version,
    po_metadata
) VALUES (
    %s, %s, %s, %s, %s, %s,
    %s, %s,
    %s, %s, %s,
    %s, %s, %s,
    %s, %s,
    %s, %s,
    %s, %s,
    %s, %s,
    true, false, 1,
    '{}'
)
"""

try:
    cur.execute(insert_so_sql, (
        so_id, so_uuid, order_no, order_date, customer_name, customer_id,
        po_number, po_date,
        tax_total, basic_total, grand_total,
        total_qty, billed_qty, pending_qty,
        billed_value, pending_value,
        status, fulfillment_status,
        company_id, branch_id,
        created_by, created_at
    ))
    
    conn.commit()
    print(f"✓ Sales order {order_no} inserted successfully!")
    
    # Verify insertion
    cur.execute("SELECT order_no, customer_name, grand_total, date FROM sales_orders WHERE order_no = %s", (order_no,))
    result = cur.fetchone()
    if result:
        print(f"\n✓ Verified: {result}")
    
except Exception as e:
    conn.rollback()
    print(f"✗ Error inserting sales order: {e}")

cur.close()
conn.close()
