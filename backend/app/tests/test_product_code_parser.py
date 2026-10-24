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
Classification: Unit Test Suite - Attribute-Based Product Code Parsing & Matching Engine
"""

import pytest
from app.services.product_code_parser import ProductCodeParser, ParsedProductCode


@pytest.fixture
def parser():
    """Default parser instance loaded with canonical master data lookup sets."""
    return ProductCodeParser()


def test_canonical_example_snd_06_g_blue_41(parser):
    """
    Test user core example: SND-06-G-BLUE-41
    Must parse into:
      - Article/Style Code: SND-06
      - Vendor Code: G
      - Color: BLUE
      - Size: 41
    Must NOT split blindly on every hyphen (which would yield SND / 06 / G / BLUE / 41).
    """
    parsed = parser.parse("SND-06-G-BLUE-41")

    assert isinstance(parsed, ParsedProductCode)
    assert parsed.is_valid is True
    assert parsed.article_code == "SND-06"
    assert parsed.vendor_code == "G"
    assert parsed.color == "BLUE"
    assert parsed.color_normalized == "BLUE"
    assert parsed.size == "41"
    assert parsed.size_normalized == "41"
    assert parsed.reconciliation_key == ("SND-06", "G", "BLUE", "41")
    assert parsed.style_with_vendor == "SND-06-G-"
    assert parsed.confidence == 1.0
    assert len(parsed.warnings) == 0


def test_hyphenated_style_ch_24_g_black_36(parser):
    """
    Test standard CH style code with hyphenated article and vendor G: CH-24-G-BLACK-36.
    """
    parsed = parser.parse("CH-24-G-BLACK-36")

    assert parsed.is_valid is True
    assert parsed.article_code == "CH-24"
    assert parsed.vendor_code == "G"
    assert parsed.color == "BLACK"
    assert parsed.size == "36"
    assert parsed.reconciliation_key == ("CH-24", "G", "BLACK", "36")
    assert parsed.style_with_vendor == "CH-24-G-"


def test_hyphenated_compound_color_r_gold(parser):
    """
    Test hyphenated compound color: SND-05-G-R-GOLD-39.
    'R-GOLD' must be normalized to 'ROSE GOLD' while preserving raw 'R-GOLD'.
    """
    parsed = parser.parse("SND-05-G-R-GOLD-39")

    assert parsed.is_valid is True
    assert parsed.article_code == "SND-05"
    assert parsed.vendor_code == "G"
    assert parsed.color == "R-GOLD"
    assert parsed.color_normalized == "ROSE GOLD"
    assert parsed.size == "39"
    assert parsed.attributes["color_was_aliased"] is True
    assert parsed.reconciliation_key == ("SND-05", "G", "ROSE GOLD", "39")


def test_hyphenated_size_uk_6(parser):
    """
    Test hyphenated size: CH-01-A-CREAM-UK-6.
    'UK-6' must be recognized as size, with size_normalized='6'.
    """
    parsed = parser.parse("CH-01-A-CREAM-UK-6")

    assert parsed.is_valid is True
    assert parsed.article_code == "CH-01"
    assert parsed.vendor_code == "A"
    assert parsed.color == "CREAM"
    assert parsed.size == "UK-6"
    assert parsed.size_normalized == "6"
    assert parsed.reconciliation_key == ("CH-01", "A", "CREAM", "6")


def test_multi_letter_vendor_tt(parser):
    """
    Test multi-letter vendor code: CH-501-TT-BLACK-37.
    Vendor 'TT' must be recognized without being treated as part of article or color.
    """
    parsed = parser.parse("CH-501-TT-BLACK-37")

    assert parsed.is_valid is True
    assert parsed.article_code == "CH-501"
    assert parsed.vendor_code == "TT"
    assert parsed.color == "BLACK"
    assert parsed.size == "37"
    assert parsed.style_with_vendor == "CH-501-TT"


def test_omitted_optional_vendor(parser):
    """
    Test code where vendor is omitted: CH-41-BLACK-36.
    Article must be 'CH-41', vendor None, color 'BLACK', size '36'.
    """
    parsed = parser.parse("CH-41-BLACK-36", require_vendor=False)

    assert parsed.is_valid is True
    assert parsed.article_code == "CH-41"
    assert parsed.vendor_code is None
    assert parsed.color == "BLACK"
    assert parsed.size == "36"
    assert parsed.attributes["has_vendor"] is False


def test_require_vendor_enforcement(parser):
    """
    Test require_vendor enforcement flag:
    When require_vendor=True, code without vendor fails validation and logs warning.
    """
    # Code without vendor
    parsed_no_v = parser.parse("CH-41-BLACK-36", require_vendor=True)
    assert parsed_no_v.is_valid is False
    assert any("Vendor segment is required" in w for w in parsed_no_v.warnings)

    # Code with vendor
    parsed_with_v = parser.parse("SND-06-G-BLUE-41", require_vendor=True)
    assert parsed_with_v.is_valid is True
    assert parsed_with_v.vendor_code == "G"


def test_ambiguous_partial_code_article_vendor_only(parser):
    """
    Test parent style/variant template: CH-01-A (no color, no size).
    """
    parsed = parser.parse("CH-01-A")

    assert parsed.article_code == "CH-01"
    assert parsed.vendor_code == "A"
    assert parsed.color is None
    assert parsed.size is None
    assert any("Size segment could not be identified" in w for w in parsed.warnings)
    assert any("Color segment could not be identified" in w for w in parsed.warnings)


def test_missing_attributes_and_fallbacks(parser):
    """
    Test codes with missing attributes:
    - Empty string
    - Single token SKU / barcode
    - Missing article
    """
    # Empty string
    p_empty = parser.parse("")
    assert p_empty.is_valid is False
    assert p_empty.confidence == 0.0

    # Single barcode
    p_barcode = parser.parse("8901234567890")
    assert p_barcode.is_valid is True
    assert p_barcode.article_code == "8901234567890"
    assert p_barcode.matched_strategy == "SINGLE_TOKEN_FALLBACK"

    # Code with only color and size (e.g. BLUE-41)
    p_color_size = parser.parse("BLUE-41")
    assert p_color_size.size == "41"
    assert p_color_size.color == "BLUE"
    assert p_color_size.article_code is None
    assert p_color_size.is_valid is False


def test_attribute_matching_reconciliation(parser):
    """
    Rule 5: Verify attribute matching between items using Article + Vendor + Color + Size.
    """
    # Item A: Parsed from product code
    item_a = {
        "code": "SND-06-G-BLUE-41",
    }
    # Item B: Separate explicit attributes from invoice/receiving
    item_b = {
        "style_code": "SND-06",
        "vendor_code": "G",
        "color": "BLUE",
        "size": "41",
    }
    assert parser.match_attributes(item_a, item_b) is True

    # Item C: Aliased color (R-GOLD vs ROSE GOLD)
    item_c = {"code": "SND-05-G-R-GOLD-39"}
    item_d = {"style_code": "SND-05", "vendor_code": "G", "color": "ROSE GOLD", "size": "39"}
    assert parser.match_attributes(item_c, item_d) is True

    # Item E: Mismatched size
    item_e = {"code": "SND-06-G-BLUE-40"}
    assert parser.match_attributes(item_a, item_e) is False

    # Item F: Mismatched color
    item_f = {"code": "SND-06-G-BLACK-41"}
    assert parser.match_attributes(item_a, item_f) is False

    # Item G: Mismatched vendor
    item_g = {"code": "SND-06-A-BLUE-41"}
    assert parser.match_attributes(item_a, item_g) is False
