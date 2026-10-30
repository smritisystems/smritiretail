"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Comprehensive Stock Movement Invariant Validation & Reconciliation Engine
"""

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any, Set
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import Product, StockMovement, ProductBatchStock, Warehouse
from app.models.sales import SalesInvoice
from app.models.purchase import PurchaseReceipt, PurchaseOrder
from app.models.goods_receipt import GoodsReceiptNote
from app.services.stock_synchronizer import INFLOW_MOVEMENT_TYPES, OUTFLOW_MOVEMENT_TYPES


class TransactionReference(BaseModel):
    transaction_id: str
    doc_type: str
    movement_type: Optional[str] = None
    status: Optional[str] = None
    quantity: float
    warehouse_id: Optional[str] = None
    created_at: Optional[str] = None
    user: Optional[str] = None


class StockDiscrepancyItem(BaseModel):
    product_id: str
    sku: str
    product_name: str
    article_code: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    variant_id: Optional[str] = None
    company_id: str
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    
    # Invariant formula breakdown
    opening_stock: float = 0.0
    purchase_receipts: float = 0.0
    sales_returns: float = 0.0
    transfers_in: float = 0.0
    positive_adjustments: float = 0.0
    sales_dispatches: float = 0.0
    purchase_returns: float = 0.0
    transfers_out: float = 0.0
    negative_adjustments: float = 0.0
    damage_write_offs: float = 0.0
    
    # Reconciled results
    expected_closing_stock: float = 0.0
    actual_ledger_stock: float = 0.0
    cached_stock: float = 0.0
    quantity_variance: float = 0.0  # expected - actual or cached - actual
    
    discrepancy_category: str  # 9-state taxonomy
    severity: str              # CRITICAL, HIGH, MEDIUM, LOW
    likely_root_cause: str
    recommended_corrective_action: str
    manual_approval_required: bool = True
    
    related_transactions: List[TransactionReference] = Field(default_factory=list)


class StockReconciliationReport(BaseModel):
    audit_id: str
    generated_at: str
    company_id: str
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    filter_criteria: Dict[str, Any] = Field(default_factory=dict)
    
    total_products_audited: int = 0
    balanced_products_count: int = 0
    discrepancy_count: int = 0
    total_variance_units: float = 0.0
    
    discrepancies_by_category: Dict[str, int] = Field(default_factory=dict)
    discrepancies_by_severity: Dict[str, int] = Field(default_factory=dict)
    
    discrepancies: List[StockDiscrepancyItem] = Field(default_factory=list)


class ProposedStockCorrection(BaseModel):
    proposal_id: str
    company_id: str
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    product_id: str
    sku: str
    product_name: str
    correction_type: str  # "SYNTHESIZE_OPENING_LEDGER", "RESYNC_CACHE", "COMPENSATING_ADJUSTMENT"
    before_stock: float
    proposed_after_stock: float
    delta_stock: float
    source_reference: str
    audit_trail_reason: str
    manual_approval_required: bool = True
    status: str = "PROPOSED_READ_ONLY"


class HistoricalCorrectionPlan(BaseModel):
    plan_id: str
    created_at: str
    company_id: str
    total_proposals: int = 0
    net_positive_delta: float = 0.0
    net_negative_delta: float = 0.0
    proposals: List[ProposedStockCorrection] = Field(default_factory=list)
    authorization_notice: str = (
        "MANDATORY GOVERNANCE NOTICE: This correction plan is strictly read-only and non-destructive. "
        "No historical balances have been altered. Explicit system administrator authorization is "
        "required before any correction proposal can be executed."
    )


class StockReconciliationEngine:
    """
    Authoritative, non-destructive audit engine for validating stock movement invariants,
    detecting transactional drifts across all operational lifecycles, and formulating
    read-only correction proposals.
    """

    @classmethod
    async def run_reconciliation_audit(
        cls,
        session: AsyncSession,
        company_id: str,
        branch_id: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        product_id: Optional[str] = None,
        sku: Optional[str] = None,
        limit: int = 500,
    ) -> StockReconciliationReport:
        import uuid
        audit_id = f"audit_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Fetch Candidate Products within tenant isolation boundary
        prod_query = select(Product).where(
            Product.company_id == company_id,
            Product.is_deleted.is_(False),
        )
        if branch_id:
            prod_query = prod_query.where(Product.branch_id == branch_id)
        if product_id:
            prod_query = prod_query.where(Product.id == product_id)
        if sku:
            prod_query = prod_query.where(
                or_(
                    Product.sku.ilike(f"%{sku}%"),
                    Product.code.ilike(f"%{sku}%")
                )
            )
        
        prod_query = prod_query.limit(limit)
        prod_res = await session.execute(prod_query)
        products = prod_res.scalars().all()

        discrepancies: List[StockDiscrepancyItem] = []
        category_counts: Dict[str, int] = {
            "MISSING_MOVEMENT": 0,
            "DUPLICATE_MOVEMENT": 0,
            "INCORRECT_QUANTITY": 0,
            "WRONG_WAREHOUSE_OR_COMPANY": 0,
            "VARIANT_MISMATCH": 0,
            "FAILED_REVERSAL": 0,
            "NEGATIVE_STOCK": 0,
            "CACHE_MISMATCH": 0,
            "UNEXPLAINED_VARIANCE": 0,
        }
        severity_counts: Dict[str, int] = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        }
        total_variance_units = Decimal("0.00")

        # Fetch warehouse map for friendly names
        wh_res = await session.execute(
            select(Warehouse.id, Warehouse.name).where(
                Warehouse.company_id == company_id,
                Warehouse.is_deleted.is_(False),
            )
        )
        wh_map = {row[0]: row[1] for row in wh_res.all()}

        for p in products:
            p_canon_var_id = getattr(p, "item_variant_id", None) or (str(p.variant_id) if getattr(p, "variant_id", None) else None)
            
            # Query all relevant movements for this product
            move_filters = [
                StockMovement.company_id == company_id,
                StockMovement.is_deleted.is_(False),
            ]
            if p_canon_var_id:
                move_filters.append(
                    or_(
                        StockMovement.product_id == p.id,
                        StockMovement.variant_id == p_canon_var_id,
                    )
                )
            else:
                move_filters.append(StockMovement.product_id == p.id)

            if warehouse_id:
                move_filters.append(StockMovement.warehouse_id == warehouse_id)

            if start_date:
                move_filters.append(func.date(StockMovement.created_at) >= start_date)
            if end_date:
                move_filters.append(func.date(StockMovement.created_at) <= end_date)

            moves_stmt = select(StockMovement).where(*move_filters).order_by(StockMovement.created_at.asc())
            movements = (await session.execute(moves_stmt)).scalars().all()

            # Query active batch stock rows
            batch_filters = [
                ProductBatchStock.company_id == company_id,
                ProductBatchStock.product_id == p.id,
                ProductBatchStock.is_deleted.is_(False),
            ]
            if warehouse_id:
                batch_filters.append(ProductBatchStock.warehouse_id == warehouse_id)
            
            batch_res = await session.execute(select(ProductBatchStock).where(*batch_filters))
            batches = batch_res.scalars().all()
            total_batch_stock = sum(Decimal(str(b.quantity - b.damaged_quantity)) for b in batches)
            has_batches = len(batches) > 0

            # Compute formula components according to Phase 2 invariant:
            opening_stock = Decimal("0.00")
            purchase_receipts = Decimal("0.00")
            sales_returns = Decimal("0.00")
            transfers_in = Decimal("0.00")
            positive_adjustments = Decimal("0.00")
            sales_dispatches = Decimal("0.00")
            purchase_returns = Decimal("0.00")
            transfers_out = Decimal("0.00")
            negative_adjustments = Decimal("0.00")
            damage_write_offs = Decimal("0.00")

            seen_doc_keys: Set[str] = set()
            duplicate_movements_found = False
            variant_mismatch_found = False
            wrong_tenant_found = False

            tx_refs: List[TransactionReference] = []

            for m in movements:
                mtype = (m.movement_type or "").upper()
                qty_raw = Decimal(str(m.quantity or 0))
                abs_qty = abs(qty_raw)

                # Check Tenant & Warehouse context invariant
                if m.company_id != company_id:
                    wrong_tenant_found = True

                # Check Variant resolution invariant
                if p_canon_var_id and m.variant_id and m.variant_id != p_canon_var_id:
                    variant_mismatch_found = True

                # Check Idempotency / Duplicate invariant
                if m.reference_doc_id and m.reference_doc_type and mtype != "OPENING_STOCK":
                    doc_key = f"{m.reference_doc_type}:{m.reference_doc_id}:{mtype}:{abs_qty}"
                    if doc_key in seen_doc_keys:
                        duplicate_movements_found = True
                    seen_doc_keys.add(doc_key)

                tx_refs.append(
                    TransactionReference(
                        transaction_id=str(m.id),
                        doc_type=m.reference_doc_type or "LEDGER",
                        movement_type=mtype,
                        status="POSTED",
                        quantity=float(qty_raw),
                        warehouse_id=m.warehouse_id,
                        created_at=m.created_at.isoformat() if m.created_at else None,
                        user=m.user,
                    )
                )

                # Accumulate invariant components
                if mtype == "OPENING_STOCK" or (mtype == "IN" and m.reference_doc_type == "OPENING_BALANCE"):
                    opening_stock += abs_qty
                elif mtype in ("INWARD_GRN", "GRN", "INWARD_PURCHASE", "PURCHASE"):
                    purchase_receipts += abs_qty
                elif mtype in ("RETURN_INWARD", "SALES_RETURN", "SALES_CANCEL", "RETURN"):
                    sales_returns += abs_qty
                elif mtype in ("TRANSFER_IN", "INWARD_SURPLUS"):
                    transfers_in += abs_qty
                elif mtype == "ADJUSTMENT_IN" or (mtype in ("ADJUSTMENT", "STOCK_ADJUSTMENT") and qty_raw > 0):
                    positive_adjustments += abs_qty
                elif mtype in ("OUTWARD_SALE", "POS_SALE", "SALE", "OUTWARD_ECOM"):
                    sales_dispatches += abs_qty
                elif mtype in ("RETURN_OUTWARD", "PURCHASE_RETURN"):
                    purchase_returns += abs_qty
                elif mtype in ("TRANSFER_OUT", "OUTWARD_DISPATCH", "DISPATCH"):
                    transfers_out += abs_qty
                elif mtype == "ADJUSTMENT_OUT" or (mtype in ("ADJUSTMENT", "STOCK_ADJUSTMENT") and qty_raw < 0):
                    negative_adjustments += abs_qty
                elif mtype in ("DAMAGE", "WRITE_OFF", "OUTWARD_LOSS"):
                    damage_write_offs += abs_qty
                elif mtype in INFLOW_MOVEMENT_TYPES:
                    purchase_receipts += abs_qty
                elif mtype in OUTFLOW_MOVEMENT_TYPES:
                    sales_dispatches += abs_qty
                elif mtype in ("TRANSFER", "STOCK_TRANSFER"):
                    if qty_raw > 0:
                        transfers_in += qty_raw
                    else:
                        transfers_out += abs_qty

            # Calculate Expected Closing On-Hand Quantity per Phase 2 Invariant:
            expected_closing_stock = (
                opening_stock
                + purchase_receipts
                + sales_returns
                + transfers_in
                + positive_adjustments
                - sales_dispatches
                - purchase_returns
                - transfers_out
                - negative_adjustments
                - damage_write_offs
            )

            # Authoritative Ledger Stock
            if has_batches:
                actual_ledger_stock = total_batch_stock
            else:
                actual_ledger_stock = expected_closing_stock

            cached_stock = Decimal(str(p.stock or 0))
            variance = cached_stock - actual_ledger_stock

            # Determine Discrepancy Taxonomy
            category: Optional[str] = None
            severity = "LOW"
            likely_root_cause = ""
            recommended_action = ""

            if wrong_tenant_found:
                category = "WRONG_WAREHOUSE_OR_COMPANY"
                severity = "CRITICAL"
                likely_root_cause = "Stock movements recorded under cross-tenant company or foreign warehouse identifier."
                recommended_action = "Quarantine contaminated ledger records and re-post under verified tenant scope."
            elif duplicate_movements_found:
                category = "DUPLICATE_MOVEMENT"
                severity = "CRITICAL"
                likely_root_cause = "Non-idempotent posting or unhandled network retry emitted multiple stock movements for single document."
                recommended_action = "Identify duplicate transaction IDs, mark redundant movements as deleted, and resync product stock."
            elif variant_mismatch_found:
                category = "VARIANT_MISMATCH"
                severity = "HIGH"
                likely_root_cause = "Transaction line resolved to parent product instead of specific article/color/size variant ID."
                recommended_action = "Re-resolve transaction lines to canonical item_variant_id via ProductResolutionService."
            elif actual_ledger_stock < 0:
                category = "NEGATIVE_STOCK"
                severity = "HIGH"
                likely_root_cause = "Sales or transfers dispatched beyond recorded physical on-hand without unledgered initial stock synthesis."
                recommended_action = "Synthesize opening stock audit record with explicit administrator verification."
            elif len(movements) == 0 and not has_batches and cached_stock > 0:
                category = "MISSING_MOVEMENT"
                severity = "MEDIUM"
                likely_root_cause = "Legacy product initialized directly via catalog seed with stock > 0 without opening StockMovement entry."
                recommended_action = "Generate authorized OPENING_STOCK movement to anchor movement ledger to catalog balance."
            elif abs(variance) > Decimal("0.001"):
                category = "CACHE_MISMATCH"
                severity = "MEDIUM"
                likely_root_cause = "Materialized products.stock cache drifted from authoritative ledger after async transaction or unhooked mutation."
                recommended_action = "Run StockSynchronizer.sync_product_stock_cache to realign cached stock with ledger truth."
            elif abs(expected_closing_stock - actual_ledger_stock) > Decimal("0.001"):
                category = "UNEXPLAINED_VARIANCE"
                severity = "CRITICAL"
                likely_root_cause = "Divergence between movement ledger invariant formula and active batch stock physical balances."
                recommended_action = "Execute complete physical stock audit count and record compensating stock adjustment."

            if category:
                category_counts[category] += 1
                severity_counts[severity] += 1
                total_variance_units += abs(variance)

                discrepancies.append(
                    StockDiscrepancyItem(
                        product_id=p.id,
                        sku=p.sku or p.code or "UNKNOWN",
                        product_name=p.name,
                        article_code=getattr(p, "article_code", None),
                        color=getattr(p, "color", None),
                        size=getattr(p, "size", None),
                        variant_id=p_canon_var_id,
                        company_id=p.company_id,
                        branch_id=p.branch_id,
                        warehouse_id=warehouse_id or getattr(p, "warehouse_id", None),
                        warehouse_name=wh_map.get(warehouse_id or getattr(p, "warehouse_id", None)),
                        opening_stock=float(opening_stock),
                        purchase_receipts=float(purchase_receipts),
                        sales_returns=float(sales_returns),
                        transfers_in=float(transfers_in),
                        positive_adjustments=float(positive_adjustments),
                        sales_dispatches=float(sales_dispatches),
                        purchase_returns=float(purchase_returns),
                        transfers_out=float(transfers_out),
                        negative_adjustments=float(negative_adjustments),
                        damage_write_offs=float(damage_write_offs),
                        expected_closing_stock=float(expected_closing_stock),
                        actual_ledger_stock=float(actual_ledger_stock),
                        cached_stock=float(cached_stock),
                        quantity_variance=float(variance),
                        discrepancy_category=category,
                        severity=severity,
                        likely_root_cause=likely_root_cause,
                        recommended_corrective_action=recommended_action,
                        manual_approval_required=True,
                        related_transactions=tx_refs[:15],
                    )
                )

        total_audited = len(products)
        disc_count = len(discrepancies)
        clean_count = total_audited - disc_count

        return StockReconciliationReport(
            audit_id=audit_id,
            generated_at=now_iso,
            company_id=company_id,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            filter_criteria={
                "branch_id": branch_id,
                "warehouse_id": warehouse_id,
                "product_id": product_id,
                "sku": sku,
            },
            total_products_audited=total_audited,
            balanced_products_count=clean_count,
            discrepancy_count=disc_count,
            total_variance_units=float(total_variance_units),
            discrepancies_by_category=category_counts,
            discrepancies_by_severity=severity_counts,
            discrepancies=discrepancies,
        )

    @classmethod
    async def generate_correction_proposal(
        cls,
        session: AsyncSession,
        company_id: str,
        audit_report: StockReconciliationReport,
    ) -> HistoricalCorrectionPlan:
        """
        Formulates a proposed historical correction plan.
        DOES NOT mutate the database. Strictly read-only for audit, governance, and review.
        """
        import uuid
        plan_id = f"plan_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        proposals: List[ProposedStockCorrection] = []
        net_pos = Decimal("0.00")
        net_neg = Decimal("0.00")

        for disc in audit_report.discrepancies:
            corr_type = "RESYNC_CACHE"
            delta = Decimal(str(disc.actual_ledger_stock)) - Decimal(str(disc.cached_stock))
            proposed_after = disc.actual_ledger_stock

            if disc.discrepancy_category == "MISSING_MOVEMENT":
                corr_type = "SYNTHESIZE_OPENING_LEDGER"
                delta = Decimal(str(disc.cached_stock))
                proposed_after = disc.cached_stock
            elif disc.discrepancy_category == "NEGATIVE_STOCK":
                corr_type = "COMPENSATING_ADJUSTMENT"
                delta = abs(Decimal(str(disc.actual_ledger_stock)))
                proposed_after = 0.0

            if delta > 0:
                net_pos += delta
            else:
                net_neg += abs(delta)

            prop_id = f"prop_{uuid.uuid4().hex[:8]}"
            proposals.append(
                ProposedStockCorrection(
                    proposal_id=prop_id,
                    company_id=disc.company_id,
                    branch_id=disc.branch_id,
                    warehouse_id=disc.warehouse_id,
                    product_id=disc.product_id,
                    sku=disc.sku,
                    product_name=disc.product_name,
                    correction_type=corr_type,
                    before_stock=disc.cached_stock,
                    proposed_after_stock=float(proposed_after),
                    delta_stock=float(delta),
                    source_reference=f"AUDIT-DISC-{disc.discrepancy_category}-{disc.product_id[:8]}",
                    audit_trail_reason=f"Compensatory remediation for {disc.discrepancy_category}. {disc.likely_root_cause}",
                    manual_approval_required=True,
                    status="PROPOSED_READ_ONLY",
                )
            )

        return HistoricalCorrectionPlan(
            plan_id=plan_id,
            created_at=now_iso,
            company_id=company_id,
            total_proposals=len(proposals),
            net_positive_delta=float(net_pos),
            net_negative_delta=float(net_neg),
            proposals=proposals,
        )
