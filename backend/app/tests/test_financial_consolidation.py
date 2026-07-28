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

import pytest
from app.core.financial_consolidation import (
    FinancialConsolidationEngine,
    CompanyTrialBalance,
    InterCompanyEliminationEntry,
)

def test_financial_consolidation_and_intercompany_elimination():
    # Parent Company (HQ)
    parent_tb = CompanyTrialBalance(
        company_id="COMP-PARENT",
        company_name="SMRITI India Parent Ltd",
        gl_account_balances={
            "1001-CASH": 500000.0,
            "1100-AR-INTERCOMPANY": 100000.0,  # Receivable from Subsidiary
            "4001-SALES": -2000000.0,
        },
    )

    # Subsidiary Company
    sub_tb = CompanyTrialBalance(
        company_id="COMP-SUB-01",
        company_name="SMRITI Retail West Ltd",
        gl_account_balances={
            "1001-CASH": 200000.0,
            "2100-AP-INTERCOMPANY": -100000.0,  # Payable to Parent
            "4001-SALES": -800000.0,
        },
    )

    # Intercompany Elimination: Cancel ₹100,000 AR vs AP
    eliminations = [
        InterCompanyEliminationEntry(
            from_company_id="COMP-PARENT",
            to_company_id="COMP-SUB-01",
            account_code="1100-AR-INTERCOMPANY",
            elimination_amount=100000.0,
            description="Eliminate Intercompany Receivable",
        ),
        InterCompanyEliminationEntry(
            from_company_id="COMP-SUB-01",
            to_company_id="COMP-PARENT",
            account_code="2100-AP-INTERCOMPANY",
            elimination_amount=100000.0,
            description="Eliminate Intercompany Payable",
        ),
    ]

    stmt = FinancialConsolidationEngine.consolidate(
        parent=parent_tb,
        subsidiaries=[sub_tb],
        intercompany_eliminations=eliminations,
    )

    # Combined raw sales: 2M + 800k = 2.8M
    assert stmt.raw_combined_balances["4001-SALES"] == -2800000.0

    # Intercompany AR & AP eliminated to 0
    assert stmt.consolidated_balances["1100-AR-INTERCOMPANY"] == 0.0
    assert stmt.consolidated_balances["2100-AP-INTERCOMPANY"] == 0.0
    assert stmt.total_intercompany_eliminated == 200000.0
