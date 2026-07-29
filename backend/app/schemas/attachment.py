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
Classification: Pydantic DTO Schemas for SMRITI Content & Document Platform (SCDP / UDMS)
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class AttachmentBase(BaseModel):
    reference_type: str
    reference_id: str
    description: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    filename: str
    content_bytes: bytes
    category: Optional[str] = "Other"
    uploaded_by: Optional[str] = "system"


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    mime_type: str
    size_bytes: int
    sha256_checksum: str
    category: str
    current_version: int
    status: str
    uploaded_by: str


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    reference_type: str
    reference_id: str
    description: Optional[str] = None
    document: DocumentResponse
