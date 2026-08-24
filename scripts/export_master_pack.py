"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.5
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import json
import csv
import zipfile
from pathlib import Path
from decimal import Decimal
import psycopg2

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPORTS_DIR = REPO_ROOT / "exports"
CANONICAL_PDF_DIR = EXPORTS_DIR / "canonical_tax_invoices"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

CSV_OUTPUT = EXPORTS_DIR / "SMRITI_All_Tax_Invoices_Master.csv"
JSON_OUTPUT = EXPORTS_DIR / "SMRITI_All_Tax_Invoices_Master.json"
HTML_OUTPUT = EXPORTS_DIR / "SMRITI_All_Tax_Invoices_Master.html"
ZIP_OUTPUT = EXPORTS_DIR / "SMRITI_Canonical_Tax_Invoices_90_PDF_Package.zip"

def export_comprehensive_pack():
    print("=== SMRITI RETAIL OS MASTER EXPORT SUITE ===")
    conn = psycopg2.connect(host="localhost", port=5432, user="postgres", password="postgres", dbname="smriti001")
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            si.id,
            si.invoice_no,
            si.date,
            si.status,
            si.sis_code,
            si.po_reference,
            si.customer_name,
            si.customer_gstin,
            si.billing_address,
            si.shipping_address,
            COALESCE(si.taxable_value, 0) as taxable_val,
            COALESCE(si.tax_total, 0) as tax_val,
            COALESCE(si.grand_total, 0) as grand_val,
            si.is_interstate,
            si.pos_state,
            si.eway_bill_no,
            COUNT(sii.id) as item_count,
            COALESCE(SUM(sii.quantity), 0) as total_qty
        FROM sales_invoices si
        LEFT JOIN sales_invoice_items sii ON si.id = sii.invoice_id
        WHERE si.is_deleted = FALSE
        GROUP BY si.id, si.invoice_no, si.date, si.status, si.sis_code, si.po_reference,
                 si.customer_name, si.customer_gstin, si.billing_address, si.shipping_address,
                 si.taxable_value, si.tax_total, si.grand_total, si.is_interstate, si.pos_state, si.eway_bill_no
        ORDER BY si.id;
    """)

    rows = cur.fetchall()
    print(f"Fetched {len(rows)} invoices from PostgreSQL (smriti001).")

    records = []
    total_subtotal = Decimal("0")
    total_tax = Decimal("0")
    total_grand = Decimal("0")
    total_units = 0

    for r in rows:
        subtot = Decimal(str(r[10] or 0))
        tax = Decimal(str(r[11] or 0))
        grand = Decimal(str(r[12] or (subtot + tax)))
        is_inter = bool(r[13])
        qty = int(r[17] or 0)

        total_subtotal += subtot
        total_tax += tax
        total_grand += grand
        total_units += qty

        inv_date = r[2].strftime("%Y-%m-%d") if r[2] else ""

        rec = {
            "invoice_number": r[1] or f"INV-{r[0]}",
            "invoice_date": inv_date,
            "status": r[3] or "Completed",
            "sis_site_code": r[4] or "DEFAULT",
            "po_so_reference": r[5] or "",
            "seller_company": "Tattly Threads",
            "seller_gstin": "27AAXFT2508H1ZR",
            "customer_name": r[6] or "Reliance Retail Limited",
            "customer_gstin": r[7] or "",
            "place_of_supply": r[14] or "",
            "eway_bill_no": r[15] or "",
            "is_interstate": is_inter,
            "item_lines": r[16],
            "total_quantity_pairs": qty,
            "billing_address": (r[8] or "").replace("\n", " ").strip(),
            "shipping_address": (r[9] or "").replace("\n", " ").strip(),
            "taxable_value": float(subtot),
            "cgst_amount": float(round(tax / 2, 2)) if not is_inter else 0.0,
            "sgst_amount": float(round(tax / 2, 2)) if not is_inter else 0.0,
            "igst_amount": float(tax) if is_inter else 0.0,
            "tax_total": float(tax),
            "grand_total": float(grand),
        }
        records.append(rec)

    conn.close()

    # 1. Export JSON
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    print(f"✓ JSON Master Export: {JSON_OUTPUT} ({len(records)} records)")

    # 2. Export CSV
    if records:
        with open(CSV_OUTPUT, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(records[0].keys()))
            writer.writeheader()
            writer.writerows(records)
        print(f"✓ CSV Master Export : {CSV_OUTPUT}")

    # 3. Export HTML Dashboard Report
    html_rows = ""
    for r in records:
        html_rows += f"""
        <tr>
            <td style="font-weight:700; color:#0f172a; font-family:monospace;">{r['invoice_number']}</td>
            <td>{r['invoice_date']}</td>
            <td><strong>{r['customer_name']}</strong><br><small style="color:#64748b; font-family:monospace;">GSTIN: {r['customer_gstin']}</small></td>
            <td><span style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-weight:700; font-family:monospace;">SIS-{r['sis_site_code']}</span><br><small style="color:#64748b;">PO: {r['po_so_reference']}</small></td>
            <td style="text-align:center;">{r['item_lines']}</td>
            <td style="text-align:center; font-weight:600;">{r['total_quantity_pairs']}</td>
            <td style="text-align:right; font-family:monospace;">₹{r['taxable_value']:,.2f}</td>
            <td style="text-align:right; color:#059669; font-family:monospace;">₹{r['tax_total']:,.2f}</td>
            <td style="text-align:right; font-weight:700; color:#0f172a; font-family:monospace;">₹{r['grand_total']:,.2f}</td>
            <td style="text-align:center;"><span style="background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">{r['status']}</span></td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SMRITI Retail OS — Master Tax Invoices Export Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 20px; }}
        .header {{ background: #0f172a; color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }}
        .header h1 {{ margin: 0 0 4px 0; font-size: 22px; letter-spacing: -0.5px; }}
        .header p {{ margin: 0; color: #94a3b8; font-size: 13px; }}
        table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); font-size: 12px; }}
        th {{ background: #334155; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }}
        td {{ padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }}
        tr:hover {{ background: #f1f5f9; }}
        .summary-card {{ background: white; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }}
        .stat {{ display: flex; flex-direction: column; }}
        .stat-val {{ font-size: 20px; font-weight: 800; color: #0f172a; font-family: monospace; }}
        .stat-lbl {{ font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 2px; }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>SMRITI Retail OS — Complete Master Tax Invoices</h1>
            <p>Statutory GST Tax Invoice Portfolio for Tattly Threads • Single Source of Truth</p>
        </div>
        <div style="text-align: right; font-family: monospace; font-size: 12px; color: #cbd5e1;">
            Generated: 2026-08-19<br/>GSTIN: 27AAXFT2508H1ZR
        </div>
    </div>

    <div class="summary-card">
        <div class="stat"><span class="stat-val">{len(records)}</span><span class="stat-lbl">Invoices</span></div>
        <div class="stat"><span class="stat-val">{total_units:,}</span><span class="stat-lbl">Total Pairs</span></div>
        <div class="stat"><span class="stat-val">₹{total_subtotal:,.2f}</span><span class="stat-lbl">Taxable Subtotal</span></div>
        <div class="stat"><span class="stat-val">₹{total_tax:,.2f}</span><span class="stat-lbl">Total GST Tax</span></div>
        <div class="stat"><span class="stat-val" style="color:#0284c7;">₹{total_grand:,.2f}</span><span class="stat-lbl">Grand Total</span></div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer & GSTIN</th>
                <th>SIS / PO Ref</th>
                <th style="text-align:center;">Items</th>
                <th style="text-align:center;">Pairs</th>
                <th style="text-align:right;">Subtotal</th>
                <th style="text-align:right;">Tax</th>
                <th style="text-align:right;">Grand Total</th>
                <th style="text-align:center;">Status</th>
            </tr>
        </thead>
        <tbody>
            {html_rows}
        </tbody>
    </table>
</body>
</html>
"""
    with open(HTML_OUTPUT, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"✓ HTML Master Report: {HTML_OUTPUT}")

    # 4. Export ZIP of all 90 PDFs
    pdf_files = list(CANONICAL_PDF_DIR.glob("*.pdf"))
    with zipfile.ZipFile(ZIP_OUTPUT, "w", zipfile.ZIP_DEFLATED) as zipf:
        for pdf_path in pdf_files:
            zipf.write(pdf_path, arcname=pdf_path.name)
    print(f"✓ ZIP Package Export: {ZIP_OUTPUT} ({len(pdf_files)} PDF files, {os.path.getsize(ZIP_OUTPUT):,} bytes)")

    print("\n==========================================================")
    print("ALL SMRITI TAX INVOICE MASTER ARTIFACTS EXPORTED SUCCESSFULLY")
    print("==========================================================")

if __name__ == "__main__":
    export_comprehensive_pack()
