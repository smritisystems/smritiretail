"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.13.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - GST Interest & Late Fee Calculator

Calculates GST late payment interest and late filing fees using rates
sourced from the ComplianceRateRegistry (not hard-coded).

Legal references:
  Interest:
    CGST Act Section 50(1): 18% p.a. for delayed tax payment
    CGST Act Section 50(3): 24% p.a. for wrongful ITC availment
  Late Filing Fee:
    CGST Act Section 47: Rs 50/day (non-NIL), Rs 20/day (NIL)
    GST Council 49th meeting cap: Rs 10,000 per return maximum
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.core.compliance_rate_registry import get_compliance_registry


@dataclass
class GSTInterestResult:
    tax_liability: Decimal
    days_delayed: int
    annual_rate_percent: Decimal
    interest_amount: Decimal
    section_reference: str
    calculation_note: str


@dataclass
class GSTLateFeeResult:
    is_nil_return: bool
    days_delayed: int
    daily_fee: Decimal
    gross_fee: Decimal
    max_fee_cap: Decimal
    final_fee: Decimal
    cgst_portion: Decimal
    sgst_portion: Decimal
    calculation_note: str


def calculate_gst_late_interest(
    tax_liability: Decimal,
    due_date: date,
    payment_date: date,
    is_itc_fraud: bool = False,
    as_of_date: Optional[date] = None,
) -> GSTInterestResult:
    """
    Calculate GSTR-3B late payment interest under CGST Act Section 50.

    Args:
        tax_liability: Net tax payable (after ITC) in INR
        due_date: Due date for payment (20th of the month after tax period)
        payment_date: Actual date of tax payment
        is_itc_fraud: True for wrongful ITC availment (24% rate); False for normal delay (18%)
        as_of_date: Date for registry rate lookup (defaults to today)

    Returns:
        GSTInterestResult with interest amount and calculation details
    """
    registry = get_compliance_registry()
    lookup_date = as_of_date or date.today()

    if payment_date <= due_date:
        # No delay
        rate_key = "GST_LATE_INTEREST_ITC_FRAUD" if is_itc_fraud else "GST_LATE_INTEREST_NORMAL"
        annual_rate = registry.get_value(rate_key, lookup_date)
        return GSTInterestResult(
            tax_liability=tax_liability,
            days_delayed=0,
            annual_rate_percent=annual_rate,
            interest_amount=Decimal("0"),
            section_reference="CGST Act Section 50 - No Delay",
            calculation_note="Payment made on or before due date. No interest applicable.",
        )

    days_delayed = (payment_date - due_date).days
    rate_key = "GST_LATE_INTEREST_ITC_FRAUD" if is_itc_fraud else "GST_LATE_INTEREST_NORMAL"
    annual_rate = registry.get_value(rate_key, lookup_date)

    # Formula: Interest = Tax * Rate% * Days / 365
    interest = (
        tax_liability * annual_rate / Decimal("100") * Decimal(days_delayed) / Decimal("365")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    section = "CGST Act Section 50(3)" if is_itc_fraud else "CGST Act Section 50(1)"

    return GSTInterestResult(
        tax_liability=tax_liability,
        days_delayed=days_delayed,
        annual_rate_percent=annual_rate,
        interest_amount=interest,
        section_reference=section,
        calculation_note=(
            f"Interest = Rs {tax_liability} x {annual_rate}% p.a. x {days_delayed} days / 365 "
            f"= Rs {interest}. "
            f"Due: {due_date}, Paid: {payment_date}, Delay: {days_delayed} days."
        ),
    )


def calculate_gst_late_fee(
    due_date: date,
    filing_date: date,
    is_nil_return: bool = False,
    as_of_date: Optional[date] = None,
) -> GSTLateFeeResult:
    """
    Calculate GSTR-3B / GSTR-1 late filing fee under CGST Act Section 47.

    Args:
        due_date: Filing due date
        filing_date: Actual date of filing
        is_nil_return: True if this is a NIL return (lower daily fee applies)
        as_of_date: Date for registry rate lookup (defaults to today)

    Returns:
        GSTLateFeeResult with daily fee, gross fee, cap, and final fee (CGST + SGST split)
    """
    registry = get_compliance_registry()
    lookup_date = as_of_date or date.today()

    if filing_date <= due_date:
        daily_fee = registry.get_value(
            "GST_LATE_FEE_NIL_DAILY" if is_nil_return else "GST_LATE_FEE_DAILY",
            lookup_date
        )
        return GSTLateFeeResult(
            is_nil_return=is_nil_return,
            days_delayed=0,
            daily_fee=daily_fee,
            gross_fee=Decimal("0"),
            max_fee_cap=registry.get_value("GST_LATE_FEE_MAX_PER_RETURN", lookup_date),
            final_fee=Decimal("0"),
            cgst_portion=Decimal("0"),
            sgst_portion=Decimal("0"),
            calculation_note="Filed on or before due date. No late fee applicable.",
        )

    days_delayed = (filing_date - due_date).days
    daily_fee_key = "GST_LATE_FEE_NIL_DAILY" if is_nil_return else "GST_LATE_FEE_DAILY"
    daily_fee = registry.get_value(daily_fee_key, lookup_date)
    max_cap = registry.get_value("GST_LATE_FEE_MAX_PER_RETURN", lookup_date)

    gross_fee = (daily_fee * Decimal(days_delayed)).quantize(Decimal("0.01"))
    final_fee = min(gross_fee, max_cap)
    half = (final_fee / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return GSTLateFeeResult(
        is_nil_return=is_nil_return,
        days_delayed=days_delayed,
        daily_fee=daily_fee,
        gross_fee=gross_fee,
        max_fee_cap=max_cap,
        final_fee=final_fee,
        cgst_portion=half,
        sgst_portion=final_fee - half,
        calculation_note=(
            f"Late fee = Rs {daily_fee}/day x {days_delayed} days = Rs {gross_fee}. "
            f"Capped at Rs {max_cap}. Final fee: Rs {final_fee} "
            f"(CGST Rs {half} + SGST Rs {final_fee - half}). "
            f"Due: {due_date}, Filed: {filing_date}."
        ),
    )
