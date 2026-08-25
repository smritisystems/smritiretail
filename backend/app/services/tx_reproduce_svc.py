"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from .governed_rules import GovernedRuleEngine


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
        pricing_version: Optional[int] = 1,
        accounting_rule_version: Optional[int] = 1,
        doc_template_version: Optional[int] = 1,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Creates an immutable snapshot of all 6 version categories bound to a transaction.
        """
        return {
            "snapshot_id": f"gov_snap_{uuid.uuid4().hex[:12]}",
            "snapshot_timestamp": datetime.now(timezone.utc).isoformat(),
            "formula_versions": formula_versions or {},
            "rule_versions": rule_versions or {},
            "policy_versions": policy_versions or {},
            "workflow_versions": workflow_versions or {},
            "pricing_version": pricing_version or 1,
            "accounting_rule_version": accounting_rule_version or 1,
            "doc_template_version": doc_template_version or 1,
            "metadata": extra_metadata or {},
        }

    @classmethod
    def generate_reproduced_ledger_postings(
        cls,
        taxable_amount: Decimal,
        cgst_amount: Decimal,
        sgst_amount: Decimal,
        igst_amount: Decimal,
        total_payable: Decimal,
        payment_mode: str = "CASH",
    ) -> List[Dict[str, Any]]:
        """
        Generates deterministic double-entry accounting ledger postings for sales invoices:
        - Debit: Cash / Bank / Customer Debtor Account (Gross Total)
        - Credit: Sales Revenue Account (Taxable Total)
        - Credit: Output CGST (if intrastate)
        - Credit: Output SGST (if intrastate)
        - Credit: Output IGST (if interstate)
        """
        entries = []
        settlement_account = "ACC_1001_CASH_DRAWER" if payment_mode.upper() == "CASH" else "ACC_1100_DEBTORS"
        settlement_name = "Cash on Hand / Drawer" if payment_mode.upper() == "CASH" else "Trade Accounts Receivable"

        # 1. Debit Settlement
        entries.append({
            "account_code": settlement_account,
            "account_name": settlement_name,
            "debit": float(total_payable),
            "credit": 0.0,
        })

        # 2. Credit Sales Revenue
        entries.append({
            "account_code": "ACC_4001_SALES_REVENUE",
            "account_name": "Sales Revenue (Goods)",
            "debit": 0.0,
            "credit": float(taxable_amount),
        })

        # 3. Credit Output Taxes
        if cgst_amount > Decimal("0.00"):
            entries.append({
                "account_code": "ACC_2201_OUTPUT_CGST",
                "account_name": "Output CGST Payable",
                "debit": 0.0,
                "credit": float(cgst_amount),
            })
        if sgst_amount > Decimal("0.00"):
            entries.append({
                "account_code": "ACC_2202_OUTPUT_SGST",
                "account_name": "Output SGST Payable",
                "debit": 0.0,
                "credit": float(sgst_amount),
            })
        if igst_amount > Decimal("0.00"):
            entries.append({
                "account_code": "ACC_2203_OUTPUT_IGST",
                "account_name": "Output IGST Payable",
                "debit": 0.0,
                "credit": float(igst_amount),
            })

        return entries

    @classmethod
    def replay_transaction_with_historical_rules(
        cls,
        snapshot: Dict[str, Any],
        transaction_payload: Dict[str, Any],
        historical_rule_catalog: Optional[Dict[str, Any]] = None,
        expected_totals: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Historical Replay Engine:
        Executes calculation against historical definitions referenced in snapshot, NOT current active definitions.
        Verifies zero drift against original expected values.
        """
        catalog = historical_rule_catalog or {}
        rule_versions = snapshot.get("rule_versions", {})
        policy_versions = snapshot.get("policy_versions", {})
        formula_versions = snapshot.get("formula_versions", {})

        # 1. Apply Discount / Pricing Rules from historical versions
        applied_discounts = []
        total_discount = Decimal("0.00")
        line_items = transaction_payload.get("line_items", [])
        order_amount = Decimal(str(transaction_payload.get("order_amount", 0)))

        for rule_code, version in rule_versions.items():
            rule_key = f"{rule_code}_v{version}"
            rule_def = catalog.get("business_rules", {}).get(rule_key)
            if rule_def:
                context = {
                    "order_amount": order_amount,
                    "customer_tier": transaction_payload.get("customer_tier", "REGULAR"),
                    "channel": transaction_payload.get("channel", "POS"),
                    "discount_pct": transaction_payload.get("discount_pct", 0),
                }
                res = GovernedRuleEngine.evaluate_business_rule(
                    conditions=rule_def["conditions"],
                    actions=rule_def["actions"],
                    context=context,
                )
                if res["matched"]:
                    applied_discounts.extend(res["applied_actions"])
                    total_discount += res["calculated_discount"]

        # 2. Apply Tax Policy from historical version
        gst_policy_code = transaction_payload.get("gst_policy_code", "POL_GST_STATUTORY")
        gst_version = policy_versions.get(gst_policy_code, 1)
        gst_key = f"{gst_policy_code}_v{gst_version}"
        policy_def = catalog.get("policies", {}).get(gst_key, {})

        tax_res = GovernedRuleEngine.evaluate_gst_tax_policy(
            line_items=line_items,
            supplier_state_code=transaction_payload.get("supplier_state", "27"),
            recipient_state_code=transaction_payload.get("recipient_state", "27"),
            policy_parameters=policy_def.get("parameters"),
        )

        final_payable = tax_res["grand_total"] - total_discount
        final_payable = max(Decimal("0.00"), final_payable)

        # 3. Generate Replayed Ledger Postings
        payment_mode = transaction_payload.get("payment_mode", "CASH")
        ledger_postings = cls.generate_reproduced_ledger_postings(
            taxable_amount=tax_res["taxable_total"],
            cgst_amount=tax_res["cgst_total"],
            sgst_amount=tax_res["sgst_total"],
            igst_amount=tax_res["igst_total"],
            total_payable=final_payable,
            payment_mode=payment_mode,
        )

        # 4. Drift Detection (if expected_totals supplied)
        drift_detected = False
        drift_details = None
        if expected_totals:
            exp_taxable = Decimal(str(expected_totals.get("taxable_total", tax_res["taxable_total"])))
            exp_tax = Decimal(str(expected_totals.get("total_tax", tax_res["total_tax"])))
            exp_payable = Decimal(str(expected_totals.get("final_payable", final_payable)))

            diff_taxable = abs(tax_res["taxable_total"] - exp_taxable)
            diff_tax = abs(tax_res["total_tax"] - exp_tax)
            diff_payable = abs(final_payable - exp_payable)

            if diff_taxable > Decimal("0.01") or diff_tax > Decimal("0.01") or diff_payable > Decimal("0.01"):
                drift_detected = True
                drift_details = {
                    "taxable_drift": float(diff_taxable),
                    "tax_drift": float(diff_tax),
                    "payable_drift": float(diff_payable),
                    "replayed_payable": float(final_payable),
                    "expected_payable": float(exp_payable),
                }

        return {
            "reproduced": True,
            "snapshot_id": snapshot.get("snapshot_id", "manual_replay"),
            "rules_replayed": {
                "rule_versions": rule_versions,
                "policy_versions": policy_versions,
                "formula_versions": formula_versions,
                "pricing_version": snapshot.get("pricing_version", 1),
                "accounting_rule_version": snapshot.get("accounting_rule_version", 1),
            },
            "discounts_applied": applied_discounts,
            "total_discount": float(total_discount),
            "tax_calculation": {
                "is_intrastate": tax_res["is_intrastate"],
                "supplier_state": tax_res["supplier_state"],
                "recipient_state": tax_res["recipient_state"],
                "taxable_total": float(tax_res["taxable_total"]),
                "cgst_total": float(tax_res["cgst_total"]),
                "sgst_total": float(tax_res["sgst_total"]),
                "igst_total": float(tax_res["igst_total"]),
                "total_tax": float(tax_res["total_tax"]),
                "grand_total": float(tax_res["grand_total"]),
                "line_items": [
                    {k: float(v) if isinstance(v, Decimal) else v for k, v in item.items()}
                    for item in tax_res["line_items"]
                ],
            },
            "ledger_entries": ledger_postings,
            "final_payable_amount": float(final_payable),
            "drift_detected": drift_detected,
            "drift_details": drift_details,
        }
