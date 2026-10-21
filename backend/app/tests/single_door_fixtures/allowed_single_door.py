"""
Fixture demonstrating ALLOWED single-door usage routing via StockLedger and StockLedgerQuery.
Must be evaluated and passed cleanly by ci_stock_single_door_guard.py.
"""
from decimal import Decimal
from app.services.stock_ledger import StockLedger, MovementRequest
from app.services.stock_ledger_query import StockLedgerQuery


async def compliant_posting(session):
    req = MovementRequest(
        company_id="comp-1",
        product_id="prod-1",
        movement_type="INWARD_GRN",
        quantity=Decimal("10.00"),
        reference_doc_type="PURCHASE_RECEIPT",
        reference_doc_id="GRN-101",
    )
    result = await StockLedger.post(session, req)
    return result


async def compliant_query(session, company_id: str, product_id: str):
    expr = StockLedgerQuery.get_signed_movement_quantity_expr()
    return expr
