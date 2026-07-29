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
Classification: Document Preview Engine
"""

from typing import Dict, Any
from app.core.documents.document_service import DocumentService, DocumentRecord


class DocumentPreviewEngine:
    """Multi-Format Document Preview Metadata Generator."""

    @staticmethod
    def generate_preview_metadata(document_id: str) -> Dict[str, Any]:
        doc: DocumentRecord = DocumentService.get_document(document_id)
        if not doc:
            return {"error": "Document not found"}

        preview_type = "UNKNOWN"
        if "pdf" in doc.mime_type:
            preview_type = "PDF_PREVIEW"
        elif "image" in doc.mime_type:
            preview_type = "IMAGE_PREVIEW"
        elif "text" in doc.mime_type or "csv" in doc.mime_type or "json" in doc.mime_type:
            preview_type = "TEXT_PREVIEW"

        return {
            "document_id": doc.id,
            "filename": doc.filename,
            "preview_type": preview_type,
            "supports_inline_view": preview_type != "UNKNOWN",
            "mime_type": doc.mime_type
        }
