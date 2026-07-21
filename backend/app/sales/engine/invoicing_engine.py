"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

invoicing_engine.py — Domain service for Outbound Sales Invoicing, GST tax breakdown,
and Multi-Channel Payment Settlements.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.sales import SalesOrder, SalesOrderItem, SalesInvoice, SalesInvoiceItem, SalesPayment
from app.models.crm import Customer
from app.models.inventory import Product


class SalesInvoicingEngine:
    """
    SalesInvoicingEngine — Domain Engine managing Outbound Customer Invoicing,
    GST tax calculation, and multi-channel payment settlements.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def generate_invoice_from_order(self, order_id: str, is_interstate: bool = False) -> SalesInvoice:
        """
        Converts a Confirmed/Shipped SalesOrder into a tax-compliant SalesInvoice.
        Calculates item-level subtotal, GST (CGST/SGST or IGST), and invoice grand total.
        """
        stmt = (
            select(SalesOrder)
            .where(
                SalesOrder.id == order_id,
                SalesOrder.is_deleted == False,
                SalesOrder.company_id == self.tenant.company_id
            )
        )
        res = await self.db.execute(stmt)
        order = res.scalars().first()

        if not order:
            raise HTTPException(status_code=404, detail=f"Sales order '{order_id}' not found.")

        # Fetch Order Items
        items_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == order_id)
        items = (await self.db.execute(items_stmt)).scalars().all()

        if not items:
            raise HTTPException(status_code=400, detail=f"Sales order '{order_id}' has no line items.")

        invoice_id = f"inv-{uuid.uuid4().hex[:12]}"
        invoice_no = f"INV-{uuid.uuid4().hex[:8].upper()}"

        subtotal = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")
        invoice_items = []

        for item in items:
            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()

            gst_pct = Decimal(str(getattr(product, "gst_percentage", 18.0) or 18.0))
            qty = Decimal(str(item.ordered_quantity))
            price = Decimal(str(item.unit_price))

            line_subtotal = qty * price
            subtotal += line_subtotal

            if is_interstate:
                igst = (line_subtotal * gst_pct) / Decimal("100.00")
                cgst = Decimal("0.00")
                sgst = Decimal("0.00")
                total_igst += igst
            else:
                cgst = (line_subtotal * (gst_pct / Decimal("2.00"))) / Decimal("100.00")
                sgst = (line_subtotal * (gst_pct / Decimal("2.00"))) / Decimal("100.00")
                igst = Decimal("0.00")
                total_cgst += cgst
                total_sgst += sgst

            line_tot = line_subtotal + cgst + sgst + igst

            inv_item = SalesInvoiceItem(
                id=f"inv-item-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                invoice_id=invoice_id,
                product_id=item.product_id,
                quantity=qty,
                unit_price=price,
                gst_percentage=gst_pct,
                cgst_amount=cgst.quantize(Decimal("0.01")),
                sgst_amount=sgst.quantize(Decimal("0.01")),
                igst_amount=igst.quantize(Decimal("0.01")),
                line_total=line_tot.quantize(Decimal("0.01"))
            )
            invoice_items.append(inv_item)

        tax_total = (total_cgst + total_sgst + total_igst).quantize(Decimal("0.01"))
        grand_total = (subtotal + tax_total).quantize(Decimal("0.01"))

        invoice = SalesInvoice(
            id=invoice_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            invoice_no=invoice_no,
            order_id=order_id,
            customer_id=order.customer_id,
            invoice_date=datetime.now(timezone.utc),
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total,
            cgst_amount=total_cgst.quantize(Decimal("0.01")),
            sgst_amount=total_sgst.quantize(Decimal("0.01")),
            igst_amount=total_igst.quantize(Decimal("0.01")),
            grand_total=grand_total,
            paid_amount=Decimal("0.00"),
            balance_due=grand_total,
            status="Unpaid"
        )
        invoice.items = invoice_items

        self.db.add(invoice)
        self.db.add_all(invoice_items)
        await self.db.commit()
        return invoice

    async def record_payment(
        self,
        invoice_id: str,
        amount: Decimal,
        payment_mode: str,
        reference_no: Optional[str] = None,
        notes: Optional[str] = None
    ) -> SalesPayment:
        """
        Records customer payment receipt (CASH, CARD, UPI, CREDIT).
        Updates invoice balance_due, payment status, and Customer.outstanding ledger.
        """
        if amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

        valid_modes = ["CASH", "CARD", "UPI", "CREDIT"]
        if payment_mode.upper() not in valid_modes:
            raise HTTPException(status_code=400, detail=f"Invalid payment_mode '{payment_mode}'. Must be one of {valid_modes}.")

        stmt = select(SalesInvoice).where(
            SalesInvoice.id == invoice_id,
            SalesInvoice.is_deleted == False,
            SalesInvoice.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        invoice = res.scalars().first()

        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice '{invoice_id}' not found.")

        current_balance = Decimal(str(invoice.balance_due))
        if amount > current_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Payment amount ({amount}) exceeds remaining invoice balance due ({current_balance})."
            )

        payment_id = f"pay-{uuid.uuid4().hex[:12]}"
        payment_no = f"PAY-{uuid.uuid4().hex[:8].upper()}"

        payment = SalesPayment(
            id=payment_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            payment_no=payment_no,
            invoice_id=invoice_id,
            customer_id=invoice.customer_id,
            payment_date=datetime.now(timezone.utc),
            payment_mode=payment_mode.upper(),
            amount=amount,
            reference_no=reference_no,
            notes=notes
        )
        self.db.add(payment)

        # Update Invoice balance
        new_paid = Decimal(str(invoice.paid_amount)) + amount
        new_balance = current_balance - amount
        invoice.paid_amount = new_paid
        invoice.balance_due = new_balance

        if new_balance == Decimal("0.00"):
            invoice.status = "Paid"
        else:
            invoice.status = "Partial"
        self.db.add(invoice)

        # Update Customer outstanding ledger
        cust_stmt = select(Customer).where(Customer.id == invoice.customer_id)
        customer = (await self.db.execute(cust_stmt)).scalars().first()

        if customer:
            curr_outstanding = Decimal(str(getattr(customer, "outstanding", 0) or 0))
            if payment_mode.upper() == "CREDIT":
                # Credit sale increases customer outstanding balance
                customer.outstanding = curr_outstanding + amount
            else:
                # Cash/Card/UPI payment decreases customer outstanding balance if balance exists
                new_outstanding = max(Decimal("0.00"), curr_outstanding - amount)
                customer.outstanding = new_outstanding
            self.db.add(customer)

        await self.db.commit()
        return payment

    async def get_customer_statement(self, customer_id: str) -> Dict[str, Any]:
        """
        Retrieves complete invoice ledger and outstanding balance statement for a customer.
        """
        cust_stmt = select(Customer).where(Customer.id == customer_id, Customer.company_id == self.tenant.company_id)
        customer = (await self.db.execute(cust_stmt)).scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")

        inv_stmt = select(SalesInvoice).where(
            SalesInvoice.customer_id == customer_id,
            SalesInvoice.is_deleted == False
        )
        invoices = (await self.db.execute(inv_stmt)).scalars().all()

        total_billed = sum(Decimal(str(i.grand_total)) for i in invoices)
        total_paid = sum(Decimal(str(i.paid_amount)) for i in invoices)
        total_due = sum(Decimal(str(i.balance_due)) for i in invoices)

        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_code": customer.code,
            "total_invoices": len(invoices),
            "total_billed": float(total_billed),
            "total_paid": float(total_paid),
            "total_due": float(total_due),
            "current_outstanding": float(getattr(customer, "outstanding", 0) or 0)
        }
