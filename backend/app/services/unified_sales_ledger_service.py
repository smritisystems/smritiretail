"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product, StockMovement, ProductBatchStock
from ..models.crm import Customer
from ..models.party import Party


def _quantize_currency(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class UnifiedSalesLedgerService:
    """
    Authoritative Sales Invoicing & Operational Stock Ledger Service for SMRITI Tenant Data Plane.
    Guarantees atomic invoice generation, line-item tax snapshotting, deterministic StockMovement posting,
    and audited reversal idempotency.
    """

    @classmethod
    async def post_sales_invoice(
        cls,
        session: AsyncSession,
        company_id: str,
        invoice_no: str,
        customer_id: str,
        items_data: List[Dict[str, Any]],
        branch_id: str = "BR-001",
        is_interstate: bool = False,
        payment_mode: str = "CASH",
        shift_id: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_gstin: Optional[str] = None
    ) -> SalesInvoice:
        """
        Atomically creates and confirms a sales invoice, permanently snapshotting pricing and taxes,
        and posting exact OUTWARD_SALE movements to the authoritative stock_movements ledger.
        """
        clean_inv_no = invoice_no.strip().upper()
        
        # Check uniqueness
        stmt = select(SalesInvoice).where(
            SalesInvoice.invoice_no == clean_inv_no,
            SalesInvoice.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ValueError(f"Invoice '{clean_inv_no}' already exists in company database.")

        invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
        total_taxable = Decimal("0.00")
        total_tax = Decimal("0.00")
        grand_total = Decimal("0.00")

        invoice_items: List[SalesInvoiceItem] = []
        stock_movements: List[StockMovement] = []

        for idx, itm in enumerate(items_data, start=1):
            product_id = itm["product_id"]
            code = itm.get("code") or itm.get("sku") or f"PROD-{idx}"
            name = itm.get("name") or itm.get("item_name") or "Sales Item"
            qty = Decimal(str(itm.get("quantity", 1.0)))
            price = Decimal(str(itm.get("price", 0.0)))
            mrp = Decimal(str(itm.get("mrp", price)))
            disc_pct = Decimal(str(itm.get("disc_pct", 0.0)))
            gst_rate = Decimal(str(itm.get("gst_rate", 18.0)))
            batch_no = itm.get("batch_no")
            hsn_code = itm.get("hsn_code", "998311")

            # 1. Line Calculations
            discount_multiplier = (Decimal("100.00") - disc_pct) / Decimal("100.00")
            line_taxable = _quantize_currency(qty * price * discount_multiplier)
            
            if is_interstate:
                igst = _quantize_currency(line_taxable * gst_rate / Decimal("100.00"))
                cgst = Decimal("0.00")
                sgst = Decimal("0.00")
            else:
                half_rate = gst_rate / Decimal("2.00")
                cgst = _quantize_currency(line_taxable * half_rate / Decimal("100.00"))
                sgst = _quantize_currency(line_taxable * half_rate / Decimal("100.00"))
                igst = Decimal("0.00")

            line_tax = cgst + sgst + igst
            line_total = line_taxable + line_tax

            total_taxable += line_taxable
            total_tax += line_tax
            grand_total += line_total

            # 2. Invoice Item Record (Permanent Immutable Snapshot)
            inv_item = SalesInvoiceItem(
                invoice_id=invoice_id,
                product_id=product_id,
                code=code,
                name=name,
                batch_no=batch_no,
                quantity=qty,
                price=price,
                mrp=mrp,
                disc_pct=disc_pct,
                taxable_value=line_taxable,
                hsn_code=hsn_code,
                gst_rate=gst_rate,
                cgst_amount=cgst,
                sgst_amount=sgst,
                igst_amount=igst,
                tax_amount=line_tax,
                total_amount=line_total,
                line_no=idx
            )
            invoice_items.append(inv_item)

            # 3. Stock Movement Ledger Entry (Authoritative Stock Truth)
            movement = StockMovement(
                id=f"smv_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                product_id=product_id,
                product_name=name,
                sku=code,
                quantity=-qty,  # Negative debit for sales
                movement_type="OUTWARD_SALE",
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=invoice_id,
                warehouse_id=warehouse_id,
                batch=batch_no,
                unit_cost=price,
                remarks=f"B2B Sale Inv #{clean_inv_no}",
                is_active=True,
                is_deleted=False
            )
            stock_movements.append(movement)

            # 4. Decrement Product Master Stock
            prod_stmt = select(Product).where(Product.id == product_id)
            prod = (await session.execute(prod_stmt)).scalar_one_or_none()
            if prod:
                prod.stock = int(prod.stock - qty)

            # 5. Decrement Batch Stock if applicable
            if batch_no:
                batch_stmt = select(ProductBatchStock).where(
                    ProductBatchStock.product_id == product_id,
                    ProductBatchStock.batch_number == batch_no,
                    ProductBatchStock.is_deleted == False
                )
                batch_stock = (await session.execute(batch_stmt)).scalar_one_or_none()
                if batch_stock:
                    batch_stock.current_stock_qty = Decimal(str(batch_stock.current_stock_qty)) - qty

        # 6. Sales Invoice Master Header
        invoice = SalesInvoice(
            id=invoice_id,
            company_id=company_id,
            branch_id=branch_id,
            invoice_no=clean_inv_no,
            date=datetime.now(timezone.utc).date(),
            customer_id=customer_id,
            customer_name=customer_name or "Walk-in Customer",
            customer_gstin=customer_gstin,
            shift_id=shift_id,
            warehouse_id=warehouse_id,
            taxable_value=total_taxable,
            tax_total=total_tax,
            grand_total=grand_total,
            is_interstate=is_interstate,
            payment_mode=payment_mode,
            status="Confirmed",
            is_active=True,
            is_deleted=False
        )

        session.add(invoice)
        for itm_obj in invoice_items:
            session.add(itm_obj)
        for smv_obj in stock_movements:
            session.add(smv_obj)

        await session.commit()
        session.expire_all()

        # Return refreshed invoice
        res_stmt = (
            select(SalesInvoice)
            .where(SalesInvoice.id == invoice_id)
            .options(selectinload(SalesInvoice.items))
        )
        return (await session.execute(res_stmt)).scalar_one()

    @classmethod
    async def cancel_sales_invoice(
        cls,
        session: AsyncSession,
        company_id: str,
        invoice_no: str,
        reason: str = "Customer Return / Invoice Cancellation",
        branch_id: str = "BR-001"
    ) -> SalesInvoice:
        """
        Idempotently cancels a sales invoice and posts compensating RETURN_INWARD movements
        to restore stock balances across batch and master ledgers.
        """
        clean_inv_no = invoice_no.strip().upper()
        stmt = (
            select(SalesInvoice)
            .where(
                SalesInvoice.invoice_no == clean_inv_no,
                SalesInvoice.is_deleted == False
            )
            .options(selectinload(SalesInvoice.items))
        )
        invoice = (await session.execute(stmt)).scalar_one_or_none()

        if not invoice:
            raise ValueError(f"Invoice '{clean_inv_no}' not found.")
        if invoice.status == "Cancelled":
            return invoice

        # Reversal movements
        for itm in invoice.items:
            qty = Decimal(str(itm.quantity))
            rev_movement = StockMovement(
                id=f"smv_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                product_id=itm.product_id,
                product_name=itm.name,
                sku=itm.code,
                quantity=qty,  # Positive credit restore
                movement_type="RETURN_INWARD",
                reference_doc_type="SALES_INVOICE_CANCEL",
                reference_doc_id=invoice.id,
                warehouse_id=invoice.warehouse_id,
                batch=itm.batch_no,
                unit_cost=itm.price,
                remarks=f"Cancellation Reversal Inv #{clean_inv_no}: {reason}",
                is_active=True,
                is_deleted=False
            )
            session.add(rev_movement)

            # Restore Product master stock
            prod_stmt = select(Product).where(Product.id == itm.product_id)
            prod = (await session.execute(prod_stmt)).scalar_one_or_none()
            if prod:
                prod.stock = int(prod.stock + qty)

            # Restore Batch Stock
            if itm.batch_no:
                batch_stmt = select(ProductBatchStock).where(
                    ProductBatchStock.product_id == itm.product_id,
                    ProductBatchStock.batch_number == itm.batch_no,
                    ProductBatchStock.is_deleted == False
                )
                batch_stock = (await session.execute(batch_stmt)).scalar_one_or_none()
                if batch_stock:
                    batch_stock.current_stock_qty = Decimal(str(batch_stock.current_stock_qty)) + qty

        inv_id = invoice.id
        invoice.status = "Cancelled"
        await session.commit()
        session.expire_all()

        res_stmt = (
            select(SalesInvoice)
            .where(SalesInvoice.id == inv_id)
            .options(selectinload(SalesInvoice.items))
        )
        return (await session.execute(res_stmt)).scalar_one()
