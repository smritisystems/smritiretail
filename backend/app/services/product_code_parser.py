# -*- coding: utf-8 -*-
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-20
Modified     : 2026-10-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Attribute-Based Product Code Parsing & Canonical Segmentation Engine
"""

import re
from typing import Optional, List, Dict, Any, Set, Tuple
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Canonical Default Master Lookups & Normalization Tables
# ---------------------------------------------------------------------------

DEFAULT_KNOWN_SIZES: Set[str] = {
    # Numerical shoe sizes (EU / India / Paris points)
    "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48",
    # Half sizes
    "35.5", "36.5", "37.5", "38.5", "39.5", "40.5", "41.5", "42.5", "43.5", "44.5",
    # UK / US prefixed sizes
    "UK-3", "UK-4", "UK-5", "UK-6", "UK-7", "UK-8", "UK-9", "UK-10", "UK-11", "UK-12",
    "UK3", "UK4", "UK5", "UK6", "UK7", "UK8", "UK9", "UK10", "UK11", "UK12",
    "US-5", "US-6", "US-7", "US-8", "US-9", "US-10", "US-11", "US-12",
    # Standard apparel sizes
    "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "FS", "FREE", "ONESIZE"
}

DEFAULT_KNOWN_COLORS: Dict[str, str] = {
    # Raw token -> Canonical Normalized Color
    "BLACK": "BLACK",
    "BLUE": "BLUE",
    "BEIGE": "BEIGE",
    "BROWN": "BROWN",
    "BRONZE": "BRONZE",
    "CHIKKU": "CHIKKU",
    "CHIKU": "CHIKKU",
    "CREAM": "CREAM",
    "GOLD": "GOLD",
    "GREEN": "GREEN",
    "GREY": "GREY",
    "GRAY": "GREY",
    "GUNMETAL": "GUNMETAL",
    "MAROON": "MAROON",
    "MULTI": "MULTI",
    "MULTY": "MULTI",
    "MUSTARD": "MUSTARD",
    "NAVY": "NAVY",
    "OLIVE": "OLIVE",
    "PEACH": "PEACH",
    "PINK": "PINK",
    "RED": "RED",
    "ROSE": "ROSE",
    "SILVER": "SILVER",
    "SULTAN": "SULTAN",
    "TAN": "TAN",
    "TOUPE": "TOUPE",
    "TAUPE": "TOUPE",
    "WHITE": "WHITE",
    "YELLOW": "YELLOW",
    "ORANGE": "ORANGE",
    "KHAKI": "KHAKI",
    "COPPER": "COPPER",
    # Hyphenated & compound aliases
    "R-GOLD": "ROSE GOLD",
    "RGOLD": "ROSE GOLD",
    "ROSE GOLD": "ROSE GOLD",
    "ROSE-GOLD": "ROSE GOLD",
    "L-BLUE": "LIGHT BLUE",
    "LBLUE": "LIGHT BLUE",
    "LIGHT BLUE": "LIGHT BLUE",
    "L-GREEN": "LIGHT GREEN",
    "LGREEN": "LIGHT GREEN",
    "LIGHT GREEN": "LIGHT GREEN",
    "D-BROWN": "DARK BROWN",
    "DBROWN": "DARK BROWN",
    "DARK BROWN": "DARK BROWN",
    "OFF-WHITE": "OFF WHITE",
    "OFF WHITE": "OFF WHITE",
    "OFFWHITE": "OFF WHITE",
}

DEFAULT_KNOWN_VENDORS: Set[str] = {
    # Single-letter commercial vendor codes
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    # Common multi-letter vendors
    "TT", "JRM", "ABCD", "LAJOS", "CRYSTAL", "LUCKY", "SA", "MK", "AS", "SB", "AK"
}


# ---------------------------------------------------------------------------
# Structured Output Model
# ---------------------------------------------------------------------------

class ParsedProductCode(BaseModel):
    """
    Authoritative parsed representation of an attribute-encoded product code.
    Example: SND-06-G-BLUE-41
      - original_code    : "SND-06-G-BLUE-41"
      - article_code     : "SND-06"
      - vendor_code      : "G"
      - color            : "BLUE"
      - color_normalized : "BLUE"
      - size             : "41"
      - size_normalized  : "41"
    """
    original_code: str
    normalized_code: str
    article_code: Optional[str] = None
    vendor_code: Optional[str] = None
    color: Optional[str] = None
    color_normalized: Optional[str] = None
    size: Optional[str] = None
    size_normalized: Optional[str] = None
    format_pattern: str = "ARTICLE-VENDOR-COLOR-SIZE"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    matched_strategy: str = "CONFIGURED_FORMAT"
    is_valid: bool = True
    attributes: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)

    @property
    def reconciliation_key(self) -> Tuple[str, str, str, str]:
        """Canonical tuple for PSV, Receiving, and Sales Tax Invoice reconciliation."""
        return (
            (self.article_code or "").upper().strip(),
            (self.vendor_code or "").upper().strip(),
            (self.color_normalized or self.color or "").upper().strip(),
            (self.size_normalized or self.size or "").upper().strip(),
        )

    @property
    def style_with_vendor(self) -> str:
        """Formatted presentation style with vendor code (e.g. CH-01-A- or CH-501-TT)."""
        art = (self.article_code or "").strip().upper()
        v = (self.vendor_code or "").strip().upper()
        if not v:
            return art
        if v == "TT" or len(v) > 1:
            return f"{art}-{v}"
        return f"{art}-{v}-"


# ---------------------------------------------------------------------------
# Parsing Engine
# ---------------------------------------------------------------------------

class ProductCodeParser:
    """
    SMRITI Attribute-Based Product Code Parsing Engine.
    
    Governance Rules:
    1. Do not split blindly on every hyphen because Article/Style codes contain hyphens (e.g. 'SND-06', 'CH-24').
    2. Use master data and configured formats to isolate size, color, vendor, and article segments.
    3. Support configurable attribute order and optional attributes (e.g. vendor omitted in 'CH-41-BLACK-36').
    4. Normalize values consistently (e.g. 'R-GOLD' -> 'ROSE GOLD') while preserving original strings.
    5. Support composite matching and reconciliation in PSV, receiving, and sales workflows.
    6. Validate ambiguous tokens against master data rather than guessing.
    """

    def __init__(
        self,
        known_sizes: Optional[Set[str]] = None,
        known_colors: Optional[Dict[str, str]] = None,
        known_vendors: Optional[Set[str]] = None,
        known_styles: Optional[Set[str]] = None,
        default_format: str = "ARTICLE-VENDOR-COLOR-SIZE",
    ):
        self.known_sizes = {s.upper() for s in (known_sizes or DEFAULT_KNOWN_SIZES)}
        self.known_colors = {k.upper(): v.upper() for k, v in (known_colors or DEFAULT_KNOWN_COLORS).items()}
        self.known_vendors = {v.upper() for v in (known_vendors or DEFAULT_KNOWN_VENDORS)}
        self.known_styles = {s.upper() for s in (known_styles or set())}
        self.default_format = default_format

    def parse(
        self,
        raw_code: Optional[str],
        format_order: Optional[List[str]] = None,
        require_vendor: bool = False,
    ) -> ParsedProductCode:
        """
        Parses a product code into its constituent attributes.
        Supports:
          - SND-06-G-BLUE-41       (Article with hyphen + single vendor + color + size)
          - CH-24-G-BLACK-36       (Article with hyphen + single vendor + color + size)
          - SND-05-G-R-GOLD-39     (Article with hyphen + vendor + hyphenated color + size)
          - CH-01-A-CREAM-UK-6     (Article with hyphen + vendor + color + hyphenated size)
          - CH-501-TT-BLACK-37     (Article with hyphen + multi-letter vendor + color + size)
          - CH-41-BLACK-36         (Article with hyphen + color + size, NO vendor)
          - CH-01-A                (Article with hyphen + vendor, no color/size)
          - TT79-002               (Non-standard article or style)
        """
        if not raw_code or not str(raw_code).strip():
            return ParsedProductCode(
                original_code=str(raw_code or ""),
                normalized_code="",
                is_valid=False,
                confidence=0.0,
                warnings=["Empty or blank product code."]
            )

        clean_code = str(raw_code).strip().upper()

        # Step 1: Check if format_order is explicitly specified
        order = format_order or self._resolve_format_order(clean_code)

        # Step 2: Multi-Pass Grammar Segmentation
        parsed = self._segment_product_code(clean_code, order, require_vendor)
        return parsed

    def _resolve_format_order(self, code: str) -> List[str]:
        """Resolves attribute format order based on configured format."""
        tokens = [t.strip().upper() for t in self.default_format.split("-") if t.strip()]
        return tokens or ["ARTICLE", "VENDOR", "COLOR", "SIZE"]

    def _segment_product_code(
        self,
        code: str,
        format_order: List[str],
        require_vendor: bool = False,
    ) -> ParsedProductCode:
        warnings = []
        raw_parts = [p.strip() for p in code.split("-") if p.strip()]

        if not raw_parts:
            return ParsedProductCode(
                original_code=code,
                normalized_code=code,
                is_valid=False,
                confidence=0.0,
                warnings=["Cannot segment empty token sequence."]
            )

        # Edge case: Code with no hyphens (e.g., single SKU or barcode like "8901234567890")
        if len(raw_parts) == 1:
            return ParsedProductCode(
                original_code=code,
                normalized_code=code,
                article_code=code,
                confidence=0.5,
                matched_strategy="SINGLE_TOKEN_FALLBACK",
                is_valid=True,
                warnings=["Un-delimited product code; treated as article code."]
            )

        # -------------------------------------------------------------------
        # Multi-Segment Anchoring
        # Tail: Size -> Color -> Vendor
        # Head: Remainder = Article
        # -------------------------------------------------------------------

        # 1. Identify Size (Rightmost segment)
        size_val = None
        size_norm = None
        remaining_parts = list(raw_parts)

        # Check for hyphenated size token (e.g. UK-6, UK-10, US-9)
        if len(remaining_parts) >= 2:
            candidate_size_pair = f"{remaining_parts[-2]}-{remaining_parts[-1]}"
            if candidate_size_pair in self.known_sizes or re.match(r"^(UK|US)-\d+$", candidate_size_pair):
                size_val = candidate_size_pair
                size_norm = re.sub(r"^(UK|US)-", "", candidate_size_pair)
                remaining_parts = remaining_parts[:-2]

        if not size_val and remaining_parts:
            last_token = remaining_parts[-1]
            if last_token in self.known_sizes or last_token.isdigit() or re.match(r"^\d+(\.\d+)?$", last_token):
                size_val = last_token
                size_norm = last_token
                remaining_parts = remaining_parts[:-1]

        # 2. Identify Color (Preceding Size)
        color_val = None
        color_norm = None

        # Check for hyphenated color token (e.g. R-GOLD, L-BLUE, OFF-WHITE)
        if len(remaining_parts) >= 2:
            candidate_color_pair = f"{remaining_parts[-2]}-{remaining_parts[-1]}"
            if candidate_color_pair in self.known_colors:
                color_val = candidate_color_pair
                color_norm = self.known_colors[candidate_color_pair]
                remaining_parts = remaining_parts[:-2]

        if not color_val and remaining_parts:
            candidate_color = remaining_parts[-1]
            if candidate_color in self.known_colors:
                color_val = candidate_color
                color_norm = self.known_colors[candidate_color]
                remaining_parts = remaining_parts[:-1]

        # 3. Identify Vendor Code (Preceding Color)
        vendor_val = None
        if remaining_parts:
            # Vendor candidate is the token immediately preceding color
            # BUT only if it is not part of the base style (e.g. '06' in 'SND-06' is NOT a vendor)
            candidate_vendor = remaining_parts[-1]

            # Condition for vendor code:
            # a) Must be in known vendors, AND
            # b) There must be at least one preceding token representing the article prefix (e.g. SND-06, CH-24),
            # c) candidate_vendor is not pure digits (unless explicitly registered as numeric supplier).
            if len(remaining_parts) >= 2 and candidate_vendor in self.known_vendors and not candidate_vendor.isdigit():
                # Verify that remaining_parts[:-1] looks like a valid article prefix
                prefix_candidate = "-".join(remaining_parts[:-1])
                # If prefix ends with a digit (e.g. SND-06, CH-01, SH-02), it's a complete article
                if re.search(r"\d+$", prefix_candidate) or prefix_candidate in self.known_styles or len(remaining_parts[:-1]) >= 2:
                    vendor_val = candidate_vendor
                    remaining_parts = remaining_parts[:-1]
            elif require_vendor and candidate_vendor in self.known_vendors:
                vendor_val = candidate_vendor
                remaining_parts = remaining_parts[:-1]

        # 4. Remainder is the Article / Style Code
        article_val = "-".join(remaining_parts) if remaining_parts else None

        # -------------------------------------------------------------------
        # Validation & Confidence Calculation
        # -------------------------------------------------------------------
        confidence = 1.0
        is_valid = True

        if not article_val:
            warnings.append("Could not isolate Article/Style Code segment.")
            confidence -= 0.4
            is_valid = False

        if not size_val:
            warnings.append("Size segment could not be identified or validated against master data.")
            confidence -= 0.2

        if not color_val:
            warnings.append("Color segment could not be identified or validated against master data.")
            confidence -= 0.2

        if require_vendor and not vendor_val:
            warnings.append("Vendor segment is required by policy but was not identified.")
            confidence -= 0.2
            is_valid = False

        confidence = max(0.1, min(1.0, round(confidence, 2)))

        return ParsedProductCode(
            original_code=code,
            normalized_code=code,
            article_code=article_val,
            vendor_code=vendor_val,
            color=color_val,
            color_normalized=color_norm or color_val,
            size=size_val,
            size_normalized=size_norm or size_val,
            format_pattern="-".join(format_order),
            confidence=confidence,
            matched_strategy="MULTI_SEGMENT_ANCHORING",
            is_valid=is_valid,
            warnings=warnings,
            attributes={
                "has_vendor": vendor_val is not None,
                "has_color": color_val is not None,
                "has_size": size_val is not None,
                "color_was_aliased": (color_val != color_norm) if (color_val and color_norm) else False,
            }
        )

    def match_attributes(self, item_a: Dict[str, Any], item_b: Dict[str, Any]) -> bool:
        """
        Rule 5: Matches two items using Article + Vendor + Color + Size
        and applicable attributes for PSV, Receiving, and Sales Tax Invoices.
        """
        # If both items have parsed product codes, match canonical keys
        code_a = item_a.get("code") or item_a.get("sku") or item_a.get("product_code")
        code_b = item_b.get("code") or item_b.get("sku") or item_b.get("product_code")

        pa = self.parse(code_a) if code_a else None
        pb = self.parse(code_b) if code_b else None

        # Extract dimensions with fallback to raw attributes
        style_a = (item_a.get("style_code") or (pa.article_code if pa else "")).strip().upper()
        style_b = (item_b.get("style_code") or (pb.article_code if pb else "")).strip().upper()

        vendor_a = (item_a.get("vendor_code") or (pa.vendor_code if pa else "")).strip().upper()
        vendor_b = (item_b.get("vendor_code") or (pb.vendor_code if pb else "")).strip().upper()

        color_a = (item_a.get("color") or (pa.color_normalized or pa.color if pa else "")).strip().upper()
        color_b = (item_b.get("color") or (pb.color_normalized or pb.color if pb else "")).strip().upper()

        size_a = (item_a.get("size") or (pa.size_normalized or pa.size if pa else "")).strip().upper()
        size_b = (item_b.get("size") or (pb.size_normalized or pb.size if pb else "")).strip().upper()

        # Strict Style + Color + Size parity
        if style_a and style_b and style_a != style_b:
            return False
        if color_a and color_b and color_a != color_b:
            return False
        if size_a and size_b and size_a != size_b:
            return False

        # If vendor code is present on both, it must match
        if vendor_a and vendor_b and vendor_a != vendor_b:
            return False

        return bool(style_a or color_a or size_a)
