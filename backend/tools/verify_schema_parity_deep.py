"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import argparse
import os
import sys
import psycopg2
from urllib.parse import urlparse

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "dev-test-sgip-vault-master-key-32-chars")

from app.core.config import settings


def run_audit(target_db: str = "smriti001"):
    parsed = urlparse(settings.DATABASE_URL)
    user = os.getenv("POSTGRES_USER") or parsed.username or "postgres"
    password = os.getenv("POSTGRES_PASSWORD") or parsed.password or "postgres"
    host = os.getenv("POSTGRES_HOST") or parsed.hostname or "localhost"
    port = int(os.getenv("POSTGRES_PORT") or parsed.port or 5432)

    conn = psycopg2.connect(dbname=target_db, user=user, password=password, host=host, port=port)
    cur = conn.cursor()

    print(f"================================================================================")
    print(f"DEEP SCHEMA PARITY AUDIT: TARGET DATABASE '{target_db}'")
    print(f"================================================================================")

    # 1. Check Alembic revision
    cur.execute("SELECT version_num FROM alembic_version;")
    rev = cur.fetchone()[0]
    print(f"Alembic Current Revision: {rev}")
    print("--------------------------------------------------------------------------------")

    tables = ["customer_purchase_orders", "customer_purchase_order_lines", "customer_po_invoice_allocations"]

    for table in tables:
        print(f"\n[TABLE: {table}]")

        # Columns & Types & Nullability & Defaults
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (table,))
        cols = cur.fetchall()
        print(f"  Columns ({len(cols)}):")
        for col, dtype, nullable, default in cols:
            def_str = f" DEFAULT {default}" if default else ""
            null_str = "NULL" if nullable == "YES" else "NOT NULL"
            print(f"    - {col:<32} {dtype:<20} {null_str:<10} {def_str}")

        # Primary Key
        cur.execute("""
            SELECT c.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage c ON c.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY';
        """, (table,))
        pks = [row[0] for row in cur.fetchall()]
        print(f"  Primary Key: {pks}")

        # Unique Constraints
        cur.execute("""
            SELECT tc.constraint_name, string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = %s AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name;
        """, (table,))
        uqs = cur.fetchall()
        print(f"  Unique Constraints ({len(uqs)}):")
        for name, cols_str in uqs:
            print(f"    - {name}: ({cols_str})")

        # Foreign Keys
        cur.execute("""
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = %s AND tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.constraint_name;
        """, (table,))
        fks = cur.fetchall()
        print(f"  Foreign Keys ({len(fks)}):")
        for cname, col, ftbl, fcol, del_rule in fks:
            print(f"    - {cname}: {col} -> {ftbl}({fcol}) ON DELETE {del_rule}")

        # Check Constraints
        cur.execute("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE c.conrelid = %s::regclass AND c.contype = 'c';
        """, (table,))
        cks = cur.fetchall()
        print(f"  Check Constraints ({len(cks)}):")
        for cname, definition in cks:
            print(f"    - {cname}: {definition}")

        # Indexes
        cur.execute("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s
            ORDER BY indexname;
        """, (table,))
        idxs = cur.fetchall()
        print(f"  Indexes ({len(idxs)}):")
        for iname, idef in idxs:
            print(f"    - {iname}: {idef}")

        # Triggers
        cur.execute("""
            SELECT trigger_name, action_timing, event_manipulation, action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = 'public' AND event_object_table = %s;
        """, (table,))
        trigs = cur.fetchall()
        print(f"  Triggers ({len(trigs)}):")
        for tname, timing, event, stmt in trigs:
            print(f"    - {tname} ({timing} {event})")

    # PO columns on sales_invoices
    print(f"\n[SALES_INVOICES PO EXTENSION COLUMNS]")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales_invoices'
          AND column_name IN ('customer_po_id', 'customer_po_number_snapshot', 'customer_po_date_snapshot', 'source_document_type', 'source_document_id', 'source_document_line_id');
    """)
    for c in cur.fetchall():
        print(f"  - {c[0]:<30} {c[1]:<15} is_nullable={c[2]}")

    cur.execute("""
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name, rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'sales_invoices' AND kcu.column_name = 'customer_po_id';
    """)
    for r in cur.fetchall():
        print(f"  FK: {r[0]}: {r[1]} -> {r[2]}({r[3]}) ON DELETE {r[4]}")

    # PO columns on sales_invoice_items
    print(f"\n[SALES_INVOICE_ITEMS PO EXTENSION COLUMNS]")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sales_invoice_items'
          AND column_name IN ('customer_po_line_id', 'source_line_type', 'source_line_id');
    """)
    for c in cur.fetchall():
        print(f"  - {c[0]:<30} {c[1]:<15} is_nullable={c[2]}")

    cur.execute("""
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name, rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'sales_invoice_items' AND kcu.column_name = 'customer_po_line_id';
    """)
    for r in cur.fetchall():
        print(f"  FK: {r[0]}: {r[1]} -> {r[2]}({r[3]}) ON DELETE {r[4]}")

    conn.close()
    print("\n================================================================================")
    print("END AUDIT")
    print("================================================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="smriti001", help="Target database to audit")
    args = parser.parse_args()
    run_audit(args.db)
