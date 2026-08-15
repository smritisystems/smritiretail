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

from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from ..models.sales import SalesInvoice


class InvoicePdfService:
    """
    Tax Invoice PDF Rendering Engine.
    Enforces Rule: PDF is strictly a rendered representation of business truth
    stored in Smritibus_<CompanyCode>. Data flows from Smritibus_<CC> -> PDF Renderer.
    """

    @classmethod
    async def generate_invoice_html(
        cls,
        session: AsyncSession,
        invoice_id: str,
        company_id: str | None = None,
        branch_id: str | None = None,
        company_name: str = "Tattly Retail Pvt Ltd",
        company_gstin: str = "27AABCU9603R1ZM"
    ) -> str:
        """
        Retrieves authoritative invoice record from database under tenant isolation context and renders GST Tax Invoice HTML.
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

        is_interstate = getattr(invoice, "is_interstate", False)
        items_rows = ""
        subtotal = Decimal("0.00")

        for idx, item in enumerate(invoice.items, start=1):
            qty = Decimal(str(item.quantity))
            price = Decimal(str(item.price))
            gst_rate = Decimal(str(item.gst_rate))
            tax_amt = Decimal(str(item.tax_amount))
            tot_amt = Decimal(str(item.total_amount))
            subtotal += (qty * price)

            if is_interstate:
                tax_str = f"IGST ({gst_rate}%): ₹{tax_amt:.2f}"
            else:
                half = gst_rate / Decimal("2")
                half_tax = tax_amt / Decimal("2")
                tax_str = f"CGST ({half}%): ₹{half_tax:.2f} | SGST ({half}%): ₹{half_tax:.2f}"

            items_rows += f"""
            <tr>
              <td>{idx}</td>
              <td>{item.name} <br/><small className="text-muted">HSN: {item.hsn_code or 'N/A'}</small></td>
              <td align="right">{qty:.4f}</td>
              <td align="right">₹{price:.2f}</td>
              <td align="right">{tax_str}</td>
              <td align="right"><strong>₹{tot_amt:.2f}</strong></td>
            </tr>
            """

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <title>Tax Invoice - {invoice.invoice_no}</title>
          <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; margin: 20px; color: #333; }}
            .header {{ text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 20px; }}
            .company-title {{ font-size: 24px; font-weight: bold; color: #1b5e20; }}
            .meta-table {{ width: 100%; margin-bottom: 20px; font-size: 14px; }}
            .items-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
            .items-table th {{ background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left; }}
            .items-table td {{ border: 1px solid #ddd; padding: 8px; font-size: 13px; }}
            .summary-table {{ width: 40%; float: right; border-collapse: collapse; font-size: 14px; }}
            .summary-table td {{ padding: 6px; border-bottom: 1px solid #eee; }}
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-title">{company_name}</div>
            <div>GSTIN: {company_gstin}</div>
            <div style="font-size: 18px; font-weight: bold; margin-top: 5px; color: #333;">TAX INVOICE</div>
          </div>

          <table class="meta-table">
            <tr>
              <td><strong>Invoice No:</strong> {invoice.invoice_no}</td>
              <td align="right"><strong>Date:</strong> {invoice.date}</td>
            </tr>
            <tr>
              <td><strong>Payment Mode:</strong> {invoice.payment_mode or 'CASH'}</td>
              <td align="right"><strong>Place of Supply:</strong> {'Inter-State (IGST)' if is_interstate else 'Intra-State (CGST+SGST)'}</td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th style="text-align: right;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">GST Tax Breakup</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              {items_rows}
            </tbody>
          </table>

          <table class="summary-table">
            <tr>
              <td>Subtotal:</td>
              <td align="right">₹{subtotal:.2f}</td>
            </tr>
            <tr>
              <td>Total GST Tax:</td>
              <td align="right">₹{Decimal(str(invoice.tax_total or 0)):.2f}</td>
            </tr>
            <tr>
              <td><strong>Grand Total:</strong></td>
              <td align="right"><strong>₹{Decimal(str(invoice.grand_total)):.2f}</strong></td>
            </tr>
          </table>
        </body>
        </html>
        """

        return html_template
