"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.3
  Created      : 2026-09-11
  Classification: Canonical Dispatch Invoices Date Reconciliation Engine (Revert 20 Invoices to 02-09-2026)
"""

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path
from datetime import date

import psycopg2
from psycopg2.extras import RealDictCursor

# Setup Python paths and environment
root_dir = Path("f:/SMRITRretailNX").resolve()
backend_path = root_dir / "backend"
sys.path.insert(0, str(backend_path))

from dotenv import dotenv_values
env_file = root_dir / ".env"
if env_file.exists():
    for k, v in dotenv_values(env_file).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

from app.db.session import get_company_sessionmaker
from app.services.invoice_pdf_service import InvoicePdfService

TARGET_INVOICES = [
    'TT2026-2027/150',
    'TT2026-2027/167',
    'TT2026-2027/168',
    'TT2026-2027/169',
    'TT2026-2027/170',
    'TT2026-2027/171',
    'TT2026-2027/172',
    'TT2026-2027/174',
    'TT2026-2027/176',
    'TT2026-2027/179',
    'TT2026-2027/185',
    'TT2026-2027/186',
    'TT2026-2027/187',
    'TT2026-2027/188',
    'TT2026-2027/189',
    'TT2026-2027/190',
    'TT2026-2027/191',
    'TT2026-2027/192',
    'TT2026-2027/193',
    'TT2026-2027/194',
]

FINAL_1009_DIR = Path(r"F:\Smriti-Clients Data\10-09-2026\Final")
FINAL_0809_DIR = Path(r"F:\Smriti-Clients Data\08-09-2026\Final")
MIRROR_EWAY_DIR = Path(r"F:\Smriti-Clients Data\Eway\Final")
ROTATED_LOGO_DIR = Path(r"F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo")
TAX_INV_ARCHIVE_DIR = Path(r"F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194")

CANONICAL_DATE_DB = date(2026, 9, 2)
CANONICAL_DOC_DATE_EWAY = "02/09/2026"

async def run_reconciliation():
    print("=" * 80)
    print("SMRITI RETAIL OS: RECONCILING 20 DISPATCH INVOICES TO CANONICAL DATE 02-09-2026")
    print("=" * 80)

    # 1. Update Database smriti001
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        UPDATE sales_invoices
        SET date = %s,
            modified_at = NOW()
        WHERE invoice_no IN %s
        RETURNING id, invoice_no, delivery_store_code, customer_po_number_snapshot, date, grand_total;
    """, (CANONICAL_DATE_DB, tuple(TARGET_INVOICES)))
    updated_rows = cur.fetchall()
    conn.commit()
    cur.close()
    conn.close()

    print(f"[DB UPDATED] Reverted {len(updated_rows)} invoices to date {CANONICAL_DATE_DB}.")
    for r in sorted(updated_rows, key=lambda x: x['invoice_no']):
        print(f"  {r['invoice_no']} (Store: {r['delivery_store_code']}) -> Date: {r['date']} | Total: Rs. {r['grand_total']:,.2f}")

    # 2. Re-render Statutory PDF Invoices
    print("\n--- Re-rendering Statutory PDF Invoices with Date 02-09-2026 ---")
    pdf_dirs = [
        FINAL_1009_DIR / "Tax_Invoice_PDFs",
        FINAL_0809_DIR / "Tax_Invoice_PDFs",
        TAX_INV_ARCHIVE_DIR,
        ROTATED_LOGO_DIR / "All_57_Stores",
        ROTATED_LOGO_DIR / "12_Stores_Updated",
    ]
    for d in pdf_dirs:
        d.mkdir(parents=True, exist_ok=True)

    sm = get_company_sessionmaker("smriti001")
    async with sm() as session:
        for r in sorted(updated_rows, key=lambda x: x['invoice_no']):
            inv_id = r['id']
            inv_no = r['invoice_no']
            store_code = r['delivery_store_code'] or 'STORE'
            po_num = r['customer_po_number_snapshot'] or 'PO'
            inv_no_clean = inv_no.replace('/', '_')

            pdf_name_portal = f"{store_code}_{po_num}_{inv_no_clean}.pdf"
            pdf_name_generic = f"Tax_Invoice_{inv_no_clean}.pdf"

            primary_out = FINAL_1009_DIR / "Tax_Invoice_PDFs" / pdf_name_portal
            await InvoicePdfService.render_pdf_to_file(
                session=session,
                invoice_id=inv_id,
                output_pdf_path=str(primary_out),
                company_id="COMP-001"
            )
            print(f"  [RENDERED] {primary_out.name} ({primary_out.stat().st_size:,} bytes)")

            for d in pdf_dirs:
                p_portal = d / pdf_name_portal
                p_generic = d / pdf_name_generic
                if p_portal != primary_out and (d != ROTATED_LOGO_DIR / "12_Stores_Updated" or p_portal.exists()):
                    shutil.copyfile(primary_out, p_portal)
                if p_generic.exists() or d != ROTATED_LOGO_DIR / "12_Stores_Updated":
                    shutil.copyfile(primary_out, p_generic)

    # 3. Update E-Way Bill JSON Files
    print("\n--- Updating E-Way Bill JSON Payloads (docDate -> 02/09/2026) ---")
    eway_dirs = [
        FINAL_1009_DIR / "Eway_JSON",
        FINAL_0809_DIR / "Eway_JSON",
        MIRROR_EWAY_DIR / "Eway_JSON"
    ]

    target_inv_cleans = {inv.replace('/', '_') for inv in TARGET_INVOICES}

    for ed in eway_dirs:
        if ed.exists():
            for fpath in ed.glob("*_Eway.json"):
                inv_key = fpath.name.replace("_Eway.json", "")
                if inv_key in target_inv_cleans:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    for b in data.get("billLists", []):
                        b["docDate"] = CANONICAL_DOC_DATE_EWAY
                    with open(fpath, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    print(f"  [UPDATED] {fpath.name} in {ed.parent.name}\\{ed.name}")

    # Update Bulk Upload JSONs
    bulk_files = [
        FINAL_1009_DIR / "EWayBill_Bulk_Upload_15_Invoices_10092026.json",
        FINAL_1009_DIR / "EWayBill_Bulk_Upload_All_Updated_Invoices.json",
        FINAL_1009_DIR / "EWayBill_Bulk_Upload_13_Invoices_10092026.json",
        FINAL_1009_DIR / "EWayBill_Bulk_Upload_12_Invoices_10092026.json",
    ]
    for bf in bulk_files:
        if bf.exists():
            with open(bf, "r", encoding="utf-8") as f:
                bdata = json.load(f)
            count_up = 0
            for b in bdata.get("billLists", []):
                if b.get("docNo") in TARGET_INVOICES:
                    b["docDate"] = CANONICAL_DOC_DATE_EWAY
                    count_up += 1
            with open(bf, "w", encoding="utf-8") as f:
                json.dump(bdata, f, indent=2)
            print(f"  [BULK JSON UPDATED] {bf.name}: updated docDate for {count_up} invoices.")

    print("\n" + "=" * 80)
    print("DATE RECONCILIATION COMPLETE: ALL 20 INVOICES ARE NOW 02-09-2026")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_reconciliation())
