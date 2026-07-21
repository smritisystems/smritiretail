"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

gst_tax_engine.py — Domain service for GST Monthly Tax Settlements, Outward GSTR-1 Return Filing Serialization,
and Statutory E-Way Bill Generation.
"""

import uuid
import json
import math
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.sales import SalesInvoice
from app.models.purchase import PurchaseReceipt
from app.models.tax import GstTaxSettlement, GstReturnFiling, EWayBill


class GstTaxEngine:
    """
    GstTaxEngine — Domain engine managing monthly GST tax set-off calculations,
    GSTR-1 JSON portal filing payload compilation, and E-Way Bill generation.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def calculate_monthly_settlement(self, tax_period: str) -> GstTaxSettlement:
        """
        Calculates monthly GST Output Tax Liability vs Inward Input Tax Credit (ITC) with statutory set-off rules.
        """
        # Fetch outward sales invoices for period
        stmt_sales = select(SalesInvoice).where(
            SalesInvoice.company_id == self.tenant.company_id,
            SalesInvoice.is_deleted == False
        )
        sales_invoices = (await self.db.execute(stmt_sales)).scalars().all()

        period_sales = []
        for inv in sales_invoices:
            dt = inv.invoice_date or inv.created_at or datetime.now(timezone.utc)
            if dt.strftime("%Y-%m") == tax_period:
                period_sales.append(inv)

        outward_cgst = sum(Decimal(str(getattr(inv, "cgst_amount", 0) or 0)) for inv in period_sales)
        outward_sgst = sum(Decimal(str(getattr(inv, "sgst_amount", 0) or 0)) for inv in period_sales)
        outward_igst = sum(Decimal(str(getattr(inv, "igst_amount", 0) or 0)) for inv in period_sales)

        if outward_cgst == 0 and outward_sgst == 0 and outward_igst == 0:
            total_tax = sum(Decimal(str(getattr(inv, "tax_total", 0) or 0)) for inv in period_sales)
            outward_cgst = (total_tax / Decimal("2")).quantize(Decimal("0.01"))
            outward_sgst = (total_tax / Decimal("2")).quantize(Decimal("0.01"))

        tot_outward = (outward_cgst + outward_sgst + outward_igst).quantize(Decimal("0.01"))

        # Fetch inward purchase receipts for period
        stmt_receipts = select(PurchaseReceipt).where(
            PurchaseReceipt.company_id == self.tenant.company_id,
            PurchaseReceipt.is_deleted == False
        )
        purchase_receipts = (await self.db.execute(stmt_receipts)).scalars().all()

        period_purchases = []
        for rcpt in purchase_receipts:
            dt = rcpt.created_at or datetime.now(timezone.utc)
            if dt.strftime("%Y-%m") == tax_period:
                period_purchases.append(rcpt)

        tot_inward_tax = sum(Decimal(str(getattr(rcpt, "tax_total", 0) or 0)) for rcpt in period_purchases)
        inward_itc_cgst = (tot_inward_tax / Decimal("2")).quantize(Decimal("0.01"))
        inward_itc_sgst = (tot_inward_tax / Decimal("2")).quantize(Decimal("0.01"))
        inward_itc_igst = Decimal("0.00")
        tot_inward_itc = (inward_itc_cgst + inward_itc_sgst + inward_itc_igst).quantize(Decimal("0.01"))

        # Apply statutory set-off
        net_cgst = max(Decimal("0.00"), outward_cgst - inward_itc_cgst).quantize(Decimal("0.01"))
        net_sgst = max(Decimal("0.00"), outward_sgst - inward_itc_sgst).quantize(Decimal("0.01"))
        net_igst = max(Decimal("0.00"), outward_igst - inward_itc_igst).quantize(Decimal("0.01"))
        tot_net_payable = (net_cgst + net_sgst + net_igst).quantize(Decimal("0.01"))

        carry_forward = max(Decimal("0.00"), tot_inward_itc - tot_outward).quantize(Decimal("0.01"))

        settlement_id = f"gst-set-{uuid.uuid4().hex[:12]}"
        settlement_no = f"SETT-{tax_period.replace('-', '')}-{uuid.uuid4().hex[:4].upper()}"

        settlement = GstTaxSettlement(
            id=settlement_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            settlement_no=settlement_no,
            tax_period=tax_period,
            outward_cgst=outward_cgst,
            outward_sgst=outward_sgst,
            outward_igst=outward_igst,
            total_outward_tax=tot_outward,
            inward_itc_cgst=inward_itc_cgst,
            inward_itc_sgst=inward_itc_sgst,
            inward_itc_igst=inward_itc_igst,
            total_inward_itc=tot_inward_itc,
            net_cgst_payable=net_cgst,
            net_sgst_payable=net_sgst,
            net_igst_payable=net_igst,
            total_net_tax_payable=tot_net_payable,
            carry_forward_itc=carry_forward,
            status="CALCULATED"
        )

        self.db.add(settlement)
        await self.db.commit()
        return settlement

    async def generate_gstr1_payload(self, tax_period: str) -> GstReturnFiling:
        """
        Compiles structured GSTR-1 return filing JSON payload for GSTN portal submission.
        """
        stmt = select(SalesInvoice).where(
            SalesInvoice.company_id == self.tenant.company_id,
            SalesInvoice.is_deleted == False
        )
        sales_invoices = (await self.db.execute(stmt)).scalars().all()

        period_sales = []
        for inv in sales_invoices:
            dt = inv.invoice_date or inv.created_at or datetime.now(timezone.utc)
            if dt.strftime("%Y-%m") == tax_period:
                period_sales.append(inv)

        b2b_invs = []
        b2c_invs = []
        tot_taxable = Decimal("0.00")
        tot_tax = Decimal("0.00")

        for inv in period_sales:
            taxable = Decimal(str(inv.subtotal or 0))
            tax_amt = Decimal(str(inv.tax_total or 0))
            tot_taxable += taxable
            tot_tax += tax_amt

            inv_entry = {
                "inum": inv.invoice_no,
                "idt": inv.invoice_date.strftime("%d-%m-%Y") if inv.invoice_date else "",
                "val": float(inv.grand_total),
                "pos": "27",
                "inv_typ": "R"
            }

            if getattr(inv, "notes", "") and "GSTIN:" in str(inv.notes):
                b2b_invs.append(inv_entry)
            else:
                b2c_invs.append(inv_entry)

        payload = {
            "gstin": "27AAAAA0000A1Z5",
            "fp": tax_period.replace("-", ""),
            "b2b": b2b_invs,
            "b2cs": b2c_invs,
            "hsn": {"data": []}
        }

        filing_id = f"gst-fil-{uuid.uuid4().hex[:12]}"
        filing_no = f"GSTR1-{tax_period.replace('-', '')}-{uuid.uuid4().hex[:4].upper()}"

        filing = GstReturnFiling(
            id=filing_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            filing_no=filing_no,
            return_type="GSTR1",
            tax_period=tax_period,
            gstr1_payload_json=json.dumps(payload),
            b2b_invoices_count=len(b2b_invs),
            b2c_invoices_count=len(b2c_invs),
            credit_notes_count=0,
            total_taxable_value=tot_taxable.quantize(Decimal("0.01")),
            total_tax_amount=tot_tax.quantize(Decimal("0.01")),
            status="GENERATED"
        )

        self.db.add(filing)
        await self.db.commit()
        return filing

    async def generate_eway_bill(
        self,
        invoice_id: str,
        transporter_id: Optional[str] = None,
        transporter_name: Optional[str] = None,
        transport_mode: str = "ROAD",
        vehicle_no: Optional[str] = None,
        distance_km: Decimal = Decimal("100.00")
    ) -> EWayBill:
        """
        Generates a statutory E-Way Bill for consignments exceeding statutory threshold (₹50,000).
        """
        stmt = select(SalesInvoice).where(
            SalesInvoice.id == invoice_id,
            SalesInvoice.company_id == self.tenant.company_id,
            SalesInvoice.is_deleted == False
        )
        invoice = (await self.db.execute(stmt)).scalars().first()

        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice '{invoice_id}' not found.")

        consignment_val = Decimal(str(invoice.grand_total))
        if consignment_val < Decimal("50000.00"):
            raise HTTPException(
                status_code=400,
                detail=f"Consignment value (₹{consignment_val}) is below E-Way Bill statutory threshold of ₹50,000."
            )

        # Distance validity calculation: 1 day per 200 km (minimum 1 day)
        days_valid = max(1, math.ceil(float(distance_km) / 200.0))
        now = datetime.now(timezone.utc)
        valid_until = now + timedelta(days=days_valid)

        ewb_id = f"ewb-{uuid.uuid4().hex[:12]}"
        ewb_no = f"EWB-{uuid.uuid4().hex[:12].upper()}"

        ewb = EWayBill(
            id=ewb_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            eway_bill_no=ewb_no,
            invoice_id=invoice_id,
            consignment_value=consignment_val,
            transporter_id=transporter_id,
            transporter_name=transporter_name,
            transport_mode=transport_mode.upper(),
            vehicle_no=vehicle_no,
            distance_km=distance_km,
            valid_from=now,
            valid_until=valid_until,
            status="GENERATED"
        )

        self.db.add(ewb)
        await self.db.commit()
        return ewb
