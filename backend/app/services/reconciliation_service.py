"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.inventory import Product, StockMovement
from ..models.sales import SalesInvoice


class MultiLedgerReconciliationService:
    """
    Multi-Ledger Consistency & Reconciliation Audit Service.
    Verifies financial and inventory balance parity before switching live routers.
    """

    @classmethod
    async def audit_database_ledger_totals(
        cls,
        session: AsyncSession
    ) -> Dict[str, Any]:
        """
        Calculates aggregate inventory and sales invoice totals for parity verification.
        """
        # Product counts & stock totals
        prod_stmt = select(
            func.count(Product.id),
            func.coalesce(func.sum(Product.quantity_on_hand), 0)
        )
        prod_res = (await session.execute(prod_stmt)).one()
        product_count, total_stock = prod_res

        # Sales invoice totals
        sales_stmt = select(
            func.count(SalesInvoice.id),
            func.coalesce(func.sum(SalesInvoice.grand_total), 0)
        )
        sales_res = (await session.execute(sales_stmt)).one()
        invoice_count, total_sales_amount = sales_res

        return {
            "product_count": product_count,
            "total_stock": str(total_stock),
            "invoice_count": invoice_count,
            "total_sales_amount": str(total_sales_amount)
        }

    @classmethod
    def compare_reconciliation_audit(
        cls,
        source_totals: Dict[str, Any],
        target_totals: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compares source and target ledger audit metrics.
        Returns parity pass/fail result.
        """
        product_match = source_totals["product_count"] == target_totals["product_count"]
        stock_match = str(source_totals["total_stock"]) == str(target_totals["total_stock"])
        invoice_match = source_totals["invoice_count"] == target_totals["invoice_count"]
        sales_match = str(source_totals["total_sales_amount"]) == str(target_totals["total_sales_amount"])

        passed = product_match and stock_match and invoice_match and sales_match

        return {
            "reconciliation_passed": passed,
            "product_match": product_match,
            "stock_match": stock_match,
            "invoice_match": invoice_match,
            "sales_match": sales_match,
            "source": source_totals,
            "target": target_totals
        }
