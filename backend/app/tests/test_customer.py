"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Customer Master & Credit Policy Automated Unit Tests
"""

from decimal import Decimal
from datetime import date
import pytest

from app.models.crm import Customer, CustomerGroup, CustomerGSTRegistration
from app.core.gst_engine import validate_gstin


def test_customer_model_instantiation():
    """Scenario 1: Customer model instantiation with canonical fields."""
    cust = Customer(
        id="cust-001",
        code="CUST-1001",
        name="Rajesh Sharma",
        mobile="9820012345",
        email="rajesh@example.com",
        gst_number="27AAAPL1234A1Z5",
        pricing_basis="MRP",
        status="Active",
        outstanding=Decimal("0.00"),
    )
    assert cust.code == "CUST-1001"
    assert cust.name == "Rajesh Sharma"
    assert cust.mobile == "9820012345"
    assert cust.status == "Active"
    assert cust.pricing_basis == "MRP"
    assert cust.outstanding == Decimal("0.00")


def test_customer_group_credit_governance():
    """Scenario 2: CustomerGroup credit policy and auto-block thresholds."""
    group = CustomerGroup(
        id="grp-wholesale",
        name="Wholesale Platinum",
        credit_limit=Decimal("500000.00"),
        unlimited_credit=False,
        credit_days=30,
        grace_days=7,
        credit_hold=False,
        auto_block_sales=True,
        warning_threshold_percent=Decimal("80.00"),
    )
    assert group.name == "Wholesale Platinum"
    assert group.credit_limit == Decimal("500000.00")
    assert group.credit_days == 30
    assert group.auto_block_sales is True


def test_customer_credit_limit_check():
    """Scenario 3: Credit breach detection against group policy."""
    credit_limit = Decimal("100000.00")
    current_outstanding = Decimal("95000.00")
    new_invoice_amount = Decimal("10000.00")

    projected_exposure = current_outstanding + new_invoice_amount
    is_breached = projected_exposure > credit_limit
    assert is_breached is True
    assert projected_exposure == Decimal("105000.00")


def test_customer_gstin_statutory_validation():
    """Scenario 4: GSTIN statutory shape and state code validation."""
    valid, state_code, state_name = validate_gstin("27AAAPL1234A1Z5")
    assert valid is True
    assert state_code == "27"
    assert state_name == "Maharashtra"

    invalid, _, _ = validate_gstin("27AAAPL123")  # too short
    assert invalid is False


def test_customer_multistate_gstin_registration():
    """Scenario 5: Multi-state GST registration child entity mapping."""
    reg = CustomerGSTRegistration(
        id="gst-reg-01",
        customer_id="cust-001",
        gstin="27AAAPL1234A1Z5",
        state_code=27,
        state_name="Maharashtra",
        is_primary=True,
        is_active=True,
    )
    assert reg.customer_id == "cust-001"
    assert reg.state_code == 27
    assert reg.is_primary is True
    assert reg.is_active is True


def test_customer_dedup_key():
    """Scenario 6: Mobile number and GSTIN dedup key generation."""
    mobile = " +91 98200-12345 "
    cleaned_mobile = "".join(filter(str.isdigit, mobile))[-10:]
    assert cleaned_mobile == "9820012345"
