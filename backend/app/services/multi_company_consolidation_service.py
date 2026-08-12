"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-08-12
Classification: Multi-Company Reporting Consolidation & Fan-Out Service
"""

import asyncio
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.company_session import CompanyDatabasePoolManager
from app.services.control_database_registry import ControlDatabaseRegistryService
from app.core.financial_consolidation import FinancialConsolidationEngine, CompanyTrialBalance
from app.models.accounting import JournalLedgerEntryModel
from app.models.sales import SalesInvoice
from app.models.inventory import Product
from app.models.crm import Customer


from app.models.control import ControlUserCompanyAssignment


class MultiCompanyConsolidationService:
    """
    MultiCompanyConsolidationService — Multi-Tenant Read-Only Reporting Fan-Out Engine.

    Queries multiple physically isolated company databases concurrently via async fan-out (`asyncio.gather`),
    injecting company_code provenance while preserving strict database boundary isolation.
    """

    @classmethod
    async def _resolve_and_verify_companies(
        cls,
        control_db: AsyncSession,
        user_id: str,
        company_codes: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Validates user authorization for all requested company_codes.
        If company_codes is None or empty, returns all assigned company_codes for user.
        """
        stmt = select(ControlUserCompanyAssignment).where(ControlUserCompanyAssignment.user_id == user_id)
        res = await control_db.execute(stmt)
        assigned_ucas = res.scalars().all()
        assigned_codes = {uca.company_code.upper() for uca in assigned_ucas}

        if not assigned_codes:
            raise HTTPException(status_code=403, detail="User has no assigned company database access.")

        if company_codes:
            clean_targets = [c.strip().upper() for c in company_codes]
            for target in clean_targets:
                if target not in assigned_codes:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Access denied: User is not authorized for target company '{target}'."
                    )
            return clean_targets

        return sorted(list(assigned_codes))

    @classmethod
    async def consolidate_financial_trial_balance(
        cls,
        control_db: AsyncSession,
        user_id: str,
        company_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Fetches GL trial balance balances from each company DB concurrently and executes
        FinancialConsolidationEngine inter-company elimination.
        """
        verified_codes = await cls._resolve_and_verify_companies(control_db, user_id, company_codes)

        async def _fetch_company_tb(code: str) -> CompanyTrialBalance:
            session = await CompanyDatabasePoolManager.get_company_session_by_code(company_code=code, user_id=user_id, control_db=control_db)
            try:
                stmt = select(
                    JournalLedgerEntryModel.account_code,
                    func.sum(JournalLedgerEntryModel.debit - JournalLedgerEntryModel.credit).label("net_balance")
                ).group_by(JournalLedgerEntryModel.account_code)
                res = await session.execute(stmt)
                balances = {row.account_code: float(row.net_balance or 0.0) for row in res.all()}
                return CompanyTrialBalance(
                    company_id=f"comp-{code.lower()}",
                    company_name=f"Company {code}",
                    gl_account_balances=balances,
                )
            finally:
                await session.close()

        company_tbs = await asyncio.gather(*[_fetch_company_tb(code) for code in verified_codes])

        parent_tb = company_tbs[0]
        subsidiary_tbs = list(company_tbs[1:])

        consolidated = FinancialConsolidationEngine.consolidate(
            parent=parent_tb,
            subsidiaries=subsidiary_tbs,
            intercompany_eliminations=[],
            group_name="SMRITI Group Enterprise",
        )

        return {
            "group_name": consolidated.group_name,
            "participating_company_codes": verified_codes,
            "raw_combined_balances": consolidated.raw_combined_balances,
            "consolidated_balances": consolidated.consolidated_balances,
            "total_intercompany_eliminated": consolidated.total_intercompany_eliminated,
        }

    @classmethod
    async def consolidate_sales_summary(
        cls,
        control_db: AsyncSession,
        user_id: str,
        company_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Concurrently aggregates sales invoice totals across physical company DBs.
        """
        verified_codes = await cls._resolve_and_verify_companies(control_db, user_id, company_codes)

        async def _fetch_company_sales(code: str) -> Dict[str, Any]:
            session = await CompanyDatabasePoolManager.get_company_session_by_code(company_code=code, user_id=user_id, control_db=control_db)
            try:
                stmt = select(
                    func.count(SalesInvoice.id).label("invoice_count"),
                    func.coalesce(func.sum(SalesInvoice.subtotal), Decimal("0.00")).label("total_subtotal"),
                    func.coalesce(func.sum(SalesInvoice.tax_total), Decimal("0.00")).label("total_tax"),
                    func.coalesce(func.sum(SalesInvoice.grand_total), Decimal("0.00")).label("total_grand"),
                )
                res = await session.execute(stmt)
                row = res.one()
                return {
                    "company_code": code,
                    "invoice_count": row.invoice_count or 0,
                    "subtotal": Decimal(str(row.total_subtotal or "0.00")),
                    "tax_total": Decimal(str(row.total_tax or "0.00")),
                    "grand_total": Decimal(str(row.total_grand or "0.00")),
                }
            finally:
                await session.close()

        per_company_sales = await asyncio.gather(*[_fetch_company_sales(code) for code in verified_codes])

        group_count = sum(c["invoice_count"] for c in per_company_sales)
        group_subtotal = sum((c["subtotal"] for c in per_company_sales), Decimal("0.00"))
        group_tax = sum((c["tax_total"] for c in per_company_sales), Decimal("0.00"))
        group_grand = sum((c["grand_total"] for c in per_company_sales), Decimal("0.00"))

        return {
            "group_total_invoices": group_count,
            "group_subtotal": group_subtotal,
            "group_tax_total": group_tax,
            "group_grand_total": group_grand,
            "per_company_breakdown": list(per_company_sales),
        }

    @classmethod
    async def consolidate_inventory_summary(
        cls,
        control_db: AsyncSession,
        user_id: str,
        company_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Concurrently aggregates stock quantities and product counts across physical company DBs.
        """
        verified_codes = await cls._resolve_and_verify_companies(control_db, user_id, company_codes)

        async def _fetch_company_inventory(code: str) -> Dict[str, Any]:
            session = await CompanyDatabasePoolManager.get_company_session_by_code(company_code=code, user_id=user_id, control_db=control_db)
            try:
                stmt = select(
                    func.count(Product.id).label("product_count"),
                    func.coalesce(func.sum(Product.stock), 0).label("total_stock_units"),
                )
                res = await session.execute(stmt)
                row = res.one()
                return {
                    "company_code": code,
                    "product_count": row.product_count or 0,
                    "total_stock_units": row.total_stock_units or 0,
                }
            finally:
                await session.close()

        per_company_inv = await asyncio.gather(*[_fetch_company_inventory(code) for code in verified_codes])

        return {
            "group_total_products": sum(c["product_count"] for c in per_company_inv),
            "group_total_stock_units": sum(c["total_stock_units"] for c in per_company_inv),
            "per_company_breakdown": list(per_company_inv),
        }

    @classmethod
    async def consolidate_customer_balances(
        cls,
        control_db: AsyncSession,
        user_id: str,
        company_codes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Aggregates outstanding customer balances per customer code across physical company DBs.
        """
        verified_codes = await cls._resolve_and_verify_companies(control_db, user_id, company_codes)

        async def _fetch_company_customers(code: str) -> List[Dict[str, Any]]:
            session = await CompanyDatabasePoolManager.get_company_session_by_code(company_code=code, user_id=user_id, control_db=control_db)
            try:
                stmt = select(Customer.code, Customer.name, Customer.outstanding)
                res = await session.execute(stmt)
                return [
                    {
                        "company_code": code,
                        "customer_code": row.code,
                        "customer_name": row.name,
                        "outstanding": Decimal(str(row.outstanding or "0.00")),
                    }
                    for row in res.all()
                ]
            finally:
                await session.close()

        all_company_customers = await asyncio.gather(*[_fetch_company_customers(code) for code in verified_codes])

        customer_map: Dict[str, Dict[str, Any]] = {}
        for company_list in all_company_customers:
            for item in company_list:
                c_code = item["customer_code"]
                if c_code not in customer_map:
                    customer_map[c_code] = {
                        "customer_code": c_code,
                        "customer_name": item["customer_name"],
                        "total_outstanding": Decimal("0.00"),
                        "company_breakdown": [],
                    }
                customer_map[c_code]["total_outstanding"] += item["outstanding"]
                customer_map[c_code]["company_breakdown"].append({
                    "company_code": item["company_code"],
                    "outstanding": item["outstanding"],
                })

        return {
            "group_total_customers": len(customer_map),
            "group_total_outstanding": sum((c["total_outstanding"] for c in customer_map.values()), Decimal("0.00")),
            "customer_summaries": list(customer_map.values()),
        }
