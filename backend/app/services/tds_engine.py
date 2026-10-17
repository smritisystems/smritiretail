# -*- coding: utf-8 -*-
"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.51.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
"""

import re
from decimal import Decimal
from typing import Optional
from ..schemas.tds import TdsCalculationResult

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


class StatutoryTdsEngine:
    """
    Authoritative Indian Statutory Withholding Tax (TDS) Engine.
    Implements compliance rules under the Income Tax Act, 1961:
    - Section 194Q: Purchase of Goods (0.10% standard, 5.00% non-PAN)
    - Section 194C: Contractor payments (1.00% Ind/HUF, 2.00% Co/Firm, 20.00% non-PAN)
    - Section 194J: Professional & Technical fees (2.00% / 10.00%, 20.00% non-PAN)
    - Section 194H: Commission & Brokerage (5.00%, 20.00% non-PAN)
    - Section 206AA: Higher withholding rate for failure to furnish PAN
    """

    @staticmethod
    def is_valid_pan(pan: Optional[str]) -> bool:
        if not pan:
            return False
        clean = pan.strip().upper()
        return bool(PAN_REGEX.match(clean))

    validate_pan = is_valid_pan

    @staticmethod
    def is_company_or_firm_pan(pan: Optional[str]) -> Optional[bool]:
        if not pan or len(pan.strip()) < 4:
            return None
        char4 = pan.strip().upper()[3]
        if char4 in ("C", "F", "L", "A", "T", "B"):
            return True
        if char4 in ("P", "H"):
            return False
        return None

    @classmethod
    def calculate_tds(
        cls,
        gross_amount: Decimal,
        section: str = "194Q",
        pan: Optional[str] = None,
        is_company_or_firm: Optional[bool] = None,
        custom_rate: Optional[Decimal] = None,
    ) -> TdsCalculationResult:
        """
        Calculates statutory TDS deduction, determining statutory rate, penal rate applicability,
        net payable amount, and legal provision reference.
        """
        sec = (section or "194Q").strip().upper()
        gross = Decimal(str(gross_amount)).quantize(Decimal("0.01"))
        valid_pan = cls.is_valid_pan(pan)

        if is_company_or_firm is None and valid_pan:
            is_company_or_firm = cls.is_company_or_firm_pan(pan)

        is_penal = False
        rate: Decimal

        if custom_rate is not None and custom_rate >= Decimal("0.00"):
            rate = Decimal(str(custom_rate)).quantize(Decimal("0.01"))
            provision = f"Custom Certificate Rate under Section {sec}"
        elif sec == "194Q":
            if not valid_pan:
                rate = Decimal("5.00")
                is_penal = True
                provision = "Section 194Q read with Section 206AA (Higher Penal Rate: 5% due to Missing/Invalid PAN)"
            else:
                rate = Decimal("0.10")
                provision = "Section 194Q: TDS on Purchase of Goods (Standard Rate: 0.10%)"
        elif sec == "194C":
            if not valid_pan:
                rate = Decimal("20.00")
                is_penal = True
                provision = "Section 194C read with Section 206AA (Higher Penal Rate: 20% due to Missing/Invalid PAN)"
            elif is_company_or_firm:
                rate = Decimal("2.00")
                provision = "Section 194C: TDS on Contractor Payments (Company/Firm Rate: 2.00%)"
            else:
                rate = Decimal("1.00")
                provision = "Section 194C: TDS on Contractor Payments (Individual/HUF Rate: 1.00%)"
        elif sec == "194J":
            if not valid_pan:
                rate = Decimal("20.00")
                is_penal = True
                provision = "Section 194J read with Section 206AA (Higher Penal Rate: 20% due to Missing/Invalid PAN)"
            else:
                rate = Decimal("2.00")
                provision = "Section 194J: TDS on Technical Services (Standard Rate: 2.00%)"
        elif sec == "194H":
            if not valid_pan:
                rate = Decimal("20.00")
                is_penal = True
                provision = "Section 194H read with Section 206AA (Higher Penal Rate: 20% due to Missing/Invalid PAN)"
            else:
                rate = Decimal("5.00")
                provision = "Section 194H: TDS on Commission or Brokerage (Standard Rate: 5.00%)"
        else:
            # Fallback default
            rate = Decimal("0.10") if valid_pan else Decimal("5.00")
            is_penal = not valid_pan
            provision = f"Statutory Withholding under Section {sec}"

        tds_amount = ((gross * rate) / Decimal("100.00")).quantize(Decimal("0.01"))
        net_payable = max(Decimal("0.00"), gross - tds_amount).quantize(Decimal("0.01"))

        return TdsCalculationResult(
            gross_amount=gross,
            section=sec,
            pan=pan.strip().upper() if pan else None,
            has_valid_pan=valid_pan,
            rate_percentage=rate,
            tds_amount=tds_amount,
            net_payable=net_payable,
            is_penal_rate=is_penal,
            legal_provision=provision,
        )
