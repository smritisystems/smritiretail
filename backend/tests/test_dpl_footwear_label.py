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
Source Module: Native 300 DPI DPL Footwear Label Unit Verification Suite
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas.barcodes import LabelCompileRequest
from app.services.barcodes_engine import BarcodesEngine
from app.services.printer_service import PrinterService


class TestDplFootwearLabelRenderer:
    """
    Focused verification suite for Native 300 DPI DPL Footwear Label Printing
    on IMPACT by Honeywell IH-2 desktop queue.
    """

    @pytest.mark.parametrize(
        "barcode,size,color,style,mrp,case_name",
        [
            ("8904551005335", "37", "BLACK", "CH-30-K", 1199, "CASE 1: BLACK / 37"),
            ("8904551005366", "40", "BLACK", "CH-30-K", 1199, "CASE 2: BLACK / 40"),
            ("8904551005403", "37", "TOUPE", "CH-30-K", 1199, "CASE 3: TOUPE / 37"),
            ("8904551005458", "42", "TOUPE", "CH-30-K", 1199, "CASE 4: TOUPE / 42"),
        ]
    )
    def test_four_required_footwear_variants(self, barcode, size, color, style, mrp, case_name):
        """
        Verify the four mandatory footwear cases from architectural audit.
        Assert presence of all resolved business fields, dynamic token validation,
        and absence of unresolved template braces.
        """
        dpl = PrinterService.generate_dpl_footwear_label(
            barcode=barcode,
            size=size,
            color=color,
            style=style,
            mrp=mrp,
        )

        # 1. Assert structural DPL headers, start/end framing, and density
        assert dpl.startswith("\x02L"), f"{case_name}: DPL must start with STX + L (0x02, 'L')"
        assert "D11\n" in dpl, f"{case_name}: DPL must contain pixel size command D11"
        assert "H16\n" in dpl, f"{case_name}: DPL must contain heat setting command H16"
        assert "Q0001\n" in dpl, f"{case_name}: DPL must contain quantity record Q0001"
        assert dpl.strip().endswith("E"), f"{case_name}: DPL must terminate with print command E"

        # 2. Assert DPL Code 128 barcode records (symbology identifier 'e')
        # Main barcode: Height 98 dots, narrow 2, wide 4
        assert f"1e4209804500510{barcode}" in dpl, f"{case_name}: Main Code 128 barcode missing or malformed"
        # Stub 1 barcode: Height 45 dots, narrow 2, wide 4
        assert f"1e4204501650050{barcode}" in dpl, f"{case_name}: Stub 1 Code 128 barcode missing or malformed"
        # Stub 2 barcode: Height 45 dots, narrow 2, wide 4
        assert f"1e4204504900049{barcode}" in dpl, f"{case_name}: Stub 2 Code 128 barcode missing or malformed"

        # 3. Assert all six resolved business values exist in DPL output
        assert barcode in dpl, f"{case_name}: Barcode {barcode} not found in DPL output"
        assert size in dpl, f"{case_name}: Size {size} not found in DPL output"
        assert color in dpl, f"{case_name}: Color {color} not found in DPL output"
        assert style in dpl, f"{case_name}: Style {style} not found in DPL output"
        assert str(mrp) in dpl, f"{case_name}: MRP {mrp} not found in DPL output"
        assert "MFG.Dt.: " in dpl, f"{case_name}: MFG/PKD date header not found in DPL output"

        # 4. Assert static legal and branding content
        assert "Tattly Threads" in dpl or "TATTLY THREADS" in dpl
        assert "81,Umerkhadi,Mumbai,400003" in dpl
        assert "care@tattlythreads.com" in dpl
        assert "NET CONTENTS: 1 Pair Footwear" in dpl
        assert "(Incl of all taxes)" in dpl
        assert "MKTD.By: Tattly Threads" in dpl

        # 5. Assert strict absence of unresolved token placeholders
        assert "{barcode}" not in dpl, f"{case_name}: Unresolved {{barcode}} leaked into output"
        assert "{size}" not in dpl, f"{case_name}: Unresolved {{size}} leaked into output"
        assert "{color}" not in dpl, f"{case_name}: Unresolved {{color}} leaked into output"
        assert "{style}" not in dpl, f"{case_name}: Unresolved {{style}} leaked into output"
        assert "{mrp}" not in dpl, f"{case_name}: Unresolved {{mrp}} leaked into output"
        assert "{pkd_date}" not in dpl, f"{case_name}: Unresolved {{pkd_date}} leaked into output"

        # 6. Assert strict absence of ZPL commands (DPL output must NOT emit ZPL)
        assert "^XA" not in dpl
        assert "^XZ" not in dpl
        assert "^FO" not in dpl
        assert "^FT" not in dpl
        assert "^BC" not in dpl

    def test_pkd_date_print_time_kolkata_generation(self):
        """
        Verify that pkd_date produces print-time date in Asia/Kolkata MM/YY format.
        Never outputs raw {pkd_date}.
        """
        dpl = PrinterService.generate_dpl_footwear_label(
            barcode="8904551005335",
            size="37",
            color="BLACK",
            style="CH-30-K",
            mrp=1199,
            pkd_date=None,  # Renderer must compute at print-time
        )

        import re
        # Assert format: MFG.Dt.: MM/YY (e.g. 10/26)
        match = re.search(r"MFG\.Dt\.: (\d{2}/\d{2})", dpl)
        assert match is not None, "MFG.Dt.: MM/YY pattern not matched in output"
        assert match.group(1) != "{pkd_date}"

    def test_mandatory_token_validation_failures(self):
        """
        Verify Section 16: If any of the six mandatory tokens is empty/missing,
        the print request MUST fail with ValueError.
        """
        # Missing barcode
        with pytest.raises(ValueError, match="barcode"):
            PrinterService.generate_dpl_footwear_label(
                barcode="", size="37", color="BLACK", style="CH-30-K", mrp=1199
            )

        # Missing size
        with pytest.raises(ValueError, match="size"):
            PrinterService.generate_dpl_footwear_label(
                barcode="8904551005335", size="", color="BLACK", style="CH-30-K", mrp=1199
            )

        # Missing color
        with pytest.raises(ValueError, match="color"):
            PrinterService.generate_dpl_footwear_label(
                barcode="8904551005335", size="37", color="", style="CH-30-K", mrp=1199
            )

        # Missing style
        with pytest.raises(ValueError, match="style"):
            PrinterService.generate_dpl_footwear_label(
                barcode="8904551005335", size="37", color="BLACK", style="", mrp=1199
            )

        # Missing mrp
        with pytest.raises(ValueError, match="mrp"):
            PrinterService.generate_dpl_footwear_label(
                barcode="8904551005335", size="37", color="BLACK", style="CH-30-K", mrp=None
            )

        # Explicitly empty pkd_date
        with pytest.raises(ValueError, match="pkd_date"):
            PrinterService.generate_dpl_footwear_label(
                barcode="8904551005335", size="37", color="BLACK", style="CH-30-K", mrp=1199, pkd_date=""
            )

    def test_barcodes_engine_dpl_footwear_routing(self):
        """
        Verify BarcodesEngine routes 100x50.7mm DPL requests to native footwear renderer,
        and smaller dimensions to standard DPL single tag renderer.
        """
        # Footwear label request (100mm x 50.7mm)
        req_footwear = LabelCompileRequest(
            printer_language="DPL",
            dpi=300,
            width_mm=100.0,
            height_mm=50.7,
            item_code="CH-30-K",
            item_name="Footwear CH-30-K",
            barcode="8904551005335",
            mrp=Decimal("1199.00"),
            selling_price=Decimal("1199.00"),
            size="37",
            color="BLACK",
            style="CH-30-K"
        )
        res_footwear = BarcodesEngine.compile_label_stream(req_footwear)
        assert res_footwear.printer_language == "DPL"
        assert "\x02L" in res_footwear.compiled_command_stream
        assert "1X1100000000370L000599" in res_footwear.compiled_command_stream  # Vertical divider
        assert "1e42098045005108904551005335" in res_footwear.compiled_command_stream
        assert "^XA" not in res_footwear.compiled_command_stream

        # Standard retail label request (50mm x 25mm)
        req_standard = LabelCompileRequest(
            printer_language="DPL",
            dpi=203,
            width_mm=50.0,
            height_mm=25.0,
            item_code="SKU-STD-01",
            item_name="Standard T-Shirt",
            barcode="8901234567890",
            mrp=Decimal("599.00"),
            selling_price=Decimal("499.00"),
            size="M",
            color="BLUE"
        )
        res_standard = BarcodesEngine.compile_label_stream(req_standard)
        assert res_standard.printer_language == "DPL"
        assert "\x02L" in res_standard.compiled_command_stream
        assert "1e42020011000208901234567890" in res_standard.compiled_command_stream
        assert "^XA" not in res_standard.compiled_command_stream

    @pytest.mark.asyncio
    async def test_printer_service_dpl_dispatch_qz_detection(self):
        """
        Verify PrinterService.dispatch_payload dynamically returns language='dpl'
        for QZ Tray when given DPL command streams.
        """
        mock_session = AsyncMock()
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars().first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        dpl_payload = PrinterService.generate_dpl_footwear_label(
            barcode="8904551005335",
            size="37",
            color="BLACK",
            style="CH-30-K",
            mrp=1199
        )

        result = await PrinterService.dispatch_payload(
            session=mock_session,
            payload_data=dpl_payload,
            user_name="TEST_ADMIN",
            item_code="CH-30-K-BLK-37",
            dispatch_mode="qz_tray"
        )

        assert result["success"] is True
        assert result["dispatch_mode"] == "qz_tray"
        assert result["language"] == "dpl", "PrinterService must detect DPL stream and set language='dpl' for QZ Tray"
        assert result["payload"] == dpl_payload
