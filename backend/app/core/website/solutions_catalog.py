"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 28.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Industry Solutions Catalog Engine
"""

from typing import Dict, Any, List


class IndustrySolutionsCatalog:
    """Showcases SMRITI domain-specific retail engines."""

    _SOLUTIONS = [
        {
            "id": "pharma",
            "name": "Pharma & Healthcare Retail Engine (v24.0.0)",
            "icon": "activity",
            "tagline": "Schedule H/H1 Compliance & FEFO Batch Control",
            "description": "Integrated doctor registration validation, active generic salt composition substitute search, and automated near-expiry locks preventing sale of medicines expiring within 30 days.",
            "key_features": [
                "Schedule H/H1 Prescription Validator",
                "Generic Salt Composition Substitute Finder",
                "FEFO Batch Expiry Lock Engine",
                "UDMS Medical Record Linking"
            ]
        },
        {
            "id": "apparel",
            "name": "Apparel & Fashion 3D Matrix Engine (v25.0.0)",
            "icon": "layers",
            "tagline": "Color-Size-Style Matrix & Seasonal Markdowns",
            "description": "Multi-dimensional Variant Allocation Grid, age-based automated seasonal discount markdowns, and direct ZPL thermal printer hangtag rendering.",
            "key_features": [
                "3D Variant Matrix Allocator",
                "Automated Age-Based Markdown Calculator",
                "Thermal ZPL Hangtag Generator",
                "EAN-13 Barcode Printing"
            ]
        },
        {
            "id": "nic_gst",
            "name": "NIC GSTN E-Way Bill & E-Invoice Gateway (v26.0.0)",
            "icon": "shield-check",
            "tagline": "Auto-Filing Compliance Gateway for Indian GST",
            "description": "Direct NIC API portal return reconciliation, SHA-256 IRN hash computation, signed B2B QR code generation, and automated E-Way bill dispatch for consignments > ₹50,000.",
            "key_features": [
                "SHA-256 IRN Hash Computation",
                "B2B Signed QR Code Generator",
                "E-Way Bill Dispatch Automation",
                "GSTR-1 & GSTR-3B Portal Reconciliation"
            ]
        },
        {
            "id": "franchise",
            "name": "Multi-Store Franchise & Royalty Engine (v21.0.0)",
            "icon": "git-pull-request",
            "tagline": "Enterprise Multi-Store & Franchise Settlement",
            "description": "Central store registry, automated tiered royalty fee calculation, automated debit note billing, and consolidated store performance analytics.",
            "key_features": [
                "Franchise Store Hierarchy Registry",
                "Tiered Royalty Fee Calculator",
                "Automated Debit Note Settlement Engine",
                "Consolidated Store P&L Analytics"
            ]
        }
    ]

    @classmethod
    def get_solutions(cls) -> List[Dict[str, Any]]:
        return cls._SOLUTIONS
