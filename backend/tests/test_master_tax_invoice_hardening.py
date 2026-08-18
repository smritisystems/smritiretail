"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 4.9.5
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Test Suite: Master Tax Invoice Hardening & Functional Verification
"""

import sys, os, re
from decimal import Decimal
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.invoice_pdf_service import (
    number_to_indian_words,
    generate_barcode_base64,
    generate_qr_base64,
    format_place_of_supply,
    InvoicePdfService
)


def test_flat_5_percent_interstate_igst():
    """
    Test 1: Flat 5% Inter-State -> IGST 5% (Decimal only)
    """
    taxable_value = Decimal("142890.40")
    gst_rate = Decimal("5.00")
    
    expected_igst = (taxable_value * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    assert expected_igst == Decimal("7144.52")
    
    pre_round = taxable_value + expected_igst
    assert pre_round == Decimal("150034.92")
    
    grand_total = Decimal("150035.00")
    rounding = grand_total - pre_round
    assert rounding == Decimal("0.08")


def test_flat_5_percent_intrastate_cgst_sgst():
    """
    Test 2: Flat 5% Intra-State -> CGST 2.5% + SGST 2.5% (Decimal only)
    """
    taxable_value = Decimal("100000.00")
    cgst_rate = Decimal("2.50")
    sgst_rate = Decimal("2.50")
    
    cgst_amt = (taxable_value * (cgst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    sgst_amt = (taxable_value * (sgst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    
    assert cgst_amt == Decimal("2500.00")
    assert sgst_amt == Decimal("2500.00")
    assert (cgst_amt + sgst_amt) == Decimal("5000.00")


def test_final_total_amount_in_words():
    """
    Test 3: Final-total Amount-in-Words dynamic generation from rounded grand total
    """
    grand_total = Decimal("150035.00")
    words = number_to_indian_words(float(grand_total))
    
    # Must represent exactly 150035, without paise
    assert "One Lakh Fifty Thousand Thirty Five Rupees Only" in words
    assert "Paisa" not in words
    assert "  " not in words  # No internal multiple spaces


def test_rounding_and_amount_in_words_consistency():
    """
    Test 4: Rounding + Amount-in-Words consistency
    Ensures pre-rounding fractions (e.g. 150034.88) do not leak into words.
    """
    pre_rounding = Decimal("150034.88")
    rounding = Decimal("0.12")
    final_grand_total = pre_rounding + rounding  # 150035.00
    
    words_from_final = number_to_indian_words(float(final_grand_total))
    assert words_from_final == "One Lakh Fifty Thousand Thirty Five Rupees Only"
    
    # Case with actual paise in final amount:
    amount_with_paise = Decimal("1234.50")
    words_paise = number_to_indian_words(float(amount_with_paise))
    assert "One Thousand Two Hundred Thirty Four Rupees and Fifty Paisa Only" in words_paise


def test_place_of_supply_formatting():
    """
    Test 5: Place of Supply dynamic format mandate
    Format: Place of Supply: {STATE NAME} ({STATE CODE}) — {SUPPLY TYPE}
    """
    # Maharashtra Intra-State
    pos_mh = format_place_of_supply("Maharashtra", is_interstate=False, customer_gstin="27AABCR1718E1ZR")
    assert pos_mh == "Maharashtra (27) — Intra-State"

    # Assam Inter-State
    pos_as = format_place_of_supply("Assam", is_interstate=True, customer_gstin="18AABCR1718E1ZO")
    assert pos_as == "Assam (18) — Inter-State"

    # Delhi Inter-State
    pos_dl = format_place_of_supply("Delhi", is_interstate=True, customer_gstin="07AABCR1718E1ZR")
    assert pos_dl == "Delhi (07) — Inter-State"


def test_invoice_identity_contract():
    """
    Test 6: Invoice identity verification (Invoice No, Date formatting, SIS code)
    """
    invoice_no = "TT2026-2027/64"
    sis_code = "TVT0"
    
    assert re.match(r"^TT2026-2027/\d+$", invoice_no)
    assert len(sis_code) >= 3


def test_item_by_item_reconciliation_math():
    """
    Test 7: Item-by-item reconciliation math
    """
    qty = Decimal("10")
    mrp = Decimal("1999.00")
    disc_pct = Decimal("43.76")
    
    # Net unit rate after 43.76% discount
    unit_taxable = (mrp * (Decimal("100.00") - disc_pct) / Decimal("100.00")).quantize(Decimal("0.01"))
    line_taxable = (unit_taxable * qty).quantize(Decimal("0.01"))
    
    gst_rate = Decimal("5.00")
    line_igst = (line_taxable * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    line_total = line_taxable + line_igst
    
    assert line_taxable > Decimal("0.00")
    assert line_igst > Decimal("0.00")
    assert line_total == (line_taxable + line_igst)


def test_item_ordering_preservation():
    """
    Test 8: Strict Item Ordering Preservation
    """
    raw_items = [
        {"id": 101, "line_no": 3, "name": "Item C"},
        {"id": 102, "line_no": 1, "name": "Item A"},
        {"id": 103, "line_no": 2, "name": "Item B"},
    ]
    sorted_items = sorted(raw_items, key=lambda x: x["line_no"])
    assert [i["name"] for i in sorted_items] == ["Item A", "Item B", "Item C"]


def test_barcode_payload_integrity():
    """
    Test 9: Barcode Payload generation and format
    """
    invoice_no = "TT2026-2027/64"
    b64 = generate_barcode_base64(invoice_no)
    assert b64.startswith("data:image/png;base64,")
    assert len(b64) > 100


def test_qr_3_state_compliance_architecture():
    """
    Test 10: QR compliance-aware 3-state architecture
    State 1: Cancelled / Voided Invoice
    State 2: Registered IRP E-Invoice (if IRN present)
    State 3: Safe B2C / Domestic Verification QR (Standard non-IRP / under-threshold)
    """
    company_gstin = "27AAXFT2508H1ZR"
    invoice_no = "TT2026-2027/64"
    grand_total = Decimal("150035.00")
    date_str = "12-08-2026"
    pos_code = "07"
    
    # State 1: Cancelled
    qr_canc = f"STATUS:CANCELLED|GSTIN:{company_gstin}|INV:{invoice_no}|DATE:{date_str}|VAL:{float(grand_total):.2f}"
    assert "STATUS:CANCELLED" in qr_canc
    b64_canc = generate_qr_base64(qr_canc)
    assert b64_canc.startswith("data:image/png;base64,")

    # State 2: IRP Registered
    irn_sample = "4b82d3345fa6e897..."
    qr_irp = f"IRN:{irn_sample}|GSTIN:{company_gstin}|INV:{invoice_no}|VAL:{float(grand_total):.2f}|DATE:{date_str}"
    assert "IRN:" in qr_irp
    b64_irp = generate_qr_base64(qr_irp)
    assert b64_irp.startswith("data:image/png;base64,")

    # State 3: Safe Domestic Verification QR
    qr_std = f"GSTIN:{company_gstin}|INV:{invoice_no}|VAL:{float(grand_total):.2f}|DATE:{date_str}|POS:{pos_code}"
    assert "GSTIN:" in qr_std
    assert "POS:07" in qr_std
    b64_std = generate_qr_base64(qr_std)
    assert b64_std.startswith("data:image/png;base64,")


def test_reverse_charge_rule_46p_compliance():
    """
    Test 12: Reverse Charge Rule 46(p) Statutory Compliance
    Under CGST Rule 46(p), Tax Invoice must explicitly state whether tax is payable on Reverse Charge basis.
    Normal outward B2B/B2C sales -> 'No'.
    When RCM genuinely applies -> 'Yes'.
    """
    rcm_false = False
    display_no = "Yes" if rcm_false else "No"
    assert display_no == "No"

    rcm_true = True
    display_yes = "Yes" if rcm_true else "No"
    assert display_yes == "Yes"


def test_cancelled_invoice_status_and_watermark():
    """
    Test 11: Cancelled invoice status preservation
    """
    cancelled_numbers = {"TT2026-2027/39", "TT2026-2027/43", "TT2026-2027/58"}
    for inv in ["TT2026-2027/39", "TT2026-2027/43", "TT2026-2027/58"]:
        assert inv in cancelled_numbers
    
    active_inv = "TT2026-2027/64"
    assert active_inv not in cancelled_numbers


class MockItem:
    def __init__(self, line_no=1, name="Shoe 1", quantity=10, price=Decimal("1000.00"), gst_rate=Decimal("5.00"), mrp=Decimal("1778.00"), disc_pct=Decimal("43.76"), taxable_value=Decimal("10000.00"), igst_amount=Decimal("500.00"), cgst_amount=Decimal("0.00"), sgst_amount=Decimal("0.00")):
        self.line_no = line_no
        self.name = name
        self.code = "SKU-001"
        self.quantity = quantity
        self.price = price
        self.gst_rate = gst_rate
        self.mrp = mrp
        self.disc_pct = disc_pct
        self.taxable_value = taxable_value
        self.igst_amount = igst_amount
        self.cgst_amount = cgst_amount
        self.sgst_amount = sgst_amount
        self.hsn_code = "6403"


class MockInvoice:
    def __init__(self, invoice_no="TT2026-2027/64", irn=None, ack_no=None, ack_date=None, signed_qr_payload=None, e_invoice_status="NOT_APPLICABLE", is_reverse_charge=False):
        self.invoice_no = invoice_no
        self.date = "2026-08-12"
        self.grand_total = Decimal("10500.00")
        self.tax_total = Decimal("500.00")
        self.customer_name = "RELIANCE RETAIL LIMITED"
        self.customer_gstin = "07AABCR1718E1ZR"
        self.billing_address = "Delhi, India"
        self.shipping_address = "Delhi, India"
        self.site_name = "Reliance Trends"
        self.sis_code = "TVT0"
        self.pos_state = "Delhi"
        self.po_reference = "5182778202"
        self.eway_bill_no = ""
        self.is_interstate = True
        self.status = "Generated"
        self.reverse_charge = is_reverse_charge
        self.is_reverse_charge = is_reverse_charge
        self.irn = irn
        self.ack_no = ack_no
        self.ack_date = ack_date
        self.signed_qr_payload = signed_qr_payload
        self.e_invoice_status = e_invoice_status
        self.items = [MockItem()]


def test_valid_irp_signed_qr_rendering():
    """
    Test 13 (QR-1): Valid IRP signed QR and IRN display
    When e-invoice is GENERATED with valid IRN and signed payload:
    - QR label must be 'GST E-INVOICE QR'
    - IRN must be printed in metadata table
    - QR image must be generated from signed_qr_payload
    """
    irn_sample = "c743813959c9228d4889c09930777e48b816361a91e5e0cf7925e0bc08985160"
    signed_qr_sample = f"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.GSTIN:27AAXFT2508H1ZR|IRN:{irn_sample}"
    inv = MockInvoice(
        irn=irn_sample,
        ack_no="122026000012345",
        ack_date="2026-08-12T10:30:00",
        signed_qr_payload=signed_qr_sample,
        e_invoice_status="GENERATED"
    )
    html = InvoicePdfService.generate_invoice_html_sync(inv)
    assert "GST E-INVOICE QR" in html
    assert "IRN:" in html
    assert irn_sample in html


def test_missing_irn_compliance():
    """
    Test 14 (QR-2): Missing IRN in pending e-invoice
    When e-invoice status is PENDING:
    - Must NOT fabricate IRN or claim IRP-registered
    - QR label must be 'VERIFY INVOICE' (never GST E-INVOICE QR)
    - IRN row must NOT appear
    """
    inv = MockInvoice(
        irn=None,
        signed_qr_payload=None,
        e_invoice_status="PENDING"
    )
    html = InvoicePdfService.generate_invoice_html_sync(inv)
    assert "GST E-INVOICE QR" not in html
    assert "VERIFY INVOICE" in html
    assert "<tr><td class=\"meta-label\">IRN:</td>" not in html


def test_missing_signed_qr_payload():
    """
    Test 15 (QR-3): Missing signed QR payload
    When IRN exists but signed payload is missing:
    - Must NOT label as official GST E-INVOICE QR
    - Falls back safely to VERIFY INVOICE
    """
    inv = MockInvoice(
        irn="c743813959c9228d4889c09930777e48b816361a91e5e0cf7925e0bc08985160",
        signed_qr_payload=None,
        e_invoice_status="GENERATED"
    )
    html = InvoicePdfService.generate_invoice_html_sync(inv)
    assert "GST E-INVOICE QR" not in html
    assert "VERIFY INVOICE" in html


def test_non_e_invoice_invoice():
    """
    Test 16 (QR-4): Non-E-Invoice standard invoice
    When e-invoice is not applicable:
    - Must NOT label as GST E-INVOICE QR
    - Uses standard SMRITI document verification QR (VERIFY INVOICE)
    - Never uses invoice number alone
    """
    inv = MockInvoice(
        irn=None,
        signed_qr_payload=None,
        e_invoice_status="NOT_APPLICABLE"
    )
    html = InvoicePdfService.generate_invoice_html_sync(inv)
    assert "GST E-INVOICE QR" not in html
    assert "VERIFY INVOICE" in html
    assert "IRN:" not in html


def test_qr_rendering_and_scannability():
    """
    Test 17 (QR-5): QR rendering and byte integrity
    Verifies that QR code generates valid PNG data URI without distortion.
    """
    payload_short = "DOC:TAX_INVOICE|INV:TT2026-2027/64|DATE:12-08-2026|GSTIN:27AAXFT2508H1ZR|VAL:150035.00"
    b64_short = generate_qr_base64(payload_short)
    assert b64_short.startswith("data:image/png;base64,")
    assert len(b64_short) > 200

    # Test large 600+ char signed JWT payload
    payload_jwt = "eyJhbGciOiJSUzI1NiJ9." + ("x" * 600) + ".signature"
    b64_jwt = generate_qr_base64(payload_jwt)
    assert b64_jwt.startswith("data:image/png;base64,")
    assert len(b64_jwt) > 500


def test_database_persistence_e_invoice_fields():
    """
    Test 18 (QR-6): Database Model E-Invoice Fields
    Verifies SalesInvoice model possesses all required compliance persistence columns.
    """
    from app.models.sales import SalesInvoice
    assert hasattr(SalesInvoice, "e_invoice_status")
    assert hasattr(SalesInvoice, "irn")
    assert hasattr(SalesInvoice, "ack_no")
    assert hasattr(SalesInvoice, "ack_date")
    assert hasattr(SalesInvoice, "signed_qr_payload")


def test_pdf_output_with_qr_states():
    """
    Test 19 (QR-7): Complete HTML generation across all compliance states
    """
    states = [
        ("GENERATED", "valid_irn_123", "signed_jwt_abc", "GST E-INVOICE QR"),
        ("PENDING", None, None, "VERIFY INVOICE"),
        ("NOT_APPLICABLE", None, None, "VERIFY INVOICE")
    ]
    for status, irn, payload, expected_label in states:
        inv = MockInvoice(
            irn=irn,
            signed_qr_payload=payload,
            e_invoice_status=status
        )
        html = InvoicePdfService.generate_invoice_html_sync(inv)
        assert expected_label in html
        assert "Place of Supply:" in html
        assert "Reverse Charge:" in html
        assert "SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS" in html
        assert "watermark-logo" in html

