"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.1
Created      : 2026-08-17
Modified     : 2026-08-17  (Font forensic constants added — Option A applied)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal / FROZEN IMMUTABLE SPECIFICATION

CANONICAL SPECIFICATION: SMRITITAXINVOICE (Version V1)
================================================================================
CRITICAL GOVERNANCE NOTICE:
This file defines the immutable, forensic physical and visual standard for
SMRITITAXINVOICE (A4 Statutory GST Tax Invoice).

ANY IN-PLACE MUTATION OF CSS TOKENS, COLUMN PERCENTAGES, ROW HEIGHTS, OR
MARGIN GEOMETRY IS PROHIBITED BY SMRITI ARCHITECTURE GOVERNANCE LAW.
================================================================================
"""

import hashlib
from typing import Dict, Any, Final

# Canonical Identifier Constants
SMRITITAXINVOICE_TEMPLATE_CODE: Final[str] = "SMRITITAXINVOICE"
SMRITITAXINVOICE_VERSION: Final[str] = "V1"
SMRITITAXINVOICE_STATUS: Final[str] = "FROZEN"
SMRITITAXINVOICE_IMMUTABLE: Final[bool] = True

# Physical Page Geometry (in PDF Points: 1 pt = 1/72 inch, 1 mm = 2.83465 pt)
SMRITI_A4_WIDTH_PT: Final[float] = 595.92
SMRITI_A4_HEIGHT_PT: Final[float] = 842.88
SMRITI_PAGE_MARGIN_LEFT_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_RIGHT_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_TOP_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_BOTTOM_PT: Final[float] = 28.35
SMRITI_CONTENT_WIDTH_PT: Final[float] = 550.55

# Item Row Heights
SMRITI_HEADER_ROW_HEIGHT_PT: Final[float] = 18.00
SMRITI_ITEM_ROW_HEIGHT_PT: Final[float] = 20.47
SMRITI_SUBTOTAL_ROW_HEIGHT_PT: Final[float] = 20.47

# ─────────────────────────────────────────────────────────────────────────────
# FORENSIC TYPOGRAPHIC CONSTANTS — sourced from PDF audit of original
# Tattly Threads master invoices (F:\SMRITRretailNX\TT\B)
# DO NOT ALTER — these are the immutable forensic standard. (AGENTS.md Rule 7)
# ─────────────────────────────────────────────────────────────────────────────
SMRITI_FONT_COMPANY_NAME_PT: Final[float] = 10.24    # Header company name
SMRITI_FONT_INVOICE_TITLE_PT: Final[float] = 11.70   # "TAX INVOICE" heading
SMRITI_FONT_CUSTOMER_NAME_PT: Final[float] = 8.77    # Billed-to / Shipped-to name
SMRITI_FONT_BODY_PT: Final[float] = 7.31             # Address, meta, GSTIN, table data
SMRITI_FONT_COL_HEADER_PT: Final[float] = 6.58       # Table column header row
SMRITI_FONT_SUBTOTAL_PT: Final[float] = 6.58         # Subtotal / total label rows
SMRITI_FONT_GRAND_TOTAL_PT: Final[float] = 8.77      # Grand total dark bar
SMRITI_FONT_FOOTER_PT: Final[float] = 6.00           # Page footer line
SMRITI_FONT_WATERMARK_PT: Final[float] = 72.00       # CANCELLED watermark

# Interstate (IGST) 10-Column Width Allocation (Sum = 100.0%)
SMRITI_INTERSTATE_COLUMNS: Final[Dict[str, str]] = {
    "sl_no": "3.5%",
    "item_description": "26.0%",
    "hsn_sac": "8.0%",
    "qty": "4.5%",
    "mrp": "8.0%",
    "discount_pct": "6.0%",
    "taxable_value": "11.0%",
    "tax_pct": "6.0%",
    "igst": "9.0%",
    "amount": "18.0%"
}

# Intrastate (CGST + SGST) 12-Column Width Allocation (Sum = 100.0%)
SMRITI_INTRASTATE_COLUMNS: Final[Dict[str, str]] = {
    "sl_no": "3.5%",
    "item_description": "23.5%",
    "hsn_sac": "7.5%",
    "qty": "4.0%",
    "mrp": "7.5%",
    "discount_pct": "5.0%",
    "taxable_value": "10.5%",
    "cgst_pct": "5.5%",
    "cgst": "8.5%",
    "sgst_pct": "5.5%",
    "sgst": "8.5%",
    "amount": "14.0%"
}

# Master Frozen CSS Tokens
SMRITITAXINVOICE_CSS_FROZEN: Final[str] = """
@page {
  size: A4 portrait;
  margin: 8mm 8mm 10mm 8mm;
}
* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 8.5px;
  line-height: 1.15;
  color: #000000;
  margin: 0;
  padding: 0;
  background: #ffffff;
}
.page-container {
  width: 100%;
  box-sizing: border-box;
  page-break-after: always;
  position: relative;
  min-height: 275mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.page-container:last-child {
  page-break-after: avoid;
}
.watermark-cancelled {
  position: absolute;
  top: 40%;
  left: 10%;
  width: 80%;
  text-align: center;
  font-size: 72px;
  font-weight: 900;
  color: rgba(220, 38, 38, 0.18);
  transform: rotate(-35deg);
  pointer-events: none;
  z-index: 1000;
  border: 8px solid rgba(220, 38, 38, 0.18);
  padding: 20px;
  text-transform: uppercase;
  letter-spacing: 12px;
}
.tax-invoice-header {
  border: 1px solid #000000;
  border-bottom: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  background: #f8fafc;
}
.tax-invoice-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.party-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid #000000;
  border-top: none;
  font-size: 8px;
}
.party-cell {
  padding: 3px 5px;
}
.party-cell:first-child {
  border-right: 1px solid #000000;
}
.party-title {
  font-weight: 700;
  text-decoration: underline;
  margin-bottom: 2px;
}
.item-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000000;
  border-top: none;
  table-layout: fixed;
  font-size: 8px;
}
.item-table th {
  background: #f1f5f9;
  border: 1px solid #000000;
  border-top: none;
  padding: 2px 2px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  height: 15px;
}
.item-table td {
  border-left: 1px solid #000000;
  border-right: 1px solid #000000;
  border-top: none;
  border-bottom: none;
  padding: 1px 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 11.25px;
}
.item-table tr.subtotal-row td {
  border-top: 1px solid #000000;
  border-bottom: 1px solid #000000;
  font-weight: 700;
  background: #f8fafc;
  height: 13.5px;
}
.summary-container {
  border: 1px solid #000000;
  border-top: none;
  display: grid;
  grid-template-columns: 1fr 200px;
}
.summary-left {
  border-right: 1px solid #000000;
  padding: 4px;
}
.summary-right {
  padding: 2px 4px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  padding: 1px 0;
}
.summary-line.grand-total {
  border-top: 1px solid #000000;
  font-weight: 800;
  font-size: 9.5px;
  padding-top: 2px;
  margin-top: 2px;
}
.gst-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 1px solid #000000;
  font-size: 7.5px;
  margin-top: 3px;
}
.gst-table th, .gst-table td {
  border: 1px solid #000000;
  padding: 1px 2px;
  text-align: right;
}
.gst-table th {
  background: #f8fafc;
  text-align: center;
}
.footer-bar {
  border: 1px solid #000000;
  border-top: none;
  padding: 2px 6px;
  font-size: 7.5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}
"""

def compute_spec_sha256() -> str:
    """Computes SHA256 integrity hash of the frozen specification."""
    content = f"{SMRITITAXINVOICE_TEMPLATE_CODE}|{SMRITITAXINVOICE_VERSION}|{SMRITI_A4_WIDTH_PT}|{SMRITI_A4_HEIGHT_PT}|{SMRITITAXINVOICE_CSS_FROZEN.strip()}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

SMRITITAXINVOICE_SHA256_INTEGRITY: Final[str] = compute_spec_sha256()

def verify_smrititaxinvoice_integrity() -> bool:
    """
    Integrity verification function.
    Returns True if the spec is untampered, raises AssertionError otherwise.
    """
    current_hash = compute_spec_sha256()
    if current_hash != SMRITITAXINVOICE_SHA256_INTEGRITY:
        raise RuntimeError(
            f"SMRITI-SECURITY-TAMPER: SMRITITAXINVOICE layout specification has been altered! "
            f"Expected SHA256: {SMRITITAXINVOICE_SHA256_INTEGRITY}, Computed: {current_hash}"
        )
    return True
