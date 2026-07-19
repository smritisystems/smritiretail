"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-18
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.auth import User
from ..models.security import (
    PermissionType,
    SMRITIMenu,
    SMRITIPermissionSetPermission,
    SMRITIRole,
    SMRITIRolePermissionSet,
    SMRITISecurityAudit,
    SMRITIUserRole,
)
from .cache import PermissionCacheFactory


async def invalidate_user_permission_cache(user_id: str):
    """
    Clear resolved permissions cache for a specific user.
    """
    provider = PermissionCacheFactory.get_provider()
    await provider.invalidate(user_id)


async def clear_all_permissions_cache():
    """
    Clear all cached permissions globally.
    """
    provider = PermissionCacheFactory.get_provider()
    await provider.clear()


class SecurityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_effective_roles(self, user_id: str) -> list[SMRITIRole]:
        """
        Traverse the user's role inheritance hierarchy and resolve all effective roles.
        """
        # 1. Fetch direct user roles mapping
        user_role_stmt = select(SMRITIUserRole).where(SMRITIUserRole.user_id == user_id)
        user_roles_res = await self.db.execute(user_role_stmt)
        direct_mappings = user_roles_res.scalars().all()
        
        if not direct_mappings:
            # Fallback to legacy User.role column for backward compatibility and test suite execution
            from ..models.auth import User
            user_stmt = select(User).where(User.id == user_id)
            user_res = await self.db.execute(user_stmt)
            user = user_res.scalar_one_or_none()
            if user and user.role:
                role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
                # Find matching role in smriti_roles by code
                role_stmt = select(SMRITIRole).where(SMRITIRole.code == role_val)
                role_res = await self.db.execute(role_stmt)
                role_obj = role_res.scalar_one_or_none()
                if role_obj:
                    resolved_role_ids = {role_obj.id}
                else:
                    return []
            else:
                return []
        else:
            resolved_role_ids = {m.role_id for m in direct_mappings}
        visited_role_ids = set()
        resolved_roles = []

        # Recursively fetch parent roles
        to_resolve = list(resolved_role_ids)
        while to_resolve:
            stmt = select(SMRITIRole).where(SMRITIRole.id.in_(to_resolve))
            res = await self.db.execute(stmt)
            roles = res.scalars().all()
            
            next_to_resolve = []
            for r in roles:
                if r.id not in visited_role_ids:
                    visited_role_ids.add(r.id)
                    resolved_roles.append(r)
                    if r.parent_role_id and r.parent_role_id not in visited_role_ids:
                        next_to_resolve.append(r.parent_role_id)
            
            to_resolve = next_to_resolve

        return resolved_roles

    async def resolve_user_permissions(self, user_id: str, bypass_cache: bool = False) -> set[str]:
        """
        Compile the dynamic list of allowed permission codes for a user.
        Precedence: Explicit Deny -> Explicit Allow -> Inherited Allow -> Default Deny
        """
        provider = PermissionCacheFactory.get_provider()
        if not bypass_cache:
            cached_perms = await provider.get(user_id)
            if cached_perms is not None:
                return cached_perms

        effective_roles = await self.get_effective_roles(user_id)
        if not effective_roles:
            return set()

        role_ids = [r.id for r in effective_roles]

        # Fetch permission sets mapped to effective roles
        role_permission_set_stmt = select(SMRITIRolePermissionSet).where(SMRITIRolePermissionSet.role_id.in_(role_ids))
        role_permission_set_res = await self.db.execute(role_permission_set_stmt)
        role_permission_sets = role_permission_set_res.scalars().all()
        
        if not role_permission_sets:
            return set()

        permission_set_ids = [rp.permission_set_id for rp in role_permission_sets]

        # Fetch permission set permission mappings
        permission_set_perm_stmt = select(SMRITIPermissionSetPermission).where(
            SMRITIPermissionSetPermission.permission_set_id.in_(permission_set_ids)
        ).options(selectinload(SMRITIPermissionSetPermission.permission))
        permission_set_perm_res = await self.db.execute(permission_set_perm_stmt)
        permission_set_permissions = permission_set_perm_res.scalars().all()

        # Apply Tri-State Logic: Deny wins over Allow
        allowed_permissions = set()
        denied_permissions = set()

        for pp in permission_set_permissions:
            perm_code = pp.permission.code
            if pp.permission_type == PermissionType.DENY:
                denied_permissions.add(perm_code)
            elif pp.permission_type == PermissionType.ALLOW:
                allowed_permissions.add(perm_code)

        # Resolve final permission codes
        resolved = allowed_permissions - denied_permissions

        await provider.set(user_id, resolved)
        return resolved

    async def verify_user_permission(self, user_id: str, permission_code: str) -> bool:
        """
        Determine if the user has a specific permission allowed.
        """
        # Let Platform Administrators bypass security checks
        user_stmt = select(User).where(User.id == user_id)
        user_res = await self.db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        if user and user.is_platform_admin:
            return True

        permissions = await self.resolve_user_permissions(user_id)
        return permission_code in permissions

    async def get_visible_menus(self, user_id: str) -> list[dict[str, Any]]:
        """
        Resolve the hierarchy of dynamic menus the user is authorized to view.
        """
        # Fetch all active menus
        menu_stmt = select(SMRITIMenu).where(SMRITIMenu.is_active).order_by(
            SMRITIMenu.sequence.asc()
        )
        menu_res = await self.db.execute(menu_stmt)
        all_menus = menu_res.scalars().all()

        # Resolve user permissions
        user_stmt = select(User).where(User.id == user_id)
        user = (await self.db.execute(user_stmt)).scalar_one_or_none()
        is_platform_admin = user and user.is_platform_admin
        
        user_perms = set() if is_platform_admin else await self.resolve_user_permissions(user_id)

        # Filter menus by permission and feature flags
        visible_menus = []
        for m in all_menus:
            # Enforce permission checks
            if not is_platform_admin and m.permission and m.permission not in user_perms:
                continue
            
            visible_menus.append({
                "id": m.id,
                "parent_id": m.parent_id,
                "title": m.title,
                "route": m.route,
                "icon": m.icon,
                "module": m.module,
                "sequence": m.sequence,
                "feature_flag": m.feature_flag,
                "badge": m.badge,
            })

        return visible_menus

    async def log_security_change(
        self,
        executor_user_id: str,
        executor_username: str,
        action: str,
        old_value: str | None = None,
        new_value: str | None = None,
        reason: str | None = None,
        ip_address: str | None = None,
        device_info: str | None = None,
    ):
        """
        Create a secure audit trail log for configuration or permission modifications.
        """
        audit = SMRITISecurityAudit(
            user_id=executor_user_id,
            username=executor_username,
            action=action,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            ip_address=ip_address,
            device_info=device_info
        )
        self.db.add(audit)
        await self.db.commit()
