"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Stock Ledger Query & Movement Expression Service
"""

import logging
from typing import Optional, Dict
from decimal import Decimal
from sqlalchemy import func, case, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import StockMovement
from .stock_movement_types import (
    INFLOW_MOVEMENT_TYPES,
    OUTFLOW_MOVEMENT_TYPES,
    SIGNED_MOVEMENT_TYPES,
    ALL_MOVEMENT_TYPES,
)

logger = logging.getLogger("smriti.stock_ledger_query")


def get_signed_movement_quantity_expr(
    quantity_col=StockMovement.quantity,
    type_col=StockMovement.movement_type,
    else_=None,
):
    """
    Returns a SQL CASE expression computing the signed quantity based on movement_type:
    - INFLOW: +abs(quantity)
    - OUTFLOW: -abs(quantity)
    - SIGNED: quantity as stored
    Matches StockSynchronizer classification logic exactly.
    Unclassified movement types evaluate to `else_` (defaults to None instead of else_=0)
    to prevent silently corrupting or masking unclassified movements.
    """
    upper_type = func.upper(func.coalesce(type_col, ""))
    return case(
        (upper_type.in_(tuple(INFLOW_MOVEMENT_TYPES)), func.abs(quantity_col)),
        (upper_type.in_(tuple(OUTFLOW_MOVEMENT_TYPES)), -func.abs(quantity_col)),
        (upper_type.in_(tuple(SIGNED_MOVEMENT_TYPES)), quantity_col),
        else_=else_,
    )


def get_unclassified_movement_count_expr(type_col=StockMovement.movement_type):
    """
    SQL expression counting movements whose movement_type is not in the canonical ALL_MOVEMENT_TYPES.
    """
    upper_type = func.upper(func.coalesce(type_col, ""))
    return case(
        (upper_type.notin_(tuple(ALL_MOVEMENT_TYPES)), 1),
        else_=0,
    )


async def audit_unclassified_movements(
    session: AsyncSession,
    company_id: str,
    store_location_id: Optional[str] = None,
) -> Dict[str, int]:
    """
    Scans for movements with unclassified movement_types for the tenant,
    logs an ERROR for each unclassified type, and surfaces their counts as a dict.
    Matches the way StockSynchronizer handles unclassified movement types.
    """
    upper_type = func.upper(func.coalesce(StockMovement.movement_type, ""))
    filters = [
        StockMovement.company_id == company_id,
        StockMovement.is_deleted.is_(False),
        upper_type.notin_(tuple(ALL_MOVEMENT_TYPES)),
    ]
    if store_location_id and store_location_id != "All Locations":
        filters.append(
            or_(
                StockMovement.warehouse_id == store_location_id,
                StockMovement.location_id == store_location_id,
                StockMovement.branch_id == store_location_id,
            )
        )
    stmt = (
        select(StockMovement.movement_type, func.count(StockMovement.id))
        .where(*filters)
        .group_by(StockMovement.movement_type)
    )
    rows = (await session.execute(stmt)).all()
    unclassified: Dict[str, int] = {}
    for mtype, count in rows:
        type_str = str(mtype or "NULL")
        unclassified[type_str] = int(count)
        logger.error(
            f"UNCLASSIFIED_MOVEMENT_TYPE: Found {count} movements with unknown movement_type "
            f"'{type_str}' for company '{company_id}'! Surfacing count to prevent silent ledger drift."
        )
    return unclassified
