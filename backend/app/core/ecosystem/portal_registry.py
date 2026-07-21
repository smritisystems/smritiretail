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
Classification: Extensible Digital Portal Metadata Registry
"""

from typing import Dict, Any, List


class PortalRegistry:
    """Extensible Metadata Registry for SMRITI Digital Platform Portals."""

    _PORTALS = [
        {
            "id": "marketing",
            "name": "Public Marketing & Industry Solutions",
            "route": "/",
            "visibility": "public",
            "icon": "globe",
            "required_license": ["Free", "Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "customer",
            "name": "Customer Portal & Licenses",
            "route": "/customer",
            "visibility": "authenticated",
            "icon": "user-check",
            "required_license": ["Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "documentation",
            "name": "Live Documentation & Knowledge Base",
            "route": "/docs",
            "visibility": "public",
            "icon": "book-open",
            "required_license": ["Free", "Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "marketplace",
            "name": "SMRITI Marketplace Hub",
            "route": "/marketplace",
            "visibility": "public",
            "icon": "grid",
            "required_license": ["Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "developer",
            "name": "Developer Portal & API Sandbox",
            "route": "/developer",
            "visibility": "authenticated",
            "icon": "code",
            "required_license": ["Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "partner",
            "name": "Partner Hub & Certification",
            "route": "/partners",
            "visibility": "authenticated",
            "icon": "briefcase",
            "required_license": ["Enterprise"],
            "enabled": True
        },
        {
            "id": "community",
            "name": "Community & Feature Roadmap",
            "route": "/community",
            "visibility": "public",
            "icon": "message-square",
            "required_license": ["Free", "Professional", "Enterprise"],
            "enabled": True
        },
        {
            "id": "academy",
            "name": "Learning Academy LMS",
            "route": "/academy",
            "visibility": "authenticated",
            "icon": "award",
            "required_license": ["Professional", "Enterprise"],
            "enabled": True
        }
    ]

    @classmethod
    def get_portals(cls, visibility_filter: str = None) -> List[Dict[str, Any]]:
        if visibility_filter:
            return [p for p in cls._PORTALS if p["visibility"] == visibility_filter and p["enabled"]]
        return [p for p in cls._PORTALS if p["enabled"]]
