"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-08-23
Modified     : 2026-10-20
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
from ..models.auth import UserRole
from ..api.deps import TenantContext
from ..platform.events import EventEnvelope, get_platform_event_service
from .outbox_service import OutboxService
from .identity.engine import IdentityEngine
from .stock_synchronizer import StockSynchronizer
from .sales_stock_authority import SalesStockAuthority
from .system_parameter import SystemParameterService


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
        
        # Check uniqueness & idempotency
        stmt = select(SalesInvoice).where(
            SalesInvoice.invoice_no == clean_inv_no,
            SalesInvoice.company_id == company_id,
            SalesInvoice.is_deleted == False
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        # Resolve allow_negative_stock from tenant policy and customer settings
        allow_negative_stock = False
        try:
            allow_neg_param = await SystemParameterService.resolve_parameter(
                db=session,
                param_code="SMRITI.STOCK.ALLOW_NEGATIVE_STOCK",
                company_id=company_id,
                branch_id=branch_id,
            )
            allow_negative_stock = bool(allow_neg_param.effective_value) if allow_neg_param else False
        except Exception:
            allow_negative_stock = False

        if customer_id and not allow_negative_stock:
            try:
                cust_res = await session.execute(
                    select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
                )
                cust_obj = cust_res.scalars().first()
                if cust_obj and getattr(cust_obj, "allow_negative_stock_sales", False):
                    allow_negative_stock = True
            except Exception:
                pass

        invoice_id = IdentityEngine.generate_technical_id()
        total_taxable = Decimal("0.00")
        total_tax = Decimal("0.00")
        grand_total = Decimal("0.00")

        invoice_items: List[SalesInvoiceItem] = []
        authority_lines: List[Dict[str, Any]] = []

        for idx, itm in enumerate(items_data, start=1):
            product_id = itm.get("product_id") or itm.get("item_id") or itm.get("id") or IdentityEngine.generate_technical_id()
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

            authority_lines.append({
                "product_id": product_id,
                "sku": code,
                "product_name": name,
                "quantity": qty,
                "batch_no": batch_no,
                "unit_cost": itm.get("unit_cost"),
            })

        # 3. Sales Invoice Master Header
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
        await session.flush()

        # 4. Authoritative Stock Deduction via SalesStockAuthority
        tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id, role=UserRole.SYSADMIN)
        await SalesStockAuthority.record_outward_sale(
            session=session,
            tenant_ctx=tenant_ctx,
            invoice_id=invoice.id,
            invoice_no=clean_inv_no,
            items=authority_lines,
            reference_doc_type="SALES_INVOICE",
            warehouse_id=warehouse_id,
            user_id="SYSTEM",
            allow_negative_stock=allow_negative_stock,
        )

        # 7. Stage Canonical Outbox Event atomically in the same transaction via PlatformEventService Kernel
        event_service = get_platform_event_service()
        envelope = EventEnvelope(
            eventType="sales.invoice.confirmed",
            schemaVersion="1.0",
            source="sales.unified_ledger",
            tenantId=company_id,
            payload={
                "invoice_id": invoice_id,
                "invoice_no": clean_inv_no,
                "customer_id": customer_id,
                "grand_total": float(grand_total),
                "is_interstate": is_interstate,
                "status": "Confirmed"
            },
            correlationId=f"corr_inv_{invoice_id}",
            causationId=invoice_id,
            metadata={
                "aggregate_id": invoice_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "target_channel": "SALES_INVOICE_PUBLISH",
                "event_type": "SALES_INVOICE_CONFIRMED",
            }
        )
        await event_service.stage_event(envelope, session)

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

        # Compensating Reversal via SalesStockAuthority
        tenant_ctx = TenantContext(company_id=company_id, branch_id=branch_id, role=UserRole.SYSADMIN)
        await SalesStockAuthority.record_sales_cancellation_reversal(
            session=session,
            tenant_ctx=tenant_ctx,
            invoice_id=invoice.id,
            invoice_no=clean_inv_no,
            user_id="SYSTEM",
            reason=reason,
        )

        inv_id = invoice.id
        invoice.status = "Cancelled"

        # Stage Canonical Outbox Event for Cancellation in same transaction via PlatformEventService Kernel
        event_service = get_platform_event_service()
        cancel_envelope = EventEnvelope(
            eventType="sales.invoice.cancelled",
            schemaVersion="1.0",
            source="sales.unified_ledger",
            tenantId=company_id,
            payload={
                "invoice_id": invoice.id,
                "invoice_no": clean_inv_no,
                "status": "Cancelled",
                "reason": reason
            },
            correlationId=f"corr_cancel_{invoice.id}",
            causationId=invoice.id,
            metadata={
                "aggregate_id": invoice.id,
                "company_id": company_id,
                "branch_id": branch_id,
                "target_channel": "SALES_INVOICE_PUBLISH",
                "event_type": "SALES_INVOICE_CANCELLED",
            }
        )
        await event_service.stage_event(cancel_envelope, session)

        await session.commit()
        session.expire_all()

        res_stmt = (
            select(SalesInvoice)
            .where(SalesInvoice.id == inv_id)
            .options(selectinload(SalesInvoice.items))
        )
        return (await session.execute(res_stmt)).scalar_one()


# Canonical architectural alias for Phase A Domain Writer Convergence
CanonicalSalesWriter = UnifiedSalesLedgerService

