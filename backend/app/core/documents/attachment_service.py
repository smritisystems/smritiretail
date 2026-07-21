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
Classification: Dynamic Attachment Service
"""

import uuid
from typing import Dict, Any, List
from app.core.documents.document_service import DocumentService, DocumentRecord


class AttachmentRecord:
    def __init__(self, att_id: str, document_id: str, reference_type: str, reference_id: str, description: str = None, attached_by: str = "system"):
        self.id = att_id
        self.document_id = document_id
        self.reference_type = reference_type
        self.reference_id = reference_id
        self.description = description
        self.attached_by = attached_by

    def to_dict(self) -> Dict[str, Any]:
        doc: DocumentRecord = DocumentService.get_document(self.document_id)
        doc_dict = {
            "id": doc.id,
            "filename": doc.filename,
            "mime_type": doc.mime_type,
            "size_bytes": doc.size_bytes,
            "sha256_checksum": doc.sha256_checksum,
            "category": doc.category,
            "current_version": doc.current_version,
            "status": doc.status,
            "uploaded_by": doc.uploaded_by
        } if doc else {}

        return {
            "id": self.id,
            "document_id": self.document_id,
            "reference_type": self.reference_type,
            "reference_id": self.reference_id,
            "description": self.description,
            "attached_by": self.attached_by,
            "document": doc_dict
        }


class AttachmentService:
    """Attachment Service linking Document to Business Records."""

    _attachments: Dict[str, AttachmentRecord] = {}

    @classmethod
    def attach_document(cls, document_id: str, reference_type: str, reference_id: str, description: str = None, attached_by: str = "system") -> AttachmentRecord:
        att_id = str(uuid.uuid4())
        att = AttachmentRecord(att_id, document_id, reference_type, reference_id, description, attached_by)
        cls._attachments[att_id] = att
        return att

    @classmethod
    def get_attachments_by_reference(cls, reference_type: str, reference_id: str) -> List[Dict[str, Any]]:
        ref_type = reference_type.upper()
        res = []
        for att in cls._attachments.values():
            if att.reference_type.upper() == ref_type and att.reference_id == reference_id:
                res.append(att.to_dict())
        return res
