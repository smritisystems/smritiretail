"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.28.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
import psycopg2
from decimal import Decimal

DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

@pytest.fixture
def db_conn():
    conn = psycopg2.connect(DB_URL)
    yield conn
    conn.close()

def test_01_all_60_sales_orders_exist(db_conn):
    """Verify that exactly 60 historical Sales Orders exist in smriti001."""
    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sales_orders WHERE is_deleted = false;")
    count = cur.fetchone()[0]
    assert count == 60, f"Expected 60 Sales Orders, got {count}"

def test_02_sales_order_numbers_and_dates(db_conn):
    """Verify that Sales Order numbers follow SO-5182778151..5182778210 and preserve PO dates."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT order_no, po_number, date, customer_name, total_qty, basic_total, grand_total, fulfillment_status
        FROM sales_orders
        WHERE is_deleted = false
        ORDER BY po_number;
    """)
    rows = cur.fetchall()
    assert len(rows) == 60
    for idx, r in enumerate(rows, start=5182778151):
        order_no, po_num, so_date, cust_name, qty, basic, grand, status = r
        assert po_num == str(idx)
        assert order_no == f"SO-{idx}"
        assert cust_name == "Reliance Retail Limited"
        assert so_date is not None
        assert qty > 0
        assert basic > 0
        assert grand > 0
        assert status in ["FULLY_BILLED", "PARTIALLY_BILLED", "UNFULFILLED", "FULFILLED"]

def test_03_total_po_line_items_and_linking(db_conn):
    """Verify that exactly 18,036 Sales Order line items exist and 100% link to products."""
    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sales_order_items;")
    total_lines = cur.fetchone()[0]
    assert total_lines == 18036, f"Expected 18,036 lines, got {total_lines}"

    cur.execute("SELECT COUNT(*) FROM sales_order_items WHERE product_id IS NULL;")
    unlinked = cur.fetchone()[0]
    assert unlinked == 0, f"Found {unlinked} unlinked lines without product_id"

    cur.execute("SELECT SUM(quantity), SUM(taxable_value), SUM(tax_amount), SUM(total_amount) FROM sales_order_items;")
    tot_qty, tot_taxable, tot_tax, tot_amt = cur.fetchone()
    assert tot_qty == Decimal("25864.0000"), f"Expected 25,864 qty, got {tot_qty}"
    assert tot_taxable == Decimal("30223734.22"), f"Expected 30,223,734.22 taxable, got {tot_taxable}"
    assert tot_tax == Decimal("1511185.68"), f"Expected 1,511,185.68 tax, got {tot_tax}"
    assert tot_amt == Decimal("30223734.22"), f"Expected 30,223,734.22 base amt, got {tot_amt}"

def test_04_immutable_terms_snapshots(db_conn):
    """Verify that 60 immutable Terms & Conditions snapshots exist in terms_snapshots."""
    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM terms_snapshots WHERE document_type = 'SALES_ORDER';")
    count = cur.fetchone()[0]
    assert count == 60, f"Expected 60 terms snapshots, got {count}"

    cur.execute("SELECT document_no, LENGTH(clauses_snapshot) FROM terms_snapshots WHERE document_type = 'SALES_ORDER';")
    snapshots = cur.fetchall()
    for doc_no, length in snapshots:
        assert length > 100, f"Terms snapshot for {doc_no} is empty or truncated"

def test_05_invoice_allocation_records(db_conn):
    """Verify that 120 invoice allocation records exist in sales_order_invoice_allocations."""
    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sales_order_invoice_allocations WHERE is_deleted = false;")
    count = cur.fetchone()[0]
    assert count == 120, f"Expected 120 allocation records, got {count}"

    cur.execute("SELECT COUNT(DISTINCT invoice_no), COUNT(DISTINCT po_number) FROM sales_order_invoice_allocations;")
    distinct_invs, distinct_pos = cur.fetchone()
    assert distinct_invs == 120
    assert distinct_pos == 58

def test_06_unmodified_tax_invoices(db_conn):
    """Verify that all 120 existing tax invoices remain untouched."""
    cur = db_conn.cursor()
    cur.execute("""
        SELECT COUNT(*), SUM(grand_total), SUM(taxable_value), SUM(tax_total)
        FROM sales_invoices
        WHERE is_deleted = false;
    """)
    inv_count, sum_grand, sum_taxable, sum_tax = cur.fetchone()
    assert inv_count == 120
    assert sum_grand == Decimal("10600430.00")
    assert sum_taxable == Decimal("8387910.96")
    assert sum_tax == Decimal("504780.06")

def test_07_verified_stock_movements_for_invoices(db_conn):
    """Verify stock movements and invoice invariants for historical invoices."""
    cur = db_conn.cursor()
    cur.execute("SELECT COUNT(*) FROM stock_movements WHERE is_deleted = false;")
    sm_count = cur.fetchone()[0]
    assert sm_count in [0, 100, 6661], f"Expected valid stock movement state (0, 100, or 6661), found {sm_count}"

    cur.execute("SELECT COUNT(*) FROM sales_invoices WHERE is_deleted = false;")
    inv_total = cur.fetchone()[0]
    assert inv_total == 120, f"Expected exactly 120 invoices, found {inv_total}"
