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
SMRITI Indian Compliance Core Layer (ICCL) - Indian State Code Registry

Maps GST State Codes (01-38) to state/UT names, capitals, and regions.
Required for:
- GSTIN prefix validation (first 2 digits = state code)
- Place of Supply determination in GST invoices
- E-Invoice state code fields
- Intrastate vs Interstate supply determination

Source: GSTN State Code List (Form GST REG-01 Annexure I)
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class IndianState:
    code: str          # 2-digit GST state code (01-38)
    name: str          # Official state/UT name
    abbreviation: str  # 2-letter abbreviation
    capital: str       # Capital city
    region: str        # North / South / East / West / Northeast / UT
    is_ut: bool        # True if Union Territory


# Complete Indian State Registry (GST State Codes)
# Source: GSTN, as of FY 2025-26
_STATE_REGISTRY: list[IndianState] = [
    IndianState("01", "Jammu & Kashmir", "JK", "Srinagar/Jammu", "North", True),
    IndianState("02", "Himachal Pradesh", "HP", "Shimla", "North", False),
    IndianState("03", "Punjab", "PB", "Chandigarh", "North", False),
    IndianState("04", "Chandigarh", "CH", "Chandigarh", "North", True),
    IndianState("05", "Uttarakhand", "UK", "Dehradun", "North", False),
    IndianState("06", "Haryana", "HR", "Chandigarh", "North", False),
    IndianState("07", "Delhi", "DL", "New Delhi", "North", True),
    IndianState("08", "Rajasthan", "RJ", "Jaipur", "North", False),
    IndianState("09", "Uttar Pradesh", "UP", "Lucknow", "North", False),
    IndianState("10", "Bihar", "BR", "Patna", "East", False),
    IndianState("11", "Sikkim", "SK", "Gangtok", "Northeast", False),
    IndianState("12", "Arunachal Pradesh", "AR", "Itanagar", "Northeast", False),
    IndianState("13", "Nagaland", "NL", "Kohima", "Northeast", False),
    IndianState("14", "Manipur", "MN", "Imphal", "Northeast", False),
    IndianState("15", "Mizoram", "MZ", "Aizawl", "Northeast", False),
    IndianState("16", "Tripura", "TR", "Agartala", "Northeast", False),
    IndianState("17", "Meghalaya", "ML", "Shillong", "Northeast", False),
    IndianState("18", "Assam", "AS", "Dispur", "Northeast", False),
    IndianState("19", "West Bengal", "WB", "Kolkata", "East", False),
    IndianState("20", "Jharkhand", "JH", "Ranchi", "East", False),
    IndianState("21", "Odisha", "OD", "Bhubaneswar", "East", False),
    IndianState("22", "Chhattisgarh", "CG", "Raipur", "Central", False),
    IndianState("23", "Madhya Pradesh", "MP", "Bhopal", "Central", False),
    IndianState("24", "Gujarat", "GJ", "Gandhinagar", "West", False),
    IndianState("25", "Daman & Diu", "DD", "Daman", "West", True),
    IndianState("26", "Dadra & Nagar Haveli and Daman & Diu", "DN", "Silvassa", "West", True),
    IndianState("27", "Maharashtra", "MH", "Mumbai", "West", False),
    IndianState("28", "Andhra Pradesh", "AP", "Amaravati", "South", False),
    IndianState("29", "Karnataka", "KA", "Bengaluru", "South", False),
    IndianState("30", "Goa", "GA", "Panaji", "West", False),
    IndianState("31", "Lakshadweep", "LD", "Kavaratti", "South", True),
    IndianState("32", "Kerala", "KL", "Thiruvananthapuram", "South", False),
    IndianState("33", "Tamil Nadu", "TN", "Chennai", "South", False),
    IndianState("34", "Puducherry", "PY", "Pondicherry", "South", True),
    IndianState("35", "Andaman & Nicobar Islands", "AN", "Port Blair", "East", True),
    IndianState("36", "Telangana", "TS", "Hyderabad", "South", False),
    IndianState("37", "Andhra Pradesh (New)", "AD", "Amaravati", "South", False),
    IndianState("38", "Ladakh", "LA", "Leh", "North", True),
]

# Build lookup dictionaries
_BY_CODE: dict[str, IndianState] = {s.code: s for s in _STATE_REGISTRY}
_BY_ABBR: dict[str, IndianState] = {s.abbreviation.upper(): s for s in _STATE_REGISTRY}
_BY_NAME: dict[str, IndianState] = {s.name.lower(): s for s in _STATE_REGISTRY}


def get_state_by_code(code: str) -> Optional[IndianState]:
    """Lookup state by 2-digit GST state code (e.g. '27' -> Maharashtra)."""
    return _BY_CODE.get(str(code).zfill(2))


def get_state_by_abbreviation(abbr: str) -> Optional[IndianState]:
    """Lookup state by 2-letter abbreviation (e.g. 'MH' -> Maharashtra)."""
    return _BY_ABBR.get(str(abbr).upper())


def get_state_by_name(name: str) -> Optional[IndianState]:
    """Lookup state by name (case-insensitive, partial match supported)."""
    name_lower = str(name).lower().strip()
    # Exact match first
    if name_lower in _BY_NAME:
        return _BY_NAME[name_lower]
    # Partial match
    for state_name, state in _BY_NAME.items():
        if name_lower in state_name:
            return state
    return None


def extract_state_from_gstin(gstin: str) -> Optional[IndianState]:
    """Extract the state code from a GSTIN and return the state."""
    if not gstin or len(gstin) < 2:
        return None
    state_code = gstin[:2]
    return get_state_by_code(state_code)


def get_all_states() -> list[IndianState]:
    """Return all registered states and UTs."""
    return list(_STATE_REGISTRY)


def get_states_by_region(region: str) -> list[IndianState]:
    """Return all states in a given region (North/South/East/West/Northeast/Central/UT)."""
    region_lower = region.lower()
    if region_lower == "ut":
        return [s for s in _STATE_REGISTRY if s.is_ut]
    return [s for s in _STATE_REGISTRY if s.region.lower() == region_lower]


def is_intrastate_supply(gstin_supplier: str, gstin_buyer: str) -> bool:
    """
    Determine if a supply is intrastate (same state) or interstate.
    Used for CGST+SGST vs IGST determination.
    """
    if not gstin_supplier or not gstin_buyer:
        return False
    return gstin_supplier[:2] == gstin_buyer[:2]
