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

import json
import psycopg2
from psycopg2.extras import execute_values


def seed_governed_logic_data():
    """
    Authoritative seeder for Governed Logic engines (Formulas, Business Rules, Policies, Workflows) into [smritisys].
    """
    formulas = [
        (
            "form_gst_split", "uuid_form_gst_split", "FORM_GST_INTR_SPLIT", 1,
            "GST Intrastate CGST/SGST 50-50 Split", "GST_TAX",
            "Divides total applicable statutory GST rate into equal CGST and SGST components.",
            json.dumps({
                "type": "binary_op",
                "op": "/",
                "left": {"type": "param", "name": "gst_rate"},
                "right": {"type": "literal", "value": 2}
            }),
            json.dumps({"gst_rate": {"type": "number", "required": True}}),
            True, False, "ACTIVE"
        ),
        (
            "form_line_net", "uuid_form_line_net", "FORM_LINE_DISCOUNT_NET", 1,
            "Item Line Net Amount with Discount", "PRICING",
            "Calculates taxable net amount for line item: (quantity * unit_price) - discount_amount.",
            json.dumps({
                "type": "binary_op",
                "op": "-",
                "left": {
                    "type": "binary_op",
                    "op": "*",
                    "left": {"type": "param", "name": "quantity"},
                    "right": {"type": "param", "name": "unit_price"}
                },
                "right": {"type": "param", "name": "discount_amount"}
            }),
            json.dumps({
                "quantity": {"type": "number", "required": True},
                "unit_price": {"type": "number", "required": True},
                "discount_amount": {"type": "number", "required": True}
            }),
            True, False, "ACTIVE"
        ),
        (
            "form_loyalty_acc", "uuid_form_loyalty_acc", "FORM_LOYALTY_ACCRUAL", 1,
            "Customer Loyalty Points Accrual", "LOYALTY",
            "Awards points on bill value: (invoice_amount / 100) * points_rate.",
            json.dumps({
                "type": "binary_op",
                "op": "*",
                "left": {
                    "type": "binary_op",
                    "op": "/",
                    "left": {"type": "param", "name": "invoice_amount"},
                    "right": {"type": "literal", "value": 100}
                },
                "right": {"type": "param", "name": "points_rate"}
            }),
            json.dumps({
                "invoice_amount": {"type": "number", "required": True},
                "points_rate": {"type": "number", "required": True}
            }),
            True, False, "ACTIVE"
        ),
        (
            "form_commission", "uuid_form_commission", "FORM_STAFF_COMMISSION", 1,
            "Salesperson Commission Calculation", "COMMISSION",
            "Calculates staff commission: net_sales * (commission_pct / 100).",
            json.dumps({
                "type": "binary_op",
                "op": "*",
                "left": {"type": "param", "name": "net_sales"},
                "right": {
                    "type": "binary_op",
                    "op": "/",
                    "left": {"type": "param", "name": "commission_pct"},
                    "right": {"type": "literal", "value": 100}
                }
            }),
            json.dumps({
                "net_sales": {"type": "number", "required": True},
                "commission_pct": {"type": "number", "required": True}
            }),
            True, False, "ACTIVE"
        ),
        (
            "form_round_near", "uuid_form_round_near", "FORM_ROUNDING_NEAREST", 1,
            "Commercial Rounding to Nearest Integer", "PROFITABILITY",
            "Rounds final payable bill amount to nearest whole rupee.",
            json.dumps({
                "type": "func",
                "name": "round",
                "args": [
                    {"type": "param", "name": "amount"},
                    {"type": "literal", "value": 0}
                ]
            }),
            json.dumps({"amount": {"type": "number", "required": True}}),
            True, False, "ACTIVE"
        ),
    ]

    rules = [
        (
            "brule_max_disc", "uuid_brule_max_disc", "BR_MAX_BILL_DISCOUNT", 1,
            "Cashier Discount Limit Rule", "DISCOUNT_RULE", 10,
            json.dumps({
                "field": "discount_pct",
                "op": ">",
                "value": 10
            }),
            json.dumps([
                {"type": "REQUIRE_MANAGER_OVERRIDE", "message": "Discounts above 10% require Store Manager PIN"}
            ]),
            json.dumps({"channels": ["POS_RETAIL"], "roles": ["CASHIER"]}),
            True, False, "ACTIVE"
        ),
        (
            "brule_loyalty_red", "uuid_brule_loyalty_red", "BR_LOYALTY_REDEMPTION_LIMIT", 1,
            "Loyalty Points Maximum Redemption Threshold", "PROMOTION_RULE", 20,
            json.dumps({
                "field": "redemption_pct",
                "op": "<=",
                "value": 50
            }),
            json.dumps([
                {"type": "ALLOW_REDEMPTION", "max_redeem_percent": 50}
            ]),
            json.dumps({"channels": ["POS_RETAIL", "ECOM"]}),
            True, False, "ACTIVE"
        ),
        (
            "brule_credit_limit", "uuid_brule_credit_limit", "BR_CUSTOMER_CREDIT_LIMIT", 1,
            "B2B Customer Credit Limit Enforcement", "CREDIT_LIMIT", 5,
            json.dumps({
                "field": "outstanding_balance",
                "op": ">",
                "value": 100000
            }),
            json.dumps([
                {"type": "BLOCK_CREDIT_SALE", "reason": "Outstanding balance exceeds authorized credit limit"}
            ]),
            json.dumps({"channels": ["B2B_WHOLESALE"]}),
            True, False, "ACTIVE"
        ),
    ]

    policies = [
        (
            "pol_gst_statutory", "uuid_pol_gst_statutory", "POL_GST_STATUTORY", 1,
            "Statutory GST Place of Supply Policy", "GST_TAX_POLICY",
            json.dumps({
                "tax_slabs": [0, 5, 12, 18, 28],
                "default_currency": "INR",
                "interstate_rule": "IGST",
                "intrastate_rule": "CGST_SGST_SPLIT"
            }),
            True, False, "ACTIVE"
        ),
        (
            "pol_cash_till", "uuid_pol_cash_till", "POL_CASH_TILL_LIMIT", 1,
            "POS Cash Drawer Maximum Holding Policy", "APPROVAL_POLICY",
            json.dumps({
                "max_till_amount": 50000.0,
                "warning_threshold": 40000.0,
                "action": "TRIGGER_SAFE_DROP"
            }),
            True, False, "ACTIVE"
        ),
        (
            "pol_invoice_round", "uuid_pol_invoice_round", "POL_INVOICE_ROUNDING", 1,
            "Statutory Rounding Off Policy for Tax Invoices", "ROUNDING_POLICY",
            json.dumps({
                "rounding_method": "ROUND_HALF_UP",
                "max_roundoff_deviation": 0.50
            }),
            True, False, "ACTIVE"
        ),
    ]

    workflows = [
        (
            "wf_purch_order", "uuid_wf_purch_order", "WF_PURCHASE_ORDER", 1,
            "PurchaseOrder", "Standard Purchase Order Approval & Receipt Workflow",
            "DRAFT",
            json.dumps(["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED", "RECEIVED", "CLOSED", "CANCELLED"]),
            json.dumps([
                {"from": "DRAFT", "to": "PENDING_APPROVAL", "action": "SUBMIT", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "PENDING_APPROVAL", "to": "APPROVED", "action": "APPROVE", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "PENDING_APPROVAL", "to": "DRAFT", "action": "REJECT", "required_roles": ["MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "ORDERED", "action": "DISPATCH_SUPPLIER", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "ORDERED", "to": "RECEIVED", "action": "GRN_RECEIPT", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "RECEIVED", "to": "CLOSED", "action": "FINALIZE", "required_roles": ["ACCOUNTANT", "SYSADMIN"]},
                {"from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
            ]),
            True, False, "ACTIVE"
        ),
        (
            "wf_sales_return", "uuid_wf_sales_return", "WF_SALES_RETURN", 1,
            "SalesReturn", "Retail POS Customer Sales Return & Inspection Workflow",
            "DRAFT",
            json.dumps(["DRAFT", "PENDING_INSPECTION", "APPROVED", "REFUNDED", "REJECTED"]),
            json.dumps([
                {"from": "DRAFT", "to": "PENDING_INSPECTION", "action": "SUBMIT_RETURN", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"]},
                {"from": "PENDING_INSPECTION", "to": "APPROVED", "action": "PASS_INSPECTION", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "PENDING_INSPECTION", "to": "REJECTED", "action": "FAIL_INSPECTION", "required_roles": ["STORE_MANAGER", "SYSADMIN"]},
                {"from": "APPROVED", "to": "REFUNDED", "action": "SETTLE_REFUND", "required_roles": ["CASHIER", "STORE_MANAGER", "SYSADMIN"]},
            ]),
            True, False, "ACTIVE"
        ),
    ]

    print("\n--- Seeding Governed Logic Master Data into [smritisys] ---")
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
        cur = conn.cursor()

        # 1. Formulas
        execute_values(
            cur,
            """
            INSERT INTO formula_definitions (
                id, uuid, code, version, name, category, description, expression_ast, parameters_schema, is_active, is_deleted, status
            ) VALUES %s
            ON CONFLICT (code, version) DO UPDATE SET
                name = EXCLUDED.name,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                expression_ast = EXCLUDED.expression_ast::jsonb,
                parameters_schema = EXCLUDED.parameters_schema::jsonb,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            formulas,
        )

        # 2. Business Rules
        execute_values(
            cur,
            """
            INSERT INTO business_rule_definitions (
                id, uuid, code, version, name, rule_type, priority, conditions, actions, scopes, is_active, is_deleted, status
            ) VALUES %s
            ON CONFLICT (code, version) DO UPDATE SET
                name = EXCLUDED.name,
                rule_type = EXCLUDED.rule_type,
                priority = EXCLUDED.priority,
                conditions = EXCLUDED.conditions::jsonb,
                actions = EXCLUDED.actions::jsonb,
                scopes = EXCLUDED.scopes::jsonb,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            rules,
        )

        # 3. Policies
        execute_values(
            cur,
            """
            INSERT INTO policy_definitions (
                id, uuid, code, version, name, policy_type, parameters, is_active, is_deleted, status
            ) VALUES %s
            ON CONFLICT (code, version) DO UPDATE SET
                name = EXCLUDED.name,
                policy_type = EXCLUDED.policy_type,
                parameters = EXCLUDED.parameters::jsonb,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            policies,
        )

        # 4. Workflows
        execute_values(
            cur,
            """
            INSERT INTO workflow_definitions (
                id, uuid, code, version, doc_type, name, initial_state, states, transitions, is_active, is_deleted, status
            ) VALUES %s
            ON CONFLICT (code, version) DO UPDATE SET
                doc_type = EXCLUDED.doc_type,
                name = EXCLUDED.name,
                initial_state = EXCLUDED.initial_state,
                states = EXCLUDED.states::jsonb,
                transitions = EXCLUDED.transitions::jsonb,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active;
            """,
            workflows,
        )

        conn.commit()
        conn.close()
        print("Successfully seeded Governed Logic Master Data into [smritisys].")
    except Exception as e:
        print(f"Error seeding [smritisys]: {e}")


if __name__ == "__main__":
    seed_governed_logic_data()
