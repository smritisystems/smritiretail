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
SMRITI Indian Compliance Core Layer (ICCL) - GS1 Barcode Parser

Parses GS1-128, GS1 DataMatrix, and GS1 QR structured data using
GS1 Application Identifiers (AIs).

Supported Application Identifiers:
  AI-00 : SSCC (Serial Shipping Container Code) - 18 digits
  AI-01 : GTIN (Global Trade Item Number) - 14 digits
  AI-02 : GTIN of contained trade items - 14 digits
  AI-10 : Batch/Lot Number - variable length, max 20 chars
  AI-11 : Production Date - YYMMDD
  AI-13 : Packaging Date - YYMMDD
  AI-15 : Best Before Date - YYMMDD
  AI-17 : Expiry/Use-By Date - YYMMDD
  AI-21 : Serial Number - variable length, max 20 chars
  AI-22 : Consumer product variant - variable length
  AI-30 : Variable count of items
  AI-37 : Count of trade items - variable
  AI-310n: Net weight (kg) - 6 digits with n implied decimals
  AI-320n: Net weight (lb) - 6 digits with n implied decimals
  AI-3100-3105: Net weight kg with 0-5 implied decimal places
  AI-91 to AI-99: Company internal information

Indian Retail Context:
  - GS1 India barcodes on FMCG, pharma, apparel track expiry + batch
  - Drug Technical Advisory Board (DTAB) mandates GS1 on pharmaceutical packaging
  - FSSAI mandates batch + expiry on food products
  - E-Way Bill can reference SSCC for pallet-level tracking
"""

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


@dataclass
class GS1ParsedData:
    """Structured data extracted from a GS1 barcode."""
    raw_barcode: str
    sscc: Optional[str] = None                    # AI-00: Serial Shipping Container
    gtin: Optional[str] = None                    # AI-01: Product identifier
    contained_gtin: Optional[str] = None          # AI-02
    batch_number: Optional[str] = None            # AI-10
    production_date: Optional[date] = None        # AI-11
    packaging_date: Optional[date] = None         # AI-13
    best_before_date: Optional[date] = None       # AI-15
    expiry_date: Optional[date] = None            # AI-17
    serial_number: Optional[str] = None           # AI-21
    net_weight_kg: Optional[Decimal] = None       # AI-3100-3105
    item_count: Optional[int] = None              # AI-37
    company_internal: dict = field(default_factory=dict)  # AI-91 to AI-99
    parse_errors: list[str] = field(default_factory=list)
    is_valid: bool = True

    @property
    def is_expired(self) -> bool:
        """True if expiry_date is set and is in the past."""
        if self.expiry_date:
            return self.expiry_date < date.today()
        return False

    @property
    def days_to_expiry(self) -> Optional[int]:
        """Days until expiry. Negative if expired. None if no expiry date."""
        if self.expiry_date:
            return (self.expiry_date - date.today()).days
        return None


# GS1 Application Identifier definitions
# Format: AI -> (name, length_type, length_or_range, has_fns)
# length_type: "fixed" | "variable"
# has_fns: whether AI uses FNC1 (Function Code 1) as terminator for variable-length
_AI_DEFINITIONS: dict[str, tuple[str, str, int]] = {
    "00": ("SSCC", "fixed", 18),
    "01": ("GTIN", "fixed", 14),
    "02": ("Contained GTIN", "fixed", 14),
    "10": ("Batch/Lot", "variable", 20),
    "11": ("Production Date", "fixed", 6),
    "13": ("Packaging Date", "fixed", 6),
    "15": ("Best Before Date", "fixed", 6),
    "17": ("Expiry Date", "fixed", 6),
    "21": ("Serial Number", "variable", 20),
    "22": ("Consumer Product Variant", "variable", 20),
    "30": ("Variable Count", "variable", 8),
    "37": ("Trade Item Count", "variable", 8),
}

# Weight AIs: AI-3100 to AI-3105 (net weight in kg, n implied decimal places)
_WEIGHT_AI_PATTERN = re.compile(r"^310(\d)(\d{6})")


def _parse_gs1_date(yymmdd: str) -> Optional[date]:
    """
    Parse a GS1 YYMMDD date string.
    Year 00-49 → 2000-2049, year 50-99 → 1950-1999.
    Day 00 = last day of the month (used for expiry 'best before end of month').
    """
    try:
        yy = int(yymmdd[:2])
        mm = int(yymmdd[2:4])
        dd = int(yymmdd[4:6])
        year = 2000 + yy if yy < 50 else 1900 + yy

        if dd == 0:
            # Last day of month
            if mm == 12:
                return date(year, 12, 31)
            return date(year, mm + 1, 1) - __import__("datetime").timedelta(days=1)

        return date(year, mm, dd)
    except (ValueError, IndexError):
        return None


def _validate_gtin_check_digit(gtin: str) -> bool:
    """Validate EAN-13 / GTIN-14 Luhn check digit."""
    if not gtin.isdigit() or len(gtin) not in (13, 14):
        return False
    digits = [int(c) for c in gtin]
    check = digits[-1]
    payload = digits[:-1]
    # Multiply alternating digits: for 13-digit, positions from right: odd=3, even=1
    total = 0
    for i, d in enumerate(reversed(payload)):
        total += d * 3 if i % 2 == 0 else d
    computed_check = (10 - (total % 10)) % 10
    return computed_check == check


def parse_gs1_barcode(raw: str) -> GS1ParsedData:
    """
    Parse a GS1 structured barcode string into named fields.

    Handles:
    - GS1-128 format: (AI)data(AI)data...
    - Bracket-delimited AIs: (01)12345678901234(10)LOT001(17)261231
    - FNC1-delimited: AIs separated by ASCII GS character (\\x1d) or grouped

    Args:
        raw: Raw barcode string from scanner

    Returns:
        GS1ParsedData with all extracted fields
    """
    result = GS1ParsedData(raw_barcode=raw)

    # Normalize: replace ASCII GS (FNC1 delimiter) with pipe for processing
    normalized = raw.strip().replace("\x1d", "|").replace("\x1e", "|")

    # Strategy 1: Bracket format (01)GTIN(10)BATCH(17)EXPIRY
    bracket_pattern = re.compile(r"\((\d{2,4})\)([^\(]*)")
    bracket_matches = bracket_pattern.findall(normalized)

    if bracket_matches:
        _apply_ai_matches(result, bracket_matches)
        return result

    # Strategy 2: FNC1 / pipe-separated segments
    segments = normalized.split("|")
    remaining = "".join(segments)

    # Try sequential AI parsing
    _parse_sequential(result, remaining)
    return result


def _apply_ai_matches(result: GS1ParsedData, matches: list[tuple[str, str]]) -> None:
    """Apply a list of (ai_code, value) pairs to the result dataclass."""
    for ai, value in matches:
        value = value.strip()
        _apply_single_ai(result, ai, value)


def _parse_sequential(result: GS1ParsedData, data: str) -> None:
    """Sequentially parse a flat GS1 data string by walking AI codes."""
    pos = 0
    while pos < len(data):
        # Try 2-digit AI first, then 3-digit, then 4-digit
        found = False
        for ai_len in (2, 3, 4):
            if pos + ai_len > len(data):
                continue
            candidate_ai = data[pos: pos + ai_len]

            # Check for weight AI pattern
            weight_match = _WEIGHT_AI_PATTERN.match(candidate_ai + data[pos + ai_len: pos + ai_len + 6] if len(data) > pos + ai_len + 5 else "")
            if weight_match and ai_len == 4:
                decimal_places = int(weight_match.group(1))
                raw_weight = weight_match.group(2)
                value_int = int(raw_weight)
                weight = Decimal(value_int) / Decimal(10 ** decimal_places)
                result.net_weight_kg = weight
                pos += 4 + 6
                found = True
                break

            if candidate_ai in _AI_DEFINITIONS:
                name, length_type, max_len = _AI_DEFINITIONS[candidate_ai]
                pos += ai_len
                if length_type == "fixed":
                    value = data[pos: pos + max_len]
                    pos += max_len
                else:
                    # Variable: take up to max_len or until non-alphanumeric boundary
                    end = min(pos + max_len, len(data))
                    value = data[pos:end]
                    pos = end
                _apply_single_ai(result, candidate_ai, value)
                found = True
                break

        if not found:
            pos += 1  # Skip unknown character


def _apply_single_ai(result: GS1ParsedData, ai: str, value: str) -> None:
    """Apply a single AI code + value to the result object."""
    value = value.strip()
    if ai == "00":
        result.sscc = value
    elif ai == "01":
        result.gtin = value
        if not _validate_gtin_check_digit(value):
            result.parse_errors.append(f"GTIN check digit invalid: {value}")
    elif ai == "02":
        result.contained_gtin = value
    elif ai == "10":
        result.batch_number = value
    elif ai == "11":
        result.production_date = _parse_gs1_date(value)
    elif ai == "13":
        result.packaging_date = _parse_gs1_date(value)
    elif ai == "15":
        result.best_before_date = _parse_gs1_date(value)
    elif ai == "17":
        result.expiry_date = _parse_gs1_date(value)
    elif ai == "21":
        result.serial_number = value
    elif ai in ("30", "37"):
        try:
            result.item_count = int(value)
        except ValueError:
            result.parse_errors.append(f"Invalid item count for AI-{ai}: {value}")
    elif ai.startswith("9") and ai[0] == "9":
        result.company_internal[f"AI-{ai}"] = value
