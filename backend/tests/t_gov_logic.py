"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.43.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token


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


@pytest.mark.asyncio
async def test_formula_registry_listing():
    """Verify formula definitions catalog query."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/governed-logic/formulas", headers=_get_auth_headers())
        assert res.status_code == 200
        formulas = res.json()
        assert len(formulas) >= 5
        codes = [f["code"] for f in formulas]
        assert "FORM_GST_INTR_SPLIT" in codes
        assert "FORM_LINE_DISCOUNT_NET" in codes
        assert "FORM_LOYALTY_ACCRUAL" in codes


@pytest.mark.asyncio
async def test_formula_ast_evaluation_net_price():
    """Verify deterministic mathematical formula AST evaluation (no eval)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "ast": {
                "type": "binary_op",
                "op": "-",
                "left": {
                    "type": "binary_op",
                    "op": "*",
                    "left": {"type": "param", "name": "quantity"},
                    "right": {"type": "param", "name": "unit_price"},
                },
                "right": {"type": "param", "name": "discount_amount"},
            },
            "params": {
                "quantity": 5,
                "unit_price": 1000.0,
                "discount_amount": 250.0,
            },
        }
        res = await client.post(
            "/api/v1/governed-logic/formulas/evaluate",
            json=payload,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["result"] == 4750.0
        assert data["result_decimal"] == "4750.0"


@pytest.mark.asyncio
async def test_formula_ast_evaluation_zero_division_guard():
    """Verify safe failure and error handling for division by zero."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "ast": {
                "type": "binary_op",
                "op": "/",
                "left": {"type": "literal", "value": 100},
                "right": {"type": "literal", "value": 0},
            },
            "params": {},
        }
        res = await client.post(
            "/api/v1/governed-logic/formulas/evaluate",
            json=payload,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 400
        assert "division by zero" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_business_rules_listing():
    """Verify business rules registry listing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/governed-logic/rules", headers=_get_auth_headers())
        assert res.status_code == 200
        rules = res.json()
        assert len(rules) >= 3
        codes = [r["code"] for r in rules]
        assert "BR_MAX_BILL_DISCOUNT" in codes
        assert "BR_CUSTOMER_CREDIT_LIMIT" in codes


@pytest.mark.asyncio
async def test_business_rule_evaluation():
    """Verify declarative condition evaluation and discount calculation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "conditions": {
                "all": [
                    {"field": "order_amount", "op": ">=", "value": 1000},
                    {"field": "customer_tier", "op": "==", "value": "GOLD"},
                ]
            },
            "actions": [
                {"type": "PERCENT_DISCOUNT", "value": 10}
            ],
            "context": {
                "order_amount": 2500,
                "customer_tier": "GOLD",
            },
        }
        res = await client.post(
            "/api/v1/governed-logic/rules/evaluate",
            json=payload,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["matched"] is True
        assert float(data["calculated_discount"]) == 250.0


@pytest.mark.asyncio
async def test_statutory_gst_tax_policy_intrastate():
    """Verify GST intrastate tax calculation (CGST 9% + SGST 9% on 18% slab)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "line_items": [
                {
                    "item_id": "ITEM_001",
                    "quantity": 2,
                    "unit_price": 500.0,
                    "discount_amount": 0.0,
                    "tax_rate": 18.0,
                }
            ],
            "supplier_state": "27",
            "recipient_state": "27",
        }
        res = await client.post(
            "/api/v1/governed-logic/policies/gst/evaluate",
            json=payload,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_intrastate"] is True
        assert float(data["taxable_total"]) == 1000.0
        assert float(data["cgst_total"]) == 90.0
        assert float(data["sgst_total"]) == 90.0
        assert float(data["igst_total"]) == 0.0
        assert float(data["grand_total"]) == 1180.0


@pytest.mark.asyncio
async def test_statutory_gst_tax_policy_interstate():
    """Verify GST interstate tax calculation (IGST 18%)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "line_items": [
                {
                    "item_id": "ITEM_002",
                    "quantity": 1,
                    "unit_price": 2000.0,
                    "discount_amount": 0.0,
                    "tax_rate": 18.0,
                }
            ],
            "supplier_state": "27",
            "recipient_state": "24",  # Gujarat
        }
        res = await client.post(
            "/api/v1/governed-logic/policies/gst/evaluate",
            json=payload,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_intrastate"] is False
        assert float(data["taxable_total"]) == 2000.0
        assert float(data["cgst_total"]) == 0.0
        assert float(data["sgst_total"]) == 0.0
        assert float(data["igst_total"]) == 360.0
        assert float(data["grand_total"]) == 2360.0


@pytest.mark.asyncio
async def test_workflow_state_machine_transition():
    """Verify purchase order workflow transition permissions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Valid transition: DRAFT -> PENDING_APPROVAL by STORE_MANAGER
        payload_valid = {
            "workflow_code": "WF_PURCHASE_ORDER",
            "current_state": "DRAFT",
            "action": "SUBMIT",
            "user_roles": ["STORE_MANAGER"],
        }
        res = await client.post(
            "/api/v1/governed-logic/workflows/transition",
            json=payload_valid,
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["allowed"] is True
        assert data["new_state"] == "PENDING_APPROVAL"

        # 2. Unauthorized transition: APPROVE by CASHIER (requires MANAGER)
        payload_unauth = {
            "workflow_code": "WF_PURCHASE_ORDER",
            "current_state": "PENDING_APPROVAL",
            "action": "APPROVE",
            "user_roles": ["CASHIER"],
        }
        res_unauth = await client.post(
            "/api/v1/governed-logic/workflows/transition",
            json=payload_unauth,
            headers=_get_auth_headers(),
        )
        assert res_unauth.status_code == 200
        data_unauth = res_unauth.json()
        assert data_unauth["allowed"] is False
        assert "Permission denied" in data_unauth["reason"]


@pytest.mark.asyncio
async def test_definition_validation_endpoint():
    """Verify diagnostic validator for formula ASTs and workflow graphs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Valid formula
        res_valid = await client.post(
            "/api/v1/governed-logic/validate",
            json={
                "definition_type": "FORMULA",
                "definition": {
                    "type": "binary_op",
                    "op": "+",
                    "left": {"type": "param", "name": "a"},
                    "right": {"type": "param", "name": "b"},
                },
            },
            headers=_get_auth_headers(),
        )
        assert res_valid.status_code == 200
        assert res_valid.json()["valid"] is True

        # Invalid formula (bad op)
        res_invalid = await client.post(
            "/api/v1/governed-logic/validate",
            json={
                "definition_type": "FORMULA",
                "definition": {
                    "type": "binary_op",
                    "op": "EXEC_SHELL",
                    "left": {"type": "literal", "value": 1},
                    "right": {"type": "literal", "value": 2},
                },
            },
            headers=_get_auth_headers(),
        )
        assert res_invalid.status_code == 200
        assert res_invalid.json()["valid"] is False
        assert len(res_invalid.json()["errors"]) > 0


@pytest.mark.asyncio
async def test_retail_store_policies_listing():
    """Verify standard retail operational policies derived from Shoper 9 are active."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/governed-logic/policies",
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        policies = res.json()
        codes = [p["code"] for p in policies]
        assert "POLICY_BILLING_CONTROLS" in codes
        assert "POLICY_BARCODE_COST_MASK" in codes
        assert "POLICY_INWARDS_PROCUREMENT" in codes
        assert "POLICY_CREDIT_MANAGEMENT" in codes


@pytest.mark.asyncio
async def test_cost_mask_preview_endpoint():
    """Verify apparel hanging tag cost price mask encoder."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 450 with map 0:A, 1:B, 2:C, 3:D, 4:E, 5:F, 6:G, 7:H, 8:I, 9:J -> 4=E, 5=F, 0=A -> "EFA"
        res = await client.post(
            "/api/v1/governed-logic/policies/cost-mask/preview",
            json={
                "cost_price": 450.0,
                "encoding_map": {"0": "A", "1": "B", "2": "C", "3": "D", "4": "E", "5": "F", "6": "G", "7": "H", "8": "I", "9": "J"}
            },
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["original_cost"] == 450.0
        assert data["encoded_string"] == "EFA"


@pytest.mark.asyncio
async def test_policy_update_endpoint():
    """Verify updating policy parameters."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get billing controls
        res = await client.get(
            "/api/v1/governed-logic/policies/POLICY_BILLING_CONTROLS",
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        pol = res.json()
        assert pol["code"] == "POLICY_BILLING_CONTROLS"

        # Update billing controls parameter
        updated_params = dict(pol["parameters"])
        updated_params["enable_qty_only_editing"] = True
        
        res_put = await client.put(
            "/api/v1/governed-logic/policies/POLICY_BILLING_CONTROLS",
            json={"parameters": updated_params},
            headers=_get_auth_headers(),
        )
        assert res_put.status_code == 200
        assert res_put.json()["parameters"]["enable_qty_only_editing"] is True
