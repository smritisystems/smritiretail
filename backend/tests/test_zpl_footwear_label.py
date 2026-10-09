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

    def test_master_template_file_integrity(self):
        """
        Hard safety check: assert that client master PRN files remain 100% byte-for-byte immutable.
        """
        import hashlib

        def sha256_file(path):
            with open(path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest().upper()

        tattly_hash = sha256_file(RAW_TEMPLATE_PATH)
        assert tattly_hash == "E4C8B69847F16594A3A7013818CDE19D3D861FA4915709CC0B23320DEB6014D7", (
            f"Master file {RAW_TEMPLATE_PATH} has been modified! Expected E4C8B6..., found {tattly_hash}"
        )

        raw_script_path = os.path.join(ASSETS_DIR, "RawPRNScript.prn")
        assert os.path.exists(raw_script_path), f"RawPRNScript.prn missing at {raw_script_path}"
        raw_hash = sha256_file(raw_script_path)
        assert raw_hash == "224B32A66995333BBDACC6EAEFD2BF43E25D618B1DCCB8CDBB50653FB055E2AD", (
            f"Master file {raw_script_path} has been modified! Expected 224B32..., found {raw_hash}"
        )

    @pytest.mark.parametrize(
        "variant_id,barcode",
        [
            ("BLACK_37", "8904551005335"),
            ("BLACK_40", "8904551005366"),
            ("TOUPE_37", "8904551005403"),
            ("TOUPE_42", "8904551005458"),
        ]
    )
    def test_runtime_main_barcode_no_overlap_pixel_geometry(self, variant_id, barcode):
        """
        Regression assertion (v6.49.2):
        Verify that in the SMRITI runtime rendered label, the main barcode human-readable
        text does NOT visually intersect the barcode bars.
        Asserts pixel geometry: between bottom of barcode bars (Y=371) and top of human-readable text (Y=378),
        there is a clean white gap (zero black pixels) across X=390..530.
        """
        import httpx
        from app.api.v1.barcode import generate_footwear_3stub_zpl

        runtime_zpl = generate_footwear_3stub_zpl(
            item={
                "barcode": barcode,
                "size": "37",
                "color": "BLACK",
                "style": "CH-30-K",
                "mrp": 1199,
                "mfg_date": "10/26",
            },
            company_name="Tattly Threads",
            company_address="81,Umerkhadi,Mumbai,400003",
            company_email="care@tattlythreads.com",
            default_mfg_date="10/26",
        )

        assert "^FT390,399" in runtime_zpl, "Runtime generator must place text baseline at 399 to eliminate overlap"
        assert "^AAN,27,15" in runtime_zpl, "Runtime generator must preserve Font A (^AAN,27,15)"
        assert "^BY2^BCN,66,N,N" in runtime_zpl, "Runtime generator must preserve barcode height 66"

        xa_idx = runtime_zpl.rfind("^XA")
        xz_idx = runtime_zpl.rfind("^XZ")
        pure_zpl = runtime_zpl[xa_idx : xz_idx + 3]

        resp = httpx.post("http://api.labelary.com/v1/printers/8dpmm/labels/3.95x2/0/", data=pure_zpl.encode("utf-8"), timeout=15.0)
        assert resp.status_code == 200, f"Labelary render failed: {resp.text}"

        import io
        img = Image.open(io.BytesIO(resp.content)).convert("L")

        # 1. Barcode bars intact: rows Y=310..365 must have black pixels in X=390..530
        for y in range(315, 365, 10):
            cnt = sum(1 for x in range(390, 530) if img.getpixel((x, y)) < 128)
            assert cnt > 50, f"Barcode bars missing or corrupted at Y={y}"

        # 2. Separation gap: rows Y=372..376 must have ZERO black pixels across X=390..530
        for y in range(372, 377):
            cnt = sum(1 for x in range(390, 530) if img.getpixel((x, y)) < 128)
            assert cnt == 0, f"Collision detected at Y={y}: found {cnt} black pixels between bars and text!"

        # 3. Text digits intact: rows Y=385..395 must have black pixels in X=390..530
        text_pixels = sum(1 for x in range(390, 530) for y in range(385, 396) if img.getpixel((x, y)) < 128)
        assert text_pixels > 100, f"Human-readable text missing or corrupted below barcode"

    def test_stub_human_readable_fonts_preserved_and_distinct(self):
        """
        Verify Section 10: Font Verification
        - Stub 1 and Stub 2 human-readable barcodes use Font 0 (^A0N,25,34)
        - Main barcode human-readable barcode uses Font A (^AAN,27,15)
        - Font hierarchy remains distinct and intentional.
        """
        with open(RAW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
            prn = f.read()

        assert "^FT26,165\n^A0N,25,34" in prn or "^FT26,165\r\n^A0N,25,34" in prn
        assert "^FT26,394\n^A0N,25,34" in prn or "^FT26,394\r\n^A0N,25,34" in prn
        assert "^FT390,385\n^CI0\n^AAN,27,15" in prn or "^FT390,385\r\n^CI0\r\n^AAN,27,15" in prn

