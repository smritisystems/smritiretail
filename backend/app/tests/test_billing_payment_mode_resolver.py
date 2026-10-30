from decimal import Decimal
from types import SimpleNamespace

from app.services.billing_profile_service import BillingProfileService


def customer(
    *,
    payment_category="CASH",
    allow_cash=True,
    allow_credit=True,
    outstanding=0,
):
    return SimpleNamespace(
        policy=SimpleNamespace(
            payment_category=payment_category,
            allow_cash_bill=allow_cash,
            allow_credit_invoice=allow_credit,
        ),
        outstanding=outstanding,
    )


def group(*, credit=True, limit=1000, unlimited=False, hold=False, allow_override=False):
    return SimpleNamespace(
        can_purchase_on_credit=credit,
        credit_limit=limit,
        unlimited_credit=unlimited,
        credit_hold=hold,
        allow_override=allow_override,
    )


def resolve(customer_record, customer_group=None, *, company_modes=None, **kwargs):
    return BillingProfileService.resolve_customer_payment_options(
        configuration={
            "allowed_transactions": (
                ["CASH", "CREDIT"] if company_modes is None else company_modes
            ),
            "default_transaction": "CASH",
        },
        customer=customer_record,
        group=customer_group,
        **kwargs,
    )


def test_resolves_cash_only_and_card_payment_category_as_cash():
    result = resolve(
        customer(payment_category="CARD", allow_credit=False),
        group(credit=False),
    )
    assert result["allowed_transactions"] == ["CASH"]
    assert result["default_transaction"] == "CASH"
    assert result["default_transaction_permitted"] is True


def test_resolves_credit_only_without_offering_cash():
    result = resolve(
        customer(payment_category="CREDIT", allow_cash=False),
        group(),
    )
    assert result["allowed_transactions"] == ["CREDIT"]
    assert result["default_transaction"] == "CREDIT"
    assert result["default_transaction_permitted"] is True


def test_keeps_invalid_customer_default_without_silent_fallback():
    result = resolve(
        customer(payment_category="CREDIT", allow_cash=True),
        group(credit=True, hold=True),
    )
    assert result["allowed_transactions"] == ["CASH"]
    assert result["default_transaction"] == "CREDIT"
    assert result["default_transaction_permitted"] is False
    assert "configured credit default" in result["configuration_warning"].lower()


def test_blocks_both_modes_when_customer_policy_prohibits_them():
    result = resolve(
        customer(payment_category="CASH", allow_cash=False, allow_credit=False),
        group(),
    )
    assert result["allowed_transactions"] == []
    assert result["configuration_warning"]


def test_credit_limit_requires_authorized_override_when_exposure_exceeds_available():
    customer_record = customer(payment_category="CREDIT", outstanding=950)
    customer_group = group(limit=1000, allow_override=True)
    denied = resolve(
        customer_record,
        customer_group,
        can_override_credit=False,
        credit_exposure=Decimal("100"),
    )
    authorized = resolve(
        customer_record,
        customer_group,
        can_override_credit=True,
        credit_exposure=Decimal("100"),
    )
    assert denied["allowed_transactions"] == ["CASH"]
    assert authorized["allowed_transactions"] == ["CASH", "CREDIT"]
    assert authorized["credit_override_required"] is True


def test_unconfigured_customer_defaults_to_company_policy_not_tender_preference():
    result = resolve(
        customer(payment_category=None),
        SimpleNamespace(
            can_purchase_on_credit=True,
            credit_limit=1000,
            unlimited_credit=False,
            credit_hold=False,
            allow_override=False,
            preferred_payment_method="UPI",
        ),
    )
    assert result["default_transaction"] == "CASH"
