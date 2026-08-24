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

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import select, delete
from app.db.session import get_company_sessionmaker, async_session
from app.services.workspace_cap_svc import UnifiedWorkspaceCapabilityService
from app.models.capability_template import (
    PlatformCapability,
    WorkspaceTemplate,
    TenantCapabilityBinding,
    UserWorkspaceConfig,
)


@pytest.fixture(autouse=True)
async def cleanup_and_seed_workspace_data():
    """Seed control plane and clean up tenant bindings before and after tests."""
    # 1. Seed smritisys
    async with async_session() as control_session:
        await UnifiedWorkspaceCapabilityService.seed_control_catalog(control_session)

    # 2. Clean tenant DBs
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as tenant_session:
            await tenant_session.execute(delete(UserWorkspaceConfig).where(UserWorkspaceConfig.user_id.like("test_usr_%")))
            await tenant_session.execute(delete(TenantCapabilityBinding).where(TenantCapabilityBinding.capability_code.like("TEST_%")))
            await tenant_session.execute(delete(TenantCapabilityBinding).where(TenantCapabilityBinding.capability_code.in_([
                "BATCH_EXPIRY_FEFO", "SERIAL_IMEI_TRACKING", "STYLE_COLOR_SIZE_MATRIX", "RULE55_DELIVERY_CHALLAN"
            ])))
            await tenant_session.commit()
    yield
    for db in ["smriti001", "smriti002"]:
        session_factory = get_company_sessionmaker(db)
        async with session_factory() as tenant_session:
            await tenant_session.execute(delete(UserWorkspaceConfig).where(UserWorkspaceConfig.user_id.like("test_usr_%")))
            await tenant_session.execute(delete(TenantCapabilityBinding).where(TenantCapabilityBinding.capability_code.like("TEST_%")))
            await tenant_session.execute(delete(TenantCapabilityBinding).where(TenantCapabilityBinding.capability_code.in_([
                "BATCH_EXPIRY_FEFO", "SERIAL_IMEI_TRACKING", "STYLE_COLOR_SIZE_MATRIX", "RULE55_DELIVERY_CHALLAN"
            ])))
            await tenant_session.commit()


@pytest.mark.asyncio
async def test_control_plane_capability_and_template_seeding():
    """Verify smritisys stores canonical platform capabilities and workspace templates."""
    async with async_session() as control_session:
        # Check platform capabilities
        cap_stmt = select(PlatformCapability).where(PlatformCapability.code == "BATCH_EXPIRY_FEFO")
        cap = (await control_session.execute(cap_stmt)).scalar_one_or_none()
        assert cap is not None
        assert cap.category == "INVENTORY"
        assert "Batch Expiry" in cap.name

        # Check workspace templates
        tpl_stmt = select(WorkspaceTemplate).where(WorkspaceTemplate.code == "DISTRIBUTOR_WMS")
        tpl = (await control_session.execute(tpl_stmt)).scalar_one_or_none()
        assert tpl is not None
        assert tpl.vertical == "WMS"
        assert "RULE55_DELIVERY_CHALLAN" in tpl.included_capabilities


@pytest.mark.asyncio
async def test_tenant_capability_binding_and_filtering():
    """Verify tenant database activates specific capabilities."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as tenant_session:
        # 1. Bind BATCH_EXPIRY_FEFO
        await UnifiedWorkspaceCapabilityService.bind_tenant_capability(
            tenant_session=tenant_session,
            company_id="COMP-001",
            capability_code="BATCH_EXPIRY_FEFO",
            is_enabled=True
        )

        # 2. Bind RULE55_DELIVERY_CHALLAN
        await UnifiedWorkspaceCapabilityService.bind_tenant_capability(
            tenant_session=tenant_session,
            company_id="COMP-001",
            capability_code="RULE55_DELIVERY_CHALLAN",
            is_enabled=True
        )

        # 3. Verify effective tenant capabilities
        active_caps = await UnifiedWorkspaceCapabilityService.get_effective_tenant_capabilities(
            tenant_session=tenant_session,
            company_id="COMP-001"
        )

        assert "BATCH_EXPIRY_FEFO" in active_caps
        assert "RULE55_DELIVERY_CHALLAN" in active_caps
        assert "STYLE_COLOR_SIZE_MATRIX" not in active_caps


@pytest.mark.asyncio
async def test_user_workspace_layout_cross_plane_resolution():
    """Verify user workspace layout combines control-plane template with tenant-plane capabilities."""
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as tenant_session, async_session() as control_session:
        # 1. Set user workspace config for an apparel warehouse manager
        u_cfg = UserWorkspaceConfig(
            id="uwc_test_01",
            company_id="COMP-001",
            branch_id="BR-001",
            user_id="test_usr_fashion_01",
            template_code="APPAREL_FASHION",
            theme_preference="DARK_RETRO",
            pinned_modules=["POS_MATRIX", "STYLE_CATALOG"],
            is_active=True,
            is_deleted=False
        )
        tenant_session.add(u_cfg)

        # 2. Enable STYLE_COLOR_SIZE_MATRIX in tenant
        await UnifiedWorkspaceCapabilityService.bind_tenant_capability(
            tenant_session=tenant_session,
            company_id="COMP-001",
            capability_code="STYLE_COLOR_SIZE_MATRIX",
            is_enabled=True
        )

        # 3. Resolve layout
        res = await UnifiedWorkspaceCapabilityService.resolve_user_workspace_layout(
            control_session=control_session,
            tenant_session=tenant_session,
            company_id="COMP-001",
            user_id="test_usr_fashion_01"
        )

        assert res["user_id"] == "test_usr_fashion_01"
        assert res["workspace_template"]["code"] == "APPAREL_FASHION"
        assert res["theme_preference"] == "DARK_RETRO"
        assert "STYLE_COLOR_SIZE_MATRIX" in res["active_capabilities"]
        assert "POS_MATRIX" in res["pinned_modules"]


@pytest.mark.asyncio
async def test_capability_and_workspace_tenant_isolation():
    """Verify tenant capability bindings do not leak between smriti001 and smriti002."""
    session_001 = get_company_sessionmaker("smriti001")
    session_002 = get_company_sessionmaker("smriti002")

    async with session_001() as s1:
        await UnifiedWorkspaceCapabilityService.bind_tenant_capability(
            tenant_session=s1,
            company_id="COMP-001",
            capability_code="SERIAL_IMEI_TRACKING",
            is_enabled=True
        )
        caps1 = await UnifiedWorkspaceCapabilityService.get_effective_tenant_capabilities(s1, "COMP-001")
        assert "SERIAL_IMEI_TRACKING" in caps1

    async with session_002() as s2:
        caps2 = await UnifiedWorkspaceCapabilityService.get_effective_tenant_capabilities(s2, "COMP-002")
        assert "SERIAL_IMEI_TRACKING" not in caps2, "Capability binding in smriti001 must not leak into smriti002!"
