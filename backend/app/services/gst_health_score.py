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
SMRITI Indian Compliance Core Layer (ICCL) - GST Filing Health Score Engine

Pre-flight compliance validation before GSTR filing submission.
Evaluates invoice data against 7 compliance checks and returns a health score (0-100).

A score of 100 means the invoice is fully GST-compliant and ready for filing.
Any check failure reduces the score and adds an actionable issue description.

This engine is called BEFORE submitting invoices to the GSTR portal via SGIP,
preventing costly GST portal rejections and late filing penalties.

SMRITI Error Codes used:
- SMRITI-GST-HEALTH-001: Invalid GSTIN format
- SMRITI-GST-HEALTH-002: Missing or invalid HSN code
- SMRITI-GST-HEALTH-003: Invoice date outside filing period
- SMRITI-GST-HEALTH-004: Tax rate mismatch with HSN classification
- SMRITI-GST-HEALTH-005: Place of Supply / buyer GSTIN state mismatch
- SMRITI-GST-HEALTH-006: Reverse Charge flag not set correctly
- SMRITI-GST-HEALTH-007: Round-off amount exceeds tolerance (Rs 1)
"""

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


# Internal regex for GSTIN format validation
_GSTIN_PATTERN = re.compile(
    r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)

# GSTR-1 applies to invoices of the previous month; max age = 13 months
_MAX_INVOICE_AGE_DAYS = 395


@dataclass
class GSTHealthCheckItem:
    check_id: str
    check_name: str
    passed: bool
    score_weight: int   # Points deducted if failed
    issue_message: str = ""
    error_code: str = ""


@dataclass
class GSTHealthScore:
    """
    GST Filing Health Score result.
    score: 0-100. 100 = fully compliant.
    """
    score: int
    pass_count: int
    fail_count: int
    total_checks: int
    is_filing_ready: bool
    checks: list[GSTHealthCheckItem] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


def calculate_gst_health_score(
    supplier_gstin: str,
    buyer_gstin: str,
    invoice_date: date,
    filing_period_start: date,
    filing_period_end: date,
    hsn_code: str,
    declared_tax_rate_percent: Decimal,
    place_of_supply_state_code: str,
    reverse_charge_applicable: bool,
    reverse_charge_flag_set: bool,
    invoice_total_declared: Decimal,
    sum_of_line_items: Decimal,
    roundoff_tolerance: Decimal = Decimal("1.00"),
) -> GSTHealthScore:
    """
    Evaluate an invoice against 7 GST compliance checks.

    Args:
        supplier_gstin: Supplier GSTIN (15-char)
        buyer_gstin: Buyer GSTIN (15-char) - can be empty for B2C
        invoice_date: Date of the invoice
        filing_period_start: Start of the GSTR filing period (usually 1st of month)
        filing_period_end: End of the GSTR filing period (usually last day of month)
        hsn_code: HSN/SAC code on the invoice line
        declared_tax_rate_percent: Tax rate as declared on invoice (e.g., Decimal('18'))
        place_of_supply_state_code: 2-digit GST state code for place of supply
        reverse_charge_applicable: Whether this transaction should have RCM
        reverse_charge_flag_set: Whether the RCM flag is set on the invoice
        invoice_total_declared: Invoice total as declared (INR)
        sum_of_line_items: Computed sum of all line items (INR)
        roundoff_tolerance: Maximum allowed round-off difference (default Rs 1)

    Returns:
        GSTHealthScore with score, issues list, and recommendations
    """
    checks: list[GSTHealthCheckItem] = []

    # ----- Check 1: GSTIN Format Validation -----
    gstin_valid = bool(_GSTIN_PATTERN.match(supplier_gstin.upper())) if supplier_gstin else False
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-001",
        check_name="Supplier GSTIN Format",
        passed=gstin_valid,
        score_weight=20,
        issue_message=(
            "" if gstin_valid
            else f"Supplier GSTIN '{supplier_gstin}' is invalid. "
                 "GSTIN must be 15 characters in format: 29ABCDE1234F1Z5."
        ),
        error_code="" if gstin_valid else "SMRITI-GST-HEALTH-001",
    ))

    # ----- Check 2: HSN Code Present and Valid -----
    hsn_valid = bool(hsn_code and re.fullmatch(r"\d{2,8}", str(hsn_code).strip()))
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-002",
        check_name="HSN/SAC Code Validity",
        passed=hsn_valid,
        score_weight=20,
        issue_message=(
            "" if hsn_valid
            else f"HSN code '{hsn_code}' is missing or invalid. "
                 "A valid 2, 4, 6, or 8-digit HSN/SAC code is required for GST filing."
        ),
        error_code="" if hsn_valid else "SMRITI-GST-HEALTH-002",
    ))

    # ----- Check 3: Invoice Date Within Filing Period -----
    date_in_period = filing_period_start <= invoice_date <= filing_period_end
    # Also check invoice isn't too old (GSTR-1 max 13 months retrospective)
    days_old = (filing_period_end - invoice_date).days
    not_too_old = days_old <= _MAX_INVOICE_AGE_DAYS
    date_valid = date_in_period or not_too_old
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-003",
        check_name="Invoice Date Within Filing Period",
        passed=date_valid,
        score_weight=10,
        issue_message=(
            "" if date_valid
            else f"Invoice date {invoice_date} falls outside the filing period "
                 f"({filing_period_start} to {filing_period_end}) "
                 f"and is {days_old} days old (max allowed: {_MAX_INVOICE_AGE_DAYS} days)."
        ),
        error_code="" if date_valid else "SMRITI-GST-HEALTH-003",
    ))

    # ----- Check 4: Tax Rate Plausible for HSN Chapter -----
    # Simplified check: valid GST rates are 0, 0.1, 0.25, 3, 5, 12, 18, 28
    _VALID_GST_RATES = {
        Decimal("0"), Decimal("0.1"), Decimal("0.25"),
        Decimal("3"), Decimal("5"), Decimal("12"), Decimal("18"), Decimal("28"),
    }
    tax_rate_valid = declared_tax_rate_percent in _VALID_GST_RATES
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-004",
        check_name="Tax Rate Is Valid GST Slab",
        passed=tax_rate_valid,
        score_weight=15,
        issue_message=(
            "" if tax_rate_valid
            else f"Tax rate {declared_tax_rate_percent}% is not a recognized GST slab. "
                 "Valid rates: 0%, 0.1%, 0.25%, 3%, 5%, 12%, 18%, 28%."
        ),
        error_code="" if tax_rate_valid else "SMRITI-GST-HEALTH-004",
    ))

    # ----- Check 5: Place of Supply State Code Consistent with Buyer GSTIN -----
    if buyer_gstin and len(buyer_gstin) >= 2:
        buyer_state_code = buyer_gstin[:2]
        pos_consistent = buyer_state_code == str(place_of_supply_state_code).zfill(2)
    else:
        # B2C: POS must be declared; not validated against GSTIN
        pos_consistent = bool(place_of_supply_state_code)

    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-005",
        check_name="Place of Supply Consistent with Buyer GSTIN",
        passed=pos_consistent,
        score_weight=15,
        issue_message=(
            "" if pos_consistent
            else f"Place of Supply state code '{place_of_supply_state_code}' "
                 f"does not match buyer GSTIN prefix '{buyer_gstin[:2] if buyer_gstin else 'N/A'}'. "
                 "This will cause IGST vs CGST+SGST misclassification."
        ),
        error_code="" if pos_consistent else "SMRITI-GST-HEALTH-005",
    ))

    # ----- Check 6: Reverse Charge Flag -----
    rcm_correct = reverse_charge_applicable == reverse_charge_flag_set
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-006",
        check_name="Reverse Charge Mechanism (RCM) Flag",
        passed=rcm_correct,
        score_weight=10,
        issue_message=(
            "" if rcm_correct
            else (
                "Reverse Charge Mechanism (RCM) should be marked 'Yes' on this invoice "
                "but is currently set to 'No'."
                if reverse_charge_applicable
                else "RCM is marked 'Yes' on this invoice but is not applicable for this transaction type."
            )
        ),
        error_code="" if rcm_correct else "SMRITI-GST-HEALTH-006",
    ))

    # ----- Check 7: Round-off Amount Within Tolerance -----
    diff = abs(invoice_total_declared - sum_of_line_items)
    roundoff_ok = diff <= roundoff_tolerance
    checks.append(GSTHealthCheckItem(
        check_id="SMRITI-GST-HEALTH-007",
        check_name="Invoice Round-off Within Tolerance",
        passed=roundoff_ok,
        score_weight=10,
        issue_message=(
            "" if roundoff_ok
            else f"Invoice total Rs {invoice_total_declared} differs from computed "
                 f"line items sum Rs {sum_of_line_items} by Rs {diff:.2f}, "
                 f"which exceeds the allowed tolerance of Rs {roundoff_tolerance}."
        ),
        error_code="" if roundoff_ok else "SMRITI-GST-HEALTH-007",
    ))

    # ----- Compute Final Score -----
    pass_count = sum(1 for c in checks if c.passed)
    fail_count = len(checks) - pass_count
    total_deduction = sum(c.score_weight for c in checks if not c.passed)
    score = max(0, 100 - total_deduction)

    issues = [c.issue_message for c in checks if not c.passed and c.issue_message]
    recommendations = []
    for c in checks:
        if not c.passed:
            if c.check_id == "SMRITI-GST-HEALTH-001":
                recommendations.append("Verify and correct the supplier GSTIN before filing.")
            elif c.check_id == "SMRITI-GST-HEALTH-002":
                recommendations.append("Add a valid HSN/SAC code to all invoice line items.")
            elif c.check_id == "SMRITI-GST-HEALTH-003":
                recommendations.append("Amend the invoice date or file in the correct return period.")
            elif c.check_id == "SMRITI-GST-HEALTH-004":
                recommendations.append("Correct the tax rate to a valid GST council notified slab.")
            elif c.check_id == "SMRITI-GST-HEALTH-005":
                recommendations.append("Verify Place of Supply and buyer state code alignment.")
            elif c.check_id == "SMRITI-GST-HEALTH-006":
                recommendations.append("Correct the Reverse Charge Mechanism (RCM) flag.")
            elif c.check_id == "SMRITI-GST-HEALTH-007":
                recommendations.append("Reconcile line items total with invoice declared total.")

    return GSTHealthScore(
        score=score,
        pass_count=pass_count,
        fail_count=fail_count,
        total_checks=len(checks),
        is_filing_ready=(score == 100),
        checks=checks,
        issues=issues,
        recommendations=recommendations,
    )
