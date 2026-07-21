"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

return_engine.py — Domain service for Outbound Sales Returns, Product Condition Evaluation,
Inventory Restocking, and Credit Note Tax Reversals.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem, CreditNote
from app.models.crm import Customer
from app.models.inventory import Product


class SalesReturnEngine:
    """
    SalesReturnEngine — Domain Engine managing Outbound Customer Returns,
    Restockable vs Damaged inspection, inventory updates, and CreditNote issuance.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def create_sales_return(
        self,
        invoice_id: str,
        items: List[Dict[str, Any]],
        reason: Optional[str] = None
    ) -> SalesReturn:
        """
        Creates a draft SalesReturn linked to a valid SalesInvoice.
        Validates return line quantities against invoiced item quantities.
        """
        stmt = select(SalesInvoice).where(
            SalesInvoice.id == invoice_id,
            SalesInvoice.is_deleted == False,
            SalesInvoice.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        invoice = res.scalars().first()

        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice '{invoice_id}' not found.")

        if not items:
            raise HTTPException(status_code=400, detail="Sales return must include at least one return item line.")

        inv_items_stmt = select(SalesInvoiceItem).where(SalesInvoiceItem.invoice_id == invoice_id)
        inv_items = {item.product_id: item for item in (await self.db.execute(inv_items_stmt)).scalars().all()}

        return_id = f"ret-{uuid.uuid4().hex[:12]}"
        return_no = f"RET-{uuid.uuid4().hex[:8].upper()}"

        return_order = SalesReturn(
            id=return_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            return_no=return_no,
            invoice_id=invoice_id,
            customer_id=invoice.customer_id,
            return_date=datetime.now(timezone.utc),
            reason=reason,
            status="Draft",
            refund_amount=Decimal("0.00")
        )

        return_items = []
        for line in items:
            p_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity", 0)))

            if p_id not in inv_items:
                raise HTTPException(status_code=400, detail=f"Product '{p_id}' was not invoiced on invoice '{invoice_id}'.")

            inv_item = inv_items[p_id]
            invoiced_qty = Decimal(str(inv_item.quantity))

            if qty <= Decimal("0.00"):
                raise HTTPException(status_code=400, detail=f"Return quantity for product '{p_id}' must be greater than zero.")

            if qty > invoiced_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Requested return quantity ({qty}) for product '{p_id}' exceeds invoiced quantity ({invoiced_qty})."
                )

            unit_price = Decimal(str(inv_item.unit_price))
            gst_pct = Decimal(str(inv_item.gst_percentage))
            condition = line.get("condition", "Restockable").capitalize()

            line_sub = qty * unit_price
            cgst = (line_sub * (gst_pct / Decimal("2.00"))) / Decimal("100.00") if inv_item.cgst_amount > 0 else Decimal("0.00")
            sgst = (line_sub * (gst_pct / Decimal("2.00"))) / Decimal("100.00") if inv_item.sgst_amount > 0 else Decimal("0.00")
            igst = (line_sub * gst_pct) / Decimal("100.00") if inv_item.igst_amount > 0 else Decimal("0.00")
            line_tot = line_sub + cgst + sgst + igst

            ret_item = SalesReturnItem(
                id=f"ret-item-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                return_id=return_id,
                product_id=p_id,
                quantity=qty,
                unit_price=unit_price,
                condition=condition,
                gst_percentage=gst_pct,
                cgst_amount=cgst.quantize(Decimal("0.01")),
                sgst_amount=sgst.quantize(Decimal("0.01")),
                igst_amount=igst.quantize(Decimal("0.01")),
                line_total=line_tot.quantize(Decimal("0.01"))
            )
            return_items.append(ret_item)

        return_order.items = return_items

        self.db.add(return_order)
        self.db.add_all(return_items)
        await self.db.commit()
        return return_order

    async def evaluate_and_process_return(
        self,
        return_id: str,
        line_conditions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates product return line conditions (Restockable vs Damaged).
        Restocks usable inventory into Product.stock, issues CreditNote with GST reversal,
        and updates Customer.outstanding balance.
        """
        stmt = select(SalesReturn).where(
            SalesReturn.id == return_id,
            SalesReturn.is_deleted == False,
            SalesReturn.company_id == self.tenant.company_id
        )
        res = await self.db.execute(stmt)
        return_order = res.scalars().first()

        if not return_order:
            raise HTTPException(status_code=404, detail=f"Sales return order '{return_id}' not found.")

        # Update line conditions if provided
        if line_conditions:
            cond_map = {c["product_id"]: c.get("condition", "Restockable").capitalize() for c in line_conditions if "product_id" in c}
            for item in return_order.items:
                if item.product_id in cond_map:
                    item.condition = cond_map[item.product_id]

        subtotal = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")

        for item in return_order.items:
            qty = Decimal(str(item.quantity))
            price = Decimal(str(item.unit_price))
            line_sub = qty * price
            subtotal += line_sub

            total_cgst += Decimal(str(item.cgst_amount))
            total_sgst += Decimal(str(item.sgst_amount))
            total_igst += Decimal(str(item.igst_amount))

            # Restock salable inventory if Restockable
            if item.condition == "Restockable":
                p_stmt = select(Product).where(Product.id == item.product_id)
                product = (await self.db.execute(p_stmt)).scalars().first()
                if product:
                    product.stock = product.stock + int(qty)
                    self.db.add(product)

        tax_total = (total_cgst + total_sgst + total_igst).quantize(Decimal("0.01"))
        grand_total = (subtotal + tax_total).quantize(Decimal("0.01"))

        # Issue CreditNote
        cn_id = f"cn-{uuid.uuid4().hex[:12]}"
        cn_no = f"CN-{uuid.uuid4().hex[:8].upper()}"

        credit_note = CreditNote(
            id=cn_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            credit_note_no=cn_no,
            return_id=return_id,
            invoice_id=return_order.invoice_id,
            customer_id=return_order.customer_id,
            issue_date=datetime.now(timezone.utc),
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_amount=tax_total,
            cgst_amount=total_cgst.quantize(Decimal("0.01")),
            sgst_amount=total_sgst.quantize(Decimal("0.01")),
            igst_amount=total_igst.quantize(Decimal("0.01")),
            grand_total=grand_total,
            status="Issued"
        )
        self.db.add(credit_note)

        # Update SalesReturn status
        return_order.status = "Approved"
        return_order.refund_amount = grand_total
        return_order.credit_note_id = cn_id
        self.db.add(return_order)

        # Reduce Customer.outstanding balance
        cust_stmt = select(Customer).where(Customer.id == return_order.customer_id)
        customer = (await self.db.execute(cust_stmt)).scalars().first()
        if customer:
            curr_outstanding = Decimal(str(getattr(customer, "outstanding", 0) or 0))
            new_outstanding = max(Decimal("0.00"), curr_outstanding - grand_total)
            customer.outstanding = new_outstanding
            self.db.add(customer)

        await self.db.commit()
        return {
            "sales_return": return_order,
            "credit_note": credit_note
        }
