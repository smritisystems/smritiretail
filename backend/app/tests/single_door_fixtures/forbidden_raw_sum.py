"""
Fixture demonstrating FORBIDDEN raw sum on StockMovement.quantity.
Must be caught and rejected by ci_stock_single_door_guard.py.
"""
from sqlalchemy import func, select
from app.models.inventory import StockMovement


def raw_sum_violator():
    stmt = select(func.sum(StockMovement.quantity))
    return stmt
