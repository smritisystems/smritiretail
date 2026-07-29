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
Classification: Live Documentation Portal REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Query

from app.core.documentation.docs_registry import DocumentationRegistry
from app.core.documentation.docs_engine import DocumentationReaderEngine
from app.core.documentation.api_reference import ApiReferenceEngine
from app.core.documentation.release_notes_engine import ReleaseNotesEngine

router = APIRouter(prefix="/docs", tags=["Live Documentation Portal & Knowledge Engine"])


@router.get("/categories")
async def get_doc_categories():
    """Returns list of documentation categories."""
    return DocumentationRegistry.get_categories()


@router.get("/articles")
async def list_doc_articles(category: str = Query(None), version: str = Query("29.0.0")):
    """Lists documentation articles filtered by category and platform version."""
    return DocumentationReaderEngine.list_articles_by_category(category, version)


@router.get("/articles/{article_id}")
async def get_article_detail(article_id: str):
    """Returns article content, metadata, and cross-links."""
    return DocumentationReaderEngine.get_article_detail(article_id)


@router.get("/api-specs")
async def get_api_specifications():
    """Returns OpenAPI endpoint specifications with request/response examples and SDK snippets."""
    return ApiReferenceEngine.get_api_endpoints()


@router.get("/release-notes")
async def get_release_notes_timeline():
    """Returns version release notes timeline."""
    return ReleaseNotesEngine.get_release_notes()
