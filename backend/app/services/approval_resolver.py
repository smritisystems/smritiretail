"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.34.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import ast
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..models.approval import (
    SMRITIApprovalPolicy,
    SMRITIApprovalMatrix,
    SMRITIApprovalStep,
    SMRITIApprovalCondition,
    SMRITIApprovalAssignment,
    SMRITIApprovalDelegation,
)

logger = logging.getLogger("smriti.approval_resolver")


class ASTSafeEvaluator(ast.NodeVisitor):
    """
    AST-based safe DSL expression evaluator.
    Evaluates expressions like 'Amount > 50000 AND Margin < 0.08 AND Category == "IMPORTED"'
    without using unsafe eval().
    """

    def __init__(self, context: Dict[str, Any]):
        self.context = context

    def eval(self, expr_str: str) -> bool:
        try:
            # Replace case-insensitive AND/OR with python lower-case and/or
            expr_normalized = expr_str.replace(" AND ", " and ").replace(" OR ", " or ")
            node = ast.parse(expr_normalized, mode='eval')
            return bool(self.visit(node.body))
        except Exception as e:
            logger.error(f"ASTSafeEvaluator error parsing expression '{expr_str}': {e}")
            return False

    def visit_BoolOp(self, node: ast.BoolOp) -> bool:
        if isinstance(node.op, ast.And):
            return all(self.visit(val) for val in node.values)
        elif isinstance(node.op, ast.Or):
            return any(self.visit(val) for val in node.values)
        return False

    def visit_Compare(self, node: ast.Compare) -> bool:
        left_val = self.visit(node.left)
        for op, comparator in zip(node.ops, node.comparators):
            right_val = self.visit(comparator)
            if isinstance(op, ast.Gt) and not (left_val > right_val):
                return False
            elif isinstance(op, ast.GtE) and not (left_val >= right_val):
                return False
            elif isinstance(op, ast.Lt) and not (left_val < right_val):
                return False
            elif isinstance(op, ast.LtE) and not (left_val <= right_val):
                return False
            elif isinstance(op, ast.Eq) and not (left_val == right_val):
                return False
            elif isinstance(op, ast.NotEq) and not (left_val != right_val):
                return False
        return True

    def visit_Name(self, node: ast.Name) -> Any:
        return self.context.get(node.id)

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        obj = self.visit(node.value)
        if isinstance(obj, dict):
            return obj.get(node.attr)
        return getattr(obj, node.attr, None)

    def visit_Constant(self, node: ast.Constant) -> Any:
        return node.value

    def visit_Num(self, node: ast.Num) -> Any:  # Py <3.8 fallback compatibility
        return node.n

    def visit_Str(self, node: ast.Str) -> Any:
        return node.s


class ApprovalResolver:
    """
    Approval Resolver Layer decoupling repository queries from FSM execution.
    Features in-memory policy caching and AST condition evaluation.
    """

    _policy_cache: Dict[str, Any] = {}

    @classmethod
    def clear_cache(cls):
        cls._policy_cache.clear()

    async def get_active_policy(
        self,
        db: AsyncSession,
        document_type: str,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> Optional[SMRITIApprovalPolicy]:
        """Fetch active policy with effective date validation (valid_from <= now <= valid_to)."""
        now = datetime.now(timezone.utc)
        cache_key = f"{document_type}:{company_id}:{branch_id}"
        
        if cache_key in self._policy_cache:
            return self._policy_cache[cache_key]

        from sqlalchemy.orm import selectinload
        stmt = select(SMRITIApprovalPolicy).options(
            selectinload(SMRITIApprovalPolicy.matrices)
            .selectinload(SMRITIApprovalMatrix.steps)
            .selectinload(SMRITIApprovalStep.conditions)
        ).where(
            SMRITIApprovalPolicy.document_type == document_type,
            SMRITIApprovalPolicy.is_active == True,
            SMRITIApprovalPolicy.is_deleted == False,
        ).order_by(SMRITIApprovalPolicy.priority.asc())

        res = await db.execute(stmt)
        policies = res.scalars().unique().all()

        for policy in policies:
            if policy.valid_from and policy.valid_from > now:
                continue
            if policy.valid_to and policy.valid_to < now:
                continue
            if policy.scope_type == "COMPANY" and policy.scope_id != company_id:
                continue
            if policy.scope_type == "BRANCH" and policy.scope_id != branch_id:
                continue

            self._policy_cache[cache_key] = policy
            return policy

        return None

    async def resolve_active_delegation(
        self,
        db: AsyncSession,
        user_id: str,
    ) -> Optional[str]:
        """Resolve active date-bound delegate user for delegator_id."""
        now = datetime.now(timezone.utc)
        stmt = select(SMRITIApprovalDelegation).where(
            SMRITIApprovalDelegation.delegator_id == user_id,
            SMRITIApprovalDelegation.is_active == True,
            SMRITIApprovalDelegation.start_date <= now,
            SMRITIApprovalDelegation.end_date >= now,
        )
        res = await db.execute(stmt)
        delegation = res.scalars().first()
        return delegation.delegate_id if delegation else None

    def evaluate_condition(self, expression_dsl: str, context: Dict[str, Any]) -> bool:
        """Evaluate a step condition DSL using ASTSafeEvaluator."""
        evaluator = ASTSafeEvaluator(context)
        return evaluator.eval(expression_dsl)
