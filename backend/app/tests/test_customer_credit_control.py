"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from app.core.customer_credit_control import (
    CustomerCreditControlEngine,
    CustomerCreditProfile,
    CreditStatus,
)

def test_credit_evaluation_normal_and_soft_warning():
    profile = CustomerCreditProfile(
        customer_id="CUST-101",
        customer_name="Acme Corp",
        credit_limit=100000.0,
        outstanding_balance=50000.0,
        unbilled_orders_amount=10000.0,
    )

    # 1. Normal status (Exposure 60k / 100k = 60%)
    res1 = CustomerCreditControlEngine.evaluate_credit(profile, new_order_amount=0.0)
    assert res1.status == CreditStatus.NORMAL
    assert res1.allow_new_order is True
    assert res1.utilization_percentage == 60.0

    # 2. Soft warning status (Exposure 60k + 25k = 85k / 100k = 85%)
    res2 = CustomerCreditControlEngine.evaluate_credit(profile, new_order_amount=25000.0)
    assert res2.status == CreditStatus.SOFT_WARNING
    assert res2.allow_new_order is True
    assert res2.utilization_percentage == 85.0

def test_credit_evaluation_hard_block_limit_exceeded():
    profile = CustomerCreditProfile(
        customer_id="CUST-102",
        customer_name="Beta Retail",
        credit_limit=50000.0,
        outstanding_balance=45000.0,
    )

    # New order of 10k pushes total to 55k (> 50k limit)
    res = CustomerCreditControlEngine.evaluate_credit(profile, new_order_amount=10000.0)
    assert res.status == CreditStatus.HARD_BLOCK
    assert res.allow_new_order is False
    assert "Credit limit exceeded" in res.blocking_reason

def test_credit_evaluation_hard_block_overdue_days():
    profile = CustomerCreditProfile(
        customer_id="CUST-103",
        customer_name="Gamma Traders",
        credit_limit=200000.0,
        outstanding_balance=10000.0,
        oldest_overdue_days=120,  # Max allowed is 90 days
        max_allowed_overdue_days=90,
    )

    res = CustomerCreditControlEngine.evaluate_credit(profile, new_order_amount=1000.0)
    assert res.status == CreditStatus.HARD_BLOCK
    assert res.allow_new_order is False
    assert "overdue by 120 days" in res.blocking_reason
