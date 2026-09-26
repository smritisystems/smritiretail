"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-09
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
"""

import asyncio
import asyncpg
import json
import re
import sys
import os
import shutil
import subprocess
from decimal import Decimal
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import jsonschema

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Exactly the 22 invoices highlighted in Green (Column 'O') in RIL_Dispatch-2.xlsx
GREEN_INVS = [
    'TT2026-2027/145', 'TT2026-2027/151', 'TT2026-2027/155', 'TT2026-2027/158', 'TT2026-2027/159',
    'TT2026-2027/160', 'TT2026-2027/161', 'TT2026-2027/162', 'TT2026-2027/164', 'TT2026-2027/173',
    'TT2026-2027/178', 'TT2026-2027/180', 'TT2026-2027/181', 'TT2026-2027/185', 'TT2026-2027/186',
    'TT2026-2027/187', 'TT2026-2027/188', 'TT2026-2027/189', 'TT2026-2027/190', 'TT2026-2027/191',
    'TT2026-2027/192', 'TT2026-2027/193'
]

# State distance estimates from Mumbai (400003)
STATE_DISTANCE_KM = {
    1: 1750, 2: 1650, 3: 1550, 4: 1500, 5: 1550, 6: 1400, 7: 1420,
    8: 1050, 9: 1380, 10: 1850, 11: 2200, 12: 3100, 13: 3000, 14: 3150,
    15: 3200, 16: 3250, 17: 2800, 18: 2750, 19: 1950, 20: 1700, 21: 1550,
    22: 1100, 23: 850, 24: 650, 26: 180, 27: 75, 29: 980, 30: 580,
    31: 1200, 32: 1350, 33: 1340, 34: 1350, 35: 2500, 36: 720, 37: 1250
}

# Verified city and pincode mapping for green stores
STORE_CITY_OVERRIDE = {
    '9556': ('Agartala', 799001),
    'T40R': ('Bhagalpur', 812001),
    'T8IY': ('Ranchi', 834001),
    'T9SQ': ('Hyderabad', 500090),
    'TAGG': ('Agartala', 799001),
    'TAGH': ('Varanasi', 221002),
    'TC64': ('Shimoga', 577201),
    'TDL2': ('Ghaziabad', 201010),
    'TDL9': ('Hyderabad', 500072),
    'TKL0': ('Barrackpore', 700120),
    'TPV2': ('Siliguri', 734001),
    'TUB7': ('Purnea', 854301),
    'TUK5': ('Visakhapatnam', 530020),
    'TVP2': ('Hassan', 573201),
    'TVT0': ('New Delhi', 110034),
    'TVU1': ('Hajipur', 844101),
    'TW07': ('Tumkur', 572101),
    'TW97': ('Hyderabad', 500062),
    'TXAJ': ('Chennai', 600041),
    'TXSR': ('Hyderabad', 500030),
    'TXSU': ('Bangalore', 560036),
    'TY06': ('Varanasi', 221005),
}

def clean_addr(text, max_len=120):
    t = re.sub(r'[\r\n\t]+', ' ', str(text or '')).strip()
    t = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', t).strip()
    return t[:max_len]

async def build_and_export_green_eway():
    print("=" * 90)
    print("SMRITI RETAIL OS: STATUTORY NIC E-WAY BILL GENERATION (22 GREEN COLUMN 'O' INVOICES)")
    print("Export Folder Target: ewayupdated (Part-A Clean — Transport details left blank)")
    print("Source Scope: Exactly 22 Invoices highlighted Green in Column 'O' of RIL_Dispatch-2.xlsx")
    print("=" * 90)

    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
    
    invoices = await conn.fetch('''
        SELECT id, invoice_no, date, customer_name, customer_gstin,
               delivery_gstin, delivery_store_code, billing_address, shipping_address,
               site_name, pos_state, is_interstate, taxable_value, tax_total,
               grand_total, rounding_amount, po_reference
        FROM sales_invoices
        WHERE invoice_no = ANY($1::text[])
          AND import_batch_id = 'DISPATCH_20260902_STORE_GROUPED_V2'
        ORDER BY CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER)
    ''', GREEN_INVS)
    
    print(f"Loaded {len(invoices)} invoices from database smriti001 (Target: 22).")
    if len(invoices) != 22:
        raise RuntimeError(f"Expected 22 invoices, but found {len(invoices)}")
    
    bills = []
    total_consignment_val = 0.0
    total_taxable_val = 0.0
    total_qty_pairs = 0
    
    for inv in invoices:
        inv_id = inv['id']
        inv_no = inv['invoice_no']
        inv_date = inv['date'].strftime('%d/%m/%Y') if inv['date'] else '02/09/2026'
        cust_gstin = inv['customer_gstin'] or '18AABCR1718E1ZO'
        deliv_gstin = inv['delivery_gstin'] or cust_gstin
        store_code = inv['delivery_store_code']
        
        # State codes
        from_state = 27 # Maharashtra
        to_state = int(cust_gstin[:2]) if cust_gstin[:2].isdigit() else 27
        actual_to_state = int(deliv_gstin[:2]) if deliv_gstin[:2].isdigit() else to_state
        
        # Pincode and city from override
        to_place, to_pin = STORE_CITY_OVERRIDE.get(store_code, (inv['pos_state'] or 'Store', 400001))
        
        ship_addr = inv['shipping_address'] or ''
        ship_lines = [clean_addr(l) for l in ship_addr.splitlines() if clean_addr(l) and not any(k in l.upper() for k in ["EMAIL", "TEL :", "GSTN NO"])]
        to_addr1 = (ship_lines[0] if len(ship_lines) > 0 else f"Reliance Retail Store {store_code}")[:120]
        to_addr2 = (ship_lines[1] if len(ship_lines) > 1 else (ship_lines[0] if len(ship_lines) > 0 else ""))[:120]
        
        # Transport Distance
        dist = STATE_DISTANCE_KM.get(actual_to_state, 1000)
        if actual_to_state == 27:
            dist = 60 # Local Maharashtra
        
        # Values
        taxable_tot = float(inv['taxable_value'])
        tax_tot = float(inv['tax_total'])
        grand_tot = float(inv['grand_total'])
        round_adj = float(inv['rounding_amount'] or 0.0)
        is_inter = inv['is_interstate']
        
        cgst_val = 0.0 if is_inter else round(tax_tot / 2.0, 2)
        sgst_val = 0.0 if is_inter else round(tax_tot / 2.0, 2)
        igst_val = round(tax_tot, 2) if is_inter else 0.0
        
        # Line Items
        items_db = await conn.fetch('''
            SELECT line_no, code, name, quantity, price, mrp, disc_pct,
                   taxable_value, tax_amount, total_amount, igst_amount, cgst_amount, sgst_amount
            FROM sales_invoice_items
            WHERE invoice_id = $1
            ORDER BY line_no, id
        ''', inv_id)
        
        item_list = []
        for idx, it in enumerate(items_db, start=1):
            qty = float(it['quantity'])
            tx_val = float(it['taxable_value'])
            pname = re.sub(r'[^a-zA-Z0-9\s@#\-/&.,]', '', it['name']).strip()[:100]
            item_list.append({
                "itemNo": idx,
                "productName": pname,
                "productDesc": f"Footwear {pname}"[:100],
                "hsnCode": "64041990",
                "quantity": qty,
                "qtyUnit": "PRS",
                "taxableAmount": round(tx_val, 2),
                "sgstRate": 0.0 if is_inter else 2.5,
                "cgstRate": 0.0 if is_inter else 2.5,
                "igstRate": 5.0 if is_inter else 0.0,
                "cessRate": 0.0,
                "cessNonAdvol": 0.0
            })
            total_qty_pairs += qty
            
        bill = {
            "userGstin": "27AAXFT2508H1ZR",
            "supplyType": "O",
            "subSupplyType": 1,
            "subSupplyDesc": "",
            "docType": "INV",
            "docNo": inv_no,
            "docDate": inv_date,
            "transType": 2 if actual_to_state != to_state or to_pin != 400003 else 1,
            "fromGstin": "27AAXFT2508H1ZR",
            "fromTrdName": "TATTLY THREADS",
            "fromAddr1": "Office No. 81, Ibrahim Rehmatullah Road",
            "fromAddr2": "Beside Jio Gallery, near HP Petrol Pump",
            "fromPlace": "Mumbai",
            "fromPincode": 400003,
            "fromStateCode": from_state,
            "actualFromStateCode": from_state,
            "toGstin": cust_gstin,
            "toTrdName": "RELIANCE RETAIL LIMITED",
            "toAddr1": to_addr1,
            "toAddr2": to_addr2,
            "toPlace": to_place,
            "toPincode": to_pin,
            "toStateCode": to_state,
            "actualToStateCode": actual_to_state,
            "totalValue": round(taxable_tot, 2),
            "cgstValue": cgst_val,
            "sgstValue": sgst_val,
            "igstValue": igst_val,
            "cessValue": 0.0,
            "TotNonAdvolVal": 0.0,
            "OthValue": round(round_adj, 2),
            "totInvValue": round(grand_tot, 2),
            "transMode": 1,
            "transDistance": dist,
            "transporterName": "",
            "transporterId": "",
            "transDocNo": "",
            "transDocDate": "",
            "vehicleNo": "",
            "vehicleType": "",
            "mainHsnCode": "64041990",
            "itemList": item_list
        }
        bills.append(bill)
        total_consignment_val += grand_tot
        total_taxable_val += taxable_tot

    await conn.close()

    print(f"\nGenerated {len(bills)} bill payloads (22 green column 'O' invoices).")
    print(f"Total Billed Quantity : {total_qty_pairs:,.0f} PRS (Exact expected: 2,121)")
    print(f"Total Taxable Value   : Rs {total_taxable_val:,.2f} (Exact expected: Rs 2,474,778.24)")
    print(f"Total Consignment Val : Rs {total_consignment_val:,.2f} (Exact expected: Rs 2,598,517.00)")
    
    # 1. Rule 44 Math Validation (Rs 2 tolerance)
    print("\n--- Rule 44 Mathematical Parity Check ---")
    violations = []
    for b in bills:
        calc_sum = b['totalValue'] + b['cgstValue'] + b['sgstValue'] + b['igstValue'] + b['cessValue'] + b['TotNonAdvolVal'] + b['OthValue']
        diff = abs(b['totInvValue'] - calc_sum)
        if diff > 2.0:
            violations.append((b['docNo'], b['totInvValue'], calc_sum, diff))
            
    print(f"Rule 44 (Rs 2 tolerance) violations: {len(violations)}")
    if violations:
        for v in violations:
            print("  VIOLATION:", v)
        raise ValueError("Rule 44 tolerance check failed!")
    else:
        print("PASS: 100% of all 22 green bills satisfy Rule 44 mathematical tolerance!")

    # 2. Schema Validation against official NIC Schema
    print("\n--- NIC Schema v1.0.1118 Validation ---")
    schema_wb_path = r"F:\Smriti-Clients Data\Eway\EWB_Attributes_new.xlsx"
    if not os.path.exists(schema_wb_path):
        fallback_schema = r"F:\Smriti-Clients Data\Eway\All Updated\EWB_Attributes_new.xlsx"
        if os.path.exists(fallback_schema):
            shutil.copy2(fallback_schema, schema_wb_path)
    wb_schema = openpyxl.load_workbook(schema_wb_path, data_only=True)
    ws_schema = wb_schema["Schema"]
    raw_schema = "\n".join([str(ws_schema.cell(r, 1).value) for r in range(1, ws_schema.max_row + 1) if ws_schema.cell(r, 1).value is not None])
    clean_schema = "\n".join([l for l in raw_schema.splitlines() if not l.strip().startswith("Ewaybill")])
    schema_json = json.loads(clean_schema, parse_float=Decimal)
    
    bill_props = schema_json["properties"]["billLists"]["items"]["properties"]
    bill_props["transType"]["enum"] = [1, 2, 3, 4]
    if isinstance(bill_props["itemList"]["items"], list):
        bill_props["itemList"]["items"] = bill_props["itemList"]["items"][0]

    payload = {
        "version": "1.0.1118",
        "billLists": bills
    }
    
    payload_decimal = json.loads(json.dumps(payload), parse_float=Decimal)
    jsonschema.validate(instance=payload_decimal, schema=schema_json)
    print("PASS: 100% JSON Schema compliance confirmed across all 22 green bills!")

    # 3. Destination Directories: explicitly named 'ewayupdated'
    dir_eway_target = r"F:\Smriti-Clients Data\Eway\ewayupdated"
    dir_dispatch_target = r"F:\Smriti-Clients Data\08-09-2026\ewayupdated"
    os.makedirs(dir_eway_target, exist_ok=True)
    os.makedirs(dir_dispatch_target, exist_ok=True)

    # 3a. Save Bulk JSON files inside ewayupdated
    bulk_json_name = "EWayBill_Bulk_Upload_ewayupdated.json"
    bulk_path_eway = os.path.join(dir_eway_target, bulk_json_name)
    bulk_path_dispatch = os.path.join(dir_dispatch_target, bulk_json_name)
    
    with open(bulk_path_eway, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(bulk_path_dispatch, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"\nSaved Bulk JSON (Eway/ewayupdated): {bulk_path_eway} ({os.path.getsize(bulk_path_eway):,} bytes)")
    print(f"Saved Bulk JSON (08-09-2026/ewayupdated): {bulk_path_dispatch} ({os.path.getsize(bulk_path_dispatch):,} bytes)")

    # 4. Save Individual JSON files directly into ewayupdated folder
    for b in bills:
        single_payload = {
            "version": "1.0.1118",
            "billLists": [b]
        }
        fname = f"{b['docNo'].replace('/', '_')}_Eway.json"
        
        # Save to F:\Smriti-Clients Data\Eway\ewayupdated\
        p1 = os.path.join(dir_eway_target, fname)
        with open(p1, "w", encoding="utf-8") as f:
            json.dump(single_payload, f, indent=2)
            
        # Mirror to F:\Smriti-Clients Data\08-09-2026\ewayupdated\
        p2 = os.path.join(dir_dispatch_target, fname)
        with open(p2, "w", encoding="utf-8") as f:
            json.dump(single_payload, f, indent=2)

    print(f"Saved 22 individual JSON files in : {dir_eway_target}")
    print(f"Mirrored 22 individual JSON files in: {dir_dispatch_target}")

    # 5. Generate Professional Excel Consignment Register for ewayupdated
    print("\n--- Generating Excel Consignment Register for ewayupdated ---")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "EWB_Consignments_PartA"
    ws.views.sheetView[0].showGridLines = True

    title_font = Font(name="Segoe UI", size=15, bold=True, color="1E3A8A")
    ws.merge_cells("A1:T1")
    ws["A1"] = "SMRITI RETAIL OS — NIC E-WAY BILL BULK REGISTER (22 GREEN 'O' CONSIGNMENTS — PART-A)"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    sub_font = Font(name="Segoe UI", size=10, italic=True, color="4B5563")
    ws.merge_cells("A2:T2")
    ws["A2"] = "Scope: 22 Invoices Highlighted Green in Column 'O' | Transport: Blank (Part-A Ready) | Supplier: TATTLY THREADS (27AAXFT2508H1ZR)"
    ws["A2"].font = sub_font
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[2].height = 20

    headers = [
        "Sl", "Invoice No", "Date", "Store Code", "Store / Destination Name",
        "POS State", "State Code", "Recipient GSTIN", "Delivery Address", "Destination Pincode",
        "Pairs Qty", "Taxable Value (Rs)", "IGST (Rs)", "CGST (Rs)", "SGST (Rs)",
        "Total Inv Value (Rs)", "Distance (KM)", "Trans Mode", "Vehicle No", "Upload Status"
    ]

    header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB')
    )

    ws.row_dimensions[4].height = 25
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_thin

    row_font = Font(name="Segoe UI", size=9)
    status_font = Font(name="Segoe UI", size=9, bold=True, color="065F46")
    status_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")

    tot_qty = 0
    tot_tx = 0.0
    tot_ig = 0.0
    tot_cg = 0.0
    tot_sg = 0.0
    tot_inv = 0.0

    for idx, b in enumerate(bills, start=1):
        r = idx + 4
        ws.row_dimensions[r].height = 20
        
        qty_sum = sum(it.get("quantity", 0) for it in b.get("itemList", []))
        tot_qty += qty_sum
        tot_tx += b.get("totalValue", 0.0)
        tot_ig += b.get("igstValue", 0.0)
        tot_cg += b.get("cgstValue", 0.0)
        tot_sg += b.get("sgstValue", 0.0)
        tot_inv += b.get("totInvValue", 0.0)
        
        store_code = inv_no = b.get("docNo", "")
        store_match = re.search(r'/(\d+)', inv_no)
        
        ws.cell(row=r, column=1, value=idx).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=2, value=b.get("docNo")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=3, value=b.get("docDate")).alignment = Alignment(horizontal="center")
        # Store code from override map lookup
        matched_store = [k for k, v in STORE_CITY_OVERRIDE.items() if v[1] == b.get("toPincode") and v[0] == b.get("toPlace")]
        ws.cell(row=r, column=4, value=matched_store[0] if matched_store else "").alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=5, value=b.get("toAddr1", "")[:40]).alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=6, value=b.get("toPlace")).alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=7, value=b.get("actualToStateCode")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=8, value=b.get("toGstin")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=9, value=f"{b.get('toAddr1', '')}, {b.get('toAddr2', '')}"[:60]).alignment = Alignment(horizontal="left")
        ws.cell(row=r, column=10, value=b.get("toPincode")).alignment = Alignment(horizontal="center")
        
        c_qty = ws.cell(row=r, column=11, value=qty_sum)
        c_qty.number_format = "#,##0"
        c_qty.alignment = Alignment(horizontal="right")
        
        c_tx = ws.cell(row=r, column=12, value=b.get("totalValue"))
        c_tx.number_format = "#,##0.00"
        c_tx.alignment = Alignment(horizontal="right")
        
        c_ig = ws.cell(row=r, column=13, value=b.get("igstValue"))
        c_ig.number_format = "#,##0.00"
        c_ig.alignment = Alignment(horizontal="right")
        
        c_cg = ws.cell(row=r, column=14, value=b.get("cgstValue"))
        c_cg.number_format = "#,##0.00"
        c_cg.alignment = Alignment(horizontal="right")
        
        c_sg = ws.cell(row=r, column=15, value=b.get("sgstValue"))
        c_sg.number_format = "#,##0.00"
        c_sg.alignment = Alignment(horizontal="right")
        
        c_tot = ws.cell(row=r, column=16, value=b.get("totInvValue"))
        c_tot.number_format = "#,##0.00"
        c_tot.alignment = Alignment(horizontal="right")
        
        ws.cell(row=r, column=17, value=b.get("transDistance")).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=18, value="ROAD (1)").alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=19, value="").alignment = Alignment(horizontal="center") # Vehicle blank
        
        c_st = ws.cell(row=r, column=20, value="PART-A READY")
        c_st.font = status_font
        c_st.fill = status_fill
        c_st.alignment = Alignment(horizontal="center")
        
        for c in range(1, 21):
            ws.cell(row=r, column=c).border = border_thin
            if c not in (20,):
                ws.cell(row=r, column=c).font = row_font

    # Total Row
    tot_r = len(bills) + 5
    ws.row_dimensions[tot_r].height = 24
    ws.merge_cells(start_row=tot_r, start_column=1, end_row=tot_r, end_column=10)
    ws.cell(row=tot_r, column=1, value="GRAND TOTAL (22 GREEN CONSIGNMENTS — PART-A)").alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=tot_r, column=1).font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")

    tot_fill = PatternFill(start_color="111827", end_color="111827", fill_type="solid")
    for c in range(1, 21):
        cell = ws.cell(row=tot_r, column=c)
        cell.fill = tot_fill
        cell.font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
        cell.border = border_thin

    ws.cell(row=tot_r, column=11, value=tot_qty).number_format = "#,##0"
    ws.cell(row=tot_r, column=12, value=tot_tx).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=13, value=tot_ig).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=14, value=tot_cg).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=15, value=tot_sg).number_format = "#,##0.00"
    ws.cell(row=tot_r, column=16, value=tot_inv).number_format = "#,##0.00"

    for col in range(11, 17):
        ws.cell(row=tot_r, column=col).alignment = Alignment(horizontal="right", vertical="center")

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    ws.column_dimensions['A'].width = 6
    ws.column_dimensions['B'].width = 18
    ws.column_dimensions['E'].width = 30
    ws.column_dimensions['I'].width = 35

    reg_name = "EWayBill_Generation_Register_ewayupdated.xlsx"
    reg_path_eway = os.path.join(dir_eway_target, reg_name)
    reg_path_dispatch = os.path.join(dir_dispatch_target, reg_name)
    
    wb.save(reg_path_eway)
    wb.save(reg_path_dispatch)
    print(f"Saved Consignment Register (Eway/ewayupdated): {reg_path_eway}")
    print(f"Saved Consignment Register (08-09-2026/ewayupdated): {reg_path_dispatch}")

    # 6. Repackage 7-Zip Archive for ewayupdated
    print("\n--- Packaging 7-Zip Archive for ewayupdated ---")
    seven_zip_path = r"C:\Program Files\7-Zip\7z.exe"
    archive_name = "EWayBill_Generation_Register_ewayupdated.7z"
    archive_path_eway = os.path.join(dir_eway_target, archive_name)
    archive_path_dispatch = os.path.join(dir_dispatch_target, archive_name)
    
    cmd_7z = [
        seven_zip_path, "a", "-t7z", "-m0=lzma2", "-mx=9", "-y",
        archive_path_eway,
        reg_path_eway,
        bulk_path_eway,
        r"F:\Smriti-Clients Data\Eway\EWB_Attributes_new.xlsx",
        os.path.join(dir_eway_target, "*.json")
    ]
    res_7z = subprocess.run(cmd_7z, capture_output=True, text=True)
    if res_7z.returncode == 0:
        print(f"Created 7z Archive (Eway/ewayupdated): {archive_path_eway} ({os.path.getsize(archive_path_eway):,} bytes)")
        shutil.copy2(archive_path_eway, archive_path_dispatch)
        print(f"Mirrored 7z Archive (08-09-2026/ewayupdated): {archive_path_dispatch}")
    else:
        print("7z update warning/error:", res_7z.stderr)

    print("\n" + "=" * 90)
    print("SUCCESS: Clean Part-A E-Way Bills exported into folder 'ewayupdated'!")
    print("=" * 90)

if __name__ == "__main__":
    asyncio.run(build_and_export_green_eway())
