"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from .governed_rule_engine import GovernedRuleEngine


class TransactionReproducibilityService:
    """
    Immutable Versioning & Historical Replay Service for Transactions (P1.5).
    Guarantees deterministic recalculation and historical immutability when newer rule versions are activated.
    """

    @classmethod
    def create_governance_snapshot(
        cls,
        formula_versions: Optional[Dict[str, int]] = None,
        rule_versions: Optional[Dict[str, int]] = None,
        policy_versions: Optional[Dict[str, int]] = None,
        workflow_versions: Optional[Dict[str, int]] = None,
        extra_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates an immutable snapshot of all rule/formula/policy versions bound to a transaction.
        """
        return {
            "snapshot_id": f"gov_snap_{uuid.uuid4().hex[:12]}",
            "snapshot_timestamp": datetime.now(timezone.utc).isoformat(),
            "formula_versions": formula_versions or {},
            "rule_versions": rule_versions or {},
            "policy_versions": policy_versions or {},
            "workflow_versions": workflow_versions or {},
            "metadata": extra_metadata or {}
        }

    @classmethod
    def replay_transaction_with_historical_rules(
        cls,
        snapshot: Dict[str, Any],
        transaction_payload: Dict[str, Any],
        historical_rule_catalog: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Historical Replay Engine:
        Executes calculation against historical definitions referenced in snapshot, NOT current active definitions.
        """
        # 1. Resolve exact rule definitions from snapshot
        rule_versions = snapshot.get("rule_versions", {})
        policy_versions = snapshot.get("policy_versions", {})
        formula_versions = snapshot.get("formula_versions", {})

        # Apply Discount / Pricing Rules from historical version
        applied_discounts = []
        total_discount = Decimal("0.00")
        line_items = transaction_payload.get("line_items", [])
        order_amount = Decimal(str(transaction_payload.get("order_amount", 0)))

        for rule_code, version in rule_versions.items():
            rule_key = f"{rule_code}_v{version}"
            rule_def = historical_rule_catalog.get("business_rules", {}).get(rule_key)
            if rule_def:
                context = {
                    "order_amount": order_amount,
                    "customer_tier": transaction_payload.get("customer_tier", "REGULAR"),
                    "channel": transaction_payload.get("channel", "POS"),
                }
                res = GovernedRuleEngine.evaluate_business_rule(
                    conditions=rule_def["conditions"],
                    actions=rule_def["actions"],
                    context=context
                )
                if res["matched"]:
                    applied_discounts.extend(res["applied_actions"])
                    total_discount += res["calculated_discount"]

        # Apply Tax Policy from historical version
        gst_policy_code = transaction_payload.get("gst_policy_code", "GST_STANDARD")
        gst_version = policy_versions.get(gst_policy_code, 1)
        gst_key = f"{gst_policy_code}_v{gst_version}"
        policy_def = historical_rule_catalog.get("policies", {}).get(gst_key, {})

        tax_res = GovernedRuleEngine.evaluate_gst_tax_policy(
            line_items=line_items,
            supplier_state_code=transaction_payload.get("supplier_state", "27"),
            recipient_state_code=transaction_payload.get("recipient_state", "27"),
            policy_parameters=policy_def.get("parameters")
        )

        return {
            "reproduced": True,
            "snapshot_id": snapshot.get("snapshot_id"),
            "rules_replayed": {
                "rule_versions": rule_versions,
                "policy_versions": policy_versions,
                "formula_versions": formula_versions
            },
            "discounts_applied": applied_discounts,
            "total_discount": total_discount,
            "tax_calculation": tax_res,
            "final_payable_amount": tax_res["grand_total"] - total_discount
        }
