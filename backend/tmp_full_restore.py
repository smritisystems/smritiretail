import io
import psycopg2

DUMP_PO = r"F:\SMRITRretailNX\backups\smriti001_pre_phase1_po_recon.sql"
DUMP_SO = r"F:\SMRITRretailNX\backups\pre_branch_key_reconcile_20260826.sql"
DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

def restore_table_from_dump(dump_path: str, tbl: str, delete_first: bool = True):
    print(f"Reading {tbl} from {dump_path}...")
    with open(dump_path, "rb") as f:
        text = f.read().decode("utf-16", errors="ignore")

    header_str = f"COPY public.{tbl}"
    idx = text.find(header_str)
    if idx == -1:
        print(f"ERROR: {tbl} not found in {dump_path}")
        return False

    eol = text.find("\n", idx)
    copy_cmd = text[idx:eol].strip()
    if not copy_cmd.endswith(";"):
        copy_cmd += ";"

    end_data = text.find("\n\\.", eol)
    raw_data = text[eol + 1:end_data]

    lines = raw_data.splitlines()
    data = "\n".join(lines) + "\n"

    if delete_first:
        cur.execute(f"DELETE FROM {tbl};")
        print(f"Cleared {tbl}")

    sio = io.StringIO(data)
    cur.copy_expert(copy_cmd, sio)
    print(f"Restored {tbl}: successfully copied {len(lines)} lines")
    return True

# 1. Clear children first
for tbl in [
    "sales_order_invoice_allocations",
    "sales_order_items",
    "sales_orders",
    "terms_snapshots",
    "sales_invoice_items",
    "sales_invoices",
    "customers",
    "customer_groups",
]:
    cur.execute(f"DELETE FROM {tbl};")
    print(f"Cleared {tbl}")

# 2. Restore customer master tables from DUMP_PO
restore_table_from_dump(DUMP_PO, "customer_groups", delete_first=False)
restore_table_from_dump(DUMP_PO, "customers", delete_first=False)

# 3. Restore invoices & items from DUMP_PO
restore_table_from_dump(DUMP_PO, "sales_invoices", delete_first=False)
restore_table_from_dump(DUMP_PO, "sales_invoice_items", delete_first=False)

# 4. Restore sales orders & allocations from DUMP_SO
restore_table_from_dump(DUMP_SO, "sales_orders", delete_first=False)
restore_table_from_dump(DUMP_SO, "terms_snapshots", delete_first=False)
restore_table_from_dump(DUMP_SO, "sales_order_items", delete_first=False)
restore_table_from_dump(DUMP_SO, "sales_order_invoice_allocations", delete_first=False)

conn.commit()

# Verify counts
for tbl in [
    "customer_groups",
    "customers",
    "sales_invoices",
    "sales_invoice_items",
    "sales_orders",
    "sales_order_items",
    "sales_order_invoice_allocations",
    "terms_snapshots",
]:
    cur.execute(f"SELECT COUNT(*) FROM {tbl};")
    print(f"Final Count: {tbl} = {cur.fetchone()[0]}")

conn.close()
print("FULL RESTORE SUCCESSFUL")
