"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set
from sqlalchemy import select, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.capability_template import (
    PlatformCapability,
    WorkspaceTemplate,
    TenantCapabilityBinding,
    UserWorkspaceConfig,
)


STANDARD_CAPABILITIES = [
    {
        "code": "BATCH_EXPIRY_FEFO",
        "name": "Batch Expiry & First-Expired First-Out Control",
        "category": "INVENTORY",
        "description": "Enforces batch tracking, manufacturing/expiry date capture, and automated FEFO sales allocation."
    },
    {
        "code": "SERIAL_IMEI_TRACKING",
        "name": "Serial Number & IMEI Lifecycle Tracking",
        "category": "INVENTORY",
        "description": "Tracks unique serial/IMEI identifiers across receipt, stock movements, and warranty registrations."
    },
    {
        "code": "STYLE_COLOR_SIZE_MATRIX",
        "name": "Apparel Multi-Attribute Matrix Grid",
        "category": "POS",
        "description": "Multi-dimensional grid entry for style, size, fit, and color variants."
    },
    {
        "code": "TABLE_ORDERING",
        "name": "Restaurant Table & KOT Management",
        "category": "POS",
        "description": "Floor plan visual table ordering, split checks, and kitchen order ticket dispatch."
    },
    {
        "code": "RULE55_DELIVERY_CHALLAN",
        "name": "Rule 55 Delivery Challan Logistics",
        "category": "WMS",
        "description": "Statutory non-supply goods movement documentation and godown transfers."
    },
    {
        "code": "PHYSICAL_STOCK_AUDIT",
        "name": "Warehouse Physical Inventory Reconciliation",
        "category": "WMS",
        "description": "Barcode batch counting, discrepancy tracking, and surplus/loss ledger adjustments."
    }
]

STANDARD_TEMPLATES = [
    {
        "code": "RETAIL_SUPERMARKET",
        "name": "Retail & Supermarket Workspace",
        "vertical": "SUPERMARKET",
        "included_capabilities": ["BATCH_EXPIRY_FEFO"],
        "layout_config": {
            "default_view": "POS_FAST_BILLING",
            "widgets": ["DAILY_SALES", "FAST_MOVING_ITEMS", "SHIFT_CASH_DRAWER"]
        }
    },
    {
        "code": "APPAREL_FASHION",
        "name": "Fashion, Apparel & Footwear Workspace",
        "vertical": "APPAREL",
        "included_capabilities": ["STYLE_COLOR_SIZE_MATRIX"],
        "layout_config": {
            "default_view": "MATRIX_GRID_ENTRY",
            "widgets": ["SEASONAL_SALES", "SIZE_BREAKDOWN", "PROMOTIONAL_CAMPAIGNS"]
        }
    },
    {
        "code": "DISTRIBUTOR_WMS",
        "name": "Distributor & Logistics WMS Workspace",
        "vertical": "WMS",
        "included_capabilities": ["BATCH_EXPIRY_FEFO", "RULE55_DELIVERY_CHALLAN", "PHYSICAL_STOCK_AUDIT"],
        "layout_config": {
            "default_view": "WMS_GODOWN_DASHBOARD",
            "widgets": ["INWARD_GRN_QUEUE", "FEFO_EXPIRING_SOON", "DELIVERY_CHALLANS"]
        }
    },
    {
        "code": "PHARMACY_HEALTH",
        "name": "Pharmacy & Healthcare Workspace",
        "vertical": "PHARMACY",
        "included_capabilities": ["BATCH_EXPIRY_FEFO", "SERIAL_IMEI_TRACKING"],
        "layout_config": {
            "default_view": "PHARMA_RX_BILLING",
            "widgets": ["SCHEDULE_H_LOG", "NEAR_EXPIRY_ALERT", "DOCTOR_PRESCRIBER_SUMMARY"]
        }
    }
]


class UnifiedWorkspaceCapabilityService:
    """
    Authoritative Capability Registry, Workspace Template, and Tenant Layout Resolution Service.
    Enforces control-plane catalog integrity in smritisys and tenant-scoped customization in smritiXXX.
    """

    # =========================================================================
    # 1. CONTROL PLANE SEEDING & CATALOG MANAGEMENT (smritisys)
    # =========================================================================
    @classmethod
    async def seed_control_catalog(cls, control_session: AsyncSession) -> Dict[str, int]:
        """
        Seeds standard platform capabilities and workspace templates in the control plane database (smritisys).
        """
        caps_seeded = 0
        templates_seeded = 0

        # Capabilities
        for item in STANDARD_CAPABILITIES:
            stmt = select(PlatformCapability).where(PlatformCapability.code == item["code"])
            existing = (await control_session.execute(stmt)).scalar_one_or_none()
            if not existing:
                cap = PlatformCapability(
                    id=f"cap_{uuid.uuid4().hex[:12]}",
                    company_id="SMRITISYS",
                    branch_id="SYSTEM",
                    name=item["name"],
                    code=item["code"],
                    category=item["category"],
                    description=item["description"],
                    default_enabled=False,
                    status="ACTIVE",
                    is_active=True,
                    is_deleted=False
                )
                control_session.add(cap)
                caps_seeded += 1

        # Templates
        for tpl in STANDARD_TEMPLATES:
            stmt = select(WorkspaceTemplate).where(WorkspaceTemplate.code == tpl["code"])
            existing = (await control_session.execute(stmt)).scalar_one_or_none()
            if not existing:
                wt = WorkspaceTemplate(
                    id=f"wt_{uuid.uuid4().hex[:12]}",
                    company_id="SMRITISYS",
                    branch_id="SYSTEM",
                    name=tpl["name"],
                    code=tpl["code"],
                    vertical=tpl["vertical"],
                    included_capabilities=tpl["included_capabilities"],
                    layout_config=tpl["layout_config"],
                    is_system_template=True,
                    status="ACTIVE",
                    is_active=True,
                    is_deleted=False
                )
                control_session.add(wt)
                templates_seeded += 1

        await control_session.commit()
        return {"capabilities_seeded": caps_seeded, "templates_seeded": templates_seeded}

    # =========================================================================
    # 2. TENANT PLANE CAPABILITY BINDINGS (smritiXXX)
    # =========================================================================
    @classmethod
    async def bind_tenant_capability(
        cls,
        tenant_session: AsyncSession,
        company_id: str,
        capability_code: str,
        is_enabled: bool = True,
        configuration: Optional[Dict[str, Any]] = None,
        branch_id: str = "BR-001"
    ) -> TenantCapabilityBinding:
        """
        Activates or modifies a capability subscription inside the tenant data plane.
        """
        clean_code = capability_code.strip().upper()
        stmt = select(TenantCapabilityBinding).where(
            TenantCapabilityBinding.capability_code == clean_code,
            TenantCapabilityBinding.is_deleted == False
        )
        binding = (await tenant_session.execute(stmt)).scalar_one_or_none()

        if binding:
            binding.is_enabled = is_enabled
            if configuration:
                binding.configuration = configuration
        else:
            binding = TenantCapabilityBinding(
                id=f"tcb_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                capability_code=clean_code,
                is_enabled=is_enabled,
                configuration=configuration or {},
                is_active=True,
                is_deleted=False
            )
            tenant_session.add(binding)

        await tenant_session.commit()
        refetch = select(TenantCapabilityBinding).where(TenantCapabilityBinding.id == binding.id)
        return (await tenant_session.execute(refetch)).scalar_one()

    @classmethod
    async def get_effective_tenant_capabilities(
        cls,
        tenant_session: AsyncSession,
        company_id: str
    ) -> Set[str]:
        """
        Returns the set of active, enabled capability codes for a specific tenant database.
        """
        stmt = select(TenantCapabilityBinding.capability_code).where(
            TenantCapabilityBinding.is_enabled == True,
            TenantCapabilityBinding.is_deleted == False
        )
        results = (await tenant_session.execute(stmt)).scalars().all()
        return set(results)

    # =========================================================================
    # 3. USER WORKSPACE LAYOUT RESOLUTION (Cross-Plane Evaluation)
    # =========================================================================
    @classmethod
    async def resolve_user_workspace_layout(
        cls,
        control_session: AsyncSession,
        tenant_session: AsyncSession,
        company_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Resolves the final runtime workspace layout for a user by evaluating their
        preference template against active tenant capability bindings.
        """
        # 1. Fetch user workspace config in tenant DB
        u_stmt = select(UserWorkspaceConfig).where(
            UserWorkspaceConfig.user_id == user_id,
            UserWorkspaceConfig.is_deleted == False
        )
        u_cfg = (await tenant_session.execute(u_stmt)).scalar_one_or_none()
        template_code = u_cfg.template_code if u_cfg else "RETAIL_SUPERMARKET"
        theme = u_cfg.theme_preference if u_cfg else "DARK_RETRO"
        pinned = u_cfg.pinned_modules if u_cfg else []

        # 2. Fetch master template from control plane (smritisys)
        t_stmt = select(WorkspaceTemplate).where(
            WorkspaceTemplate.code == template_code,
            WorkspaceTemplate.status == "ACTIVE",
            WorkspaceTemplate.is_deleted == False
        )
        template = (await control_session.execute(t_stmt)).scalar_one_or_none()
        if not template:
            # Fallback to default supermarket
            t_stmt_fb = select(WorkspaceTemplate).where(WorkspaceTemplate.code == "RETAIL_SUPERMARKET")
            template = (await control_session.execute(t_stmt_fb)).scalar_one()

        # 3. Fetch active tenant capabilities
        tenant_caps = await cls.get_effective_tenant_capabilities(tenant_session, company_id)

        # 4. Filter template capabilities to only those enabled for this tenant
        active_template_caps = [
            c for c in (template.included_capabilities or [])
            if c in tenant_caps
        ]

        return {
            "user_id": user_id,
            "company_id": company_id,
            "workspace_template": {
                "code": template.code,
                "name": template.name,
                "vertical": template.vertical,
                "layout_config": template.layout_config,
            },
            "theme_preference": theme,
            "pinned_modules": pinned,
            "active_capabilities": active_template_caps,
            "all_tenant_enabled_capabilities": list(tenant_caps)
        }
