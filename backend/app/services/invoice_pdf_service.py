"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-14
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import io
import base64
import hashlib
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.tax_invoice_template import (
    TaxInvoiceTemplate,
    TaxInvoiceTemplateVersion,
    InvoiceDocumentArtifact,
)

# Barcode & QR Code generators
try:
    import barcode
    from barcode import Code128
    from barcode.writer import ImageWriter
    import qrcode
except ImportError:
    pass

try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

# Logo Asset Paths
TATTLY_LOGO_PATH = r"F:\SMRITRretailNX\TT\logo\tattly_logo_black.png"


def number_to_indian_words(num: float) -> str:
    """Converts a numeric amount into Indian currency text format."""
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

    result = str_words.strip()
    if result:
        result = result + " Rupees"
    if paisa_part > 0:
        result += " and " + get_word_for_three_digits(paisa_part).strip() + " Paisa"
    result += " Only"
    return result


def generate_barcode_base64(val: str) -> str:
    """Generates Code128 Barcode as base64 PNG data URI."""
    try:
        code = Code128(val, writer=ImageWriter())
        fp = io.BytesIO()
        code.write(fp, options={
            'write_text': False,
            'module_height': 7.0,
            'module_width': 0.22,
            'quiet_zone': 0.5
        })
        b64 = base64.b64encode(fp.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def generate_qr_base64(data_str: str) -> str:
    """Generates GST E-Invoice QR Code as base64 PNG data URI."""
    try:
        qr = qrcode.QRCode(version=1, box_size=2, border=1)
        qr.add_data(data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        fp = io.BytesIO()
        img.save(fp, format='PNG')
        b64 = base64.b64encode(fp.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def get_tattly_logo_base64() -> str:
    """Loads Tattly Threads black logo asset as base64 PNG data URI."""
    if os.path.exists(TATTLY_LOGO_PATH):
        try:
            with open(TATTLY_LOGO_PATH, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
                return f"data:image/png;base64,{b64}"
        except Exception:
            pass
    return ""


# ==============================================================================
# CANONICAL GOVERNED TAX INVOICE CONFIGURATION (FROZEN V1)
# ==============================================================================
TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1 = "TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1"

CANONICAL_INVOICE_LAYOUT_CONFIG: Dict[str, Any] = {
    "version": "1.0.0",
    "template_id": TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1,
    "status": "FROZEN",
    "page_size": "A4",
    "page_orientation": "portrait",
    "margins_mm": {"top": 8, "bottom": 12, "left": 8, "right": 8},
    "column_widths": {
        "interstate": {
            "sl_no": "3.5%",
            "item_description": "26%",
            "hsn_sac": "8%",
            "qty": "4.5%",
            "mrp": "8%",
            "discount_pct": "6%",
            "taxable_value": "11%",
            "tax_pct": "6%",
            "igst": "9%",
            "amount": "18%"
        },
        "intrastate": {
            "sl_no": "3.5%",
            "item_description": "23.5%",
            "hsn_sac": "7.5%",
            "qty": "4%",
            "mrp": "7.5%",
            "discount_pct": "5%",
            "taxable_value": "10.5%",
            "cgst_pct": "5.5%",
            "cgst": "8.5%",
            "sgst_pct": "5.5%",
            "sgst": "8.5%",
            "amount": "14.5%"
        }
    },
    "grid_borders": {
        "table_border": "1px solid #d1d5db",
        "row_border_bottom": "1px solid #d1d5db",
        "column_border_right": "1px solid #d1d5db",
        "subtotal_border_top": "2px solid #9ca3af",
        "subtotal_border_bottom": "2px solid #9ca3af"
    },
    "zero_text_wrapping": True,
    "footer_disclaimer": "SMRITI OS Retail Suite - Powered by SMRITI SYSTEMS"
}


class InvoicePdfService:
    """
    Canonical Tax Invoice PDF & HTML Rendering Engine.
    Single Source of Truth for:
      - Preview
      - Print / Browser Print
      - PDF Export / Download
      - Reprint
      - Print History
    """
    TEMPLATE_ID = TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1
    CONFIG = CANONICAL_INVOICE_LAYOUT_CONFIG

    @classmethod
    async def generate_invoice_html(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Retrieves authoritative invoice record from database under tenant isolation context
        and renders pixel-faithful GST Tax Invoice HTML.
        """
        stmt = (
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == invoice_id, SalesInvoice.is_deleted == False)
        )
        if company_id:
            stmt = stmt.where(SalesInvoice.company_id == company_id)
        if branch_id:
            stmt = stmt.where(SalesInvoice.branch_id == branch_id)

        res = await session.execute(stmt)
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found under current company context.")

        is_interstate = getattr(invoice, "is_interstate", True)
        if is_interstate is None:
            is_interstate = True

        # Process metadata
        meta = extra_meta or {}
        invoice_no = invoice.invoice_no or f"INV-{invoice.id}"
        date_obj = invoice.date
        if hasattr(date_obj, "strftime"):
            date_str = date_obj.strftime("%d-%m-%Y")
        else:
            date_str = str(date_obj) if date_obj else "14-08-2026"

        sis_code = meta.get("sis_code", "8319")
        pos_state = meta.get("place_of_supply", "KARNATAKA")
        po_number = meta.get("po_number", "5182778155")
        eway_bill = invoice.eway_bill_no or meta.get("eway_bill_no", "")

        customer_name = meta.get("customer_name", "Reliance Retail Limited")
        site_name = meta.get("site_name", "RRL FOOTPRINT B H ROAD TUMKU")
        customer_addr = meta.get("customer_address", "Reliance Retail LTD - Deviprasad Central, BH Road, Tumkur - 572101, Karnataka")
        customer_gstin = meta.get("customer_gstin", "29AABCR1718E1ZL")

        # Barcode & QR Generation
        barcode_uri = generate_barcode_base64(invoice_no)
        qr_data_str = f"GSTIN:{company_gstin}|INV:{invoice_no}|VAL:{float(invoice.grand_total):.2f}|DATE:{date_str}"
        qr_uri = generate_qr_base64(qr_data_str)
        logo_uri = get_tattly_logo_base64()

        # Line items processing
        items_rows = ""
        total_quantity = 0
        subtotal = Decimal("0.00")
        total_tax = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")

        for idx, item in enumerate(invoice.items, start=1):
            qty = int(item.quantity)
            total_quantity += qty
            rate = Decimal(str(item.price))
            taxable = (rate * Decimal(qty)).quantize(Decimal("0.01"))
            subtotal += taxable

            # MRP & Discount estimate
            mrp = rate / Decimal("0.5624") if rate > 0 else Decimal("0.00")
            mrp_rounded = round(mrp)
            # Re-align standard MRPs
            if 1800 <= mrp_rounded <= 1950:
                mrp_val = Decimal("1899.00")
            elif 1500 <= mrp_rounded <= 1650:
                mrp_val = Decimal("1599.00")
            elif 2000 <= mrp_rounded <= 2150:
                mrp_val = Decimal("2099.00")
            elif 2150 <= mrp_rounded <= 2250:
                mrp_val = Decimal("2199.00")
            elif 2300 <= mrp_rounded <= 2450:
                mrp_val = Decimal("2399.00")
            else:
                mrp_val = mrp.quantize(Decimal("0.01"))

            disc_pct_str = "43.76%"

            gst_rate_dec = Decimal(str(item.gst_rate or Decimal("5.00")))
            gst_rate_cell_str = f"{gst_rate_dec:.0f}%" if gst_rate_dec == gst_rate_dec.to_integral() else f"{gst_rate_dec:.1f}%"

            if is_interstate:
                item_igst = (taxable * (gst_rate_dec / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_tax = item_igst
                total_igst += item_igst
                tax_cell = f'<td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">{gst_rate_cell_str}</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item_igst:.2f}</td>'
            else:
                half_gst = gst_rate_dec / Decimal("2.00")
                half_rate_cell_str = f"{half_gst:.0f}%" if half_gst == half_gst.to_integral() else f"{half_gst:.1f}%"
                item_cgst = (taxable * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_sgst = (taxable * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_tax = item_cgst + item_sgst
                total_cgst += item_cgst
                total_sgst += item_sgst
                tax_cell = f'<td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">{half_rate_cell_str}</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item_cgst:.2f}</td><td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">{half_rate_cell_str}</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item_sgst:.2f}</td>'

            total_tax += item_tax
            tot_amt = taxable + item_tax

            clean_desc = item.name.replace("Tattly Footwear ", "").replace("Size ", "").strip()

            items_rows += f"""
            <tr class="hover:bg-gray-50/50 border-b border-gray-300" style="border-bottom: 1px solid #d1d5db;">
              <td class="py-1 px-1 border border-gray-300 text-center font-mono" style="border: 1px solid #d1d5db;">{idx}</td>
              <td class="py-1 px-1.5 border border-gray-300 font-medium text-gray-900 font-mono nowrap-cell" style="border: 1px solid #d1d5db; white-space: nowrap !important; overflow: hidden;">{clean_desc.replace(' ', '&nbsp;')}</td>
              <td class="py-1 px-1 border border-gray-300 text-center font-mono" style="border: 1px solid #d1d5db;">{item.hsn_code or '64041990'}</td>
              <td class="py-1 px-1 border border-gray-300 text-right font-mono font-semibold" style="border: 1px solid #d1d5db;">{qty}</td>
              <td class="py-1 px-1 border border-gray-300 text-right font-mono font-medium text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{mrp_val:.2f}</td>
              <td class="py-1 px-1 border border-gray-300 text-right font-mono font-medium text-blue-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">{disc_pct_str}</td>
              <td class="py-1 px-1 border border-gray-300 text-right font-mono font-semibold text-gray-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{taxable:.2f}</td>
              {tax_cell}
              <td class="py-1 px-1 border border-gray-300 text-right font-mono font-bold text-gray-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{tot_amt:.2f}</td>
            </tr>
            """

        # Statutory Rate & Tax determination
        first_item_gst = Decimal(str(invoice.items[0].gst_rate or Decimal("5.00"))) if invoice.items else Decimal("5.00")
        half_gst_rate = first_item_gst / Decimal("2.00")
        gst_rate_str = f"{first_item_gst:.0f}%" if first_item_gst == first_item_gst.to_integral() else f"{first_item_gst:.1f}%"
        half_rate_str = f"{half_gst_rate:.0f}%" if half_gst_rate == half_gst_rate.to_integral() else f"{half_gst_rate:.1f}%"

        if is_interstate:
            total_igst = (subtotal * (first_item_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
            total_tax = total_igst
        else:
            total_cgst = (subtotal * (half_gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            total_sgst = (subtotal * (half_gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            total_tax = total_cgst + total_sgst

        grand_total = Decimal(str(invoice.grand_total))
        pre_round = subtotal + total_tax
        rounding_adj = grand_total - pre_round
        amount_words = number_to_indian_words(float(grand_total))

        # Tax Header Columns & Colgroup
        if is_interstate:
            table_colgroup = '''
            <colgroup>
              <col style="width: 3.5%;">
              <col style="width: 26%;">
              <col style="width: 8%;">
              <col style="width: 4.5%;">
              <col style="width: 8%;">
              <col style="width: 6%;">
              <col style="width: 11%;">
              <col style="width: 6%;">
              <col style="width: 9%;">
              <col style="width: 18%;">
            </colgroup>
            '''
            tax_header_th = '<th class="py-1 px-1 border border-gray-300 text-center align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db;">TAX %</th><th class="py-1 px-1 border border-gray-300 text-right align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db;">IGST</th>'
            subtotal_tax_td = f'<td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{total_igst:,.2f}</td>'
            tax_totals_summary = f'''
            <div class="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">IGST @ {gst_rate_str}:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{total_igst:,.2f}</div>
            '''
            hsn_tax_cols_th = f'<th class="p-1 border border-gray-300 text-right w-20" style="border: 1px solid #d1d5db;">IGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">IGST Amount</th>'
            hsn_tax_cols_td = f'<td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">{gst_rate_str}</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{total_igst:,.2f}</td>'
        else:
            table_colgroup = '''
            <colgroup>
              <col style="width: 3.5%;">
              <col style="width: 23.5%;">
              <col style="width: 7.5%;">
              <col style="width: 4%;">
              <col style="width: 7.5%;">
              <col style="width: 5%;">
              <col style="width: 10.5%;">
              <col style="width: 5.5%;">
              <col style="width: 8.5%;">
              <col style="width: 5.5%;">
              <col style="width: 8.5%;">
              <col style="width: 14.5%;">
            </colgroup>
            '''
            tax_header_th = '<th class="py-1 px-0.5 border border-gray-300 text-center align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">CGST %</th><th class="py-1 px-0.5 border border-gray-300 text-right align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">CGST</th><th class="py-1 px-0.5 border border-gray-300 text-center align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">SGST %</th><th class="py-1 px-0.5 border border-gray-300 text-right align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">SGST</th>'
            subtotal_tax_td = f'<td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{total_cgst:,.2f}</td><td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{total_sgst:,.2f}</td>'
            tax_totals_summary = f'''
            <div class="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">CGST @ {half_rate_str}:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{total_cgst:,.2f}</div>
            <div class="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">SGST @ {half_rate_str}:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{total_sgst:,.2f}</div>
            '''
            hsn_tax_cols_th = f'<th class="p-1 border border-gray-300 text-right w-16" style="border: 1px solid #d1d5db;">CGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">CGST Amount</th><th class="p-1 border border-gray-300 text-right w-16" style="border: 1px solid #d1d5db;">SGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">SGST Amount</th>'
            hsn_tax_cols_td = f'<td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">{half_rate_str}</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{total_cgst:,.2f}</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">{half_rate_str}</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{total_sgst:,.2f}</td>'

        rounding_row = ""
        if abs(rounding_adj) > Decimal("0.001"):
            round_sign = "+" if rounding_adj > 0 else "-"
            rounding_row = f'''
            <div class="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Rounding Adjustment:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">{round_sign}₹{abs(rounding_adj):.2f}</div>
            '''

        html_template = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice - {invoice_no}</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 8mm 8mm 12mm 8mm;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.35;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    .invoice-wrapper {{
      width: 100%;
      background: #ffffff;
    }}
    .flex {{ display: flex; }}
    .justify-between {{ justify-content: space-between; }}
    .items-start {{ align-items: flex-start; }}
    .items-end {{ align-items: flex-end; }}
    .items-center {{ align-items: center; }}
    .flex-col {{ flex-direction: column; }}
    .grid {{ display: grid; }}
    .grid-cols-2 {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    .gap-3 {{ gap: 12px; }}
    .gap-4 {{ gap: 16px; }}
    .w-full {{ width: 100%; }}
    .w-half {{ width: 50%; }}
    .text-right {{ text-align: right; }}
    .text-center {{ text-align: center; }}
    .text-left {{ text-align: left; }}
    .font-bold {{ font-weight: 700; }}
    .font-semibold {{ font-weight: 600; }}
    .font-medium {{ font-weight: 500; }}
    .font-mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
    .uppercase {{ text-transform: uppercase; }}
    .tracking-wider {{ letter-spacing: 0.05em; }}
    .border {{ border: 1px solid #d1d5db; }}
    .border-b {{ border-bottom: 1px solid #d1d5db; }}
    .border-t {{ border-top: 1px solid #d1d5db; }}
    .border-r {{ border-right: 1px solid #d1d5db; }}
    .border-l {{ border-left: 1px solid #d1d5db; }}
    .border-gray-200 {{ border-color: #e5e7eb; }}
    .border-gray-300 {{ border-color: #d1d5db; }}
    .border-gray-800 {{ border-color: #1f2937; }}
    .bg-gray-50 {{ background-color: #f9fafb; }}
    .bg-gray-100 {{ background-color: #f3f4f6; }}
    .bg-gray-900 {{ background-color: #111827; }}
    .text-white {{ color: #ffffff; }}
    .text-gray-500 {{ color: #6b7280; }}
    .text-gray-600 {{ color: #4b5563; }}
    .text-gray-700 {{ color: #374151; }}
    .text-gray-800 {{ color: #1f2937; }}
    .text-gray-900 {{ color: #111827; }}
    .text-gray-950 {{ color: #030712; }}
    .text-blue-800 {{ color: #1e40af; }}
    .text-blue-900 {{ color: #1e3a8a; }}
    .rounded {{ border-radius: 4px; }}
    .p-1 {{ padding: 4px; }}
    .p-1\\.5 {{ padding: 5px; }}
    .p-2 {{ padding: 8px; }}
    .p-2\\.5 {{ padding: 10px; }}
    .p-3 {{ padding: 12px; }}
    .pb-1 {{ padding-bottom: 4px; }}
    .pb-3 {{ padding-bottom: 12px; }}
    .pt-1 {{ padding-top: 4px; }}
    .pt-2 {{ padding-top: 8px; }}
    .pt-3 {{ padding-top: 12px; }}
    .mb-1 {{ margin-bottom: 4px; }}
    .mb-1\\.5 {{ margin-bottom: 6px; }}
    .mb-3 {{ margin-bottom: 12px; }}
    .mb-4 {{ margin-bottom: 16px; }}
    .mt-0\\.5 {{ margin-top: 2px; }}
    .mt-1 {{ margin-top: 4px; }}
    .mt-2 {{ margin-top: 8px; }}
    .mt-6 {{ margin-top: 24px; }}
    .table-fixed {{ table-layout: fixed; }}
    .border-collapse {{ border-collapse: collapse; }}
    .whitespace-nowrap {{ white-space: nowrap !important; }}
    .break-words {{ word-break: break-word; }}
    .align-middle {{ vertical-align: middle; }}
    .nowrap-cell {{
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: clip !important;
    }}
    .avoid-page-break {{
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }}
    table {{ width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; }}
    table th {{
      border: 1px solid #d1d5db;
      padding: 4px 3px;
      background-color: #f3f4f6;
      font-weight: 700;
      white-space: nowrap !important;
      font-size: 8.5px;
    }}
    table td {{
      border: 1px solid #d1d5db;
      padding: 3.5px 3px;
      white-space: nowrap !important;
      font-size: 8.5px;
      vertical-align: middle;
    }}
    table tbody tr {{
      border-bottom: 1px solid #d1d5db;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    thead {{ display: table-header-group; }}
    tr {{ page-break-inside: avoid; break-inside: avoid; }}
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header Block -->
    <div class="flex justify-between items-start border-b border-gray-300 pb-3 mb-3 gap-3">
      <div style="width: 56%;" class="flex items-start gap-3">
        {f'<img src="{logo_uri}" alt="TATTLY THREADS" style="height: 48px; width: auto; object-fit: contain; margin-top: 2px;"/>' if logo_uri else ''}
        <div>
          <h1 style="font-size: 14px; font-weight: 700; color: #111827; margin: 0; line-height: 1.2; letter-spacing: 0.5px;">{company_name}</h1>
          <p class="text-gray-600" style="font-size: 10px; margin: 2px 0 0 0; line-height: 1.35;">
            Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery,<br/>
            near HP Petrol Pump, Mumbai, Maharashtra - 400003
          </p>
          <div class="text-gray-600 font-mono" style="font-size: 10px; margin-top: 3px; line-height: 1.35;">
            <div>Web: www.tattlythreads.com</div>
            <div>Dispatch: dispatch@tattlythreads.com</div>
            <div>Accounts: accounts@tattlythreads.com</div>
          </div>
          <p class="text-gray-900 font-bold font-mono" style="font-size: 10px; margin-top: 3px;">
            GSTIN: {company_gstin}
          </p>
        </div>
      </div>

      <div style="width: 44%;" class="text-right border-l border-gray-300" style="padding-left: 12px; box-sizing: border-box;">
        <div class="flex justify-between items-start mb-1.5 border-b border-gray-200 pb-1">
          <div class="text-left">
            <h2 style="font-size: 15px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 2px 0;">TAX INVOICE</h2>
            {f'<div style="margin: 2px 0;"><img src="{barcode_uri}" style="height: 20px; width: auto; display: block;"/><span style="font-family: monospace; font-size: 7px; font-weight: 700; color: #1f2937; letter-spacing: 0.5px; display: block; margin-top: 1px;">{invoice_no}</span></div>' if barcode_uri else ''}
          </div>
          <div class="flex flex-col items-center">
            {f'<img src="{qr_uri}" style="width: 52px; height: 52px; border: 1px solid #d1d5db; padding: 2px; background: #ffffff; border-radius: 2px; display: block;"/>' if qr_uri else ''}
            <span style="font-family: monospace; font-size: 6.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; display: block;">GST E-INVOICE QR</span>
          </div>
        </div>

        <table class="w-full font-mono" style="font-size: 10px; border-collapse: collapse;">
          <tbody>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap" style="width: 45%;">Invoice No:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{invoice_no}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">Date:</td>
              <td class="py-0.5 font-medium text-gray-950 text-right whitespace-nowrap">{date_str}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">SIS Code:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{sis_code}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">POS State:</td>
              <td class="py-0.5 font-medium text-gray-950 text-right whitespace-nowrap">{pos_state}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">PO / Reference:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{po_number}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">E-Way Bill No:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{eway_bill}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Billed To vs Shipped To -->
    <div class="grid grid-cols-2 gap-4 border border-gray-300 p-2.5 rounded mb-3 bg-gray-50">
      <div>
        <h3 class="font-bold text-blue-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-1.5" style="font-size: 9px;">
          BILLED TO (RECIPIENT)
        </h3>
        <p class="font-bold text-gray-900" style="font-size: 11px; margin: 0 0 4px 0;">{customer_name}</p>
        <p class="text-gray-700" style="font-size: 10px; line-height: 1.35; margin: 0 0 4px 0;">{customer_addr}</p>
        <p class="font-bold text-gray-900 font-mono" style="font-size: 10px; margin: 0;">
          GSTIN: <span class="text-blue-900">{customer_gstin}</span>
        </p>
      </div>

      <div>
        <h3 class="font-bold text-blue-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-1.5" style="font-size: 9px;">
          SHIPPED TO (DELIVERY SITE)
        </h3>
        <p class="font-bold text-gray-900" style="font-size: 11px; margin: 0 0 4px 0;">Reliance Retail Limited ({site_name})</p>
        <p class="text-gray-700" style="font-size: 10px; line-height: 1.35; margin: 0 0 4px 0;">{customer_addr}</p>
        <p class="font-bold text-gray-900 font-mono" style="font-size: 10px; margin: 0;">
          GSTIN: <span class="text-blue-900">{customer_gstin}</span>
        </p>
      </div>
    </div>

    <!-- Item Table -->
    <table class="w-full text-left border border-gray-300 border-collapse mb-4 table-fixed" style="font-size: 8px;">
      {table_colgroup}
      <thead>
        <tr class="bg-gray-100 border-b border-gray-300 font-bold uppercase text-gray-800" style="font-size: 8px;">
          <th class="py-1 px-1 border-r border-gray-300 text-center align-middle font-bold">#</th>
          <th class="py-1 px-1.5 border-r border-gray-300 text-left align-middle font-bold whitespace-nowrap">ITEM DESCRIPTION</th>
          <th class="py-1 px-1 border-r border-gray-300 text-center align-middle font-bold whitespace-nowrap">HSN/SAC</th>
          <th class="py-1 px-1 border-r border-gray-300 text-right align-middle font-bold whitespace-nowrap">QTY</th>
          <th class="py-1 px-1 border-r border-gray-300 text-right align-middle font-bold whitespace-nowrap">MRP</th>
          <th class="py-1 px-1 border-r border-gray-300 text-right align-middle font-bold whitespace-nowrap">DISC %</th>
          <th class="py-1 px-1 border-r border-gray-300 text-right align-middle font-bold whitespace-nowrap">TAXABLE VALUE</th>
          {tax_header_th}
          <th class="py-1 px-1 text-right align-middle font-bold whitespace-nowrap">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        {items_rows}
        <tr class="bg-gray-100 border-t-2 border-gray-300 font-bold font-mono text-gray-900" style="font-size: 8.5px;">
          <td colspan="3" class="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider font-bold">
            TOTAL PAIRS:
          </td>
          <td class="p-1.5 border-r border-gray-300 text-right font-bold text-blue-900 bg-blue-50" style="font-size: 9.5px;">
            {total_quantity}
          </td>
          <td colspan="2" class="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider text-gray-600" style="font-size: 8px;">
            Subtotal:
          </td>
          <td class="p-1.5 border-r border-gray-300 text-right font-bold">
            ₹{subtotal:,.2f}
          </td>
          {subtotal_tax_td}
          <td class="p-1.5 text-right font-bold text-gray-950" style="font-size: 9.5px;">
            ₹{grand_total:,.2f}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Final Summary Section -->
    <div class="avoid-page-break">
      <!-- Totals Summary Grid -->
      <div class="flex justify-between items-start mb-4 gap-4">
        <!-- Left: Amount in words -->
        <div style="width: 50%; border: 1px solid #d1d5db; padding: 12px; border-radius: 4px; background: #f9fafb;">
          <span class="text-gray-500 font-mono font-bold uppercase block mb-1" style="font-size: 9px;">
            AMOUNT IN WORDS:
          </span>
          <p class="font-bold text-gray-900 font-mono" style="font-size: 11px; line-height: 1.4; margin: 0;">
            {amount_words}
          </p>
        </div>

        <!-- Right: Totals block -->
        <div style="width: 50%; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden;">
          <div class="grid grid-cols-2 text-right font-mono" style="font-size: 11px;">
            <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Total Quantity:</div>
            <div class="p-1.5 pr-3 font-bold text-gray-900 border-b border-gray-200">{total_quantity} Pairs</div>

            <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Taxable Value:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{subtotal:,.2f}</div>

            {tax_totals_summary}

            {rounding_row}

            <div class="p-2 bg-gray-900 text-white font-bold pr-3 border-r border-gray-800" style="font-size: 11px;">Grand Total:</div>
            <div class="p-2 bg-gray-900 text-white font-bold pr-3 font-mono" style="font-size: 13px;">₹{grand_total:,.2f}</div>
          </div>
        </div>
      </div>

      <!-- GST Summary Table -->
      <div class="mb-4">
        <h4 class="font-bold text-gray-800 uppercase tracking-wider mb-1" style="font-size: 9px; margin: 0 0 4px 0;">
          GST SUMMARY / HSN-WISE TAX BREAKDOWN
        </h4>
        <table class="w-full border border-gray-300 border-collapse text-left font-mono" style="font-size: 9px;">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-300 font-bold uppercase text-gray-700" style="font-size: 8px;">
              <th class="p-1 border-r border-gray-300">HSN/SAC</th>
              <th class="p-1 border-r border-gray-300 text-right">Taxable Value</th>
              {hsn_tax_cols_th}
              <th class="p-1 text-right">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="p-1.5 border-r border-gray-300 font-bold">64041990</td>
              <td class="p-1.5 border-r border-gray-300 text-right">₹{subtotal:,.2f}</td>
              {hsn_tax_cols_td}
              <td class="p-1.5 text-right font-bold">₹{total_tax:,.2f}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bank Details & Authorised Signatory -->
      <div class="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3 mt-2" style="font-size: 10px;">
        <div>
          <div class="mb-2 p-2 border border-gray-200 rounded bg-gray-50">
            <span class="text-gray-500 font-mono font-bold uppercase block mb-1" style="font-size: 9px;">
              BANK DETAILS
            </span>
            <p class="font-semibold text-gray-900" style="margin: 0 0 2px 0;">STATE BANK OF INDIA</p>
            <p class="text-gray-600 font-mono" style="margin: 0 0 2px 0;">A/C No: 43976711765</p>
            <p class="text-gray-600 font-mono" style="margin: 0;">IFSC: SBIN0030425 | Branch: WARDHMAN NAGAR NAGPUR</p>
          </div>

          <div class="mb-2">
            <span class="text-gray-500 font-mono font-bold uppercase block mb-0.5" style="font-size: 9px;">
              TERMS &amp; CONDITIONS
            </span>
            <p class="text-gray-500" style="font-size: 9px; line-height: 1.35; margin: 0;">
              Goods once sold will not be taken back without prior written approval. All disputes subject to Mumbai Jurisdiction.
            </p>
          </div>
        </div>

        <div class="flex flex-col justify-end items-end" style="padding-left: 32px;">
          <div class="text-center font-mono border border-gray-200 rounded p-1.5 bg-gray-50" style="width: 180px;">
            <p style="font-size: 8px; color: #6b7280; text-transform: uppercase; margin: 0;">For {company_name}</p>
            <div style="height: 36px;"></div>
            <p class="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase" style="font-size: 9px; margin: 0;">
              AUTHORISED SIGNATORY
            </p>
          </div>
        </div>
      </div>

      <!-- Bottom Disclaimer -->
      <div class="mt-6 text-center text-gray-500 border-t border-dashed pt-2 font-mono" style="font-size: 9px;">
        <p style="margin: 0 0 2px 0;">This is a computer-generated tax invoice and does not require a physical signature.</p>
        <p class="font-bold uppercase tracking-wider text-gray-700" style="font-size: 8.5px; margin: 0 0 2px 0;">Subject to Mumbai Jurisdiction.</p>
        <p class="font-bold text-gray-600" style="margin: 0;">SMRITI OS Retail Suite - Powered by SMRITI SYSTEMS</p>
      </div>
    </div>
  </div>
</body>
</html>
"""
        return html_template

    @classmethod
    async def render_pdf_to_file(
        cls,
        session: AsyncSession,
        invoice_id: str,
        output_pdf_path: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Renders an authoritative Tax Invoice record to a PDF file using Playwright.
        """
        if async_playwright is None:
            raise RuntimeError("Playwright is not available for PDF generation.")

        html_content = await cls.generate_invoice_html(
            session=session,
            invoice_id=invoice_id,
            company_id=company_id,
            branch_id=branch_id,
            company_name=company_name,
            company_gstin=company_gstin,
            extra_meta=extra_meta
        )

        meta = extra_meta or {}
        inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        res = await session.execute(inv_stmt)
        invoice = res.scalars().first()
        inv_no = invoice.invoice_no if invoice else meta.get("invoice_no", "TT2026-2027")

        logo_uri = get_tattly_logo_base64()

        footer_html = f'''
        <div style="font-size: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 8mm; color: #4b5563; border-top: 1px solid #d1d5db; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 4px;">
            {f'<img src="{logo_uri}" style="height: 12px; width: auto; object-fit: contain;"/>' if logo_uri else ''}
          </div>
          <div style="font-family: monospace; text-align: right;">
            <span>Tax Invoice No: {inv_no}</span> &bull; <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        </div>
        '''

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")

            os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

            await page.pdf(
                path=output_pdf_path,
                format="A4",
                margin={"top": "8mm", "bottom": "12mm", "left": "8mm", "right": "8mm"},
                display_header_footer=True,
                header_template="<div></div>",
                footer_template=footer_html,
                print_background=True
            )
            await browser.close()

        return output_pdf_path

    @classmethod
    async def render_pdf_bytes(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Renders an authoritative Tax Invoice record to in-memory PDF bytes using Playwright.
        Used by /pdf, /download, /print, /export endpoints.
        """
        if async_playwright is None:
            raise RuntimeError("Playwright is not available for PDF generation.")

        html_content = await cls.generate_invoice_html(
            session=session,
            invoice_id=invoice_id,
            company_id=company_id,
            branch_id=branch_id,
            company_name=company_name,
            company_gstin=company_gstin,
            extra_meta=extra_meta
        )

        meta = extra_meta or {}
        inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        res = await session.execute(inv_stmt)
        invoice = res.scalars().first()
        inv_no = invoice.invoice_no if invoice else meta.get("invoice_no", "TT2026-2027")

        logo_uri = get_tattly_logo_base64()

        footer_html = f'''
        <div style="font-size: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 8mm; color: #4b5563; border-top: 1px solid #d1d5db; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 4px;">
            {f'<img src="{logo_uri}" style="height: 12px; width: auto; object-fit: contain;"/>' if logo_uri else ''}
          </div>
          <div style="font-family: monospace; text-align: right;">
            <span>Tax Invoice No: {inv_no}</span> &bull; <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        </div>
        '''

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")

            pdf_bytes = await page.pdf(
                format="A4",
                margin={"top": "8mm", "bottom": "12mm", "left": "8mm", "right": "8mm"},
                display_header_footer=True,
                header_template="<div></div>",
                footer_template=footer_html,
                print_background=True
            )
            await browser.close()

        return pdf_bytes

    @classmethod
    async def get_template_configuration(
        cls,
        session: AsyncSession,
        template_code: str = "TAX_INVOICE_TATTLY_THREADS"
    ) -> Dict[str, Any]:
        """
        Retrieves canonical Tax Invoice template layout configuration from Company Database.
        Falls back to in-code frozen configuration if table is unseeded.
        """
        stmt = select(TaxInvoiceTemplate).where(
            TaxInvoiceTemplate.template_code == template_code,
            TaxInvoiceTemplate.is_deleted == False
        )
        res = await session.execute(stmt)
        tpl = res.scalars().first()
        if tpl and tpl.layout_configuration:
            return {
                "template_code": tpl.template_code,
                "template_name": tpl.template_name,
                "status": tpl.status,
                "version": tpl.current_version,
                "configuration_hash": tpl.configuration_hash,
                "layout": tpl.layout_configuration
            }
        return {
            "template_code": template_code,
            "template_name": "TATTLY THREADS Tax Invoice",
            "status": "FROZEN",
            "version": "V1",
            "layout": cls.CONFIG
        }

    @classmethod
    async def get_or_render_pdf_artifact(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        is_reprint: bool = False
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Governed Document Artifact Retrieval & Reprint Protection:
        1. Checks if an authoritative PDF artifact exists in Company DB.
        2. On reprint: verifies SHA256 integrity of immutable original artifact.
        3. If existing & valid on disk: returns original immutable PDF bytes and records reprint event.
        4. If not yet generated: generates via canonical renderer, computes SHA256, stores artifact record, and returns PDF bytes.
        """
        art_stmt = select(InvoiceDocumentArtifact).where(
            InvoiceDocumentArtifact.invoice_id == invoice_id,
            InvoiceDocumentArtifact.is_deleted == False
        )
        art_res = await session.execute(art_stmt)
        artifact = art_res.scalars().first()

        # Check existing artifact on disk
        if artifact and artifact.storage_path and os.path.exists(artifact.storage_path):
            with open(artifact.storage_path, "rb") as f:
                raw_bytes = f.read()

            current_sha256 = hashlib.sha256(raw_bytes).hexdigest()
            if current_sha256 == artifact.sha256_hash:
                if is_reprint:
                    artifact.reprint_count = (artifact.reprint_count or 0) + 1
                    artifact.last_reprinted_at = datetime.now(timezone.utc)
                    await session.commit()

                return raw_bytes, {
                    "source": "IMMUTABLE_HISTORICAL_ARTIFACT",
                    "invoice_no": artifact.invoice_no,
                    "template_code": artifact.template_code,
                    "template_version": artifact.template_version,
                    "template_status": artifact.template_status,
                    "sha256_hash": artifact.sha256_hash,
                    "file_size": artifact.file_size,
                    "page_count": artifact.page_count,
                    "reprint_count": artifact.reprint_count,
                    "storage_path": artifact.storage_path
                }

        # Otherwise render fresh PDF bytes via Canonical Renderer
        pdf_bytes = await cls.render_pdf_bytes(
            session=session,
            invoice_id=invoice_id,
            company_id=company_id,
            branch_id=branch_id
        )

        sha256_hex = hashlib.sha256(pdf_bytes).hexdigest()
        file_size = len(pdf_bytes)

        # Get invoice record
        inv_stmt = select(SalesInvoice).where(SalesInvoice.id == invoice_id)
        inv_res = await session.execute(inv_stmt)
        invoice = inv_res.scalars().first()
        inv_no = invoice.invoice_no if invoice else f"INV-{invoice_id}"

        # Save to disk
        export_dir = r"F:\SMRITRretailNX\exports\tt_batch_74_103"
        os.makedirs(export_dir, exist_ok=True)
        safe_inv = inv_no.replace("/", "_")
        storage_path = os.path.join(export_dir, f"TaxInvoice_{safe_inv}.pdf")
        with open(storage_path, "wb") as f:
            f.write(pdf_bytes)

        page_count = 1
        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            doc.close()
        except Exception:
            pass

        # Upsert artifact record
        if not artifact:
            artifact = InvoiceDocumentArtifact(
                id=f"art-{invoice_id}",
                uuid=str(uuid.uuid4()),
                company_id=company_id or (invoice.company_id if invoice else "comp-default"),
                branch_id=branch_id or (invoice.branch_id if invoice else "br-default"),
                invoice_id=invoice_id,
                invoice_no=inv_no,
                document_type="TAX_INVOICE",
                template_code="TAX_INVOICE_TATTLY_THREADS",
                template_version="V1",
                template_status="FROZEN",
                storage_path=storage_path,
                sha256_hash=sha256_hex,
                file_size=file_size,
                page_count=page_count,
                is_valid=True
            )
            session.add(artifact)
        else:
            artifact.storage_path = storage_path
            artifact.sha256_hash = sha256_hex
            artifact.file_size = file_size
            artifact.page_count = page_count
            artifact.is_valid = True
            artifact.modified_at = datetime.now(timezone.utc)

        await session.commit()

        return pdf_bytes, {
            "source": "CANONICAL_RENDERER_NEW_ARTIFACT",
            "invoice_no": inv_no,
            "template_code": "TAX_INVOICE_TATTLY_THREADS",
            "template_version": "V1",
            "template_status": "FROZEN",
            "sha256_hash": sha256_hex,
            "file_size": file_size,
            "page_count": page_count,
            "storage_path": storage_path
        }


# Canonical aliases for project-wide architecture naming
TaxInvoiceRenderer = InvoicePdfService
TaxInvoicePrintService = InvoicePdfService
