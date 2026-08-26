"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import psycopg2
import sys
from pathlib import Path
from decimal import Decimal

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app.schemas.sales import SalesOrderResponse, SalesOrderItemResponse, SalesOrderInvoiceAllocationResponse
except ImportError:
    from backend.app.schemas.sales import SalesOrderResponse, SalesOrderItemResponse, SalesOrderInvoiceAllocationResponse

DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

@pytest.fixture
def db_conn():
    conn = psycopg2.connect(DB_URL)
    yield conn
    conn.close()

def test_01_pydantic_sales_order_schema_validation(db_conn):
    """Verify that all 60 Sales Orders in smriti001 strictly validate against Pydantic SalesOrderResponse."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT
            id, order_no, date, customer_name, tax_total, grand_total, status, source_quotation_id,
            po_number, po_date, delivery_date, site_code, site_name, delivery_address, vendor_code,
            customer_id, customer_gstin, basic_total, is_interstate, total_qty, billed_qty, billed_value,
            pending_qty, pending_value, fulfillment_status, po_metadata, created_at, modified_at,
            is_active, is_deleted, version
        FROM sales_orders
        WHERE is_deleted = false
        ORDER BY po_number ASC;
    """)
    rows = cur.fetchall()
    assert len(rows) == 60

    for r in rows:
        order_dict = {
            "id": r[0],
            "order_no": r[1],
            "date": r[2],
            "customer_name": r[3],
            "tax_total": r[4],
            "grand_total": r[5],
            "status": r[6],
            "source_quotation_id": r[7],
            "po_number": r[8],
            "po_date": r[9],
            "delivery_date": r[10],
            "site_code": r[11],
            "site_name": r[12],
            "delivery_address": r[13],
            "vendor_code": r[14],
            "customer_id": r[15],
            "customer_gstin": r[16],
            "basic_total": r[17],
            "is_interstate": r[18],
            "total_qty": r[19],
            "billed_qty": r[20],
            "billed_value": r[21],
            "pending_qty": r[22],
            "pending_value": r[23],
            "fulfillment_status": r[24],
            "po_metadata": r[25] or {},
            "created_at": r[26],
            "modified_at": r[27],
            "is_active": r[28],
            "is_deleted": r[29],
            "version": r[30],
            "items": [],
            "allocations": []
        }

        # Pydantic validation
        validated = SalesOrderResponse.model_validate(order_dict)
        assert validated.order_no.startswith("SO-5182778")
        assert validated.po_number is not None
        assert validated.total_qty > 0
        assert validated.basic_total > 0
        assert validated.grand_total > 0
        assert validated.fulfillment_status in ["FULLY_BILLED", "PARTIALLY_BILLED", "UNFULFILLED"]

def test_02_pydantic_line_items_validation(db_conn):
    """Verify that sample line items validate against SalesOrderItemResponse with extended PO fields."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT
            id, order_id, product_id, code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount,
            sr_no, article_no, ean, vendor_style, color, size, uom, mrp, base_cost, taxable_value,
            igst_amount, cgst_amount, sgst_amount, line_total, delivery_date, site_code
        FROM sales_order_items
        LIMIT 100;
    """)
    rows = cur.fetchall()
    assert len(rows) == 100

    for r in rows:
        item_dict = {
            "id": r[0],
            "order_id": r[1],
            "product_id": r[2],
            "code": r[3],
            "name": r[4],
            "quantity": r[5],
            "price": r[6],
            "hsn_code": r[7],
            "gst_rate": r[8],
            "tax_amount": r[9],
            "total_amount": r[10],
            "sr_no": r[11],
            "article_no": r[12],
            "ean": r[13],
            "vendor_style": r[14],
            "color": r[15],
            "size": r[16],
            "uom": r[17],
            "mrp": r[18],
            "base_cost": r[19],
            "taxable_value": r[20],
            "igst_amount": r[21],
            "cgst_amount": r[22],
            "sgst_amount": r[23],
            "line_total": r[24],
            "delivery_date": r[25],
            "site_code": r[26],
        }
        validated = SalesOrderItemResponse.model_validate(item_dict)
        assert validated.product_id is not None
        assert validated.price > 0
        assert validated.quantity > 0
        assert validated.ean is not None
        assert validated.vendor_style is not None

def test_03_pydantic_allocations_validation(db_conn):
    """Verify that all 120 allocation records validate against SalesOrderInvoiceAllocationResponse."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT
            id, order_id, order_no, po_number, invoice_id, invoice_no, invoice_date,
            po_quantity, po_value, billed_quantity, billed_value, pending_quantity, pending_value,
            status, allocation_metadata
        FROM sales_order_invoice_allocations
        WHERE is_deleted = false;
    """)
    rows = cur.fetchall()
    assert len(rows) == 120

    for r in rows:
        alloc_dict = {
            "id": r[0],
            "order_id": r[1],
            "order_no": r[2],
            "po_number": r[3],
            "invoice_id": r[4],
            "invoice_no": r[5],
            "invoice_date": r[6],
            "po_quantity": r[7],
            "po_value": r[8],
            "billed_quantity": r[9],
            "billed_value": r[10],
            "pending_quantity": r[11],
            "pending_value": r[12],
            "status": r[13],
            "allocation_metadata": r[14] or {}
        }
        validated = SalesOrderInvoiceAllocationResponse.model_validate(alloc_dict)
        assert validated.invoice_no.startswith("TT2026-2027/")
        assert validated.po_quantity > 0
        assert validated.billed_quantity > 0
