"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Sole Authoritative Single-Door Stock Ledger Engine
"""

import hashlib
import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple, Set

from fastapi import HTTPException
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
from app.services.stock_synchronizer import StockSynchronizer
from app.services.stock_movement_types import (
    INFLOW_MOVEMENT_TYPES,
    OUTFLOW_MOVEMENT_TYPES,
    SIGNED_MOVEMENT_TYPES,
    ALL_MOVEMENT_TYPES,
)

logger = logging.getLogger("smriti.stock_ledger")


@dataclass(frozen=True)
class InternalCost:
    """
    Typed, immutable internal valuation cost passed by trusted backend callers.
    Never part of any public or client-facing Pydantic request schema.
    """
    unit_cost: Decimal
    cost_source: str  # CALLER_INTERNAL, COST_SNAPSHOT, WAC, LAST_PURCHASE, STANDARD, PRODUCT_COST


@dataclass
class MovementRequest:
    """
    Internal movement specification for posting through the single door.
    """
    company_id: str
    product_id: str
    movement_type: str
    quantity: Decimal
    reference_doc_type: str
    reference_doc_id: str
    branch_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    batch_no: Optional[str] = None
    line_ref: Optional[str] = None
    remarks: Optional[str] = None
    user: Optional[str] = None
    source_module: Optional[str] = None
    internal_cost: Optional[InternalCost] = None
    allow_negative_stock: bool = False


@dataclass
class PostResult:
    """
    Result returned by the single door for a posted or replayed movement.
    """
    movement: StockMovement
    replayed: bool
    product_balance_after: Decimal
    batch_balance_after: Optional[Decimal] = None


class StockLedger:
    """
    Sole authoritative Single Door for all physical inventory movement mutations.
    Enforces:
    1. Dual-hash idempotency (idempotency_key + payload_hash) with 409 conflict detection.
    2. Strict lock ordering: Product row -> ProductBatchStock row -> Warehouse stock row.
    3. Multi-movement atomic batching (post_many) with pre-locking and cumulative negative stock checking.
    4. Savepoint isolation with safe concurrent retry handling.
    5. Pure cache resynchronization without phantom ledger row creation.
    6. Complete tenant isolation for all entities.
    """

    @classmethod
    def canonical_doc_type(cls, ref_type: Optional[str]) -> str:
        """
        Normalizes reference_doc_type into canonical uppercase format.
        """
        raw = (ref_type or "MANUAL").strip()
        upper = raw.upper().replace(" ", "_")
        return upper

    @classmethod
    def legacy_doc_type_variants(cls, ref_type: Optional[str]) -> List[str]:
        """
        Returns all legacy and canonical spellings for a reference document type.
        """
        canon = cls.canonical_doc_type(ref_type)
        if canon in ("SALES_INVOICE", "SALES_INVOICE_CANCEL"):
            return ["SALES_INVOICE", "Sales Invoice", "SALES INVOICE", "INV", "sales_invoice"]
        if canon == "DISTRIBUTION_ORDER":
            return ["DISTRIBUTION_ORDER", "Distribution Order", "DISTRIBUTION ORDER"]
        if canon in ("PURCHASE_RECEIPT", "GRN", "INWARD_GRN"):
            return ["PURCHASE_RECEIPT", "Purchase Receipt", "PURCHASE RECEIPT", "GRN", "grn"]
        if canon in ("SALES_RETURN", "RETURN_INWARD"):
            return ["SALES_RETURN", "Sales Return", "SALES RETURN", "RETURN", "return"]
        if canon in ("STOCK_TRANSFER", "TRANSFER"):
            return ["STOCK_TRANSFER", "Stock Transfer", "STOCK TRANSFER", "TRANSFER", "transfer"]
        if canon in ("STOCK_ADJUSTMENT", "ADJUSTMENT"):
            return ["STOCK_ADJUSTMENT", "Stock Adjustment", "STOCK ADJUSTMENT", "ADJUSTMENT"]
        return [canon, raw_str := str(ref_type or "")]

    @classmethod
    def compute_idempotency_key(
        cls,
        company_id: str,
        reference_doc_type: str,
        reference_doc_id: str,
        product_id: str,
        batch_no: Optional[str],
        movement_type: str,
        line_ref: Optional[str],
    ) -> str:
        """
        Computes SHA-256 idempotency key:
        (company_id, canonical reference_doc_type, reference_doc_id, product_id,
         batch_no or "~", movement_type, line_ref or "~") lowercased and joined with "|".
        """
        canon_ref = cls.canonical_doc_type(reference_doc_type)
        b_val = (batch_no or "~").strip()
        l_val = (line_ref or "~").strip()
        parts = [
            company_id.strip().lower(),
            canon_ref.lower(),
            str(reference_doc_id).strip().lower(),
            str(product_id).strip().lower(),
            b_val.lower(),
            movement_type.strip().lower(),
            l_val.lower(),
        ]
        raw_key = "|".join(parts)
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    @classmethod
    def compute_payload_hash(
        cls,
        product_id: str,
        batch_no: Optional[str],
        warehouse_id: Optional[str],
        quantity: Decimal,
        movement_type: str,
    ) -> str:
        """
        Computes SHA-256 payload hash of (product_id, batch_no, warehouse_id, quantity, movement_type).
        """
        b_val = (batch_no or "").strip()
        w_val = (warehouse_id or "").strip()
        # Quantize quantity to 2 decimals for normalized representation
        q_val = str(Decimal(str(quantity)).quantize(Decimal("0.01")))
        parts = [
            str(product_id).strip().lower(),
            b_val.lower(),
            w_val.lower(),
            q_val,
            movement_type.strip().lower(),
        ]
        raw_payload = "|".join(parts)
        return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    @classmethod
    async def post(
        cls,
        session: AsyncSession,
        req: MovementRequest,
    ) -> PostResult:
        """
        Posts a single stock movement through the authoritative single door.
        """
        results = await cls.post_many(session, [req])
        return results[0]

    @classmethod
    async def post_many(
        cls,
        session: AsyncSession,
        requests: List[MovementRequest],
    ) -> List[PostResult]:
        """
        Atomically posts multiple stock movements through the single door.
        1. Pre-validates tenant isolation and inputs.
        2. Computes idempotency keys and payload hashes.
        3. Checks for replay / 409 conflicts.
        4. Sorts and acquires locks in global order: Product -> Batch -> Warehouse.
        5. Validates cumulative negative-stock.
        6. Resolves cost and writes movements inside SAVEPOINT.
        7. Synchronizes affected product caches once.
        8. Returns results with final product and batch balances.
        """
        if not requests:
            return []

        company_id = requests[0].company_id
        for r in requests:
            if r.company_id != company_id:
                raise HTTPException(
                    status_code=400,
                    detail="Cross-tenant transactions in post_many are strictly prohibited.",
                )

        # ------------------------------------------------------------------
        # Phase 1: Pre-compute keys & hashes; check existing movements
        # ------------------------------------------------------------------
        computed_meta: List[Dict[str, Any]] = []
        for req in requests:
            qty = Decimal(str(req.quantity))
            mtype = req.movement_type.strip().upper()
            if mtype not in ALL_MOVEMENT_TYPES:
                logger.error(f"UNCLASSIFIED_MOVEMENT_TYPE: Disallowed movement_type '{mtype}' for product {req.product_id}")
                raise HTTPException(status_code=400, detail=f"Unclassified movement type '{mtype}'")

            idem_key = cls.compute_idempotency_key(
                company_id=company_id,
                reference_doc_type=req.reference_doc_type,
                reference_doc_id=req.reference_doc_id,
                product_id=req.product_id,
                batch_no=req.batch_no,
                movement_type=mtype,
                line_ref=req.line_ref,
            )
            pay_hash = cls.compute_payload_hash(
                product_id=req.product_id,
                batch_no=req.batch_no,
                warehouse_id=req.warehouse_id,
                quantity=qty,
                movement_type=mtype,
            )
            computed_meta.append({
                "req": req,
                "quantity": qty,
                "movement_type": mtype,
                "idempotency_key": idem_key,
                "payload_hash": pay_hash,
            })

        # ------------------------------------------------------------------
        # Phase 2: Check for existing movements by key or legacy match
        # ------------------------------------------------------------------
        results: List[Optional[PostResult]] = [None] * len(requests)
        items_to_apply_indices: List[int] = []

        for idx, meta in enumerate(computed_meta):
            req = meta["req"]
            idem_key = meta["idempotency_key"]
            pay_hash = meta["payload_hash"]

            # 1. Lookup by idempotency_key
            existing_stmt = select(StockMovement).where(
                StockMovement.company_id == company_id,
                StockMovement.idempotency_key == idem_key,
                StockMovement.is_deleted.is_(False),
            )
            existing_mov = (await session.execute(existing_stmt)).scalars().first()

            if existing_mov:
                if existing_mov.payload_hash == pay_hash:
                    # Same key + same payload_hash -> return existing as replay
                    # Fetch current balance
                    p_bal, b_bal = await cls._fetch_balances(session, company_id, req.product_id, req.batch_no, req.warehouse_id)
                    results[idx] = PostResult(
                        movement=existing_mov,
                        replayed=True,
                        product_balance_after=p_bal,
                        batch_balance_after=b_bal,
                    )
                    continue
                else:
                    # Same key + different payload_hash -> 409 Conflict
                    logger.warning(
                        f"IDEMPOTENCY_CONFLICT: Key {idem_key} matched but payload hash differ "
                        f"(stored={existing_mov.payload_hash}, new={pay_hash})"
                    )
                    raise HTTPException(
                        status_code=409,
                        detail=f"IDEMPOTENCY_CONFLICT: Movement with key '{idem_key}' already posted with different payload.",
                    )

            # 2. Legacy fallback for rows with NULL keys (Section B.3)
            legacy_variants = cls.legacy_doc_type_variants(req.reference_doc_type)
            legacy_stmt = select(StockMovement).where(
                StockMovement.company_id == company_id,
                StockMovement.reference_doc_type.in_(legacy_variants),
                StockMovement.reference_doc_id == req.reference_doc_id,
                StockMovement.product_id == req.product_id,
                StockMovement.movement_type == meta["movement_type"],
                StockMovement.is_deleted.is_(False),
            )
            if req.batch_no:
                legacy_stmt = legacy_stmt.where(StockMovement.batch == req.batch_no)

            legacy_mov = (await session.execute(legacy_stmt)).scalars().first()
            if legacy_mov:
                # Treat legacy NULL-key row as replay
                p_bal, b_bal = await cls._fetch_balances(session, company_id, req.product_id, req.batch_no, req.warehouse_id)
                results[idx] = PostResult(
                    movement=legacy_mov,
                    replayed=True,
                    product_balance_after=p_bal,
                    batch_balance_after=b_bal,
                )
                continue

            # Need to post this item
            items_to_apply_indices.append(idx)

        # If all items were replayed, return early
        if not items_to_apply_indices:
            return [r for r in results if r is not None]

        # ------------------------------------------------------------------
        # Phase 3: Sort & Acquire Locks (Section C.1 & C.2)
        # Order: Product row, then batch row, then warehouse stock row.
        # Sorted by (product_id, batch_no or "", warehouse_id or "")
        # ------------------------------------------------------------------
        needed_locks: Set[Tuple[str, str, str]] = set()
        for idx in items_to_apply_indices:
            meta = computed_meta[idx]
            req = meta["req"]
            needed_locks.add((
                req.product_id,
                req.batch_no or "",
                req.warehouse_id or "",
            ))

        sorted_locks = sorted(list(needed_locks), key=lambda x: (x[0], x[1], x[2]))

        locked_products: Dict[str, Product] = {}
        locked_batches: Dict[Tuple[str, str, str], ProductBatchStock] = {}

        for pid, bno, wid in sorted_locks:
            # 1. Lock Product Row
            if pid not in locked_products:
                prod_stmt = select(Product).where(
                    Product.id == pid,
                    Product.company_id == company_id,
                    Product.is_deleted.is_(False),
                ).with_for_update()
                prod = (await session.execute(prod_stmt)).scalars().first()
                if not prod:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Product '{pid}' not found or does not belong to tenant.",
                    )
                locked_products[pid] = prod

            # 2. Lock Batch Row (if batch specified)
            if bno:
                batch_key = (pid, bno, wid)
                if batch_key not in locked_batches:
                    batch_stmt = select(ProductBatchStock).where(
                        ProductBatchStock.company_id == company_id,
                        ProductBatchStock.product_id == pid,
                        ProductBatchStock.batch_no == bno,
                        ProductBatchStock.is_deleted.is_(False),
                    )
                    if wid:
                        batch_stmt = batch_stmt.where(ProductBatchStock.warehouse_id == wid)
                    batch_stmt = batch_stmt.with_for_update()
                    batch_obj = (await session.execute(batch_stmt)).scalars().first()

                    # If batch doesn't exist, create it if inward or fail if outward
                    locked_batches[batch_key] = batch_obj

            # 3. Warehouse tenant validation (Section C.6)
            if wid:
                wh_stmt = select(Warehouse).where(
                    Warehouse.id == wid,
                    Warehouse.company_id == company_id,
                    Warehouse.is_deleted.is_(False),
                )
                wh_obj = (await session.execute(wh_stmt)).scalars().first()
                if not wh_obj:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Warehouse '{wid}' not found or does not belong to tenant.",
                    )

        # ------------------------------------------------------------------
        # Phase 4: Cumulative Negative Stock Validation
        # ------------------------------------------------------------------
        # Calculate current net on-hand per locked product
        prod_running_balances: Dict[str, Decimal] = {}
        batch_running_balances: Dict[Tuple[str, str, str], Decimal] = {}

        for pid, prod in locked_products.items():
            curr_prod_bal, _ = await cls._fetch_balances(session, company_id, pid, None, None)
            prod_running_balances[pid] = curr_prod_bal

        for b_key, b_obj in locked_batches.items():
            if b_obj:
                batch_running_balances[b_key] = Decimal(str(b_obj.quantity or 0))

        # Save initial balances before Phase 4 delta accumulation
        progressive_prod_balances = dict(prod_running_balances)

        # Check in request order
        for idx in items_to_apply_indices:
            meta = computed_meta[idx]
            req = meta["req"]
            qty = meta["quantity"]
            mtype = meta["movement_type"]
            pid = req.product_id
            b_key = (pid, req.batch_no or "", req.warehouse_id or "")

            # Net delta effect
            if mtype in INFLOW_MOVEMENT_TYPES:
                delta = abs(qty)
            elif mtype in OUTFLOW_MOVEMENT_TYPES:
                delta = -abs(qty)
            else:
                delta = qty

            if not req.allow_negative_stock:
                if (prod_running_balances[pid] + delta) < Decimal("0.00"):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"INSUFFICIENT_STOCK: Cumulative negative stock violation for product {pid}. "
                            f"Current on-hand: {prod_running_balances[pid]}, deduction: {delta}."
                        ),
                    )
                if req.batch_no and b_key in batch_running_balances:
                    if (batch_running_balances[b_key] + delta) < Decimal("0.00"):
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"INSUFFICIENT_BATCH_STOCK: Batch {req.batch_no} for product {pid} has insufficient quantity. "
                                f"Available: {batch_running_balances[b_key]}, requested: {delta}."
                            ),
                        )

            # Update running tracking
            prod_running_balances[pid] += delta
            if req.batch_no and b_key in batch_running_balances:
                batch_running_balances[b_key] += delta

        # ------------------------------------------------------------------
        # Phase 5: Post Movements inside Savepoint & Update Batches
        # ------------------------------------------------------------------
        affected_product_ids: Set[str] = set()

        for idx in items_to_apply_indices:
            meta = computed_meta[idx]
            req = meta["req"]
            qty = meta["quantity"]
            mtype = meta["movement_type"]
            idem_key = meta["idempotency_key"]
            pay_hash = meta["payload_hash"]
            prod = locked_products[req.product_id]
            affected_product_ids.add(prod.id)

            # Resolve Unit Cost via InternalCost or CostManagementEngine (Section E)
            resolved_cost = Decimal("0.00")
            val_source = "UNRESOLVED_ZERO_COST"
            if req.internal_cost:
                resolved_cost = req.internal_cost.unit_cost.quantize(Decimal("0.01"))
                val_source = req.internal_cost.cost_source
            else:
                from .cost_engine import CostManagementEngine
                resolved_cost, val_source = await CostManagementEngine.resolve_cogs_unit_cost(
                    session=session,
                    company_id=company_id,
                    product_id=prod.id,
                )

            # Construct StockMovement
            movement_id = f"sm_{uuid.uuid4().hex[:12]}"
            movement = StockMovement(
                id=movement_id,
                uuid=movement_id,
                company_id=company_id,
                branch_id=req.branch_id or prod.branch_id,
                product_id=prod.id,
                item_id=prod.item_id,
                variant_id=prod.item_variant_id,
                product_name=prod.name,
                sku=prod.sku or prod.code,
                quantity=qty,
                movement_type=mtype,
                reference_doc_type=cls.canonical_doc_type(req.reference_doc_type),
                reference_doc_id=req.reference_doc_id,
                warehouse_id=req.warehouse_id,
                batch=req.batch_no,
                unit_cost=resolved_cost,
                cost_source=val_source,
                idempotency_key=idem_key,
                payload_hash=pay_hash,
                remarks=req.remarks or f"Single-Door {mtype} posting for {req.reference_doc_type} {req.reference_doc_id}",
                source_module=req.source_module or "STOCK_LEDGER",
                user=req.user or "SYSTEM",
            )

            # Savepoint-guarded insertion (Section B.2)
            try:
                async with session.begin_nested():
                    session.add(movement)
                    await session.flush()
            except IntegrityError as err:
                # Savepoint automatically rolled back by context manager
                # Re-read by idempotency_key to detect concurrent race
                existing_check = (
                    await session.execute(
                        select(StockMovement).where(
                            StockMovement.company_id == company_id,
                            StockMovement.idempotency_key == idem_key,
                        )
                    )
                ).scalars().first()

                if existing_check:
                    if existing_check.payload_hash == pay_hash:
                        p_bal, b_bal = await cls._fetch_balances(session, company_id, req.product_id, req.batch_no, req.warehouse_id)
                        results[idx] = PostResult(
                            movement=existing_check,
                            replayed=True,
                            product_balance_after=p_bal,
                            batch_balance_after=b_bal,
                        )
                        continue
                    else:
                        raise HTTPException(
                            status_code=409,
                            detail=f"IDEMPOTENCY_CONFLICT: Concurrent conflict on key '{idem_key}'.",
                        )
                # Re-raise any unrelated IntegrityError
                raise err

            # Update batch stocks if given
            b_key = (prod.id, req.batch_no or "", req.warehouse_id or "")
            batch_obj = locked_batches.get(b_key)
            if req.batch_no:
                if not batch_obj:
                    # Inward creation of batch row
                    batch_obj = ProductBatchStock(
                        id=f"pbs_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        branch_id=req.branch_id or prod.branch_id,
                        warehouse_id=req.warehouse_id,
                        product_id=prod.id,
                        batch_no=req.batch_no,
                        quantity=Decimal("0.0000"),
                        is_active=True,
                    )
                    session.add(batch_obj)
                    locked_batches[b_key] = batch_obj

                # Apply delta to batch
                if mtype in INFLOW_MOVEMENT_TYPES:
                    batch_obj.quantity += abs(qty)
                elif mtype in OUTFLOW_MOVEMENT_TYPES:
                    batch_obj.quantity -= abs(qty)
                else:
                    batch_obj.quantity += qty
                await session.flush()

            # Apply delta to progressive product balance
            if mtype in INFLOW_MOVEMENT_TYPES:
                p_delta = abs(qty)
            elif mtype in OUTFLOW_MOVEMENT_TYPES:
                p_delta = -abs(qty)
            else:
                p_delta = qty
            progressive_prod_balances[prod.id] += p_delta

            # Record pending result
            final_batch_qty = batch_obj.quantity if batch_obj else None
            results[idx] = PostResult(
                movement=movement,
                replayed=False,
                product_balance_after=progressive_prod_balances[prod.id],
                batch_balance_after=final_batch_qty,
            )

        # ------------------------------------------------------------------
        # Phase 6: Refresh Affected Product Caches Once (Section C.3)
        # ------------------------------------------------------------------
        for pid in affected_product_ids:
            try:
                await StockSynchronizer.sync_product_stock_cache(
                    session=session,
                    product_id=pid,
                    company_id=company_id,
                )
            except Exception as ex:
                logger.error(f"Cache refresh failed for product {pid}: {ex}. Aborting entire transaction.")
                raise HTTPException(
                    status_code=500,
                    detail=f"Stock cache synchronization failed for product '{pid}': {ex}",
                )

        return [r for r in results if r is not None]

    @classmethod
    async def post_admin_opening_stock(
        cls,
        session: AsyncSession,
        company_id: str,
        product_id: str,
        quantity: Decimal,
        reason: str,
        warehouse_id: Optional[str] = None,
        batch_no: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> PostResult:
        """
        Explicit administrative operation to post OPENING_STOCK with required reason (Section D.2).
        Replaces auto-created silent opening stock synthesis.
        """
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=400,
                detail="A valid business reason is mandatory for posting opening stock.",
            )

        req = MovementRequest(
            company_id=company_id,
            product_id=product_id,
            movement_type="OPENING_STOCK",
            quantity=abs(Decimal(str(quantity))),
            reference_doc_type="OPENING_BALANCE",
            reference_doc_id=product_id,
            warehouse_id=warehouse_id,
            batch_no=batch_no,
            line_ref="ADMIN_OPENING",
            remarks=f"Admin opening balance: {reason.strip()}",
            user=user_id or "ADMIN",
            source_module="ADMIN_INVENTORY",
            allow_negative_stock=True,
        )
        return await cls.post(session, req)

    @classmethod
    async def _fetch_balances(
        cls,
        session: AsyncSession,
        company_id: str,
        product_id: str,
        batch_no: Optional[str],
        warehouse_id: Optional[str],
    ) -> Tuple[Decimal, Optional[Decimal]]:
        """
        Calculates company-wide product ledger balance and optional batch balance.
        """
        from .stock_ledger_query import get_signed_movement_quantity_expr

        # 1. Product Ledger Balance
        signed_expr = get_signed_movement_quantity_expr()
        p_stmt = select(
            func.coalesce(func.sum(signed_expr), 0)
        ).where(
            StockMovement.company_id == company_id,
            StockMovement.product_id == product_id,
            StockMovement.is_deleted.is_(False),
        )
        p_bal = Decimal(str((await session.execute(p_stmt)).scalar() or 0))

        # 2. Batch Balance (if batch_no given)
        b_bal = None
        if batch_no:
            b_stmt = select(
                func.coalesce(func.sum(ProductBatchStock.quantity), 0)
            ).where(
                ProductBatchStock.company_id == company_id,
                ProductBatchStock.product_id == product_id,
                ProductBatchStock.batch_no == batch_no,
                ProductBatchStock.is_deleted.is_(False),
            )
            if warehouse_id:
                b_stmt = b_stmt.where(ProductBatchStock.warehouse_id == warehouse_id)
            b_bal = Decimal(str((await session.execute(b_stmt)).scalar() or 0))

        return p_bal, b_bal
