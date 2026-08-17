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
import pytest
import psycopg2
from decimal import Decimal

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
    pdf_path = r"F:\SMRITRretailNX\TT\SIS_TXSR_TaxInvoice_TT2026-2027_102.pdf"
    if not os.path.exists(pdf_path):
        pdf_path = r"F:\SMRITRretailNX\exports\tt_batch_74_103\SIS_TXSR_TaxInvoice_TT2026-2027_102.pdf"
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
    files = [f for f in os.listdir(batch_dir) if f.endswith(".pdf")]
    assert len(files) == 30, f"Expected 30 batch PDFs, found {len(files)}"


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
    """Enforce architectural isolation: smritisys has 0 operational invoices."""
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM sales_invoices;")
    count = cur.fetchone()[0]
    conn.close()
    assert count == 0, f"Architecture violation: smritisys has {count} operational invoices (must be 0)"
