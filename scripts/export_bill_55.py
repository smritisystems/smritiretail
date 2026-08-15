"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import asyncio
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
EXPORT_DIR = r"F:\SMRITRretailNX\exports"


async def export_bill_55():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    inv_no = "TT2026-2027_55"

    async with async_session() as session:
        # Fetch Invoice Header
        res = await session.execute(
            text("SELECT id, invoice_no, date, grand_total, tax_total, payment_mode, status, is_interstate FROM sales_invoices WHERE invoice_no = :inv_no AND is_deleted = false"),
            {"inv_no": inv_no}
        )
        row = res.mappings().first()

        if not row:
            print(f"Error: Invoice {inv_no} was not found in database.")
            return

        # Fetch Invoice Line Items
        items_res = await session.execute(
            text("SELECT code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount FROM sales_invoice_items WHERE invoice_id = :inv_id ORDER BY id ASC"),
            {"inv_id": row["id"]}
        )
        items = items_res.mappings().all()

        subtotal = Decimal("0.00")
        items_html = ""

        for idx, item in enumerate(items, start=1):
            qty = Decimal(str(item["quantity"]))
            price = Decimal(str(item["price"]))
            tax_amt = Decimal(str(item["tax_amount"]))
            tot_amt = Decimal(str(item["total_amount"]))
            subtotal += (qty * price)

            items_html += f"""
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">{idx}</td>
              <td style="border: 1px solid #ddd; padding: 8px;"><strong>{item['name']}</strong><br/><small style="color: #666;">Code: {item['code']} | HSN: {item['hsn_code'] or '64041990'}</small></td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{qty:.0f}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs. {price:,.2f}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs. {tax_amt:,.2f} (5% IGST)</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Rs. {tot_amt:,.2f}</strong></td>
            </tr>
            """

        gt = Decimal(str(row["grand_total"]))
        tt = Decimal(str(row["tax_total"]))

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>TAX INVOICE - {inv_no}</title>
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #222; }}
    .header {{ text-align: center; border-bottom: 3px solid #1a365d; padding-bottom: 12px; margin-bottom: 24px; }}
    .company-title {{ font-size: 26px; font-weight: bold; color: #1a365d; letter-spacing: 1px; }}
    .sub-header {{ font-size: 14px; color: #555; margin-top: 4px; }}
    .meta-table {{ width: 100%; margin-bottom: 24px; font-size: 15px; border-collapse: collapse; }}
    .meta-table td {{ padding: 6px 0; }}
    .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
    .items-table th {{ background-color: #1a365d; color: #ffffff; border: 1px solid #1a365d; padding: 10px; text-align: left; font-size: 14px; }}
    .summary-box {{ width: 350px; float: right; border: 1px solid #1a365d; border-radius: 6px; padding: 16px; background-color: #f7fafc; }}
    .summary-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px; }}
    .summary-total {{ display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #1a365d; border-top: 2px solid #1a365d; padding-top: 8px; margin-top: 8px; }}
    .footer {{ margin-top: 120px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="company-title">TATTLY THREADS</div>
    <div class="sub-header">Authoritative Business Tax Invoice</div>
    <div style="font-size: 18px; font-weight: bold; margin-top: 8px; color: #2b6cb0;">GST TAX INVOICE</div>
  </div>

  <table class="meta-table">
    <tr>
      <td><strong>Invoice Number:</strong> {inv_no}</td>
      <td align="right"><strong>Invoice Date:</strong> {row['date']}</td>
    </tr>
    <tr>
      <td><strong>Payment Terms:</strong> {row['payment_mode'] or 'CREDIT'}</td>
      <td align="right"><strong>Tax Type:</strong> Inter-State IGST (5%)</td>
    </tr>
    <tr>
      <td><strong>Status:</strong> <span style="color: #2b6cb0; font-weight: bold;">{row['status']}</span></td>
      <td align="right"><strong>Source Database:</strong> smritisys</td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">#</th>
        <th style="width: 45%;">Item Description</th>
        <th style="width: 10%; text-align: right;">Qty</th>
        <th style="width: 13%; text-align: right;">Taxable Rate</th>
        <th style="width: 13%; text-align: right;">IGST Tax</th>
        <th style="width: 14%; text-align: right;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {items_html}
    </tbody>
  </table>

  <div class="summary-box">
    <div class="summary-row">
      <span>Subtotal (Taxable):</span>
      <span>Rs. {subtotal:,.2f}</span>
    </div>
    <div class="summary-row">
      <span>IGST @ 5%:</span>
      <span>Rs. {tt:,.2f}</span>
    </div>
    <div class="summary-total">
      <span>Grand Total:</span>
      <span>Rs. {gt:,.2f}</span>
    </div>
  </div>

  <div style="clear: both;"></div>

  <div class="footer">
    SMRITI Retail OS v3.21 — System of Record Export | Author: Jawahar Ramkripal Mallah | SMRITIBooks.com
  </div>
</body>
</html>
"""

        html_path = os.path.join(EXPORT_DIR, f"{inv_no}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        print(f"Exported HTML invoice to: {html_path}")
        print(f"Invoice: {inv_no} | Subtotal: Rs. {subtotal:,.2f} | IGST Tax: Rs. {tt:,.2f} | Grand Total: Rs. {gt:,.2f} | Items: {len(items)}")

if __name__ == "__main__":
    asyncio.run(export_bill_55())
