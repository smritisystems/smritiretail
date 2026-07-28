"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.1.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Accounting Core Layer - Multi-Company Financial Consolidation & Inter-Company Elimination Engine
Conforms to Ind AS 110 / AS-21 (Consolidated Financial Statements).

Consolidates Financial Statements across Parent Company and Subsidiary Entities:
1. Combines Trial Balance GL account balances line-by-line.
2. Identifies & cancels Inter-Company balances (Inter-company AR vs AP, Inter-company Sales vs Purchases).
3. Produces Consolidated Trial Balance & Consolidated Profit & Loss.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class CompanyTrialBalance:
    company_id: str
    company_name: str
    gl_account_balances: Dict[str, float]  # account_code -> balance (Debit +, Credit -)


@dataclass
class InterCompanyEliminationEntry:
    from_company_id: str
    to_company_id: str
    account_code: str
    elimination_amount: float
    description: str


@dataclass
class ConsolidatedFinancialStatement:
    parent_company_id: str
    group_name: str
    raw_combined_balances: Dict[str, float]
    elimination_entries: List[InterCompanyEliminationEntry]
    consolidated_balances: Dict[str, float]
    total_intercompany_eliminated: float


class FinancialConsolidationEngine:
    """
    Canonical Financial Consolidation & Elimination Engine.
    """

    @staticmethod
    def consolidate(
        parent: CompanyTrialBalance,
        subsidiaries: List[CompanyTrialBalance],
        intercompany_eliminations: List[InterCompanyEliminationEntry],
        group_name: str = "SMRITI Retail Group",
    ) -> ConsolidatedFinancialStatement:

        # 1. Combine GL balances line-by-line
        combined: Dict[str, float] = {}

        def add_balances(tb: CompanyTrialBalance):
            for code, bal in tb.gl_account_balances.items():
                combined[code] = round(combined.get(code, 0.0) + bal, 2)

        add_balances(parent)
        for sub in subsidiaries:
            add_balances(sub)

        # 2. Process Inter-Company Eliminations
        consolidated = dict(combined)
        total_eliminated = 0.0

        for elim in intercompany_eliminations:
            code = elim.account_code
            amount = elim.elimination_amount

            # If debit balance account (e.g. Intercompany AR / Purchase), reduce balance
            if code in consolidated:
                current = consolidated[code]
                if current >= 0:
                    consolidated[code] = round(current - amount, 2)
                else:
                    # Credit balance account (e.g. Intercompany AP / Sales), add amount back towards zero
                    consolidated[code] = round(current + amount, 2)

            total_eliminated += amount

        return ConsolidatedFinancialStatement(
            parent_company_id=parent.company_id,
            group_name=group_name,
            raw_combined_balances=combined,
            elimination_entries=intercompany_eliminations,
            consolidated_balances=consolidated,
            total_intercompany_eliminated=round(total_eliminated, 2),
        )
