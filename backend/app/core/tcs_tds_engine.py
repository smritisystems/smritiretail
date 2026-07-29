"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.12.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance Core Layer (ICCL) - TCS/TDS Rate Engine

TCS (Tax Collected at Source) - Section 206C(1H):
  - Applies when seller's annual turnover > Rs 10 Crore in previous FY
  - Rate: 0.1% of sale consideration received from buyer
  - Threshold: Collected only on amount exceeding Rs 50 Lakh per buyer per FY
  - Not applicable on: exports, B2C under GST, transactions with TDS deductors

TDS (Tax Deducted at Source) - Section 194Q:
  - Applies when buyer's annual purchase > Rs 50 Lakh from a single seller in FY
  - Rate: 0.1% of purchase amount exceeding Rs 50 Lakh
  - Buyer must have Tax Deduction Account Number (TAN)
  - If both TCS (206C 1H) and TDS (194Q) apply, TDS takes precedence

Both rates are for FY 2025-26. Subject to annual budget amendments.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

# Thresholds (INR)
TCS_TURNOVER_THRESHOLD = Decimal("10_00_00_000")  # Rs 10 Crore
TCS_PER_BUYER_THRESHOLD = Decimal("50_00_000")    # Rs 50 Lakh per buyer per FY
TDS_PURCHASE_THRESHOLD = Decimal("50_00_000")      # Rs 50 Lakh per seller per FY

# Rates
TCS_RATE = Decimal("0.001")   # 0.1%
TDS_RATE = Decimal("0.001")   # 0.1%


@dataclass
class TCSResult:
    applicable: bool
    rate: Decimal
    rate_percent: str
    threshold_applied: Decimal
    taxable_amount: Decimal
    tcs_amount: Decimal
    section_reference: str
    reason: str
    seller_turnover_exceeds_threshold: bool
    buyer_purchases_exceed_threshold: bool


@dataclass
class TDSResult:
    applicable: bool
    rate: Decimal
    rate_percent: str
    threshold_applied: Decimal
    taxable_amount: Decimal
    tds_amount: Decimal
    section_reference: str
    reason: str
    buyer_purchases_exceed_threshold: bool


def calculate_tcs(
    seller_turnover_previous_fy: Decimal,
    buyer_cumulative_purchases_this_fy: Decimal,
    current_transaction_amount: Decimal,
) -> TCSResult:
    """
    Calculate TCS under Section 206C(1H) of Income Tax Act.

    Args:
        seller_turnover_previous_fy: Seller's total turnover in previous FY (INR)
        buyer_cumulative_purchases_this_fy: Buyer's total purchases from this seller in current FY
        current_transaction_amount: Current transaction/invoice amount (INR)

    Returns:
        TCSResult with TCS calculation details
    """
    seller_qualifies = seller_turnover_previous_fy > TCS_TURNOVER_THRESHOLD
    buyer_threshold_crossed = buyer_cumulative_purchases_this_fy > TCS_PER_BUYER_THRESHOLD

    if not seller_qualifies:
        return TCSResult(
            applicable=False,
            rate=Decimal("0"),
            rate_percent="0%",
            threshold_applied=TCS_TURNOVER_THRESHOLD,
            taxable_amount=Decimal("0"),
            tcs_amount=Decimal("0"),
            section_reference="Section 206C(1H) - Not Applicable",
            reason=(
                f"Seller's turnover Rs {seller_turnover_previous_fy:,.2f} "
                f"does not exceed the TCS threshold of Rs {TCS_TURNOVER_THRESHOLD:,.2f}."
            ),
            seller_turnover_exceeds_threshold=False,
            buyer_purchases_exceed_threshold=buyer_threshold_crossed,
        )

    if not buyer_threshold_crossed:
        return TCSResult(
            applicable=False,
            rate=Decimal("0"),
            rate_percent="0%",
            threshold_applied=TCS_PER_BUYER_THRESHOLD,
            taxable_amount=Decimal("0"),
            tcs_amount=Decimal("0"),
            section_reference="Section 206C(1H) - Threshold Not Crossed",
            reason=(
                f"Buyer's cumulative purchases Rs {buyer_cumulative_purchases_this_fy:,.2f} "
                f"do not exceed Rs {TCS_PER_BUYER_THRESHOLD:,.2f} per buyer threshold."
            ),
            seller_turnover_exceeds_threshold=True,
            buyer_purchases_exceed_threshold=False,
        )

    # TCS applies on the current transaction amount
    tcs_amount = (current_transaction_amount * TCS_RATE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return TCSResult(
        applicable=True,
        rate=TCS_RATE,
        rate_percent="0.1%",
        threshold_applied=TCS_PER_BUYER_THRESHOLD,
        taxable_amount=current_transaction_amount,
        tcs_amount=tcs_amount,
        section_reference="Section 206C(1H) of Income Tax Act, 1961",
        reason=(
            f"TCS applicable: Seller turnover Rs {seller_turnover_previous_fy:,.2f} "
            f"exceeds Rs {TCS_TURNOVER_THRESHOLD:,.2f}. "
            f"Buyer cumulative purchases Rs {buyer_cumulative_purchases_this_fy:,.2f} "
            f"exceed Rs {TCS_PER_BUYER_THRESHOLD:,.2f}. "
            f"TCS @ 0.1% on transaction Rs {current_transaction_amount:,.2f} = Rs {tcs_amount:,.2f}."
        ),
        seller_turnover_exceeds_threshold=True,
        buyer_purchases_exceed_threshold=True,
    )


def calculate_tds(
    buyer_cumulative_purchases_this_fy: Decimal,
    current_transaction_amount: Decimal,
    buyer_has_tan: bool = True,
) -> TDSResult:
    """
    Calculate TDS under Section 194Q of Income Tax Act.

    Args:
        buyer_cumulative_purchases_this_fy: Buyer's total purchases from this seller in current FY
        current_transaction_amount: Current transaction/invoice amount (INR)
        buyer_has_tan: Whether buyer has a valid TAN (required for TDS deduction)

    Returns:
        TDSResult with TDS calculation details
    """
    threshold_crossed = buyer_cumulative_purchases_this_fy > TDS_PURCHASE_THRESHOLD

    if not buyer_has_tan:
        return TDSResult(
            applicable=False,
            rate=Decimal("0"),
            rate_percent="0%",
            threshold_applied=TDS_PURCHASE_THRESHOLD,
            taxable_amount=Decimal("0"),
            tds_amount=Decimal("0"),
            section_reference="Section 194Q - TAN Not Available",
            reason="TDS under Section 194Q requires buyer to have a valid TAN (Tax Deduction Account Number).",
            buyer_purchases_exceed_threshold=threshold_crossed,
        )

    if not threshold_crossed:
        return TDSResult(
            applicable=False,
            rate=Decimal("0"),
            rate_percent="0%",
            threshold_applied=TDS_PURCHASE_THRESHOLD,
            taxable_amount=Decimal("0"),
            tds_amount=Decimal("0"),
            section_reference="Section 194Q - Threshold Not Crossed",
            reason=(
                f"Buyer's cumulative purchases Rs {buyer_cumulative_purchases_this_fy:,.2f} "
                f"do not exceed TDS threshold of Rs {TDS_PURCHASE_THRESHOLD:,.2f}."
            ),
            buyer_purchases_exceed_threshold=False,
        )

    tds_amount = (current_transaction_amount * TDS_RATE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return TDSResult(
        applicable=True,
        rate=TDS_RATE,
        rate_percent="0.1%",
        threshold_applied=TDS_PURCHASE_THRESHOLD,
        taxable_amount=current_transaction_amount,
        tds_amount=tds_amount,
        section_reference="Section 194Q of Income Tax Act, 1961",
        reason=(
            f"TDS applicable: Buyer cumulative purchases Rs {buyer_cumulative_purchases_this_fy:,.2f} "
            f"exceed Rs {TDS_PURCHASE_THRESHOLD:,.2f}. "
            f"TDS @ 0.1% on transaction Rs {current_transaction_amount:,.2f} = Rs {tds_amount:,.2f}."
        ),
        buyer_purchases_exceed_threshold=True,
    )
