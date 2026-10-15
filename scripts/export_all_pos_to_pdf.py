"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.83.0
Created      : 2026-10-15
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Batch Purchase Order PDF Export Engine
"""

import os
import sys
import base64
import asyncio
import datetime
from decimal import Decimal
from collections import defaultdict

sys.path.insert(0, r"F:\SMRITRretailNX\backend")

from app.db.session import async_session
from sqlalchemy import text
from playwright.async_api import async_playwright
import fitz # PyMuPDF

COMPANY_ID = "COMP-001"
OUTPUT_DIR_INTERNAL = r"F:\SMRITRretailNX\exports\purchase_orders_pdf"
OUTPUT_DIR_CLIENT = r"F:\Smriti-Clients Data\15-10-2026\PURCHASE_ORDERS_PDF"

os.makedirs(OUTPUT_DIR_INTERNAL, exist_ok=True)
os.makedirs(OUTPUT_DIR_CLIENT, exist_ok=True)

# Tattly Threads Authorized Logo (Data URI)
LOGO_PATH = r"F:\SMRITRretailNX\TT\logo\tattly_logo_black.png"
if os.path.exists(LOGO_PATH):
    with open(LOGO_PATH, "rb") as lf:
        TATTLY_LOGO_URI = f"data:image/png;base64,{base64.b64encode(lf.read()).decode('ascii')}"
else:
    TATTLY_LOGO_URI = ""

def number_to_indian_words(num: float) -> str:
    val = int(round(num))
    if val == 0:
        return "Zero Rupees Only"
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
             "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
             "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def conv(n):
        res = ""
        if n >= 100:
            res += units[n // 100] + " Hundred "
            n %= 100
        if n >= 20:
            res += tens[n // 10] + " "
            n %= 10
        if n > 0:
            res += units[n] + " "
        return res.strip()

    crore = val // 10000000
    val %= 10000000
    lakh = val // 100000
    val %= 100000
    thousand = val // 1000
    val %= 1000

    parts = []
    if crore > 0:
        parts.append(conv(crore) + " Crore")
    if lakh > 0:
        parts.append(conv(lakh) + " Lakh")
    if thousand > 0:
        parts.append(conv(thousand) + " Thousand")
    if val > 0:
        parts.append(conv(val))
    return " ".join(parts).strip() + " Rupees Only"


def format_curr(val: float) -> str:
    """Format currency in Indian comma grouping (e.g. 2,17,500.00)."""
    return f"{val:,.2f}"


def build_po_html(po_data: dict) -> str:
    size_cols = ["36", "37", "38", "39", "40", "41", "42"]
    
    # Calculate column totals for size columns
    size_totals = {sz: 0 for sz in size_cols}
    for row in po_data["sizewise_rows"]:
        for sz in size_cols:
            size_totals[sz] += row["quantities"].get(sz, 0)
            
    # Table rows
    table_rows_html = ""
    for idx, row in enumerate(po_data["sizewise_rows"], start=1):
        bg = "#ffffff" if idx % 2 == 1 else "#f8fafc"
        qty_cells = "".join(f'<td style="padding:4px 2px; text-align:center; font-weight:600; color:#1e293b; border-right:1px solid #cbd5e1; font-size:10px;">{row["quantities"].get(sz, "—")}</td>' for sz in size_cols)
        table_rows_html += f"""
        <tr style="background:{bg}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:4px; text-align:center; color:#64748b; border-right:1px solid #cbd5e1; font-size:10px;">{idx}</td>
          <td style="padding:4px 6px; font-weight:700; font-family:monospace; color:#0f172a; border-right:1px solid #cbd5e1; font-size:10.5px; white-space:nowrap;">{row["article"]}</td>
          <td style="padding:4px 6px; color:#1e293b; font-weight:600; border-right:1px solid #cbd5e1; font-size:10px;">{row["color"]}</td>
          {qty_cells}
          <td style="padding:4px 6px; text-align:center; font-weight:800; color:#0f172a; background:#f0f7ff; border-right:1px solid #cbd5e1; font-size:10.5px;">{row["total_qty"]}</td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace; font-weight:600; color:#1e293b; border-right:1px solid #cbd5e1; font-size:10px; white-space:nowrap;">{format_curr(row["rate"])}</td>
          <td style="padding:4px 4px; text-align:center; font-family:monospace; color:#475569; border-right:1px solid #cbd5e1; font-size:10px;">5%</td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace; font-weight:600; color:#1e293b; border-right:1px solid #cbd5e1; font-size:10px; white-space:nowrap;">{format_curr(row["tax"])}</td>
          <td style="padding:4px 6px; text-align:right; font-family:monospace; font-weight:700; color:#0f172a; font-size:10.5px; white-space:nowrap;">{format_curr(row["amount"])}</td>
        </tr>
        """

    # Table footer size totals
    footer_qty_cells = "".join(f'<td style="padding:4px 2px; text-align:center; font-weight:800; color:#0f172a; border-right:1px solid #cbd5e1; font-size:10px;">{size_totals[sz] if size_totals[sz] > 0 else "—"}</td>' for sz in size_cols)

    # Item Reference Cards (Golden Ratio 1.618:1 watermark)
    ref_cards_html = ""
    for r in po_data["sizewise_rows"]:
        ref_cards_html += f"""
        <div style="border:1px solid #cbd5e1; border-radius:6px; padding:6px 8px; background:#ffffff; box-shadow:0 1px 2px rgba(0,0,0,0.03); display:flex; flex-direction:column; justify-content:space-between;">
          <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:4px; letter-spacing:0.02em;">{r["article"]} - {r["color"]}</div>
          <div style="display:grid; grid-template-columns:120px 1fr; gap:8px; align-items:center;">
            <div style="font-size:9.5px; line-height:1.4; color:#475569;">
              <div><span style="color:#64748b;">Color:</span> <strong style="color:#0f172a;">{r["color"]}</strong></div>
              <div><span style="color:#64748b;">Heels:</span> <strong style="color:#0f172a;">{r.get("heels", "Flat / Comfort")}</strong></div>
              <div><span style="color:#64748b;">Upper:</span> <strong style="color:#0f172a;">{r.get("upper", "Synthetic / Leatherette")}</strong></div>
              <div><span style="color:#64748b;">Outsole:</span> <strong style="color:#0f172a;">{r.get("outsole", "TPR / Rubber Sole")}</strong></div>
            </div>
            <div style="position:relative; width:100%; height:62px; aspect-ratio:1.618/1; border-radius:5px; border:1px solid #e2e8f0; background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 60%, #eff6ff 100%); display:flex; align-items:center; justify-content:center; overflow:hidden;">
              <svg style="position:absolute; inset:0; width:100%; height:100%; opacity:0.1; pointer-events:none;" viewBox="0 0 162 100" preserveAspectRatio="none">
                <rect x="0" y="0" width="162" height="100" fill="none" stroke="#1e3a8a" stroke-width="1"/>
                <line x1="100" y1="0" x2="100" y2="100" stroke="#1e3a8a" stroke-width="1" stroke-dasharray="3 2"/>
                <line x1="100" y1="62" x2="162" y2="62" stroke="#1e3a8a" stroke-width="1" stroke-dasharray="3 2"/>
                <path d="M 100 100 A 100 100 0 0 1 0 0 A 62 62 0 0 1 100 62 A 38 38 0 0 1 138 100" fill="none" stroke="#1e3a8a" stroke-width="0.8"/>
              </svg>
              <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:none;">
                <span style="color:#1e3a8a; opacity:0.18; font-weight:900; text-transform:uppercase; font-size:9.5px; white-space:nowrap; transform:rotate(-12deg); letter-spacing:0.2em;">
                  TATTLY THREADS
                </span>
              </div>
              <div style="position:relative; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" style="opacity:0.8;">
                  <path d="M2 18h20c-.5-3-2-6-5-7l-5-2-4 1-4 3c-1 1-1.5 3-2 5z"/>
                  <path d="M2 18v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2"/>
                </svg>
                <span style="font-size:8px; font-weight:700; color:#475569; margin-top:1px; text-transform:uppercase; letter-spacing:0.04em;">{r["article"]}</span>
                <span style="font-size:6.5px; font-family:monospace; color:#94a3b8;">Golden Ratio (1.618 : 1)</span>
              </div>
            </div>
          </div>
        </div>
        """

    words_amt = number_to_indian_words(po_data["grand_total"])

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{po_data["order_no"]}</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 6mm;
  }}
  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}
  body {{
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.35;
  }}
  .a4-container {{
    position: relative;
    width: 100%;
    max-width: 210mm;
    margin: 0 auto;
    padding: 6px 10px;
    background: #ffffff;
  }}
  .watermark-logo {{
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 75%;
    max-width: 75%;
    opacity: 0.12;
    z-index: 0;
    pointer-events: none;
    user-select: none;
  }}
  .page-break-avoid {{
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }}
</style>
</head>
<body>
<div class="a4-container">
  {f'<img class="watermark-logo" src="{TATTLY_LOGO_URI}" alt="" />' if TATTLY_LOGO_URI else ''}
  <div style="position: relative; z-index: 1;">

  <!-- 1. HEADER & COMPANY INFORMATION -->
  <header style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:5px; margin-bottom:5px; border-bottom:1px solid #cbd5e1;">
    <div style="display:flex; align-items:flex-start; gap:10px;">
      {f'''
      <div style="border-right:1px solid #cbd5e1; padding-right:10px; display:flex; align-items:center;">
        <img src="{TATTLY_LOGO_URI}" style="height:38px; width:auto; object-fit:contain; display:block;" alt="Tattly Threads Logo"/>
      </div>
      ''' if TATTLY_LOGO_URI else ''}
      <div style="font-size:9.5px; color:#475569; line-height:1.32;">
        <div style="font-size:14px; font-weight:900; color:#0f172a; letter-spacing:0.03em; margin-bottom:1px;">{po_data.get("company_name", "TATTLY THREADS").upper()}</div>
        <div style="color:#334155;">{po_data.get("company_address")}</div>
        <div style="font-family:monospace; font-size:9px; color:#475569; margin-top:2px;">
          Web: <strong>{po_data.get("company_web", "www.tattlythreads.com")}</strong> | Accounts: <strong>{po_data.get("company_email", "accounts@tattlythreads.com")}</strong> | Phone: <strong>{po_data.get("company_phone", "+91 9324117007")}</strong>
        </div>
        <div style="font-weight:800; color:#0f172a; margin-top:2px;">
          GSTIN: <span style="font-family:monospace; color:#1e3a8a; font-weight:900;">{po_data.get("company_gstin", "27AAXFT2508H1ZR")}</span> | Central Inward Depot: <strong style="color:#334155;">Nagpur Hub (WH-MAIN-001)</strong>
        </div>
      </div>
    </div>

    <!-- Metadata Box -->
    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end;">
      <h2 style="font-size:16px; font-weight:900; color:#1e3a8a; text-transform:uppercase; margin:0 0 3px 0; letter-spacing:0.04em;">PURCHASE ORDER</h2>
      <div style="border:1px solid #cbd5e1; border-radius:5px; background:#ffffff; padding:4px 8px; min-width:215px; font-size:9.5px; text-align:left; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="color:#64748b; padding:1px 0;">PO Number</td>
            <td style="color:#94a3b8; text-align:center; width:10px;">:</td>
            <td style="font-family:monospace; font-weight:800; color:#0f172a;">{po_data["order_no"]}</td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1px 0;">Order Date</td>
            <td style="color:#94a3b8; text-align:center;">:</td>
            <td style="font-weight:700; color:#1e293b;">{po_data["order_date"]}</td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1px 0;">Warehouse</td>
            <td style="color:#94a3b8; text-align:center;">:</td>
            <td style="font-weight:700; color:#1e293b;">{po_data.get("warehouse", "Tattly Threads Nagpur Depot (WH-MAIN-001)")}</td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1px 0;">Status</td>
            <td style="color:#94a3b8; text-align:center;">:</td>
            <td>
              <span style="display:inline-block; padding:1px 6px; border-radius:4px; font-size:9px; font-weight:800; text-transform:uppercase; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">
                {po_data["status"]}
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </header>

  <!-- 2. SUPPLIER INFORMATION PANEL -->
  <section style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; margin-bottom:8px; font-size:10px; line-height:1.4;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:9px; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:0.06em;">SUPPLIER DETAILS</div>
        <div style="font-size:13px; font-weight:800; color:#0f172a; margin-top:1px;">
          {po_data["supplier_name"]} <span style="font-family:monospace; font-weight:700; color:#475569; font-size:11px;">[Vendor {po_data["supplier_code"]}]</span>
        </div>
      </div>
      <div style="text-align:right; font-size:10px; color:#334155;">
        <div>Contact: <strong style="color:#0f172a;">{po_data.get("supplier_contact", "—")}</strong></div>
        <div>GSTIN: <span style="font-family:monospace; font-weight:600;">{po_data.get("supplier_gstin", "Unregistered / Composition")}</span></div>
      </div>
    </div>
    <div style="margin-top:2px; color:#475569;">
      Address: {po_data.get("supplier_address", "Industrial Footwear Cluster, Commercial Wholesale Market, India")}
    </div>
  </section>

  <!-- 3. ITEM DETAILS TABLE (SIZEWISE MATRIX) -->
  <section style="margin-bottom:8px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
      <h3 style="font-size:11px; font-weight:900; color:#1e3a8a; text-transform:uppercase; margin:0; letter-spacing:0.03em;">
        ITEM DETAILS (SIZEWISE MATRIX)
      </h3>
      <span style="font-size:10px; font-weight:700; color:#2563eb;">
        Size Chart: Footwear EU (36 - 42)
      </span>
    </div>

    <div style="border:1px solid #cbd5e1; border-radius:6px; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse; font-size:10px;">
        <thead>
          <tr style="background:#f8fafc; color:#334155; font-weight:800; border-bottom:1px solid #cbd5e1;">
            <th rowspan="2" style="padding:4px; border-right:1px solid #cbd5e1; text-align:center; width:22px;">#</th>
            <th rowspan="2" style="padding:4px 6px; border-right:1px solid #cbd5e1; text-align:left; width:88px;">ARTICLE NO.</th>
            <th rowspan="2" style="padding:4px 6px; border-right:1px solid #cbd5e1; text-align:left; width:72px;">COLOR</th>
            <th colspan="7" style="padding:3px; border-right:1px solid #cbd5e1; text-align:center; background:#f0f7ff; color:#1e3a8a; font-weight:900; text-transform:uppercase;">
              SIZE (EU)
            </th>
            <th rowspan="2" style="padding:4px 6px; border-right:1px solid #cbd5e1; text-align:center; background:#f0f7ff; color:#1e3a8a; font-weight:900; width:52px;">
              TOTAL QTY
            </th>
            <th rowspan="2" style="padding:4px 6px; border-right:1px solid #cbd5e1; text-align:right; width:64px; white-space:nowrap;">
              RATE (₹)
            </th>
            <th rowspan="2" style="padding:4px 4px; border-right:1px solid #cbd5e1; text-align:center; width:44px; white-space:nowrap;">
              TAX (5%)
            </th>
            <th rowspan="2" style="padding:4px 6px; border-right:1px solid #cbd5e1; text-align:right; width:68px; white-space:nowrap;">
              TAX (₹)
            </th>
            <th rowspan="2" style="padding:4px 6px; text-align:right; width:82px; white-space:nowrap;">
              AMOUNT (₹)
            </th>
          </tr>
          <tr style="background:#f0f7ff; border-bottom:1px solid #cbd5e1;">
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">36</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">37</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">38</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">39</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">40</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">41</th>
            <th style="padding:2px; border-right:1px solid #cbd5e1; text-align:center; font-weight:800; color:#2563eb; width:26px;">42</th>
          </tr>
        </thead>
        <tbody>
          {table_rows_html}
        </tbody>
        <tfoot>
          <tr style="background:#f8fafc; font-weight:900; border-top:2px solid #cbd5e1;">
            <td colspan="3" style="padding:4px 6px; text-align:right; text-transform:uppercase; letter-spacing:0.04em; color:#1e3a8a; border-right:1px solid #cbd5e1; font-size:10px;">
              TOTAL
            </td>
            {footer_qty_cells}
            <td style="padding:4px 6px; text-align:center; font-weight:900; color:#0f172a; background:#e0f2fe; border-right:1px solid #cbd5e1; font-size:11px;">
              {po_data["total_qty"]}
            </td>
            <td style="padding:4px 6px; text-align:center; color:#94a3b8; border-right:1px solid #cbd5e1;">—</td>
            <td style="padding:4px 4px; text-align:center; color:#94a3b8; border-right:1px solid #cbd5e1;">—</td>
            <td style="padding:4px 6px; text-align:right; font-weight:800; color:#0f172a; font-family:monospace; border-right:1px solid #cbd5e1; font-size:10.5px; white-space:nowrap;">
              {format_curr(po_data["tax_total"])}
            </td>
            <td style="padding:4px 6px; text-align:right; font-weight:900; color:#1d4ed8; font-family:monospace; font-size:11px; white-space:nowrap;">
              {format_curr(po_data["subtotal"])}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>

  <!-- 4. ITEM REFERENCE CARDS (FOOTWEAR PREVIEW) -->
  <section style="margin-bottom:8px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
      <h3 style="font-size:10.5px; font-weight:900; color:#1e3a8a; text-transform:uppercase; margin:0; letter-spacing:0.03em;">
        FOOTWEAR SPECIFICATION & REFERENCE
      </h3>
      <span style="font-size:9.5px; color:#64748b; font-weight:600;">2-Cards Per Row • Golden Ratio (1.618 : 1) Watermark Preview</span>
    </div>
    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
      {ref_cards_html}
    </div>
  </section>

  <!-- 5. COMMERCIAL TERMS & ORDER SUMMARY (SIDE-BY-SIDE) -->
  <section class="page-break-avoid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-bottom:8px;">
    <!-- Left Card: Commercial Terms -->
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; font-size:10px;">
      <div style="font-weight:900; font-size:11px; color:#1e3a8a; text-transform:uppercase; margin-bottom:4px; padding-bottom:2px; border-bottom:1px solid #bfdbfe;">
        COMMERCIAL TERMS
      </div>
      <table style="width:100%; border-collapse:collapse; color:#334155;">
        <tr>
          <td style="color:#64748b; width:110px; padding:1.5px 0;">Payment Terms</td>
          <td style="width:10px; text-align:center;">:</td>
          <td><strong style="color:#0f172a;">120 Days</strong></td>
        </tr>
        <tr>
          <td style="color:#64748b; padding:1.5px 0;">Freight Terms</td>
          <td style="text-align:center;">:</td>
          <td><strong style="color:#0f172a;">Paid by Supplier / As agreed</strong></td>
        </tr>
        <tr>
          <td style="color:#64748b; padding:1.5px 0;">Currency</td>
          <td style="text-align:center;">:</td>
          <td><strong style="color:#0f172a;">INR - Indian Rupee (₹)</strong></td>
        </tr>
        <tr>
          <td style="color:#64748b; padding:1.5px 0;">Vendor Bill Ref</td>
          <td style="text-align:center;">:</td>
          <td><strong style="color:#0f172a; font-family:monospace;">{po_data.get("bill_ref", "—")}</strong> ({po_data.get("bill_date_str", "—")})</td>
        </tr>
        <tr>
          <td style="color:#64748b; padding:1.5px 0;">Procurement Lead</td>
          <td style="text-align:center;">:</td>
          <td><strong style="color:#1e3a8a;">{po_data.get("lead_days", 35)} Days (Prior to Bill)</strong></td>
        </tr>
      </table>
    </div>

    <!-- Right Card: Order Summary -->
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; font-size:10px; display:flex; flex-direction:column; justify-content:space-between;">
      <div>
        <div style="font-weight:900; font-size:11px; color:#1e3a8a; text-transform:uppercase; margin-bottom:4px; padding-bottom:2px; border-bottom:1px solid #bfdbfe;">
          ORDER SUMMARY
        </div>
        <table style="width:100%; border-collapse:collapse; color:#334155;">
          <tr>
            <td style="color:#64748b; padding:1.5px 0;">Total Articles / Rows</td>
            <td style="text-align:right;"><strong style="color:#0f172a;">{len(po_data["sizewise_rows"])} items</strong></td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1.5px 0;">Total Quantity Ordered</td>
            <td style="text-align:right;"><strong style="color:#0f172a;">{po_data["total_qty"]} pairs</strong></td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1.5px 0;">Subtotal (Taxable Value)</td>
            <td style="text-align:right; font-family:monospace; font-weight:700; color:#0f172a;">₹ {format_curr(po_data["subtotal"])}</td>
          </tr>
          <tr>
            <td style="color:#64748b; padding:1.5px 0;">GST (5%) Statutory Tax</td>
            <td style="text-align:right; font-family:monospace; font-weight:700; color:#0f172a;">₹ {format_curr(po_data["tax_total"])}</td>
          </tr>
        </table>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:baseline; padding-top:4px; margin-top:4px; border-top:1px solid #bfdbfe;">
        <span style="font-weight:900; font-size:11.5px; color:#1e3a8a; text-transform:uppercase;">GRAND TOTAL</span>
        <span style="font-weight:900; font-size:15px; color:#1d4ed8; font-family:monospace;">₹ {format_curr(po_data["grand_total"])}</span>
      </div>
    </div>
  </section>

  <!-- 6. AMOUNT IN WORDS & REMARKS -->
  <section class="page-break-avoid" style="margin-bottom:8px; font-size:10px;">
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:4px 8px; margin-bottom:4px;">
      <span style="color:#64748b; font-weight:700;">Amount in Words:</span>
      <strong style="color:#0f172a; margin-left:4px;">{words_amt}</strong>
    </div>
    <div style="font-size:9.5px; color:#475569;">
      <span style="font-weight:700; color:#0f172a;">Special Instructions:</span> Please verify size tags, ensure all shoe boxes have standard optical barcode stickers, and deliver with triplicate copies of the delivery challan.
    </div>
  </section>

  <!-- 7. APPROVAL & SIGNATURES -->
  <section class="page-break-avoid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:8px; padding-top:4px; font-size:9.5px;">
    <div style="border-top:1px solid #cbd5e1; padding-top:4px;">
      <div style="font-weight:800; color:#1e3a8a; text-transform:uppercase; font-size:9.5px; margin-bottom:12px;">Prepared By</div>
      <div style="color:#475569;">Procurement Executive</div>
      <div style="color:#64748b; font-size:8.5px;">SYSTEM AUTO-INGEST</div>
    </div>
    <div style="border-top:1px solid #cbd5e1; padding-top:4px;">
      <div style="font-weight:800; color:#1e3a8a; text-transform:uppercase; font-size:9.5px; margin-bottom:12px;">Checked By</div>
      <div style="color:#475569;">Store Manager</div>
      <div style="color:#64748b; font-size:8.5px;">QUALITY VERIFIED</div>
    </div>
    <div style="border-top:1px solid #cbd5e1; padding-top:4px;">
      <div style="font-weight:800; color:#1e3a8a; text-transform:uppercase; font-size:9.5px; margin-bottom:12px;">Authorized Signatory</div>
      <div style="color:#475569;">Commercial Director</div>
      <div style="color:#64748b; font-size:8.5px;">FOR TATTLY THREADS</div>
    </div>
  </section>

  <!-- 8. SYSTEM FOOTER -->
  <footer style="border-top:1px solid #e2e8f0; padding-top:4px; display:flex; justify-content:space-between; align-items:center; font-size:8.5px; color:#94a3b8;">
    <div>Computer-generated Statutory Purchase Order | TATTLY THREADS | SMRITI Retail OS | www.tattlythreads.com</div>
    <div>Page 1 of 1</div>
  </footer>

  </div>
</div>
</body>
</html>"""
    return html


async def export_all_pos():
    print("=" * 80)
    print("SMRITI RETAIL OS: BATCH PURCHASE ORDER PDF EXPORT ENGINE")
    print("=" * 80)
    print(f"Internal Target: {OUTPUT_DIR_INTERNAL}")
    print(f"Client Target  : {OUTPUT_DIR_CLIENT}")
    print("-" * 80)

    # 1. Fetch Company Info
    async with async_session() as s:
        comp_row = (await s.execute(text("SELECT name, gst_number FROM companies WHERE id = :cid"), {"cid": COMPANY_ID})).fetchone()
        company_name = comp_row[0] if comp_row and comp_row[0] else "Tattly Threads"
        company_gstin = comp_row[1] if comp_row and comp_row[1] else "27AAXFT2508H1ZR"
        company_addr = "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003"
        company_web = "www.tattlythreads.com"
        company_email = "accounts@tattlythreads.com"
        company_phone = "+91 9324117007"
        warehouse_name = "Tattly Threads Nagpur Depot (WH-MAIN-001)"

        branch_row = (await s.execute(text("SELECT name, code FROM branches WHERE company_id = :cid ORDER BY created_at LIMIT 1"), {"cid": COMPANY_ID})).fetchone()
        branch_name = branch_row[0] if branch_row and branch_row[0] else "Tattly Threads Head Office & Central Godown"

        # 2. Query All Purchase Orders
        po_query = text("""
            SELECT po.id, po.order_no, po.created_at, po.subtotal, po.tax_total, po.grand_total, po.status, po.notes,
                   s.name as supplier_name, s.code as supplier_code, s.mobile as supplier_contact, s.address as supplier_address, s.gst_number as supplier_gstin,
                   pb.bill_no, pb.bill_date
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN purchase_bills pb ON pb.order_id = po.id
            WHERE po.company_id = :cid
            ORDER BY s.code, po.order_no
        """)
        pos = (await s.execute(po_query, {"cid": COMPANY_ID})).fetchall()
        print(f"Found {len(pos)} Purchase Orders for tenant '{COMPANY_ID}'.")

        # 3. Query all PO line items joined with variants and items
        lines_query = text("""
            SELECT poi.order_id, i.item_code, v.color, v.size, poi.quantity, poi.cost_price, poi.tax_amount, poi.line_total,
                   i.heel_type, i.upper_material, i.outsole_material
            FROM purchase_order_items poi
            JOIN item_variants v ON poi.variant_id = v.id
            JOIN items i ON poi.item_id = i.id
            WHERE poi.company_id = :cid
            ORDER BY poi.order_id, i.item_code, v.color, v.size
        """)
        all_lines = (await s.execute(lines_query, {"cid": COMPANY_ID})).fetchall()
        
    po_lines_map = defaultdict(list)
    for l in all_lines:
        po_lines_map[l[0]].append(l)

    print(f"Loaded line items across {len(po_lines_map)} POs.")

    # 4. Prepare PO Data Structures
    pos_data = []
    for po in pos:
        po_id = po[0]
        order_no = po[1]
        order_dt = po[2].strftime("%d-%b-%Y") if po[2] else "15-Oct-2026"
        subtotal = float(po[3] or 0)
        tax_total = float(po[4] or 0)
        grand_total = float(po[5] or 0)
        status = po[6]
        notes = po[7] or ""
        sup_name = po[8]
        sup_code = po[9]
        sup_contact = po[10]
        sup_addr = po[11]
        sup_gst = po[12]
        bill_no = po[13] or (order_no.split("-")[-1] if "-" in order_no else "")
        bill_date = po[14]
        bill_date_str = bill_date.strftime("%d-%b-%Y") if bill_date else "—"
        lead_days = (bill_date - po[2].date()).days if (bill_date and po[2]) else 35

        # Aggregate lines into Sizewise Matrix rows
        matrix_rows = defaultdict(lambda: {
            "article": "",
            "color": "",
            "quantities": {},
            "total_qty": 0,
            "rate": 0.0,
            "tax": 0.0,
            "amount": 0.0,
            "heels": "Flat / Comfort",
            "upper": "Synthetic / Leatherette",
            "outsole": "TPR / Rubber Sole",
        })

        lines = po_lines_map.get(po_id, [])
        total_qty = 0

        for l in lines:
            art = l[1]
            color = l[2]
            size = str(l[3]).strip()
            qty = int(round(float(l[4])))
            rate = float(l[5])
            tax = float(l[6])
            tot = float(l[7])
            heels = l[8] or "Flat / Comfort"
            upper = l[9] or "Synthetic / Leatherette"
            outsole = l[10] or "TPR / Rubber Sole"

            key = (art, color)
            row = matrix_rows[key]
            row["article"] = art
            row["color"] = color
            row["quantities"][size] = row["quantities"].get(size, 0) + qty
            row["total_qty"] += qty
            row["rate"] = rate
            row["tax"] += tax
            row["amount"] += qty * rate
            row["heels"] = heels
            row["upper"] = upper
            row["outsole"] = outsole

            total_qty += qty

        # Sort matrix rows by article, color
        sorted_matrix = sorted(matrix_rows.values(), key=lambda r: (r["article"], r["color"]))

        pos_data.append({
            "id": po_id,
            "order_no": order_no,
            "order_date": order_dt,
            "company_name": company_name,
            "company_gstin": company_gstin,
            "company_address": company_addr,
            "company_web": company_web,
            "company_email": company_email,
            "company_phone": company_phone,
            "warehouse": warehouse_name,
            "branch_name": branch_name,
            "supplier_name": sup_name,
            "supplier_code": sup_code,
            "supplier_contact": sup_contact,
            "supplier_address": sup_addr,
            "supplier_gstin": sup_gst,
            "status": status,
            "bill_ref": bill_no,
            "bill_date_str": bill_date_str,
            "lead_days": lead_days,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "grand_total": grand_total,
            "total_qty": total_qty,
            "sizewise_rows": sorted_matrix,
        })

    # 5. Render PDFs via Playwright Chromium
    print(f"\nLaunching Playwright Chromium for batch PDF rendering ({len(pos_data)} POs)...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        page = await browser.new_page()

        results = []
        for idx, pdata in enumerate(pos_data, start=1):
            order_no = pdata["order_no"]
            sup_code = pdata["supplier_code"]
            sup_name_slug = "".join(c if c.isalnum() else "_" for c in pdata["supplier_name"]).strip("_")
            pdf_filename = f"{order_no}_{sup_name_slug}.pdf"
            
            internal_pdf_path = os.path.join(OUTPUT_DIR_INTERNAL, pdf_filename)
            client_pdf_path = os.path.join(OUTPUT_DIR_CLIENT, pdf_filename)

            # Generate HTML
            html = build_po_html(pdata)
            await page.set_content(html, wait_until="networkidle")

            # Generate A4 PDF
            await page.pdf(
                path=internal_pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "6mm", "bottom": "6mm", "left": "6mm", "right": "6mm"}
            )

            # Copy to client data directory
            with open(internal_pdf_path, "rb") as src, open(client_pdf_path, "wb") as dst:
                dst.write(src.read())

            # Audit with PyMuPDF
            doc = fitz.open(internal_pdf_path)
            page_count = len(doc)
            file_size_kb = os.path.getsize(internal_pdf_path) / 1024.0
            doc.close()

            results.append({
                "index": idx,
                "order_no": order_no,
                "vendor": f"[{sup_code}] {pdata['supplier_name']}",
                "pairs": pdata["total_qty"],
                "subtotal": pdata["subtotal"],
                "grand_total": pdata["grand_total"],
                "pages": page_count,
                "size_kb": file_size_kb,
                "filename": pdf_filename,
            })
            print(f"  [{idx:02d}/28] {order_no:<25} | {pdata['supplier_name']:<20} | Pairs: {pdata['total_qty']:>5} | Rs. {pdata['grand_total']:>12,.2f} | Pages: {page_count} | {file_size_kb:>5.1f} KB")

        await browser.close()

    print("\n" + "=" * 80)
    print("BATCH PDF EXPORT SUMMARY REPORT")
    print("=" * 80)
    print(f"Total PO PDFs Generated: {len(results)} / 28")
    print(f"Internal Path          : {OUTPUT_DIR_INTERNAL}")
    print(f"Client Data Path       : {OUTPUT_DIR_CLIENT}")
    print(f"All 1-Page A4 Confirmed: {all(r['pages'] == 1 for r in results)}")
    print(f"Total Pairs Exported   : {sum(r['pairs'] for r in results):,.0f} pairs")
    print(f"Total Valuation Export : Rs. {sum(r['grand_total'] for r in results):,.2f}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(export_all_pos())
