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
Classification: Documentation Category Registry & Catalog
"""

from typing import Dict, Any, List


class DocumentationRegistry:
    """Categorized Documentation Catalog & Article Registry."""

    CATEGORIES = [
        {"id": "GETTING_STARTED", "name": "Getting Started", "icon": "play-circle"},
        {"id": "USER_GUIDE", "name": "User Manuals & POS Billing", "icon": "book"},
        {"id": "ADMIN_GUIDE", "name": "Administrator Guide & System Setup", "icon": "settings"},
        {"id": "DEVELOPER_GUIDE", "name": "Developer Guide & SDK Extensions", "icon": "code"},
        {"id": "API_REFERENCE", "name": "Interactive API Reference", "icon": "terminal"},
        {"id": "ARCHITECTURE", "name": "PAR-001 Platform Architecture", "icon": "layers"},
        {"id": "GOVERNANCE", "name": "Governance Standards (SIP/DPF/CMP)", "icon": "shield"},
        {"id": "RELEASE_NOTES", "name": "Version Changelog & Release Notes", "icon": "git-commit"},
        {"id": "TROUBLESHOOTING", "name": "Troubleshooting & FAQs", "icon": "help-circle"}
    ]

    _ARTICLES = [
        {
            "id": "dpf-001",
            "category": "GOVERNANCE",
            "title": "DPF-001 — Digital Platform Framework",
            "summary": "Governs the 3-Tier Digital Platform Architecture, Portal Topology, Shared Platform Services, and Portal Lifecycle.",
            "content": "# DPF-001 — SMRITI Digital Platform Framework\n\nEstablishes top-level digital platform governance sitting above individual portal implementations.",
            "version": "29.0.0",
            "author": "Jawahar Ramkripal Mallah",
            "last_updated": "2026-07-22",
            "tags": ["governance", "architecture", "dpf-001"],
            "visibility": "public"
        },
        {
            "id": "sip-001",
            "category": "GOVERNANCE",
            "title": "SIP-001 — SMRITI Identity Platform Standard",
            "summary": "Unified OAuth2 / JWT Single Sign-On, Tenant Context Isolation, and Role-Based Access Control.",
            "content": "# SIP-001 — Identity Platform Standard\n\nDefines SSO authentication and portal permissions across all 8 SMRITI portals.",
            "version": "29.0.0",
            "author": "Jawahar Ramkripal Mallah",
            "last_updated": "2026-07-22",
            "tags": ["identity", "sso", "security", "sip-001"],
            "visibility": "public"
        },
        {
            "id": "user-guide-pos",
            "category": "USER_GUIDE",
            "title": "Point-of-Sale Billing & Offline Sync Manual",
            "summary": "Complete cashier guide for barcode scanning, FEFO medicine sales, hangtag printing, and offline checkout sync.",
            "content": "# POS Billing & Cashier Operations\n\nProvides sub-10ms scan-to-bill checkout operations with instant GST invoice generation.",
            "version": "29.0.0",
            "author": "Jawahar Ramkripal Mallah",
            "last_updated": "2026-07-22",
            "tags": ["pos", "billing", "cashier", "checkout"],
            "visibility": "public"
        },
        {
            "id": "admin-guide-wms",
            "category": "ADMIN_GUIDE",
            "title": "Enterprise WMS & Multi-Bin Configuration",
            "summary": "Administrator guide for configuring hierarchical Aisle-Rack-Shelf-Bin locations and stock transfers.",
            "content": "# Enterprise WMS Setup\n\nConfigure warehouse locations, near-expiry FEFO locks, and stock variance reconciliation.",
            "version": "29.0.0",
            "author": "Jawahar Ramkripal Mallah",
            "last_updated": "2026-07-22",
            "tags": ["wms", "warehouse", "bin-location", "admin"],
            "visibility": "public"
        }
    ]

    @classmethod
    def get_categories(cls) -> List[Dict[str, Any]]:
        return cls.CATEGORIES

    @classmethod
    def get_articles(cls, category: str = None, version: str = None) -> List[Dict[str, Any]]:
        res = cls._ARTICLES
        if category:
            res = [a for a in res if a["category"] == category.upper().strip()]
        if version:
            res = [a for a in res if a["version"] == version.strip()]
        return res

    @classmethod
    def get_article_by_id(cls, article_id: str) -> Dict[str, Any]:
        return next((a for a in cls._ARTICLES if a["id"] == article_id), {"error": "Article not found"})
