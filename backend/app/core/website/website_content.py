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
Classification: Website Dynamic Content Management Service
"""

from typing import Dict, Any, List


class WebsiteContentService:
    """Content-driven service providing website copy, hero text, pricing tiers, and statistics."""

    @classmethod
    def get_homepage_content(cls) -> Dict[str, Any]:
        return {
            "hero": {
                "headline": "The Sovereign Operating System for Modern Commerce",
                "subheadline": "Unifying Point-of-Sale, WMS, Accounting, AI Advisory, and GST Compliance into a unified 3-Tier Digital Platform.",
                "primary_cta": "Book Live Demo",
                "secondary_cta": "Explore Platform Architecture",
                "badge": "v28.0.0 Enterprise Certified"
            },
            "statistics": [
                {"value": "99.99%", "label": "POS Uptime Reliability"},
                {"value": "<10ms", "label": "Barcode Scan-to-Bill Latency"},
                {"value": "100%", "label": "NIC GST & E-Invoice Compliance"},
                {"value": "65+", "label": "Automated Quality Tests Passed"}
            ],
            "editions": [
                {
                    "id": "community",
                    "name": "Community Edition",
                    "price": "Free Forever",
                    "target": "Single Store Retailers & Startups",
                    "features": [
                        "Single POS Terminal",
                        "Basic Stock & Barcode Billing",
                        "GST Invoice Printing",
                        "Community Forum Support"
                    ],
                    "badge": "Open Platform"
                },
                {
                    "id": "professional",
                    "name": "Professional Edition",
                    "price": "₹1,499 / store / mo",
                    "target": "Growing Multi-Counter Retailers & Supermarkets",
                    "features": [
                        "Multi-Counter POS & Offline Sync",
                        "Pharma FEFO & Batch Expiry Control",
                        "Apparel 3D Matrix Allocator",
                        "Live E-Way Bill & E-Invoice Filing",
                        "SMRITI Academy Certification Access"
                    ],
                    "badge": "Most Popular",
                    "featured": True
                },
                {
                    "id": "enterprise",
                    "name": "Enterprise Edition",
                    "price": "Custom / Enterprise Plan",
                    "target": "Multi-Store Chains, Franchises & Wholesalers",
                    "features": [
                        "Unlimited Multi-Store Franchise & Royalty Engine",
                        "Hierarchical Multi-Bin WMS & In-Transit Transfers",
                        "AI Advisory Demand Forecasting & Price Markdowns",
                        "Dedicated SSO / SIP-001 Security Gateway",
                        "24/7 SLA & Custom SDK Extensions"
                    ],
                    "badge": "Enterprise Scale"
                }
            ]
        }
