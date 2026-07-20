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
SMRITI Indian Compliance Core Layer (ICCL) - UPI Payment Reference Validator

UPI (Unified Payments Interface) is the dominant payment mode in Indian retail.
This module validates:
1. VPA (Virtual Payment Address): user@handle format
2. UPI Transaction Reference ID: 12-character alphanumeric
3. UPI Amount: Positive, within UPI per-transaction limit (Rs 1,00,000)

SMRITI Error Codes:
- SMRITI-UPI-001: Invalid VPA format
- SMRITI-UPI-002: Invalid UPI Transaction Reference ID format
- SMRITI-UPI-003: Amount exceeds UPI per-transaction limit
"""

import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

# UPI per-transaction limit in INR (as per NPCI guidelines, FY 2025-26)
UPI_MAX_TRANSACTION_LIMIT = Decimal("100000.00")  # Rs 1,00,000

# Known UPI handles (PSP handles registered with NPCI)
_KNOWN_UPI_HANDLES = {
    "paytm", "ybl", "okaxis", "oksbi", "okicici", "okhdfcbank",
    "ibl", "upi", "axisb", "sbi", "icici", "hdfc", "kotak",
    "apl", "pnb", "bob", "federal", "unionbank", "canarabank",
    "barodampay", "indus", "idfcbank", "rbl", "yesbank",
    "goaxis", "postpaid", "amazonpay", "jiomoney", "freecharge",
    "mobikwik", "airtel", "phonepe", "gpay", "superpe",
}

# VPA format: localpart@handle
# localpart: alphanumeric, dots, hyphens, underscores (3-64 chars)
# handle: alphanumeric (2-32 chars)
_VPA_PATTERN = re.compile(
    r"^[a-zA-Z0-9.\-_]{3,64}@[a-zA-Z0-9]{2,32}$"
)

# UPI Transaction Reference ID: 12 alphanumeric characters
_UPI_REF_PATTERN = re.compile(r"^[a-zA-Z0-9]{12}$")


@dataclass
class VPAValidationResult:
    is_valid: bool
    vpa: str
    local_part: str
    handle: str
    is_known_handle: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class UPIRefValidationResult:
    is_valid: bool
    ref_id: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class UPIAmountValidationResult:
    is_valid: bool
    amount: Decimal
    limit: Decimal
    error_code: Optional[str] = None
    error_message: Optional[str] = None


def validate_vpa(vpa: str) -> VPAValidationResult:
    """
    Validate a UPI Virtual Payment Address (VPA).

    Args:
        vpa: VPA string e.g. 'merchant@hdfc' or 'user@ybl'

    Returns:
        VPAValidationResult
    """
    vpa = str(vpa).strip().lower()

    if not _VPA_PATTERN.match(vpa):
        return VPAValidationResult(
            is_valid=False,
            vpa=vpa,
            local_part="",
            handle="",
            is_known_handle=False,
            error_code="SMRITI-UPI-001",
            error_message=(
                f"Invalid UPI VPA format: '{vpa}'. "
                "Expected format: localpart@handle (e.g., merchant@hdfc)"
            ),
        )

    local_part, handle = vpa.rsplit("@", 1)
    is_known = handle in _KNOWN_UPI_HANDLES

    return VPAValidationResult(
        is_valid=True,
        vpa=vpa,
        local_part=local_part,
        handle=handle,
        is_known_handle=is_known,
    )


def validate_upi_ref_id(ref_id: str) -> UPIRefValidationResult:
    """
    Validate a UPI Transaction Reference ID (UTR / NPCI Ref).

    Args:
        ref_id: 12-character alphanumeric transaction reference ID

    Returns:
        UPIRefValidationResult
    """
    ref_id = str(ref_id).strip()

    if not _UPI_REF_PATTERN.match(ref_id):
        return UPIRefValidationResult(
            is_valid=False,
            ref_id=ref_id,
            error_code="SMRITI-UPI-002",
            error_message=(
                f"Invalid UPI Transaction Reference ID: '{ref_id}'. "
                "Expected: 12-character alphanumeric string."
            ),
        )

    return UPIRefValidationResult(is_valid=True, ref_id=ref_id)


def validate_upi_amount(amount: Decimal) -> UPIAmountValidationResult:
    """
    Validate a UPI payment amount against NPCI per-transaction limit.

    Args:
        amount: Transaction amount in INR

    Returns:
        UPIAmountValidationResult
    """
    if amount <= Decimal("0"):
        return UPIAmountValidationResult(
            is_valid=False,
            amount=amount,
            limit=UPI_MAX_TRANSACTION_LIMIT,
            error_code="SMRITI-UPI-003",
            error_message="UPI transaction amount must be greater than zero.",
        )

    if amount > UPI_MAX_TRANSACTION_LIMIT:
        return UPIAmountValidationResult(
            is_valid=False,
            amount=amount,
            limit=UPI_MAX_TRANSACTION_LIMIT,
            error_code="SMRITI-UPI-003",
            error_message=(
                f"UPI amount Rs {amount} exceeds the per-transaction limit "
                f"of Rs {UPI_MAX_TRANSACTION_LIMIT}. "
                "Please use NEFT/IMPS for higher-value transactions."
            ),
        )

    return UPIAmountValidationResult(
        is_valid=True,
        amount=amount,
        limit=UPI_MAX_TRANSACTION_LIMIT,
    )
