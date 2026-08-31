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
import io
import datetime
from decimal import Decimal
import pytest
import psycopg2
import fitz

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

COMPANY_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
CONTROL_PLANE_DB_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"
TT_DIR = r"F:\SMRITRretailNX\TT"
EXPORTS_PDF_DIR = r"F:\SMRITRretailNX\exports\tt_batch_74_103"
TATTLY_LOGO_PATH = os.path.join(TT_DIR, "logo", "tattly_logo_black.png")


def test_01_historical_invoices_72_and_73_exist():
    """1. Verify that historical invoice PDFs TT2026-2027/72 and 73 exist and are intact."""
    pdf_72 = os.path.join(TT_DIR, "SIS_T9IM_TaxInvoice_TT2026-2027_72.pdf")
    pdf_73 = os.path.join(TT_DIR, "SIS_8319_TaxInvoice_TT2026-2027_73.pdf")
    assert os.path.exists(pdf_72), f"Missing historical PDF: {pdf_72}"
    assert os.path.exists(pdf_73), f"Missing historical PDF: {pdf_73}"
    assert os.path.getsize(pdf_72) > 10000, "Historical PDF 72 is empty or truncated"
    assert os.path.getsize(pdf_73) > 10000, "Historical PDF 73 is empty or truncated"


def test_02_invoice_number_sequence():
    """2. Verify exact invoice number sequence TT2026-2027/74 to TT2026-2027/103."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%' 
          AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103
        ORDER BY CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) ASC;
    """)
    rows = cur.fetchall()
    assert len(rows) == 30, f"Expected 30 sequential invoices, got {len(rows)}"
    for idx, (inv_no,) in enumerate(rows, start=74):
        expected = f"TT2026-2027/{idx}"
        assert inv_no == expected, f"Invoice sequence mismatch: expected {expected}, got {inv_no}"
    conn.close()


def test_03_frozen_invoice_billing_date():
    """3. Verify every invoice has the exact frozen billing date 14-08-2026 (2026-08-14)."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT date
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%' 
          AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103;
    """)
    dates = cur.fetchall()
    assert len(dates) == 1, f"Expected exactly 1 distinct date, found {len(dates)}"
    assert dates[0][0] == datetime.date(2026, 8, 14), f"Incorrect billing date: {dates[0][0]}"
    conn.close()


def test_04_excel_mapping_and_line_items():
    """4. Verify Excel matrix unpivoting created 1221 line items and 1685 total pairs."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT count(*), sum(quantity), sum(total_amount)
        FROM sales_invoice_items
        WHERE invoice_id IN (
            SELECT id FROM sales_invoices 
            WHERE invoice_no LIKE 'TT2026-2027/%' 
              AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103
        );
    """)
    item_count, total_qty, total_item_val = cur.fetchone()
    assert item_count == 1221, f"Expected 1221 line items, got {item_count}"
    assert Decimal(str(total_qty)) == Decimal("1685"), f"Expected 1685 total pairs, got {total_qty}"
    conn.close()


def test_05_tax_calculation_reconciliation():
    """5. Verify statutory tax calculations across all 30 batch invoices and exact 74/75/76 targets."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT sum(tax_total), sum(grand_total)
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%' 
          AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103;
    """)
    sum_tax, sum_grand = cur.fetchone()
    assert Decimal(str(sum_tax)) == Decimal("96671.56"), f"Tax total mismatch: {sum_tax}"
    assert Decimal(str(sum_grand)) == Decimal("2030101.00"), f"Grand total mismatch: {sum_grand}"

    # Verify exact validation targets for 74, 75, 76
    cur.execute("""
        SELECT i.invoice_no, sum(it.quantity * it.price) as taxable, i.tax_total, i.grand_total
        FROM sales_invoices i
        JOIN sales_invoice_items it ON i.id = it.invoice_id
        WHERE i.invoice_no IN ('TT2026-2027/74', 'TT2026-2027/75', 'TT2026-2027/76')
        GROUP BY i.invoice_no, i.tax_total, i.grand_total
        ORDER BY i.invoice_no;
    """)
    rows = {r[0]: r for r in cur.fetchall()}
    
    # 74: Taxable ₹61,607.68 | IGST ₹3,080.38 | Pre-round ₹64,688.06 | Rounding -₹0.06 | Grand Total ₹64,688.00
    r74 = rows["TT2026-2027/74"]
    assert Decimal(str(r74[1])) == Decimal("61607.68")
    assert Decimal(str(r74[2])) == Decimal("3080.38")
    assert Decimal(str(r74[3])) == Decimal("64688.00")
    pre_round_74 = Decimal(str(r74[1])) + Decimal(str(r74[2]))
    assert Decimal(str(r74[3])) - pre_round_74 == Decimal("-0.06")

    # 75: Taxable ₹1,14,671.36 | IGST ₹5,733.57 | Pre-round ₹1,20,404.93 | Rounding +₹0.07 | Grand Total ₹1,20,405.00
    r75 = rows["TT2026-2027/75"]
    assert Decimal(str(r75[1])) == Decimal("114671.36")
    assert Decimal(str(r75[2])) == Decimal("5733.57")
    assert Decimal(str(r75[3])) == Decimal("120405.00")
    pre_round_75 = Decimal(str(r75[1])) + Decimal(str(r75[2]))
    assert Decimal(str(r75[3])) - pre_round_75 == Decimal("0.07")

    # 76: Taxable ₹54,863.36 | IGST ₹2,743.17 | Pre-round ₹57,606.53 | Rounding +₹0.47 | Grand Total ₹57,607.00
    r76 = rows["TT2026-2027/76"]
    assert Decimal(str(r76[1])) == Decimal("54863.36")
    assert Decimal(str(r76[2])) == Decimal("2743.17")
    assert Decimal(str(r76[3])) == Decimal("57607.00")
    pre_round_76 = Decimal(str(r76[1])) + Decimal(str(r76[2]))
    assert Decimal(str(r76[3])) - pre_round_76 == Decimal("0.47")

    conn.close()


def test_06_rounding_adjustment():
    """6. Verify rounding logic produces integer rupee grand totals."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no, grand_total
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%' 
          AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103;
    """)
    for inv_no, grand_tot in cur.fetchall():
        gt = Decimal(str(grand_tot))
        assert gt == gt.quantize(Decimal("1")), f"Invoice {inv_no} grand total {gt} is not rounded to integer rupees"
    conn.close()


def test_07_barcode_and_logo_assets():
    """7. Verify Tattly logo asset exists and Code128 barcode generator is functional."""
    assert os.path.exists(TATTLY_LOGO_PATH), f"Logo asset missing: {TATTLY_LOGO_PATH}"
    from app.services.invoice_pdf_service import generate_barcode_base64
    b64 = generate_barcode_base64("TT2026-2027/74")
    assert b64.startswith("data:image/png;base64,"), "Barcode generator failed"
    assert len(b64) > 100, "Barcode data URI truncated"


def test_08_gst_qr_generation_architecture():
    """8. Verify dynamic GST QR code generator produces valid base64 data URI."""
    from app.services.invoice_pdf_service import generate_qr_base64
    qr_b64 = generate_qr_base64("GSTIN:27AAXFT2508H1ZR|INV:TT2026-2027/74|VAL:64688.00|DATE:14-08-2026")
    assert qr_b64.startswith("data:image/png;base64,"), "GST QR generator failed"
    assert len(qr_b64) > 100, "GST QR data URI truncated"


def test_09_multi_page_pagination_and_footer():
    """9. Verify generated PDFs paginate correctly and have footers on each page."""
    pdf_74 = os.path.join(TT_DIR, "SIS_TVB6_TaxInvoice_TT2026-2027_74.pdf")
    assert os.path.exists(pdf_74), f"PDF 74 missing: {pdf_74}"
    doc = fitz.open(pdf_74)
    assert len(doc) >= 2, f"Expected multi-page invoice, got {len(doc)} pages"
    for i, page in enumerate(doc):
        text = page.get_text()
        assert f"Tax Invoice No: TT2026-2027/74 • Page {i+1} of {len(doc)}" in text
    doc.close()


def test_10_amount_in_words():
    """10. Verify Indian currency text generator."""
    from app.services.invoice_pdf_service import number_to_indian_words
    assert number_to_indian_words(141004) == "One Lakh Forty One Thousand Four Rupees Only"
    assert number_to_indian_words(111434) == "One Lakh Eleven Thousand Four Hundred Thirty Four Rupees Only"
    assert number_to_indian_words(64688) == "Sixty Four Thousand Six Hundred Eighty Eight Rupees Only"


def test_11_company_db_routing_and_no_duplicates():
    """11. Verify all 30 invoices are stored in smriti001 with unique invoice numbers."""
    conn = psycopg2.connect(COMPANY_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT invoice_no, count(*)
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%' 
          AND CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER) BETWEEN 74 AND 103
        GROUP BY invoice_no
        HAVING count(*) > 1;
    """)
    dupes = cur.fetchall()
    assert len(dupes) == 0, f"Found duplicate invoice numbers: {dupes}"
    conn.close()


def test_12_smritisys_zero_operational_mutation():
    """12. Verify zero operational invoice records exist in smritisys Control Plane."""
    conn = psycopg2.connect(CONTROL_PLANE_DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM sales_invoices WHERE invoice_no LIKE 'TT2026-2027%';")
    count = cur.fetchone()[0]
    assert count == 0, f"smritisys contains {count} operational invoices! Must be 0."
    conn.close()


def test_13_all_30_pdf_files_exist_on_disk():
    """13. Verify all 30 generated PDF files exist on disk with valid file size."""
    sis_codes = [
        "TVB6", "TVP2", "TVT0", "TXAJ", "TY06", "8319", "8361", "T1BJ", "T72W", "T7FN",
        "TAGH", "TDL2", "TDL3", "TFW4", "TJI4", "TKU5", "TMN2", "TUA7", "T25I", "T38X",
        "TKL0", "TPV2", "TUB7", "TV81", "TVU1", "T8IY", "TAGG", "TW97", "TXSR", "TXSU"
    ]
    for idx, sis in enumerate(sis_codes, start=74):
        pdf_name = f"SIS_{sis}_TaxInvoice_TT2026-2027_{idx}.pdf"
        tt_path = os.path.join(TT_DIR, pdf_name)
        exp_path = os.path.join(EXPORTS_PDF_DIR, pdf_name)
        assert os.path.exists(tt_path), f"Missing PDF in TT dir: {tt_path}"
        assert os.path.exists(exp_path), f"Missing PDF in exports dir: {exp_path}"
        assert os.path.getsize(tt_path) > 10000, f"PDF file size too small: {tt_path}"


def test_14_zero_text_wrapping_in_all_pdfs():
    """14. Assert zero item description text wrapping across all 30 generated PDFs."""
    import fitz
    import re
    import glob

    pdf_files = sorted(glob.glob(os.path.join(EXPORTS_PDF_DIR, "SIS_*_TaxInvoice_TT2026-2027_*.pdf")))
    assert len(pdf_files) == 30, f"Expected 30 generated PDFs, found {len(pdf_files)}"

    wrapped_items = []
    total_items = 0

    for pdf in pdf_files:
        doc = fitz.open(pdf)
        inv_name = os.path.basename(pdf)
        for pno, page in enumerate(doc, start=1):
            for block in page.get_text("dict")["blocks"]:
                if "lines" in block:
                    for line in block["lines"]:
                        line_text = "".join([span["text"] for span in line["spans"]]).strip()
                        if re.search(r"(CH-\d+-[A-Z]|SND-\d+-[A-Z])", line_text):
                            total_items += 1
                            if not re.search(r"(36|37|38|39|40|41|42)", line_text):
                                wrapped_items.append((inv_name, pno, line_text))
        doc.close()

    assert total_items == 1221, f"Expected 1221 line items checked, found {total_items}"
    assert len(wrapped_items) == 0, f"Detected wrapped items: {wrapped_items}"

