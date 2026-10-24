"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-09-10
  Classification: Batch Export Engine for Tax Invoices with Rotated Logo (Both Addresses Fit)
"""

import asyncio
import os
import shutil
import sys
import time
from pathlib import Path

root_dir = Path("f:/SMRITRretailNX").resolve()
backend_path = root_dir / "backend"
sys.path.insert(0, str(backend_path))

from dotenv import dotenv_values
env_file = root_dir / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

import psycopg2
from psycopg2.extras import RealDictCursor
from app.db.session import get_company_sessionmaker
from app.services.invoice_pdf_service import InvoicePdfService

TARGET_ROOT = Path(r"F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo")
DIR_ALL_57 = TARGET_ROOT / "All_57_Stores"
DIR_12_UPDATED = TARGET_ROOT / "12_Stores_Updated"

UPDATED_12_INVOICE_NOS = {
    'TT2026-2027/172', 'TT2026-2027/174', 'TT2026-2027/176', 'TT2026-2027/179',
    'TT2026-2027/185', 'TT2026-2027/186', 'TT2026-2027/187', 'TT2026-2027/188',
    'TT2026-2027/189', 'TT2026-2027/191', 'TT2026-2027/192', 'TT2026-2027/194'
}

async def export_all_invoices():
    start_time = time.time()
    DIR_ALL_57.mkdir(parents=True, exist_ok=True)
    DIR_12_UPDATED.mkdir(parents=True, exist_ok=True)

    # 1. Fetch all 57 invoices
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, invoice_no, delivery_store_code, customer_po_number_snapshot, grand_total, date
        FROM sales_invoices
        WHERE invoice_no ~ '^TT2026-2027/(13[8-9]|1[4-8][0-9]|19[0-4])$'
        ORDER BY invoice_no;
    """)
    invoices = cur.fetchall()
    cur.close()
    conn.close()

    print(f"Loaded {len(invoices)} invoices from smriti001 for export.")
    print(f"Target Directory: {TARGET_ROOT}")
    print(f"  -> {DIR_ALL_57} (All 57 Stores)")
    print(f"  -> {DIR_12_UPDATED} (12 Updated Stores)")
    print("-" * 100)

    sm = get_company_sessionmaker("smriti001")
    exported_count = 0
    exported_12_count = 0

    async with sm() as session:
        for idx, inv in enumerate(invoices, 1):
            inv_no = inv['invoice_no']
            inv_id = inv['id']
            store_code = inv['delivery_store_code'] or 'STORE'
            po_num = inv['customer_po_number_snapshot'] or 'PO'
            inv_no_clean = inv_no.replace('/', '_')

            # Client portal standard name and generic name
            pdf_name_portal = f"{store_code}_{po_num}_{inv_no_clean}.pdf"
            pdf_name_generic = f"Tax_Invoice_{inv_no_clean}.pdf"

            out_path_all = DIR_ALL_57 / pdf_name_portal
            out_path_generic = DIR_ALL_57 / pdf_name_generic

            # Render directly to out_path_all
            await InvoicePdfService.render_pdf_to_file(
                session=session,
                invoice_id=inv_id,
                output_pdf_path=str(out_path_all),
                company_id="COMP-001"
            )
            # Create generic alias copy
            shutil.copyfile(out_path_all, out_path_generic)
            exported_count += 1

            # If among the 12 updated invoices, also copy to 12_Stores_Updated folder
            if inv_no in UPDATED_12_INVOICE_NOS:
                shutil.copyfile(out_path_all, DIR_12_UPDATED / pdf_name_portal)
                shutil.copyfile(out_path_all, DIR_12_UPDATED / pdf_name_generic)
                exported_12_count += 1
                tag = "[UPDATED 12]"
            else:
                tag = "[STORE COMPLETED]"

            sz = out_path_all.stat().st_size
            print(f"[{idx:>2}/57] {tag:<18} {inv_no:<16} | Store: {store_code:<5} | Size: {sz:>8,} B | Saved: {pdf_name_portal}")

    elapsed = time.time() - start_time
    print("-" * 100)
    print(f"SUCCESS: Exported {exported_count} invoices to {DIR_ALL_57}")
    print(f"SUCCESS: Mirrored {exported_12_count} updated invoices to {DIR_12_UPDATED}")
    print(f"Total time elapsed: {elapsed:.2f} seconds.")
    print("-" * 100)

if __name__ == "__main__":
    asyncio.run(export_all_invoices())
