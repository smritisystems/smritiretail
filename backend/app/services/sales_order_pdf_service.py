"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import re
import math
import uuid
import base64
import asyncio
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date

from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from .tax_invoice_spec import load_golden_css
from .invoice_pdf_service import (
    generate_barcode_base64,
    generate_qr_base64,
    number_to_indian_words,
    format_place_of_supply,
    GST_STATE_MAP,
)
from ..models.sales import SalesOrder, SalesOrderItem, SalesOrderInvoiceAllocation


class SalesOrderPdfService:
    """
    Canonical Sales Order Confirmation & Proforma PDF/HTML Rendering Engine.
    Produces high-fidelity A4 statutory order confirmation documents.
    """

    @classmethod
    def generate_order_html_from_model(
        cls,
        order: Any,
        items: List[Any],
        allocations: Optional[List[Any]] = None,
        company_name: str = "TATTLY THREADS",
        company_gstin: str = "27AAXFT2508H1ZR",
        extra_meta: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Renders pixel-faithful Sales Order Confirmation HTML directly from an authoritative model.
        """
        meta = extra_meta or {}
        order_no = getattr(order, "order_no", None) or f"SO-{getattr(order, 'id', '001')}"
        po_number = getattr(order, "po_number", None) or meta.get("po_number", "N/A")
        
        date_obj = getattr(order, "date", None)
        if hasattr(date_obj, "strftime"):
            date_str = date_obj.strftime("%d-%m-%Y")
        else:
            date_str = str(date_obj) if date_obj else "12-08-2026"

        del_date_obj = getattr(order, "delivery_date", None)
        if hasattr(del_date_obj, "strftime"):
            del_date_str = del_date_obj.strftime("%d-%m-%Y")
        else:
            del_date_str = str(del_date_obj) if del_date_obj else "Within 7 Days"

        site_code = getattr(order, "site_code", None) or meta.get("site_code", "")
        customer_name = getattr(order, "customer_name", None) or meta.get("customer_name", "Reliance Retail Limited")
        site_name = getattr(order, "site_name", None) or meta.get("site_name", customer_name)
        customer_gstin = getattr(order, "customer_gstin", None) or meta.get("customer_gstin", "")
        delivery_addr = getattr(order, "delivery_address", None) or meta.get("delivery_address", "Reliance Retail Store")
        
        fulfillment_status = str(getattr(order, "fulfillment_status", "UNFULFILLED")).upper()
        status_str = str(getattr(order, "status", "Confirmed")).upper()

        # Supply logic
        supplier_state_code = company_gstin[:2] if (company_gstin and len(company_gstin) >= 2 and company_gstin[:2].isdigit()) else "27"
        pos_code = "27"
        if customer_gstin and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit():
            pos_code = customer_gstin[:2]
        
        pos_state_name = GST_STATE_MAP.get(pos_code, "Maharashtra")
        is_interstate = (pos_code != supplier_state_code)
        place_of_supply_display = format_place_of_supply(pos_state_name, is_interstate, customer_gstin, supplier_gstin=company_gstin)

        # Dynamic Bank Details
        bank_name = os.getenv("DEFAULT_BANK_NAME", "STATE BANK OF INDIA")
        account_holder_name = "TATTLY THREADS"
        account_no = os.getenv("DEFAULT_BANK_ACCOUNT_NO", "43976711765")
        ifsc_code = os.getenv("DEFAULT_BANK_IFSC", "SBIN0030425")
        bank_branch = os.getenv("DEFAULT_BANK_BRANCH", "WARDHMAN NAGAR NAGPUR")

        company_web = meta.get("company_website", "www.tattlythreads.com")
        dispatch_email = meta.get("dispatch_email", "dispatch@tattlythreads.com")
        accounts_email = meta.get("accounts_email", "accounts@tattlythreads.com")

        # Barcode & Verification QR
        barcode_uri = generate_barcode_base64(order_no)
        qr_payload = f"DOC:SALES_ORDER|SO:{order_no}|PO:{po_number}|DATE:{date_str}|GSTIN:{company_gstin}|STATUS:{fulfillment_status}"
        qr_uri = generate_qr_base64(qr_payload)

        # Process Line Items
        items_data = []
        sum_taxable = Decimal("0.00")
        sum_tax = Decimal("0.00")
        sum_cgst = Decimal("0.00")
        sum_sgst = Decimal("0.00")
        sum_igst = Decimal("0.00")
        total_quantity = 0

        for ln, item in enumerate(items, start=1):
            qty = int(Decimal(str(item.quantity or 0)))
            total_quantity += qty
            price = Decimal(str(item.price or 0))
            taxable_val = (price * Decimal(str(qty))).quantize(Decimal("0.01"))
            gst_rate = Decimal(str(item.gst_rate or Decimal("5.00")))

            mrp_val = Decimal(str(getattr(item, "mrp", None) or (price / Decimal("0.5624") if price > 0 else Decimal("0.00")))).quantize(Decimal("0.01"))
            disc_val = Decimal(str(getattr(item, "disc_pct", None) or Decimal("43.76"))).quantize(Decimal("0.01"))

            if is_interstate:
                igst_val = (taxable_val * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                cgst_val = Decimal("0.00")
                sgst_val = Decimal("0.00")
                tot_amt = taxable_val + igst_val
                sum_igst += igst_val
            else:
                half_gst = gst_rate / Decimal("2.00")
                cgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                sgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                igst_val = Decimal("0.00")
                tot_amt = taxable_val + cgst_val + sgst_val
                sum_cgst += cgst_val
                sum_sgst += sgst_val

            sum_taxable += taxable_val
            sum_tax += (cgst_val + sgst_val + igst_val)

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
                "cgst_amount": cgst_val,
                "sgst_amount": sgst_val,
                "igst_amount": igst_val,
                "total_amount": tot_amt,
            })

        grand_total = Decimal(str(getattr(order, "grand_total", None) or (sum_taxable + sum_tax))).quantize(Decimal("0.01"))
        amount_words = number_to_indian_words(float(grand_total))

        # Pagination
        first_page_cap = 20
        cont_page_max = 34
        last_page_room = 19
        
        pages_items = []
        if len(items_data) <= first_page_cap:
            pages_items = [items_data]
        else:
            pages_items.append(items_data[:first_page_cap])
            rem = items_data[first_page_cap:]
            while rem:
                if len(rem) <= last_page_room:
                    pages_items.append(rem)
                    break
                elif len(rem) <= cont_page_max:
                    pages_items.append(rem)
                    pages_items.append([])
                    break
                else:
                    pages_items.append(rem[:cont_page_max])
                    rem = rem[cont_page_max:]

        total_pages = len(pages_items)
        css = load_golden_css()

        # Build Colgroup and Table Headers
        if is_interstate:
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
                <th>CGST</th>
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
                    tax_cells = f"""
                    <td style="text-align: center;">{rate:.0f}%</td>
                    <td style="text-align: right; padding-right: 3px;">₹{it['igst_amount']:,.2f}</td>
                    """
                else:
                    tax_cells = f"""
                    <td style="text-align: right; padding-right: 3px;">₹{it['cgst_amount']:,.2f}</td>
                    <td style="text-align: right; padding-right: 3px;">₹{it['sgst_amount']:,.2f}</td>
                    """

                rows_html += f"""
                <tr>
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

            subtotal_row = f"""
            <tr class="subtotal-row">
              <td colspan="3" style="text-align: right; padding-right: 6px; font-weight: 700; text-transform: uppercase;">TOTAL PAIRS:</td>
              <td style="text-align: right; font-weight: 700; color: #1e3a8a; padding-right: 3px;">{total_quantity}</td>
              <td colspan="2" style="text-align: right; padding-right: 6px; color: #4b5563; text-transform: uppercase; font-size: 7px;">SUBTOTAL:</td>
              <td style="text-align: right; font-weight: 700; padding-right: 3px;">₹{sum_taxable:,.2f}</td>
              <td colspan="{"2" if is_interstate else "2"}" style="text-align: right; font-weight: 700; padding-right: 3px;">₹{sum_tax:,.2f}</td>
              <td style="text-align: right; font-weight: 700; padding-right: 4px;">₹{grand_total:,.2f}</td>
            </tr>
            """

            page_top = ""
            if is_first:
                page_top = f"""
                <!-- Document Header -->
                <table class="header-table">
                  <tr>
                    <td style="width: 58%; vertical-align: top; padding-right: 10px;">
                      <table style="width: 100%; border: none;">
                        <tr>
                          <td style="width: 50px; vertical-align: middle;">
                            <div style="font-size: 28px; font-weight: 900; color: #0f172a; font-family: serif;">&#119853;</div>
                          </td>
                          <td style="vertical-align: top; padding-left: 6px;">
                            <div style="font-weight: 900; font-size: 11pt; color: #0f172a; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">{company_name}</div>
                            <div style="font-size: 6.8pt; color: #475569; line-height: 1.35; margin-top: 1px;">
                              Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery,<br/>
                              near HP Petrol Pump, Mumbai, Maharashtra - 400003
                            </div>
                            <div style="font-size: 6.8pt; color: #475569; margin-top: 1px;">
                              Web: {company_web}<br/>
                              Dispatch: {dispatch_email}<br/>
                              Accounts: {accounts_email}
                            </div>
                            <div style="font-family: monospace; font-size: 9.5pt; font-weight: 800; color: #1e3a8a; margin-top: 3px; letter-spacing: 0.8px;">
                              GSTIN: {company_gstin}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    
                    <td style="width: 42%; vertical-align: top; text-align: right;">
                      <div style="font-size: 13pt; font-weight: 900; color: #0f172a; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        SALES ORDER CONFIRMATION
                      </div>
                      
                      <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 3px; margin-bottom: 3px;">
                        <div style="text-align: center; margin-right: 6px;">
                          {f'<div style="margin-top: 2px;"><img src="{barcode_uri}" style="height: 26px; width: auto; max-width: 145px; object-fit: contain;"/><div style="font-family: monospace; font-size: 7.5px; font-weight: 800; color: #111827; letter-spacing: 0.5px; margin-top: 1px;">{order_no}</div></div>' if barcode_uri else ''}
                        </div>
                        <div style="text-align: center; margin-left: 6px;">
                          {f'<img src="{qr_uri}" style="width: 52px; height: 52px; border: 1.5px solid #0f172a; padding: 2px; border-radius: 4px; background: #ffffff; object-fit: contain;"/>' if qr_uri else ''}
                          <div style="font-family: monospace; font-size: 6.5px; font-weight: 700; color: #1e293b; text-transform: uppercase; margin-top: 1px;">{fulfillment_status}</div>
                        </div>
                      </div>
                      
                      <table class="meta-table">
                        <tr><td class="meta-label">Sales Order No:</td><td class="meta-val">{order_no}</td></tr>
                        <tr><td class="meta-label">Order Date:</td><td class="meta-val">{date_str}</td></tr>
                        <tr><td class="meta-label">Customer PO No:</td><td class="meta-val" style="font-weight: 800; color: #1e3a8a;">{po_number}</td></tr>
                        <tr><td class="meta-label">Store Code:</td><td class="meta-val">{site_code}</td></tr>
                        <tr><td class="meta-label">Place of Supply:</td><td class="meta-val">{place_of_supply_display}</td></tr>
                        <tr><td class="meta-label">Target Delivery:</td><td class="meta-val">{del_date_str}</td></tr>
                        <tr><td class="meta-label">Order Status:</td><td class="meta-val" style="font-weight: 800; color: #047857;">{status_str}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
                
                <!-- Party Box -->
                <table class="party-table">
                  <tr>
                    <td class="party-box" style="width: 50%;">
                      <div class="party-title">CUSTOMER / BILLED TO:</div>
                      <div class="party-name">{customer_name}</div>
                      <div class="party-address">{delivery_addr}</div>
                      <div class="party-gstin">GSTIN: {customer_gstin}</div>
                    </td>
                    <td class="party-box" style="width: 50%;">
                      <div class="party-title">DELIVERY STORE SITE / SHIPPED TO:</div>
                      <div class="party-name">{site_name}</div>
                      <div class="party-address">{delivery_addr}</div>
                      <div class="party-gstin">STORE CODE: <b>{site_code}</b> | POS: {place_of_supply_display}</div>
                    </td>
                  </tr>
                </table>
                """

            page_bottom = ""
            if is_last:
                if is_interstate:
                    tax_totals_rows = f"""
                    <tr>
                      <td class="totals-label">IGST @ 5%:</td>
                      <td class="totals-val">₹{sum_igst:,.2f}</td>
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
                          <td style="text-align: right;">₹{sum_taxable:,.2f}</td>
                          <td style="text-align: right;">5.0%</td>
                          <td style="text-align: right;">₹{sum_igst:,.2f}</td>
                          <td style="text-align: right; font-weight: 700;">₹{sum_igst:,.2f}</td>
                        </tr>
                      </tbody>
                    </table>
                    """
                else:
                    tax_totals_rows = f"""
                    <tr>
                      <td class="totals-label">CGST @ 2.5%:</td>
                      <td class="totals-val">₹{sum_cgst:,.2f}</td>
                    </tr>
                    <tr>
                      <td class="totals-label">SGST @ 2.5%:</td>
                      <td class="totals-val">₹{sum_sgst:,.2f}</td>
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
                          <td style="text-align: right;">₹{sum_taxable:,.2f}</td>
                          <td style="text-align: right;">2.5%</td>
                          <td style="text-align: right;">₹{sum_cgst:,.2f}</td>
                          <td style="text-align: right;">2.5%</td>
                          <td style="text-align: right;">₹{sum_sgst:,.2f}</td>
                          <td style="text-align: right; font-weight: 700;">₹{sum_cgst + sum_sgst:,.2f}</td>
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
                        <td class="totals-val">₹{sum_taxable:,.2f}</td>
                      </tr>
                      {tax_totals_rows}
                      <tr class="grand-total-row">
                        <td style="width: 50%;">Order Total Value:</td>
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
                      <div style="font-size: 6.00pt; font-weight: 800; color: #374151; font-family: monospace; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-bottom: 3px;">&#127970; BANK DETAILS FOR REMITTANCE</div>
                      <div style="font-family: monospace; font-size: 6.58pt; color: #6b7280; margin-bottom: 1px;">A/C Name: <b style="color: #111827;">{account_holder_name}</b></div>
                      <div style="font-weight: 800; color: #111827; font-size: 8.2pt; font-family: sans-serif; margin-bottom: 1px;">{bank_name}</div>
                      <div style="font-family: monospace; font-size: 7.31pt; color: #374151; margin-bottom: 1px;">A/C No: <b style="color: #111827; letter-spacing: 0.5px;">{account_no}</b></div>
                      <div style="font-family: monospace; font-size: 7.31pt; color: #374151;">IFSC: <b style="color: #111827;">{ifsc_code}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Branch: {bank_branch}</div>
                    </div>
                    
                    <div>
                      <div style="font-size: 6.5px; font-weight: 700; color: #6b7280; font-family: monospace; text-transform: uppercase;">ORDER ACCEPTANCE & TERMS</div>
                      <div style="font-size: 6.5px; color: #4b5563; line-height: 1.3;">
                        Prices and discounts are as per agreed commercial contract. Goods will be dispatched against confirmed store delivery schedules.
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

            footer_html = f"""
            <div class="page-footer">
              <table class="footer-table">
                <tr>
                  <td style="text-align: left; width: 30%;">
                    Page {p_idx} of {total_pages}
                  </td>
                  <td style="text-align: center; width: 40%; font-size: 6pt; color: #6b7280;">
                    SMRITI OS Retail Suite -- Sales Order Engine
                  </td>
                  <td style="text-align: right; width: 30%;">
                    SO: {order_no} | PO: {po_number}
                  </td>
                </tr>
              </table>
            </div>
            """

            table_html = f"""
            <table class="item-table">
              {thead_html}
              <tbody>
                {rows_html}
                {subtotal_row if is_last else ''}
              </tbody>
            </table>
            """

            page_html = f"""
            <div class="page-container">
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
          <meta charset="UTF-8" />
          <title>Sales Order - {order_no}</title>
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
    async def render_pdf(cls, html_content: str) -> bytes:
        """Playwright-driven exact A4 PDF compilation."""
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = await browser.new_page()
            await page.set_content(html_content, wait_until="networkidle")
            
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"},
                prefer_css_page_size=True,
            )
            await browser.close()
            return pdf_bytes

    @classmethod
    async def get_or_render_pdf_artifact(
        cls,
        session: AsyncSession,
        order_id: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None
    ) -> Tuple[bytes, Dict[str, Any]]:
        """
        Retrieves or generates canonical Sales Order PDF.
        """
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(
                (SalesOrder.id == order_id) | (SalesOrder.order_no == order_id) | (SalesOrder.po_number == order_id),
                SalesOrder.is_deleted == False
            )
        )
        if company_id:
            stmt = stmt.where((SalesOrder.company_id == company_id) | (SalesOrder.company_id.is_(None)))
            
        res = await session.execute(stmt)
        order = res.scalars().first()
        if not order:
            raise ValueError(f"Sales Order '{order_id}' not found")

        html = cls.generate_order_html_from_model(
            order=order,
            items=list(order.items or []),
            allocations=list(order.allocations or []),
            company_name="TATTLY THREADS",
            company_gstin="27AAXFT2508H1ZR"
        )
        pdf_bytes = await cls.render_pdf(html)
        meta = {
            "order_id": order.id,
            "order_no": order.order_no,
            "po_number": order.po_number,
            "grand_total": float(order.grand_total or 0),
        }
        return pdf_bytes, meta
