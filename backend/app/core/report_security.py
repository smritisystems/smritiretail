"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Server-Side RBAC & Data Masking Engine.
Enforces Invariant 4: No authorization or masking is trusted to the frontend.
Enforces Invariant 9: All report consumers (Grid, BI, XLSX, CSV, PDF, Print) receive identical security masking.
"""

from typing import Dict, Any, List, Set, Optional, Union
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Reporting Permission Capabilities
# ---------------------------------------------------------------------------

PERM_VIEW_REVENUE = "PERM_VIEW_REVENUE"
PERM_VIEW_TAX = "PERM_VIEW_TAX"
PERM_VIEW_COST_AND_MARGIN = "PERM_VIEW_COST_AND_MARGIN"
PERM_VIEW_CROSS_BRANCH = "PERM_VIEW_CROSS_BRANCH"
PERM_VIEW_AUDIT_LOGS = "PERM_VIEW_AUDIT_LOGS"


ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "CASHIER": {
        PERM_VIEW_REVENUE,
    },
    "SALESPERSON": {
        PERM_VIEW_REVENUE,
    },
    "STORE_SUPERVISOR": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
    },
    "STORE_MANAGER": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
    },
    "MANAGER": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
    },
    "REPORT_USER": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
    },
    "VIEWER": {
        PERM_VIEW_REVENUE,
    },
    "WAREHOUSE_LEAD": {
        PERM_VIEW_REVENUE,
    },
    "MERCHANDISER": {
        PERM_VIEW_REVENUE,
    },
    "ACCOUNTANT": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
        PERM_VIEW_CROSS_BRANCH,
        PERM_VIEW_AUDIT_LOGS,
    },
    "ADMIN": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
        PERM_VIEW_CROSS_BRANCH,
        PERM_VIEW_AUDIT_LOGS,
    },
    "SYSADMIN": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
        PERM_VIEW_CROSS_BRANCH,
        PERM_VIEW_AUDIT_LOGS,
    },
    "CEO": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
        PERM_VIEW_CROSS_BRANCH,
        PERM_VIEW_AUDIT_LOGS,
    },
    "SUPERADMIN": {
        PERM_VIEW_REVENUE,
        PERM_VIEW_TAX,
        PERM_VIEW_COST_AND_MARGIN,
        PERM_VIEW_CROSS_BRANCH,
        PERM_VIEW_AUDIT_LOGS,
    },
}

# Fields strictly classified as commercial confidential (Cost / Gross Margin)
FINANCIAL_SENSITIVE_FIELDS: Set[str] = {
    "cogs",
    "cost_price",
    "unit_cost",
    "landed_cost",
    "unit_landed_cost",
    "purchase_rate",
    "gross_margin_amt",
    "gross_margin_pct",
    "margin_percent",
    "margin_pct",
    "gross_profit",
    "net_contribution",
    "gmroi",
    "stock_valuation_amt",
    "valuation_amount",
    "profit_amount",
}

SENSITIVE_FINANCIAL_FIELDS = FINANCIAL_SENSITIVE_FIELDS


class ReportSecurityEngine:
    """Server-side field masking and authorization validator."""

    @classmethod
    def get_role_permissions(cls, role: str) -> Set[str]:
        return ROLE_PERMISSIONS.get(role.upper(), set())

    @classmethod
    def has_permission(cls, role: str, permission: str) -> bool:
        perms = cls.get_role_permissions(role)
        return permission in perms

    @classmethod
    def can_view_cost_and_margin(cls, role: str) -> bool:
        return cls.has_permission(role, PERM_VIEW_COST_AND_MARGIN)

    @classmethod
    def mask_record(
        cls,
        record: Dict[str, Any],
        user_role: str,
        mask_value: Any = None
    ) -> Dict[str, Any]:
        """
        Sanitizes a single report dictionary row.
        If user_role lacks PERM_VIEW_COST_AND_MARGIN, sensitive fields are masked.
        """
        if cls.can_view_cost_and_margin(user_role):
            return record

        masked = {}
        for key, val in record.items():
            key_lower = key.lower()
            if key_lower in FINANCIAL_SENSITIVE_FIELDS:
                masked[key] = mask_value
            elif isinstance(val, dict):
                masked[key] = cls.mask_record(val, user_role, mask_value)
            elif isinstance(val, list):
                masked[key] = [
                    cls.mask_record(item, user_role, mask_value) if isinstance(item, dict) else item
                    for item in val
                ]
            else:
                masked[key] = val
        return masked

    @classmethod
    def mask_dataset(
        cls,
        dataset: List[Dict[str, Any]],
        user_role: str,
        mask_value: Any = None
    ) -> List[Dict[str, Any]]:
        """
        Sanitizes an entire list of tabular records at the server boundary
        before JSON serialization or file export generation.
        """
        if cls.can_view_cost_and_margin(user_role):
            return dataset

        return [cls.mask_record(row, user_role, mask_value) for row in dataset]
