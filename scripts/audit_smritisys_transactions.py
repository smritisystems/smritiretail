"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
- Pushpa Devi Jawahar Mallah (Founder & Chairperson)
- Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.92.3
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import psycopg2

sys.stdout.reconfigure(encoding="utf-8")

def audit_smritisys_direct():
    print("=" * 80)
    print("AUDIT: Verifying Inventory & Accounting Transaction Presence in 'smritisys'")
    print("PostgreSQL Instance: localhost:2781")
    print("=" * 80)

    conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smritisys")
    cur_sys = conn_sys.cursor()

    # 1. Audit core inventory transactional tables in smritisys
    inv_transaction_tables = [
        "products",
        "items",
        "item_variants",
        "item_barcodes",
        "stock_movements",
        "product_batch_stocks",
        "stock_transfers",
        "stock_transfer_items",
        "stock_audits",
        "stock_audit_items",
        "stock_takes",
        "stock_count_lines",
        "purchase_receipts",
        "purchase_receipt_items",
        "purchase_bills",
        "purchase_bill_items",
        "purchase_orders",
        "purchase_order_items",
        "warehouse_locations"
    ]

    print("\n1. INVENTORY TRANSACTIONAL TABLES IN 'smritisys':")
    inv_total_rows = 0
    for tbl in inv_transaction_tables:
        try:
            cur_sys.execute(f"SELECT count(*) FROM {tbl};")
            cnt = cur_sys.fetchone()[0]
            inv_total_rows += cnt
            status = f"{cnt} rows" if cnt > 0 else "0 rows (Clean)"
            print(f"   - {tbl:32} : {status}")
        except psycopg2.Error as e:
            conn_sys.rollback()
            print(f"   - {tbl:32} : Table does not exist in smritisys ({e.pgcode})")

    print(f"\n   >>> TOTAL INVENTORY TRANSACTION ROWS IN smritisys: {inv_total_rows} <<<")

    # 2. Audit core accounting transactional tables in smritisys
    acct_transaction_tables = [
        "sales_invoices",
        "sales_invoice_items",
        "sales_invoice_lines",
        "sales_orders",
        "sales_order_items",
        "sales_returns",
        "sales_return_items",
        "general_ledger_entries",
        "journal_vouchers",
        "accounts",
        "payment_transactions",
        "payment_allocations",
        "commission_ledgers",
        "supplier_payments",
        "customer_credit_ledger_entries",
        "account_balance_snapshots",
        "fiscal_periods",
        "eway_bills",
        "e_invoices"
    ]

    print("\n2. ACCOUNTING & SALES TRANSACTIONAL TABLES IN 'smritisys':")
    acct_total_rows = 0
    for tbl in acct_transaction_tables:
        try:
            cur_sys.execute(f"SELECT count(*) FROM {tbl};")
            cnt = cur_sys.fetchone()[0]
            acct_total_rows += cnt
            status = f"{cnt} rows" if cnt > 0 else "0 rows (Clean)"
            print(f"   - {tbl:32} : {status}")
        except psycopg2.Error as e:
            conn_sys.rollback()
            print(f"   - {tbl:32} : Table does not exist in smritisys ({e.pgcode})")

    print(f"\n   >>> TOTAL ACCOUNTING TRANSACTION ROWS IN smritisys: {acct_total_rows} <<<")

    # 3. What tables in smritisys ACTUALLY have rows > 0?
    print("\n3. CONTROL PLANE TABLES IN 'smritisys' WITH ROWS > 0 (Configuration / Masters):")
    cur_sys.execute("""
        SELECT relname, n_live_tup
        FROM pg_stat_user_tables
        WHERE n_live_tup > 0
        ORDER BY n_live_tup DESC;
    """)
    rows = cur_sys.fetchall()
    for tname, cnt in rows:
        print(f"   - {tname:32} : {cnt} rows")

    # 4. Compare with tenant database 'smriti001'
    print("\n4. COMPARISON: WHERE TRANSACTIONS ACTUALLY LIVE ('smriti001'):")
    conn_tenant = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smriti001")
    cur_tenant = conn_tenant.cursor()

    tenant_queries = [
        ("Products (Catalog)", "SELECT count(*) FROM products;"),
        ("Sales Invoices", "SELECT count(*) FROM sales_invoices;"),
        ("Sales Invoice Items", "SELECT count(*) FROM sales_invoice_items;"),
        ("Purchase Orders", "SELECT count(*) FROM purchase_orders;"),
        ("Purchase Receipts (GRN)", "SELECT count(*) FROM purchase_receipts;"),
        ("Stock Movements", "SELECT count(*) FROM stock_movements;"),
        ("General Ledger Entries", "SELECT count(*) FROM general_ledger_entries;"),
        ("Accounts (Chart of Accounts)", "SELECT count(*) FROM accounts;")
    ]

    for label, q in tenant_queries:
        try:
            cur_tenant.execute(q)
            cnt = cur_tenant.fetchone()[0]
            print(f"   - {label:32} in smriti001 : {cnt} rows")
        except Exception as e:
            conn_tenant.rollback()
            print(f"   - {label:32} in smriti001 : Error ({e})")

    conn_sys.close()
    conn_tenant.close()

if __name__ == "__main__":
    audit_smritisys_direct()
