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
SMRITI Indian Compliance Core Layer (ICCL) - MSME Payment Compliance Engine

MSMED Act 2006 (Micro, Small and Medium Enterprises Development Act) mandates:
  - Section 15: Payment to MSME suppliers within agreed credit period (max 45 days)
    or 15 days if no agreement exists.
  - Section 16: If payment is delayed beyond Section 15 limit, compound interest
    at 3x the RBI bank rate is payable (compounded monthly).
  - Section 22: Buyers must disclose MSME payment delays in annual financial statements.

MSME Samadhaan Portal: Online portal for MSME suppliers to file delayed payment
applications (https://samadhaan.msme.gov.in).

SMRITI Error Codes:
  SMRITI-MSME-001: Payment overdue — exceeds 45-day statutory limit
  SMRITI-MSME-002: Payment overdue — exceeds 15-day limit (no agreement)
  SMRITI-MSME-003: Interest liability accrued on delayed payment
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.core.compliance_rate_registry import get_compliance_registry

# Current RBI Bank Rate (used as base for MSME interest calculation)
# Updated via compliance registry in future when RBI changes the rate
_DEFAULT_RBI_BANK_RATE_PERCENT = Decimal("6.5")  # As of FY 2025-26


@dataclass
class MSMEPaymentStatus:
    invoice_number: str
    supplier_name: str
    supplier_msme_registration: str   # MSME Udyam Registration Number
    invoice_date: date
    invoice_amount: Decimal
    payment_due_date: date
    payment_date: Optional[date]      # None = not yet paid
    has_written_agreement: bool

    # Computed
    days_overdue: int = 0
    is_overdue: bool = False
    interest_amount: Decimal = Decimal("0")
    annual_interest_rate_percent: Decimal = Decimal("0")
    error_code: str = ""
    alert_message: str = ""
    samadhaan_reference_note: str = ""


def check_msme_payment_compliance(
    invoice_number: str,
    supplier_name: str,
    supplier_msme_registration: str,
    invoice_date: date,
    invoice_amount: Decimal,
    payment_date: Optional[date],
    has_written_agreement: bool = True,
    rbi_bank_rate_percent: Optional[Decimal] = None,
    as_of_date: Optional[date] = None,
) -> MSMEPaymentStatus:
    """
    Check MSMED Act 2006 payment compliance for an MSME supplier invoice.

    Args:
        invoice_number: Purchase invoice number
        supplier_name: MSME supplier name
        supplier_msme_registration: Udyam Registration Number (URN)
        invoice_date: Date of the supplier invoice
        invoice_amount: Invoice amount in INR
        payment_date: Date payment was made (None = not yet paid)
        has_written_agreement: True if buyer-seller have a written payment agreement
        rbi_bank_rate_percent: Current RBI bank rate (defaults to registry/built-in value)
        as_of_date: Reference date for due date calculation (defaults to today)

    Returns:
        MSMEPaymentStatus with compliance status and interest calculation
    """
    registry = get_compliance_registry()
    reference_date = as_of_date or date.today()
    bank_rate = rbi_bank_rate_percent or _DEFAULT_RBI_BANK_RATE_PERCENT

    # Determine applicable payment period
    if has_written_agreement:
        max_days = int(registry.get_value("MSME_PAYMENT_DAYS_WITH_AGREEMENT", reference_date))
        error_code_template = "SMRITI-MSME-001"
    else:
        max_days = int(registry.get_value("MSME_PAYMENT_DAYS_WITHOUT_AGREEMENT", reference_date))
        error_code_template = "SMRITI-MSME-002"

    payment_due_date = invoice_date + timedelta(days=max_days)

    # Determine reference date for overdue calculation
    check_date = payment_date if payment_date else reference_date
    days_overdue = max(0, (check_date - payment_due_date).days)
    is_overdue = days_overdue > 0

    if not is_overdue:
        return MSMEPaymentStatus(
            invoice_number=invoice_number,
            supplier_name=supplier_name,
            supplier_msme_registration=supplier_msme_registration,
            invoice_date=invoice_date,
            invoice_amount=invoice_amount,
            payment_due_date=payment_due_date,
            payment_date=payment_date,
            has_written_agreement=has_written_agreement,
            days_overdue=0,
            is_overdue=False,
            interest_amount=Decimal("0"),
            annual_interest_rate_percent=Decimal("0"),
            error_code="",
            alert_message=(
                f"Payment for invoice {invoice_number} is within the {max_days}-day "
                f"MSME statutory limit. Due by {payment_due_date}."
            ),
        )

    # Calculate compound interest at 3x RBI bank rate (monthly compounding)
    interest_factor = registry.get_value("MSME_INTEREST_FACTOR", reference_date)  # 3x
    annual_rate = bank_rate * interest_factor  # 3 * 6.5% = 19.5% p.a.
    monthly_rate = annual_rate / Decimal("12") / Decimal("100")
    months_overdue = Decimal(days_overdue) / Decimal("30")

    # Compound interest: A = P * (1 + r)^n - P
    import math
    compound_factor = Decimal(str((1 + float(monthly_rate)) ** float(months_overdue)))
    interest_amount = (invoice_amount * (compound_factor - Decimal("1"))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    status_word = "was paid" if payment_date else "remains unpaid"
    alert = (
        f"MSME PAYMENT ALERT: Invoice {invoice_number} from {supplier_name} "
        f"(Udyam: {supplier_msme_registration}) {status_word} {days_overdue} days past the "
        f"{max_days}-day statutory limit (due {payment_due_date}). "
        f"Compound interest liability: Rs {interest_amount} @ {annual_rate}% p.a. "
        f"(3x RBI bank rate {bank_rate}%)."
    )

    samadhaan_note = (
        f"If unresolved, the MSME supplier can file a recovery application at "
        f"https://samadhaan.msme.gov.in against buyer for delayed payment. "
        f"Reference: MSMED Act 2006, Section 16."
    )

    return MSMEPaymentStatus(
        invoice_number=invoice_number,
        supplier_name=supplier_name,
        supplier_msme_registration=supplier_msme_registration,
        invoice_date=invoice_date,
        invoice_amount=invoice_amount,
        payment_due_date=payment_due_date,
        payment_date=payment_date,
        has_written_agreement=has_written_agreement,
        days_overdue=days_overdue,
        is_overdue=True,
        interest_amount=interest_amount,
        annual_interest_rate_percent=annual_rate,
        error_code="SMRITI-MSME-003",
        alert_message=alert,
        samadhaan_reference_note=samadhaan_note,
    )
