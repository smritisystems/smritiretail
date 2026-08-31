"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.governed_logic import PolicyDefinition


DEFAULT_SALES_RETURN_POLICY: Dict[str, Any] = {}

# Precedence hierarchy: higher number = higher priority / more specific
SCOPE_PRECEDENCE = {
    "GLOBAL": 10,
    "TENANT": 20,
    "BRANCH": 30,
    "DOCUMENT_TYPE": 40,
    "PRODUCT_CATEGORY": 50,
    "CUSTOMER_GROUP": 60,
    "TRANSACTION_CONTEXT": 70,
}


@dataclass(frozen=True)
class ResolvedSalesReturnPolicy:
    policy_id: Optional[str]
    policy_version: Optional[int]
    resolution_scope: str
    resolution_source: str
    values: Dict[str, Any]
    effective_policy: Dict[str, Any]
    effective_dates: Dict[str, Optional[str]]
    resolved_at: str


class SalesReturnPolicyResolver:
    """
    Authoritative SMRITI Sales Return Policy Resolution Engine.
    Evaluates versioned control-plane policies with deterministic precedence:
    GLOBAL -> TENANT -> BRANCH -> DOCUMENT_TYPE -> PRODUCT_CATEGORY -> CUSTOMER_GROUP -> TRANSACTION_CONTEXT
    """

    POLICY_CODES = (
        "POLICY_BILLING_CONTROLS",
        "POLICY_GST_STANDARD",
        "POLICY_RETURN_STANDARD",
    )

    def __init__(self, control_db: Optional[AsyncSession] = None, company_db: Optional[AsyncSession] = None):
        self.control_db = control_db
        self.company_db = company_db

    async def resolve(
        self,
        tenant: Optional[str] = None,
        branch: Optional[str] = None,
        document_type: Optional[str] = None,
        product_context: Optional[Dict[str, Any]] = None,
        customer_context: Optional[Dict[str, Any]] = None,
        transaction_context: Optional[Dict[str, Any]] = None,
    ) -> ResolvedSalesReturnPolicy:
        effective: Dict[str, Any] = {}
        sources: List[str] = []
        highest_scope = "GLOBAL"
        highest_scope_rank = SCOPE_PRECEDENCE["GLOBAL"]
        policy_id: Optional[str] = None
        policy_version: Optional[int] = None
        effective_start: Optional[str] = None
        effective_end: Optional[str] = None

        db_session = self.control_db or self.company_db
        if db_session is None:
            raise ValueError("SALES_RETURN_POLICY_NOT_CONFIGURED: no database session is available to resolve the effective sales return policy.")

        stmt = (
            select(PolicyDefinition)
            .where(
                PolicyDefinition.is_active == True,
                PolicyDefinition.is_deleted == False,
                (
                    PolicyDefinition.code.in_(["POLICY_RETURN_STANDARD", "SALES_RETURN_POLICY"])
                    | (PolicyDefinition.policy_type == "RETURN_POLICY")
                ),
            )
            .order_by(PolicyDefinition.version.desc(), PolicyDefinition.code)
        )
        result = await db_session.execute(stmt)
        policies = result.scalars().all()

        if not policies:
            raise ValueError("SALES_RETURN_POLICY_NOT_CONFIGURED: no active sales return policy exists in the database.")

        # Match policies to the current execution context, then resolve the most specific applicable scope.
        scoped_policies: List[tuple[str, int, PolicyDefinition]] = []
        for pol in policies:
            params = pol.parameters or {}
            pol_scope = str(params.get("scope", "GLOBAL")).upper()
            matched_scope: Optional[str] = None

            if pol_scope == "TRANSACTION_CONTEXT" or "transaction_type" in params:
                if transaction_context and params.get("transaction_type") == transaction_context.get("transaction_type"):
                    matched_scope = "TRANSACTION_CONTEXT"
            elif pol_scope == "CUSTOMER_GROUP" or "customer_group" in params:
                if customer_context and params.get("customer_group") == customer_context.get("customer_group"):
                    matched_scope = "CUSTOMER_GROUP"
            elif pol_scope == "PRODUCT_CATEGORY" or "product_category" in params:
                if product_context and params.get("product_category") == product_context.get("category"):
                    matched_scope = "PRODUCT_CATEGORY"
            elif pol_scope == "DOCUMENT_TYPE" or "document_type" in params:
                if document_type and params.get("document_type") == document_type:
                    matched_scope = "DOCUMENT_TYPE"
            elif pol_scope == "BRANCH" or "branch_id" in params:
                if branch and (params.get("branch_id") == branch or params.get("branch") == branch):
                    matched_scope = "BRANCH"
            elif pol_scope == "TENANT" or "tenant_id" in params or "company_id" in params:
                if tenant and (params.get("tenant_id") == tenant or params.get("company_id") == tenant):
                    matched_scope = "TENANT"
            elif pol_scope in ("GLOBAL", "DEFAULT", ""):
                matched_scope = "GLOBAL"

            if matched_scope is not None:
                scoped_policies.append((matched_scope, SCOPE_PRECEDENCE.get(matched_scope, 0), pol))

        if not scoped_policies:
            raise ValueError("SALES_RETURN_POLICY_NOT_CONFIGURED: no database policy matches the current sales return scope.")

        # Apply broader defaults first and let more specific scopes override them later.
        scoped_policies.sort(key=lambda x: (x[1], x[2].version or 1))

        for scope_name, scope_rank, pol in scoped_policies:
            params = pol.parameters or {}
            for k, v in params.items():
                if k not in ("scope", "tenant_id", "company_id", "branch_id", "document_type", "product_category", "customer_group", "transaction_type"):
                    effective[k] = v

            sources.append(pol.code)
            if scope_rank >= highest_scope_rank:
                highest_scope_rank = scope_rank
                highest_scope = scope_name
                policy_id = pol.id
                policy_version = pol.version
                effective_start = params.get("effective_from")
                effective_end = params.get("effective_to")

        if not effective:
            raise ValueError("SALES_RETURN_POLICY_NOT_CONFIGURED: active policy rows exist but no effective sales return values were resolved.")

        now_iso = datetime.now(timezone.utc).isoformat()
        return ResolvedSalesReturnPolicy(
            policy_id=policy_id,
            policy_version=policy_version,
            resolution_scope=highest_scope,
            resolution_source=",".join(dict.fromkeys(sources)),
            values=effective,
            effective_policy=effective,
            effective_dates={"effective_from": effective_start, "effective_to": effective_end},
            resolved_at=now_iso,
        )


async def resolve_sales_return_policy(
    tenant: Optional[str] = None,
    branch: Optional[str] = None,
    document_type: Optional[str] = None,
    product_context: Optional[Dict[str, Any]] = None,
    customer_context: Optional[Dict[str, Any]] = None,
    transaction_context: Optional[Dict[str, Any]] = None,
    control_db: Optional[AsyncSession] = None,
    company_db: Optional[AsyncSession] = None,
) -> ResolvedSalesReturnPolicy:
    """Standalone functional resolver for sales return policy precedence."""
    resolver = SalesReturnPolicyResolver(control_db=control_db, company_db=company_db)
    return await resolver.resolve(
        tenant=tenant,
        branch=branch,
        document_type=document_type,
        product_context=product_context,
        customer_context=customer_context,
        transaction_context=transaction_context,
    )
