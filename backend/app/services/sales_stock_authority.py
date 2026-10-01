"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.47.4
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Authoritative Sales Stock Movement & Ledger Engine (Phase S2)
"""

import uuid
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from app.models.fulfillment import Dispatch, DispatchItem, PackingSlip
from app.models.profitability import ProductCostValuation, TransactionCostSnapshot
from .stock_synchronizer import StockSynchronizer
from .identity.engine import IdentityEngine

logger = logging.getLogger("smriti.sales_stock_authority")


class SalesStockAuthority:
    """
    Sole authoritative transactional stock movement engine for Sales operations.
    Enforces the fundamental SMRITI Ledger Principle:
    
    LEDGER = SOURCE OF TRUTH.
    `products.stock` is strictly a synchronized materialized read cache.
    `stock_movements` and `product_batch_stocks` are the sole transactional authorities.
    
    Guarantees:
    1. Single authoritative stock movement per business event.
    2. Zero double-deduction (Dispatch does not re-deduct stock if Invoice already deducted it;
       Invoice does not re-deduct if Dispatch already deducted it).
    3. Row-level locking on Product and Batch rows for concurrency protection.
    4. Strict idempotency and duplicate movement rejection across doc types (Sales Invoice, Distribution Order, etc.).
    5. Compensating reversals for cancellations and returns.
    6. Complete tenant isolation (company_id, branch_id).
    """

    @classmethod
    async def record_outward_sale(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        invoice_id: str,
        invoice_no: str,
        items: List[Dict[str, Any]],
        warehouse_id: Optional[str] = None,
        user_id: Optional[str] = None,
        allow_negative_stock: bool = False,
        reference_doc_type: str = "SALES_INVOICE",
    ) -> List[StockMovement]:
        """
        Records authoritative OUTWARD_SALE stock movements for a confirmed/posted Sales Invoice or Distribution Order.
        Atomically updates batch stocks and synchronizes product stock cache.
        """
        movements: List[StockMovement] = []
        user = user_id or "SYSTEM"

        ref_type_upper = (reference_doc_type or "SALES_INVOICE").upper().replace(" ", "_")
        if ref_type_upper in ("SALES_INVOICE", "SALES_INVOICE"):
            ref_types = ["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]
        elif ref_type_upper in ("DISTRIBUTION_ORDER", "DISTRIBUTION_ORDER"):
            ref_types = ["DISTRIBUTION_ORDER", "Distribution Order", "DISTRIBUTION ORDER"]
        else:
            ref_types = [reference_doc_type]

        for line in items:
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            if qty <= Decimal("0.00"):
                continue

            # 1. Idempotency Check: Don't create duplicate movement for the same invoice/order line
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(ref_types),
                StockMovement.reference_doc_id == invoice_id,
                StockMovement.product_id == product_id,
                StockMovement.movement_type == "OUTWARD_SALE",
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()
            if existing_mov:
                movements.append(existing_mov)
                continue

            # 1b. Check if dispatch already deducted physical stock for this invoice (bidirectional prevention)
            if ref_type_upper == "SALES_INVOICE":
                disp_check_stmt = select(func.count(StockMovement.id)).where(
                    StockMovement.company_id == tenant_ctx.company_id,
                    StockMovement.product_id == product_id,
                    StockMovement.movement_type == "OUTWARD_DISPATCH",
                    StockMovement.reference_doc_type.in_(["DISPATCH", "Dispatch"]),
                    StockMovement.is_deleted.is_(False),
                    StockMovement.reference_doc_id.in_(
                        select(Dispatch.id).join(PackingSlip, Dispatch.packing_slip_id == PackingSlip.id).where(
                            PackingSlip.sales_invoice_id == invoice_id,
                            PackingSlip.company_id == tenant_ctx.company_id,
                            PackingSlip.is_deleted.is_(False),
                        )
                    ),
                )
                disp_count = (await session.execute(disp_check_stmt)).scalar() or 0
                if disp_count > 0:
                    logger.info(
                        "Invoice %s line for product %s: Physical stock already deducted via prior dispatch. Skipping duplicate deduction.",
                        invoice_no, product_id
                    )
                    continue

            # 2. Row Lock on Product
            prod_stmt = select(Product).where(
                Product.id == product_id,
                Product.company_id == tenant_ctx.company_id,
                Product.is_deleted.is_(False),
            ).with_for_update()
            product = (await session.execute(prod_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found for tenant.")

            if (product.tracking_mode or "").lower() == "no-stock":
                continue

            # 3. Check for Batch Tracking
            batch_no = line.get("batch_no")
            if batch_no:
                batch_stmt = select(ProductBatchStock).where(
                    ProductBatchStock.company_id == tenant_ctx.company_id,
                    ProductBatchStock.product_id == product_id,
                    ProductBatchStock.batch_no == batch_no,
                    ProductBatchStock.is_deleted.is_(False),
                ).with_for_update()
                batch_obj = (await session.execute(batch_stmt)).scalars().first()
                if batch_obj:
                    if batch_obj.quantity < qty and not allow_negative_stock:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient batch stock for '{product.name}' (Batch: {batch_no}). Required {qty}, available {batch_obj.quantity}."
                        )
                    batch_obj.quantity -= qty
                    batch_obj.modified_at = datetime.now(timezone.utc)
                    session.add(batch_obj)
            else:
                # Standard non-batch product concurrency & negative stock check
                avail_stock = Decimal(str(product.stock or 0))
                if avail_stock < qty and not allow_negative_stock:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient physical stock for '{product.name}'. Required {qty}, available {avail_stock}."
                    )

            # 4. Create Authoritative StockMovement
            src_module = "Distribution" if "DISTRIBUTION" in ref_type_upper else "Sales"
            movement_id = f"sm_out_{uuid.uuid4().hex[:12]}"
            mov = StockMovement(
                id=movement_id,
                uuid=movement_id,
                company_id=tenant_ctx.company_id,
                branch_id=tenant_ctx.branch_id,
                product_id=product.id,
                item_id=product.item_id,
                variant_id=product.item_variant_id,
                product_name=product.name,
                sku=line.get("sku") or product.sku or product.code,
                quantity=qty,
                movement_type="OUTWARD_SALE",
                reference_doc_type=reference_doc_type,
                reference_doc_id=invoice_id,
                warehouse_id=warehouse_id,
                batch=batch_no,
                unit_cost=line.get("unit_cost") or product.cost_price or product.price or Decimal("0.00"),
                remarks=f"Authoritative stock deduction for {reference_doc_type} {invoice_no}",
                source_module=src_module,
                user=user,
            )
            session.add(mov)
            movements.append(mov)
            await session.flush()

            # 5. Synchronize Materialized Cache via StockSynchronizer
            await StockSynchronizer.sync_product_stock_cache(session, product.id, tenant_ctx.company_id)

        return movements

    @classmethod
    async def record_return_inward(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        return_id: str,
        return_no: str,
        items: List[Dict[str, Any]],
        warehouse_id: Optional[str] = None,
        user_id: Optional[str] = None,
        original_invoice_id: Optional[str] = None,
    ) -> List[StockMovement]:
        """
        Records authoritative RETURN_INWARD stock movements for an approved/processed Sales Return.
        Uses historical unit cost from original invoice TransactionCostSnapshot if available,
        falling back to ProductCostValuation -> Product.cost_price.
        Atomically updates batch stocks and synchronizes product stock cache.
        """
        movements: List[StockMovement] = []
        user = user_id or "SYSTEM"

        for line in items:
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            if qty <= Decimal("0.00"):
                continue

            # 1. Idempotency Check (supporting both SALES_RETURN and Sales Return)
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(["SALES_RETURN", "Sales Return", "SALES RETURN"]),
                StockMovement.reference_doc_id == return_id,
                StockMovement.product_id == product_id,
                StockMovement.movement_type == "RETURN_INWARD",
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()
            if existing_mov:
                movements.append(existing_mov)
                continue

            # 2. Row Lock on Product
            prod_stmt = select(Product).where(
                Product.id == product_id,
                Product.company_id == tenant_ctx.company_id,
                Product.is_deleted.is_(False),
            ).with_for_update()
            product = (await session.execute(prod_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found for tenant.")

            if (product.tracking_mode or "").lower() == "no-stock":
                continue

            # 3. Batch Tracking update if applicable
            batch_no = line.get("batch_no")
            if batch_no:
                batch_stmt = select(ProductBatchStock).where(
                    ProductBatchStock.company_id == tenant_ctx.company_id,
                    ProductBatchStock.product_id == product_id,
                    ProductBatchStock.batch_no == batch_no,
                    ProductBatchStock.is_deleted.is_(False),
                ).with_for_update()
                batch_obj = (await session.execute(batch_stmt)).scalars().first()
                if batch_obj:
                    batch_obj.quantity += qty
                    batch_obj.modified_at = datetime.now(timezone.utc)
                    session.add(batch_obj)

            # 4. Resolve Historical Cost (Tier 1: Original Invoice Snapshot, Tier 2: ProductCostValuation, Tier 3: Product.cost_price)
            unit_cost = Decimal("0.00")
            val_method = "ZERO_COST_UNVALUED"

            if line.get("unit_cost") is not None and Decimal(str(line.get("unit_cost"))) > Decimal("0.00"):
                unit_cost = Decimal(str(line.get("unit_cost"))).quantize(Decimal("0.01"))
                val_method = "PROVIDED_UNIT_COST"
            elif original_invoice_id:
                snap_stmt = select(TransactionCostSnapshot).where(
                    TransactionCostSnapshot.sales_invoice_id == original_invoice_id,
                    TransactionCostSnapshot.product_id == product.id,
                    TransactionCostSnapshot.company_id == tenant_ctx.company_id,
                    TransactionCostSnapshot.is_deleted == False
                ).order_by(TransactionCostSnapshot.created_at.desc())
                snap = (await session.execute(snap_stmt)).scalars().first()
                if snap and snap.cost_per_unit is not None and Decimal(str(snap.cost_per_unit)) > Decimal("0.00"):
                    unit_cost = Decimal(str(snap.cost_per_unit)).quantize(Decimal("0.01"))
                    val_method = f"HISTORICAL_SNAPSHOT ({snap.valuation_method_used or 'SNAPSHOT'})"

            if unit_cost <= Decimal("0.00"):
                pcv_stmt = select(ProductCostValuation).where(
                    ProductCostValuation.product_id == product.id,
                    ProductCostValuation.company_id == tenant_ctx.company_id,
                    ProductCostValuation.is_deleted == False
                )
                pcv = (await session.execute(pcv_stmt)).scalars().first()
                if pcv:
                    if pcv.weighted_average_cost and Decimal(str(pcv.weighted_average_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.weighted_average_cost)).quantize(Decimal("0.01"))
                        val_method = "WEIGHTED_AVERAGE"
                    elif pcv.purchase_cost and Decimal(str(pcv.purchase_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.purchase_cost)).quantize(Decimal("0.01"))
                        val_method = "PURCHASE_COST"
                    elif pcv.last_purchase_cost and Decimal(str(pcv.last_purchase_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.last_purchase_cost)).quantize(Decimal("0.01"))
                        val_method = "LAST_PURCHASE"
                    elif pcv.standard_cost and Decimal(str(pcv.standard_cost)) > Decimal("0.00"):
                        unit_cost = Decimal(str(pcv.standard_cost)).quantize(Decimal("0.01"))
                        val_method = "STANDARD_COST"

            if unit_cost <= Decimal("0.00") and product.cost_price and Decimal(str(product.cost_price)) > Decimal("0.00"):
                unit_cost = Decimal(str(product.cost_price)).quantize(Decimal("0.01"))
                val_method = "COST_PRICE_FALLBACK"

            if unit_cost <= Decimal("0.00") and product.price and Decimal(str(product.price)) > Decimal("0.00"):
                unit_cost = Decimal(str(product.price)).quantize(Decimal("0.01"))
                val_method = "PRICE_FALLBACK"

            # 5. Create Authoritative StockMovement
            movement_id = f"sm_ret_{uuid.uuid4().hex[:12]}"
            mov = StockMovement(
                id=movement_id,
                uuid=movement_id,
                company_id=tenant_ctx.company_id,
                branch_id=tenant_ctx.branch_id,
                product_id=product.id,
                item_id=product.item_id,
                variant_id=product.item_variant_id,
                product_name=product.name,
                sku=product.sku or product.code,
                quantity=qty,
                movement_type="RETURN_INWARD",
                reference_doc_type="SALES_RETURN",
                reference_doc_id=return_id,
                warehouse_id=warehouse_id,
                batch=batch_no,
                unit_cost=unit_cost,
                remarks=f"Authoritative stock return via Sales Return {return_no} (Cost: {unit_cost}, Method: {val_method})",
                source_module="Sales",
                user=user,
            )
            session.add(mov)
            movements.append(mov)
            await session.flush()

            # 6. Synchronize Materialized Cache via StockSynchronizer
            await StockSynchronizer.sync_product_stock_cache(session, product.id, tenant_ctx.company_id)

        return movements

    @classmethod
    async def record_sales_cancellation_reversal(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        invoice_id: str,
        invoice_no: str,
        user_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> List[StockMovement]:
        """
        Creates compensating stock movements for a cancelled Sales Invoice.
        Reverses original OUTWARD_SALE movements.
        """
        user = user_id or "SYSTEM"
        reversals: List[StockMovement] = []

        # Find original outward movements (supporting both SALES_INVOICE and Sales Invoice)
        orig_stmt = select(StockMovement).where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.reference_doc_type.in_(["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]),
            StockMovement.reference_doc_id == invoice_id,
            StockMovement.movement_type == "OUTWARD_SALE",
            StockMovement.is_deleted.is_(False),
        )
        orig_movements = (await session.execute(orig_stmt)).scalars().all()
        if not orig_movements:
            return []

        # Check if cancellation reversal already exists
        rev_check_stmt = select(StockMovement).where(
            StockMovement.company_id == tenant_ctx.company_id,
            StockMovement.reference_doc_type.in_(["SALES_INVOICE_CANCEL", "Sales Invoice Cancel"]),
            StockMovement.reference_doc_id == invoice_id,
            StockMovement.is_deleted.is_(False),
        )
        existing_rev = (await session.execute(rev_check_stmt)).scalars().all()
        if existing_rev:
            return list(existing_rev)

        for om in orig_movements:
            # Row lock product
            prod_stmt = select(Product).where(
                Product.id == om.product_id,
                Product.company_id == tenant_ctx.company_id,
                Product.is_deleted.is_(False),
            ).with_for_update()
            product = (await session.execute(prod_stmt)).scalars().first()
            if not product:
                continue

            # Batch restore if batch tracked
            if om.batch:
                batch_stmt = select(ProductBatchStock).where(
                    ProductBatchStock.company_id == tenant_ctx.company_id,
                    ProductBatchStock.product_id == om.product_id,
                    ProductBatchStock.batch_no == om.batch,
                    ProductBatchStock.is_deleted.is_(False),
                ).with_for_update()
                batch_obj = (await session.execute(batch_stmt)).scalars().first()
                if batch_obj:
                    batch_obj.quantity += Decimal(str(om.quantity))
                    batch_obj.modified_at = datetime.now(timezone.utc)
                    session.add(batch_obj)

            # Create compensating reversal movement
            rev_id = f"sm_rev_{uuid.uuid4().hex[:12]}"
            rev_mov = StockMovement(
                id=rev_id,
                uuid=rev_id,
                company_id=tenant_ctx.company_id,
                branch_id=tenant_ctx.branch_id,
                product_id=om.product_id,
                item_id=om.item_id,
                variant_id=om.variant_id,
                product_name=om.product_name,
                sku=om.sku,
                quantity=om.quantity,
                movement_type="RETURN_INWARD",
                reference_doc_type="SALES_INVOICE_CANCEL",
                reference_doc_id=invoice_id,
                warehouse_id=om.warehouse_id,
                batch=om.batch,
                unit_cost=om.unit_cost,
                remarks=f"Compensating stock reversal for cancelled Invoice {invoice_no}: {reason or 'Cancelled'}",
                source_module="Sales",
                user=user,
            )
            session.add(rev_mov)
            reversals.append(rev_mov)
            await session.flush()

            # Resynchronize cache
            await StockSynchronizer.sync_product_stock_cache(session, product.id, tenant_ctx.company_id)

        return reversals

    @classmethod
    async def record_dispatch_outward(
        cls,
        session: AsyncSession,
        tenant_ctx: TenantContext,
        dispatch_id: str,
        dispatch_no: str,
        packing_slip_id: str,
        items: List[Dict[str, Any]],
        invoice_id: Optional[str] = None,
        source_order_id: Optional[str] = None,
        user_id: Optional[str] = None,
        allow_negative_stock: bool = False,
    ) -> List[StockMovement]:
        """
        Records dispatch movements ensuring ZERO double-deduction.
        If an invoice already deducted stock via OUTWARD_SALE, dispatch does NOT deduct physical stock again.
        If dispatch is fulfilling a Sales Order reservation, physical stock is deducted and reservation released.
        """
        movements: List[StockMovement] = []
        user = user_id or "SYSTEM"

        # Check if invoice already deducted physical stock
        invoice_already_deducted = False
        if invoice_id:
            inv_mov_stmt = select(func.count(StockMovement.id)).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]),
                StockMovement.reference_doc_id == invoice_id,
                StockMovement.movement_type == "OUTWARD_SALE",
                StockMovement.is_deleted.is_(False),
            )
            inv_mov_count = (await session.execute(inv_mov_stmt)).scalar() or 0
            if inv_mov_count > 0:
                invoice_already_deducted = True

        for line in items:
            product_id = line.get("product_id")
            qty = Decimal(str(line.get("quantity") or 0))
            sku = line.get("sku")
            if qty <= Decimal("0.00"):
                continue

            # Idempotency check for this dispatch
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == tenant_ctx.company_id,
                StockMovement.reference_doc_type.in_(["DISPATCH", "Dispatch"]),
                StockMovement.reference_doc_id == dispatch_id,
                StockMovement.product_id == product_id,
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()
            if existing_mov:
                movements.append(existing_mov)
                continue

            # Row lock product
            prod_stmt = select(Product).where(
                Product.id == product_id,
                Product.company_id == tenant_ctx.company_id,
                Product.is_deleted.is_(False),
            ).with_for_update()
            product = (await session.execute(prod_stmt)).scalars().first()
            if not product:
                continue

            if invoice_already_deducted:
                # Stock was already deducted when invoice posted.
                # DO NOT double-deduct physical stock!
                logger.info(
                    "Dispatch %s for invoice %s: Physical stock already deducted via invoice. Skipping duplicate deduction.",
                    dispatch_no, invoice_id
                )
                # Release reserved stock if reserved for SO
                if source_order_id and product.reserved_stock:
                    product.reserved_stock = max(Decimal("0.00"), Decimal(str(product.reserved_stock)) - qty)
                    session.add(product)
                continue
            else:
                # Dispatch is deducting stock from SO reservation (dispatch-before-invoice workflow)
                avail_stock = Decimal(str(product.stock or 0))
                if avail_stock < qty and not allow_negative_stock:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient physical stock for '{product.name}'. Required {qty}, available {avail_stock}."
                    )

                movement_id = f"sm_dsp_{uuid.uuid4().hex[:12]}"
                mov = StockMovement(
                    id=movement_id,
                    uuid=movement_id,
                    company_id=tenant_ctx.company_id,
                    branch_id=tenant_ctx.branch_id,
                    product_id=product.id,
                    item_id=product.item_id,
                    variant_id=product.item_variant_id,
                    product_name=product.name,
                    sku=sku or product.sku or product.code,
                    quantity=qty,
                    movement_type="OUTWARD_DISPATCH",
                    reference_doc_type="DISPATCH",
                    reference_doc_id=dispatch_id,
                    remarks=f"Authoritative dispatch stock deduction: {dispatch_no}",
                    source_module="Fulfillment",
                    user=user,
                )
                session.add(mov)
                movements.append(mov)

                # Release reserved stock if reserved
                if source_order_id and product.reserved_stock:
                    product.reserved_stock = max(Decimal("0.00"), Decimal(str(product.reserved_stock)) - qty)
                    session.add(product)

                await session.flush()
                await StockSynchronizer.sync_product_stock_cache(session, product.id, tenant_ctx.company_id)

        return movements
