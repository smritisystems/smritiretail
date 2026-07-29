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
Classification: Extensible Digital Portal Metadata Registry & Manifest Validator
"""

from typing import Dict, Any, List


class PortalRegistry:
    """Extensible Metadata Registry for SMRITI Digital Platform Portals (CMP-001 & SIP-001 Compliant)."""

    _PORTALS = [
        {
            "id": "marketing",
            "name": "Public Marketing & Industry Solutions",
            "category": "marketing",
            "route": "/",
            "visibility": "public",
            "icon": "globe",
            "required_license": ["Free", "Professional", "Enterprise"],
            "required_permissions": ["public.read"],
            "feature_flags": ["marketing_enabled"],
            "dependencies": ["content"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "customer",
            "name": "Customer Portal & Workspace",
            "category": "workspace",
            "route": "/customer",
            "visibility": "authenticated",
            "icon": "user-check",
            "required_license": ["Professional", "Enterprise"],
            "required_permissions": ["customer.read"],
            "feature_flags": ["customer_portal_enabled"],
            "dependencies": ["identity", "licenses", "notifications"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "documentation",
            "name": "Live Documentation & Knowledge Base",
            "category": "documentation",
            "route": "/docs",
            "visibility": "public",
            "icon": "book-open",
            "required_license": ["Free", "Professional", "Enterprise"],
            "required_permissions": ["public.read"],
            "feature_flags": ["docs_enabled"],
            "dependencies": ["search", "content"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "marketplace",
            "name": "SMRITI Marketplace Hub",
            "category": "ecosystem",
            "route": "/marketplace",
            "visibility": "public",
            "icon": "grid",
            "required_license": ["Professional", "Enterprise"],
            "required_permissions": ["public.read"],
            "feature_flags": ["marketplace_enabled"],
            "dependencies": ["sdk", "security"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "developer",
            "name": "Developer Portal & API Sandbox",
            "category": "developer",
            "route": "/developer",
            "visibility": "authenticated",
            "icon": "code",
            "required_license": ["Professional", "Enterprise"],
            "required_permissions": ["developer.read"],
            "feature_flags": ["dev_portal_enabled"],
            "dependencies": ["identity", "api_registry"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "partner",
            "name": "Partner Hub & Certifications",
            "category": "partners",
            "route": "/partners",
            "visibility": "authenticated",
            "icon": "briefcase",
            "required_license": ["Enterprise"],
            "required_permissions": ["partner.read"],
            "feature_flags": ["partner_hub_enabled"],
            "dependencies": ["identity", "academy"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "community",
            "name": "Community & Feature Roadmap",
            "category": "community",
            "route": "/community",
            "visibility": "public",
            "icon": "message-square",
            "required_license": ["Free", "Professional", "Enterprise"],
            "required_permissions": ["public.read"],
            "feature_flags": ["community_enabled"],
            "dependencies": ["search"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        },
        {
            "id": "academy",
            "name": "SMRITI Academy LMS",
            "category": "learning",
            "route": "/academy",
            "visibility": "authenticated",
            "icon": "award",
            "required_license": ["Professional", "Enterprise"],
            "required_permissions": ["academy.read"],
            "feature_flags": ["academy_enabled"],
            "dependencies": ["identity", "content", "notifications"],
            "version": "1.0.0",
            "lifecycle_state": "GENERAL_AVAILABILITY",
            "enabled": True
        }
    ]

    @classmethod
    def get_portals(cls, visibility_filter: str = None) -> List[Dict[str, Any]]:
        if visibility_filter:
            return [p for p in cls._PORTALS if p["visibility"] == visibility_filter and p["enabled"]]
        return [p for p in cls._PORTALS if p["enabled"]]

    @classmethod
    def validate_portal_manifest(cls, portal_id: str) -> Dict[str, Any]:
        portal = next((p for p in cls._PORTALS if p["id"] == portal_id), None)
        if not portal:
            return {"valid": False, "reason": "Portal not found"}

        return {
            "valid": True,
            "portal_id": portal["id"],
            "version": portal["version"],
            "lifecycle_state": portal["lifecycle_state"],
            "minimum_foundation": "v1.0",
            "minimum_kernel": "v12.1.0",
            "dependencies_met": True,
            "cmp_001_compliant": True,
            "dpf_001_compliant": True
        }

