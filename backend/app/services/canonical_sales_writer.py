"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Sales Posting Writer & Universal Financial Engine (Phase 2C Step 2)
"""

import uuid
import logging
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from sqlalchemy.orm import selectinload

from ..schemas.canonical_posting import (
    CanonicalPostingRequest,
    CanonicalPostingResult,
    CanonicalPostingLineResult,
)
from ..schemas.payments import PaymentTenderItem, ProcessPaymentRequest
from ..core.gst_engine import (
    calculate_line_item_tax,
    round_currency,
    extract_state_code_from_gstin,
    GST_STATE_CODES,
)
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..models.pos import Shift
from ..models.crm import Customer, CustomerCreditLedgerEntry
from ..models.inventory import Product, Warehouse
from ..models.tenant import Branch
from .canonical_transaction_writer import CanonicalTransactionWriter
from .inventory_wms import InventoryWmsService
from .payments_engine import PaymentsEngine
from .outbox_service import OutboxService
from .numbering import NumberingService
from ..api.deps import TenantContext

logger = logging.getLogger("smriti.canonical_sales_writer")


class CanonicalSalesPostingWriter:
    """
    Sole authoritative transaction writer for all Sales and Billing postings across SMRITI Retail OS.
    Ingresses from POS, B2B Tax Invoicing, Customer PO, and Sales Orders converge here.
    
    Invariants:
    1. Caller-controlled AsyncSession: DOES NOT commit unless commit=True is explicitly passed.
    2. Idempotency: Duplicate idempotency_key yields cached/replayed result.
    3. Dual-Key Parity: Enforces canonical variant_id + legacy product_id consistency.
    4. Statutory GST: calculate_line_item_tax with inclusive/exclusive modes.
    5. Physical Stock: Mutates batch inventory and writes immutable StockMovement.
    6. Payments: Atomic multi-tender payment recording via PaymentsEngine.
    7. Outbox: Atomic IntegrationOutboxEvent in same database transaction.
    """

    @classmethod
    async def post_sales_transaction(
        cls,
        session: AsyncSession,
        req: CanonicalPostingRequest,
        commit: bool = False,
    ) -> CanonicalPostingResult:
        """
        Executes an atomic sales transaction posting under caller session control.
        """
        company_id = req.context.company_id
        branch_id = req.context.branch_id
        warehouse_id = req.context.warehouse_id
        shift_id = req.context.shift_id
        idempotency_key = req.context.idempotency_key

        # 0. Authoritative Input Validations
        if not req.items:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-VAL-001: Sales transaction must contain at least one line item.",
            )

        for t in req.tenders:
            if Decimal(str(t.amount)) <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-004: Tender amount for mode '{t.tender_type}' must be greater than zero.",
                )
            if t.tender_type.upper() == "CASH" and Decimal(str(t.amount)) >= Decimal("200000.00"):
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-TAX-269ST: Cash receipt of ₹2,00,000 or more in a single transaction is prohibited under Section 269ST of the Income Tax Act.",
                )

        # 1. POS Shift row lock & validation (if shift_id provided)
        shift_obj: Optional[Shift] = None
        if shift_id:
            q_shift = (
                select(Shift)
                .where(
                    Shift.id == shift_id,
                    Shift.company_id == company_id,
                    Shift.is_deleted == False,
                )
                .with_for_update()
            )
            res_shift = await session.execute(q_shift)
            shift_obj = res_shift.scalars().first()
            if not shift_obj:
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-POS-001: Shift '{shift_id}' not found for company '{company_id}'.",
                )
            if shift_obj.status != "OPEN":
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-POS-002: The shift is not open (status: {shift_obj.status}). Please open a shift before processing sales.",
                )

        # Resolve canonical warehouse via InventoryWarehouseResolver
        from .inventory_warehouse_resolver import InventoryWarehouseResolver
        try:
            resolver = InventoryWarehouseResolver(session)
            wh = await resolver.resolve(
                company_id=company_id,
                branch_id=branch_id,
                register_id=shift_obj.register_id if shift_obj else None,
                warehouse_id=warehouse_id,
            )
            if wh:
                warehouse_id = wh.id
        except Exception as e:
            logger.warning("Warehouse resolution fallback: %s", e)

        # 2. Idempotency Check & Replay Protection
        # Check rule_snapshots JSONB for idempotency_key or direct invoice_no
        q_idem = select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(
            SalesInvoice.company_id == company_id,
            SalesInvoice.is_deleted == False,
            (
                (SalesInvoice.invoice_no == (req.context.client_invoice_no or idempotency_key))
                | (text("rule_snapshots->>'idempotency_key' = :ikey").params(ikey=idempotency_key))
            ),
        )
        res_idem = await session.execute(q_idem)
        existing_inv = res_idem.scalars().first()
        if existing_inv:
            logger.info("Idempotent replay detected for invoice %s (key %s)", existing_inv.invoice_no, idempotency_key)
            replayed_lines = [
                CanonicalPostingLineResult(
                    line_no=item.line_no or idx + 1,
                    variant_id=item.variant_id,
                    item_id=item.item_id,
                    product_id=item.product_id,
                    code=item.code,
                    name=item.name,
                    quantity=Decimal(str(item.quantity)),
                    unit_price=Decimal(str(item.price)),
                    discount_amount=Decimal(str((item.disc_pct or Decimal("0.00")) * item.price * item.quantity / Decimal("100.00"))),
                    taxable_value=Decimal(str(item.taxable_value or "0.00")),
                    gst_rate=Decimal(str(item.gst_rate or "0.00")),
                    cgst_amount=Decimal(str(item.cgst_amount or "0.00")),
                    sgst_amount=Decimal(str(item.sgst_amount or "0.00")),
                    igst_amount=Decimal(str(item.igst_amount or "0.00")),
                    tax_amount=Decimal(str(item.tax_amount or "0.00")),
                    total_amount=Decimal(str(item.total_amount or "0.00")),
                    batch_no=item.batch_no,
                    hsn_code=item.hsn_code,
                    mrp=Decimal(str(item.mrp)) if item.mrp else None,
                )
                for idx, item in enumerate(existing_inv.items)
            ]
            return CanonicalPostingResult(
                success=True,
                invoice_id=existing_inv.id,
                invoice_no=existing_inv.invoice_no,
                invoice_date=existing_inv.date,
                gross_amount=Decimal(str(existing_inv.grand_total)),
                discount_amount=Decimal(str(existing_inv.discount_amount or "0.00")),
                taxable_amount=Decimal(str(existing_inv.taxable_value or "0.00")),
                cgst_amount=sum(l.cgst_amount for l in replayed_lines),
                sgst_amount=sum(l.sgst_amount for l in replayed_lines),
                igst_amount=sum(l.igst_amount for l in replayed_lines),
                tax_total=Decimal(str(existing_inv.tax_total or "0.00")),
                round_off=Decimal(str(existing_inv.rounding_amount or "0.00")),
                net_amount=Decimal(str(existing_inv.net_amount or existing_inv.grand_total)),
                paid_amount=Decimal(str(existing_inv.paid_amount or "0.00")),
                balance_amount=Decimal(str(existing_inv.balance_amount or "0.00")),
                change_amount=Decimal("0.00"),
                is_replayed=True,
                items_count=len(replayed_lines),
                shift_id=existing_inv.shift_id,
                customer_id=existing_inv.customer_id,
                customer_name=existing_inv.customer_name,
                lines=replayed_lines,
            )

        # 3. Customer & Credit Validation
        db_customer: Optional[Customer] = None
        credit_tender_amount = Decimal("0.00")
        for t in req.tenders:
            if t.tender_type.upper() == "CREDIT":
                credit_tender_amount += Decimal(str(t.amount))

        if req.customer_id:
            q_cust = select(Customer).where(
                Customer.id == req.customer_id,
                Customer.company_id == company_id,
                Customer.is_deleted == False,
            ).with_for_update()
            res_cust = await session.execute(q_cust)
            db_customer = res_cust.scalars().first()
            if not db_customer:
                raise HTTPException(
                    status_code=404,
                    detail=f"SMRITI-CRM-001: Customer '{req.customer_id}' not found for company '{company_id}'.",
                )

        if credit_tender_amount > 0:
            if not db_customer:
                raise HTTPException(
                    status_code=400,
                    detail="SMRITI-CREDIT-001: Credit tender cannot be used for unregistered Walk-in customers.",
                )
            current_outstanding = Decimal(str(db_customer.outstanding or "0.00"))
            credit_limit = Decimal("0.00")
            if db_customer.customer_group_id:
                from ..models.crm import CustomerGroup
                q_cg = select(CustomerGroup).where(
                    CustomerGroup.id == db_customer.customer_group_id,
                    CustomerGroup.is_deleted == False,
                )
                res_cg = await session.execute(q_cg)
                cg_rec = res_cg.scalars().first()
                if cg_rec and cg_rec.credit_limit:
                    credit_limit = Decimal(str(cg_rec.credit_limit))

            if credit_limit > 0 and (current_outstanding + credit_tender_amount) > credit_limit:
                if not req.context.supervisor_override_code:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"SMRITI-CREDIT-002: Customer credit limit exceeded! "
                            f"Limit: {credit_limit}, Current: {current_outstanding}, "
                            f"Bill Credit: {credit_tender_amount}. Supervisor override required."
                        ),
                    )
                logger.warning(
                    "Credit limit override authorized by code %s for customer %s",
                    req.context.supervisor_override_code,
                    db_customer.id,
                )

        # 4. Resolve Interstate / Tax Jurisdiction
        from ..models.tenant import Company
        branch_state_code = "27"  # Default Maharashtra
        q_comp = select(Company).where(Company.id == company_id)
        res_comp = await session.execute(q_comp)
        comp_obj = res_comp.scalars().first()
        if comp_obj and comp_obj.gst_number:
            extracted_branch_sc = extract_state_code_from_gstin(comp_obj.gst_number)
            if extracted_branch_sc:
                branch_state_code = extracted_branch_sc

        q_branch = select(Branch).where(Branch.company_id == company_id)
        if branch_id:
            q_branch = q_branch.where((Branch.id == branch_id) | (Branch.code == branch_id))
        res_br = await session.execute(q_branch)
        branch_obj = res_br.scalars().first()

        customer_state_code = branch_state_code
        if req.customer_gstin:
            extracted_sc = extract_state_code_from_gstin(req.customer_gstin)
            if extracted_sc:
                customer_state_code = extracted_sc
        elif req.place_of_supply:
            customer_state_code = req.place_of_supply[:2]

        is_interstate = (customer_state_code != branch_state_code)

        # 5. Dual-Key Item Resolution & Statutory Tax Calculation
        calculated_lines: List[Dict[str, Any]] = []
        batch_deductions: List[Dict[str, Any]] = []

        total_gross = Decimal("0.00")
        total_discount = Decimal("0.00")
        total_taxable = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")
        total_tax = Decimal("0.00")

        for idx, item in enumerate(req.items):
            line_no = idx + 1
            if Decimal(str(item.quantity)) <= Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-002: Line item '{item.code}' has non-positive quantity ({item.quantity}). Quantity must be greater than zero.",
                )
            if Decimal(str(item.unit_price)) < Decimal("0.00"):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-VAL-003: Line item '{item.code}' has negative unit price ({item.unit_price}). Unit price cannot be negative.",
                )
            if item.mrp and Decimal(str(item.mrp)) > Decimal("0.00") and Decimal(str(item.unit_price)) > Decimal(str(item.mrp)):
                raise HTTPException(
                    status_code=400,
                    detail=f"SMRITI-PRICE-001: Selling price (₹{Decimal(str(item.unit_price)):,.2f}) cannot exceed statutory MRP (₹{Decimal(str(item.mrp)):,.2f}) for item '{item.name or item.code}'.",
                )

            # Dual-Key Resolution
            identity = await CanonicalTransactionWriter.resolve_dual_key_for_line(
                session=session,
                company_id=company_id,
                variant_id=item.variant_id,
                item_id=item.item_id,
                product_id=item.product_id,
                code_or_barcode=item.code,
                is_fee_line=item.is_fee_line,
            )

            if not identity.is_valid and not item.is_fee_line:
                # Direct product table fallback for unmapped legacy products
                q_prod = select(Product).where(
                    Product.company_id == company_id,
                    Product.is_deleted == False,
                    (
                        (Product.id == (item.product_id or item.code))
                        | (Product.code == item.code)
                        | (Product.barcode == item.code)
                    ),
                )
                res_prod = await session.execute(q_prod)
                direct_prod = res_prod.scalars().first()
                if direct_prod:
                    from .canonical_transaction_writer import DualKeyWriteIdentity
                    identity = DualKeyWriteIdentity(
                        canonical_variant_id=None,
                        canonical_item_id=None,
                        legacy_product_id=direct_prod.id,
                        sku=direct_prod.sku or direct_prod.code,
                        name=direct_prod.name,
                        line_type="PHYSICAL_INVENTORY",
                        is_valid=True,
                        is_quarantined=False,
                        is_consistent=False,
                    )

            if not identity.is_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {line_no}: {identity.error_message or 'Item identity resolution failed.'}",
                )

            # Determine tax inclusive/exclusive mode
            if item.is_tax_inclusive is not None:
                tax_inc = item.is_tax_inclusive
            elif req.context.source_channel == "POS_RETAIL":
                tax_inc = True  # Retail MRP inclusive by default
            else:
                tax_inc = False  # Wholesale base exclusive by default

            # Resolve GST rate
            gst_rate = item.gst_rate
            if gst_rate is None:
                gst_rate = Decimal("18.00")  # Default statutory slab if unspecified

            # Calculate line discount
            qty = Decimal(str(item.quantity))
            rate = Decimal(str(item.unit_price))
            gross_base = qty * rate

            disc_amount = Decimal("0.00")
            if item.disc_pct and item.disc_pct > 0:
                disc_amount += round_currency(gross_base * Decimal(str(item.disc_pct)) / Decimal("100.00"))
            if item.disc_amt and item.disc_amt > 0:
                disc_amount += Decimal(str(item.disc_amt))
            disc_amount = min(disc_amount, gross_base)

            # Execute canonical GST math
            tax_dict = calculate_line_item_tax(
                unit_price=rate,
                quantity=qty,
                discount_amount=disc_amount,
                gst_rate=Decimal(str(gst_rate)),
                is_tax_inclusive=tax_inc,
                is_interstate=is_interstate,
            )

            total_gross += gross_base
            total_discount += disc_amount
            total_taxable += tax_dict["taxable_value"]
            total_cgst += tax_dict["cgst_amount"]
            total_sgst += tax_dict["sgst_amount"]
            total_igst += tax_dict["igst_amount"]
            total_tax += tax_dict["tax_amount"]

            line_data = {
                "line_no": line_no,
                "variant_id": identity.canonical_variant_id,
                "item_id": identity.canonical_item_id,
                "product_id": identity.legacy_product_id,
                "code": item.code,
                "name": item.name or identity.name or "Item",
                "quantity": qty,
                "price": rate,
                "mrp": Decimal(str(item.mrp)) if item.mrp else None,
                "disc_pct": item.disc_pct,
                "discount_amount": disc_amount,
                "taxable_value": tax_dict["taxable_value"],
                "gst_rate": gst_rate,
                "cgst_amount": tax_dict["cgst_amount"],
                "sgst_amount": tax_dict["sgst_amount"],
                "igst_amount": tax_dict["igst_amount"],
                "tax_amount": tax_dict["tax_amount"],
                "total_amount": tax_dict["total_amount"],
                "hsn_code": item.hsn_code or "9999",
                "batch_no": item.batch_no or "DEFAULT",
                "customer_po_line_id": item.customer_po_line_id,
                "source_line_type": item.source_line_type or ("CUSTOMER_PO" if item.customer_po_line_id else "DIRECT"),
                "source_line_id": item.source_line_id,
            }
            calculated_lines.append(line_data)

            if not item.is_fee_line and identity.legacy_product_id:
                batch_deductions.append({
                    "product_id": identity.legacy_product_id,
                    "batch_no": item.batch_no or "DEFAULT",
                    "quantity": qty,
                    "line_no": line_no,
                })

        # 6. Invoice Grand Total & Rounding
        raw_net = sum(l["total_amount"] for l in calculated_lines)
        net_rounded = round_currency(raw_net)
        round_off = net_rounded - raw_net

        # 7. Invoice Numbering Allocation
        invoice_no = req.context.client_invoice_no
        if not invoice_no:
            try:
                num_svc = NumberingService(session)
                invoice_no = await num_svc.allocate_voucher_number(
                    series_id=f"SER-{company_id}-INV",
                    branch=branch_id or "MAIN",
                    fy=f"{date.today().year}-{date.today().year+1}",
                    username=req.context.cashier_id or "SYSTEM",
                )
            except Exception:
                # Deterministic fallback format: INV-<YYYYMMDD>-<UUID4_SHORT>
                invoice_no = f"INV-{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # 8. Resolve and validate Dispatch From physical origin location
        raw_dispatch_id = req.dispatch_from_location_id or req.context.dispatch_from_location_id or warehouse_id
        dispatch_from_snapshot: Optional[Dict[str, Any]] = None
        dispatch_from_location_id: Optional[str] = None

        if batch_deductions and not raw_dispatch_id:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-LOC-006: Dispatch From location is required for physical goods fulfillment.",
            )

        if raw_dispatch_id:
            # First check if warehouse exists within tenant company
            q_disp = select(Warehouse).where(
                (Warehouse.id == raw_dispatch_id) | (Warehouse.code == raw_dispatch_id),
                Warehouse.company_id == company_id,
            )
            res_disp = await session.execute(q_disp)
            disp_wh = res_disp.scalars().first()

            if not disp_wh:
                # Cross-tenant check: if warehouse belongs to another company
                q_cross = select(Warehouse).where(
                    (Warehouse.id == raw_dispatch_id) | (Warehouse.code == raw_dispatch_id)
                )
                res_cross = await session.execute(q_cross)
                cross_wh = res_cross.scalars().first()
                if cross_wh and cross_wh.company_id != company_id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"SMRITI-LOC-001: Cross-tenant dispatch location reference forbidden. Warehouse '{raw_dispatch_id}' belongs to another company.",
                    )
                if req.dispatch_from_location_id or req.context.dispatch_from_location_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-002: Dispatch location '{raw_dispatch_id}' not found for company '{company_id}'.",
                    )

            if disp_wh:
                if disp_wh.is_deleted or not disp_wh.is_active:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-003: Dispatch location '{disp_wh.name}' ({disp_wh.code}) is inactive or decommissioned.",
                    )

                disp_pin = str(disp_wh.pincode or "").strip()
                if not disp_pin or not disp_pin.isdigit() or len(disp_pin) != 6:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-004: Dispatch location '{disp_wh.code}' has missing or invalid 6-digit Indian PIN code '{disp_wh.pincode}'.",
                    )
                if not disp_wh.state:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SMRITI-LOC-005: Dispatch location '{disp_wh.code}' is missing state information.",
                    )

                state_code_map = {v.lower(): k for k, v in GST_STATE_CODES.items()}
                disp_state_code = state_code_map.get(disp_wh.state.strip().lower())
                if not disp_state_code:
                    if comp_obj and comp_obj.gst_number and len(comp_obj.gst_number) >= 2 and comp_obj.gst_number[:2].isdigit():
                        disp_state_code = comp_obj.gst_number[:2]
                    else:
                        disp_state_code = "27"

                dispatch_from_location_id = disp_wh.id
                dispatch_from_snapshot = {
                    "location_id": disp_wh.id,
                    "code": disp_wh.code,
                    "name": getattr(comp_obj, "name", "Tattly Threads"),
                    "location_name": disp_wh.name,
                    "address_line1": disp_wh.address or "",
                    "address_line2": "",
                    "city": disp_wh.city or "",
                    "district": disp_wh.city or "",
                    "state": disp_wh.state or "Maharashtra",
                    "state_code": disp_state_code,
                    "pincode": disp_pin,
                    "gstin": getattr(comp_obj, "gst_number", "27AAXFT2508H1ZR") or "27AAXFT2508H1ZR",
                    "contact_person": disp_wh.contact_person,
                    "phone": disp_wh.phone,
                }

        # 9. Persist SalesInvoice
        invoice_id = f"inv-{uuid.uuid4().hex[:12]}"
        db_invoice = SalesInvoice(
            id=invoice_id,
            company_id=company_id,
            branch_id=branch_obj.id if branch_obj else branch_id,
            invoice_no=invoice_no,
            date=date.today(),
            customer_id=db_customer.id if db_customer else req.customer_id,
            customer_name=req.customer_name or (db_customer.name if db_customer else "Walk-in Customer"),
            customer_gstin=req.customer_gstin or (getattr(db_customer, "gst_number", None) or getattr(db_customer, "gstin", None) if db_customer else None),
            billing_address=req.billing_address or (getattr(db_customer, "address", None) if db_customer else None),
            shipping_address=req.shipping_address or req.billing_address,
            billing_location_id=req.billing_location_id,
            billing_store_code=req.billing_store_code,
            delivery_location_id=req.delivery_location_id,
            delivery_store_code=req.delivery_store_code,
            delivery_gstin=req.delivery_gstin,
            delivery_location_snapshot=req.delivery_location_snapshot,
            warehouse_id=warehouse_id,
            dispatch_from_location_id=dispatch_from_location_id,
            dispatch_from_snapshot=dispatch_from_snapshot,
            shift_id=shift_id,
            terminal_id=req.context.terminal_id,
            counter_id=req.context.counter_id,
            salesperson_id=req.context.cashier_id,
            taxable_value=total_taxable,
            tax_total=total_tax,
            grand_total=net_rounded,
            net_amount=net_rounded,
            discount_amount=total_discount,
            rounding_amount=round_off,
            is_interstate=is_interstate,
            reverse_charge=req.reverse_charge,
            place_of_supply_code=req.place_of_supply or customer_state_code,
            payment_mode=(req.payment_mode or ("SPLIT" if len(req.tenders) > 1 else (req.tenders[0].tender_type if req.tenders else "CREDIT"))).upper(),
            status="Submitted",
            po_reference=req.po_reference_no,
            customer_po_id=req.customer_po_id,
            source_document_type="CUSTOMER_PO" if req.customer_po_id else req.context.source_channel,
            source_document_id=req.customer_po_id or req.so_reference_no,
            rule_snapshots={
                "idempotency_key": idempotency_key,
                "source_channel": req.context.source_channel,
                "supervisor_override": req.context.supervisor_override_code,
                "calculated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        session.add(db_invoice)

        # 9. Persist SalesInvoiceItem records
        for l in calculated_lines:
            db_item = SalesInvoiceItem(
                invoice_id=db_invoice.id,
                product_id=l["product_id"],
                item_id=l["item_id"],
                variant_id=l["variant_id"],
                code=l["code"],
                name=l["name"],
                quantity=l["quantity"],
                price=l["price"],
                mrp=l["mrp"],
                disc_pct=l["disc_pct"],
                taxable_value=l["taxable_value"],
                hsn_code=l["hsn_code"],
                gst_rate=l["gst_rate"],
                cgst_amount=l["cgst_amount"],
                sgst_amount=l["sgst_amount"],
                igst_amount=l["igst_amount"],
                tax_amount=l["tax_amount"],
                total_amount=l["total_amount"],
                batch_no=l["batch_no"],
                line_no=l["line_no"],
                customer_po_line_id=l["customer_po_line_id"],
                source_line_type=l["source_line_type"],
                source_line_id=l["source_line_id"],
            )
            session.add(db_item)

        await session.flush()

        # 10. Update Customer Outstanding if Credit Tender
        if credit_tender_amount > 0 and db_customer:
            prev_outstanding = Decimal(str(db_customer.outstanding or "0.00"))
            db_customer.outstanding = prev_outstanding + credit_tender_amount
            db_customer.modified_at = datetime.now(timezone.utc)
            session.add(db_customer)

            credit_entry = CustomerCreditLedgerEntry(
                id=f"ccle-{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_obj.id if branch_obj else branch_id,
                customer_id=db_customer.id,
                entry_date=datetime.now(timezone.utc),
                entry_type="DEBIT",
                amount=credit_tender_amount,
                balance_after=db_customer.outstanding,
                reference_type="SALES_INVOICE",
                reference_id=db_invoice.id,
                notes=f"Sales invoice {db_invoice.invoice_no} credit tender",
            )
            session.add(credit_entry)

        # 11. Physical Stock Mutation via WMS
        if warehouse_id and batch_deductions:
            tenant_ctx = TenantContext(
                company_id=company_id,
                branch_id=branch_id or "MAIN",
            )
            wms_svc = InventoryWmsService(session, tenant_ctx)
            for ded in batch_deductions:
                try:
                    await wms_svc.atomic_mutate_batch_stock(
                        product_id=ded["product_id"],
                        warehouse_id=warehouse_id,
                        batch_no=ded["batch_no"],
                        qty_delta=-ded["quantity"],
                        movement_type="OUTWARD_SALE",
                        reference_doc_type="Sales Invoice",
                        reference_doc_id=db_invoice.id,
                        remarks=f"Stock deducted for sales invoice: {db_invoice.invoice_no}",
                        user=req.context.cashier_id,
                    )
                except HTTPException as he:
                    if req.context.allow_negative_stock:
                        logger.warning("Negative stock override permitted on line %d: %s", ded["line_no"], he.detail)
                    else:
                        raise

        # 12. Payments Engine Multi-Tender Recording
        total_paid = Decimal("0.00")
        if req.tenders:
            payment_tenders: List[PaymentTenderItem] = []
            for t in req.tenders:
                t_amt = Decimal(str(t.amount))
                total_paid += t_amt
                payment_tenders.append(
                    PaymentTenderItem(
                        tender_type=t.tender_type.upper(),
                        amount=float(t_amt),
                        gateway_reference=t.reference_no,
                        notes=t.notes,
                    )
                )

            proc_payment_req = ProcessPaymentRequest(
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=db_invoice.id,
                party_id=db_customer.id if db_customer else None,
                tenders=payment_tenders,
                idempotency_key=f"PAY-{idempotency_key}",
                branch_id=branch_id or "BR-001",
                auto_allocate=True,
            )
            await PaymentsEngine.process_payment(
                session=session,
                company_id=company_id,
                req=proc_payment_req,
                created_by=req.context.cashier_id or "SYSTEM",
                commit=False,
            )

        db_invoice.paid_amount = total_paid
        db_invoice.balance_amount = max(Decimal("0.00"), net_rounded - total_paid)
        change_amount = max(Decimal("0.00"), total_paid - net_rounded)

        # 13. Transactional Outbox Event Publication
        outbox_event = await OutboxService.record_event(
            session=session,
            target_channel="SALES_POSTING",
            payload={
                "event_type": "CanonicalSalesInvoicePostedEvent",
                "invoice_id": db_invoice.id,
                "invoice_no": db_invoice.invoice_no,
                "company_id": company_id,
                "branch_id": branch_id,
                "grand_total": str(db_invoice.grand_total),
                "customer_id": db_invoice.customer_id,
                "shift_id": shift_id,
                "items_count": len(calculated_lines),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            correlation_id=idempotency_key,
            event_type="SALES_INVOICE_POSTED",
            aggregate_type="SALES_INVOICE",
            aggregate_id=db_invoice.id,
            company_id=company_id,
            branch_id=branch_id,
        )

        if commit:
            await session.commit()
        else:
            await session.flush()

        result_lines = [
            CanonicalPostingLineResult(
                line_no=l["line_no"],
                variant_id=l["variant_id"],
                item_id=l["item_id"],
                product_id=l["product_id"],
                code=l["code"],
                name=l["name"],
                quantity=l["quantity"],
                unit_price=l["price"],
                discount_amount=l["discount_amount"],
                taxable_value=l["taxable_value"],
                gst_rate=l["gst_rate"],
                cgst_amount=l["cgst_amount"],
                sgst_amount=l["sgst_amount"],
                igst_amount=l["igst_amount"],
                tax_amount=l["tax_amount"],
                total_amount=l["total_amount"],
                batch_no=l["batch_no"],
                hsn_code=l["hsn_code"],
                mrp=l["mrp"],
            )
            for l in calculated_lines
        ]

        return CanonicalPostingResult(
            success=True,
            invoice_id=db_invoice.id,
            invoice_no=db_invoice.invoice_no,
            invoice_date=db_invoice.date,
            gross_amount=total_gross,
            discount_amount=total_discount,
            taxable_amount=total_taxable,
            cgst_amount=total_cgst,
            sgst_amount=total_sgst,
            igst_amount=total_igst,
            tax_total=total_tax,
            round_off=round_off,
            net_amount=net_rounded,
            paid_amount=total_paid,
            balance_amount=db_invoice.balance_amount,
            change_amount=change_amount,
            is_replayed=False,
            items_count=len(result_lines),
            outbox_event_id=outbox_event.id if outbox_event else None,
            shift_id=shift_id,
            customer_id=db_invoice.customer_id,
            customer_name=db_invoice.customer_name,
            lines=result_lines,
        )
