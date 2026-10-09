"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.0
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: ZPL Footwear Label Automated Validation Test Suite
"""

import os
import re
from datetime import datetime, timezone
from typing import Dict, Any
from PIL import Image
import pytest

RAW_TEMPLATE_PATH = r"f:\SMRITRretailNX\assets\BarcodePRN\TattlyThreads.prn"
ASSETS_DIR = r"f:\SMRITRretailNX\assets\BarcodePRN"


@pytest.fixture(scope="module")
def raw_prn_template():
    assert os.path.exists(RAW_TEMPLATE_PATH), f"Raw PRN template missing at {RAW_TEMPLATE_PATH}"
    with open(RAW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        return f.read()


class TestZplFootwearLabelValidation:
    """
    Automated verification suite for Tattly Threads 100x50.7mm 3-Zone Footwear ZPL Label.
    """

    def test_step1_template_structure(self, raw_prn_template):
        """
        Step 1: Parse the supplied PRN exactly.
        Confirm:
        - valid ZPL structure
        - ^XA / ^XZ balance (exactly 2 pairs)
        - XPML wrapper integrity
        - label pitch = 50.7 mm
        - ^PW804
        - expected 100 x 50.7 mm physical layout
        """
        prn = raw_prn_template
        assert prn.count("^XA") == 2, "Expected exactly 2 ^XA blocks"
        assert prn.count("^XZ") == 2, "Expected exactly 2 ^XZ blocks"
        assert prn.startswith("<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA"), "XPML header malformed"
        assert prn.strip().endswith("<xpml></page></xpml><xpml><end/></xpml>"), "XPML ending tag malformed"
        assert prn.count("pitch='50.7 mm'") == 2, "Pitch 50.7mm must be declared on both pages"
        assert "^PW804" in prn, "Print width command ^PW804 missing"
        assert "^SZ2" in prn, "^SZ2 command missing"
        assert "^JMA" in prn, "^JMA command missing"
        assert "^JZY" in prn, "^JZY command missing"
        assert "^LH0,0^LRN" in prn, "Label home/reverse command missing"

    def test_step2_placeholder_counts(self, raw_prn_template):
        """
        Step 2: Identify every dynamic placeholder.
        Expected:
        {barcode}    = 6 occurrences
        {size}       = 3 occurrences
        {colour}     = 3 occurrences
        {style_code} = 3 occurrences
        {mrp}        = 3 occurrences
        {pkd_date}   = 1 occurrence
        TOTAL = 19 placeholder occurrences.
        """
        tokens = re.findall(r"\{([a-zA-Z0-9_]+)\}", raw_prn_template)
        from collections import Counter
        counts = Counter(tokens)

        assert counts["barcode"] == 6, f"Expected 6 {{barcode}}, found {counts['barcode']}"
        assert counts["size"] == 3, f"Expected 3 {{size}}, found {counts['size']}"
        assert counts["colour"] == 3, f"Expected 3 {{colour}}, found {counts['colour']}"
        assert counts["style_code"] == 3, f"Expected 3 {{style_code}}, found {counts['style_code']}"
        assert counts["mrp"] == 3, f"Expected 3 {{mrp}}, found {counts['mrp']}"
        assert counts["pkd_date"] == 1, f"Expected 1 {{pkd_date}}, found {counts['pkd_date']}"

        assert len(tokens) == 19, f"Expected 19 total placeholders, found {len(tokens)}"
        assert set(counts.keys()) == {"barcode", "size", "colour", "style_code", "mrp", "pkd_date"}

    @pytest.mark.parametrize(
        "barcode,size,colour,style_code,mrp,file_prefix",
        [
            ("8904551005335", "37", "BLACK", "CH-30-K", 1199, "TATTLY_BLACK_37"),
            ("8904551005366", "40", "BLACK", "CH-30-K", 1199, "TATTLY_BLACK_40"),
            ("8904551005403", "37", "TOUPE", "CH-30-K", 1199, "TATTLY_TOUPE_37"),
            ("8904551005458", "42", "TOUPE", "CH-30-K", 1199, "TATTLY_TOUPE_42"),
        ]
    )
    def test_step3_to_step8_live_variant_resolution(
        self, raw_prn_template, barcode, size, colour, style_code, mrp, file_prefix
    ):
        """
        Steps 3, 4, 5, 6, 7, 8:
        Verify live substitution, zero unresolved placeholders, PRN existence,
        rendered PNG existence, visual metrics, and barcode parity.
        """
        # 1. Verify PRN file exists
        prn_path = os.path.join(ASSETS_DIR, f"{file_prefix}.prn")
        assert os.path.exists(prn_path), f"PRN file missing: {prn_path}"
        with open(prn_path, "r", encoding="utf-8") as f:
            resolved_prn = f.read()

        # 2. Assert zero unresolved placeholders
        unresolved = re.findall(r"\{[a-zA-Z0-9_]+\}", resolved_prn)
        assert len(unresolved) == 0, f"Unresolved placeholders found in {file_prefix}: {unresolved}"

        # 3. Barcode validation: appears in all 6 locations
        assert resolved_prn.count(barcode) == 6, f"Barcode {barcode} did not appear 6 times"
        assert f"^FD{barcode}^FS" in resolved_prn

        # 4. Size validation: appears in 3 locations
        assert resolved_prn.count(f"^FD{size}^FS") == 3, f"Size {size} did not appear 3 times"

        # 5. Colour validation: appears in 3 locations
        assert resolved_prn.count(f"^FD{colour}^FS") == 3, f"Colour {colour} did not appear 3 times"

        # 6. Style code validation: appears in 3 locations
        assert resolved_prn.count(style_code) == 3, f"Style code {style_code} did not appear 3 times"

        # 7. MRP validation: appears in 3 locations
        assert resolved_prn.count(f"{mrp}/-") == 3, f"MRP {mrp}/- did not appear 3 times"

        # 8. PKD date validation
        assert "MFG.Dt.:" in resolved_prn

        # 9. Headless Screenshot validation
        png_path = os.path.join(ASSETS_DIR, f"{file_prefix}.png")
        assert os.path.exists(png_path), f"PNG screenshot missing: {png_path}"
        assert os.path.getsize(png_path) > 10000, f"PNG screenshot file size unexpectedly small"

        # 10. Visual layout inspection
        img = Image.open(png_path)
        w, h = img.size
        assert 790 <= w <= 820, f"Unexpected width {w}"
        assert 395 <= h <= 420, f"Unexpected height {h}"

        # Ensure image is not blank
        extrema = img.convert("L").getextrema()
        assert extrema[0] < extrema[1], "Rendered label image is blank"

        # Inspect Zone 1 (Upper stub), Zone 2 (Lower stub), Zone 3 (Main box)
        crop1 = img.crop((0, 0, min(250, w), min(200, h))).convert("L")
        assert crop1.getextrema()[0] < crop1.getextrema()[1], "Zone 1 (upper stub) is blank"

        crop2 = img.crop((0, min(200, h), min(250, w), h)).convert("L")
        assert crop2.getextrema()[0] < crop2.getextrema()[1], "Zone 2 (lower stub) is blank"

        crop3 = img.crop((min(250, w), 0, w, h)).convert("L")
        assert crop3.getextrema()[0] < crop3.getextrema()[1], "Zone 3 (main box) is blank"
