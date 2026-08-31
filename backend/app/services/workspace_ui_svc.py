"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
from typing import List, Optional, Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from ..models.capability_template import (
    WorkspaceTemplate,
    UserWorkspaceConfig,
    TenantCapabilityBinding,
)
from ..models.ui_control_plane import (
    SmritiTheme,
    SmritiThemeVariant,
    SmritiWorkspaceProfile,
    ScreenDefinition,
    FieldDefinition,
    ActionDefinition,
    IconRegistry,
)
from ..models.menu import SmritiMenu
from ..models.auth import User


class WorkspaceUIRegistryService:
    """
    Control Plane Workspace, Menu, and UI Experience Registry Service (P1.3).
    Resolves persona workspace layouts, capability-gated and role-gated navigation trees,
    design tokens, and comprehensive screen metadata packages.
    """

    @classmethod
    async def get_workspace_templates(cls, db: AsyncSession) -> List[WorkspaceTemplate]:
        stmt = select(WorkspaceTemplate).where(
            WorkspaceTemplate.is_deleted == False
        ).order_by(WorkspaceTemplate.code)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def resolve_user_workspace(
        cls,
        db: AsyncSession,
        company_db: AsyncSession,
        user: User,
        template_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resolves the full active workspace experience for a user based on:
        - Persona profile
        - Active tenant capabilities
        - Workspace template
        """
        role_str = (
            user.role.value if hasattr(user.role, "value") else str(user.role)
        ).upper()

        # 1. Fetch active tenant capabilities
        stmt_caps = select(TenantCapabilityBinding.capability_code).where(
            TenantCapabilityBinding.is_enabled == True,
            TenantCapabilityBinding.is_deleted == False,
        )
        active_caps = set((await company_db.execute(stmt_caps)).scalars().all())

        # 2. Resolve template
        target_template_code = template_code or "RETAIL_SUPERMARKET"
        stmt_tpl = select(WorkspaceTemplate).where(
            WorkspaceTemplate.code == target_template_code,
            WorkspaceTemplate.is_deleted == False,
        )
        tpl = (await db.execute(stmt_tpl)).scalars().first()

        if not tpl:
            # Fallback to default supermarket template
            stmt_fb = select(WorkspaceTemplate).where(
                WorkspaceTemplate.code == "RETAIL_SUPERMARKET"
            )
            tpl = (await db.execute(stmt_fb)).scalars().first()

        layout_config = tpl.layout_config if tpl else {}
        default_widgets = layout_config.get("widgets", ["DAILY_SALES", "SHIFT_DRAWER", "FAST_ITEMS"])

        # 3. Resolve persona profile
        role_to_code = {
            "CASHIER": "PROF_CASHIER",
            "STORE_MANAGER": "PROF_STORE_MANAGER",
            "MANAGER": "PROF_STORE_MANAGER",
            "ACCOUNTANT": "PROF_ACCOUNTANT",
            "SYSADMIN": "PROF_SYSADMIN",
        }
        prof_code = role_to_code.get(role_str, "PROF_SYSADMIN")
        stmt_prof = select(SmritiWorkspaceProfile).where(
            SmritiWorkspaceProfile.code == prof_code,
            SmritiWorkspaceProfile.is_active == True,
        )
        prof = (await db.execute(stmt_prof)).scalars().first()

        shortcuts = []
        if prof and prof.shortcuts_json:
            try:
                shortcuts = json.loads(prof.shortcuts_json)
            except Exception:
                shortcuts = []

        return {
            "template_code": tpl.code if tpl else target_template_code,
            "persona": prof_code,
            "theme_code": prof.theme if prof else "theme-smriti-default",
            "active_capabilities": sorted(list(active_caps)),
            "widgets": default_widgets,
            "shortcuts": shortcuts,
            "layout_config": layout_config,
        }

    @classmethod
    async def resolve_navigation_tree(
        cls,
        db: AsyncSession,
        company_db: AsyncSession,
        user: User,
    ) -> List[Dict[str, Any]]:
        """
        Resolves the hierarchical navigation tree for the current user:
        1. Queries smriti_menus table.
        2. Filters out items where user role lacks VIEW permission.
        3. Filters out items whose required_capability is NOT enabled for the tenant.
        4. Prunes empty parent folders.
        """
        role_str = (
            user.role.value if hasattr(user.role, "value") else str(user.role)
        ).upper()

        # Fetch active tenant capabilities
        stmt_caps = select(TenantCapabilityBinding.capability_code).where(
            TenantCapabilityBinding.is_enabled == True,
            TenantCapabilityBinding.is_deleted == False,
        )
        active_caps = set((await company_db.execute(stmt_caps)).scalars().all())

        # Always include universal core modules in active_caps for navigation
        active_caps.update({"INVENTORY", "SALES", "CRM", "ACCOUNTING", "REPORTING", "SEARCH", "DOCUMENT", "AUDIT"})

        # Fetch all active menus
        stmt_menus = select(SmritiMenu).where(
            SmritiMenu.is_active == True,
            SmritiMenu.is_deleted == False,
        ).order_by(SmritiMenu.sequence.asc())
        menus = (await db.execute(stmt_menus)).scalars().all()

        # Build mapping and tree
        admin_roles = {"SYSADMIN", "SUPERADMIN"}
        manager_roles = {"SYSADMIN", "SUPERADMIN", "STORE_MANAGER", "MANAGER"}

        def is_accessible(menu: SmritiMenu) -> bool:
            # 1. Capability gating: if required_capability is set and not active in tenant
            if menu.module and menu.module.upper() in ["WMS", "DISTRIBUTION", "ECOM", "PDT", "CGE", "APPROVAL"]:
                if menu.module.upper() not in active_caps:
                    return False

            # 2. Role gating
            if menu.route in ["/admin/system", "/settings/security", "/dev/tracker", "/audit/logs"]:
                if role_str not in admin_roles:
                    return False

            if role_str == "CASHIER":
                # Cashier only sees POS, basic sales, and self-reports
                allowed_prefixes = ["/pos", "/sales", "/billing", "/exchange", "/profile", "/logout"]
                if menu.route and not any(menu.route.startswith(p) for p in allowed_prefixes):
                    return False

            return True

        # Construct tree
        menu_dict: Dict[str, Dict[str, Any]] = {}
        roots: List[Dict[str, Any]] = []

        for m in menus:
            if not is_accessible(m):
                continue

            node = {
                "id": m.id,
                "title": m.title,
                "path": m.route,
                "icon": m.icon,
                "required_capability": m.module,
                "badge": m.badge,
                "sequence": m.sequence,
                "parent_id": m.parent_id,
                "children": [],
            }
            menu_dict[m.id] = node

        for node_id, node in menu_dict.items():
            pid = node.get("parent_id")
            if pid and pid in menu_dict:
                menu_dict[pid]["children"].append(node)
            else:
                roots.append(node)

        # Prune empty parent folders with no path
        def prune_empty_folders(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            pruned = []
            for n in nodes:
                n["children"] = prune_empty_folders(n["children"])
                # If node has path or has children, keep it
                if n.get("path") or len(n["children"]) > 0:
                    pruned.append(n)
            return pruned

        return prune_empty_folders(roots)

    @classmethod
    async def get_design_tokens(
        cls, db: AsyncSession, theme_id: Optional[str] = None, variant_name: str = "dark"
    ) -> Dict[str, Any]:
        """
        Resolves design tokens (colors, typography, radii, shadows) from smriti_themes.
        """
        stmt = (
            select(SmritiTheme)
            .options(selectinload(SmritiTheme.variants))
            .where(SmritiTheme.is_active == True)
        )
        if theme_id:
            stmt = stmt.where(SmritiTheme.id == theme_id)
        theme = (await db.execute(stmt)).scalars().first()

        if not theme:
            # Fallback theme definition
            return {
                "theme_id": "theme-smriti-default",
                "theme_name": "SMRITI Enterprise Horizon",
                "variant": variant_name,
                "font_heading": "Space Grotesk, sans-serif",
                "font_body": "Inter, sans-serif",
                "border_radius_px": 6,
                "colors": {
                    "primary": "#3B82F6",
                    "secondary": "#6366F1",
                    "accent": "#F59E0B",
                    "background": "#0F172A",
                    "surface": "#1E293B",
                    "text_primary": "#F8FAFC",
                    "text_secondary": "#94A3B8",
                    "border": "#334155",
                    "danger": "#EF4444",
                    "success": "#10B981",
                    "warning": "#F59E0B",
                },
                "spacing": {"xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px"},
                "shadows": {
                    "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                    "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                },
            }

        # Select variant
        target_v = None
        for v in theme.variants:
            if v.variant.lower() == variant_name.lower():
                target_v = v
                break
        if not target_v and theme.variants:
            target_v = theme.variants[0]

        colors = {
            "primary": target_v.primary_color if target_v else "#3B82F6",
            "secondary": target_v.secondary_color if target_v else "#6366F1",
            "accent": target_v.accent_color if target_v else "#F59E0B",
            "background": target_v.background_color if target_v else "#0F172A",
            "surface": target_v.surface_color if target_v else "#1E293B",
            "text_primary": target_v.text_primary if target_v else "#F8FAFC",
            "text_secondary": target_v.text_secondary if target_v else "#94A3B8",
            "border": target_v.border_color if target_v else "#334155",
            "danger": target_v.danger_color if target_v else "#EF4444",
            "success": target_v.success_color if target_v else "#10B981",
            "warning": target_v.warning_color if target_v else "#F59E0B",
        }

        return {
            "theme_id": theme.id,
            "theme_name": theme.theme_name,
            "variant": target_v.variant if target_v else variant_name,
            "font_heading": theme.font_heading or "Space Grotesk",
            "font_body": theme.font_body or "Inter",
            "border_radius_px": theme.border_radius_px or 6,
            "colors": colors,
            "spacing": {"xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px"},
            "shadows": {
                "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            },
        }

    @classmethod
    async def get_screen_package(cls, db: AsyncSession, screen_code: str) -> Optional[Dict[str, Any]]:
        """
        Aggregates complete screen package: screen metadata + fields + actions.
        """
        code = screen_code.strip()
        stmt_s = select(ScreenDefinition).where(
            ScreenDefinition.code == code,
            ScreenDefinition.is_active == True,
        )
        screen = (await db.execute(stmt_s)).scalars().first()
        if not screen:
            return None

        # Fetch fields
        stmt_f = select(FieldDefinition).where(
            FieldDefinition.is_active == True,
            FieldDefinition.is_deleted == False,
        )
        fields = (await db.execute(stmt_f)).scalars().all()

        # Fetch actions
        stmt_a = select(ActionDefinition).where(
            ActionDefinition.screen_code == code,
            ActionDefinition.is_active == True,
            ActionDefinition.is_deleted == False,
        ).order_by(ActionDefinition.order_index)
        actions = (await db.execute(stmt_a)).scalars().all()

        return {
            "screen_code": screen.code,
            "name": screen.name,
            "module_code": screen.module_code,
            "workspace_code": screen.workspace_code,
            "screen_type": screen.screen_type,
            "persona_mode": screen.persona_mode,
            "capability_code": screen.capability_code,
            "route_path": screen.route_path,
            "icon_key": screen.icon_key,
            "searchable": screen.searchable,
            "exportable": screen.exportable,
            "printable": screen.printable,
            "layout_config": screen.layout_config,
            "fields": fields,
            "actions": actions,
        }
