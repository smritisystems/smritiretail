"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 17.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Phase 23 SMRITI Content & Document Platform (SCDP / UDMS)

test_udms_engine.py — Integration test suite for Layer 7 Document Management Engine.
"""

import pytest

from app.core.documents.document_service import DocumentService
from app.core.documents.attachment_service import AttachmentService
from app.core.documents.document_preview_engine import DocumentPreviewEngine


@pytest.mark.asyncio
async def test_document_creation_and_checksum():
    """Verify DocumentService creates first-class document and SHA256 checksum."""
    sample_content = b"PDF Sample Invoice Binary Data 2026"
    doc = DocumentService.create_document("Invoice_2026.pdf", sample_content, category="Invoice", uploaded_by="admin")

    assert doc.id is not None
    assert doc.filename == "Invoice_2026.pdf"
    assert doc.mime_type == "application/pdf"
    assert doc.category == "Invoice"
    assert len(doc.sha256_checksum) == 64


@pytest.mark.asyncio
async def test_attachment_service_reference_linking():
    """Verify AttachmentService links Document to multiple business records."""
    doc = DocumentService.create_document("VendorAgreement.pdf", b"Vendor Agreement Terms", category="Agreement")

    # Attach to Purchase Order
    att_po = AttachmentService.attach_document(doc.id, "PURCHASE_ORDER", "PO-000245", "Signed Vendor Agreement")
    assert att_po.reference_type == "PURCHASE_ORDER"
    assert att_po.reference_id == "PO-000245"

    # Attach to Vendor Master
    att_vendor = AttachmentService.attach_document(doc.id, "VENDOR_MASTER", "VEND-99", "Master Vendor Agreement")
    assert att_vendor.reference_type == "VENDOR_MASTER"

    # Query attachments by reference
    po_atts = AttachmentService.get_attachments_by_reference("PURCHASE_ORDER", "PO-000245")
    assert len(po_atts) == 1
    assert po_atts[0]["document"]["filename"] == "VendorAgreement.pdf"

    vendor_atts = AttachmentService.get_attachments_by_reference("VENDOR_MASTER", "VEND-99")
    assert len(vendor_atts) == 1


@pytest.mark.asyncio
async def test_document_preview_engine():
    """Verify DocumentPreviewEngine returns inline view preview metadata."""
    doc_pdf = DocumentService.create_document("Receipt.pdf", b"%PDF-1.4", category="Receipt")
    prev_pdf = DocumentPreviewEngine.generate_preview_metadata(doc_pdf.id)
    assert prev_pdf["preview_type"] == "PDF_PREVIEW"
    assert prev_pdf["supports_inline_view"] is True

    doc_img = DocumentService.create_document("Product.png", b"\x89PNG\r\n\x1a\n", category="Photo")
    prev_img = DocumentPreviewEngine.generate_preview_metadata(doc_img.id)
    assert prev_img["preview_type"] == "IMAGE_PREVIEW"


@pytest.mark.asyncio
async def test_decoupled_document_attachment_separation():
    """Verify Document/Attachment separation principle (SMP-014 Precept)."""
    doc = DocumentService.create_document("TaxCertificate.pdf", b"GST Certificate 2026", category="Tax")

    att1 = AttachmentService.attach_document(doc.id, "COMPANY_PROFILE", "COMP-01")
    att2 = AttachmentService.attach_document(doc.id, "TAX_SETTLEMENT", "TAX-2026-Q1")

    # Distinct attachment IDs pointing to same document ID
    assert att1.id != att2.id
    assert att1.document_id == doc.id
    assert att2.document_id == doc.id
