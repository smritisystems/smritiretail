"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.1
Created      : 2026-08-17
Modified     : 2026-08-18  (Golden CSS externalized — single source of truth)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal / FROZEN IMMUTABLE SPECIFICATION

CANONICAL SPECIFICATION: SMRITITAXINVOICE (Version V1)
================================================================================
CRITICAL GOVERNANCE NOTICE:
This file defines the immutable, forensic physical and visual standard for
SMRITITAXINVOICE (A4 Statutory GST Tax Invoice).

ANY IN-PLACE MUTATION OF CSS TOKENS, COLUMN PERCENTAGES, ROW HEIGHTS, OR
MARGIN GEOMETRY IS PROHIBITED BY SMRITI ARCHITECTURE GOVERNANCE LAW.
================================================================================
"""

import hashlib
import json
import re
from pathlib import Path
from typing import Dict, Final

_GOLDEN_CSS_PATH: Final[Path] = Path(__file__).with_name("smrititaxinvoice_v1.golden.css")
_INTEGRITY_JSON_PATH: Final[Path] = Path(__file__).with_name("smrititaxinvoice_v1.integrity.json")

# Canonical Identifier Constants
SMRITITAXINVOICE_TEMPLATE_CODE: Final[str] = "SMRITITAXINVOICE"
SMRITITAXINVOICE_VERSION: Final[str] = "V1"
SMRITITAXINVOICE_STATUS: Final[str] = "FROZEN"
SMRITITAXINVOICE_IMMUTABLE: Final[bool] = True

# Physical Page Geometry (in PDF Points: 1 pt = 1/72 inch, 1 mm = 2.83465 pt)
SMRITI_A4_WIDTH_PT: Final[float] = 595.92
SMRITI_A4_HEIGHT_PT: Final[float] = 842.88
SMRITI_PAGE_MARGIN_LEFT_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_RIGHT_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_TOP_PT: Final[float] = 23.25
SMRITI_PAGE_MARGIN_BOTTOM_PT: Final[float] = 28.35
SMRITI_CONTENT_WIDTH_PT: Final[float] = 550.55

# Item Row Heights
SMRITI_HEADER_ROW_HEIGHT_PT: Final[float] = 18.00
SMRITI_ITEM_ROW_HEIGHT_PT: Final[float] = 20.47
SMRITI_SUBTOTAL_ROW_HEIGHT_PT: Final[float] = 20.47

# ─────────────────────────────────────────────────────────────────────────────
# FORENSIC TYPOGRAPHIC CONSTANTS — sourced from PDF audit of original
# Tattly Threads master invoices (F:\SMRITRretailNX\TT\B)
# DO NOT ALTER — these are the immutable forensic standard. (AGENTS.md Rule 7)
# ─────────────────────────────────────────────────────────────────────────────
SMRITI_FONT_COMPANY_NAME_PT: Final[float] = 10.24    # Header company name
SMRITI_FONT_INVOICE_TITLE_PT: Final[float] = 11.70   # "TAX INVOICE" heading
SMRITI_FONT_CUSTOMER_NAME_PT: Final[float] = 8.77    # Billed-to / Shipped-to name
SMRITI_FONT_BODY_PT: Final[float] = 7.31             # Address, meta, GSTIN
SMRITI_FONT_ITEM_DATA_PT: Final[float] = 8.2         # Item table data cells (user-approved 2026-08-17)
SMRITI_FONT_COL_HEADER_PT: Final[float] = 6.58       # Table column header row
SMRITI_FONT_SUBTOTAL_PT: Final[float] = 6.58         # Subtotal / total label rows
SMRITI_FONT_GRAND_TOTAL_PT: Final[float] = 8.77      # Grand total dark bar
SMRITI_FONT_FOOTER_PT: Final[float] = 6.00           # Page footer line
SMRITI_FONT_WATERMARK_PT: Final[float] = 72.00       # CANCELLED watermark

# Interstate (IGST) 10-Column Width Allocation (Sum = 100.0%)
SMRITI_INTERSTATE_COLUMNS: Final[Dict[str, str]] = {
    "sl_no": "3.5%",
    "item_description": "28.0%",
    "hsn_sac": "8.0%",
    "qty": "5.5%",
    "mrp": "10.0%",
    "discount_pct": "6.5%",
    "taxable_value": "11.0%",
    "tax_pct": "5.0%",
    "igst": "9.0%",
    "amount": "13.5%"
}

# Intrastate (CGST + SGST) 12-Column Width Allocation (Sum = 100.0%)
SMRITI_INTRASTATE_COLUMNS: Final[Dict[str, str]] = {
    "sl_no": "3.5%",
    "item_description": "24.0%",
    "hsn_sac": "7.5%",
    "qty": "4.5%",
    "mrp": "9.5%",
    "discount_pct": "5.5%",
    "taxable_value": "10.5%",
    "cgst_pct": "5.0%",
    "cgst": "8.5%",
    "sgst_pct": "5.0%",
    "sgst": "8.5%",
    "amount": "8.0%"
}

def _read_golden_css_bytes() -> bytes:
    if not _GOLDEN_CSS_PATH.is_file():
        raise FileNotFoundError(
            f"SMRITI-SECURITY-TAMPER: Golden CSS artifact missing at {_GOLDEN_CSS_PATH}"
        )
    return _GOLDEN_CSS_PATH.read_bytes()


def _strip_css_author_header(raw: str) -> str:
    """Remove the UADHP author comment block; return embeddable CSS only."""
    return re.sub(r"^\s*/\*[\s\S]*?\*/\s*", "", raw, count=1).strip()


def verify_golden_css_integrity() -> bool:
    """Verify smrititaxinvoice_v1.golden.css against smrititaxinvoice_v1.integrity.json."""
    css_bytes = _read_golden_css_bytes()
    computed = hashlib.sha256(css_bytes).hexdigest()

    if not _INTEGRITY_JSON_PATH.is_file():
        raise FileNotFoundError(
            f"SMRITI-SECURITY-TAMPER: Integrity manifest missing at {_INTEGRITY_JSON_PATH}"
        )

    manifest = json.loads(_INTEGRITY_JSON_PATH.read_text(encoding="utf-8"))
    expected = manifest.get("sha256")
    if computed != expected:
        raise RuntimeError(
            "SMRITI-SECURITY-TAMPER: SMRITITAXINVOICE golden CSS has been altered! "
            f"Expected SHA256: {expected}, Computed: {computed}"
        )
    return True


def load_golden_css(*, verify: bool = True) -> str:
    """
    Load canonical SMRITITAXINVOICE V1 visual CSS from the golden artifact file.
    Do not duplicate these tokens elsewhere.
    """
    if verify:
        verify_golden_css_integrity()
    raw = _read_golden_css_bytes().decode("utf-8")
    return _strip_css_author_header(raw)


def build_colgroup(columns: Dict[str, str]) -> str:
    """Build an HTML colgroup from frozen column width percentages."""
    cols = "\n".join(f'              <col style="width: {width};">' for width in columns.values())
    return f"""
            <colgroup>
{cols}
            </colgroup>
            """


# Backward-compatible alias — always loaded from golden artifact, never inline.
SMRITITAXINVOICE_CSS_FROZEN: Final[str] = load_golden_css()


def compute_spec_sha256() -> str:
    """Computes SHA256 integrity hash of the frozen specification."""
    css_hash = hashlib.sha256(_read_golden_css_bytes()).hexdigest()
    content = (
        f"{SMRITITAXINVOICE_TEMPLATE_CODE}|{SMRITITAXINVOICE_VERSION}|"
        f"{SMRITI_A4_WIDTH_PT}|{SMRITI_A4_HEIGHT_PT}|{css_hash}"
    )
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

SMRITITAXINVOICE_SHA256_INTEGRITY: Final[str] = compute_spec_sha256()

def verify_smrititaxinvoice_integrity() -> bool:
    """
    Integrity verification function.
    Returns True if the spec is untampered, raises AssertionError otherwise.
    """
    verify_golden_css_integrity()
    current_hash = compute_spec_sha256()
    if current_hash != SMRITITAXINVOICE_SHA256_INTEGRITY:
        raise RuntimeError(
            f"SMRITI-SECURITY-TAMPER: SMRITITAXINVOICE layout specification has been altered! "
            f"Expected SHA256: {SMRITITAXINVOICE_SHA256_INTEGRITY}, Computed: {current_hash}"
        )
    return True
