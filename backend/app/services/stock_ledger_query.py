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
from datetime import date
from typing import Optional, Dict
from decimal import Decimal
from sqlalchemy import func, case, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.inventory import Product, ProductBatchStock, StockMovement, Warehouse
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


def compute_signed_movement_quantity(quantity: Decimal, movement_type: Optional[str]) -> Decimal:
    """Apply the same sign rules as the SQL expression to an in-memory movement."""
    movement_type = (movement_type or "").upper()
    if movement_type in INFLOW_MOVEMENT_TYPES:
        return abs(quantity)
    if movement_type in OUTFLOW_MOVEMENT_TYPES:
        return -abs(quantity)
    if movement_type in SIGNED_MOVEMENT_TYPES:
        return quantity
    raise ValueError(f"Unclassified stock movement type: {movement_type or 'NULL'}")


def get_unclassified_movement_count_expr(type_col=StockMovement.movement_type):
    """
    SQL expression counting movements whose movement_type is not in the canonical ALL_MOVEMENT_TYPES.
    """
    upper_type = func.upper(func.coalesce(type_col, ""))
    return case(
        (upper_type.notin_(tuple(ALL_MOVEMENT_TYPES)), 1),
        else_=0,
    )


async def get_authoritative_stock_by_product(
    session: AsyncSession,
    company_id: str,
    branch_id: Optional[str] = None,
    warehouse: Optional[str] = None,
    as_of_date: Optional[date] = None,
) -> Dict[str, Decimal]:
    """Return current stock using batch balances where present, movement ledger otherwise."""
    balances: Dict[str, Decimal] = {}
    if as_of_date is None or as_of_date >= date.today():
        batch_stmt = (
            select(
                ProductBatchStock.product_id,
                func.sum(
                    ProductBatchStock.quantity
                    - func.coalesce(ProductBatchStock.damaged_quantity, 0)
                ).label("on_hand"),
            )
            .where(
                ProductBatchStock.company_id == company_id,
                ProductBatchStock.is_deleted.is_(False),
            )
        )
        if branch_id:
            batch_stmt = batch_stmt.where(
                or_(ProductBatchStock.branch_id == branch_id, ProductBatchStock.branch_id.is_(None))
            )
        if warehouse:
            batch_stmt = batch_stmt.join(Warehouse, ProductBatchStock.warehouse_id == Warehouse.id).where(
                or_(
                    ProductBatchStock.warehouse_id == warehouse,
                    ProductBatchStock.branch_id == warehouse,
                    Warehouse.name.ilike(f"%{warehouse}%"),
                )
            )
        batch_rows = (await session.execute(batch_stmt.group_by(ProductBatchStock.product_id))).all()
        balances = {
            row.product_id: Decimal(str(row.on_hand or 0))
            for row in batch_rows
        }

    product_stmt = select(Product.id, Product.item_variant_id, Product.variant_id).where(
        Product.company_id == company_id,
        Product.is_deleted.is_(False),
    )
    if branch_id:
        product_stmt = product_stmt.where(or_(Product.branch_id == branch_id, Product.branch_id.is_(None)))
    product_rows = (await session.execute(product_stmt)).all()
    product_ids = {row.id for row in product_rows}
    variant_to_product = {
        str(variant_id): row.id
        for row in product_rows
        for variant_id in (row.item_variant_id, row.variant_id)
        if variant_id is not None
    }

    signed_quantity = get_signed_movement_quantity_expr()
    movement_filters = [
        StockMovement.company_id == company_id,
        StockMovement.is_deleted.is_(False),
    ]
    if branch_id:
        movement_filters.append(
            or_(StockMovement.branch_id == branch_id, StockMovement.branch_id.is_(None))
        )
    if warehouse:
        movement_filters.append(
            or_(
                StockMovement.warehouse_id == warehouse,
                StockMovement.location_id == warehouse,
                StockMovement.branch_id == warehouse,
                StockMovement.warehouse.ilike(f"%{warehouse}%"),
            )
        )
    if as_of_date is not None and as_of_date < date.today():
        movement_business_date = func.date(func.timezone("Asia/Kolkata", StockMovement.created_at))
        movement_filters.append(movement_business_date <= as_of_date)
    unknown_type_expr = func.upper(func.coalesce(StockMovement.movement_type, ""))
    unknown_count = int(
        (
            await session.execute(
                select(func.count(StockMovement.id)).where(
                    *movement_filters,
                    unknown_type_expr.notin_(tuple(ALL_MOVEMENT_TYPES)),
                )
            )
        ).scalar()
        or 0
    )
    if unknown_count:
        message = (
            f"Cannot calculate stock balances: {unknown_count} movements for company "
            f"'{company_id}' have unclassified movement types."
        )
        logger.error(message)
        raise ValueError(message)

    movement_stmt = select(
        StockMovement.product_id,
        StockMovement.variant_id,
        func.sum(signed_quantity).label("on_hand"),
    ).where(*movement_filters)
    movement_rows = (
        await session.execute(
            movement_stmt.group_by(StockMovement.product_id, StockMovement.variant_id)
        )
    ).all()
    for row in movement_rows:
        product_id = row.product_id if row.product_id in product_ids else variant_to_product.get(str(row.variant_id))
        if product_id is not None and product_id not in balances:
            balances[product_id] = balances.get(product_id, Decimal(0)) + Decimal(str(row.on_hand or 0))

    return balances


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
