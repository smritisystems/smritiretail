"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Consignment / Modern Trade Service -- Implements transfer, dispatch, sales reporting,
settlement, and stock updates for Modern Trade retail chain stores.
"""

import uuid
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from ..models.consignment import (
    ConsignmentPartner, ConsignmentTransfer, ConsignmentTransferItem,
    ConsignmentSaleReport, ConsignmentSaleReportItem,
    ConsignmentSettlement, ConsignmentReturn, ConsignmentReturnItem
)
from ..models.crm import Customer
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.inventory import Product, StockMovement
from ..schemas.consignment import (
    ConsignmentPartnerCreate, ConsignmentPartnerUpdate,
    ConsignmentTransferCreate, ConsignmentSaleReportCreate,
    ConsignmentSettlementCreate, ConsignmentReturnCreate
)
from .numbering import numbering_service
from .accounting import accounting_service
from ..api.deps import TenantContext


class ConsignmentService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    # ──────────────────────────────────────────────────────────────
    # Consignment Partners
    # ──────────────────────────────────────────────────────────────

    async def create_partner(self, partner_in: ConsignmentPartnerCreate) -> ConsignmentPartner:
        partner_id = f"CP-{uuid.uuid4().hex[:8]}"
        
        # Check duplicate code
        existing = await self.db.execute(
            select(ConsignmentPartner).filter(
                ConsignmentPartner.code == partner_in.code,
                ConsignmentPartner.is_deleted == False,
                ConsignmentPartner.company_id == self.tenant_ctx.company_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Consignment partner with this code already exists")

        # 1. Create matching shadow Customer profile so billing, printing, and ledgers work out-of-the-box
        customer = Customer(
            id=partner_id,
            uuid=str(uuid.uuid4()),
            customer_group_id="CG-Retail",
            name=partner_in.name,
            mobile=partner_in.code, # use code as identifier
            status="Active",
            outstanding=0.00,
            billing_address_line1=partner_in.billing_address,
            shipping_address_line1=partner_in.shipping_address,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(customer)

        # 2. Create partner
        db_partner = ConsignmentPartner(
            id=partner_id,
            uuid=str(uuid.uuid4()),
            name=partner_in.name,
            code=partner_in.code,
            gst_number=partner_in.gst_number,
            status=partner_in.status,
            billing_address=partner_in.billing_address,
            shipping_address=partner_in.shipping_address,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_partner)
        await self.db.commit()
        await self.db.refresh(db_partner)
        return db_partner

    async def get_partners(self) -> List[ConsignmentPartner]:
        res = await self.db.execute(
            select(ConsignmentPartner).filter(
                ConsignmentPartner.is_deleted == False,
                ConsignmentPartner.company_id == self.tenant_ctx.company_id
            )
        )
        return list(res.scalars().all())

    async def get_partner(self, partner_id: str) -> Optional[ConsignmentPartner]:
        res = await self.db.execute(
            select(ConsignmentPartner).filter(
                ConsignmentPartner.id == partner_id,
                ConsignmentPartner.is_deleted == False,
                ConsignmentPartner.company_id == self.tenant_ctx.company_id
            )
        )
        return res.scalars().first()

    # ──────────────────────────────────────────────────────────────
    # Consignment Stock Transfers
    # ──────────────────────────────────────────────────────────────

    async def create_transfer(self, transfer_in: ConsignmentTransferCreate) -> ConsignmentTransfer:
        transfer_id = f"CT-{uuid.uuid4().hex[:8]}"
        transfer_no = await numbering_service.next("CT", self.tenant_ctx.branch_id, self.db)

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        transfer_items = []

        for item in transfer_in.items:
            qty = Decimal(str(item.qty_sent))
            rate = Decimal(str(item.rate))
            gst = Decimal(str(item.gst_rate))
            
            tax = (qty * rate * (gst / Decimal("100.00"))).quantize(Decimal("0.01"))
            total = (qty * rate + tax).quantize(Decimal("0.01"))
            
            tax_total += tax
            grand_total += total

            db_item = ConsignmentTransferItem(
                id=f"CTI-{uuid.uuid4().hex[:8]}",
                uuid=str(uuid.uuid4()),
                transfer_id=transfer_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                hsn_code=item.hsn_code,
                qty_sent=qty,
                qty_sold=Decimal("0.00"),
                qty_returned=Decimal("0.00"),
                qty_on_hand=qty,
                rate=rate,
                gst_rate=gst,
                tax_amount=tax,
                total_amount=total,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            transfer_items.append(db_item)

        db_transfer = ConsignmentTransfer(
            id=transfer_id,
            uuid=str(uuid.uuid4()),
            partner_id=transfer_in.partner_id,
            transfer_no=transfer_no,
            transfer_date=transfer_in.transfer_date,
            status="Draft",
            tax_total=tax_total,
            grand_total=grand_total,
            notes=transfer_in.notes,
            items=transfer_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_transfer)
        await self.db.commit()
        await self.db.refresh(db_transfer)
        return db_transfer

    async def get_transfers(self) -> List[ConsignmentTransfer]:
        res = await self.db.execute(
            select(ConsignmentTransfer)
            .options(selectinload(ConsignmentTransfer.items))
            .filter(
                ConsignmentTransfer.is_deleted == False,
                ConsignmentTransfer.company_id == self.tenant_ctx.company_id
            )
        )
        return list(res.scalars().all())

    async def get_transfer(self, transfer_id: str) -> Optional[ConsignmentTransfer]:
        res = await self.db.execute(
            select(ConsignmentTransfer)
            .options(selectinload(ConsignmentTransfer.items))
            .filter(
                ConsignmentTransfer.id == transfer_id,
                ConsignmentTransfer.is_deleted == False,
                ConsignmentTransfer.company_id == self.tenant_ctx.company_id
            )
        )
        return res.scalars().first()

    async def dispatch_transfer(self, transfer_id: str) -> ConsignmentTransfer:
        transfer = await self.get_transfer(transfer_id)
        if not transfer:
            raise HTTPException(status_code=404, detail="Consignment transfer not found")
        if transfer.status != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft transfers can be dispatched")

        # 1. Verify and deduct stock, record StockMovements
        for item in transfer.items:
            product_res = await self.db.execute(
                select(Product).filter(
                    Product.id == item.product_id,
                    Product.is_deleted == False,
                    Product.company_id == self.tenant_ctx.company_id
                )
            )
            product = product_res.scalars().first()
            if not product:
                raise HTTPException(status_code=400, detail=f"Product {item.name} not found")
            if product.tracking_mode != "No-stock":
                if product.stock < float(item.qty_sent):
                    raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product.name}")
                product.stock -= int(item.qty_sent)
                self.db.add(product)

            # Record StockMovement OUT
            movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
            db_movement = StockMovement(
                id=movement_id,
                uuid=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=item.name,
                sku=item.code,
                quantity=-float(item.qty_sent),
                movement_type="OUT",
                reference_doc_type="Consignment Transfer",
                reference_doc_id=transfer.id,
                warehouse="Consignment Store",
                unit_cost=product.cost_price or float(item.rate),
                remarks=f"Consignment stock dispatched to partner {transfer.partner_id}",
                source_module="Consignment",
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            self.db.add(db_movement)

        # 2. Generate the Tax Invoice (legal movement document)
        invoice_id = f"INV-{uuid.uuid4().hex[:8]}"
        invoice_no = await numbering_service.next("INV", self.tenant_ctx.branch_id, self.db)

        invoice_items = []
        for item in transfer.items:
            invoice_items.append(
                SalesInvoiceItem(
                    id=f"SVI-{uuid.uuid4().hex[:8]}",
                    uuid=str(uuid.uuid4()),
                    product_id=item.product_id,
                    code=item.code,
                    name=item.name,
                    quantity=item.qty_sent,
                    price=item.rate,
                    hsn_code=item.hsn_code,
                    gst_rate=item.gst_rate,
                    tax_amount=item.tax_amount,
                    total_amount=item.total_amount,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
            )

        db_invoice = SalesInvoice(
            id=invoice_id,
            uuid=str(uuid.uuid4()),
            invoice_no=invoice_no,
            date=transfer.transfer_date,
            customer_id=transfer.partner_id, # shadow customer
            tax_total=transfer.tax_total,
            grand_total=transfer.grand_total,
            status="Posted", # dispatched stock is backed by posted tax invoice
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_invoice)

        # Link invoice back
        transfer.invoice_id = invoice_id
        transfer.status = "Dispatched"
        self.db.add(transfer)

        await self.db.commit()
        await self.db.refresh(transfer)
        return transfer

    # ──────────────────────────────────────────────────────────────
    # Consignment Sales Reports
    # ──────────────────────────────────────────────────────────────

    async def submit_sale_report(self, report_in: ConsignmentSaleReportCreate) -> ConsignmentSaleReport:
        report_id = f"CSR-{uuid.uuid4().hex[:8]}"
        report_no = await numbering_service.next("CSR", self.tenant_ctx.branch_id, self.db)

        total_sales_value = Decimal("0.00")
        total_tax_value = Decimal("0.00")
        report_items = []

        for item in report_in.items:
            # Verify transfer item
            t_item_res = await self.db.execute(
                select(ConsignmentTransferItem).filter(
                    ConsignmentTransferItem.id == item.transfer_item_id,
                    ConsignmentTransferItem.is_deleted == False
                )
            )
            t_item = t_item_res.scalars().first()
            if not t_item:
                raise HTTPException(status_code=400, detail="Invalid transfer item ID")

            qty = Decimal(str(item.qty_sold))
            rate = Decimal(str(item.rate))
            gst = Decimal(str(item.gst_rate))

            # Validate that they aren't reporting more than what's left on hand
            if t_item.qty_on_hand < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot report sale of {qty} units; only {t_item.qty_on_hand} remaining on hand."
                )

            tax = (qty * rate * (gst / Decimal("100.00"))).quantize(Decimal("0.01"))
            total = (qty * rate + tax).quantize(Decimal("0.01"))

            total_sales_value += total
            total_tax_value += tax

            db_item = ConsignmentSaleReportItem(
                id=f"CSRI-{uuid.uuid4().hex[:8]}",
                uuid=str(uuid.uuid4()),
                report_id=report_id,
                transfer_item_id=item.transfer_item_id,
                product_id=item.product_id,
                qty_sold=qty,
                rate=rate,
                gst_rate=gst,
                tax_amount=tax,
                total_amount=total,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            report_items.append(db_item)

        db_report = ConsignmentSaleReport(
            id=report_id,
            uuid=str(uuid.uuid4()),
            partner_id=report_in.partner_id,
            report_no=report_no,
            report_date=report_in.report_date,
            status="Submitted",
            total_sales_value=total_sales_value,
            total_tax_value=total_tax_value,
            notes=report_in.notes,
            items=report_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_report)
        await self.db.commit()
        await self.db.refresh(db_report)
        return db_report

    async def get_sale_reports(self) -> List[ConsignmentSaleReport]:
        res = await self.db.execute(
            select(ConsignmentSaleReport)
            .options(selectinload(ConsignmentSaleReport.items))
            .filter(
                ConsignmentSaleReport.is_deleted == False,
                ConsignmentSaleReport.company_id == self.tenant_ctx.company_id
            )
        )
        return list(res.scalars().all())

    async def process_sale_report(self, report_id: str) -> ConsignmentSaleReport:
        res = await self.db.execute(
            select(ConsignmentSaleReport)
            .options(selectinload(ConsignmentSaleReport.items))
            .filter(ConsignmentSaleReport.id == report_id)
        )
        report = res.scalars().first()
        if not report:
            raise HTTPException(status_code=404, detail="Sale report not found")
        if report.status != "Submitted":
            raise HTTPException(status_code=400, detail="Only Submitted reports can be processed")

        # 1. Deduct quantities from transfer items
        for item in report.items:
            t_item_res = await self.db.execute(
                select(ConsignmentTransferItem).filter(
                    ConsignmentTransferItem.id == item.transfer_item_id
                )
            )
            t_item = t_item_res.scalars().first()
            if not t_item:
                raise HTTPException(status_code=500, detail="Linked transfer line missing")
            
            # double check qty
            if t_item.qty_on_hand < item.qty_sold:
                raise HTTPException(status_code=400, detail=f"Insufficient consignment stock on hand for transfer item {t_item.id}")
            
            t_item.qty_sold += item.qty_sold
            t_item.qty_on_hand -= item.qty_sold
            self.db.add(t_item)

        # 2. Update shadow customer outstanding balance
        cust_res = await self.db.execute(
            select(Customer).filter(Customer.id == report.partner_id)
        )
        cust = cust_res.scalars().first()
        if cust:
            cust.outstanding += float(report.total_sales_value)
            self.db.add(cust)

        # 3. Post to accounting ledger (Accounts Receivable Dr, Consignment Sales Cr)
        await accounting_service.post_journal(
            credit_ledger_id="ConsignmentSalesRevenue",
            debit_ledger_id=f"Receivables-{report.partner_id}",
            amount=report.total_sales_value,
            narration=f"Consignment sales recognized from report {report.report_no}",
            db=self.db,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        report.status = "Processed"
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        return report

    # ──────────────────────────────────────────────────────────────
    # Consignment Settlements
    # ──────────────────────────────────────────────────────────────

    async def create_settlement(self, settlement_in: ConsignmentSettlementCreate) -> ConsignmentSettlement:
        settlement_id = f"CS-{uuid.uuid4().hex[:8]}"
        settlement_no = await numbering_service.next("CS", self.tenant_ctx.branch_id, self.db)

        # 1. Update shadow customer outstanding balance
        cust_res = await self.db.execute(
            select(Customer).filter(Customer.id == settlement_in.partner_id)
        )
        cust = cust_res.scalars().first()
        if cust:
            # Deduct paid amount + deduction adjustments
            cust.outstanding -= float(settlement_in.paid_amount + settlement_in.total_deductions)
            self.db.add(cust)

        # 2. Post to accounting ledger (Bank Dr, deductions Dr, Receivables Cr)
        if settlement_in.paid_amount > 0:
            await accounting_service.post_journal(
                credit_ledger_id=f"Receivables-{settlement_in.partner_id}",
                debit_ledger_id="BankAccount",
                amount=settlement_in.paid_amount,
                narration=f"Consignment settlement payment received: {settlement_no}",
                db=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
        if settlement_in.total_deductions > 0:
            await accounting_service.post_journal(
                credit_ledger_id=f"Receivables-{settlement_in.partner_id}",
                debit_ledger_id="ConsignmentDeductionsExpense",
                amount=settlement_in.total_deductions,
                narration=f"Consignment settlement deductions (listing/marketing): {settlement_no}",
                db=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )

        db_settlement = ConsignmentSettlement(
            id=settlement_id,
            uuid=str(uuid.uuid4()),
            partner_id=settlement_in.partner_id,
            settlement_no=settlement_no,
            settlement_date=settlement_in.settlement_date,
            status="Paid",
            total_amount_due=settlement_in.total_amount_due,
            total_deductions=settlement_in.total_deductions,
            net_amount_payable=settlement_in.net_amount_payable,
            paid_amount=settlement_in.paid_amount,
            deduction_details=settlement_in.deduction_details,
            notes=settlement_in.notes,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_settlement)
        await self.db.commit()
        await self.db.refresh(db_settlement)
        return db_settlement

    async def get_settlements(self) -> List[ConsignmentSettlement]:
        res = await self.db.execute(
            select(ConsignmentSettlement).filter(
                ConsignmentSettlement.is_deleted == False,
                ConsignmentSettlement.company_id == self.tenant_ctx.company_id
            )
        )
        return list(res.scalars().all())

    # ──────────────────────────────────────────────────────────────
    # Consignment Returns
    # ──────────────────────────────────────────────────────────────

    async def process_return(self, return_in: ConsignmentReturnCreate) -> ConsignmentReturn:
        return_id = f"CR-{uuid.uuid4().hex[:8]}"
        return_no = await numbering_service.next("CR", self.tenant_ctx.branch_id, self.db)

        total_value = Decimal("0.00")
        return_items = []

        for item in return_in.items:
            t_item_res = await self.db.execute(
                select(ConsignmentTransferItem).filter(
                    ConsignmentTransferItem.id == item.transfer_item_id
                )
            )
            t_item = t_item_res.scalars().first()
            if not t_item:
                raise HTTPException(status_code=400, detail="Invalid transfer item ID")

            qty = Decimal(str(item.qty_returned))
            rate = Decimal(str(item.rate))

            if t_item.qty_on_hand < qty:
                raise HTTPException(status_code=400, detail=f"Cannot return {qty} units; only {t_item.qty_on_hand} remaining on hand.")

            # Update transfer item
            t_item.qty_returned += qty
            t_item.qty_on_hand -= qty
            self.db.add(t_item)

            # Restore warehouse stock
            product_res = await self.db.execute(
                select(Product).filter(
                    Product.id == item.product_id,
                    Product.is_deleted == False
                )
            )
            product = product_res.scalars().first()
            if product and product.tracking_mode != "No-stock":
                product.stock += int(qty)
                self.db.add(product)

            # Record StockMovement IN
            movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
            db_movement = StockMovement(
                id=movement_id,
                uuid=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=t_item.name,
                sku=t_item.code,
                quantity=float(qty), # positive for IN
                movement_type="IN",
                reference_doc_type="Consignment Return",
                reference_doc_id=return_id,
                warehouse="Default Warehouse",
                unit_cost=product.cost_price if product else float(rate),
                remarks=f"Unsold consignment stock returned by partner {return_in.partner_id}",
                source_module="Consignment",
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            self.db.add(db_movement)

            line_total = (qty * rate).quantize(Decimal("0.01"))
            total_value += line_total

            db_item = ConsignmentReturnItem(
                id=f"CRI-{uuid.uuid4().hex[:8]}",
                uuid=str(uuid.uuid4()),
                return_id=return_id,
                transfer_item_id=item.transfer_item_id,
                product_id=item.product_id,
                qty_returned=qty,
                rate=rate,
                total_amount=line_total,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            return_items.append(db_item)

        db_return = ConsignmentReturn(
            id=return_id,
            uuid=str(uuid.uuid4()),
            partner_id=return_in.partner_id,
            return_no=return_no,
            return_date=return_in.return_date,
            status="Processed",
            total_value=total_value,
            notes=return_in.notes,
            items=return_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_return)
        await self.db.commit()
        await self.db.refresh(db_return)
        return db_return

    async def get_returns(self) -> List[ConsignmentReturn]:
        res = await self.db.execute(
            select(ConsignmentReturn)
            .options(selectinload(ConsignmentReturn.items))
            .filter(
                ConsignmentReturn.is_deleted == False,
                ConsignmentReturn.company_id == self.tenant_ctx.company_id
            )
        )
        return list(res.scalars().all())
