"""
Fixture demonstrating FORBIDDEN direct assignment to product.stock.
Must be caught and rejected by ci_stock_single_door_guard.py.
"""

def direct_stock_assign_violator(product):
    product.stock = 42
