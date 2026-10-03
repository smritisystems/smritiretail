"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.25.1
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Dispatch Invoice Quantity Amendment Engine (TT2026-2027/242 Store TUK5)
"""

import asyncio
import json
import os
import re
import sys
from decimal import Decimal
from pathlib import Path
from datetime import date, datetime, timezone, timedelta

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
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

from app.services.invoice_pdf_service import InvoicePdfService, number_to_indian_words
from playwright.async_api import async_playwright

DISPATCH_FROM_SNAPSHOT = {
    "city": "Nagpur",
    "code": "WH-NGP",
    "name": "Tattly Threads (Nagpur Depot)",
    "gstin": "27AAXFT2508H1ZR",
    "phone": "9324117007",
    "state": "Maharashtra",
    "pincode": "440029",
    "district": "Nagpur",
    "state_code": "27",
    "location_id": "wh-ngp-001",
    "address_line1": "Om Sai Nagar, Kalamana",
    "address_line2": "",
    "location_name": "Tattly Threads Nagpur Depot",
    "contact_person": "Operations Manager",
}

class InvoiceItemMock:
    def __init__(self, line_no, code, name, qty, price, mrp, disc_pct, taxable_value, hsn_code, gst_rate, tax_amount, cgst_amount, sgst_amount, igst_amount, total_amount):
        self.line_no = line_no
        self.code = code
        self.name = name
        self.quantity = qty
        self.price = price
        self.mrp = mrp
        self.disc_pct = disc_pct
        self.taxable_value = taxable_value
        self.hsn_code = hsn_code
        self.gst_rate = gst_rate
        self.tax_amount = tax_amount
        self.cgst_amount = cgst_amount
        self.sgst_amount = sgst_amount
        self.igst_amount = igst_amount
        self.total_amount = total_amount


class InvoiceMock:
    def __init__(self, id, invoice_no, date, sis_code, pos_state, po_reference, eway_bill_no, customer_name, customer_gstin, site_name, billing_address, shipping_address, taxable_value, tax_total, grand_total, is_interstate, bank_name, account_no, ifsc_code, bank_branch, items, dispatch_from_snapshot=None):
        self.id = id
        self.invoice_no = invoice_no
        self.date = date
        self.sis_code = sis_code
        self.pos_state = pos_state
        self.po_reference = po_reference
        self.eway_bill_no = eway_bill_no
        self.customer_name = customer_name
        self.customer_gstin = customer_gstin
        self.site_name = site_name
        self.billing_address = billing_address
        self.shipping_address = shipping_address
        self.taxable_value = taxable_value
        self.tax_total = tax_total
        self.grand_total = grand_total
        self.is_interstate = is_interstate
        self.bank_name = bank_name
        self.account_no = account_no
        self.ifsc_code = ifsc_code
        self.bank_branch = bank_branch
        self.items = items
        self.dispatch_from_snapshot = dispatch_from_snapshot
        self.status = "COMPLETED"
        self.reverse_charge = False
        self.is_reverse_charge = False
        self.irn = None
        self.signed_qr_payload = None
        self.e_invoice_status = "NOT_APPLICABLE"


async def update_invoice_242():
    print("=" * 80)
    print("AMENDING TAX INVOICE TT2026-2027/242 (STORE TUK5): 72 PRS -> 56 PRS")
    print("=" * 80)

    # 1. Connect to PostgreSQL smriti001
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor(cursor_factory=RealDictCursor)

    inv_id = "inv-dispatch-16092026-tuk5"
    inv_no = "TT2026-2027/242"

    # Verify current DB state
    cur.execute("SELECT * FROM sales_invoices WHERE id = %s", (inv_id,))
    inv_row = cur.fetchone()
    if not inv_row:
        raise RuntimeError(f"Invoice {inv_id} not found in smriti001.sales_invoices!")

    print(f"Current DB Header: Invoice={inv_row['invoice_no']} | Grand Total={inv_row['grand_total']} | Taxable={inv_row['taxable_value']}")

    # Delete CH-16-D items (12 items)
    cur.execute("""
        DELETE FROM sales_invoice_items 
        WHERE invoice_id = %s AND (code LIKE %s OR name LIKE %s)
    """, (inv_id, 'CH-16-D%', 'CH-16-D%'))
    deleted_count = cur.rowcount
    print(f"Deleted {deleted_count} items of CH-16-D from sales_invoice_items.")


    # Re-sequence remaining line numbers
    cur.execute("""
        SELECT id FROM sales_invoice_items 
        WHERE invoice_id = %s 
        ORDER BY line_no, id
    """, (inv_id,))
    remaining_items = cur.fetchall()
    print(f"Remaining items count in DB: {len(remaining_items)}")

    for new_line, it in enumerate(remaining_items, 1):
        cur.execute("UPDATE sales_invoice_items SET line_no = %s WHERE id = %s", (new_line, it["id"]))

    # Update sales_invoices header
    new_taxable = Decimal("67906.56")
    new_igst = Decimal("3395.33")
    new_grand_total = Decimal("71302.00")
    new_round_adj = Decimal("0.25")
    new_disc = Decimal("52837.57")
    new_words = "Seventy One Thousand Three Hundred and Two Rupees only"

    cur.execute("""
        UPDATE sales_invoices 
        SET taxable_value = %s,
            tax_total = %s,
            grand_total = %s,
            rounding_amount = %s,
            discount_amount = %s,
            amount_in_words = %s,
            modified_at = NOW()
        WHERE id = %s
    """, (new_taxable, new_igst, new_grand_total, new_round_adj, new_disc, new_words, inv_id))

    # Update eway_bills
    cur.execute("SELECT id, nic_payload_snapshot FROM eway_bills WHERE invoice_id = %s", (inv_id,))
    ewb_row = cur.fetchone()
    if ewb_row:
        ewb_id = ewb_row["id"]
        nic_payload = ewb_row["nic_payload_snapshot"] or {}
        nic_payload["totalValue"] = float(new_taxable)
        nic_payload["igstValue"] = float(new_igst)
        nic_payload["OthValue"] = float(new_round_adj)
        nic_payload["totInvValue"] = float(new_grand_total)

        cur.execute("""
            UPDATE eway_bills 
            SET total_taxable_amount = %s,
                igst_amount = %s,
                other_amount = %s,
                consignment_value = %s,
                document_value = %s,
                nic_payload_snapshot = %s,
                modified_at = NOW()
            WHERE id = %s
        """, (new_taxable, new_igst, new_round_adj, new_grand_total, new_grand_total, json.dumps(nic_payload), ewb_id))
        print(f"Updated eway_bills record {ewb_id}.")

    conn.commit()
    print("PostgreSQL smriti001 committed successfully!")

    # Fetch remaining items for Playwright and JSON generation
    cur.execute("""
        SELECT * FROM sales_invoice_items 
        WHERE invoice_id = %s 
        ORDER BY line_no
    """, (inv_id,))
    db_items = cur.fetchall()
    conn.close()

    # 2. Update Excel Summaries: Tax_Invoice_Summary_16-09-2026.xlsx
    summary_path = r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\Tax_Invoice_Summary_16-09-2026.xlsx"
    if os.path.exists(summary_path):
        print(f"\n--- Updating Summary Excel: {summary_path} ---")
        wb_sum = openpyxl.load_workbook(summary_path)

        # Update Sheet 1: Invoice_Summary
        ws_sum = wb_sum["Invoice_Summary"]
        for r in range(2, ws_sum.max_row + 1):
            cell_inv = ws_sum.cell(r, 2).value
            if cell_inv == inv_no:
                ws_sum.cell(r, 10, 56)              # Pairs
                ws_sum.cell(r, 11, 120744.00)       # Gross MRP
                ws_sum.cell(r, 12, 67906.56)        # Taxable Value
                ws_sum.cell(r, 15, 3395.33)         # IGST
                ws_sum.cell(r, 16, 0.25)            # Round Adj
                ws_sum.cell(r, 17, 71302.00)        # Grand Total
                print(f"  Updated row {r} in Invoice_Summary for {inv_no}.")
                break

        # Recalculate TOTAL row in Invoice_Summary
        last_r = ws_sum.max_row
        if ws_sum.cell(last_r, 2).value == "TOTAL":
            tot_pairs = sum(ws_sum.cell(r, 10).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 10).value, (int, float)))
            tot_mrp = sum(ws_sum.cell(r, 11).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 11).value, (int, float)))
            tot_taxable = sum(ws_sum.cell(r, 12).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 12).value, (int, float)))
            tot_cgst = sum(ws_sum.cell(r, 13).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 13).value, (int, float)))
            tot_sgst = sum(ws_sum.cell(r, 14).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 14).value, (int, float)))
            tot_igst = sum(ws_sum.cell(r, 15).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 15).value, (int, float)))
            tot_grand = sum(ws_sum.cell(r, 17).value for r in range(2, last_r) if isinstance(ws_sum.cell(r, 17).value, (int, float)))

            ws_sum.cell(last_r, 10, tot_pairs)
            ws_sum.cell(last_r, 11, tot_mrp)
            ws_sum.cell(last_r, 12, tot_taxable)
            ws_sum.cell(last_r, 13, tot_cgst)
            ws_sum.cell(last_r, 14, tot_sgst)
            ws_sum.cell(last_r, 15, tot_igst)
            ws_sum.cell(last_r, 17, tot_grand)
            print(f"  Recalculated TOTAL row: Pairs={tot_pairs}, Net Invoiced=Rs. {tot_grand:,.2f}")

        # Update Sheet 2: All_Items_Consolidated
        ws_items = wb_sum["All_Items_Consolidated"]
        rows_to_delete = []
        for r in range(2, ws_items.max_row + 1):
            row_inv = ws_items.cell(r, 1).value
            row_art = str(ws_items.cell(r, 7).value or "") # Item Code
            if row_inv == inv_no and row_art.startswith("CH-16-D"):
                rows_to_delete.append(r)

        # Delete rows in reverse order
        for r in reversed(rows_to_delete):
            ws_items.delete_rows(r)
        print(f"  Deleted {len(rows_to_delete)} CH-16-D rows from All_Items_Consolidated.")

        # Re-number Line No for TT2026-2027/242 in All_Items_Consolidated
        cur_line = 1
        for r in range(2, ws_items.max_row + 1):
            if ws_items.cell(r, 1).value == inv_no:
                ws_items.cell(r, 6, cur_line)
                cur_line += 1

        wb_sum.save(summary_path)
        print(f"SUCCESS: Saved updated {summary_path}")

    # 3. Update Dispatch Excels: RIL_Dispatch1_16092026_All.xlsx, _Updated.xlsx, _Invoiced.xlsx
    dispatch_excels = [
        r"F:\Smriti-Clients Data\16-09-2026\Created\RIL_Dispatch1_16092026_All.xlsx",
        r"F:\Smriti-Clients Data\16-09-2026\Created\RIL_Dispatch1_16092026_All_Updated.xlsx",
        r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\RIL_Dispatch1_16092026_All_Invoiced.xlsx",
    ]
    for dpath in dispatch_excels:
        if os.path.exists(dpath):
            print(f"\n--- Updating Dispatch Excel: {dpath} ---")
            wb_d = openpyxl.load_workbook(dpath)
            ws_d = wb_d.active
            updated_any = False
            for r in range(2, ws_d.max_row + 1):
                st = str(ws_d.cell(r, 1).value or "").strip()
                art = str(ws_d.cell(r, 2).value or "").strip()
                if st == "TUK5" and art == "CH-16-D":
                    # Zero out sizes 36..42 and total
                    for c in range(5, 12): # 36 to 42
                        ws_d.cell(row=r, column=c).value = 0
                    ws_d.cell(row=r, column=c).value = 0 # TOTAL
                    # Clear invoice columns M, N, O, P
                    for c in range(13, 17):
                        cell_tgt = ws_d.cell(row=r, column=c)
                        cell_tgt.value = None
                        cell_tgt.fill = PatternFill(fill_type=None)
                    print(f"  Zeroed out row {r} (Store TUK5, CH-16-D) in {os.path.basename(dpath)}.")
                    updated_any = True
            if updated_any:
                wb_d.save(dpath)
                print(f"SUCCESS: Saved {dpath}")


    # 4. Update Statement Excels: Tax_Invoice_Statement_TT18_to_TT254.xlsx
    stmt_paths = [
        r"F:\Smriti-Clients Data\16-09-2026\Tax_Invoice_Statement_TT18_to_TT254.xlsx",
        r"F:\Smriti-Clients Data\Tax_Invoice_Statement_TT18_to_TT254.xlsx"
    ]
    for spath in stmt_paths:
        if os.path.exists(spath):
            print(f"\n--- Updating Statement Excel: {spath} ---")
            wb_st = openpyxl.load_workbook(spath)
            if "Tax_Invoices_Register" in wb_st.sheetnames:
                ws_st = wb_st["Tax_Invoices_Register"]
                for r in range(2, ws_st.max_row + 1):
                    if ws_st.cell(r, 2).value == inv_no:
                        ws_st.cell(r, 11, 56)          # Pairs (PRS)
                        ws_st.cell(r, 12, 67906.56)    # Taxable Value
                        ws_st.cell(r, 15, 3395.33)     # IGST
                        ws_st.cell(r, 16, 0.25)        # Round Adj
                        ws_st.cell(r, 17, 71302.00)    # Grand Total
                        print(f"  Updated row {r} for {inv_no} in Tax_Invoices_Register.")
                        break
                wb_st.save(spath)
                print(f"SUCCESS: Saved {spath}")

    # 5. Render Statutory A4 PDF via Playwright
    print("\n--- Rendering Updated PDF Invoice via Playwright ---")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        inv_items_mock = []
        for it in db_items:
            mrp = Decimal(str(it["mrp"] or "1899.00"))
            rate = Decimal(str(it["price"]))
            qty = Decimal(str(it["quantity"]))
            taxable = Decimal(str(it["taxable_value"]))
            igst = Decimal(str(it["igst_amount"]))
            cgst = Decimal(str(it["cgst_amount"]))
            sgst = Decimal(str(it["sgst_amount"]))
            tot = Decimal(str(it["total_amount"]))

            inv_items_mock.append(InvoiceItemMock(
                line_no=it["line_no"],
                code=it["code"],
                name=it["name"],
                qty=qty,
                price=rate,
                mrp=mrp,
                disc_pct=Decimal("43.76"),
                taxable_value=taxable,
                hsn_code=it["hsn_code"] or "64041990",
                gst_rate=Decimal("5.00"),
                tax_amount=igst + cgst + sgst,
                cgst_amount=cgst,
                sgst_amount=sgst,
                igst_amount=igst,
                total_amount=tot
            ))

        inv_mock = InvoiceMock(
            id=inv_id,
            invoice_no=inv_no,
            date=date(2026, 9, 5),
            sis_code="TUK5",
            pos_state="ANDHRA PRADESH",
            po_reference="5182778198",
            eway_bill_no="",
            customer_name="Reliance Retail Limited",
            customer_gstin="37AABCR1718E1ZO",
            site_name="RRL TF CMR MALL (TUK5)",
            billing_address="Reliance Retail Limited\nCMR Central Mall Maddilapalem Visakhapatnam 530013 VISAKHAPATNAM - ANDHRA PRADESH",
            shipping_address="Reliance Retail Limited (RRL TF CMR MALL)\nCMR Central Mall Maddilapalem Visakhapatnam 530013 VISAKHAPATNAM - ANDHRA PRADESH",
            taxable_value=new_taxable,
            tax_total=new_igst,
            grand_total=new_grand_total,
            is_interstate=True,
            bank_name="STATE BANK OF INDIA",
            account_no="43976711765",
            ifsc_code="SBIN0030425",
            bank_branch="WARDHMAN NAGAR NAGPUR",
            items=inv_items_mock,
            dispatch_from_snapshot=DISPATCH_FROM_SNAPSHOT
        )

        html_content = InvoicePdfService.generate_invoice_html_from_model(
            invoice=inv_mock,
            company_name="TATTLY THREADS",
            company_gstin="27AAXFT2508H1ZR",
            extra_meta={
                "company_website": "www.tattlythreads.com",
                "dispatch_email": "dispatch@tattlythreads.com",
                "accounts_email": "accounts@tattlythreads.com",
                "delivery_site_code": "TUK5",
                "po_date": "31.07.2026",
                "dispatch_from_snapshot": DISPATCH_FROM_SNAPSHOT
            }
        )

        await page.set_content(html_content, wait_until="networkidle")
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "8mm", "bottom": "10mm", "left": "8mm", "right": "8mm"}
        )

        bill_prefix = "242"
        po_ref = "5182778198"
        sis_code = "TUK5"
        clean_inv = inv_no.replace("/", "_")

        # Canonical standard: Bill number ALWAYS as prefix
        name_bill_pref_po = f"{bill_prefix}_{po_ref}_{clean_inv}_{sis_code}.pdf"
        name_bill_pref_store = f"{bill_prefix}_{sis_code}_{po_ref}_{clean_inv}.pdf"
        name_legacy = f"{sis_code}_{po_ref}_{clean_inv}.pdf"

        target_dirs = [
            r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\Tax_Invoice_PDFs",
            r"F:\Smriti-Clients Data\16-09-2026\Created\Invoices_Store_PO_Invoice",
            r"F:\Smriti-Clients Data\All_Exported_Invoices\18_09_2026\Tax_Invoice_PDFs",
            r"F:\Smriti-Clients Data\All_Exported_Invoices\18_09_2026\Invoices_Store_PO_Invoice",
            r"F:\Smriti-Clients Data\Export",
            r"F:\Smriti-Clients Data\Export_TT2026-2027_242_TUK5"
        ]

        for tdir in target_dirs:
            if os.path.exists(tdir):
                # Always save with Bill No as prefix
                p1 = os.path.join(tdir, name_bill_pref_po)
                with open(p1, "wb") as f:
                    f.write(pdf_bytes)
                print(f"SUCCESS: Saved Bill-No-Prefixed PDF ({len(pdf_bytes):,} bytes): {p1}")

                p2 = os.path.join(tdir, name_bill_pref_store)
                with open(p2, "wb") as f:
                    f.write(pdf_bytes)

                p3 = os.path.join(tdir, name_legacy)
                with open(p3, "wb") as f:
                    f.write(pdf_bytes)

        await browser.close()

    # 6. Regenerate NIC E-Way Bill JSON
    print("\n--- Regenerating NIC E-Way Bill JSON Payloads ---")
    item_list = []
    for it in db_items:
        item_list.append({
            "itemNo": it["line_no"],
            "productName": it["name"],
            "productDesc": f"Footwear {it['name']}"[:100],
            "hsnCode": int(it["hsn_code"] or 64041990),
            "quantity": float(it["quantity"]),
            "qtyUnit": "PRS",
            "taxableAmount": float(it["taxable_value"]),
            "sgstRate": 0.0,
            "cgstRate": 0.0,
            "igstRate": 5.0,
            "cessRate": 0.0
        })

    single_eway = {
        "version": "1.0.1118",
        "billLists": [{
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "Supply",
            "docType": "INV",
            "docNo": inv_no,
            "docDate": "05/09/2026",
            "transType": 4,
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromStateCode": 27,
            "fromAddr1": "Om Sai Nagar, Kalamana",
            "fromAddr2": "Tattly Threads Nagpur Depot",
            "fromPlace": "Nagpur",
            "fromPincode": 440029,
            "actualFromStateCode": 27,
            "actFromStateCode": 27,
            "toGstin": "37AABCR1718E1ZO",
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": "CMR Central Mall Maddilapalem Visakhapatnam",
            "toAddr2": "VISAKHAPATNAM - ANDHRA PRADESH",
            "toPlace": "Visakhapatnam",
            "toPincode": 530013,
            "toStateCode": 37,
            "actualToStateCode": 37,
            "actToStateCode": 37,
            "totalValue": float(new_taxable),
            "cgstValue": 0.0,
            "sgstValue": 0.0,
            "igstValue": float(new_igst),
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": float(new_round_adj),
            "totInvValue": float(new_grand_total),
            "transMode": 1,
            "transDistance": 800,
            "mainHsnCode": "64041990",
            "itemList": item_list
        }]
    }

    eway_json_targets = [
        r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\Eway_JSON\242_TT2026-2027_Eway.json",
        r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\Eway_JSON\TT2026-2027_242_Eway.json",
        r"F:\Smriti-Clients Data\Eway\Final_16092026\242_TT2026-2027_Eway.json",
        r"F:\Smriti-Clients Data\Eway\Final_16092026\TT2026-2027_242_Eway.json",
        r"F:\Smriti-Clients Data\Export_TT2026-2027_242_TUK5\242_TT2026-2027_Eway.json"
    ]
    for jtarget in eway_json_targets:
        if os.path.exists(os.path.dirname(jtarget)):
            with open(jtarget, "w", encoding="utf-8") as f:
                json.dump(single_eway, f, indent=2)
            print(f"SUCCESS: Saved NIC JSON: {jtarget}")

    # Update consolidated bulk upload JSONs
    bulk_targets = [
        r"F:\Smriti-Clients Data\16-09-2026\Created\Final_Invoices\EWayBill_Bulk_Upload_16092026.json",
        r"F:\Smriti-Clients Data\Eway\Final_16092026\EWayBill_Bulk_Upload_16092026.json"
    ]
    for btarget in bulk_targets:
        if os.path.exists(btarget):
            with open(btarget, "r", encoding="utf-8") as f:
                bulk_data = json.load(f)
            updated_b = False
            for bill in bulk_data.get("billLists", []):
                if bill.get("docNo") == inv_no:
                    bill["totalValue"] = float(new_taxable)
                    bill["igstValue"] = float(new_igst)
                    bill["OthValue"] = float(new_round_adj)
                    bill["totInvValue"] = float(new_grand_total)
                    bill["itemList"] = item_list
                    updated_b = True
                    break
            if updated_b:
                with open(btarget, "w", encoding="utf-8") as f:
                    json.dump(bulk_data, f, indent=2)
                print(f"SUCCESS: Updated bulk E-Way JSON: {btarget}")

    print("\n" + "=" * 80)
    print("ALL ARTIFACTS AND DATABASE SYNCHRONIZED FOR TT2026-2027/242 SUCCESSFULLY!")
    print(f"New Quantity      : 56 PRS")
    print(f"New Taxable Value : Rs. {new_taxable:,.2f}")
    print(f"New IGST (5%)     : Rs. {new_igst:,.2f}")
    print(f"New Net Invoiced  : Rs. {new_grand_total:,.2f}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(update_invoice_242())
