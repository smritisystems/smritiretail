"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.2.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import Any, Dict, List, Set, Tuple
from .schemas import ConditionalRuleConfig, ValidationMode


class RuleEvaluator:
    """
    Evaluates conditional cross-field rules by priority.
    Higher priority rules (e.g., priority=200) override lower priority rules (e.g., priority=100).
    """

    @staticmethod
    def _match_condition(actual_val: Any, expected_val: Any) -> bool:
        if actual_val is None:
            return False
        if isinstance(expected_val, str) and isinstance(actual_val, str):
            return actual_val.strip().lower() == expected_val.strip().lower()
        if isinstance(expected_val, list):
            return any(RuleEvaluator._match_condition(actual_val, item) for item in expected_val)
        return actual_val == expected_val

    @classmethod
    def evaluate_conditional_rules(
        cls,
        rules: List[ConditionalRuleConfig],
        data: Dict[str, Any]
    ) -> Tuple[Set[str], Set[str], Dict[str, ValidationMode], List[str]]:
        """
        Returns:
            (required_fields, disabled_fields, mode_overrides, applied_rule_ids)
        """
        # Sort rules descending by priority
        sorted_rules = sorted(rules, key=lambda r: r.priority, reverse=True)

        required_fields: Set[str] = set()
        disabled_fields: Set[str] = set()
        mode_overrides: Dict[str, ValidationMode] = {}
        applied_rule_ids: List[str] = []

        for rule in sorted_rules:
            # Check if all 'when' conditions match data
            matches = True
            for condition_key, expected_val in rule.when.items():
                actual_val = data.get(condition_key)
                if not cls._match_condition(actual_val, expected_val):
                    matches = False
                    break

            if matches:
                applied_rule_ids.append(f"{rule.id} (priority={rule.priority})")

                for f in rule.require:
                    if f not in required_fields:
                        required_fields.add(f)

                for f in rule.disable:
                    if f not in disabled_fields:
                        disabled_fields.add(f)

                for f, mode in rule.set_mode.items():
                    if f not in mode_overrides:
                        mode_overrides[f] = mode

        return required_fields, disabled_fields, mode_overrides, applied_rule_ids
