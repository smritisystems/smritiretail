"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Description  : Unit tests for NumberingService._assemble_doc_no — all four
               NumberFormat arrangements and edge cases.
"""

import pytest
from unittest.mock import MagicMock

from backend.app.services.numbering import NumberingService


# ---------------------------------------------------------------------------
# _assemble_doc_no — the central assembly function
# ---------------------------------------------------------------------------

class TestAssembleDocNo:
    """Tests for the _assemble_doc_no static method covering all 4 formats."""

    def test_prefix_num_suffix_default(self):
        """PREFIX_NUM_SUFFIX: {prefix}{num}{suffix} — existing backward-compatible behaviour."""
        result = NumberingService._assemble_doc_no(
            prefix="TT",
            num_str="251",
            suffix="2026-2027/",
            financial_year="2026-2027",
            number_format="PREFIX_NUM_SUFFIX",
        )
        assert result == "TT2512026-2027/"

    def test_prefix_num_suffix_no_suffix(self):
        """PREFIX_NUM_SUFFIX with empty suffix."""
        result = NumberingService._assemble_doc_no("INV/C/", "0001", "", "2026-2027", "PREFIX_NUM_SUFFIX")
        assert result == "INV/C/0001"

    def test_prefix_year_sep_num(self):
        """PREFIX_YEAR_SEP_NUM: {prefix}/{year}/{num} — year visible between prefix and number."""
        result = NumberingService._assemble_doc_no(
            prefix="TT",
            num_str="251",
            suffix="",
            financial_year="2026-2027",
            number_format="PREFIX_YEAR_SEP_NUM",
        )
        assert result == "TT/2026-2027/251"

    def test_prefix_year_sep_num_no_fy(self):
        """PREFIX_YEAR_SEP_NUM without a financial_year — year segment is omitted gracefully."""
        result = NumberingService._assemble_doc_no(
            prefix="INV",
            num_str="0042",
            suffix="",
            financial_year="",
            number_format="PREFIX_YEAR_SEP_NUM",
        )
        # No FY → falls back to {prefix}/{num}
        assert result == "INV/0042"

    def test_prefix_sep_num(self):
        """PREFIX_SEP_NUM: {prefix}/{num} — suffix is ignored."""
        result = NumberingService._assemble_doc_no(
            prefix="TT",
            num_str="251",
            suffix="2026-2027/",
            financial_year="2026-2027",
            number_format="PREFIX_SEP_NUM",
        )
        assert result == "TT/251"

    def test_prefix_sep_num_no_prefix(self):
        """PREFIX_SEP_NUM with empty prefix — no leading slash produced."""
        result = NumberingService._assemble_doc_no(
            prefix="",
            num_str="099",
            suffix="",
            financial_year="",
            number_format="PREFIX_SEP_NUM",
        )
        assert result == "099"

    def test_num_only(self):
        """NUM_ONLY: bare sequential number, prefix and suffix ignored."""
        result = NumberingService._assemble_doc_no(
            prefix="TT/",
            num_str="251",
            suffix="2026-2027/",
            financial_year="2026-2027",
            number_format="NUM_ONLY",
        )
        assert result == "251"

    def test_none_format_falls_back_to_prefix_num_suffix(self):
        """None number_format must silently fall back to PREFIX_NUM_SUFFIX."""
        result = NumberingService._assemble_doc_no("INV/", "0001", "26-27/", "2026-2027", None)
        assert result == "INV/000126-27/"

    def test_unknown_format_falls_back_to_prefix_num_suffix(self):
        """Unrecognised format codes must silently fall back to PREFIX_NUM_SUFFIX."""
        result = NumberingService._assemble_doc_no("INV/", "0001", "26-27/", "2026-2027", "FUTURE_FORMAT_V2")
        assert result == "INV/000126-27/"

    def test_gst_rule_46b_all_formats_within_16_chars(self):
        """All four formats with realistic prefixes must produce ≤ 16 character outputs."""
        cases = [
            ("TT",    "251",  "26-27/", "2026-2027", "PREFIX_NUM_SUFFIX"),    # TT2512026-2027/ — wait, may exceed
            ("TT",    "251",  "",        "2026-2027", "PREFIX_YEAR_SEP_NUM"),  # TT/2026-2027/251 = 16 chars ✓
            ("TT",    "251",  "",        "",           "PREFIX_SEP_NUM"),       # TT/251 = 6 ✓
            ("TT",    "251",  "",        "",           "NUM_ONLY"),             # 251 = 3 ✓
        ]
        for pfx, num, sfx, fy, fmt in cases:
            assembled = NumberingService._assemble_doc_no(pfx, num, sfx, fy, fmt)
            assert len(assembled) <= 16, (
                f"Format {fmt!r} produced {assembled!r} ({len(assembled)} chars) — exceeds GST Rule 46(b) limit of 16"
            )
