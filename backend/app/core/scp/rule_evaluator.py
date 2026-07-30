"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 11.0.0
Created      : 2026-07-30
Modified     : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Platform Standard (SCP-001)

rule_evaluator.py — SMRITI Compliance Platform (SCP v1.0 Kernel)
Temporal Versioned Rule Engine supporting effective_from and effective_to statutory date matching.
"""

from decimal import Decimal
from datetime import date
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class TaxRuleCondition(BaseModel):
    field: str
    operator: str  # EQUALS, NOT_EQUALS, IN, GREATER_THAN
    value: Any


class TaxRuleAction(BaseModel):
    component: str
    rate_expression: str
    ledger_account: str


class TemporalStatutoryRule(BaseModel):
    rule_id: str
    rule_code: str
    version: str = "v1.0.0"
    effective_from: date
    effective_to: Optional[date] = None
    jurisdiction: str = "IN_GST"
    conditions: List[TaxRuleCondition]
    actions: List[TaxRuleAction]


class TemporalRuleEvaluator:
    """
    Evaluates statutory tax breakdown strictly from temporal metadata rule definitions.
    """

    def __init__(self, rules: List[TemporalStatutoryRule]):
        self.rules = rules

    def get_effective_rules(self, rule_code: str, txn_date: date) -> List[TemporalStatutoryRule]:
        effective: List[TemporalStatutoryRule] = []
        for r in self.rules:
            if r.rule_code == rule_code:
                if r.effective_from <= txn_date and (r.effective_to is None or r.effective_to >= txn_date):
                    effective.append(r)
        return effective

    def evaluate_voucher(
        self, 
        context: Dict[str, Any], 
        item_rate: Decimal, 
        taxable_value: Decimal,
        txn_date: date
    ) -> Dict[str, Decimal]:
        tax_breakdown: Dict[str, Decimal] = {}

        for rule in self.rules:
            if rule.effective_from <= txn_date and (rule.effective_to is None or rule.effective_to >= txn_date):
                if self._matches_conditions(rule.conditions, context):
                    for action in rule.actions:
                        rate = self._eval_rate(action.rate_expression, item_rate)
                        amount = (taxable_value * (rate / Decimal("100"))).quantize(Decimal("0.01"))
                        tax_breakdown[action.component] = tax_breakdown.get(action.component, Decimal("0.00")) + amount

        return tax_breakdown

    def _matches_conditions(self, conditions: List[TaxRuleCondition], context: Dict[str, Any]) -> bool:
        for cond in conditions:
            val = self._extract_field(cond.field, context)
            if cond.operator == "EQUALS" and val != cond.value:
                return False
            elif cond.operator == "NOT_EQUALS" and val == cond.value:
                return False
            elif cond.operator == "IN" and val not in cond.value:
                return False
        return True

    def _extract_field(self, field_path: str, context: Dict[str, Any]) -> Any:
        parts = field_path.split(".")
        curr = context
        for p in parts:
            if isinstance(curr, dict):
                curr = curr.get(p)
            else:
                return None
        return curr

    def _eval_rate(self, expr: str, item_rate: Decimal) -> Decimal:
        if expr == "item.gst_rate / 2":
            return item_rate / Decimal("2")
        elif expr == "item.gst_rate":
            return item_rate
        try:
            return Decimal(expr)
        except Exception:
            return Decimal("0.00")
