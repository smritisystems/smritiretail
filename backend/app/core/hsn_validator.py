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
SMRITI Indian Compliance Core Layer (ICCL) - HSN/SAC Validation Engine

HSN (Harmonized System of Nomenclature) codes are mandatory on GST invoices:
- 2-digit: Chapter (e.g., 01 = Live animals)
- 4-digit: Heading (e.g., 0101 = Live horses)
- 6-digit: Sub-heading (e.g., 010110 = Pure-bred breeding horses)
- 8-digit: Tariff Item (e.g., 01011010 = Breeding stallions)

SAC (Services Accounting Code) codes start with 99.
"""

import re
from dataclasses import dataclass
from typing import Optional

# GST rate band by HSN chapter (approximate slab classification)
# Source: GST Council notifications, FY 2025-26
_HSN_CHAPTER_TAX_BANDS: dict[str, str] = {
    # Chapters 01-24: Agriculture, Food & Beverages
    "01": "NIL/5%", "02": "NIL/5%/12%", "03": "NIL/5%/12%",
    "04": "NIL/5%/12%", "05": "NIL/5%", "06": "NIL/5%/12%",
    "07": "NIL/5%", "08": "NIL/5%/12%", "09": "NIL/5%/12%",
    "10": "NIL/5%", "11": "NIL/5%/12%", "12": "NIL/5%/12%",
    "13": "5%/12%", "14": "NIL/5%", "15": "NIL/5%/12%/18%",
    "16": "12%/18%", "17": "NIL/5%/12%/18%", "18": "5%/18%/28%",
    "19": "NIL/5%/12%/18%", "20": "12%/18%/28%", "21": "5%/12%/18%/28%",
    "22": "NIL/18%/28%", "23": "NIL/5%/18%", "24": "NIL/28%",
    # Chapters 25-27: Minerals, Fuels
    "25": "NIL/5%/18%", "26": "NIL/5%/18%", "27": "NIL/5%/12%/18%",
    # Chapters 28-40: Chemicals, Plastics
    "28": "5%/12%/18%/28%", "29": "5%/12%/18%", "30": "5%/12%",
    "31": "NIL/5%/12%", "32": "18%", "33": "5%/12%/18%/28%",
    "34": "18%/28%", "35": "5%/12%/18%", "36": "18%/28%",
    "37": "18%/28%", "38": "12%/18%/28%", "39": "12%/18%/28%",
    "40": "5%/18%/28%",
    # Chapters 41-43: Leather
    "41": "5%", "42": "18%/28%", "43": "12%/18%",
    # Chapters 44-49: Wood, Paper
    "44": "NIL/5%/12%/18%/28%", "45": "12%/18%", "46": "12%/18%",
    "47": "12%/18%", "48": "12%/18%", "49": "NIL/12%",
    # Chapters 50-63: Textiles
    "50": "5%/12%", "51": "5%/12%", "52": "5%/12%", "53": "5%/12%",
    "54": "5%/12%/18%", "55": "5%/12%", "56": "12%/18%",
    "57": "5%/12%/28%", "58": "5%/12%", "59": "12%/18%",
    "60": "5%/12%", "61": "5%/12%", "62": "5%/12%",
    "63": "5%/12%/18%",
    # Chapters 64-67: Footwear, Headgear
    "64": "5%/18%/28%", "65": "5%/18%", "66": "12%/18%", "67": "12%/18%",
    # Chapters 68-70: Stone, Ceramics, Glass
    "68": "5%/12%/18%/28%", "69": "5%/12%/18%/28%", "70": "12%/18%/28%",
    # Chapters 71-83: Metals, Jewellery
    "71": "3%/5%/18%", "72": "5%/18%", "73": "5%/12%/18%/28%",
    "74": "5%/18%", "75": "5%/18%", "76": "5%/18%/28%",
    "78": "5%/18%", "79": "5%/18%", "80": "5%/18%",
    "81": "5%/18%", "82": "12%/18%/28%", "83": "12%/18%/28%",
    # Chapters 84-85: Machinery, Electronics
    "84": "5%/12%/18%/28%", "85": "5%/12%/18%/28%",
    # Chapters 86-89: Transport
    "86": "5%/12%/18%/28%", "87": "5%/12%/18%/28%",
    "88": "5%/18%/28%", "89": "5%/18%/28%",
    # Chapters 90-99: Instruments, Miscellaneous
    "90": "12%/18%/28%", "91": "18%/28%", "92": "18%/28%",
    "93": "18%/28%", "94": "5%/12%/18%/28%", "95": "12%/18%/28%",
    "96": "5%/12%/18%/28%", "97": "12%/28%", "98": "12%/28%",
    "99": "SAC/Services",
}


@dataclass
class HSNValidationResult:
    is_valid: bool
    code: str
    digits: int
    chapter: str
    tax_band: str
    is_service: bool
    error_message: Optional[str] = None


def validate_hsn(code: str) -> HSNValidationResult:
    """
    Validate an HSN or SAC code.

    Args:
        code: HSN/SAC code string (2, 4, 6, or 8 digits)

    Returns:
        HSNValidationResult with validation details
    """
    code = str(code).strip().zfill(0)

    # Must be numeric
    if not re.fullmatch(r"\d{2,8}", code):
        return HSNValidationResult(
            is_valid=False,
            code=code,
            digits=len(code),
            chapter="",
            tax_band="Unknown",
            is_service=False,
            error_message=f"HSN code must be 2, 4, 6, or 8 numeric digits. Got: '{code}'",
        )

    # Must be 2, 4, 6, or 8 digits
    if len(code) not in (2, 4, 6, 8):
        return HSNValidationResult(
            is_valid=False,
            code=code,
            digits=len(code),
            chapter=code[:2] if len(code) >= 2 else "",
            tax_band="Unknown",
            is_service=False,
            error_message=f"HSN code must be exactly 2, 4, 6, or 8 digits. Got {len(code)} digits.",
        )

    chapter = code[:2]
    tax_band = _HSN_CHAPTER_TAX_BANDS.get(chapter, "Unknown")
    is_service = chapter == "99"

    if tax_band == "Unknown":
        return HSNValidationResult(
            is_valid=False,
            code=code,
            digits=len(code),
            chapter=chapter,
            tax_band="Unknown",
            is_service=False,
            error_message=f"HSN chapter '{chapter}' is not a recognized GST chapter.",
        )

    return HSNValidationResult(
        is_valid=True,
        code=code,
        digits=len(code),
        chapter=chapter,
        tax_band=tax_band,
        is_service=is_service,
    )


def get_hsn_description(chapter: str) -> str:
    """Return a brief chapter description for display in reports."""
    _DESCRIPTIONS = {
        "01": "Live Animals", "02": "Meat & Offal", "03": "Fish",
        "04": "Dairy, Eggs, Honey", "06": "Live Plants", "07": "Vegetables",
        "08": "Fruits & Nuts", "09": "Coffee, Tea, Spices", "10": "Cereals",
        "15": "Animal or Vegetable Fats", "16": "Preparations of Meat/Fish",
        "17": "Sugars", "18": "Cocoa & Preparations", "19": "Cereal Preparations",
        "20": "Preparations of Vegetables/Fruits", "21": "Miscellaneous Edible Preparations",
        "22": "Beverages, Spirits, Vinegar", "23": "Residues & Waste from Food Industries",
        "24": "Tobacco & Manufactured Substitutes",
        "30": "Pharmaceutical Products",
        "39": "Plastics & Articles thereof",
        "48": "Paper & Paperboard",
        "52": "Cotton", "61": "Knitted/Crocheted Clothing",
        "62": "Woven Clothing", "64": "Footwear", "85": "Electrical Machinery",
        "87": "Vehicles (except railway)", "94": "Furniture, Bedding",
        "99": "Services (SAC Codes)",
    }
    return _DESCRIPTIONS.get(chapter, f"Chapter {chapter}")
