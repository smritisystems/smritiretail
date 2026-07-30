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

test_scp_engine.py — Unit test suite for SMRITI Compliance Platform (SCP v1.0 Kernel).
"""

from decimal import Decimal
from datetime import date
from app.core.scp.rule_evaluator import (
    TemporalRuleEvaluator, TemporalStatutoryRule, TaxRuleCondition, TaxRuleAction
)
from app.core.scp.validator import StatutoryValidator


def test_temporal_rule_evaluator():
    rules = [
        TemporalStatutoryRule(
            rule_id="r1",
            rule_code="GST_B2B_INTRA",
            version="v1.0.0",
            effective_from=date(2022, 7, 18),
            effective_to=None,
            jurisdiction="IN_GST",
            conditions=[
                TaxRuleCondition(field="customer.state", operator="EQUALS", value="MH"),
                TaxRuleCondition(field="company.state", operator="EQUALS", value="MH"),
            ],
            actions=[
                TaxRuleAction(component="CGST", rate_expression="item.gst_rate / 2", ledger_account="DUTIES_CGST"),
                TaxRuleAction(component="SGST", rate_expression="item.gst_rate / 2", ledger_account="DUTIES_SGST"),
            ]
        )
    ]

    evaluator = TemporalRuleEvaluator(rules)
    context = {
        "customer": {"state": "MH"},
        "company": {"state": "MH"}
    }

    # Taxable value ₹1,000, Item GST 18% -> CGST ₹90, SGST ₹90
    breakdown = evaluator.evaluate_voucher(
        context=context,
        item_rate=Decimal("18.00"),
        taxable_value=Decimal("1000.00"),
        txn_date=date(2026, 7, 30)
    )

    assert breakdown["CGST"] == Decimal("90.00")
    assert breakdown["SGST"] == Decimal("90.00")


def test_statutory_validator_preflight():
    valid_invoice = {
        "is_b2b": True,
        "customer_gstin": "27AAACG1234F1Z0",
        "total_amount": 25000.00,
        "items": [{"hsn_code": "620520"}]
    }

    issues = StatutoryValidator.validate_sales_invoice(valid_invoice)
    errors = [i for i in issues if i.severity == "ERROR"]
    assert len(errors) == 0

    invalid_invoice = {
        "is_b2b": True,
        "customer_gstin": "INVALID_GSTIN_123",
        "total_amount": 65000.00,
        "items": [{"hsn_code": ""}]
    }

    issues_invalid = StatutoryValidator.validate_sales_invoice(invalid_invoice)
    error_codes = [i.code for i in issues_invalid if i.severity == "ERROR"]
    warning_codes = [i.code for i in issues_invalid if i.severity == "WARNING"]

    assert "INVALID_GSTIN_FORMAT" in error_codes
    assert "MISSING_MANDATORY_HSN" in error_codes
    assert "EWAY_THRESHOLD_EXCEEDED" in warning_codes
