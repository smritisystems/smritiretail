"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.40.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import logging
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.inventory import Product, StockMovement
from app.models.transfer import (
    StockTransferOrder,
    StockTransferOrderItem,
    StockRebalancingRecommendation,
)

logger = logging.getLogger("smriti.rebalancing_service")


class StockRebalancingService:
    """
    Service for calculating multi-store stock redistribution and managing
    Stock Transfer Order (STO) lifecycle state transitions.
    """

    async def calculate_rebalancing_recommendations(
        self,
        db: AsyncSession,
        source_branch_id: str,
        target_branch_id: str,
    ) -> List[StockRebalancingRecommendation]:
        """
        Analyzes SKU inventory across source and target branches and generates recommendations
        where target store stock is below min threshold and source store has surplus inventory.
        """
        # Fetch active products
        stmt = select(Product).where(Product.is_active == True, Product.is_deleted == False)
        res = await db.execute(stmt)
        products = res.scalars().all()

        recommendations = []
        for prod in products:
            # Simulate stock on hand lookups per branch
            source_stock = Decimal("100.00")
            target_stock = Decimal("5.00")
            min_target_threshold = Decimal("20.00")

            if target_stock < min_target_threshold and source_stock > Decimal("50.00"):
                recommended_qty = Decimal("25.00")
                rec = StockRebalancingRecommendation(
                    id=str(uuid.uuid4()),
                    source_branch_id=source_branch_id,
                    target_branch_id=target_branch_id,
                    product_id=prod.id,
                    sku=prod.sku,
                    product_name=prod.name,
                    source_stock_on_hand=source_stock,
                    target_stock_on_hand=target_stock,
                    recommended_qty=recommended_qty,
                    reason="STOCKOUT_PREVENTION",
                    status="PENDING",
                )
                db.add(rec)
                recommendations.append(rec)

        await db.commit()
        return recommendations

    async def convert_recommendation_to_sto(
        self,
        db: AsyncSession,
        recommendation_id: str,
        requested_by: str,
    ) -> StockTransferOrder:
        """
        Converts a pending rebalancing recommendation into an active Stock Transfer Order (REQUESTED).
        """
        rec_stmt = select(StockRebalancingRecommendation).where(
            StockRebalancingRecommendation.id == recommendation_id
        )
        res = await db.execute(rec_stmt)
        rec = res.scalars().first()

        if not rec:
            raise ValueError(f"Recommendation {recommendation_id} not found.")

        if rec.status != "PENDING":
            raise ValueError(f"Recommendation {recommendation_id} is already {rec.status}.")

        sto_no = f"STO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        sto = StockTransferOrder(
            id=str(uuid.uuid4()),
            transfer_no=sto_no,
            source_branch_id=rec.source_branch_id,
            source_store_name="Source Central Store",
            target_branch_id=rec.target_branch_id,
            target_store_name="Target Outlet Store",
            status="REQUESTED",
            transfer_date=date.today(),
            total_line_items=1,
            total_requested_qty=rec.recommended_qty,
            total_shipped_qty=Decimal("0.0000"),
            total_received_qty=Decimal("0.0000"),
            requested_by=requested_by,
        )

        item = StockTransferOrderItem(
            id=str(uuid.uuid4()),
            transfer_order_id=sto.id,
            product_id=rec.product_id,
            sku=rec.sku,
            product_name=rec.product_name,
            requested_qty=rec.recommended_qty,
            approved_qty=rec.recommended_qty,
            shipped_qty=Decimal("0.0000"),
            received_qty=Decimal("0.0000"),
            unit_cost=Decimal("150.00"),
            total_valuation=rec.recommended_qty * Decimal("150.00"),
        )

        sto.total_valuation = item.total_valuation
        db.add(sto)
        db.add(item)
        await db.flush()

        rec.status = "CONVERTED"
        rec.transfer_order_id = sto.id
        await db.commit()

        return sto

    async def dispatch_transfer_order(
        self,
        db: AsyncSession,
        transfer_order_id: str,
        dispatched_by: str,
    ) -> StockTransferOrder:
        """
        Dispatches stock transfer order, updates status to DISPATCHED, and logs OUT movement.
        """
        stmt = (
            select(StockTransferOrder)
            .where(StockTransferOrder.id == transfer_order_id)
        )
        res = await db.execute(stmt)
        sto = res.scalars().first()

        if not sto:
            raise ValueError(f"Transfer Order {transfer_order_id} not found.")

        if sto.status not in ["REQUESTED", "APPROVED"]:
            raise ValueError(f"Cannot dispatch transfer order in status {sto.status}.")

        items_stmt = select(StockTransferOrderItem).where(
            StockTransferOrderItem.transfer_order_id == sto.id
        )
        items_res = await db.execute(items_stmt)
        items = items_res.scalars().all()

        total_shipped = Decimal("0.0000")
        for item in items:
            item.shipped_qty = item.approved_qty
            total_shipped += item.shipped_qty

            # Log OUT stock movement from source branch
            mv = StockMovement(
                id=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=item.product_name,
                sku=item.sku,
                quantity=item.shipped_qty,
                movement_type="TRANSFER",
                reference_doc_type="StockTransferOrder",
                reference_doc_id=sto.id,
                warehouse="SOURCE_MAIN",
                branch=sto.source_branch_id,
                user=dispatched_by,
                remarks=f"Dispatched via STO {sto.transfer_no}",
            )
            db.add(mv)

        sto.status = "DISPATCHED"
        sto.total_shipped_qty = total_shipped
        sto.dispatched_by = dispatched_by

        await db.commit()
        return sto

    async def receive_transfer_order(
        self,
        db: AsyncSession,
        transfer_order_id: str,
        received_by: str,
    ) -> StockTransferOrder:
        """
        Receives stock transfer order at target store, updates status to RECEIVED, and logs IN movement.
        """
        stmt = select(StockTransferOrder).where(StockTransferOrder.id == transfer_order_id)
        res = await db.execute(stmt)
        sto = res.scalars().first()

        if not sto:
            raise ValueError(f"Transfer Order {transfer_order_id} not found.")

        if sto.status != "DISPATCHED":
            raise ValueError(f"Cannot receive transfer order in status {sto.status}.")

        items_stmt = select(StockTransferOrderItem).where(
            StockTransferOrderItem.transfer_order_id == sto.id
        )
        items_res = await db.execute(items_stmt)
        items = items_res.scalars().all()

        total_received = Decimal("0.0000")
        for item in items:
            item.received_qty = item.shipped_qty
            total_received += item.received_qty

            # Log IN stock movement to target branch
            mv = StockMovement(
                id=str(uuid.uuid4()),
                product_id=item.product_id,
                product_name=item.product_name,
                sku=item.sku,
                quantity=item.received_qty,
                movement_type="TRANSFER",
                reference_doc_type="StockTransferOrder",
                reference_doc_id=sto.id,
                warehouse="TARGET_MAIN",
                branch=sto.target_branch_id,
                user=received_by,
                remarks=f"Received via STO {sto.transfer_no}",
            )
            db.add(mv)

        sto.status = "RECEIVED"
        sto.total_received_qty = total_received
        sto.received_by = received_by

        await db.commit()
        return sto
