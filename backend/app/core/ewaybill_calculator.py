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

"""
SMRITI Indian Statutory Compliance Core Layer - GST E-WayBill Distance & Validity Calculator
Conforms to Rule 138(10) of CGST Rules, 2017 (Amended FY 2021-22 & 2024).

Statutory Validity Rules:
1. Normal Cargo:
   - Up to 200 km: 1 Day
   - For every additional 200 km or part thereof: +1 Additional Day
2. Over Dimensional Cargo (ODC) / Multimodal Ship Cargo:
   - Up to 20 km: 1 Day
   - For every additional 20 km or part thereof: +1 Additional Day

Expiry calculation: E-WayBill validity expires at midnight of the last validity day.
"""

import math
import datetime
from dataclasses import dataclass
from typing import Optional


@dataclass
class EWayBillValidityResult:
    distance_km: float
    is_odc: bool
    validity_days: int
    dispatch_at: datetime.datetime
    expires_at: datetime.datetime
    statutory_rule: str
    is_expired: bool = False


def calculate_ewaybill_validity(
    distance_km: float,
    is_odc: bool = False,
    dispatch_at: Optional[datetime.datetime] = None,
) -> EWayBillValidityResult:
    """
    Calculate statutory E-WayBill validity period according to NIC GST Rule 138(10).

    Args:
        distance_km: Transit distance in kilometers
        is_odc: True if Over-Dimensional Cargo or Multimodal Ship shipment
        dispatch_at: Dispatch timestamp (defaults to current UTC/IST time)

    Returns:
        EWayBillValidityResult containing calculated validity days and exact midnight expiry timestamp.
    """
    if distance_km <= 0:
        raise ValueError("Distance must be a positive number greater than 0 km.")

    dispatch_at = dispatch_at or datetime.datetime.now()

    if is_odc:
        # ODC: 1 day per 20 km or part thereof
        validity_days = math.ceil(distance_km / 20.0)
        rule_desc = "Rule 138(10) ODC/Multimodal Cargo (20 km/day)"
    else:
        # Normal Cargo: 1 day per 200 km or part thereof
        validity_days = math.ceil(distance_km / 200.0)
        rule_desc = "Rule 138(10) Standard Cargo (200 km/day)"

    # E-WayBill validity starts from the time of generation and expires at midnight (23:59:59)
    # on the N-th day after generation.
    base_date = dispatch_at.date() + datetime.timedelta(days=validity_days)
    expires_at = datetime.datetime.combine(base_date, datetime.time(23, 59, 59))

    is_expired = datetime.datetime.now() > expires_at

    return EWayBillValidityResult(
        distance_km=distance_km,
        is_odc=is_odc,
        validity_days=validity_days,
        dispatch_at=dispatch_at,
        expires_at=expires_at,
        statutory_rule=rule_desc,
        is_expired=is_expired,
    )
