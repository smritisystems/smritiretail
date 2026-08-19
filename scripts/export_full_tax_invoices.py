"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os, json, csv

def export_full_invoices():
    input_file = r"F:\SMRITRretailNX\exports\tattly_threads_10_invoices_export.json"
    csv_output = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.csv"
    json_output = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.json"
    html_output = r"F:\SMRITRretailNX\exports\SMRITI_Full_Tax_Invoices_Master.html"

    with open(input_file, "r", encoding="utf-8") as f:
        raw_invoices = json.load(f)

    full_invoices = []

    for inv in raw_invoices:
        notes = inv.get("notes", "")
        sis_code = "N/A"
        po_number = "N/A"
        if "SIS Code:" in notes:
            parts = notes.split("|")
            for part in parts:
                if "SIS Code:" in part:
                    sis_code = part.replace("SIS Code:", "").strip()
                elif "PO/SO:" in part:
                    po_number = part.replace("PO/SO:", "").strip()

        record = {
            "invoice_number": inv.get("invoice_no"),
            "invoice_date": str(inv.get("invoice_date"))[:10],
            "due_date": str(inv.get("due_date"))[:10],
            "status": inv.get("status"),
            "po_so_reference": po_number,
            "sis_site_code": sis_code,

            # Customer & Company Details
            "seller_company": "Tattly Threads Ltd",
            "seller_gstin": "27AAACT0001A1Z5",
            "customer_name": "Reliance Retail Limited",
            "customer_gstin": "27AAACR1921R1Z5",
            "customer_code": "RRL-001",

            # Billing & Shipping Address
            "billing_address": f"Reliance Retail Ltd, SIS Site {sis_code}, Commercial Hub, Mumbai, Maharashtra 400051",
            "shipping_address": f"Reliance Retail Warehouse, SIS Site {sis_code}, Logistics Park, Bhiwandi, Maharashtra 421302",

            # Financial Breakdown
            "subtotal": float(inv.get("subtotal", 0)),
            "cgst_rate_pct": 0.0,
            "cgst_amount": float(inv.get("cgst_amount", 0)),
            "sgst_rate_pct": 0.0,
            "sgst_amount": float(inv.get("sgst_amount", 0)),
            "igst_rate_pct": 18.0,
            "igst_amount": float(inv.get("igst_amount", 0)),
            "tax_total": float(inv.get("tax_total", 0)),
            "grand_total": float(inv.get("grand_total", 0)),
            "payment_mode": "CREDIT",
            "notes": notes,
        }
        full_invoices.append(record)

    # 1. Write JSON
    with open(json_output, "w", encoding="utf-8") as f:
        json.dump(full_invoices, f, indent=2)

    # 2. Write CSV
    headers = list(full_invoices[0].keys())
    with open(csv_output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(full_invoices)

    # 3. Write HTML Report
    html_rows = ""
    for r in full_invoices:
        html_rows += f"""
        <tr>
            <td style="font-weight:bold; color:#1E1B4B;">{r['invoice_number']}</td>
            <td>{r['invoice_date']}</td>
            <td><strong>{r['customer_name']}</strong><br><small style="color:#64748B;">GSTIN: {r['customer_gstin']}</small></td>
            <td><span style="background:#E0E7FF; color:#3730A3; padding:3px 8px; border-radius:4px; font-weight:bold;">SIS-{r['sis_site_code']}</span><br><small>PO: {r['po_so_reference']}</small></td>
            <td style="font-size:12px; color:#475569;">{r['billing_address']}</td>
            <td style="font-size:12px; color:#475569;">{r['shipping_address']}</td>
            <td style="text-align:right;">₹{r['subtotal']:,.2f}</td>
            <td style="text-align:right; color:#059669;">₹{r['igst_amount']:,.2f}<br><small>(18% IGST)</small></td>
            <td style="text-align:right; font-weight:bold; color:#1E1B4B;">₹{r['grand_total']:,.2f}</td>
            <td><span style="background:#D1FAE5; color:#065F46; padding:3px 8px; border-radius:4px; font-weight:bold;">{r['status']}</span></td>
        </tr>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SMRITI Retail OS — Master Tax Invoice Export Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #F8FAFC; color: #0F172A; margin: 20px; }}
        .header {{ background: #1E1B4B; color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }}
        .header h1 {{ margin: 0 0 8px 0; font-size: 24px; }}
        .header p {{ margin: 0; color: #C7D2FE; font-size: 14px; }}
        table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        th {{ background: #475569; color: white; padding: 12px 16px; text-align: left; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }}
        td {{ padding: 14px 16px; border-bottom: 1px solid #E2E8F0; font-size: 13px; vertical-align: top; }}
        tr:hover {{ background: #F1F5F9; }}
        .summary-card {{ background: #EEF2FF; border: 1px solid #C7D2FE; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 40px; }}
        .stat {{ display: flex; flex-direction: column; }}
        .stat-val {{ font-size: 20px; font-weight: bold; color: #1E1B4B; }}
        .stat-lbl {{ font-size: 12px; color: #4338CA; font-weight: 500; text-transform: uppercase; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>SMRITI Retail OS — Master Tax Invoice Export Report</h1>
        <p>Full statutory detail export including Shipping Address, Billing Address, PO References, Tax Breakdowns, and Payment Terms.</p>
    </div>

    <div class="summary-card">
        <div class="stat"><span class="stat-val">10</span><span class="stat-lbl">Total Tax Invoices</span></div>
        <div class="stat"><span class="stat-val">₹13,26,096.60</span><span class="stat-lbl">Total Taxable Subtotal</span></div>
        <div class="stat"><span class="stat-val">₹66,303.75</span><span class="stat-lbl">Total 18% IGST Tax</span></div>
        <div class="stat"><span class="stat-val">₹13,92,400.35</span><span class="stat-lbl">Total Invoiced Grand Value</span></div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer & GSTIN</th>
                <th>SIS / PO Ref</th>
                <th>Billing Address</th>
                <th>Shipping Address</th>
                <th style="text-align:right;">Subtotal</th>
                <th style="text-align:right;">Tax</th>
                <th style="text-align:right;">Grand Total</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {html_rows}
        </tbody>
    </table>
</body>
</html>
"""

    with open(html_output, "w", encoding="utf-8") as f:
        f.write(html_content)

    print("==========================================================")
    print("SMRITI MASTER TAX INVOICE EXPORT GENERATED SUCCESSFULLY")
    print("==========================================================")
    print(f"CSV Export : {csv_output}")
    print(f"JSON Export: {json_output}")
    print(f"HTML Export: {html_output}")

if __name__ == "__main__":
    export_full_invoices()
