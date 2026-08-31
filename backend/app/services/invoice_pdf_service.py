"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.5
Created      : 2026-08-14
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import io
import re
import base64
import hashlib
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.tax_inv_template import (
    TaxInvoiceTemplate,
    TaxInvoiceTemplateVersion,
    InvoiceDocumentArtifact,
)
from .tax_invoice_spec import (
    SMRITITAXINVOICE_TEMPLATE_CODE,
    SMRITITAXINVOICE_VERSION,
    SMRITITAXINVOICE_STATUS,
    SMRITI_INTERSTATE_COLUMNS,
    SMRITI_INTRASTATE_COLUMNS,
    build_colgroup,
    load_golden_css,
    verify_smrititaxinvoice_integrity,
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

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
# Logo Asset Paths
TATTLY_LOGO_PATH = str(WORKSPACE_ROOT / "TT" / "logo" / "tattly_logo_black.png")


def number_to_indian_words(num: float) -> str:
    """
    Converts a numeric amount into Indian currency words format.
    Correctly handles:
    - Sub-rupee amounts (e.g. 0.50 -> "Zero Rupees and Fifty Paisa Only")
    - Singular Rupee (e.g. 1.00 -> "One Rupee Only", 1.50 -> "One Rupee and Fifty Paisa Only")
    - Plural Rupees (e.g. 2.00 -> "Two Rupees Only")
    - Standard Indian numbering: Thousands, Lakhs, Crores
    """
    try:
        abs_num = abs(float(num))
    except (ValueError, TypeError):
        return "Zero Rupees Only"

    if abs_num == 0:
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

    integer_part = int(abs_num)
    paisa_part = round((abs_num - integer_part) * 100)
    if paisa_part == 100:
        integer_part += 1
        paisa_part = 0

    if integer_part == 0 and paisa_part == 0:
        return "Zero Rupees Only"

    str_words = ""
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
    rupee_unit = "Rupee" if int(abs_num) == 1 else "Rupees"

    if trimmed_rupees:
        result = f"{trimmed_rupees} {rupee_unit}"
    else:
        result = "Zero Rupees"

    if paisa_part > 0:
        paisa_words = get_word_for_three_digits(paisa_part).strip()
        result += f" and {paisa_words} Paisa"

    result += " Only"
    return re.sub(r'\s{2,}', ' ', result).strip()


def generate_barcode_base64(val: str) -> str:
    """Generates Code128 Barcode as high-contrast base64 PNG data URI for crisp camera/scanner readability."""
    try:
        code = Code128(val, writer=ImageWriter())
        fp = io.BytesIO()
        code.write(fp, options={
            'write_text': False,
            'module_height': 14.0,
            'module_width': 0.35,
            'quiet_zone': 1.0
        })
        b64 = base64.b64encode(fp.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{b64}"
    except Exception:
        return ""


def generate_qr_base64(data_str: str) -> str:
    """Generates QR Code as high-density base64 PNG data URI (supports standard and IRP signed payloads)."""
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2
        )
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
# GST STATE DIRECTORY & PLACE OF SUPPLY FORMATTER
# ==============================================================================
GST_STATE_MAP: Dict[str, str] = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
    "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
    "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
    "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
    "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana",
    "37": "Andhra Pradesh", "38": "Ladakh"
}


def format_place_of_supply(raw_state: str, is_interstate: bool, customer_gstin: str = "", supplier_gstin: str = "27AAXFT2508H1ZR") -> str:
    """
    Dynamically formats Place of Supply strictly per SMRITI Governance:
      {STATE NAME} ({STATE CODE}) — {SUPPLY TYPE}
    Examples:
      Maharashtra (27) — Intra-State
      Assam (18) — Inter-State
      Delhi (07) — Inter-State
    """
    code = None
    name = None
    
    # 1. Prefer extraction from customer GSTIN (first 2 digits)
    if customer_gstin and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit() and customer_gstin[:2] in GST_STATE_MAP:
        code = customer_gstin[:2]
        name = GST_STATE_MAP[code]
    elif raw_state:
        # 2. Extract 2-digit code if already in raw state
        m = re.search(r'\(?(\d{2})\)?', str(raw_state))
        if m and m.group(1) in GST_STATE_MAP:
            code = m.group(1)
            name = GST_STATE_MAP[code]
        else:
            # 3. Match state name
            st_clean = str(raw_state).strip().lower()
            for c, n in GST_STATE_MAP.items():
                if n.lower() in st_clean or st_clean in n.lower():
                    code = c
                    name = n
                    break
                    
    if not code:
        code = "27" if not is_interstate else "07"
        name = GST_STATE_MAP.get(code, "Maharashtra")
        
    supply_type = "Inter-State" if is_interstate else "Intra-State"
    return f"{name} ({code}) — {supply_type}"


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
    "margins_mm": {"top": 8, "bottom": 10, "left": 8, "right": 8},
    "column_widths": {
        "interstate": SMRITI_INTERSTATE_COLUMNS,
        "intrastate": SMRITI_INTRASTATE_COLUMNS,
    },
    "grid_borders": {
        "table_border": "1px solid #d1d5db",
        "row_border_bottom": "1px solid #d1d5db",
        "column_border_right": "1px solid #d1d5db",
        "subtotal_border_top": "2px solid #9ca3af",
        "subtotal_border_bottom": "2px solid #9ca3af"
    },
    "zero_text_wrapping": True,
    "footer_disclaimer": "SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS"
}


def paginate_items(items: list, first_page_max: int = 20, cont_page_max: int = 34, last_page_room: int = 19) -> List[list]:
    """
    Paginate items cleanly for multi-page invoices matching original layout geometry.

    Authoritative geometry (measured from drawn lines in OLD PDFs):
      - Item row height: 21.00 pt CSS (~20.5pt rendered)
      - A4 body height: ~791 pt printable
      - Page 1 available (below header ~205pt): ~520 pt -> 21-22 items max
      - Continuation page available: ~730 pt -> 35-36 items
      - Last page: items + totals + summary; leave ~18 items max
    """
    total = len(items)
    if total == 0:
        return [[]]
    if total <= 15:
        return [items]
    if total <= first_page_max:
        # Fits on page 1, summaries flow to page 2 (clean 2-page geometry)
        return [items, []]

    pages = []
    p1_count = min(first_page_max, total)
    pages.append(items[:p1_count])
    remaining = items[p1_count:]

    while remaining:
        if len(remaining) <= last_page_room:
            pages.append(remaining)
            break
        elif len(remaining) <= cont_page_max:
            pages.append(remaining)
            pages.append([])
            break
        else:
            p_count = min(cont_page_max, len(remaining))
            pages.append(remaining[:p_count])
            remaining = remaining[p_count:]

    return pages


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
    def generate_invoice_html_from_model(
        cls,
        invoice: Any,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Renders pixel-faithful GST Tax Invoice HTML directly from an authoritative model or object.
        """
        is_interstate = getattr(invoice, "is_interstate", True)
        if is_interstate is None:
            is_interstate = True

        status_str = getattr(invoice, "status", "Draft") or "Draft"
        is_cancelled = str(status_str).upper() == "CANCELLED"

        meta = extra_meta or {}
        invoice_no = getattr(invoice, "invoice_no", None) or f"INV-{getattr(invoice, 'id', '001')}"
        
        date_obj = invoice.date
        if hasattr(date_obj, "strftime"):
            date_str = date_obj.strftime("%d-%m-%Y")
        else:
            date_str = str(date_obj) if date_obj else "12-08-2026"

        sis_code = getattr(invoice, "sis_code", None) or meta.get("sis_code", "")
        pos_state = getattr(invoice, "pos_state", None) or meta.get("pos_state", meta.get("place_of_supply", ""))
        po_reference = getattr(invoice, "po_reference", None) or meta.get("po_reference", meta.get("po_number", ""))
        eway_bill = invoice.eway_bill_no or meta.get("eway_bill_no", "")

        customer_name = getattr(invoice, "customer_name", None) or meta.get("customer_name", "Reliance Retail Limited")
        site_name = getattr(invoice, "site_name", None) or meta.get("site_name", customer_name)
        billing_addr = getattr(invoice, "billing_address", None) or meta.get("billing_address", meta.get("customer_address", ""))
        shipping_addr = getattr(invoice, "shipping_address", None) or meta.get("shipping_address", billing_addr)
        customer_gstin = getattr(invoice, "customer_gstin", None) or meta.get("customer_gstin", "")

        # Determine Supply Type dynamically from supplier GSTIN and Place of Supply / Customer GSTIN
        supplier_state_code = company_gstin[:2] if (company_gstin and len(company_gstin) >= 2 and company_gstin[:2].isdigit()) else "27"
        pos_code = None
        if customer_gstin and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit():
            pos_code = customer_gstin[:2]
        elif pos_state:
            m = re.search(r'\(?(\d{2})\)?', str(pos_state))
            if m:
                pos_code = m.group(1)
            else:
                for c, n in GST_STATE_MAP.items():
                    if n.lower() in str(pos_state).lower() or str(pos_state).lower() in n.lower():
                        pos_code = c
                        break
        if not pos_code:
            pos_code = "27"
            
        is_interstate = (pos_code != supplier_state_code)
        place_of_supply_display = format_place_of_supply(pos_state, is_interstate, customer_gstin, supplier_gstin=company_gstin)

        is_rcm = bool(getattr(invoice, "reverse_charge", False) or getattr(invoice, "is_reverse_charge", False) or meta.get("reverse_charge", False) or meta.get("is_reverse_charge", False))
        reverse_charge_display = "Yes" if is_rcm else "No"
        # Dynamic Bank Details: Prefer model fields -> meta overrides -> environment variables -> fallback
        bank_name = (
            getattr(invoice, "bank_name", None)
            or meta.get("bank_name")
            or os.getenv("DEFAULT_BANK_NAME", "STATE BANK OF INDIA")
        )
        account_no = (
            getattr(invoice, "account_no", None)
            or meta.get("bank_account_no")
            or meta.get("account_no")
            or os.getenv("DEFAULT_BANK_ACCOUNT_NO", "43976711765")
        )
        ifsc_code = (
            getattr(invoice, "ifsc_code", None)
            or meta.get("bank_ifsc")
            or meta.get("ifsc_code")
            or os.getenv("DEFAULT_BANK_IFSC", "SBIN0030425")
        )
        bank_branch = (
            getattr(invoice, "bank_branch", None)
            or meta.get("bank_branch")
            or os.getenv("DEFAULT_BANK_BRANCH", "WARDHMAN NAGAR NAGPUR")
        )

        company_web = meta.get("company_website", "www.tattlythreads.com")
        dispatch_email = meta.get("dispatch_email", "dispatch@tattlythreads.com")
        accounts_email = meta.get("accounts_email", "accounts@tattlythreads.com")

        grand_total = Decimal(str(invoice.grand_total or 0))

        # Barcode & Compliance-Aware QR Generation (Backend-Driven Compliance State)
        barcode_uri = generate_barcode_base64(invoice_no)
        
        irn = getattr(invoice, "irn", None) or meta.get("irn")
        signed_qr_payload = (
            getattr(invoice, "signed_qr_payload", None)
            or meta.get("signed_qr_payload")
            or getattr(invoice, "signed_qr_data", None)
            or meta.get("signed_qr_data")
        )
        e_invoice_status = getattr(invoice, "e_invoice_status", None) or meta.get("e_invoice_status", "NOT_APPLICABLE")

        # State 1: Cancelled / Voided Invoice
        if is_cancelled:
            qr_label = "VOID / CANCELLED"
            qr_data_str = f"STATUS:CANCELLED|GSTIN:{company_gstin}|INV:{invoice_no}|DATE:{date_str}|VAL:{float(grand_total):.2f}"
        # State 2: Registered IRP E-Invoice (if BOTH valid IRN and signed QR payload are present)
        elif irn and signed_qr_payload and str(e_invoice_status).upper() != "PENDING":
            qr_label = "GST E-INVOICE QR"
            qr_data_str = signed_qr_payload
        # State 3: E-Invoice Applicable but Pending
        elif str(e_invoice_status).upper() == "PENDING":
            qr_label = "VERIFY INVOICE"
            qr_data_str = f"DOC:TAX_INVOICE|INV:{invoice_no}|DATE:{date_str}|GSTIN:{company_gstin}|VAL:{float(grand_total):.2f}|STATUS:PENDING_IRP"
        # State 4: Safe Dynamic Verification QR (B2C / Domestic Non-IRP / Missing IRN or Payload)
        else:
            qr_label = "VERIFY INVOICE"
            qr_data_str = f"DOC:TAX_INVOICE|INV:{invoice_no}|DATE:{date_str}|GSTIN:{company_gstin}|VAL:{float(grand_total):.2f}|POS:{pos_code}"

        qr_uri = generate_qr_base64(qr_data_str)
        logo_uri = get_tattly_logo_base64()

        # Process Items
        items_data = []
        total_quantity = 0
        sum_taxable = Decimal("0.00")
        sum_cgst = Decimal("0.00")
        sum_sgst = Decimal("0.00")
        sum_igst = Decimal("0.00")

        # Sort items by line_no if available
        sorted_items = sorted(invoice.items, key=lambda x: getattr(x, "line_no", 0) or 0)
        
        for idx, item in enumerate(sorted_items, start=1):
            ln = getattr(item, "line_no", None) or idx
            qty = int(item.quantity)
            total_quantity += qty
            
            mrp_val = Decimal(str(getattr(item, "mrp", None) or 0))
            disc_val = Decimal(str(getattr(item, "disc_pct", None) or 0))
            taxable_val = Decimal(str(getattr(item, "taxable_value", None) or (Decimal(str(item.price)) * Decimal(qty))))
            
            # If MRP/disc missing in live items, calculate
            if mrp_val == 0:
                rate = Decimal(str(item.price))
                mrp = rate / Decimal("0.5624") if rate > 0 else Decimal("0.00")
                mrp_val = round(mrp)
                disc_val = Decimal("43.76")
                
            gst_rate = Decimal(str(item.gst_rate or Decimal("5.00")))
            
            if is_interstate:
                igst_val = Decimal(str(getattr(item, "igst_amount", None) or (taxable_val * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))))
                cgst_val = Decimal("0.00")
                sgst_val = Decimal("0.00")
                tot_amt_val = taxable_val + igst_val
                sum_igst += igst_val
            else:
                half_gst = gst_rate / Decimal("2.00")
                cgst_val = Decimal(str(getattr(item, "cgst_amount", None) or (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))))
                sgst_val = Decimal(str(getattr(item, "sgst_amount", None) or (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))))
                igst_val = Decimal("0.00")
                tot_amt_val = taxable_val + cgst_val + sgst_val
                sum_cgst += cgst_val
                sum_sgst += sgst_val
                
            sum_taxable += taxable_val

            clean_desc = item.name.replace("Tattly Footwear ", "").replace("Size ", "").strip()

            items_data.append({
                "line_no": ln,
                "name": clean_desc,
                "hsn_code": item.hsn_code or "64041990",
                "quantity": qty,
                "mrp": mrp_val,
                "disc_pct": disc_val,
                "taxable_value": taxable_val,
                "gst_rate": gst_rate,
                "igst_amount": igst_val,
                "cgst_amount": cgst_val,
                "sgst_amount": sgst_val,
                "total_amount": tot_amt_val,
            })

        db_taxable = getattr(invoice, "taxable_value", None)
        taxable_total = Decimal(str(db_taxable)) if (db_taxable is not None and Decimal(str(db_taxable)) > 0) else sum_taxable
        
        if is_interstate:
            db_igst = getattr(invoice, "tax_total", None)
            igst_total = Decimal(str(db_igst)) if (db_igst is not None and Decimal(str(db_igst)) > 0) else sum_igst
            total_tax = igst_total
            cgst_total = Decimal("0.00")
            sgst_total = Decimal("0.00")
        else:
            db_tax = getattr(invoice, "tax_total", None)
            if db_tax is not None and Decimal(str(db_tax)) > 0:
                cgst_total = (Decimal(str(db_tax)) / Decimal("2.00")).quantize(Decimal("0.01"))
                sgst_total = Decimal(str(db_tax)) - cgst_total
            else:
                cgst_total = sum_cgst
                sgst_total = sum_sgst
            total_tax = cgst_total + sgst_total
            igst_total = Decimal("0.00")
            
        pre_round = taxable_total + total_tax
        rounding_adj = grand_total - pre_round
        
        if rounding_adj < 0:
            rounding_str = f"-₹{abs(rounding_adj):,.2f}"
        elif rounding_adj > 0:
            rounding_str = f"+₹{rounding_adj:,.2f}"
        else:
            rounding_str = "₹0.00"
            
        # CRITICAL: Amount in Words MUST represent the final rounded Grand Total,
        # never the pre-rounding sum.  Generate unconditionally from grand_total.
        # grand_total = Decimal(invoice.grand_total) which is the DB-stored rounded value.
        amount_words = number_to_indian_words(float(grand_total))
        
        # Dynamic address line and party container geometry
        b_lines = len([l for l in billing_addr.split("\n") if l.strip()])
        s_lines = len([l for l in shipping_addr.split("\n") if l.strip()])
        
        is_long_addr = (sis_code == "TYAC" or b_lines >= 4 or s_lines >= 4)
        if is_long_addr:
            first_page_cap = 18
        else:
            first_page_cap = 20

        pages_items = paginate_items(items_data, first_page_max=first_page_cap, cont_page_max=34, last_page_room=19)
        total_pages = len(pages_items)

        # Canonical visual CSS — loaded from golden artifact (never duplicated inline)
        css = load_golden_css()
        
        if is_interstate:
            colgroup = build_colgroup(SMRITI_INTERSTATE_COLUMNS)
            thead_html = """
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align: left; padding-left: 4px;">ITEM DESCRIPTION</th>
                <th>HSN/SAC</th>
                <th>QTY</th>
                <th>MRP</th>
                <th>DISC %</th>
                <th>TAXABLE VALUE</th>
                <th>TAX %</th>
                <th>IGST</th>
                <th style="text-align: right; padding-right: 4px;">AMOUNT</th>
              </tr>
            </thead>
            """
        else:
            colgroup = build_colgroup(SMRITI_INTRASTATE_COLUMNS)
            thead_html = """
            <thead>
              <tr>
                <th>#</th>
                <th style="text-align: left; padding-left: 4px;">ITEM DESCRIPTION</th>
                <th>HSN/SAC</th>
                <th>QTY</th>
                <th>MRP</th>
                <th>DISC %</th>
                <th>TAXABLE VALUE</th>
                <th>CGST %</th>
                <th>CGST</th>
                <th>SGST %</th>
                <th>SGST</th>
                <th style="text-align: right; padding-right: 4px;">AMOUNT</th>
              </tr>
            </thead>
            """
        
        html_pages = []
        
        for p_idx, page_item_list in enumerate(pages_items, start=1):
            is_first = (p_idx == 1)
            is_last = (p_idx == total_pages)
            
            rows_html = ""
            for it in page_item_list:
                ln = it["line_no"]
                desc = it["name"]
                hsn = it["hsn_code"]
                qty = it["quantity"]
                mrp = it["mrp"]
                disc = it["disc_pct"]
                tx = it["taxable_value"]
                amt = it["total_amount"]
                rate = it.get("gst_rate", Decimal("5.00"))
                
                if is_interstate:
                    ig = it["igst_amount"]
                    rate_str = f"{rate:.0f}%" if rate == rate.to_integral() else f"{rate:.1f}%"
                    tax_cells = f"""
                    <td style="text-align: center;">{rate_str}</td>
                    <td style="text-align: right; padding-right: 3px;">₹{ig:,.2f}</td>
                    """
                else:
                    cg = it["cgst_amount"]
                    sg = it["sgst_amount"]
                    half_rate = rate / Decimal("2.00")
                    half_str = f"{half_rate:.0f}%" if half_rate == half_rate.to_integral() else f"{half_rate:.1f}%"
                    tax_cells = f"""
                    <td style="text-align: center;">{half_str}</td>
                    <td style="text-align: right; padding-right: 3px;">₹{cg:,.2f}</td>
                    <td style="text-align: center;">{half_str}</td>
                    <td style="text-align: right; padding-right: 3px;">₹{sg:,.2f}</td>
                    """
                
                rows_html += f"""
                <tr class="item-row">
                  <td style="text-align: center;">{ln}</td>
                  <td style="text-align: left; padding-left: 4px; font-weight: 500;">{desc}</td>
                  <td style="text-align: center;">{hsn}</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">{qty}</td>
                  <td style="text-align: right; padding-right: 3px;">₹{mrp:,.2f}</td>
                  <td style="text-align: right; color: #1e40af; padding-right: 3px;">{disc:.2f}%</td>
                  <td style="text-align: right; font-weight: 600; padding-right: 3px;">₹{tx:,.2f}</td>
                  {tax_cells}
                  <td style="text-align: right; font-weight: 700; padding-right: 4px;">₹{amt:,.2f}</td>
                </tr>
                """
                
            if is_interstate:
                subtotal_row = f"""
                <tr class="subtotal-row">
                  <td colspan="3" style="text-align: right; padding-right: 6px; font-weight: 700; text-transform: uppercase;">TOTAL PAIRS:</td>
                  <td style="text-align: right; font-weight: 700; color: #1e3a8a; padding-right: 3px;">{total_quantity}</td>
                  <td colspan="2" style="text-align: right; padding-right: 6px; color: #4b5563; text-transform: uppercase; font-size: 7px;">SUBTOTAL:</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{taxable_total:,.2f}</td>
                  <td style="text-align: center; color: #9ca3af;">-</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{igst_total:,.2f}</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 4px;">₹{taxable_total + igst_total:,.2f}</td>
                </tr>
                """
            else:
                subtotal_row = f"""
                <tr class="subtotal-row">
                  <td colspan="3" style="text-align: right; padding-right: 6px; font-weight: 700; text-transform: uppercase;">TOTAL PAIRS:</td>
                  <td style="text-align: right; font-weight: 700; color: #1e3a8a; padding-right: 3px;">{total_quantity}</td>
                  <td colspan="2" style="text-align: right; padding-right: 6px; color: #4b5563; text-transform: uppercase; font-size: 7px;">SUBTOTAL:</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{taxable_total:,.2f}</td>
                  <td style="text-align: center; color: #9ca3af;">-</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{cgst_total:,.2f}</td>
                  <td style="text-align: center; color: #9ca3af;">-</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{sgst_total:,.2f}</td>
                  <td style="text-align: right; font-weight: 700; padding-right: 4px;">₹{taxable_total + cgst_total + sgst_total:,.2f}</td>
                </tr>
                """
            
            page_top = ""
            if is_first:
                page_top = f"""
                <!-- Header Block -->
                <table class="header-table">
                  <tr>
                    <td style="width: 58%;">
                      <div style="display: flex; gap: 8px; align-items: flex-start;">
                        {f'<img src="{logo_uri}" style="height: 38px; width: auto; object-fit: contain; margin-top: 1px;"/>' if logo_uri else ''}
                        <div>
                          <div class="company-name">{company_name}</div>
                          <div class="company-details">
                            Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery,<br/>near HP Petrol Pump, Mumbai, Maharashtra - 400003
                          </div>
                          <div class="company-details" style="font-family: monospace; margin-top: 2px; line-height: 1.35;">
                            <div>Web: {company_web}</div>
                            <div>Dispatch: {dispatch_email}</div>
                            <div>Accounts: {accounts_email}</div>
                          </div>
                          <div class="company-gstin">
                            GSTIN: <span class="gstin-val">{company_gstin}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style="width: 42%; border-left: 1px solid #d1d5db; padding-left: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 3px;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <div class="invoice-title">TAX INVOICE</div>
                            {f'<span style="color: #dc2626; border: 1.5px solid #dc2626; border-radius: 3px; font-weight: 800; font-size: 7.5px; padding: 1px 4px; text-transform: uppercase; letter-spacing: 0.5px;">CANCELLED</span>' if is_cancelled else ''}
                          </div>
                          {f'<div style="margin-top: 2px;"><img src="{barcode_uri}" style="height: 26px; width: auto; max-width: 145px; object-fit: contain;"/><div style="font-family: monospace; font-size: 7.5px; font-weight: 800; color: #111827; letter-spacing: 0.5px; margin-top: 1px;">{invoice_no}</div></div>' if barcode_uri else ''}
                        </div>
                        <div style="text-align: center; margin-left: 6px;">
                          {f'<img src="{qr_uri}" style="width: 56px; height: 56px; border: 1.5px solid #0f172a; padding: 2px; border-radius: 4px; background: #ffffff; object-fit: contain;"/>' if qr_uri else ''}
                          <div style="font-family: monospace; font-size: 6.5px; font-weight: 700; color: #1e293b; text-transform: uppercase; margin-top: 1px;">{qr_label}</div>
                        </div>
                      </div>
                      <table class="meta-table">
                        <tr><td class="meta-label">Invoice No:</td><td class="meta-val">{invoice_no}</td></tr>
                        <tr><td class="meta-label">Date:</td><td class="meta-val">{date_str}</td></tr>
                        <tr><td class="meta-label">Store Code:</td><td class="meta-val">{sis_code}</td></tr>
                        <tr><td class="meta-label">Place of Supply:</td><td class="meta-val">{place_of_supply_display}</td></tr>
                        <tr><td class="meta-label">Reverse Charge:</td><td class="meta-val">{reverse_charge_display}</td></tr>
                        <tr><td class="meta-label">PO / Reference:</td><td class="meta-val">{po_reference}</td></tr>
                        <tr><td class="meta-label">E-Way Bill No:</td><td class="meta-val">{eway_bill}</td></tr>
                        {f'<tr><td class="meta-label">IRN:</td><td class="meta-val" style="word-break: break-all; font-family: monospace; font-size: 5px;">{irn}</td></tr>' if (irn and signed_qr_payload and str(e_invoice_status).upper() != "PENDING") else ''}
                      </table>
                    </td>
                  </tr>
                </table>
                
                <!-- Customer Block -->
                <table class="customer-table">
                  <tr>
                    <td>
                      <div class="cust-heading">BILLED TO (RECIPIENT)</div>
                      <div class="cust-name">{customer_name}</div>
                      <div class="cust-address">{billing_addr}</div>
                      <div class="cust-gstin">GSTIN: <span style="color: #1e40af;">{customer_gstin}</span></div>
                    </td>
                    <td>
                      <div class="cust-heading">SHIPPED TO (DELIVERY SITE)</div>
                      <div class="cust-name">{site_name}</div>
                      <div class="cust-address">{shipping_addr}</div>
                      <div class="cust-gstin">GSTIN: <span style="color: #1e40af;">{customer_gstin}</span></div>
                    </td>
                  </tr>
                </table>
                """
            else:
                page_top = f"""
                <div class="continuation-header">
                  <span>{company_name} — TAX INVOICE</span>
                  <span>Invoice No: {invoice_no} | Date: {date_str}</span>
                </div>
                """
                
            page_bottom = ""
            if is_last:
                if is_interstate:
                    tax_totals_rows = f"""
                    <tr>
                      <td class="totals-label">IGST @ 5%:</td>
                      <td class="totals-val">₹{igst_total:,.2f}</td>
                    </tr>
                    """
                    gst_table_content = f"""
                    <table class="gst-table">
                      <thead>
                        <tr>
                          <th style="text-align: left;">HSN/SAC</th>
                          <th style="text-align: right;">TAXABLE VALUE</th>
                          <th style="text-align: right;">IGST RATE</th>
                          <th style="text-align: right;">IGST AMOUNT</th>
                          <th style="text-align: right;">TOTAL TAX</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style="font-weight: 700;">64041990</td>
                          <td style="text-align: right;">₹{taxable_total:,.2f}</td>
                          <td style="text-align: right;">5%</td>
                          <td style="text-align: right;">₹{igst_total:,.2f}</td>
                          <td style="text-align: right; font-weight: 700;">₹{igst_total:,.2f}</td>
                        </tr>
                      </tbody>
                    </table>
                    """
                else:
                    tax_totals_rows = f"""
                    <tr>
                      <td class="totals-label">CGST @ 2.5%:</td>
                      <td class="totals-val">₹{cgst_total:,.2f}</td>
                    </tr>
                    <tr>
                      <td class="totals-label">SGST @ 2.5%:</td>
                      <td class="totals-val">₹{sgst_total:,.2f}</td>
                    </tr>
                    """
                    gst_table_content = f"""
                    <table class="gst-table">
                      <thead>
                        <tr>
                          <th style="text-align: left;">HSN/SAC</th>
                          <th style="text-align: right;">TAXABLE VALUE</th>
                          <th style="text-align: right;">CGST RATE</th>
                          <th style="text-align: right;">CGST AMOUNT</th>
                          <th style="text-align: right;">SGST RATE</th>
                          <th style="text-align: right;">SGST AMOUNT</th>
                          <th style="text-align: right;">TOTAL TAX</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style="font-weight: 700;">64041990</td>
                          <td style="text-align: right;">₹{taxable_total:,.2f}</td>
                          <td style="text-align: right;">2.5%</td>
                          <td style="text-align: right;">₹{cgst_total:,.2f}</td>
                          <td style="text-align: right;">2.5%</td>
                          <td style="text-align: right;">₹{sgst_total:,.2f}</td>
                          <td style="text-align: right; font-weight: 700;">₹{cgst_total + sgst_total:,.2f}</td>
                        </tr>
                      </tbody>
                    </table>
                    """
                    
                page_bottom = f"""
                <!-- Summary Section -->
                <div class="summary-grid">
                  <div class="words-box">
                    <div style="font-size: 7px; font-weight: 700; color: #6b7280; font-family: monospace; text-transform: uppercase; margin-bottom: 2px;">
                      AMOUNT IN WORDS:
                    </div>
                    <div style="font-size: 9px; font-weight: 700; color: #111827; font-family: monospace; line-height: 1.35;">
                      {amount_words}
                    </div>
                  </div>
                  
                  <div class="totals-box">
                    <table class="totals-table">
                      <tr>
                        <td class="totals-label">Total Quantity:</td>
                        <td class="totals-val">{total_quantity} Pairs</td>
                      </tr>
                      <tr>
                        <td class="totals-label">Taxable Value:</td>
                        <td class="totals-val">₹{taxable_total:,.2f}</td>
                      </tr>
                      {tax_totals_rows}
                      <tr>
                        <td class="totals-label">Rounding Adjustment:</td>
                        <td class="totals-val">{rounding_str}</td>
                      </tr>
                      <tr class="grand-total-row">
                        <td style="width: 50%;">Grand Total:</td>
                        <td style="text-align: right; font-family: monospace;">₹{grand_total:,.2f}</td>
                      </tr>
                    </table>
                  </div>
                </div>
                
                <!-- GST Breakdown Table -->
                {gst_table_content}
                
                <!-- Bank & Signatory -->
                <div class="bottom-grid">
                  <div style="width: 60%;">
                    <div class="bank-box" style="border: 1px solid #d1d5db; border-radius: 3px; padding: 5px 8px; background: rgba(249, 250, 251, 0.70);">
                      <div style="font-size: 6.00pt; font-weight: 800; color: #374151; font-family: monospace; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-bottom: 3px;">&#127970; BANK DETAILS</div>
                      <div style="font-family: monospace; font-size: 6.58pt; color: #6b7280; margin-bottom: 1px;">A/C Name: <b style="color: #111827;">{company_name}</b></div>
                      <div style="font-weight: 800; color: #111827; font-size: 8.2pt; font-family: sans-serif; margin-bottom: 1px;">{bank_name}</div>
                      <div style="font-family: monospace; font-size: 7.31pt; color: #374151; margin-bottom: 1px;">A/C No: <b style="color: #111827; letter-spacing: 0.5px;">{account_no}</b></div>
                      <div style="font-family: monospace; font-size: 7.31pt; color: #374151;">IFSC: <b style="color: #111827;">{ifsc_code}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Branch: {bank_branch}</div>
                    </div>
                    
                    <div>
                      <div style="font-size: 6.5px; font-weight: 700; color: #6b7280; font-family: monospace; text-transform: uppercase;">TERMS &amp; CONDITIONS</div>
                      <div style="font-size: 6.5px; color: #4b5563; line-height: 1.3;">
                        Goods once sold will not be taken back without prior written approval. All disputes subject to Mumbai Jurisdiction.
                      </div>
                    </div>
                  </div>
                  
                  <div style="width: 38%; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end;">
                    <div class="signatory-box">
                      <div style="font-size: 6.5px; color: #6b7280; text-transform: uppercase;">FOR {company_name}</div>
                      <div style="height: 25px;"></div>
                      <div style="border-top: 1px solid #d1d5db; padding-top: 2px; font-weight: 700; font-size: 7.5px; text-transform: uppercase;">
                        AUTHORISED SIGNATORY
                      </div>
                    </div>
                  </div>
                </div>
                
"""
                
            is_last_page = (p_idx == total_pages)
            disclaimer_html = f"""
              <div style="font-size: 6.00pt; color: #6b7280; text-align: center;">This is a computer-generated tax invoice and does not require a physical signature.</div>
              <div style="font-size: 6.00pt; font-weight: 700; text-transform: uppercase; color: #374151; text-align: center;">SUBJECT TO MUMBAI JURISDICTION.</div>
            """ if is_last_page else ""
            footer_html = f"""
            <div class="page-footer" style="flex-direction: column; text-align: center; gap: 1px;">
              {disclaimer_html}
              <div style="font-size: 6.00pt; color: #6b7280; display: flex; justify-content: space-between; align-items: center; width: 100%; padding-top: 2px; border-top: 1px dashed #d1d5db; margin-top: 1px;">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-start;">
                  {f'<img src="{logo_uri}" style="height: 14px; max-width: 65px; object-fit: contain;"/>' if logo_uri else ''}
                  <span>Page {p_idx} of {total_pages}</span>
                </div>
                <div style="font-size: 5.50pt; font-weight: 600; color: #4b5563; text-align: center; flex: 1.5;">
                  SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;">
                  {f'<img src="{barcode_uri}" style="height: 12px; width: auto;"/>' if barcode_uri else ''}
                  <span>Invoice No: {invoice_no}</span>
                </div>
              </div>
            </div>
            """

            if page_item_list:
                table_html = f"""
                <table class="item-table">
                  {colgroup}
                  {thead_html}
                  <tbody>
                    {rows_html}
                    {subtotal_row if is_last else ''}
                  </tbody>
                </table>
                """
            else:
                table_html = ""
                
            page_html = f"""
            <div class="page-container">
              {f'<img class="watermark-logo" src="{logo_uri}" alt="" />' if logo_uri else ''}
              {f'<div class="watermark-cancelled">CANCELLED</div>' if is_cancelled else ''}
              <div style="position: relative; z-index: 1;">
                {page_top}
                {table_html}
                {page_bottom}
              </div>
              <div style="position: relative; z-index: 1;">
                {footer_html}
              </div>
            </div>
            """
            html_pages.append(page_html)
            
        full_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <title>Tax Invoice - {invoice_no}</title>
          <style>
            {css}
          </style>
        </head>
        <body>
          {''.join(html_pages)}
        </body>
        </html>
        """
        return full_html

    @classmethod
    def generate_invoice_html_sync(
        cls,
        invoice: Any,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None
    ) -> str:
        """Synchronous wrapper for generating invoice HTML from model object."""
        return cls.generate_invoice_html_from_model(
            invoice=invoice,
            company_name=company_name,
            company_gstin=company_gstin,
            extra_meta=extra_meta
        )

    @classmethod
    async def generate_invoice_html(
        cls,
        session: Any = None,
        invoice_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None,
        invoice: Optional[Any] = None
    ) -> str:
        """
        Retrieves authoritative invoice record from database under tenant isolation context
        (or directly processes an invoice model object) and renders pixel-faithful GST Tax Invoice HTML.
        """
        if invoice is not None:
            return cls.generate_invoice_html_from_model(
                invoice=invoice,
                company_name=company_name,
                company_gstin=company_gstin,
                extra_meta=extra_meta
            )

        if session is not None and (not hasattr(session, "execute") or hasattr(session, "invoice_no")):
            invoice_obj = session
            return cls.generate_invoice_html_from_model(
                invoice=invoice_obj,
                company_name=company_name,
                company_gstin=company_gstin,
                extra_meta=extra_meta
            )

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
        invoice_rec = res.scalars().first()
        if not invoice_rec:
            raise HTTPException(status_code=404, detail="Invoice not found under current company context.")

        # Verify layout integrity before rendering
        verify_smrititaxinvoice_integrity()

        return cls.generate_invoice_html_from_model(
            invoice=invoice_rec,
            company_name=company_name,
            company_gstin=company_gstin,
            extra_meta=extra_meta
        )

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

        os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")

            pdf_data = await page.pdf(
                format="A4",
                margin={"top": "8mm", "bottom": "10mm", "left": "12mm", "right": "6mm"},
                print_background=True
            )
            await browser.close()

        try:
            with open(output_pdf_path, "wb") as f:
                f.write(pdf_data)
        except PermissionError:
            temp_out = output_pdf_path + ".tmp"
            with open(temp_out, "wb") as f:
                f.write(pdf_data)
            try:
                os.replace(temp_out, output_pdf_path)
            except Exception:
                pass

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

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")

            pdf_bytes = await page.pdf(
                format="A4",
                margin={"top": "8mm", "bottom": "10mm", "left": "12mm", "right": "6mm"},
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
        Governed Document Artifact Retrieval & Reprint Protection.
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

        # Render fresh PDF bytes via Canonical Renderer
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
        export_dir = str(WORKSPACE_ROOT / "exports" / "tt_canonical_18_71")
        os.makedirs(export_dir, exist_ok=True)
        safe_inv = inv_no.replace("/", "_")
        storage_path = os.path.join(export_dir, f"{safe_inv}_CANONICAL_V1.pdf")
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
                id=f"art-can-{safe_inv}",
                uuid=str(uuid.uuid4()),
                company_id=company_id or (invoice.company_id if invoice else "comp-default"),
                branch_id=branch_id or (invoice.branch_id if invoice else "br-default"),
                invoice_id=invoice_id,
                invoice_no=inv_no,
                document_type="TAX_INVOICE",
                template_code="TAX_INVOICE_TATTLY_THREADS",
                template_version="V1",
                template_status="FROZEN",
                artifact_subtype="CANONICAL",
                source_type=getattr(invoice, "source_type", "HISTORICAL_IMPORT") or "HISTORICAL_IMPORT",
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
