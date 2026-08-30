import io
import psycopg2

BACKUP_FILE = r"F:\SMRITRretailNX\backups\pre_branch_key_reconcile_20260826.sql"
DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

print("Reading backup file...")
with open(BACKUP_FILE, "rb") as f:
    text = f.read().decode("utf-16", errors="ignore")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

tables = ["sales_orders", "sales_order_invoice_allocations", "sales_order_items", "terms_snapshots"]

# Clean tables in reverse dependency order
for tbl in ["sales_order_items", "sales_order_invoice_allocations", "terms_snapshots", "sales_orders"]:
    cur.execute(f"DELETE FROM {tbl};")
    print(f"Cleared {tbl}")

# Restore tables
for tbl in tables:
    header_str = f"COPY public.{tbl}"
    idx = text.find(header_str)
    if idx == -1:
        print(f"WARNING: {tbl} not found in dump")
        continue

    # Find the end of the COPY statement line
    eol = text.find("\n", idx)
    copy_cmd = text[idx:eol].strip()
    if not copy_cmd.endswith(";"):
        copy_cmd += ";"

    # Find the closing \.
    end_data = text.find("\n\\.", eol)
    raw_data = text[eol + 1:end_data]

    # Normalize newlines
    lines = raw_data.splitlines()
    data = "\n".join(lines) + "\n"

    # Execute COPY
    sio = io.StringIO(data)
    cur.copy_expert(f"{copy_cmd}", sio)
    print(f"Restored {tbl}: successfully copied data")

conn.commit()

# Verify row counts
for tbl in tables:
    cur.execute(f"SELECT COUNT(*) FROM {tbl};")
    print(f"Verification: {tbl} has {cur.fetchone()[0]} rows")

conn.close()
print("RESTORE COMPLETE")
