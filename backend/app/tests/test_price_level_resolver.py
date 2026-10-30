"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.1
Modified     : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Unit tests for BillingProfileService.resolve_effective_price_level().
Rec 4/6 — 3-tier precedence: company policy -> customer profile -> cashier override.
"""

import sys
sys.path.insert(0, "F:/SMRITRretailNX")

import pytest
from backend.app.services.billing_profile_service import BillingProfileService

B2C  = {"default_price_level": "MRP",           "cashier_price_override": "DISABLED"}
B2B  = {"default_price_level": "SELLING_PRICE",  "cashier_price_override": "ALLOWED"}
AUTH = {"default_price_level": "SELLING_PRICE",  "cashier_price_override": "AUTHORIZED_ONLY"}
PBK  = {"default_price_level": "PRICE_BOOK",     "cashier_price_override": "DISABLED"}

@pytest.mark.parametrize("label,eff_conf,cust_basis,cashier_level,exp_level,exp_source", [
    ("T1: B2C no customer",            B2C,  None,              None,              "MRP",             "COMPANY_POLICY"),
    ("T2: B2C cust=MRP same level",    B2C,  "MRP",             None,              "MRP",             "COMPANY_POLICY"),
    ("T3: B2C cust=RATE -> SELLING",   B2C,  "RATE",            None,              "SELLING_PRICE",   "CUSTOMER_PROFILE"),
    ("T4: B2C cust=WHOLESALE",         B2C,  "WHOLESALE_PRICE", None,              "WHOLESALE_PRICE", "CUSTOMER_PROFILE"),
    ("T5: B2B no customer",            B2B,  None,              None,              "SELLING_PRICE",   "COMPANY_POLICY"),
    ("T6: B2B cashier WHOLESALE",      B2B,  None,              "WHOLESALE_PRICE", "WHOLESALE_PRICE", "CASHIER_OVERRIDE"),
    ("T7: B2B cust=MRP beats cashier", B2B,  "MRP",             "WHOLESALE_PRICE", "MRP",             "CUSTOMER_PROFILE"),
    ("T8: DISABLED cashier ignored",   B2C,  None,              "SELLING_PRICE",   "MRP",             "COMPANY_POLICY"),
    ("T9: invalid level -> MRP",       {"default_price_level": "BOGUS"}, None, None, "MRP", "COMPANY_POLICY"),
    ("T10: PRICE_BOOK company level",  PBK,  None,              None,              "PRICE_BOOK",      "COMPANY_POLICY"),
    ("T11: AUTHORIZED_ONLY override",  AUTH, None,              "PRICE_BOOK",      "PRICE_BOOK",      "CASHIER_OVERRIDE"),
    ("T12: cust=PRICE_BOOK override",  B2B,  "PRICE_BOOK",      None,              "PRICE_BOOK",      "CUSTOMER_PROFILE"),
])
def test_resolve_effective_price_level(label, eff_conf, cust_basis, cashier_level, exp_level, exp_source):
    res = BillingProfileService.resolve_effective_price_level(eff_conf, cust_basis, cashier_level)
    assert res["effective_price_level"] == exp_level, (
        f"{label}: expected level={exp_level!r}, got {res['effective_price_level']!r}"
    )
    assert res["source"] == exp_source, (
        f"{label}: expected source={exp_source!r}, got {res['source']!r}"
    )
    assert "cashier_override_permitted" in res
