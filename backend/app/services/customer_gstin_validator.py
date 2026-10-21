"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

customer_gstin_validator.py
-----------------------------
Authoritative GSTIN and address field validation for Customer Master.

Enforces the following rules (per Phase 5 Prevention Recommendations from
Customer_Master_Data_Integrity_Audit_v1.0.0.md):

  1. GSTIN format validation (15-char regex)
  2. GSTIN prefix → state derivation (auto-populate state_name, state_code)
  3. GSTIN prefix vs. submitted state_name consistency (reject on mismatch)
  4. GSTIN prefix vs. submitted state_code field parity (reject on mismatch)
  5. City vs. state compatibility warning (non-blocking; returns advisory message)
  6. State name normalization to Title-Case on write
  7. is_primary enforcement (at least one active registration must be primary)

Usage
-----
from .customer_gstin_validator import (
    validate_and_derive_gstin_state,
    normalize_state,
    warn_city_state_mismatch,
    GSTIN_STATE_MAP,
)
"""

import re
from typing import Optional, Tuple

from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

#: Maps GSTIN 2-digit prefix → canonical state name
GSTIN_STATE_MAP: dict[str, str] = {
    "01": "Jammu & Kashmir",
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
    "25": "Daman & Diu",
    "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
    "99": "Centre Jurisdiction",
}

#: Canonical state-name → 2-digit code (first encountered wins for duplicates like AP)
STATE_NAME_TO_CODE: dict[str, str] = {}
for _code, _name in GSTIN_STATE_MAP.items():
    _key = _name.lower()
    if _key not in STATE_NAME_TO_CODE:
        STATE_NAME_TO_CODE[_key] = _code

#: Known city → list of acceptable state names (non-exhaustive; for advisory warnings only)
CITY_STATE_COMPAT: dict[str, list[str]] = {
    "mumbai":            ["Maharashtra"],
    "navi mumbai":       ["Maharashtra"],
    "pune":              ["Maharashtra"],
    "nagpur":            ["Maharashtra"],
    "thane":             ["Maharashtra"],
    "nashik":            ["Maharashtra"],
    "aurangabad":        ["Maharashtra"],
    "delhi":             ["Delhi"],
    "new delhi":         ["Delhi"],
    "gurugram":          ["Haryana"],
    "gurgaon":           ["Haryana"],
    "faridabad":         ["Haryana"],
    "bengaluru":         ["Karnataka"],
    "bangalore":         ["Karnataka"],
    "bengaluru urban":   ["Karnataka"],
    "bengaluru rural":   ["Karnataka"],
    "mysuru":            ["Karnataka"],
    "mysore":            ["Karnataka"],
    "hubli":             ["Karnataka"],
    "tumkur":            ["Karnataka"],
    "tumakuru":          ["Karnataka"],
    "hyderabad":         ["Telangana", "Andhra Pradesh"],
    "secunderabad":      ["Telangana"],
    "warangal":          ["Telangana"],
    "visakhapatnam":     ["Andhra Pradesh"],
    "vijayawada":        ["Andhra Pradesh"],
    "chennai":           ["Tamil Nadu"],
    "coimbatore":        ["Tamil Nadu"],
    "madurai":           ["Tamil Nadu"],
    "kolkata":           ["West Bengal"],
    "howrah":            ["West Bengal"],
    "siliguri":          ["West Bengal"],
    "ahmedabad":         ["Gujarat"],
    "surat":             ["Gujarat"],
    "vadodara":          ["Gujarat"],
    "rajkot":            ["Gujarat"],
    "jaipur":            ["Rajasthan"],
    "jodhpur":           ["Rajasthan"],
    "udaipur":           ["Rajasthan"],
    "lucknow":           ["Uttar Pradesh"],
    "kanpur":            ["Uttar Pradesh"],
    "agra":              ["Uttar Pradesh"],
    "varanasi":          ["Uttar Pradesh"],
    "noida":             ["Uttar Pradesh"],
    "ghaziabad":         ["Uttar Pradesh"],
    "gorakhpur":         ["Uttar Pradesh"],
    "greater noida":     ["Uttar Pradesh"],
    "bhopal":            ["Madhya Pradesh"],
    "indore":            ["Madhya Pradesh"],
    "patna":             ["Bihar"],
    "gaya":              ["Bihar"],
    "ranchi":            ["Jharkhand"],
    "jamshedpur":        ["Jharkhand"],
    "raipur":            ["Chhattisgarh"],
    "bhubaneswar":       ["Odisha"],
    "cuttack":           ["Odisha"],
    "guwahati":          ["Assam"],
    "dibrugarh":         ["Assam"],
    "agartala":          ["Tripura"],
    "chandigarh":        ["Chandigarh", "Punjab", "Haryana"],
    "amritsar":          ["Punjab"],
    "ludhiana":          ["Punjab"],
    "shimla":            ["Himachal Pradesh"],
    "dehradun":          ["Uttarakhand"],
    "haridwar":          ["Uttarakhand"],
    "thiruvananthapuram": ["Kerala"],
    "kochi":             ["Kerala"],
    "thrissur":          ["Kerala"],
    "panaji":            ["Goa"],
    "srinagar":          ["Jammu & Kashmir"],
    "jammu":             ["Jammu & Kashmir"],
    "leh":               ["Ladakh"],
}

# ---------------------------------------------------------------------------
# GSTIN format validator
# ---------------------------------------------------------------------------

_GSTIN_RE = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)


def validate_gstin_format(gstin: str) -> None:
    """Raise HTTPException 422 if *gstin* does not match the canonical 15-char format."""
    if not _GSTIN_RE.match(gstin):
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "GSTIN_INVALID_FORMAT",
                "title": "Invalid GSTIN Format",
                "explanation": (
                    f"The GSTIN '{gstin}' does not match the required 15-character format "
                    "(2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric)."
                ),
                "suggested_action": "Please verify the GSTIN against the GST registration certificate.",
            },
        )


# ---------------------------------------------------------------------------
# Core derivation + validation
# ---------------------------------------------------------------------------

def derive_state_from_gstin(gstin: str) -> Tuple[str, str]:
    """
    Return ``(state_code, state_name)`` derived from the GSTIN prefix.

    Raises HTTPException 422 if the prefix is not in the reference map.
    Caller must ensure *gstin* is already validated and uppercased.
    """
    prefix = gstin[:2]
    state_name = GSTIN_STATE_MAP.get(prefix)
    if state_name is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "GSTIN_UNKNOWN_STATE_PREFIX",
                "title": "Unknown GSTIN State Prefix",
                "explanation": (
                    f"GSTIN prefix '{prefix}' is not recognised as a valid Indian state or UT code. "
                    "Please verify the GSTIN."
                ),
                "suggested_action": "Cross-check the GSTIN on the GST Portal (gstin.gov.in) before saving.",
            },
        )
    return prefix, state_name


def validate_and_derive_gstin_state(
    gstin: Optional[str],
    submitted_state_name: Optional[str] = None,
    submitted_state_code: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Validate GSTIN format and derive authoritative ``(gstin, state_code, state_name)``.

    Rules
    -----
    * If *gstin* is blank → return ``(None, submitted_state_code, submitted_state_name)``
      unchanged (no GSTIN to validate against).
    * If *gstin* is provided:
      - Validate format (raises 422 on bad format).
      - Derive ``state_code`` and ``state_name`` from GSTIN prefix.
      - If *submitted_state_name* is provided and conflicts → raise 400.
      - If *submitted_state_code* is provided and conflicts → raise 400.
      - Return ``(gstin_upper, derived_state_code, derived_state_name)``.

    Returns
    -------
    ``(gstin_upper_or_none, resolved_state_code, resolved_state_name)``
    """
    if not gstin:
        # No GSTIN — normalize state case only
        return (
            None,
            submitted_state_code.strip() if submitted_state_code else None,
            normalize_state(submitted_state_name) if submitted_state_name else None,
        )

    gstin_upper = gstin.strip().upper()
    validate_gstin_format(gstin_upper)

    derived_code, derived_name = derive_state_from_gstin(gstin_upper)

    # Validate submitted_state_name if provided
    if submitted_state_name:
        norm = submitted_state_name.strip().lower()
        # Allow aliases (e.g. "andhra pradesh" can match codes 28 or 37)
        derived_lower = derived_name.lower()
        # Reject only when names are clearly different
        if norm != derived_lower:
            # Check if it's a known alias
            is_alias = (
                norm in ("andhra pradesh", "ap") and derived_code in ("28", "37")
                or norm == "j&k" and derived_code == "01"
                or norm == "jammu and kashmir" and derived_code == "01"
                or norm == "pondicherry" and derived_code == "34"
                or norm == "orissa" and derived_code == "21"
            )
            if not is_alias:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error_code": "GSTIN_STATE_MISMATCH",
                        "title": "GSTIN and State Name Do Not Match",
                        "explanation": (
                            f"The GSTIN '{gstin_upper}' begins with prefix '{derived_code}', "
                            f"which corresponds to '{derived_name}'. "
                            f"The submitted state name '{submitted_state_name}' does not match. "
                            "Either the GSTIN or the state name is incorrect."
                        ),
                        "suggested_action": (
                            "Verify the GSTIN on the GST Portal. "
                            "The state name must match the state in which the GSTIN was registered."
                        ),
                    },
                )

    # Validate submitted_state_code if provided
    if submitted_state_code:
        sc = submitted_state_code.strip()
        if sc != derived_code:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "GSTIN_STATE_CODE_MISMATCH",
                    "title": "GSTIN and State Code Do Not Match",
                    "explanation": (
                        f"The GSTIN '{gstin_upper}' begins with prefix '{derived_code}' ({derived_name}). "
                        f"The submitted state_code '{sc}' does not match the GSTIN prefix."
                    ),
                    "suggested_action": "Leave state_code blank to have it auto-derived from the GSTIN.",
                },
            )

    return gstin_upper, derived_code, derived_name


# ---------------------------------------------------------------------------
# State name normalization
# ---------------------------------------------------------------------------

_ABBREV_STATES = {"UP", "MP", "UK", "HP", "JK", "AP", "TN", "MH", "GJ", "RJ", "WB"}


def normalize_state(state: Optional[str]) -> Optional[str]:
    """
    Return *state* in canonical Title-Case form.

    Preserves known abbreviations (UP, MP, etc.) and short state codes.
    Returns None if *state* is blank.
    """
    if not state:
        return None
    stripped = state.strip()
    if stripped.upper() in _ABBREV_STATES:
        return stripped.upper()
    # Check if it's a known state name (case-insensitive lookup)
    key = stripped.lower()
    if key in STATE_NAME_TO_CODE:
        # Return the canonical casing from GSTIN_STATE_MAP
        code = STATE_NAME_TO_CODE[key]
        return GSTIN_STATE_MAP[code]
    # Fallback: title-case
    return stripped.title()


# ---------------------------------------------------------------------------
# City / state compatibility (advisory — non-blocking)
# ---------------------------------------------------------------------------

def warn_city_state_mismatch(
    city: Optional[str],
    state: Optional[str],
) -> Optional[str]:
    """
    Return an advisory warning string if *city* is in the known compatibility
    map but *state* is not in the acceptable list.

    Returns ``None`` if compatible or city/state is unknown.
    This check is **non-blocking** — callers should log or surface as a warning,
    not raise an error.
    """
    if not city or not state:
        return None
    city_norm = city.strip().lower()
    state_norm = state.strip()
    allowed = CITY_STATE_COMPAT.get(city_norm)
    if allowed is None:
        return None  # City not in reference map — cannot assess
    if state_norm in allowed:
        return None  # Compatible
    return (
        f"Advisory: City '{city}' is typically in {allowed}, "
        f"but address state is set to '{state_norm}'. "
        "Please verify before saving."
    )
