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

import uuid
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from ..models.capability_template import (
    PlatformCapability,
    TenantCapabilityBinding,
    FeatureFlag,
    ModuleState,
)


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

    # =========================================================================
    # Async Database-Backed Control-Plane & Tenant Methods
    # =========================================================================

    @classmethod
    async def get_db_capabilities(cls, db: AsyncSession) -> List[PlatformCapability]:
        """Fetch all platform capabilities from smritisys control plane."""
        stmt = select(PlatformCapability).where(
            PlatformCapability.is_active == True,
            PlatformCapability.is_deleted == False,
        ).order_by(PlatformCapability.code)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_tenant_bindings(cls, company_db: AsyncSession) -> List[TenantCapabilityBinding]:
        """Fetch all active capability bindings for tenant."""
        stmt = select(TenantCapabilityBinding).where(
            TenantCapabilityBinding.is_deleted == False
        ).order_by(TenantCapabilityBinding.capability_code)
        result = await company_db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def toggle_tenant_capability(
        cls,
        company_db: AsyncSession,
        capability_code: str,
        enable: bool,
        force: bool = False,
    ) -> TenantCapabilityBinding:
        """
        Enable or disable capability for tenant with strict dependency check (fail closed).
        """
        code = capability_code.strip().upper()

        # Get current active tenant capabilities
        stmt_all = select(TenantCapabilityBinding).where(
            TenantCapabilityBinding.is_deleted == False
        )
        existing_bindings = (await company_db.execute(stmt_all)).scalars().all()
        binding_map = {b.capability_code: b for b in existing_bindings}
        active_codes = {b.capability_code for b in existing_bindings if b.is_enabled}

        if enable:
            # Check prerequisites
            prereqs = cls.CANONICAL_CAPABILITIES.get(code, {}).get("dependencies", [])
            missing_prereqs = [p for p in prereqs if p not in active_codes]
            if missing_prereqs and not force:
                raise ValueError(
                    f"Cannot enable capability '{code}': missing prerequisite capabilities {missing_prereqs}."
                )

            if code in binding_map:
                binding = binding_map[code]
                binding.is_enabled = True
                binding.is_active = True
                binding.status = "ACTIVE"
                binding.activated_at = datetime.now(timezone.utc)
            else:
                binding = TenantCapabilityBinding(
                    id=f"tcb_{uuid.uuid4().hex[:12]}",
                    capability_code=code,
                    is_enabled=True,
                    is_active=True,
                    status="ACTIVE",
                    activated_at=datetime.now(timezone.utc),
                )
                company_db.add(binding)

        else:
            # Check if any active capability depends on this one
            if not force:
                dependent_active = []
                for act_code in active_codes:
                    if act_code == code:
                        continue
                    act_prereqs = cls.CANONICAL_CAPABILITIES.get(act_code, {}).get("dependencies", [])
                    if code in act_prereqs:
                        dependent_active.append(act_code)

                if dependent_active:
                    raise ValueError(
                        f"Cannot disable capability '{code}': active capabilities {dependent_active} depend on it."
                    )

            if code in binding_map:
                binding = binding_map[code]
                binding.is_enabled = False
                binding.status = "DISABLED"
            else:
                binding = TenantCapabilityBinding(
                    id=f"tcb_{uuid.uuid4().hex[:12]}",
                    capability_code=code,
                    is_enabled=False,
                    is_active=False,
                    status="DISABLED",
                )
                company_db.add(binding)

        await company_db.commit()
        await company_db.refresh(binding)
        return binding

    @classmethod
    async def get_feature_flags(
        cls, db: AsyncSession, company_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch feature flags and evaluate tenant enablement."""
        stmt = select(FeatureFlag).where(
            FeatureFlag.is_active == True,
            FeatureFlag.is_deleted == False,
        ).order_by(FeatureFlag.key)
        result = await db.execute(stmt)
        flags = result.scalars().all()

        output = []
        for f in flags:
            overrides = f.company_overrides or {}
            is_company_enabled = overrides.get(company_id, f.is_global_enabled) if company_id else f.is_global_enabled
            output.append({
                "id": f.id,
                "key": f.key,
                "name": f.name,
                "category": f.category,
                "description": f.description,
                "is_global_enabled": f.is_global_enabled,
                "is_enabled_for_company": is_company_enabled,
            })
        return output

    @classmethod
    async def toggle_feature_flag(
        cls, db: AsyncSession, flag_key: str, company_id: str, enable: bool
    ) -> FeatureFlag:
        """Set company-level override for a feature flag."""
        stmt = select(FeatureFlag).where(
            FeatureFlag.key == flag_key.strip(),
            FeatureFlag.is_deleted == False,
        )
        flag = (await db.execute(stmt)).scalars().first()
        if not flag:
            raise ValueError(f"Feature flag '{flag_key}' not found.")

        overrides = dict(flag.company_overrides or {})
        overrides[company_id] = enable
        flag.company_overrides = overrides
        await db.commit()
        await db.refresh(flag)
        return flag

    @classmethod
    async def get_module_states(
        cls, db: AsyncSession, tenant_id: Optional[str] = None
    ) -> List[ModuleState]:
        """Fetch module lifecycle states."""
        stmt = select(ModuleState)
        if tenant_id:
            stmt = stmt.where(ModuleState.tenant_id == tenant_id)
        result = await db.execute(stmt.order_by(ModuleState.module_uuid))
        return list(result.scalars().all())

