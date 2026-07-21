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
Classification: First-Class Document Service
"""

import uuid
import mimetypes
from typing import Dict, Any, List
from app.core.documents.storage_providers.local_storage_provider import LocalStorageProvider

storage_provider = LocalStorageProvider()


class DocumentRecord:
    def __init__(self, doc_id: str, filename: str, mime_type: str, size_bytes: int, sha256: str, category: str, uploaded_by: str, storage_path: str):
        self.id = doc_id
        self.filename = filename
        self.mime_type = mime_type
        self.size_bytes = size_bytes
        self.sha256_checksum = sha256
        self.category = category
        self.storage_provider = "local"
        self.current_version = 1
        self.status = "ACTIVE"
        self.uploaded_by = uploaded_by
        self.storage_path = storage_path


class DocumentService:
    """First-Class Document Service (SMP-014 Compliant)."""

    _documents: Dict[str, DocumentRecord] = {}

    @classmethod
    def create_document(cls, filename: str, content: bytes, category: str = "Other", uploaded_by: str = "system") -> DocumentRecord:
        doc_id = str(uuid.uuid4())
        mime, _ = mimetypes.guess_type(filename)
        mime = mime or "application/octet-stream"

        storage_path, sha256 = storage_provider.save_file(doc_id, 1, filename, content)
        doc = DocumentRecord(doc_id, filename, mime, len(content), sha256, category, uploaded_by, storage_path)
        cls._documents[doc_id] = doc
        return doc

    @classmethod
    def get_document(cls, doc_id: str) -> DocumentRecord:
        return cls._documents.get(doc_id)
