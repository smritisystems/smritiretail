"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.services.invoice_pdf_service import number_to_indian_words


@pytest.mark.parametrize(
    "input_val, expected",
    [
        (0, "Zero Rupees Only"),
        (0.0, "Zero Rupees Only"),
        (0.5, "Zero Rupees and Fifty Paisa Only"),
        (1.0, "One Rupee Only"),
        (1.5, "One Rupee and Fifty Paisa Only"),
        (2.0, "Two Rupees Only"),
        (2500.0, "Two Thousand Five Hundred Rupees Only"),
        (100000.0, "One Lakh Rupees Only"),
        (123456.78, "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paisa Only"),
        (10000000.0, "One Crore Rupees Only"),
        (10000000.5, "One Crore Rupees and Fifty Paisa Only"),
    ],
)
def test_number_to_indian_words_parity_table(input_val, expected):
    """Asserts that Python implementation exactly matches the canonical test table."""
    assert number_to_indian_words(input_val) == expected


def test_singular_rupee_handling():
    """Verify 1.00 outputs singular 'Rupee' and not 'Rupees'."""
    res = number_to_indian_words(1.0)
    assert res == "One Rupee Only"
    assert "Rupees" not in res


def test_plural_rupees_handling():
    """Verify 2.00 outputs plural 'Rupees'."""
    res = number_to_indian_words(2.0)
    assert res == "Two Rupees Only"
    assert "Rupees" in res


def test_sub_rupee_handling():
    """Verify 0.50 outputs 'Zero Rupees and Fifty Paisa Only'."""
    res = number_to_indian_words(0.5)
    assert res == "Zero Rupees and Fifty Paisa Only"
    assert res.startswith("Zero Rupees")
