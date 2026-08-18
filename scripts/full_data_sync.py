"""
Complete Sync Script from smriti001 to smritisys with ARRAY and JSON adaptation.
"""
import psycopg2
import json
import uuid

def run_sync():
    conn_src = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    conn_dst = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    conn_dst.autocommit = True
    cur_src = conn_src.cursor()
    cur_dst = conn_dst.cursor()

    # 1. Ensure required companies and branches exist in smritisys
    cur_dst.execute("""
        INSERT INTO companies (id, uuid, name, is_active, is_deleted)
        VALUES 
            ('comp-default', %s, 'Default Company', true, false),
            ('comp-smriti-retail', %s, 'SMRITI Retail Ltd', true, false)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), str(uuid.uuid4())))

    cur_dst.execute("""
        INSERT INTO branches (id, uuid, company_id, name, code, is_active)
        VALUES 
            ('MAIN', %s, 'COMP-001', 'Main Corporate Branch', 'MAIN-LEGACY', true),
            ('BR-001', %s, 'COMP-001', 'Main Branch', 'BR-001-LEGACY', true),
            ('br-default', %s, 'comp-default', 'Default Branch', 'DEF', true)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())))
    print("Governance prerequisites verified.")

    # 2. Sync all tables in dependency order
    tables = [
        "customer_groups",
        "customers",
        "products",
        "sales_invoices",
        "sales_invoice_items",
        "tax_invoice_templates",
        "tax_invoice_template_versions",
        "invoice_document_artifacts",
    ]

    for t in tables:
        cur_src.execute(f"SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='{t}';")
        src_col_info = cur_src.fetchall()
        scols = [r[0] for r in src_col_info]
        array_cols = set(r[0] for r in src_col_info if r[2].startswith('_'))
        json_cols = set(r[0] for r in src_col_info if r[1] in ('json', 'jsonb'))

        cur_dst.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name='{t}';")
        dcols = set(r[0] for r in cur_dst.fetchall())

        common_cols = [c for c in scols if c in dcols]
        col_names_str = ", ".join(common_cols)
        placeholders = ", ".join(["%s"] * len(common_cols))

        cur_src.execute(f"SELECT {col_names_str} FROM {t};")
        rows = cur_src.fetchall()
        print(f"\nSyncing {t}: {len(rows)} source rows...")

        inserted = 0
        errors = 0
        for r in rows:
            adapted_row = []
            for col_name, col_val in zip(common_cols, r):
                if col_val is None:
                    adapted_row.append(None)
                elif col_name in json_cols and isinstance(col_val, (dict, list)):
                    adapted_row.append(json.dumps(col_val))
                elif col_name in array_cols:
                    if isinstance(col_val, list):
                        adapted_row.append(col_val)
                    elif isinstance(col_val, str) and col_val.startswith('[') and col_val.endswith(']'):
                        try:
                            adapted_row.append(json.loads(col_val))
                        except Exception:
                            adapted_row.append([])
                    else:
                        adapted_row.append(col_val)
                elif isinstance(col_val, (dict, list)):
                    adapted_row.append(json.dumps(col_val))
                else:
                    adapted_row.append(col_val)

            insert_stmt = f"INSERT INTO {t} ({col_names_str}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING;"
            try:
                cur_dst.execute(insert_stmt, adapted_row)
                inserted += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"  Error on row in {t}: {e}")

        print(f"  -> Inserted {inserted} / {len(rows)} (Errors: {errors})")

    # Verify counts
    print("\n=== FINAL VERIFICATION IN smritisys ===")
    for t in tables:
        cur_dst.execute(f"SELECT count(*) FROM {t};")
        print(f"  {t}: {cur_dst.fetchone()[0]} rows")

    conn_src.close()
    conn_dst.close()

if __name__ == "__main__":
    run_sync()
