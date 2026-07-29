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
Classification: Layer 7 SMRITI Content & Document Platform REST API
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.core.documents.document_service import DocumentService
from app.core.documents.attachment_service import AttachmentService
from app.core.documents.document_preview_engine import DocumentPreviewEngine

router = APIRouter(prefix="/attachments", tags=["Layer 7 SMRITI Content & Document Platform (SCDP / UDMS)"])


@router.post("/upload")
async def upload_attachment(
    reference_type: str = Form(...),
    reference_id: str = Form(...),
    category: str = Form("Other"),
    description: str = Form(None),
    file: UploadFile = File(...)
):
    """Uploads a file, creates first-class Document, and attaches to reference record."""
    content = await file.read()
    doc = DocumentService.create_document(file.filename, content, category)
    att = AttachmentService.attach_document(doc.id, reference_type, reference_id, description)
    return att.to_dict()


@router.get("/reference/{reference_type}/{reference_id}")
async def get_attachments_for_record(reference_type: str, reference_id: str):
    """Returns all attachments linked to a given business record."""
    return AttachmentService.get_attachments_by_reference(reference_type, reference_id)


@router.get("/{document_id}/preview")
async def get_document_preview(document_id: str):
    """Returns document preview metadata."""
    res = DocumentPreviewEngine.generate_preview_metadata(document_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res
