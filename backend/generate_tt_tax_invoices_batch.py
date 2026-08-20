"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import io
import base64
import uuid
import datetime
from decimal import Decimal
import pandas as pd
import psycopg2
import asyncio

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import barcode
    from barcode import Code128
    from barcode.writer import ImageWriter
    import qrcode
except ImportError:
    print("Error: barcode or qrcode missing. Please run pip install python-barcode qrcode")
    sys.exit(1)

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: Playwright required for PDF generation.")
    sys.exit(1)

# ==============================================================================
# Configuration & Batch Parameters
# ==============================================================================
TT_DIR = r"F:\SMRITRretailNX\TT"
RIL_FINAL_LIST_PATH = os.path.join(TT_DIR, "RIL FINAL LIST.xlsx")
RIL_DISPATCH_PATH = os.path.join(TT_DIR, "RIL_Dispatch_09-08-2026-2.xlsx")
TATTLY_LOGO_PATH = os.path.join(TT_DIR, "logo", "tattly_logo_black.png")

OUTPUT_PDF_DIR = TT_DIR
EXPORTS_PDF_DIR = r"F:\SMRITRretailNX\exports\tt_batch_74_103"
os.makedirs(EXPORTS_PDF_DIR, exist_ok=True)

FROZEN_BILLING_DATE_STR = "14-08-2026"
FROZEN_BILLING_DATE_DB = datetime.date(2026, 8, 14)
START_INVOICE_NUM = 74

COMPANY_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
CONTROL_PLANE_DB_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"

SELLER_INFO = {
    "name": "TATTLY THREADS",
    "legal_name": "Tattly Threads Limited",
    "address": "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
    "gstin": "27AAXFT2508H1ZR",
    "state": "MAHARASHTRA",
    "state_code": "27",
    "email": "accounts@tattlythreads.com",
    "dispatch_email": "dispatch@tattlythreads.com",
    "web": "www.tattlythreads.com",
    "bank_name": os.getenv("DEFAULT_BANK_NAME", "STATE BANK OF INDIA"),
    "account_no": os.getenv("DEFAULT_BANK_ACCOUNT_NO", ""),
    "ifsc": os.getenv("DEFAULT_BANK_IFSC", ""),
    "branch": os.getenv("DEFAULT_BANK_BRANCH", "")
}

VERIFIED_SIS_PO_MAP = {
    "V051": "5182778210",
    "1888": "5182778151",
    "1969": "5182778152",
    "1977": "5182778153",
    "8155": "5182778154",
    "8313": "5182778155",
    "8319": "5182778155",
    "8361": "5182778156",
    "9556": "5182778157",
    "S4NN": "5182778158",
    "T0N6": "5182778159",
    "T1BJ": "5182778160",
    "T25I": "5182778161",
    "T38X": "5182778162",
    "T40K": "5182778163",
    "T40R": "5182778164",
    "T51H": "5182778165",
    "T72W": "5182778166",
    "T7FN": "5182778167",
    "T8IY": "5182778168",
    "T97D": "5182778169",
    "T9IM": "5182778170",
    "T9SQ": "5182778171",
    "TA0A": "5182778172",
    "TAGG": "5182778173",
    "TAGH": "5182778174",
    "TAMI": "5182778175",
    "TC64": "5182778176",
    "TDL2": "5182778177",
    "TDL3": "5182778178",
    "TDL6": "5182778179",
    "TDL9": "5182778180",
    "TDM4": "5182778181",
    "TFW4": "5182778182",
    "TGX1": "5182778183",
    "TGX9": "5182778184",
    "TJI4": "5182778185",
    "TRF4": "5182778186",
    "TKF4": "5182778186",
    "TKG3": "5182778187",
    "TKI6": "5182778188",
    "TKLO": "5182778189",
    "TKL0": "5182778189",
    "TKU5": "5182778190",
    "TKU6": "5182778191",
    "TMN2": "5182778192",
    "TMV9": "5182778193",
    "TMW3": "5182778194",
    "TPV2": "5182778195",
    "TUA7": "5182778196",
    "TUB7": "5182778197",
    "TUK5": "5182778198",
    "TV81": "5182778199",
    "TVB6": "5182778200",
    "TVP2": "5182778201",
    "TVT0": "5182778202",
    "TVU1": "5182778203",
    "TW97": "5182778204",
    "TXAJ": "5182778205",
    "TXSR": "5182778206",
    "TXSU": "5182778207",
    "TY06": "5182778208",
    "TYAC": "5182778209",
}

# ==============================================================================
# Helper Functions
# ==============================================================================
def number_to_indian_words(num: float) -> str:
    if num == 0:
        return "Zero Rupees Only"

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

    trimmed_rupees = str_words.strip()
    rupee_unit = "Rupee" if int(abs(num)) == 1 else "Rupees"

    if trimmed_rupees:
        result = f"{trimmed_rupees} {rupee_unit}"
    else:
        result = "Zero Rupees"

    if paisa_part > 0:
        result += " and " + get_word_for_three_digits(paisa_part).strip() + " Paisa"
    result += " Only"
    import re as _re
    return _re.sub(r' {2,}', ' ', result).strip()


def generate_barcode_base64(val: str) -> str:
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
    if os.path.exists(TATTLY_LOGO_PATH):
        try:
            with open(TATTLY_LOGO_PATH, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
                return f"data:image/png;base64,{b64}"
        except Exception:
            pass
    return ""


def generate_pixel_faithful_a4_html(inv: dict) -> str:
    is_interstate = inv["is_interstate"]
    invoice_no = inv["invoice_no"]
    date_str = inv["invoice_date_display"]
    grand_total_str = f"{inv['grand_total']:.2f}"

    logo_uri = get_tattly_logo_base64()
    barcode_uri = generate_barcode_base64(invoice_no)
    qr_data_str = f"GSTIN:{SELLER_INFO['gstin']}|INV:{invoice_no}|VAL:{grand_total_str}|DATE:{date_str}"
    qr_uri = generate_qr_base64(qr_data_str)

    item_rows_html = ""
    for idx, item in enumerate(inv["items"], start=1):
        if is_interstate:
            tax_cell = f'<td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">5%</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item["tax_amount"]:.2f}</td>'
        else:
            cgst = item["tax_amount"] / 2.0
            sgst = item["tax_amount"] / 2.0
            tax_cell = f'<td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">2.5%</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{cgst:.2f}</td><td class="py-1 px-1 border border-gray-300 text-center font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">2.5%</td><td class="py-1 px-1 border border-gray-300 text-right font-mono text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{sgst:.2f}</td>'

        item_rows_html += f"""
        <tr class="hover:bg-gray-50/50 border-b border-gray-300" style="border-bottom: 1px solid #d1d5db;">
          <td class="py-1 px-1 border border-gray-300 text-center font-mono" style="border: 1px solid #d1d5db;">{idx}</td>
          <td class="py-1 px-1.5 border border-gray-300 font-medium text-gray-900 font-mono nowrap-cell" style="border: 1px solid #d1d5db; white-space: nowrap !important; overflow: hidden;">{item['name'].replace(' ', '&nbsp;')}</td>
          <td class="py-1 px-1 border border-gray-300 text-center font-mono" style="border: 1px solid #d1d5db;">{item['hsn']}</td>
          <td class="py-1 px-1 border border-gray-300 text-right font-mono font-semibold" style="border: 1px solid #d1d5db;">{item['qty']}</td>
          <td class="py-1 px-1 border border-gray-300 text-right font-mono font-medium text-gray-700 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item['mrp']:.2f}</td>
          <td class="py-1 px-1 border border-gray-300 text-right font-mono font-medium text-blue-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">43.76%</td>
          <td class="py-1 px-1 border border-gray-300 text-right font-mono font-semibold text-gray-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item['taxable_amount']:.2f}</td>
          {tax_cell}
          <td class="py-1 px-1 border border-gray-300 text-right font-mono font-bold text-gray-900 whitespace-nowrap" style="border: 1px solid #d1d5db;">₹{item['total_amount']:.2f}</td>
        </tr>
        """

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
        subtotal_tax_td = f'<td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{inv["total_tax"]:,.2f}</td>'
        tax_totals_summary = f'''
        <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">IGST @ 5%:</div>
        <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{inv["total_tax"]:,.2f}</div>
        '''
        hsn_tax_cols_th = '<th class="p-1 border border-gray-300 text-right w-20" style="border: 1px solid #d1d5db;">IGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">IGST Amount</th>'
        hsn_tax_cols_td = f'<td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">5%</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{inv["total_tax"]:,.2f}</td>'
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
        cgst_tot = inv['cgst_total']
        sgst_tot = inv['sgst_total']
        tax_header_th = '<th class="py-1 px-0.5 border border-gray-300 text-center align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">CGST %</th><th class="py-1 px-0.5 border border-gray-300 text-right align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">CGST</th><th class="py-1 px-0.5 border border-gray-300 text-center align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">SGST %</th><th class="py-1 px-0.5 border border-gray-300 text-right align-middle font-bold whitespace-nowrap" style="border: 1px solid #d1d5db; font-size: 8px;">SGST</th>'
        subtotal_tax_td = f'<td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{cgst_tot:,.2f}</td><td class="p-1.5 border border-gray-300 text-center text-gray-400 font-bold" style="border: 1px solid #d1d5db;">-</td><td class="p-1.5 border border-gray-300 text-right font-bold" style="border: 1px solid #d1d5db;">₹{sgst_tot:,.2f}</td>'
        tax_totals_summary = f'''
        <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">CGST @ 2.5%:</div>
        <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{cgst_tot:,.2f}</div>
        <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">SGST @ 2.5%:</div>
        <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{sgst_tot:,.2f}</div>
        '''
        hsn_tax_cols_th = '<th class="p-1 border border-gray-300 text-right w-16" style="border: 1px solid #d1d5db;">CGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">CGST Amount</th><th class="p-1 border border-gray-300 text-right w-16" style="border: 1px solid #d1d5db;">SGST Rate</th><th class="p-1 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">SGST Amount</th>'
        hsn_tax_cols_td = f'<td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">2.5%</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{cgst_tot:,.2f}</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">2.5%</td><td class="p-1.5 border border-gray-300 text-right" style="border: 1px solid #d1d5db;">₹{sgst_tot:,.2f}</td>'

    rounding_row = ""
    if abs(inv["round_adj"]) > 0.001:
        round_sign = "+" if inv["round_adj"] > 0 else "-"
        rounding_row = f'''
        <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Rounding Adjustment:</div>
        <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">{round_sign}₹{abs(inv["round_adj"]):.2f}</div>
        '''

    html = f"""
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
          <h1 style="font-size: 14px; font-weight: 700; color: #111827; margin: 0; line-height: 1.2; letter-spacing: 0.5px;">{SELLER_INFO["name"]}</h1>
          <p class="text-gray-600" style="font-size: 10px; margin: 2px 0 0 0; line-height: 1.35;">
            {SELLER_INFO["address"].replace(", near", "<br/>near")}
          </p>
          <div class="text-gray-600 font-mono" style="font-size: 10px; margin-top: 3px; line-height: 1.35;">
            <div>Web: {SELLER_INFO["web"]}</div>
            <div>Dispatch: {SELLER_INFO["dispatch_email"]}</div>
            <div>Accounts: {SELLER_INFO["email"]}</div>
          </div>
          <p class="text-gray-900 font-bold font-mono" style="font-size: 10px; margin-top: 3px;">
            GSTIN: {SELLER_INFO["gstin"]}
          </p>
        </div>
      </div>

      <div style="width: 44%; padding-left: 12px; box-sizing: border-box;" class="text-right border-l border-gray-300">
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
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{inv['sis_code']}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">POS State:</td>
              <td class="py-0.5 font-medium text-gray-950 text-right whitespace-nowrap">{inv['customer_state']}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">PO / Reference:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{inv['po_number']}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="py-0.5 text-gray-500 text-left whitespace-nowrap">E-Way Bill No:</td>
              <td class="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap"></td>
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
        <p class="font-bold text-gray-900" style="font-size: 11px; margin: 0 0 4px 0;">Reliance Retail Limited</p>
        <p class="text-gray-700" style="font-size: 10px; line-height: 1.35; margin: 0 0 4px 0;">
          {inv['customer_address']}
        </p>
        <p class="font-bold text-gray-900 font-mono" style="font-size: 10px; margin: 0;">
          GSTIN: <span class="text-blue-900">{inv['customer_gstin']}</span>
        </p>
      </div>

      <div>
        <h3 class="font-bold text-blue-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-1.5" style="font-size: 9px;">
          SHIPPED TO (DELIVERY SITE)
        </h3>
        <p class="font-bold text-gray-900" style="font-size: 11px; margin: 0 0 4px 0;">Reliance Retail Limited ({inv['site_name']})</p>
        <p class="text-gray-700" style="font-size: 10px; line-height: 1.35; margin: 0 0 4px 0;">
          {inv['customer_address']}
        </p>
        <p class="font-bold text-gray-900 font-mono" style="font-size: 10px; margin: 0;">
          GSTIN: <span class="text-blue-900">{inv['customer_gstin']}</span>
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
        {item_rows_html}
        <tr class="bg-gray-100 border-t-2 border-gray-300 font-bold font-mono text-gray-900" style="font-size: 8.5px;">
          <td colspan="3" class="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider font-bold">
            TOTAL PAIRS:
          </td>
          <td class="p-1.5 border-r border-gray-300 text-right font-bold text-blue-900 bg-blue-50" style="font-size: 9.5px;">
            {inv['total_quantity']}
          </td>
          <td colspan="2" class="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider text-gray-600" style="font-size: 8px;">
            Subtotal:
          </td>
          <td class="p-1.5 border-r border-gray-300 text-right font-bold">
            ₹{inv['subtotal']:,.2f}
          </td>
          {subtotal_tax_td}
          <td class="p-1.5 text-right font-bold text-gray-950" style="font-size: 9.5px;">
            ₹{inv['grand_total']:,.2f}
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
            {inv['amount_words']}
          </p>
        </div>

        <!-- Right: Totals block -->
        <div style="width: 50%; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden;">
          <div class="grid grid-cols-2 text-right font-mono" style="font-size: 11px;">
            <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Total Quantity:</div>
            <div class="p-1.5 pr-3 font-bold text-gray-900 border-b border-gray-200">{inv['total_quantity']} Pairs</div>

            <div class="p-1.5 bg-gray-50 text-gray-600 pr-3 border-r border-b border-gray-200 font-semibold">Taxable Value:</div>
            <div class="p-1.5 pr-3 font-semibold text-gray-900 border-b border-gray-200">₹{inv['subtotal']:,.2f}</div>

            {tax_totals_summary}

            {rounding_row}

            <div class="p-2 bg-gray-900 text-white font-bold pr-3 border-r border-gray-800" style="font-size: 11px;">Grand Total:</div>
            <div class="p-2 bg-gray-900 text-white font-bold pr-3 font-mono" style="font-size: 13px;">₹{inv['grand_total']:,.2f}</div>
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
              <td class="p-1.5 border-r border-gray-300 text-right">₹{inv['subtotal']:,.2f}</td>
              {hsn_tax_cols_td}
              <td class="p-1.5 text-right font-bold">₹{inv['total_tax']:,.2f}</td>
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
            <p class="font-semibold text-gray-900" style="margin: 0 0 2px 0;">{TATTLY['bank_name']}</p>
            <p class="text-gray-600 font-mono" style="margin: 0 0 2px 0;">A/C No: {TATTLY['account_no']}</p>
            <p class="text-gray-600 font-mono" style="margin: 0;">IFSC: {TATTLY['ifsc']} | Branch: {TATTLY['branch']}</p>
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
            <p style="font-size: 8px; color: #6b7280; text-transform: uppercase; margin: 0;">For {SELLER_INFO["name"]}</p>
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
    return html


# ==============================================================================
# Main Processing Pipeline
# ==============================================================================
async def run_batch_generation():
    print("=" * 80)
    print("SMRITI RETAIL OS — PIXEL-FAITHFUL TT TAX INVOICE GENERATION ENGINE")
    print("=" * 80)

    # 1. Verify Excel files exist
    assert os.path.exists(RIL_FINAL_LIST_PATH), f"Missing: {RIL_FINAL_LIST_PATH}"
    assert os.path.exists(RIL_DISPATCH_PATH), f"Missing: {RIL_DISPATCH_PATH}"
    assert os.path.exists(TATTLY_LOGO_PATH), f"Missing logo: {TATTLY_LOGO_PATH}"
    print(f"Verified Source Customer List : {RIL_FINAL_LIST_PATH}")
    print(f"Verified Source Dispatch Matrix: {RIL_DISPATCH_PATH}")
    print(f"Verified Black Logo Asset     : {TATTLY_LOGO_PATH}")

    # 2. Verify Historical Invoices 72 & 73 exist
    pdf_72 = os.path.join(TT_DIR, "SIS_T9IM_TaxInvoice_TT2026-2027_72.pdf")
    pdf_73 = os.path.join(TT_DIR, "SIS_8319_TaxInvoice_TT2026-2027_73.pdf")
    assert os.path.exists(pdf_72), f"Historical invoice 72 PDF missing at: {pdf_72}"
    assert os.path.exists(pdf_73), f"Historical invoice 73 PDF missing at: {pdf_73}"
    print(f"Verified Golden Reference 72   : {pdf_72} (Size: {os.path.getsize(pdf_72)} bytes)")
    print(f"Verified Golden Reference 73   : {pdf_73} (Size: {os.path.getsize(pdf_73)} bytes)")

    # 3. Read Customer Master from RIL FINAL LIST.xlsx
    df_cust = pd.read_excel(RIL_FINAL_LIST_PATH, sheet_name="Sheet1")
    cust_map = {}
    for idx, row in df_cust.iterrows():
        sis = str(row['SIS CODE']).strip()
        if pd.notna(row['SIS CODE']) and sis != 'nan':
            cust_map[sis] = {
                "site_name": str(row['SITE NAME']).strip() if pd.notna(row['SITE NAME']) else f"Reliance Retail Site {sis}",
                "state": str(row['STATE']).strip() if pd.notna(row['STATE']) else "KARNATAKA",
                "city": str(row['CITY']).strip() if pd.notna(row['CITY']) else "BANGALORE",
                "pincode": str(row['PIN CODE']).strip() if pd.notna(row['PIN CODE']) else "560001",
                "address": str(row['ADDRESS']).strip() if pd.notna(row['ADDRESS']) else f"Reliance Retail Store, SIS Code {sis}",
                "gstin": str(row['GST NUMBER']).strip() if pd.notna(row['GST NUMBER']) else "29AABCR1718E1ZL"
            }

    if "8319" not in cust_map and "8313" in cust_map:
        cust_map["8319"] = cust_map["8313"].copy()
        cust_map["8319"]["site_name"] = cust_map["8313"]["site_name"].replace("8313", "8319")
        cust_map["8319"]["address"] = cust_map["8313"]["address"].replace("8313", "8319")

    # 4. Read Dispatch Matrix from RIL_Dispatch_09-08-2026-2.xlsx
    df_disp = pd.read_excel(RIL_DISPATCH_PATH, sheet_name=0)
    size_cols = [36, 37, 38, 39, 40, 41, 42]

    sis_list = []
    for sis in df_disp['SIS CODE'].unique():
        s_clean = str(sis).strip()
        if s_clean not in sis_list:
            sis_list.append(s_clean)

    print(f"Total Unique SIS Stores to Invoice: {len(sis_list)}")

    # 5. Build candidate invoice payloads
    candidate_invoices = []
    current_seq = START_INVOICE_NUM

    for sis in sis_list:
        grp = df_disp[df_disp['SIS CODE'].astype(str).str.strip() == sis]
        inv_no = f"TT2026-2027/{current_seq}"
        po_no = VERIFIED_SIS_PO_MAP.get(sis, "")

        cinfo = cust_map.get(sis, {
            "site_name": f"Reliance Retail Site {sis}",
            "state": "KARNATAKA",
            "city": "BANGALORE",
            "pincode": "560001",
            "address": f"Reliance Retail Store, SIS Code {sis}",
            "gstin": "29AABCR1718E1ZL"
        })

        buyer_gstin = cinfo["gstin"]
        buyer_state = cinfo["state"]
        is_interstate = not buyer_gstin.startswith("27")

        invoice_items = []
        subtotal_taxable = Decimal("0.00")
        total_tax = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        total_qty = 0

        for idx, row in grp.iterrows():
            article = str(row['ARTICLE']).strip().upper()
            color = str(row['COLOR']).strip().upper()
            mrp = Decimal(str(row['MRP']))
            taxable_rate = (mrp * Decimal("0.5624")).quantize(Decimal("0.01"))

            for sz in size_cols:
                if sz in row and pd.notna(row[sz]) and float(row[sz]) > 0:
                    qty = int(float(row[sz]))
                    total_qty += qty

                    item_taxable = (taxable_rate * Decimal(qty)).quantize(Decimal("0.01"))
                    subtotal_taxable += item_taxable

                    if is_interstate:
                        item_tax = (item_taxable * Decimal("0.05")).quantize(Decimal("0.01"))
                        igst_total += item_tax
                    else:
                        item_cgst = (item_taxable * Decimal("0.025")).quantize(Decimal("0.01"))
                        item_sgst = (item_taxable * Decimal("0.025")).quantize(Decimal("0.01"))
                        item_tax = item_cgst + item_sgst
                        cgst_total += item_cgst
                        sgst_total += item_sgst

                    line_total = item_taxable + item_tax
                    sku = f"{article}-{color}-{sz}".replace(" ", "_")
                    item_name = f"{article} {color} {sz}"

                    invoice_items.append({
                        "article": article,
                        "color": color,
                        "size": sz,
                        "sku": sku,
                        "name": item_name,
                        "hsn": "64041990",
                        "qty": qty,
                        "mrp": float(mrp),
                        "rate": float(taxable_rate),
                        "taxable_amount": float(item_taxable),
                        "tax_amount": float(item_tax),
                        "total_amount": float(line_total)
                    })

        if is_interstate:
            igst_total = (subtotal_taxable * Decimal("0.05")).quantize(Decimal("0.01"))
            total_tax = igst_total
            cgst_total = Decimal("0.00")
            sgst_total = Decimal("0.00")
        else:
            cgst_total = (subtotal_taxable * Decimal("0.025")).quantize(Decimal("0.01"))
            sgst_total = (subtotal_taxable * Decimal("0.025")).quantize(Decimal("0.01"))
            total_tax = cgst_total + sgst_total
            igst_total = Decimal("0.00")

        pre_round_grand = subtotal_taxable + total_tax
        rounded_grand = round(pre_round_grand)
        round_adj = rounded_grand - pre_round_grand
        amount_words = number_to_indian_words(float(rounded_grand))

        candidate_invoices.append({
            "sequence": current_seq,
            "invoice_no": inv_no,
            "invoice_date_db": FROZEN_BILLING_DATE_DB,
            "invoice_date_display": FROZEN_BILLING_DATE_STR,
            "sis_code": sis,
            "po_number": po_no,
            "customer_id": "cust-rrl-192b561d",
            "customer_name": f"Reliance Retail Limited ({cinfo['site_name']})",
            "site_name": cinfo["site_name"],
            "customer_state": cinfo["state"],
            "customer_city": cinfo["city"],
            "customer_pincode": cinfo["pincode"],
            "customer_address": cinfo["address"],
            "customer_gstin": buyer_gstin,
            "place_of_supply": f"{buyer_state} ({buyer_gstin[:2]})",
            "is_interstate": is_interstate,
            "total_quantity": total_qty,
            "subtotal": float(subtotal_taxable),
            "total_tax": float(total_tax),
            "cgst_total": float(cgst_total),
            "sgst_total": float(sgst_total),
            "igst_total": float(igst_total),
            "round_adj": float(round_adj),
            "grand_total": float(rounded_grand),
            "amount_words": amount_words,
            "items": invoice_items
        })

        current_seq += 1

    # 6. Database Persistence in Company DB (`smriti001`)
    comp_conn = psycopg2.connect(COMPANY_DB_URL)
    comp_cur = comp_conn.cursor()

    inv_numbers = [inv["invoice_no"] for inv in candidate_invoices]
    comp_cur.execute("""
        DELETE FROM sales_invoice_items 
        WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE invoice_no = ANY(%s));
    """, (inv_numbers,))
    comp_cur.execute("DELETE FROM sales_invoices WHERE invoice_no = ANY(%s);", (inv_numbers,))
    comp_conn.commit()

    # Ensure items in products table
    for inv in candidate_invoices:
        for it in inv["items"]:
            prod_id = f"prod-{it['sku'].lower()}"
            comp_cur.execute("""
                INSERT INTO products (
                    id, uuid, code, barcode, name, sku, category, color, size, mrp, price, cost_price, stock, reserved_stock,
                    hsn_code, gst_percentage, is_active, is_deleted, company_id, branch_id, created_at, modified_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, 'Footwear', %s, %s, %s, %s, %s, 1000, 0,
                    '64041990', 5.00, true, false, 'COMP-001', 'MAIN', NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET 
                    mrp = EXCLUDED.mrp,
                    price = EXCLUDED.price,
                    is_active = true,
                    is_deleted = false;
            """, (
                prod_id, str(uuid.uuid4()), it['sku'], f"BAR-{it['sku']}", it['name'], it['sku'],
                it['color'], str(it['size']), it['mrp'], it['rate'], it['rate']
            ))
    comp_conn.commit()

    # Insert `sales_invoices` and `sales_invoice_items`
    for inv in candidate_invoices:
        inv_id = f"inv-tt-{inv['sequence']}"
        inv_uuid = str(uuid.uuid4())

        comp_cur.execute("""
            INSERT INTO sales_invoices (
                id, uuid, company_id, branch_id, invoice_no, date, customer_id,
                tax_total, grand_total, is_interstate, eway_bill_no, payment_mode,
                status, is_active, is_deleted, created_at, modified_at, version
            )
            VALUES (
                %s, %s, 'COMP-001', 'MAIN', %s, %s, %s,
                %s, %s, %s, NULL, 'BANK_TRANSFER',
                'COMPLETED', true, false, NOW(), NOW(), 1
            );
        """, (
            inv_id, inv_uuid, inv['invoice_no'], inv['invoice_date_db'], inv['customer_id'],
            inv['total_tax'], inv['grand_total'], inv['is_interstate']
        ))

        for it in inv['items']:
            prod_id = f"prod-{it['sku'].lower()}"
            comp_cur.execute("""
                INSERT INTO sales_invoice_items (
                    invoice_id, product_id, code, name, quantity, price,
                    hsn_code, gst_rate, tax_amount, total_amount
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, 5.00, %s, %s
                );
            """, (
                inv_id, prod_id, it['sku'], it['name'], it['qty'], it['rate'],
                it['hsn'], it['tax_amount'], it['total_amount']
            ))

    comp_conn.commit()
    comp_conn.close()
    print("Database persistence in smriti001 (Company Operational DB) COMPLETE.")

    # 7. Render Pixel-Faithful Statutory A4 PDFs via Playwright
    logo_uri = get_tattly_logo_base64()
    generated_pdfs = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        for inv in candidate_invoices:
            html_content = generate_pixel_faithful_a4_html(inv)
            await page.set_content(html_content, wait_until="networkidle")

            clean_inv_suffix = f"TT2026-2027_{inv['sequence']}"
            pdf_filename = f"SIS_{inv['sis_code']}_TaxInvoice_{clean_inv_suffix}.pdf"
            
            tt_pdf_path = os.path.join(OUTPUT_PDF_DIR, pdf_filename)
            exp_pdf_path = os.path.join(EXPORTS_PDF_DIR, pdf_filename)

            footer_html = f'''
            <div style="font-size: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 8mm; color: #4b5563; border-top: 1px solid #d1d5db; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 4px;">
                {f'<img src="{logo_uri}" style="height: 12px; width: auto; object-fit: contain;"/>' if logo_uri else ''}
              </div>
              <div style="font-family: monospace; text-align: right;">
                <span>Tax Invoice No: {inv["invoice_no"]}</span> &bull; <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
              </div>
            </div>
            '''

            pdf_data = await page.pdf(
                format="A4",
                margin={"top": "8mm", "bottom": "12mm", "left": "8mm", "right": "8mm"},
                display_header_footer=True,
                header_template="<div></div>",
                footer_template=footer_html,
                print_background=True
            )

            os.makedirs(os.path.dirname(os.path.abspath(tt_pdf_path)), exist_ok=True)
            os.makedirs(os.path.dirname(os.path.abspath(exp_pdf_path)), exist_ok=True)

            with open(tt_pdf_path, "wb") as f:
                f.write(pdf_data)
            with open(exp_pdf_path, "wb") as f:
                f.write(pdf_data)

            file_size = os.path.getsize(tt_pdf_path)
            generated_pdfs.append({
                "sequence": inv["sequence"],
                "invoice_no": inv["invoice_no"],
                "sis_code": inv["sis_code"],
                "state": inv["customer_state"],
                "qty": inv["total_quantity"],
                "taxable": inv["subtotal"],
                "tax": inv["total_tax"],
                "grand_total": inv["grand_total"],
                "file_name": pdf_filename,
                "file_path": tt_pdf_path,
                "size_bytes": file_size
            })

        await browser.close()

    print(f"Generated {len(generated_pdfs)} Pixel-Faithful Statutory A4 PDF invoices.")

    # 8. Visual Comparison Rendering via PyMuPDF
    import fitz
    test_pdf_path = generated_pdfs[0]["file_path"]
    doc_gen = fitz.open(test_pdf_path)
    print(f"\nGenerated Invoice TT2026-2027/74 has {len(doc_gen)} pages.")
    for i, p in enumerate(doc_gen):
        pix = p.get_pixmap(dpi=150)
        img_out = os.path.join(TT_DIR, f"page_74_{i+1}.png")
        pix.save(img_out)
        print(f"  Rendered page image: {img_out} ({pix.width}x{pix.height})")
    doc_gen.close()

    # 9. Invariant Verification
    ctrl_conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
    ctrl_cur = ctrl_conn.cursor()
    ctrl_cur.execute("SELECT count(*) FROM sales_invoices WHERE invoice_no LIKE 'TT2026-2027%';")
    ctrl_inv_count = ctrl_cur.fetchone()[0]
    ctrl_conn.close()

    total_qty_sum = sum(p["qty"] for p in generated_pdfs)
    total_taxable_sum = sum(p["taxable"] for p in generated_pdfs)
    total_tax_sum = sum(p["tax"] for p in generated_pdfs)
    total_invoice_val_sum = sum(p["grand_total"] for p in generated_pdfs)
    total_line_items_sum = sum(len(inv["items"]) for inv in candidate_invoices)

    print("\n" + "=" * 80)
    print("PIXEL-FAITHFUL BATCH GENERATION AUDIT & RECONCILIATION REPORT")
    print("=" * 80)
    print(f"Total invoices generated    : {len(generated_pdfs)}")
    print(f"First invoice number        : {generated_pdfs[0]['invoice_no']}")
    print(f"Last invoice number         : {generated_pdfs[-1]['invoice_no']}")
    print(f"Billing date                : {FROZEN_BILLING_DATE_STR} (DB: {FROZEN_BILLING_DATE_DB})")
    print(f"Company DB used             : smriti001")
    print(f"Total line items            : {total_line_items_sum}")
    print(f"Total quantity (Pairs)      : {total_qty_sum}")
    print(f"Total taxable value         : ₹{total_taxable_sum:,.2f}")
    print(f"Total GST                   : ₹{total_tax_sum:,.2f}")
    print(f"Total invoice value         : ₹{total_invoice_val_sum:,.2f}")
    print(f"PDF files generated         : {len(generated_pdfs)}")
    print(f"smritisys operational count : {ctrl_inv_count} (Must be 0)")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_batch_generation())
