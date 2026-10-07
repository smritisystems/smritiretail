"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Centralized Stock Synchronization & Source-of-Truth Engine
"""

from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import Product, ProductBatchStock, StockMovement

INFLOW_MOVEMENT_TYPES = {
    "IN",
    "INWARD_PURCHASE",
    "INWARD_GRN",
    "GRN",
    "RETURN_INWARD",
    "ADJUSTMENT_IN",
    "TRANSFER_IN",
    "INWARD_SURPLUS",
    "OPENING_STOCK",
}

OUTFLOW_MOVEMENT_TYPES = {
    "OUT",
    "OUTWARD_SALE",
    "ADJUSTMENT_OUT",
    "TRANSFER_OUT",
    "RETURN_OUTWARD",
    "OUTWARD_LOSS",
    "OUTWARD_DISPATCH",
    "POS_SALE",
}


class StockDriftRecord(BaseModel):
    product_id: str
    sku: str
    product_name: str
    tracking_mode: str | None
    cached_stock: int
    authoritative_stock: float
    drift: float
    source_of_truth: str  # "BATCH_LEDGER" or "MOVEMENT_LEDGER"
    status: str           # "OVERSTATED", "UNDERSTATED", or "BALANCED"


class StockReconciliationSummary(BaseModel):
    company_id: str
    total_products_checked: int
    clean_count: int
    drift_count: int
    repaired_count: int
    drifts: list[StockDriftRecord]


class StockSynchronizer:
    """
    Centralized canonical service for synchronizing the cached `products.stock`
    aggregate from authoritative inventory ledgers.

    Architectural Invariant (Phase 1 Audit E-001):
    - For batch-tracked products (tracking_mode == 'Batch' or active ProductBatchStock rows):
      Authoritative ledger is `product_batch_stocks`.
      Stock = SUM(quantity - damaged_quantity).
    - For non-batch products:
      Authoritative ledger is `stock_movements`.
      Stock = SUM(inflow_quantities) - SUM(outflow_quantities).
    - `products.stock` is strictly a READ-ONLY materialized cache.
      Direct mutations bypassing this synchronizer are prohibited.
    """

    @classmethod
    async def sync_product_stock_cache(
        cls,
        session: AsyncSession,
        product_id: str,
        company_id: str,
    ) -> Decimal:
        """
        Synchronizes `products.stock` for a specific product from its authoritative ledger.
        Locks the product row for update to ensure concurrency safety.
        Returns the computed authoritative on-hand stock as Decimal.
        """
        # Lock product for update
        prod_res = await session.execute(
            select(Product).where(
                Product.company_id == company_id,
                Product.id == product_id,
                Product.is_deleted.is_(False),
            ).with_for_update()
        )
        product = prod_res.scalar_one_or_none()
        if not product:
            return Decimal("0.00")

        # 1. Check if active ProductBatchStock rows exist for this product
        batch_count_stmt = select(func.count(ProductBatchStock.id)).where(
            ProductBatchStock.company_id == company_id,
            ProductBatchStock.product_id == product_id,
            ProductBatchStock.is_deleted.is_(False),
        )
        batch_count = (await session.execute(batch_count_stmt)).scalar() or 0

        if batch_count > 0:
            # Authoritative source: product_batch_stocks
            # Usable on-hand = SUM(quantity - damaged_quantity)
            sum_stmt = select(
                func.coalesce(
                    func.sum(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity),
                    0,
                )
            ).where(
                ProductBatchStock.company_id == company_id,
                ProductBatchStock.product_id == product_id,
                ProductBatchStock.is_deleted.is_(False),
            )
            authoritative_stock = Decimal(str((await session.execute(sum_stmt)).scalar() or 0))
        else:
            # Authoritative source: stock_movements ledger with canonical variant matching
            canon_var_id = getattr(product, "item_variant_id", None) or (str(product.variant_id) if getattr(product, "variant_id", None) else None)
            moves_filter = [
                StockMovement.company_id == company_id,
                StockMovement.is_deleted.is_(False),
            ]
            if canon_var_id:
                moves_filter.append(
                    or_(
                        StockMovement.product_id == product_id,
                        StockMovement.variant_id == canon_var_id,
                    )
                )
            else:
                moves_filter.append(StockMovement.product_id == product_id)

            moves_stmt = select(StockMovement).where(*moves_filter).distinct()
            movements = (await session.execute(moves_stmt)).scalars().all()

            # Ensure unledgered initial product stock has an immutable OPENING_STOCK movement
            has_primary_inward = any(
                (m.movement_type or "").upper() in ("OPENING_STOCK", "IN", "INWARD_PURCHASE", "INWARD_GRN", "GRN", "INWARD_SURPLUS")
                for m in movements
            )
            if not has_primary_inward and product.stock and product.stock > 0:
                import uuid
                opening_mov = StockMovement(
                    id=f"sm_open_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=product.branch_id,
                    product_id=product_id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=Decimal(str(product.stock)),
                    movement_type="OPENING_STOCK",
                    reference_doc_type="OPENING_BALANCE",
                    reference_doc_id=product.id,
                    remarks="Automatic opening stock ledger reconciliation",
                    user="SYSTEM",
                )
                session.add(opening_mov)
                movements = list(movements) + [opening_mov]

            computed = Decimal("0.00")
            for m in movements:
                mtype = (m.movement_type or "").upper()
                raw_qty = Decimal(str(abs(m.quantity or 0)))
                if mtype in INFLOW_MOVEMENT_TYPES:
                    computed += raw_qty
                elif mtype in OUTFLOW_MOVEMENT_TYPES:
                    computed -= raw_qty
            authoritative_stock = computed

        # Update cached materialized stock
        product.stock = int(authoritative_stock)
        await session.flush()
        return authoritative_stock

    @classmethod
    async def sync_variant_stock_cache(
        cls,
        session: AsyncSession,
        variant_id: str,
        company_id: str,
    ) -> Decimal:
        """
        Synchronizes stock cache for a specific canonical variant by resolving its
        associated Product record and running canonical synchronization.
        """
        prod_res = await session.execute(
            select(Product).where(
                Product.company_id == company_id,
                or_(
                    Product.item_variant_id == variant_id,
                    Product.id == variant_id,
                ),
                Product.is_deleted.is_(False),
            )
        )
        product = prod_res.scalars().first()
        if not product:
            return Decimal("0.00")
        return await cls.sync_product_stock_cache(session, product.id, company_id)

    @classmethod
    async def detect_stock_drift(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 500,
    ) -> list[StockDriftRecord]:
        """
        Detects silent divergence between `products.stock` cache and authoritative ledgers.
        Returns a list of StockDriftRecord items.
        """
        prod_stmt = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted.is_(False),
        ).limit(limit)
        products = (await session.execute(prod_stmt)).scalars().all()

        drift_records: list[StockDriftRecord] = []
        for p in products:
            # Check batch stock count
            batch_count_stmt = select(func.count(ProductBatchStock.id)).where(
                ProductBatchStock.company_id == company_id,
                ProductBatchStock.product_id == p.id,
                ProductBatchStock.is_deleted.is_(False),
            )
            has_batches = ((await session.execute(batch_count_stmt)).scalar() or 0) > 0

            if has_batches:
                sot = "BATCH_LEDGER"
                sum_stmt = select(
                    func.coalesce(
                        func.sum(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity),
                        0,
                    )
                ).where(
                    ProductBatchStock.company_id == company_id,
                    ProductBatchStock.product_id == p.id,
                    ProductBatchStock.is_deleted.is_(False),
                )
                auth_qty = Decimal(str((await session.execute(sum_stmt)).scalar() or 0))
            else:
                sot = "MOVEMENT_LEDGER"
                p_canon_var_id = getattr(p, "item_variant_id", None) or (str(p.variant_id) if getattr(p, "variant_id", None) else None)
                moves_filter = [
                    StockMovement.company_id == company_id,
                    StockMovement.is_deleted.is_(False),
                ]
                if p_canon_var_id:
                    moves_filter.append(
                        or_(
                            StockMovement.product_id == p.id,
                            StockMovement.variant_id == p_canon_var_id,
                        )
                    )
                else:
                    moves_filter.append(StockMovement.product_id == p.id)

                moves_stmt = select(StockMovement).where(*moves_filter).distinct()
                movements = (await session.execute(moves_stmt)).scalars().all()
                auth_qty = Decimal("0.00")
                for m in movements:
                    mtype = (m.movement_type or "").upper()
                    raw_qty = Decimal(str(abs(m.quantity or 0)))
                    if mtype in INFLOW_MOVEMENT_TYPES:
                        auth_qty += raw_qty
                    elif mtype in OUTFLOW_MOVEMENT_TYPES:
                        auth_qty -= raw_qty

            cached_qty = Decimal(str(p.stock or 0))
            drift = cached_qty - auth_qty
            if abs(drift) > Decimal("0.001"):
                status = "OVERSTATED" if drift > 0 else "UNDERSTATED"
                drift_records.append(
                    StockDriftRecord(
                        product_id=p.id,
                        sku=p.sku or p.code or "UNKNOWN",
                        product_name=p.name,
                        tracking_mode=p.tracking_mode,
                        cached_stock=int(cached_qty),
                        authoritative_stock=float(auth_qty),
                        drift=float(drift),
                        source_of_truth=sot,
                        status=status,
                    )
                )

        return drift_records

    @classmethod
    async def reconcile_and_repair_drift(
        cls,
        session: AsyncSession,
        company_id: str,
        fix_drift: bool = True,
        commit: bool = True,
    ) -> StockReconciliationSummary:
        """
        Comprehensive stock reconciliation and drift resolution.
        Audits all products in `company_id`. When fix_drift=True, re-aligns
        `products.stock` to authoritative values.
        """
        all_prods_stmt = select(func.count(Product.id)).where(
            Product.company_id == company_id,
            Product.is_deleted.is_(False),
        )
        total_products = (await session.execute(all_prods_stmt)).scalar() or 0

        drifts = await cls.detect_stock_drift(session, company_id)
        repaired_count = 0

        if fix_drift and drifts:
            for d in drifts:
                await cls.sync_product_stock_cache(session, d.product_id, company_id)
                repaired_count += 1
            if commit:
                await session.commit()
            else:
                await session.flush()

        clean_count = total_products - len(drifts)
        return StockReconciliationSummary(
            company_id=company_id,
            total_products_checked=total_products,
            clean_count=clean_count,
            drift_count=len(drifts),
            repaired_count=repaired_count,
            drifts=drifts,
        )
