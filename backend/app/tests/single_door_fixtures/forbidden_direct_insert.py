"""
Fixture demonstrating FORBIDDEN direct instantiation of StockMovement.
Must be caught and rejected by ci_stock_single_door_guard.py.
"""
from decimal import Decimal
from app.models.inventory import StockMovement


def direct_movement_violator(session):
    movement = StockMovement(
        company_id="comp-1",
        product_id="prod-1",
        quantity=Decimal("10.00"),
        movement_type="INWARD_GRN",
    )
    session.add(movement)
