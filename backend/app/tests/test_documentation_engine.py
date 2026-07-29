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
Classification: Pytest Suite for Live Documentation Portal (v29.0.0)

test_documentation_engine.py — Integration test suite for Phase 35 Live Documentation Portal.
"""

import pytest

from app.core.documentation.docs_registry import DocumentationRegistry
from app.core.documentation.docs_engine import DocumentationReaderEngine
from app.core.documentation.api_reference import ApiReferenceEngine
from app.core.documentation.release_notes_engine import ReleaseNotesEngine


@pytest.mark.asyncio
async def test_documentation_category_retrieval():
    """Verify DocumentationRegistry returns 9 documentation categories."""
    cats = DocumentationRegistry.get_categories()
    assert len(cats) == 9
    cat_ids = [c["id"] for c in cats]
    assert "GETTING_STARTED" in cat_ids
    assert "USER_GUIDE" in cat_ids
    assert "ADMIN_GUIDE" in cat_ids
    assert "DEVELOPER_GUIDE" in cat_ids
    assert "API_REFERENCE" in cat_ids
    assert "ARCHITECTURE" in cat_ids
    assert "GOVERNANCE" in cat_ids
    assert "RELEASE_NOTES" in cat_ids
    assert "TROUBLESHOOTING" in cat_ids


@pytest.mark.asyncio
async def test_documentation_article_filtering():
    """Verify DocumentationReaderEngine filters articles by category and platform version."""
    gov_articles = DocumentationReaderEngine.list_articles_by_category("GOVERNANCE", "29.0.0")
    assert len(gov_articles) >= 2
    article_ids = [a["id"] for a in gov_articles]
    assert "dpf-001" in article_ids
    assert "sip-001" in article_ids

    detail = DocumentationReaderEngine.get_article_detail("dpf-001")
    assert detail["title"] == "DPF-001 — Digital Platform Framework"
    assert "author" in detail
    assert "tags" in detail


@pytest.mark.asyncio
async def test_api_reference_spec_explorer():
    """Verify ApiReferenceEngine returns OpenAPI specs with payloads and SDK snippets."""
    endpoints = ApiReferenceEngine.get_api_endpoints()
    assert len(endpoints) >= 2
    ep_paths = [e["path"] for e in endpoints]
    assert "/api/v1/nic-gst/einvoice/generate" in ep_paths
    assert "/api/v1/pharma/expiry-lock/check" in ep_paths

    nic_ep = next(e for e in endpoints if e["endpoint_id"] == "ep-nic-einvoice")
    assert "request_example" in nic_ep
    assert "response_example" in nic_ep
    assert "sdk_snippet_python" in nic_ep


@pytest.mark.asyncio
async def test_release_notes_timeline():
    """Verify ReleaseNotesEngine returns chronological version changelog timeline."""
    notes = ReleaseNotesEngine.get_release_notes()
    assert len(notes) >= 3
    versions = [n["version"] for n in notes]
    assert "v29.0.0" in versions
    assert "v28.0.0" in versions
    assert "v27.0.0" in versions

    v29_note = next(n for n in notes if n["version"] == "v29.0.0")
    assert len(v29_note["highlights"]) >= 3
