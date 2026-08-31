"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.services.tx_reproduce_svc import TransactionReproducibilityService


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001",
    }


def test_snapshot_creation_with_all_6_dimensions():
    """Verify creation of 6-part governance version snapshot."""
    snap = TransactionReproducibilityService.create_governance_snapshot(
        formula_versions={"FORM_GST_INTR_SPLIT": 1, "FORM_LINE_DISCOUNT_NET": 1},
        rule_versions={"BR_MAX_BILL_DISCOUNT": 1, "BR_LOYALTY_REDEMPTION_LIMIT": 1},
        policy_versions={"POL_GST_STATUTORY": 1, "POL_INVOICE_ROUNDING": 1},
        workflow_versions={"WF_PURCHASE_ORDER": 1},
        pricing_version=2,
        accounting_rule_version=1,
        doc_template_version=3,
        extra_metadata={"invoice_no": "INV-2026-001", "cashier_id": "CASHIER_01"},
    )
    assert "snapshot_id" in snap
    assert snap["pricing_version"] == 2
    assert snap["accounting_rule_version"] == 1
    assert snap["doc_template_version"] == 3
    assert snap["rule_versions"]["BR_MAX_BILL_DISCOUNT"] == 1


def test_historical_invoice_replay_rule_v1_vs_v2_zero_drift():
    """
    Core Reproducibility Proof:
    Replaying an invoice created under Discount Rule v1 (10% discount)
    yields the exact historical amount even after Rule v2 (20% discount) is introduced in catalog.
    """
    historical_catalog = {
        "business_rules": {
            "BR_PROMO_DISCOUNT_v1": {
                "conditions": {"all": [{"field": "customer_tier", "op": "==", "value": "GOLD"}]},
                "actions": [{"type": "PERCENT_DISCOUNT", "value": 10}],
            },
            "BR_PROMO_DISCOUNT_v2": {
                "conditions": {"all": [{"field": "customer_tier", "op": "==", "value": "GOLD"}]},
                "actions": [{"type": "PERCENT_DISCOUNT", "value": 20}],
            },
        },
        "policies": {
            "POL_GST_STATUTORY_v1": {
                "parameters": {"tax_slabs": [0, 5, 12, 18, 28]},
            }
        },
    }

    # Historical Snapshot 1 (Bound to Rule v1)
    snapshot_v1 = {
        "snapshot_id": "snap_historical_001",
        "rule_versions": {"BR_PROMO_DISCOUNT": 1},
        "policy_versions": {"POL_GST_STATUTORY": 1},
        "formula_versions": {},
    }

    # Historical Snapshot 2 (Bound to Rule v2)
    snapshot_v2 = {
        "snapshot_id": "snap_historical_002",
        "rule_versions": {"BR_PROMO_DISCOUNT": 2},
        "policy_versions": {"POL_GST_STATUTORY": 1},
        "formula_versions": {},
    }

    transaction_payload = {
        "order_amount": 1000.0,
        "customer_tier": "GOLD",
        "line_items": [
            {
                "item_id": "ITEM_A",
                "quantity": 1,
                "unit_price": 1000.0,
                "discount_amount": 0.0,
                "tax_rate": 18.0,
            }
        ],
        "supplier_state": "27",
        "recipient_state": "27",
    }

    # Replay with Snapshot v1 -> Must produce 10% discount (100.0) -> Payable: 1180 - 100 = 1080.0
    res_v1 = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=snapshot_v1,
        transaction_payload=transaction_payload,
        historical_rule_catalog=historical_catalog,
    )
    assert res_v1["total_discount"] == 100.0
    assert res_v1["final_payable_amount"] == 1080.0

    # Replay with Snapshot v2 -> Must produce 20% discount (200.0) -> Payable: 1180 - 200 = 980.0
    res_v2 = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=snapshot_v2,
        transaction_payload=transaction_payload,
        historical_rule_catalog=historical_catalog,
    )
    assert res_v2["total_discount"] == 200.0
    assert res_v2["final_payable_amount"] == 980.0


def test_statutory_gst_recalculation_replay():
    """Verify statutory GST recalculation across intrastate vs interstate."""
    snapshot = {
        "snapshot_id": "snap_gst_01",
        "rule_versions": {},
        "policy_versions": {"POL_GST_STATUTORY": 1},
        "formula_versions": {},
    }
    tx_intrastate = {
        "order_amount": 2000.0,
        "line_items": [{"item_id": "ITM1", "quantity": 2, "unit_price": 1000.0, "tax_rate": 18.0}],
        "supplier_state": "27",
        "recipient_state": "27",
    }
    res_intra = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=snapshot,
        transaction_payload=tx_intrastate,
    )
    assert res_intra["tax_calculation"]["is_intrastate"] is True
    assert res_intra["tax_calculation"]["cgst_total"] == 180.0
    assert res_intra["tax_calculation"]["sgst_total"] == 180.0
    assert res_intra["tax_calculation"]["igst_total"] == 0.0
    assert res_intra["final_payable_amount"] == 2360.0


def test_ledger_double_entry_postings_generation():
    """Verify deterministic double-entry ledger postings."""
    postings = TransactionReproducibilityService.generate_reproduced_ledger_postings(
        taxable_amount=Decimal("1000.00"),
        cgst_amount=Decimal("90.00"),
        sgst_amount=Decimal("90.00"),
        igst_amount=Decimal("0.00"),
        total_payable=Decimal("1180.00"),
        payment_mode="CASH",
    )
    total_debits = sum(e["debit"] for e in postings)
    total_credits = sum(e["credit"] for e in postings)
    assert total_debits == 1180.0
    assert total_credits == 1180.0
    assert total_debits == total_credits  # Balanced accounting equation


def test_drift_detection_when_totals_mismatch():
    """Verify drift detection triggers when replayed calculation deviates from recorded totals."""
    snapshot = {
        "snapshot_id": "snap_drift_test",
        "rule_versions": {},
        "policy_versions": {"POL_GST_STATUTORY": 1},
        "formula_versions": {},
    }
    tx = {
        "order_amount": 1000.0,
        "line_items": [{"item_id": "ITM1", "quantity": 1, "unit_price": 1000.0, "tax_rate": 18.0}],
        "supplier_state": "27",
        "recipient_state": "27",
    }
    # Expected grand total is 1180.0, but tampered value is 1100.0
    expected_tampered = {
        "taxable_total": 1000.0,
        "total_tax": 180.0,
        "final_payable": 1100.0,
    }
    res = TransactionReproducibilityService.replay_transaction_with_historical_rules(
        snapshot=snapshot,
        transaction_payload=tx,
        expected_totals=expected_tampered,
    )
    assert res["drift_detected"] is True
    assert res["drift_details"]["payable_drift"] == 80.0


@pytest.mark.asyncio
async def test_api_snapshot_create_endpoint():
    """Verify API endpoint for governance snapshot creation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/governed-logic/snapshot/create",
            json={
                "formula_versions": {"FORM_GST": 1},
                "rule_versions": {"BR_DISC": 1},
                "policy_versions": {"POL_TAX": 1},
                "pricing_version": 2,
                "accounting_rule_version": 1,
                "doc_template_version": 1,
            },
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        snap = res.json()
        assert "snapshot_id" in snap
        assert snap["pricing_version"] == 2


@pytest.mark.asyncio
async def test_api_replay_endpoint():
    """Verify API endpoint for historical transaction replay."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/governed-logic/replay",
            json={
                "snapshot": {
                    "snapshot_id": "snap_api_001",
                    "rule_versions": {},
                    "policy_versions": {"POL_GST_STATUTORY": 1},
                    "formula_versions": {},
                },
                "transaction_payload": {
                    "order_amount": 500.0,
                    "line_items": [
                        {"item_id": "ITM1", "quantity": 1, "unit_price": 500.0, "tax_rate": 18.0}
                    ],
                    "supplier_state": "27",
                    "recipient_state": "27",
                },
                "expected_totals": {
                    "taxable_total": 500.0,
                    "total_tax": 90.0,
                    "final_payable": 590.0,
                },
            },
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["reproduced"] is True
        assert data["final_payable_amount"] == 590.0
        assert data["drift_detected"] is False
