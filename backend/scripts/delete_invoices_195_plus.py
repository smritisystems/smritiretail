"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-09-09
  Classification: Canonical Invoice Deletion Script (>= 195)
"""

import os
import shutil
import psycopg2
from psycopg2.extras import RealDictCursor
import openpyxl

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor(cursor_factory=RealDictCursor)

print("=" * 70)
print("DELETING INVOICES >= 195 (TT2026-2027/195 TO TT2026-2027/202)")
print("=" * 70)

# 1. Fetch targeted invoices
cur.execute("""
    SELECT id, invoice_no, delivery_store_code, grand_total, import_batch_id
    FROM sales_invoices
    WHERE invoice_no LIKE 'TT2026-2027/%'
      AND substring(invoice_no from '([0-9]+)$')::int >= 195
    ORDER BY substring(invoice_no from '([0-9]+)$')::int ASC
""")
targets = cur.fetchall()

print(f"Targeted invoices to delete: {len(targets)}")
target_ids = [t['id'] for t in targets]
target_inv_nos = [t['invoice_no'] for t in targets]

for t in targets:
    print(f"  - {t['invoice_no']} (ID: {t['id']}) | Store: {t['delivery_store_code']} | Total: Rs. {t['grand_total']:,.2f}")

if not targets:
    print("No invoices >= 195 found. Nothing to delete in DB.")
else:
    # 2. Delete items first (FK constraint)
    cur.execute("DELETE FROM sales_invoice_items WHERE invoice_id = ANY(%s)", (target_ids,))
    items_deleted = cur.rowcount
    print(f"\nDeleted {items_deleted} rows from sales_invoice_items.")

    # 3. Delete invoices header
    cur.execute("DELETE FROM sales_invoices WHERE id = ANY(%s)", (target_ids,))
    headers_deleted = cur.rowcount
    print(f"Deleted {headers_deleted} rows from sales_invoices.")

    conn.commit()
    print("Database transaction successfully committed.")

cur.close()
conn.close()

# 4. Clean up exported folders
paths_to_clean = [
    r"F:\Smriti-Clients Data\08-09-2026\Final_RIL3",
    r"F:\Smriti-Clients Data\Eway\Final_RIL3"
]

for p in paths_to_clean:
    if os.path.exists(p):
        shutil.rmtree(p)
        print(f"Removed export directory: {p}")

# 5. Reset Column O in RIL_Dispatch3_Updated.xlsx if exists
updated_excel = r"F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch3_Updated.xlsx"
if os.path.exists(updated_excel):
    try:
        wb = openpyxl.load_workbook(updated_excel)
        ws = wb["08-09-2026"]
        cleared_cells = 0
        for row in range(2, ws.max_row + 1):
            cell = ws.cell(row=row, column=15)
            if cell.value and "TT2026-2027" in str(cell.value):
                num_str = str(cell.value).split("/")[-1].split("_")[-1]
                if num_str.isdigit() and int(num_str) >= 195:
                    cell.value = None
                    cleared_cells += 1
        wb.save(updated_excel)
        print(f"Cleared {cleared_cells} cells in Column O of RIL_Dispatch3_Updated.xlsx")
    except Exception as e:
        print(f"Note on Excel reset: {e}")

print("\n" + "=" * 70)
print("SUCCESS: All bills from 195 have been completely deleted!")
print("=" * 70)
