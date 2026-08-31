"""
Sync schema columns and business data (invoices, products, customers) from smriti001 to smritisys.
"""
import psycopg2

def sync():
    conn_src = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    conn_dst = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    conn_dst.autocommit = True
    cur_src = conn_src.cursor()
    cur_dst = conn_dst.cursor()

    # 1. Sync missing columns from smriti001 to smritisys for all tables
    cur_src.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
    tables = [r[0] for r in cur_src.fetchall()]

    for t in tables:
        cur_src.execute(f"SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name='{t}';")
        src_cols = {r[0]: r for r in cur_src.fetchall()}

        cur_dst.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{t}';")
        dst_cols = set(r[0] for r in cur_dst.fetchall())

        if not dst_cols:
            continue

        for col_name, col_info in src_cols.items():
            if col_name not in dst_cols:
                dtype = col_info[1]
                if dtype == "character varying":
                    if col_info[2]:
                        type_str = f"VARCHAR({col_info[2]})"
                    else:
                        type_str = "VARCHAR"
                elif dtype == "timestamp with time zone":
                    type_str = "TIMESTAMPTZ"
                else:
                    type_str = dtype.upper()

                alter_stmt = f"ALTER TABLE {t} ADD COLUMN IF NOT EXISTS {col_name} {type_str};"
                try:
                    cur_dst.execute(alter_stmt)
                    print(f"Added missing column: {t}.{col_name} ({type_str})")
                except Exception as e:
                    print(f"Error adding {t}.{col_name}: {e}")

    # 2. Sync business tables data: products, customers, customer_groups, sales_invoices, sales_invoice_items
    tables_to_sync = [
        "customer_groups",
        "customers",
        "products",
        "sales_invoices",
        "sales_invoice_items",
        "tax_invoice_templates",
        "tax_invoice_template_versions",
        "invoice_document_artifacts",
    ]

    for t in tables_to_sync:
        try:
            # Check source count
            cur_src.execute(f"SELECT count(*) FROM {t};")
            src_count = cur_src.fetchone()[0]

            cur_dst.execute(f"SELECT count(*) FROM {t};")
            dst_count = cur_dst.fetchone()[0]

            print(f"\n--- Syncing Table: {t} (Source: {src_count} rows, Target: {dst_count} rows) ---")
            if src_count == 0:
                continue

            # Fetch columns existing in both
            cur_src.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{t}';")
            scols = set(r[0] for r in cur_src.fetchall())
            cur_dst.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{t}';")
            dcols = set(r[0] for r in cur_dst.fetchall())
            common_cols = [c for c in scols if c in dcols]

            col_names_str = ", ".join(common_cols)
            placeholders = ", ".join(["%s"] * len(common_cols))

            # Read source rows
            cur_src.execute(f"SELECT {col_names_str} FROM {t};")
            rows = cur_src.fetchall()

            # Insert on conflict do nothing
            inserted = 0
            for r in rows:
                insert_stmt = f"INSERT INTO {t} ({col_names_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"
                try:
                    cur_dst.execute(insert_stmt, r)
                    inserted += 1
                except Exception as e:
                    pass

            print(f"  Processed {inserted} rows for table {t}.")
        except Exception as e:
            print(f"  Error syncing {t}: {e}")

    # Verify final count in smritisys
    print("\n=== FINAL VERIFICATION IN smritisys ===")
    for t in ["products", "sales_invoices", "sales_invoice_items", "customers"]:
        cur_dst.execute(f"SELECT count(*) FROM {t};")
        c = cur_dst.fetchone()[0]
        print(f"  -> {t}: {c} rows")

    conn_src.close()
    conn_dst.close()

if __name__ == "__main__":
    sync()
