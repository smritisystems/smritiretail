"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.barcode import PrintHistory
from app.services.barcodes_engine import BarcodesEngine
from app.schemas.barcodes import (
    BarcodeGenerateRequest,
    BarcodeValidateRequest,
    LabelCompileRequest,
    BatchLabelPrintRequest,
    BatchLabelItem,
)


def _get_auth_headers(role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_ean13_and_upca_check_digit_generation_and_validation():
    """Verify GS1 EAN-13 and UPC-A Modulo 10 check digit calculations and validation."""
    # EAN-13: "890123456789" -> odd_sum + 3*even_sum -> check digit
    gen_ean = BarcodesEngine.generate_barcode_value(
        BarcodeGenerateRequest(symbology="EAN13", seed_digits="890123456789")
    )
    assert len(gen_ean.barcode_value) == 13
    assert gen_ean.is_checksum_valid == True

    # Validate EAN-13
    val_ean = BarcodesEngine.validate_barcode_checksum(
        BarcodeValidateRequest(barcode=gen_ean.barcode_value, symbology="EAN13")
    )
    assert val_ean.is_valid == True
    assert val_ean.validation_message == "Checksum valid"

    # Corrupt check digit -> validation must fail
    corrupted_ean = gen_ean.barcode_value[:12] + ("0" if gen_ean.barcode_value[12] != "0" else "1")
    val_corrupt = BarcodesEngine.validate_barcode_checksum(
        BarcodeValidateRequest(barcode=corrupted_ean, symbology="EAN13")
    )
    assert val_corrupt.is_valid == False
    assert "Invalid check digit" in val_corrupt.validation_message

    # UPC-A: 11 digits seed -> 12 digits
    gen_upc = BarcodesEngine.generate_barcode_value(
        BarcodeGenerateRequest(symbology="UPC_A", seed_digits="01234567890")
    )
    assert len(gen_upc.barcode_value) == 12
    val_upc = BarcodesEngine.validate_barcode_checksum(
        BarcodeValidateRequest(barcode=gen_upc.barcode_value, symbology="UPC_A")
    )
    assert val_upc.is_valid == True


@pytest.mark.asyncio
async def test_code128_and_qr_code_generation():
    """Verify alphanumeric CODE128 and QR code generation."""
    gen_c128 = BarcodesEngine.generate_barcode_value(
        BarcodeGenerateRequest(symbology="CODE128", seed_digits="SKU-POLO-BLUE-XL")
    )
    assert gen_c128.barcode_value == "SKU-POLO-BLUE-XL"
    assert gen_c128.symbology == "CODE128"

    gen_qr = BarcodesEngine.generate_barcode_value(
        BarcodeGenerateRequest(symbology="QR_CODE", seed_digits="https://smritiretail.com/item/1001")
    )
    assert gen_qr.barcode_value == "https://smritiretail.com/item/1001"
    assert gen_qr.symbology == "QR_CODE"


@pytest.mark.asyncio
async def test_zpl_thermal_label_compilation_and_dpi_scaling():
    """Verify Zebra ZPL-II command stream generation and DPI scaling."""
    # 203 DPI (8 dots/mm) on 50x25mm -> PW400, LL200
    res_203 = BarcodesEngine.compile_label_stream(
        LabelCompileRequest(
            printer_language="ZPL",
            dpi=203,
            width_mm=50.0,
            height_mm=25.0,
            item_code="ITM-001",
            item_name="Mens Denim Jeans",
            barcode="8901234567897",
            mrp=Decimal("1999.00"),
            selling_price=Decimal("1499.00"),
            brand="SMRITI DENIM",
        )
    )
    assert "^XA" in res_203.compiled_command_stream
    assert "^PW400" in res_203.compiled_command_stream
    assert "^LL200" in res_203.compiled_command_stream
    assert "^FD8901234567897^FS" in res_203.compiled_command_stream
    assert "MRP: Rs. 1999.00" in res_203.compiled_command_stream
    assert "^XZ" in res_203.compiled_command_stream

    # 300 DPI (12 dots/mm) on 50x25mm -> PW600, LL300
    res_300 = BarcodesEngine.compile_label_stream(
        LabelCompileRequest(
            printer_language="ZPL",
            dpi=300,
            width_mm=50.0,
            height_mm=25.0,
            item_code="ITM-001",
            item_name="Mens Denim Jeans",
            barcode="8901234567897",
            mrp=Decimal("1999.00"),
            selling_price=Decimal("1499.00"),
        )
    )
    assert "^PW600" in res_300.compiled_command_stream
    assert "^LL300" in res_300.compiled_command_stream


@pytest.mark.asyncio
async def test_tspl_and_esc_pos_label_compilation():
    """Verify TSC TSPL and ESC/POS printer byte stream compilation."""
    # TSPL
    tspl_res = BarcodesEngine.compile_label_stream(
        LabelCompileRequest(
            printer_language="TSPL",
            dpi=203,
            width_mm=50.0,
            height_mm=25.0,
            item_code="ITM-002",
            item_name="Cotton T-Shirt",
            barcode="8909876543210",
            mrp=Decimal("599.00"),
            selling_price=Decimal("399.00"),
        )
    )
    assert "SIZE 50.0 mm, 25.0 mm" in tspl_res.compiled_command_stream
    assert 'BARCODE 20,65,"128",45,1,0,2,2,"8909876543210"' in tspl_res.compiled_command_stream
    assert "PRINT 1" in tspl_res.compiled_command_stream

    # ESC/POS
    esc_res = BarcodesEngine.compile_label_stream(
        LabelCompileRequest(
            printer_language="ESC_POS",
            dpi=203,
            width_mm=50.0,
            height_mm=25.0,
            item_code="ITM-002",
            item_name="Cotton T-Shirt",
            barcode="8909876543210",
            mrp=Decimal("599.00"),
            selling_price=Decimal("399.00"),
        )
    )
    assert "8909876543210" in esc_res.compiled_command_stream
    assert esc_res.byte_count > 0


@pytest.mark.asyncio
async def test_batch_label_print_dispatch_and_audit_history():
    """Verify multi-item batch label print dispatch and PostgreSQL PrintHistory audit logging."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6]
    bc1 = f"890{unique_suffix.upper()[:9].zfill(9)}1"
    bc2 = f"890{unique_suffix.upper()[:9].zfill(9)}2"

    async with sessionmaker() as session:
        req = BatchLabelPrintRequest(
            printer_language="ZPL",
            dpi=203,
            items=[
                BatchLabelItem(
                    item_code=f"ITM-1-{unique_suffix}",
                    item_name="Formal Shirt",
                    barcode=bc1,
                    mrp=Decimal("1200.00"),
                    selling_price=Decimal("999.00"),
                    quantity=3,
                ),
                BatchLabelItem(
                    item_code=f"ITM-2-{unique_suffix}",
                    item_name="Silk Tie",
                    barcode=bc2,
                    mrp=Decimal("450.00"),
                    selling_price=Decimal("350.00"),
                    quantity=2,
                ),
            ],
        )

        res = await BarcodesEngine.dispatch_batch_print_job(session, "COMP-001", req, created_by="usr-super")
        assert res.total_labels_spooled == 5
        assert res.status == "SPOOLED"

        # Verify PrintHistory records in database
        stmt = select(PrintHistory).where(
            PrintHistory.company_id == "COMP-001",
            PrintHistory.barcode.in_([bc1, bc2]),
        )
        logs = (await session.execute(stmt)).scalars().all()
        assert len(logs) == 2
        quantities = {l.barcode: l.quantity for l in logs}
        assert quantities[bc1] == 3
        assert quantities[bc2] == 2


@pytest.mark.asyncio
async def test_api_barcodes_endpoints():
    """Verify REST API barcodes endpoints: generate, validate, compile, print/batch, and history."""
    unique_suffix = uuid.uuid4().hex[:4]
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Generate barcode
        gen_res = await client.post(
            "/api/v1/barcodes/generate",
            json={"symbology": "EAN13", "prefix": "890"},
            headers=_get_auth_headers(),
        )
        assert gen_res.status_code == 200
        bc_val = gen_res.json()["barcode_value"]
        assert len(bc_val) == 13

        # 2. Validate barcode
        val_res = await client.post(
            "/api/v1/barcodes/validate",
            json={"barcode": bc_val, "symbology": "EAN13"},
            headers=_get_auth_headers(),
        )
        assert val_res.status_code == 200
        assert val_res.json()["is_valid"] == True

        # 3. Compile label
        cmp_res = await client.post(
            "/api/v1/barcodes/compile",
            json={
                "printer_language": "ZPL",
                "dpi": 203,
                "width_mm": 50.0,
                "height_mm": 25.0,
                "item_code": f"ITM-API-{unique_suffix}",
                "item_name": "API Test Product",
                "barcode": bc_val,
                "mrp": 999.0,
                "selling_price": 799.0,
            },
            headers=_get_auth_headers(),
        )
        assert cmp_res.status_code == 200
        assert "^XA" in cmp_res.json()["compiled_command_stream"]

        # 4. Dispatch batch print via API
        prn_res = await client.post(
            "/api/v1/barcodes/print/batch",
            json={
                "printer_language": "ZPL",
                "dpi": 203,
                "items": [
                    {
                        "item_code": f"ITM-API-{unique_suffix}",
                        "item_name": "API Test Product",
                        "barcode": bc_val,
                        "mrp": 999.0,
                        "selling_price": 799.0,
                        "quantity": 1,
                    }
                ],
            },
            headers=_get_auth_headers(),
        )
        assert prn_res.status_code == 201
        assert prn_res.json()["total_labels_spooled"] == 1

        # 5. Query history via API
        hist_res = await client.get("/api/v1/barcodes/history?limit=10", headers=_get_auth_headers())
        assert hist_res.status_code == 200
        assert len(hist_res.json()) >= 1
