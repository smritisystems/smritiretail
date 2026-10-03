"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-09-26
Modified     : 2026-09-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.printer_service import PrinterService


def test_printer_service_zpl_generation():
    """
    Headless audit of Zebra ZPL-II label formatting.
    Verifies ^XA header, dots calculation (8 dots/mm), barcode, and ^XZ terminator.
    """
    zpl = PrinterService.generate_zpl_label(
        item_code="FW-OXF-01",
        barcode="8901234567890",
        name="Classic Derby Shoe Tan",
        price=1500.0,
        mrp=2999.0,
        size="42",
        color="Tan",
        brand="TATTLY",
        width_mm=50.0,
        height_mm=25.0
    )

    assert zpl.startswith("^XA")
    assert zpl.strip().endswith("^XZ")
    # Width 50mm * 8 = 400 dots, Height 25mm * 8 = 200 dots
    assert "^PW400" in zpl
    assert "^LL200" in zpl
    assert "TATTLY" in zpl
    assert "8901234567890" in zpl
    assert "Rs.2999.00" in zpl


def test_printer_service_tspl_generation():
    """
    Headless audit of TSC TSPL label formatting.
    Verifies SIZE, GAP, DIRECTION, CLS, BARCODE, and PRINT commands.
    """
    tspl = PrinterService.generate_tspl_label(
        item_code="FW-SNK-02",
        barcode="8901234567891",
        name="Air Knit Running Sneaker",
        price=1800.0,
        mrp=3499.0,
        size="41",
        width_mm=50.0,
        height_mm=25.0
    )

    assert "SIZE 50 mm, 25 mm" in tspl
    assert "GAP 2 mm, 0 mm" in tspl
    assert "DIRECTION 1" in tspl
    assert "CLS" in tspl
    assert "BARCODE 30,50,\"128\",40,1,0,2,2,\"8901234567891\"" in tspl
    assert "MRP: Rs.3499.00" in tspl
    assert "PRINT 1,1" in tspl


def test_printer_service_escpos_receipt_binary_generation():
    """
    Headless audit of 80mm ESC/POS thermal receipt formatting.
    Verifies initialization (\x1b\x40), bold tags, tabular item alignments, and paper cut (\x1d\x56\x42\x00).
    """
    items = [
        {"name": "Sneaker White 42", "quantity": 1, "price": 3499.0, "total_amount": 3499.0},
        {"name": "Cotton Socks 3PK", "quantity": 2, "price": 299.0, "total_amount": 598.0}
    ]

    receipt_bytes = PrinterService.generate_escpos_receipt(
        store_name="SMRITI PHOENIX STORE",
        invoice_no="INV-2026-8801",
        items=items,
        subtotal=4097.0,
        tax_total=204.85,
        grand_total=4301.85,
        cashier_name="Rahul V."
    )

    assert isinstance(receipt_bytes, bytes)
    # ESC @ initialization
    assert receipt_bytes.startswith(b"\x1b\x40")
    # Store Name & Header
    assert b"SMRITI PHOENIX STORE" in receipt_bytes
    assert b"TAX INVOICE / RETAIL RECEIPT" in receipt_bytes
    assert b"INV-2026-8801" in receipt_bytes
    assert b"Rahul V." in receipt_bytes
    assert b"Sneaker White 42" in receipt_bytes
    assert b"Cotton Socks 3PK" in receipt_bytes
    assert b"GRAND TOTAL:              Rs.   4301.85" in receipt_bytes
    # GS V paper cut
    assert b"\x1d\x56\x42\x00" in receipt_bytes


@pytest.mark.asyncio
async def test_printer_service_prn_dispatch_mode():
    """
    Headless audit of PRN file export dispatch mode.
    Ensures safe payload export and PrintHistory logging without socket I/O.
    """
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = None
    mock_session.execute.return_value = mock_result
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    payload = "^XA^PW400^LL200^FDTest^XZ"
    result = await PrinterService.dispatch_payload(
        session=mock_session,
        payload_data=payload,
        user_name="AUDIT_USER",
        item_code="SKU-TEST-01",
        dispatch_mode="prn",
        save_as_prn=True
    )

    assert result["success"] is True
    assert result["status"] == "PRN_GENERATED"
    assert result["dispatch_mode"] == "prn"
    assert "Generated PRN command stream" in result["message"]
    mock_session.add.assert_called_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_printer_service_qz_tray_dispatch_mode():
    """
    Headless audit of QZ Tray bridge dispatch mode.
    Verifies queued job packaging and base64/utf-8 encoding.
    """
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = None
    mock_session.execute.return_value = mock_result
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    payload = "^XA^PW400^LL200^FDQZ_TEST^XZ"
    result = await PrinterService.dispatch_payload(
        session=mock_session,
        payload_data=payload,
        user_name="AUDIT_USER",
        item_code="SKU-QZ-01",
        dispatch_mode="qz_tray"
    )

    assert result["success"] is True
    assert result["status"] == "QUEUED_QZ_TRAY"
    assert result["dispatch_mode"] == "qz_tray"
    assert result["language"] == "zpl"
    assert result["payload"] == payload
    mock_session.add.assert_called_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_printer_service_fault_isolated_tcp_failure():
    """
    Headless audit of TCP failure isolation.
    When network endpoint is unreachable, dispatch fails gracefully without exception raising.
    """
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    override_target = {
        "connection_type": "TCP",
        "ip": "127.0.0.1",
        "port": 59999,  # Non-listening port
        "timeout_sec": 0.2
    }

    result = await PrinterService.dispatch_payload(
        session=mock_session,
        payload_data="^XA^XZ",
        user_name="AUDIT_USER",
        item_code="SKU-TCP-01",
        dispatch_mode="server_tcp",
        override_target=override_target
    )

    assert result["success"] is False
    assert result["status"] == "FAILED"
    assert "Failed to dispatch" in result["message"]
    mock_session.add.assert_called_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_printer_service_run_diagnostics():
    """
    Headless audit of hardware-independent printer diagnostics.
    """
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars().first.return_value = None
    mock_session.execute.return_value = mock_result

    diag = await PrinterService.run_diagnostics(session=mock_session)

    assert diag["status"] == "OPERATIONAL_READY_WITH_GAPS"
    assert diag["software_engines"]["zebra_zpl_engine"] == "VERIFIED"
    assert diag["software_engines"]["tsc_tspl_engine"] == "VERIFIED"
    assert diag["software_engines"]["escpos_receipt_engine"] == "VERIFIED"
    assert "hardware_communication" in diag
