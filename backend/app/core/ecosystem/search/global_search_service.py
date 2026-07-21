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
Classification: Global Unified Search Engine for Digital Platform
"""

from typing import Dict, Any, List


class GlobalUnifiedSearchEngine:
    """Unified Search across Documentation, Academy, Marketplace, APIs, and Release Notes."""

    _INDEX = [
        {"title": "Schedule H & Prescription Compliance", "category": "DOCS", "url": "/docs/pharma", "snippet": "Schedule H doctor registration requirements and UDMS links."},
        {"title": "SMRITI Retail OS Fundamentals", "category": "ACADEMY", "url": "/academy/courses/SMRITI-101", "snippet": "Learn POS checkout, item master, and sales billing."},
        {"title": "WMS Multi-Bin Location Extension", "category": "MARKETPLACE", "url": "/marketplace/extensions/wms-bin", "snippet": "Hierarchical Aisle-Rack-Shelf-Bin allocation module."},
        {"title": "NIC E-Invoice SHA-256 IRN API", "category": "DEVELOPER_APIS", "url": "/developer/apis/nic-gst", "snippet": "Generate SHA-256 IRN hashes and B2B signed QR codes."}
    ]

    @classmethod
    def query(cls, search_term: str) -> Dict[str, Any]:
        term = search_term.lower().strip()
        results = [i for i in cls._INDEX if term in i["title"].lower() or term in i["snippet"].lower()]

        return {
            "query": search_term,
            "results_count": len(results),
            "results": results
        }
