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

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.services.governed_rules import GovernedRuleEngine
from app.services.tx_reproduce_svc import TransactionReproducibilityService
from app.db.session import get_company_sessionmaker
from app.models.governed_logic import (
    FormulaDefinition,
    BusinessRuleDefinition,
    PolicyDefinition,
    WorkflowDefinition,
)
from app.models.capability_template import FeatureFlag


@pytest.fixture
def client():
    return TestClient(app)


def test_safe_formula_ast_evaluation():
    """Verify safe, deterministic AST formula evaluation without eval()."""
    # Formula: ((mrp * (1 - discount_pct / 100)) + tax_amount)
    ast = {
        "type": "binary_op",
        "op": "+",
        "left": {
            "type": "binary_op",
            "op": "*",
            "left": {"type": "param", "name": "mrp"},
            "right": {
                "type": "binary_op",
                "op": "-",
                "left": {"type": "literal", "value": 1},
                "right": {
                    "type": "binary_op",
                    "op": "/",
                    "left": {"type": "param", "name": "discount_pct"},
                    "right": {"type": "literal", "value": 100}
                }
            }
        },
        "right": {"type": "param", "name": "tax_amount"}
    }

    params = {
        "mrp": Decimal("1000.00"),
        "discount_pct": Decimal("10.00"),
        "tax_amount": Decimal("162.00")
    }

    res = GovernedRuleEngine.evaluate_formula_ast(ast, params)
    # (1000 * 0.90) + 162 = 900 + 162 = 1062
    assert res == Decimal("1062.00")


def test_formula_division_by_zero_and_missing_param_rejection():
    """Verify formula engine fails closed with clear error on division by zero or missing param."""
    div_zero_ast = {
        "type": "binary_op",
        "op": "/",
        "left": {"type": "literal", "value": 100},
        "right": {"type": "literal", "value": 0}
    }
    with pytest.raises(ZeroDivisionError):
        GovernedRuleEngine.evaluate_formula_ast(div_zero_ast, {})

    missing_param_ast = {
        "type": "param",
        "name": "non_existent_param"
    }
    with pytest.raises(ValueError, match="Missing required formula parameter"):
        GovernedRuleEngine.evaluate_formula_ast(missing_param_ast, {})


def test_business_rule_condition_tree_and_discount_calculation():
    """Verify declarative condition evaluation and discount action calculation."""
    conditions = {
        "all": [
            {"field": "customer_tier", "op": "==", "value": "VIP"},
            {"field": "order_amount", "op": ">=", "value": 500}
        ]
    }
    actions = [{"type": "PERCENT_DISCOUNT", "value": 10}]

    # Case 1: Matching VIP with order amount 1000 -> 10% discount = 100
    ctx_match = {"customer_tier": "VIP", "order_amount": Decimal("1000.00")}
    res_match = GovernedRuleEngine.evaluate_business_rule(conditions, actions, ctx_match)
    assert res_match["matched"] is True
    assert res_match["calculated_discount"] == Decimal("100.00")

    # Case 2: Non-VIP -> No match
    ctx_non_vip = {"customer_tier": "REGULAR", "order_amount": Decimal("1000.00")}
    res_non_vip = GovernedRuleEngine.evaluate_business_rule(conditions, actions, ctx_non_vip)
    assert res_non_vip["matched"] is False
    assert res_non_vip["calculated_discount"] == Decimal("0.00")


def test_gst_tax_policy_intrastate_vs_interstate():
    """Verify statutory GST tax determination and rounding."""
    line_items = [
        {"item_id": "item_1", "quantity": 2, "unit_price": 500, "discount_amount": 0, "tax_rate": 18},
        {"item_id": "item_2", "quantity": 1, "unit_price": 200, "discount_amount": 0, "tax_rate": 12},
    ]

    # Intrastate: MH (27) to MH (27) -> CGST + SGST
    intra = GovernedRuleEngine.evaluate_gst_tax_policy(line_items, "27", "27")
    assert intra["is_intrastate"] is True
    assert intra["taxable_total"] == Decimal("1200.00")
    assert intra["cgst_total"] == Decimal("102.00")  # (1000 * 9%) + (200 * 6%) = 90 + 12 = 102
    assert intra["sgst_total"] == Decimal("102.00")
    assert intra["igst_total"] == Decimal("0.00")
    assert intra["grand_total"] == Decimal("1404.00")

    # Interstate: MH (27) to DL (07) -> IGST
    inter = GovernedRuleEngine.evaluate_gst_tax_policy(line_items, "27", "07")
    assert inter["is_intrastate"] is False
    assert inter["taxable_total"] == Decimal("1200.00")
    assert inter["cgst_total"] == Decimal("0.00")
    assert inter["sgst_total"] == Decimal("0.00")
    assert inter["igst_total"] == Decimal("204.00")  # (1000 * 18%) + (200 * 12%) = 180 + 24 = 204
    assert inter["grand_total"] == Decimal("1404.00")


def test_workflow_state_machine_transition():
    """Verify workflow state transitions and role enforcement."""
    wf_def = {
        "states": ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"],
        "transitions": [
            {"from": "DRAFT", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
            {"from": "DRAFT", "to": "PENDING_APPROVAL", "action": "SUBMIT", "required_roles": ["CASHIER", "MANAGER"]},
            {"from": "PENDING_APPROVAL", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
        ]
    }

    # 1. Cashier submits DRAFT -> PENDING_APPROVAL: Allowed
    t1 = GovernedRuleEngine.evaluate_workflow_transition(wf_def, "DRAFT", "SUBMIT", ["CASHIER"])
    assert t1["allowed"] is True
    assert t1["next_state"] == "PENDING_APPROVAL"

    # 2. Cashier tries to directly APPROVE DRAFT: Denied
    t2 = GovernedRuleEngine.evaluate_workflow_transition(wf_def, "DRAFT", "APPROVE", ["CASHIER"])
    assert t2["allowed"] is False
    assert "Permission denied" in t2["error"]

    # 3. Manager APPROVES PENDING_APPROVAL: Allowed
    t3 = GovernedRuleEngine.evaluate_workflow_transition(wf_def, "PENDING_APPROVAL", "APPROVE", ["MANAGER"])
    assert t3["allowed"] is True
    assert t3["next_state"] == "APPROVED"


def test_transaction_reproducibility_historical_invariance():
    """
    CRITICAL P1.5 REPRODUCIBILITY TEST:
    Verify that an invoice created under Version 1 of a discount rule (10%)
    produces identical 10% recalculation when replayed, even after Version 2 (15%) is published.
    """
    # Historical rule catalog containing both v1 and v2
    catalog = {
        "business_rules": {
            "RULE_VIP_DISCOUNT_v1": {
                "conditions": {"field": "customer_tier", "op": "==", "value": "VIP"},
                "actions": [{"type": "PERCENT_DISCOUNT", "value": 10}]
            },
            "RULE_VIP_DISCOUNT_v2": {
                "conditions": {"field": "customer_tier", "op": "==", "value": "VIP"},
                "actions": [{"type": "PERCENT_DISCOUNT", "value": 15}]
            }
        },
        "policies": {
            "POLICY_GST_STANDARD_v1": {
                "parameters": {"rounding_mode": "ROUND_HALF_UP"}
            }
        }
    }

    # Step 1: Invoice #1 created with snapshot pointing to RULE_VIP_DISCOUNT v1
    v1_snapshot = TransactionReproducibilityService.create_governance_snapshot(
        rule_versions={"RULE_VIP_DISCOUNT": 1},
        policy_versions={"POLICY_GST_STANDARD": 1}
    )

    inv1_payload = {
        "order_amount": Decimal("1000.00"),
        "customer_tier": "VIP",
        "supplier_state": "27",
        "recipient_state": "27",
        "gst_policy_code": "POLICY_GST_STANDARD",
        "line_items": [
            {"item_id": "item_1", "quantity": 1, "unit_price": 1000, "discount_amount": 0, "tax_rate": 18}
        ]
    }

    # Replay Invoice #1 -> Must strictly apply v1 (10% discount = 100)
    res_v1_replay = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=v1_snapshot,
        transaction_payload=inv1_payload,
        historical_rule_catalog=catalog
    )
    assert res_v1_replay["total_discount"] == Decimal("100.00")
    assert res_v1_replay["final_payable_amount"] == Decimal("1080.00")  # (1000 - 100) + 180 = 1080

    # Step 2: Invoice #2 created with snapshot pointing to newly published RULE_VIP_DISCOUNT v2
    v2_snapshot = TransactionReproducibilityService.create_governance_snapshot(
        rule_versions={"RULE_VIP_DISCOUNT": 2},
        policy_versions={"POLICY_GST_STANDARD": 1}
    )

    # Replay Invoice #2 -> Must strictly apply v2 (15% discount = 150)
    res_v2_replay = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=v2_snapshot,
        transaction_payload=inv1_payload,
        historical_rule_catalog=catalog
    )
    assert res_v2_replay["total_discount"] == Decimal("150.00")
    assert res_v2_replay["final_payable_amount"] == Decimal("1030.00")  # (1000 - 150) + 180 = 1030

    # Step 3: Re-replaying Invoice #1 NEVER changes regardless of v2 presence
    res_v1_rechecked = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=v1_snapshot,
        transaction_payload=inv1_payload,
        historical_rule_catalog=catalog
    )
    assert res_v1_rechecked["total_discount"] == Decimal("100.00")
    assert res_v1_rechecked["final_payable_amount"] == Decimal("1080.00")


def test_api_governed_logic_endpoints(client):
    """Verify governed logic API endpoints."""
    # 1. Formula AST evaluation endpoint
    f_res = client.post("/api/v1/governed-logic/formulas/evaluate", json={
        "ast": {
            "type": "binary_op",
            "op": "*",
            "left": {"type": "param", "name": "qty"},
            "right": {"type": "param", "name": "rate"}
        },
        "params": {"qty": 5, "rate": 200}
    })
    assert f_res.status_code == 200
    assert f_res.json()["result"] == 1000.0

    # 2. Rule evaluation endpoint
    r_res = client.post("/api/v1/governed-logic/rules/evaluate", json={
        "conditions": {"field": "customer_tier", "op": "==", "value": "VIP"},
        "actions": [{"type": "PERCENT_DISCOUNT", "value": 10}],
        "context": {"customer_tier": "VIP", "order_amount": 1000}
    })
    assert r_res.status_code == 200
    assert r_res.json()["matched"] is True

    # 3. GST policy evaluation endpoint
    g_res = client.post("/api/v1/governed-logic/policies/gst/evaluate", json={
        "line_items": [{"item_id": "it_1", "quantity": 1, "unit_price": 1000, "tax_rate": 18}],
        "supplier_state": "27",
        "recipient_state": "27"
    })
    assert g_res.status_code == 200
    assert g_res.json()["is_intrastate"] is True
    assert g_res.json()["grand_total"] == 1180.0


@pytest.mark.asyncio
async def test_database_backed_governed_logic_and_feature_flags():
    """Verify SmritiSys contains populated formulas, rules, policies, workflows, and feature flags."""
    sessionmaker = get_company_sessionmaker("smritisys")
    async with sessionmaker() as session:
        # Check formulas
        formulas = (await session.execute(select(FormulaDefinition))).scalars().all()
        assert len(formulas) >= 2
        f_codes = {f.code for f in formulas}
        assert "FORMULA_MRP_DISCOUNT_TAX" in f_codes
        assert "FORMULA_PROFIT_MARGIN" in f_codes

        # Check rules
        rules = (await session.execute(select(BusinessRuleDefinition))).scalars().all()
        assert len(rules) >= 2
        r_versions = {r.version for r in rules if r.code == "RULE_VIP_DISCOUNT"}
        assert 1 in r_versions
        assert 2 in r_versions

        # Check policies
        policies = (await session.execute(select(PolicyDefinition))).scalars().all()
        assert len(policies) >= 1
        assert any(p.code == "POLICY_GST_STANDARD" for p in policies)

        # Check workflows
        workflows = (await session.execute(select(WorkflowDefinition))).scalars().all()
        assert len(workflows) >= 1
        assert any(w.code == "WF_SALES_INVOICE" for w in workflows)

        # Check feature flags
        flags = (await session.execute(select(FeatureFlag))).scalars().all()
        assert len(flags) >= 6
        flag_keys = {f.key for f in flags}
        assert "ENABLE_MULTI_CURRENCY" in flag_keys
        assert "ENABLE_ADVANCED_PRICING" in flag_keys
        assert "ENABLE_ECOM_SYNC" in flag_keys
        assert "ENABLE_RULE55_CHALLAN" in flag_keys
