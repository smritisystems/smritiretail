"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Global Unified Search REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Query

from app.core.ecosystem.search.global_search_service import GlobalUnifiedSearchEngine

router = APIRouter(prefix="/search", tags=["Global Unified Search Service"])


@router.get("/query")
async def query_global_search(q: str = Query(...)):
    """Queries across Docs, Academy, Marketplace, APIs, and Release Notes."""
    return GlobalUnifiedSearchEngine.query(q)
