"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Tuple

# Indian GST State Code Directory (01 to 38 + Other territories)
GST_STATE_CODES: Dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh (New)",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}

# Standard 15-character GSTIN Regex pattern
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def validate_gstin(gstin: Optional[str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates Indian GSTIN format and extracts state code & state name.
    Returns: (is_valid, state_code, state_name)
    """
    if not gstin or not isinstance(gstin, str):
        return False, None, None

    cleaned = gstin.strip().upper()
    if not GSTIN_REGEX.match(cleaned):
        return False, None, None

    state_code = cleaned[:2]
    state_name = GST_STATE_CODES.get(state_code, "Unknown State")
    return True, state_code, state_name


def extract_state_code_from_gstin(gstin: Optional[str]) -> Optional[str]:
    """Extracts 2-digit state code from GSTIN if valid."""
    if not gstin:
        return None
    cleaned = gstin.strip().upper()
    if len(cleaned) >= 2 and cleaned[:2] in GST_STATE_CODES:
        return cleaned[:2]
    return None


def round_currency(val: Decimal) -> Decimal:
    """Rounds to 2 decimal places using standard financial round-half-up."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_line_item_tax(
    unit_price: Decimal,
    quantity: Decimal,
    discount_amount: Decimal,
    gst_rate: Decimal,
    is_tax_inclusive: bool,
    is_interstate: bool,
) -> Dict[str, Decimal]:
    """
    Computes exact line-level taxable value, tax split (CGST+SGST or IGST), and total amount.
    
    Formulas:
    - Tax Inclusive (MRP):
        Gross Total = (unit_price * quantity) - discount_amount
        Taxable Value = Gross Total / (1 + (gst_rate / 100))
        Tax Total = Gross Total - Taxable Value
    - Tax Exclusive (Base Rate):
        Taxable Value = (unit_price * quantity) - discount_amount
        Tax Total = Taxable Value * (gst_rate / 100)
        Gross Total = Taxable Value + Tax Total
    """
    unit_price = Decimal(str(unit_price))
    quantity = Decimal(str(quantity))
    discount_amount = Decimal(str(discount_amount or "0.00"))
    gst_rate = Decimal(str(gst_rate or "0.00"))

    if is_tax_inclusive:
        gross_total = (unit_price * quantity) - discount_amount
        if gst_rate > 0:
            divisor = Decimal("1.00") + (gst_rate / Decimal("100.00"))
            taxable_value = gross_total / divisor
            tax_total = gross_total - taxable_value
        else:
            taxable_value = gross_total
            tax_total = Decimal("0.00")
    else:
        taxable_value = (unit_price * quantity) - discount_amount
        if gst_rate > 0:
            tax_total = taxable_value * (gst_rate / Decimal("100.00"))
        else:
            tax_total = Decimal("0.00")
        gross_total = taxable_value + tax_total

    taxable_val_rounded = round_currency(taxable_value)
    tax_total_rounded = round_currency(tax_total)
    gross_total_rounded = round_currency(gross_total)

    # Tax Split based on jurisdiction
    if is_interstate:
        cgst_amt = Decimal("0.00")
        sgst_amt = Decimal("0.00")
        igst_amt = tax_total_rounded
    else:
        half_tax = round_currency(tax_total_rounded / Decimal("2.00"))
        cgst_amt = half_tax
        # Adjust remainder to prevent 1-paisa rounding divergence
        sgst_amt = tax_total_rounded - half_tax
        igst_amt = Decimal("0.00")

    return {
        "taxable_value": taxable_val_rounded,
        "tax_amount": tax_total_rounded,
        "cgst_amount": cgst_amt,
        "sgst_amount": sgst_amt,
        "igst_amount": igst_amt,
        "total_amount": gross_total_rounded,
    }


def determine_gstr1_table(
    is_registered_b2b: bool,
    is_interstate: bool,
    invoice_grand_total: Decimal,
) -> str:
    """
    Determines statutory GSTR-1 classification table:
    - 'B2B' (Table 4A): Registered buyers (Intra or Inter)
    - 'B2CL' (Table 5A): Unregistered buyers, Inter-State, > ₹2.5 Lakh
    - 'B2CS' (Table 7): Unregistered buyers, Intra-State OR Inter-State <= ₹2.5 Lakh
    """
    if is_registered_b2b:
        return "B2B"
    if is_interstate and Decimal(str(invoice_grand_total)) > Decimal("250000.00"):
        return "B2CL"
    return "B2CS"
