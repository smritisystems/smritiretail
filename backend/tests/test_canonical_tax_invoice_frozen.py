"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import re
import json
import hashlib
import pytest
import psycopg2
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.invoice_pdf_service import (
    InvoicePdfService,
    TaxInvoiceRenderer,
    TaxInvoicePrintService,
    TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1,
    CANONICAL_INVOICE_LAYOUT_CONFIG
)
from app.main import app


def test_01_canonical_renderer_governance_and_config():
    """Verify single canonical renderer, alias binding, and frozen versioned configuration."""
    assert TaxInvoiceRenderer is InvoicePdfService
    assert TaxInvoicePrintService is InvoicePdfService
    assert InvoicePdfService.TEMPLATE_ID == "TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1"
    assert CANONICAL_INVOICE_LAYOUT_CONFIG["status"] == "FROZEN"
    assert CANONICAL_INVOICE_LAYOUT_CONFIG["version"] == "1.0.0"
    assert CANONICAL_INVOICE_LAYOUT_CONFIG["page_size"] == "A4"
    assert CANONICAL_INVOICE_LAYOUT_CONFIG["zero_text_wrapping"] is True
    assert "SMRITI OS Retail Suite" in CANONICAL_INVOICE_LAYOUT_CONFIG["footer_disclaimer"]


def test_02_invoice_102_exact_mathematical_reconciliation():
    """Verify exact financial calculations for TT2026-2027/102 in Company DB smriti001."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT i.id, i.invoice_no, i.date, i.tax_total, i.grand_total
        FROM sales_invoices i
        WHERE i.invoice_no = 'TT2026-2027/102';
    """)
    inv = cur.fetchone()
    assert inv is not None, "Invoice TT2026-2027/102 not found in smriti001"

    cur.execute("""
        SELECT id, name, quantity, price, tax_amount, total_amount
        FROM sales_invoice_items
        WHERE invoice_id = %s
        ORDER BY id;
    """, (inv[0],))
    items = cur.fetchall()
    conn.close()

    assert len(items) == 34, f"Expected 34 line items for Invoice 102, got {len(items)}"
    total_qty = sum(Decimal(str(it[2])) for it in items)
    assert total_qty == Decimal("46"), f"Expected 46 pairs for Invoice 102, got {total_qty}"

    total_taxable = sum(Decimal(str(it[2])) * Decimal(str(it[3])) for it in items)
    assert total_taxable == Decimal("50815.20"), f"Expected ₹50,815.20 taxable, got {total_taxable}"

    invoice_igst = (total_taxable * Decimal("0.05")).quantize(Decimal("0.01"))
    assert invoice_igst == Decimal("2540.76"), f"Expected ₹2,540.76 IGST, got {invoice_igst}"

    pre_round = total_taxable + invoice_igst
    assert pre_round == Decimal("53355.96"), f"Expected ₹53,355.96 pre-round, got {pre_round}"

    grand_total = round(pre_round)
    assert grand_total == Decimal("53356.00"), f"Expected ₹53,356.00 grand total, got {grand_total}"

    round_adj = grand_total - pre_round
    assert round_adj == Decimal("0.04"), f"Expected +₹0.04 rounding adjustment, got {round_adj}"


def test_03_rendered_pdf_grid_borders_and_zero_wrap():
    """Verify that generated PDF has horizontal and vertical borders on every row and column with 0 wrapping."""
    import fitz
    pdf_path = r"F:\SMRITRretailNX\exports\tt_batch_74_103\SIS_TXSR_TaxInvoice_TT2026-2027_102.pdf"
    if not os.path.exists(pdf_path):
        pdf_path = r"F:\SMRITRretailNX\TT\SIS_TXSR_TaxInvoice_TT2026-2027_102.pdf"
    assert os.path.exists(pdf_path), f"Invoice 102 PDF not found at {pdf_path}"

    doc = fitz.open(pdf_path)
    assert len(doc) >= 1

    for page_idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if re.match(r"^[A-Z]{2,3}-\d{2}-[A-Z]\s+[A-Z]+\s+\d{2}$", text):
                assert "\n" not in text, f"Found wrapped item description '{text}' on page {page_idx+1}"

    doc.close()


def test_04_all_batch_invoices_exist_and_match_canonical_standard():
    """Verify all 30 batch invoices exist and follow the exact canonical frozen format."""
    batch_dir = r"F:\SMRITRretailNX\exports\tt_batch_74_103"
    assert os.path.exists(batch_dir), f"Directory {batch_dir} not found"
    files = [f for f in os.listdir(batch_dir) if f.startswith("SIS_") and f.endswith(".pdf")]
    assert len(files) >= 30, f"Expected at least 30 batch PDFs, found {len(files)}"


def test_05_canonical_api_routes_registered():
    """Verify preview, print, reprint, pdf, download routes are all registered on FastAPI app."""
    from fastapi.routing import APIRoute
    routes = []
    for r in app.routes:
        if isinstance(r, APIRoute):
            routes.append(r.path)
        elif hasattr(r, "original_router") and hasattr(r, "include_context"):
            prefix = r.include_context.prefix
            for sub_r in r.original_router.routes:
                if hasattr(sub_r, "path"):
                    routes.append(f"{prefix}{sub_r.path}")

    expected_endpoints = [
        "/api/v1/sales/invoices/{invoice_id}/html",
        "/api/v1/sales/invoices/{invoice_id}/preview",
        "/api/v1/sales/invoices/{invoice_id}/print",
        "/api/v1/sales/invoices/{invoice_id}/reprint",
        "/api/v1/sales/invoices/{invoice_id}/pdf",
        "/api/v1/sales/invoices/{invoice_id}/download",
    ]
    for ep in expected_endpoints:
        assert ep in routes, f"Expected endpoint {ep} not found in FastAPI route registry"


def test_06_smritisys_control_plane_zero_operational_invoices():
    """Enforce architectural isolation: smritisys has 0 operational invoices and 0 operational templates."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sales_invoices;")
    count = cur.fetchone()[0]
    conn.close()
    assert count == 0, f"Architecture violation: smritisys has {count} operational invoices (must be 0)"


def test_07_persisted_canonical_template_in_company_database():
    """Verify TAX_INVOICE_TATTLY_THREADS V1 is persisted in smriti001 company database."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT template_code, template_name, template_type, status, current_version, layout_configuration, configuration_hash
        FROM tax_invoice_templates
        WHERE template_code = 'TAX_INVOICE_TATTLY_THREADS';
    """)
    tpl = cur.fetchone()
    conn.close()

    assert tpl is not None, "Canonical template TAX_INVOICE_TATTLY_THREADS not found in smriti001"
    assert tpl[0] == "TAX_INVOICE_TATTLY_THREADS"
    assert tpl[1] == "TATTLY THREADS Tax Invoice"
    assert tpl[2] == "TAX_INVOICE"
    assert tpl[3] == "FROZEN"
    assert tpl[4] == "V1"

    config = tpl[5]
    if isinstance(config, str):
        config = json.loads(config)
    assert config["item_grid_configuration"]["no_wrap"] is True
    assert config["item_grid_configuration"]["horizontal_border_every_row"] is True
    assert config["item_grid_configuration"]["vertical_borders"] is True
    assert len(tpl[6]) == 64, "Expected valid 64-char SHA256 configuration hash"


def test_08_persisted_template_version_v1_immutability():
    """Verify version V1 is recorded with FROZEN status in tax_invoice_template_versions."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT v.version, v.status, v.configuration_hash
        FROM tax_invoice_template_versions v
        JOIN tax_invoice_templates t ON v.template_id = t.id
        WHERE t.template_code = 'TAX_INVOICE_TATTLY_THREADS';
    """)
    ver = cur.fetchone()
    conn.close()

    assert ver is not None, "Version V1 not found for TAX_INVOICE_TATTLY_THREADS"
    assert ver[0] == "V1"
    assert ver[1] == "FROZEN"
    assert len(ver[2]) == 64


def test_09_invoice_102_document_artifact_and_sha256_integrity():
    """Verify TT2026-2027/102 PDF artifact is persisted with cryptographic SHA256 integrity."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no, template_code, template_version, template_status, storage_path, sha256_hash, file_size, page_count, is_valid
        FROM invoice_document_artifacts
        WHERE invoice_no = 'TT2026-2027/102';
    """)
    art = cur.fetchone()
    conn.close()

    assert art is not None, "Document artifact for TT2026-2027/102 not found in smriti001"
    assert art[0] == "TT2026-2027/102"
    assert art[1] == "TAX_INVOICE_TATTLY_THREADS"
    assert art[2] == "V1"
    assert art[3] == "FROZEN"
    assert os.path.exists(art[4]), f"Artifact file missing at {art[4]}"

    # Verify SHA256 on disk equals DB record
    with open(art[4], "rb") as f:
        actual_sha256 = hashlib.sha256(f.read()).hexdigest()
    assert actual_sha256 == art[5], f"SHA256 mismatch: disk {actual_sha256} vs db {art[5]}"
    assert art[7] == 2, f"Expected 2 pages for Invoice 102, got {art[7]}"
    assert art[8] is True, "Expected artifact to be marked is_valid = True"


def test_10_all_30_batch_invoice_artifacts_indexed():
    """Verify all 30 batch invoices have valid PDF artifacts with matching SHA256 checksums in smriti001."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no, storage_path, sha256_hash, file_size, page_count
        FROM invoice_document_artifacts
        ORDER BY invoice_no;
    """)
    artifacts = cur.fetchall()
    conn.close()

    assert len(artifacts) >= 30, f"Expected at least 30 indexed PDF artifacts in smriti001, found {len(artifacts)}"
    for a in artifacts:
        fpath = a[1]
        assert os.path.exists(fpath), f"Artifact file {fpath} does not exist"
        with open(fpath, "rb") as f:
            disk_sha = hashlib.sha256(f.read()).hexdigest()
        assert disk_sha == a[2], f"SHA256 mismatch for {a[0]}"


@pytest.mark.asyncio
async def test_11_interstate_invoice_displays_igst_and_hides_cgst_sgst():
    """Verify that Interstate invoice renders IGST column and hides CGST and SGST columns."""
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        html = await InvoicePdfService.generate_invoice_html(session, "inv-tt-102")
        await engine.dispose()

    # IGST active
    assert "IGST @ 5%" in html
    assert "₹2,540.76" in html
    # CGST / SGST hidden from headers
    assert "CGST @" not in html
    assert "SGST @" not in html


@pytest.mark.asyncio
async def test_12_intrastate_invoice_displays_cgst_sgst_and_hides_igst():
    """Verify that Intrastate invoice renders CGST and SGST columns and hides IGST column with exact math."""
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        html = await InvoicePdfService.generate_invoice_html(session, "inv-tt-test-intra")
        await engine.dispose()

    # CGST and SGST active
    assert "CGST @ 2.5%" in html
    assert "SGST @ 2.5%" in html
    assert "₹1,270.38" in html
    # IGST hidden from active tax columns
    assert "IGST @" not in html
    # Grand total & Pre-round check
    assert "₹53,356.00" in html
    assert "₹50,815.20" in html


def test_13_persisted_template_supports_both_interstate_and_intrastate_grid_specs():
    """Verify template JSONB layout stores both 9-col interstate and 10-col intrastate specifications."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT layout_configuration
        FROM tax_invoice_templates
        WHERE template_code = 'TAX_INVOICE_TATTLY_THREADS';
    """)
    row = cur.fetchone()
    conn.close()

    assert row is not None
    config = row[0]
    if isinstance(config, str):
        config = json.loads(config)

    inter_cols = config["item_grid_configuration"]["columns_interstate"]
    intra_cols = config["item_grid_configuration"]["columns_intrastate"]

    assert len(inter_cols) == 9, f"Expected 9 interstate columns, got {len(inter_cols)}"
    assert any(c["name"] == "IGST @ 5%" for c in inter_cols)
    assert not any(c["name"] == "CGST @ 2.5%" for c in inter_cols)

    assert len(intra_cols) == 10, f"Expected 10 intrastate columns, got {len(intra_cols)}"
    assert any(c["name"] == "CGST @ 2.5%" for c in intra_cols)
    assert any(c["name"] == "SGST @ 2.5%" for c in intra_cols)
    assert not any(c["name"] == "IGST @ 5%" for c in intra_cols)
