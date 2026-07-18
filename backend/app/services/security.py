"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List, Set, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from ..models.security import (
    SMRITIRole,
    SMRITIPermission,
    SMRITIPolicy,
    SMRITIRolePolicy,
    SMRITIPolicyPermission,
    SMRITIUserRole,
    SMRITIMenu,
    SMRITISecurityAudit,
    PermissionType
)
from ..models.auth import User

# In-memory permissions cache: user_id -> set of allowed permission codes
_permissions_cache: Dict[str, Set[str]] = {}


def invalidate_user_permission_cache(user_id: str):
    """
    Clear resolved permissions cache for a specific user.
    """
    if user_id in _permissions_cache:
        del _permissions_cache[user_id]


def clear_all_permissions_cache():
    """
    Clear all cached permissions globally.
    """
    _permissions_cache.clear()


class SecurityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_effective_roles(self, user_id: str) -> List[SMRITIRole]:
        """
        Traverse the user's role inheritance hierarchy and resolve all effective roles.
        """
        # 1. Fetch direct user roles mapping
        user_role_stmt = select(SMRITIUserRole).where(SMRITIUserRole.user_id == user_id)
        user_roles_res = await self.db.execute(user_role_stmt)
        direct_mappings = user_roles_res.scalars().all()
        
        if not direct_mappings:
            return []

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

    async def resolve_user_permissions(self, user_id: str, bypass_cache: bool = False) -> Set[str]:
        """
        Compile the dynamic list of allowed permission codes for a user.
        Precedence: Explicit Deny -> Explicit Allow -> Inherited Allow -> Default Deny
        """
        if not bypass_cache and user_id in _permissions_cache:
            return _permissions_cache[user_id]

        effective_roles = await self.get_effective_roles(user_id)
        if not effective_roles:
            return set()

        role_ids = [r.id for r in effective_roles]

        # Fetch policies mapped to effective roles
        role_policy_stmt = select(SMRITIRolePolicy).where(SMRITIRolePolicy.role_id.in_(role_ids))
        role_policy_res = await self.db.execute(role_policy_stmt)
        role_policies = role_policy_res.scalars().all()
        
        if not role_policies:
            return set()

        policy_ids = [rp.policy_id for rp in role_policies]

        # Fetch policy permission mappings
        policy_perm_stmt = select(SMRITIPolicyPermission).where(
            SMRITIPolicyPermission.policy_id.in_(policy_ids)
        ).options(selectinload(SMRITIPolicyPermission.permission))
        policy_perm_res = await self.db.execute(policy_perm_stmt)
        policy_permissions = policy_perm_res.scalars().all()

        # Apply Tri-State Logic: Deny wins over Allow
        allowed_permissions = set()
        denied_permissions = set()

        for pp in policy_permissions:
            perm_code = pp.permission.code
            if pp.permission_type == PermissionType.DENY:
                denied_permissions.add(perm_code)
            elif pp.permission_type == PermissionType.ALLOW:
                allowed_permissions.add(perm_code)

        # Resolve final permission codes
        resolved = allowed_permissions - denied_permissions
        _permissions_cache[user_id] = resolved
        return resolved

    async def verify_user_permission(self, user_id: str, permission_code: str) -> bool:
        """
        Determine if the user has a specific permission allowed.
        """
        # Let SYSADMIN bypass security checks
        user_stmt = select(User).where(User.id == user_id)
        user_res = await self.db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        if user and user.role.value == "SYSADMIN":
            return True

        permissions = await self.resolve_user_permissions(user_id)
        return permission_code in permissions

    async def get_visible_menus(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Resolve the hierarchy of dynamic menus the user is authorized to view.
        """
        # Fetch all active menus
        menu_stmt = select(SMRITIMenu).where(SMRITIMenu.is_active == True).order_by(
            SMRITIMenu.sequence.asc()
        )
        menu_res = await self.db.execute(menu_stmt)
        all_menus = menu_res.scalars().all()

        # Resolve user permissions
        user_stmt = select(User).where(User.id == user_id)
        user = (await self.db.execute(user_stmt)).scalar_one_or_none()
        is_sysadmin = user and user.role.value == "SYSADMIN"
        
        user_perms = set() if is_sysadmin else await self.resolve_user_permissions(user_id)

        # Filter menus by permission and feature flags
        visible_menus = []
        for m in all_menus:
            # Enforce permission checks
            if not is_sysadmin and m.permission and m.permission not in user_perms:
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
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        device_info: Optional[str] = None,
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
