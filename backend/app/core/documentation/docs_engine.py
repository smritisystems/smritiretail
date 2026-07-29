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
Classification: Documentation Reader & Versioning Engine
"""

from typing import Dict, Any, List
from app.core.documentation.docs_registry import DocumentationRegistry


class DocumentationReaderEngine:
    """Documentation Reader Service managing categories, version switching, and cross-linking."""

    @classmethod
    def list_articles_by_category(cls, category_id: str, version: str = "29.0.0") -> List[Dict[str, Any]]:
        return DocumentationRegistry.get_articles(category=category_id, version=version)

    @classmethod
    def get_article_detail(cls, article_id: str) -> Dict[str, Any]:
        return DocumentationRegistry.get_article_by_id(article_id)
