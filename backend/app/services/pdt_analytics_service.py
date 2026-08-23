"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import Product, StockMovement


def _quantize_decimal(val: float | Decimal) -> Decimal:
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class PdtAnalyticsService:
    """
    SMRITI Predictive Distribution Twin (PDT) Core Engine.
    Deterministic, postgres-backed inventory velocity, replenishment simulation,
    and days-of-cover projections derived authoritatively from StockMovement ledgers.
    """

    @classmethod
    async def calculate_sku_velocity_and_cover(
        cls,
        session: AsyncSession,
        company_id: str,
        sku: str,
        lookback_days: int = 30,
        lead_time_days: int = 7,
        safety_stock: Decimal = Decimal("10.00")
    ) -> Dict[str, Any]:
        """
        Calculates average daily sales velocity and days-of-stock-cover for a SKU.
        """
        clean_sku = sku.strip()
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        # 1. Total Units Sold in Lookback Window
        sold_stmt = select(func.coalesce(func.sum(func.abs(StockMovement.quantity)), 0)).where(
            StockMovement.company_id == company_id,
            StockMovement.sku == clean_sku,
            StockMovement.movement_type.in_(["OUTWARD_SALE", "POS_SALE"]),
            StockMovement.created_at >= cutoff_date,
            StockMovement.is_deleted == False
        )
        total_units_sold = (await session.execute(sold_stmt)).scalar() or Decimal("0.00")
        total_units_sold = Decimal(str(total_units_sold))

        # 2. Daily Sales Velocity
        days_dec = Decimal(str(max(lookback_days, 1)))
        avg_daily_velocity = _quantize_decimal(total_units_sold / days_dec)

        # 3. Current Stock On Hand (from Product Master or Stock Movements)
        prod_stmt = select(Product).where(
            Product.company_id == company_id,
            Product.sku == clean_sku,
            Product.is_deleted == False
        )
        product = (await session.execute(prod_stmt)).scalar_one_or_none()
        current_stock = Decimal(str(product.stock if product else 0))

        # 4. Projected Days of Cover
        if avg_daily_velocity > Decimal("0.00"):
            days_of_cover = _quantize_decimal(current_stock / avg_daily_velocity)
        else:
            days_of_cover = Decimal("999.99") if current_stock > 0 else Decimal("0.00")

        # 5. Suggested Reorder Point & Reorder Quantity
        lead_time_dec = Decimal(str(lead_time_days))
        reorder_point = _quantize_decimal((avg_daily_velocity * lead_time_dec) + safety_stock)
        is_reorder_recommended = current_stock <= reorder_point

        suggested_reorder_qty = Decimal("0.00")
        if is_reorder_recommended:
            # Order up to 30 days of cover + safety stock
            suggested_reorder_qty = _quantize_decimal(
                max(Decimal("0.00"), (avg_daily_velocity * Decimal("30.00") + safety_stock) - current_stock)
            )

        return {
            "sku": clean_sku,
            "company_id": company_id,
            "lookback_days": lookback_days,
            "total_units_sold": float(total_units_sold),
            "avg_daily_velocity": float(avg_daily_velocity),
            "current_stock_on_hand": float(current_stock),
            "days_of_cover": float(days_of_cover),
            "reorder_point": float(reorder_point),
            "is_reorder_recommended": is_reorder_recommended,
            "suggested_reorder_quantity": float(suggested_reorder_qty)
        }
