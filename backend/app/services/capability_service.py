"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional, Tuple, Set


class CapabilityService:
    """
    Authoritative Capability & Module Registry Engine (P1.2).
    Governs the 26 canonical SMRITI capabilities, strict dependency graph validation (fail-closed),
    and tenant subscription tier entitlements.
    """

    # The 26 Frozen Canonical SMRITI Business Capabilities
    CANONICAL_CAPABILITIES: Dict[str, Dict[str, Any]] = {
        "POS": {
            "name": "Point of Sale (POS)",
            "category": "COMMERCE",
            "description": "High-throughput cashier till, shift reconciliation, and offline transaction processing.",
            "dependencies": ["INVENTORY", "SALES", "ACCOUNTING"],
            "is_core": False,
            "default_enabled": True,
        },
        "SALES": {
            "name": "Sales & Billing Engine",
            "category": "COMMERCE",
            "description": "Order-to-cash lifecycle, sales invoicing, credit memos, and quotations.",
            "dependencies": ["INVENTORY", "ACCOUNTING"],
            "is_core": True,
            "default_enabled": True,
        },
        "PURCHASE": {
            "name": "Procurement & Purchase Engine",
            "category": "OPERATIONS",
            "description": "Procure-to-pay lifecycle, supplier POs, goods receipt notes (GRN), and supplier bills.",
            "dependencies": ["INVENTORY", "ACCOUNTING"],
            "is_core": True,
            "default_enabled": True,
        },
        "INVENTORY": {
            "name": "Inventory & Stock Management",
            "category": "CORE",
            "description": "Perpetual inventory tracking, stock movements, adjustments, and reorder levels.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "WMS": {
            "name": "Warehouse Management System (WMS)",
            "category": "OPERATIONS",
            "description": "Multi-location bin/rack tracking, batch & expiry control, wave picking, and packing.",
            "dependencies": ["INVENTORY"],
            "is_core": False,
            "default_enabled": True,
        },
        "DISTRIBUTION": {
            "name": "Distribution & Store Replenishment",
            "category": "OPERATIONS",
            "description": "Multi-branch hub-and-spoke replenishment and inter-store transfer orders.",
            "dependencies": ["INVENTORY", "WMS"],
            "is_core": False,
            "default_enabled": False,
        },
        "ECOM": {
            "name": "eCommerce & Omnichannel Connectors",
            "category": "COMMERCE",
            "description": "Shopify, WooCommerce, and custom webstore synchronization and real-time inventory reservation.",
            "dependencies": ["INVENTORY", "SALES"],
            "is_core": False,
            "default_enabled": True,
        },
        "PSV": {
            "name": "Production Observability (PSV)",
            "category": "PLATFORM",
            "description": "Immutable stock event ledger and projection engine for real-time SKU observability.",
            "dependencies": ["INVENTORY"],
            "is_core": False,
            "default_enabled": False,
        },
        "PDT": {
            "name": "Product Digital Twin (PDT)",
            "category": "OPERATIONS",
            "description": "Individual unit serialization, lifecycle traceability, warranty, and batch history.",
            "dependencies": ["INVENTORY", "BARCODE"],
            "is_core": False,
            "default_enabled": False,
        },
        "CGE": {
            "name": "Commercial Growth Engine (CGE)",
            "category": "COMMERCE",
            "description": "Integrated customer loyalty tiers, referral reward programs, and sales commission structures.",
            "dependencies": ["CRM", "SALES"],
            "is_core": False,
            "default_enabled": True,
        },
        "CRM": {
            "name": "Customer Relationship Management (CRM)",
            "category": "CORE",
            "description": "Universal customer profiles, customer groups, credit limits, and interaction history.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "ACCOUNTING": {
            "name": "Authoritative Double-Entry Accounting",
            "category": "CORE",
            "description": "General ledger, journal vouchers, chart of accounts, and financial statement snapshots.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "GST": {
            "name": "Statutory GST & E-Invoicing Engine",
            "category": "COMPLIANCE",
            "description": "GST compliance, E-Way Bill generation, NIC E-Invoice JSON payloads, and GSTR summaries.",
            "dependencies": ["SALES", "ACCOUNTING"],
            "is_core": False,
            "default_enabled": True,
        },
        "PAYMENTS": {
            "name": "Multi-Tender Payment Gateway & Ledger",
            "category": "COMMERCE",
            "description": "Cash, UPI, Credit/Debit card, split tenders, and payment reconciliation ledger.",
            "dependencies": ["ACCOUNTING"],
            "is_core": True,
            "default_enabled": True,
        },
        "PRICING": {
            "name": "Dynamic Pricing & Price Books",
            "category": "COMMERCE",
            "description": "Multi-tier price books, customer-specific pricing, and bulk quantity breaks.",
            "dependencies": ["INVENTORY"],
            "is_core": False,
            "default_enabled": True,
        },
        "PROMOTIONS": {
            "name": "Promotions, Coupons & Discounts",
            "category": "COMMERCE",
            "description": "Rule-based promotional campaigns, coupon codes, and bundle discount mechanics.",
            "dependencies": ["PRICING", "SALES"],
            "is_core": False,
            "default_enabled": True,
        },
        "FULFILLMENT": {
            "name": "Order Fulfillment & Logistics",
            "category": "OPERATIONS",
            "description": "Packing slips, dispatch manifests, delivery commission settlements, and reverse logistics.",
            "dependencies": ["SALES", "INVENTORY"],
            "is_core": False,
            "default_enabled": True,
        },
        "BARCODE": {
            "name": "Barcode Studio & Layout Engine",
            "category": "OPERATIONS",
            "description": "Dynamic 1D (EAN-13, Code-128) and 2D (QR) barcode layout generation and styling.",
            "dependencies": [],
            "is_core": False,
            "default_enabled": True,
        },
        "LABEL_PRINTING": {
            "name": "Thermal Label & Receipt Printing",
            "category": "OPERATIONS",
            "description": "Direct thermal ESC/POS, TSPL, and ZPL label printing drivers.",
            "dependencies": ["BARCODE"],
            "is_core": False,
            "default_enabled": True,
        },
        "REPORTING": {
            "name": "Analytics & Intelligence Reporting",
            "category": "PLATFORM",
            "description": "Flexi-grid reporting, automated report scheduling, and analytical dashboards.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "COMMUNICATOR": {
            "name": "Omnichannel Communicator Hub",
            "category": "PLATFORM",
            "description": "SMS, WhatsApp, and Email transactional notification dispatch and delivery tracking.",
            "dependencies": [],
            "is_core": False,
            "default_enabled": True,
        },
        "DOCUMENT": {
            "name": "Document Governance & Numbering",
            "category": "CORE",
            "description": "Statutory sequential document numbering series, PDF templates, and artifact storage.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "APPROVAL": {
            "name": "Approval Matrix & Workflows",
            "category": "PLATFORM",
            "description": "Configurable multi-tier financial thresholds, discount deviation limits, and approval routing.",
            "dependencies": [],
            "is_core": False,
            "default_enabled": True,
        },
        "SEARCH": {
            "name": "Unified Global Search Engine",
            "category": "PLATFORM",
            "description": "High-performance index lookup across products, barcodes, customers, and invoices.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "INTEGRATION": {
            "name": "Transactional Outbox & Integrations",
            "category": "PLATFORM",
            "description": "Guaranteed at-least-once outbox events, webhook dispatchers, and Tally ERP sync.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
        "AUDIT": {
            "name": "Immutable Audit Trail & Governance",
            "category": "PLATFORM",
            "description": "Tamper-evident operational audit logs, security event traces, and session tracking.",
            "dependencies": [],
            "is_core": True,
            "default_enabled": True,
        },
    }

    # Standard Plan Tier Bundles
    PLAN_TIER_CAPABILITIES: Dict[str, List[str]] = {
        "BASIC": [
            "INVENTORY", "SALES", "CRM", "ACCOUNTING", "DOCUMENT", "SEARCH", "REPORTING", "AUDIT"
        ],
        "PROFESSIONAL": [
            "INVENTORY", "SALES", "PURCHASE", "POS", "CRM", "ACCOUNTING", "GST", "PAYMENTS",
            "PRICING", "BARCODE", "LABEL_PRINTING", "DOCUMENT", "SEARCH", "REPORTING", "COMMUNICATOR",
            "INTEGRATION", "AUDIT"
        ],
        "ENTERPRISE": list(CANONICAL_CAPABILITIES.keys()),
    }

    @classmethod
    def get_all_capabilities(cls) -> List[Dict[str, Any]]:
        """Returns the full 26-capability catalog with code, name, category, and dependencies."""
        result = []
        for code, meta in cls.CANONICAL_CAPABILITIES.items():
            item = {"code": code, **meta}
            result.append(item)
        return result

    @classmethod
    def validate_capability_dependencies(
        cls,
        active_capability_codes: List[str]
    ) -> Tuple[bool, List[str]]:
        """
        Strictly validates dependency prerequisites (fails closed):
        Returns (True, []) if all dependencies are satisfied.
        Returns (False, [missing_errors]) if any dependency is violated.
        """
        active_set: Set[str] = {c.strip().upper() for c in active_capability_codes if c}
        errors: List[str] = []

        for code in active_set:
            if code not in cls.CANONICAL_CAPABILITIES:
                errors.append(f"Unknown capability code: '{code}'.")
                continue

            prereqs = cls.CANONICAL_CAPABILITIES[code].get("dependencies", [])
            for prereq in prereqs:
                if prereq not in active_set:
                    errors.append(
                        f"Capability '{code}' requires prerequisite '{prereq}', which is not enabled."
                    )

        return (len(errors) == 0, errors)

    @classmethod
    def resolve_effective_capabilities(
        cls,
        plan_tier: str = "ENTERPRISE",
        tenant_overrides: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """
        Resolves effective capabilities for a tenant based on plan tier + tenant overrides + dependency checks.
        """
        tier = str(plan_tier).strip().upper()
        base_codes = set(cls.PLAN_TIER_CAPABILITIES.get(tier, cls.PLAN_TIER_CAPABILITIES["ENTERPRISE"]))

        if tenant_overrides:
            for code, enabled in tenant_overrides.items():
                code_u = code.strip().upper()
                if enabled:
                    base_codes.add(code_u)
                else:
                    base_codes.discard(code_u)

        # Validate dependencies (fail closed: prune invalid capabilities)
        is_valid, errors = cls.validate_capability_dependencies(list(base_codes))

        return {
            "plan_tier": tier,
            "is_valid": is_valid,
            "active_capabilities": sorted(list(base_codes)),
            "active_count": len(base_codes),
            "dependency_errors": errors,
        }
