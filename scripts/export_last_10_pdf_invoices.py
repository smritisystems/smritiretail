"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.7.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


import asyncio
import datetime
from decimal import Decimal
import psycopg2

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Playwright is required for PDF generation.")
    sys.exit(1)

EXPORT_DIR = r"F:\SMRITRretailNX\exports\last_10_pdf_invoices"
os.makedirs(EXPORT_DIR, exist_ok=True)

def number_to_indian_words(num: float) -> str:
    if num == 0:
        return "Zero"

    single_digits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    double_digits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens_multiple = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def get_word_for_three_digits(n: int) -> str:
        word = ""
        if n >= 100:
            word += single_digits[n // 100] + " Hundred "
            n %= 100
        if 10 <= n < 20:
            word += double_digits[n - 10] + " "
        elif n >= 20:
            word += tens_multiple[n // 10] + " " + single_digits[n % 10] + " "
        elif n > 0:
            word += single_digits[n] + " "
        return word

    str_words = ""
    integer_part = int(num)
    paisa_part = round((num - integer_part) * 100)

    if integer_part >= 10000000:
        str_words += get_word_for_three_digits(integer_part // 10000000) + "Crore "
        integer_part %= 10000000
    if integer_part >= 100000:
        str_words += get_word_for_three_digits(integer_part // 100000) + "Lakh "
        integer_part %= 100000
    if integer_part >= 1000:
        str_words += get_word_for_three_digits(integer_part // 1000) + "Thousand "
        integer_part %= 1000
    if integer_part > 0:
        str_words += get_word_for_three_digits(integer_part)

    result = "Rupees " + str_words.strip()
    if paisa_part > 0:
        result += " and " + get_word_for_three_digits(paisa_part).strip() + " Paisa"
    result += " Only"
    return result

def get_last_10_invoices():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            i.id,
            i.invoice_no,
            COALESCE(i.invoice_date, i.created_at) as invoice_date,
            i.due_date,
            i.place_of_supply,
            i.eway_bill_no,
            i.customer_id,
            i.subtotal,
            i.igst_total,
            i.cgst_total,
            i.sgst_total,
            i.grand_total,
            i.is_interstate,
            c.name as customer_name,
            c.gst_number as customer_gstin,
            c.mobile as customer_phone,
            c.email as customer_email
        FROM sales_invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.is_deleted = False OR i.is_deleted IS NULL
        ORDER BY i.created_at DESC
        LIMIT 10;
    """)
    rows = cur.fetchall()

    invoices = []
    for r in rows:
        inv_id = r[0]
        cur.execute("""
            SELECT 
                name,
                hsn_code,
                quantity,
                price,
                gst_rate,
                tax_amount,
                total_amount
            FROM sales_invoice_items
            WHERE invoice_id = %s
            ORDER BY id ASC;
        """, (inv_id,))
        item_rows = cur.fetchall()

        items = []
        for it in item_rows:
            qty = float(it[2] or 1.0)
            rate = float(it[3] or 0.0)
            taxable = qty * rate
            gst_pct = float(it[4] or 5.0)
            tax_amt = float(it[5] or (taxable * gst_pct / 100.0))
            tot_amt = float(it[6] or (taxable + tax_amt))
            items.append({
                "name": it[0] or "Product Item",
                "hsn": it[1] or "64041990",
                "qty": qty,
                "rate": rate,
                "taxable_amount": taxable,
                "gst_pct": gst_pct,
                "tax_amount": tax_amt,
                "total_amount": tot_amt,
            })

        subtotal = float(r[7] or sum(i["taxable_amount"] for i in items))
        igst_total = float(r[8] or sum(i["tax_amount"] for i in items))
        grand_total = float(r[11] or (subtotal + igst_total))
        rounded_grand = round(grand_total)
        round_adj = round(rounded_grand - grand_total, 2)

        inv_date_str = r[2].strftime("%Y-%m-%d") if r[2] else datetime.date.today().strftime("%Y-%m-%d")

        invoices.append({
            "id": r[0],
            "invoice_no": r[1] or f"INV-{r[0]}",
            "invoice_date": inv_date_str,
            "place_of_supply": r[4] or "Maharashtra (27)",
            "eway_bill_no": r[5] or "N/A",
            "customer_name": r[13] or "Reliance Retail Limited (SIS V051)",
            "customer_gstin": r[14] or "27AABCR9981F1Z8",
            "customer_phone": r[15] or "+91 9820098200",
            "customer_email": r[16] or "billing@tattlythreads.com",
            "is_interstate": r[12] if r[12] is not None else True,
            "items": items,
            "subtotal": subtotal,
            "igst_total": igst_total,
            "grand_total": grand_total,
            "rounded_grand": rounded_grand,
            "round_adj": round_adj,
            "amount_words": number_to_indian_words(rounded_grand),
        })

    conn.close()
    return invoices

def generate_statutory_a4_html(inv: dict) -> str:
    item_rows_html = ""
    for idx, item in enumerate(inv["items"], start=1):
        item_rows_html += f"""
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
            <td style="padding: 6px 8px; text-align: center;">{idx}</td>
            <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">{item['name']}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace;">{item['hsn']}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace;">{item['qty']:.0f}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace;">₹{item['rate']:,.2f}</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace;">₹{item['taxable_amount']:,.2f}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace;">{item['gst_pct']:.0f}%</td>
            <td style="padding: 6px 8px; text-align: right; font-family: monospace;">₹{item['tax_amount']:,.2f}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-family: monospace;">₹{item['total_amount']:,.2f}</td>
        </tr>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <style>
            @page {{
                size: A4 portrait;
                margin: 12mm 10mm 15mm 10mm;
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #0f172a;
                margin: 0;
                padding: 0;
                background: #ffffff;
                box-sizing: border-box;
            }}
            .header-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
                border-bottom: 2px solid #0284c7;
                padding-bottom: 8px;
            }}
            .company-title {{
                font-size: 20px;
                font-weight: 800;
                color: #0284c7;
                letter-spacing: -0.5px;
            }}
            .invoice-title-badge {{
                display: inline-block;
                background: #0284c7;
                color: #ffffff;
                font-size: 13px;
                font-weight: 700;
                padding: 4px 12px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            .info-grid {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
                border: 1px solid #cbd5e1;
                font-size: 11px;
            }}
            .info-grid td {{
                padding: 6px 10px;
                vertical-align: top;
                border: 1px solid #cbd5e1;
            }}
            .items-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 12px;
                border: 1px solid #94a3b8;
            }}
            .items-table th {{
                background-color: #f1f5f9;
                color: #1e293b;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                padding: 6px 8px;
                border: 1px solid #94a3b8;
            }}
            .totals-table {{
                width: 40%;
                margin-left: auto;
                border-collapse: collapse;
                font-size: 11px;
                margin-bottom: 12px;
            }}
            .totals-table td {{
                padding: 4px 8px;
            }}
            .grand-total-row {{
                background-color: #0284c7;
                color: #ffffff;
                font-weight: 800;
                font-size: 13px;
            }}
            .notice-box {{
                border-top: 1px solid #cbd5e1;
                padding-top: 8px;
                margin-top: 16px;
                text-align: center;
                font-size: 9px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="vertical-align: top; width: 60%;">
                    <div class="company-title">TATTLY THREADS</div>
                    <div style="font-size: 11px; color: #334155; margin-top: 2px;">
                        Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, Mumbai - 400003<br/>
                        <strong>GSTIN:</strong> 27AABCU9603R1ZM | <strong>State Code:</strong> 27 (Maharashtra)<br/>
                        <strong>Email:</strong> accounts@tattlythreads.com | <strong>Phone:</strong> +91 98200 98200
                    </div>
                </td>
                <td style="vertical-align: top; text-align: right; width: 40%;">
                    <div class="invoice-title-badge">Tax Invoice</div>
                    <div style="font-size: 12px; font-weight: 700; font-family: monospace; color: #0f172a; margin-top: 6px;">
                        {inv['invoice_no']}
                    </div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                        Date: {inv['invoice_date']}<br/>
                        Place of Supply: {inv['place_of_supply']}
                    </div>
                </td>
            </tr>
        </table>

        <table class="info-grid">
            <tr>
                <td style="width: 50%; background-color: #f8fafc;">
                    <strong style="color: #0284c7; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px;">Billed & Shipped To:</strong>
                    <div style="font-weight: 700; font-size: 12px; color: #0f172a;">{inv['customer_name']}</div>
                    <div style="color: #334155;">
                        Reliance Retail Limited, SIS Department Store<br/>
                        <strong>GSTIN:</strong> {inv['customer_gstin']} | <strong>POS Code:</strong> 27<br/>
                        <strong>Contact:</strong> {inv['customer_phone']} | {inv['customer_email']}
                    </div>
                </td>
                <td style="width: 50%; background-color: #f8fafc;">
                    <strong style="color: #0284c7; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px;">Transport & Statutory Details:</strong>
                    <div><strong>E-Way Bill No:</strong> <span style="font-family: monospace;">{inv['eway_bill_no']}</span></div>
                    <div><strong>Reverse Charge:</strong> No</div>
                    <div><strong>Payment Mode:</strong> NEFT / Bank Transfer</div>
                    <div><strong>Bank:</strong> HDFC Bank Ltd (A/C: 50200012345678, IFSC: HDFC0000001)</div>
                </td>
            </tr>
        </table>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 35%; text-align: left;">Product Description</th>
                    <th style="width: 10%;">HSN/SAC</th>
                    <th style="width: 8%; text-align: right;">Qty</th>
                    <th style="width: 12%; text-align: right;">Rate (₹)</th>
                    <th style="width: 12%; text-align: right;">Taxable Val (₹)</th>
                    <th style="width: 6%;">GST %</th>
                    <th style="width: 10%; text-align: right;">IGST (₹)</th>
                    <th style="width: 12%; text-align: right;">Total (₹)</th>
                </tr>
            </thead>
            <tbody>
                {item_rows_html}
            </tbody>
        </table>

        <table class="totals-table">
            <tr>
                <td style="text-align: right; color: #475569;">Taxable Amount Subtotal:</td>
                <td style="text-align: right; font-family: monospace; font-weight: 600;">₹{inv['subtotal']:,.2f}</td>
            </tr>
            <tr>
                <td style="text-align: right; color: #475569;">Integrated Tax (IGST @ 5%):</td>
                <td style="text-align: right; font-family: monospace; font-weight: 600;">₹{inv['igst_total']:,.2f}</td>
            </tr>
            <tr>
                <td style="text-align: right; color: #475569;">Rounding Adjustment:</td>
                <td style="text-align: right; font-family: monospace;">₹{inv['round_adj']:+.2f}</td>
            </tr>
            <tr class="grand-total-row">
                <td style="text-align: right; padding: 6px 8px;">Grand Total:</td>
                <td style="text-align: right; padding: 6px 8px; font-family: monospace;">₹{inv['rounded_grand']:,.2f}</td>
            </tr>
        </table>

        <div style="background-color: #f1f5f9; padding: 8px 12px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 11px; margin-bottom: 12px;">
            <strong>Amount in Words:</strong> <span style="font-style: italic; color: #0284c7;">{inv['amount_words']}</span>
        </div>

        <div class="notice-box">
            This is a computer-generated statutory tax invoice issued under SMRITI Retail OS v4.7.0. No physical signature required.
        </div>
    </body>
    </html>
    """
    return html

async def main():
    invoices = get_last_10_invoices()
    print(f"Loaded {len(invoices)} invoices from PostgreSQL database.")

    exported_manifest = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        for idx, inv in enumerate(invoices, start=1):
            html = generate_statutory_a4_html(inv)
            await page.set_content(html)

            # Sanitize filename
            clean_inv_no = inv["invoice_no"].replace("/", "_").replace("\\", "_")
            pdf_filename = f"{idx}_{clean_inv_no}.pdf"
            pdf_path = os.path.join(EXPORT_DIR, pdf_filename)

            footer_html = f'''
            <div style="font-size: 8px; font-family: sans-serif; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 10mm; color: #64748b; border-top: 1px solid #e2e8f0;">
                <div>SMRITI OS Statutory A4 Print Engine</div>
                <div>{inv["invoice_no"]} &bull; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
            '''

            await page.pdf(
                path=pdf_path,
                format="A4",
                margin={"top": "12mm", "bottom": "15mm", "left": "10mm", "right": "10mm"},
                display_header_footer=True,
                header_template="<div></div>",
                footer_template=footer_html
            )

            file_size = os.path.getsize(pdf_path)
            exported_manifest.append({
                "index": idx,
                "invoice_no": inv["invoice_no"],
                "date": inv["invoice_date"],
                "customer": inv["customer_name"],
                "grand_total": inv["rounded_grand"],
                "file_path": pdf_path,
                "file_size": file_size
            })

        await browser.close()

    print("\n" + "="*80)
    print("SMRITI STATUTORY A4 PDF EXPORT MANIFEST — LAST 10 INVOICES")
    print("="*80)
    for m in exported_manifest:
        print(f"[{m['index']}] {m['invoice_no']} | Date: {m['date']} | Total: ₹{m['grand_total']:,.2f} | Size: {m['file_size']/1024:.1f} KB")
        print(f"    Path: file:///{m['file_path'].replace('\\', '/')}")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())
