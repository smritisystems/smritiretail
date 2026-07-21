"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 29.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Live Documentation Portal
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class DocumentationArticleSchema(BaseModel):
    id: str
    category: str
    title: str
    summary: str
    content: str
    version: str
    author: str = "Jawahar Ramkripal Mallah"
    last_updated: str = "2026-07-22"
    tags: List[str]
    visibility: str = "public"
    related_article_ids: Optional[List[str]] = None


class ApiEndpointSpecSchema(BaseModel):
    endpoint_id: str
    path: str
    method: str
    summary: str
    category: str
    authentication: str = "OAuth2 / JWT Token"
    request_example: Optional[Dict[str, Any]] = None
    response_example: Optional[Dict[str, Any]] = None
    sdk_snippet_python: Optional[str] = None


class ReleaseNoteEntrySchema(BaseModel):
    version: str
    release_date: str
    title: str
    highlights: List[str]
    breaking_changes: List[str] = []
    migration_notes: Optional[str] = None
