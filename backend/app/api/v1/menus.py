"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, get_tenant_context, require_role, TenantContext
from ...models.auth import User, UserRole
from ...models.menu import SmritiMenu
from ...schemas.menu import SmritiMenuCreate, SmritiMenuUpdate, SmritiMenuResponse, MenuNode

router = APIRouter()

# Restricted admin workspaces requiring elevated privileges
ADMIN_RESTRICTED_MODULES = {"system-config", "platform-studio", "dev-tracker", "audit", "audit-logs", "security"}

@router.get(
    "/resolved",
    response_model=List[SmritiMenuResponse],
)
async def get_resolved_menus(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Centralized Menu Resolver.
    Evaluates User -> TenantContext -> Role -> Capabilities -> smriti_menus table.
    Produces the authoritative navigation tree for the logged-in user.
    """
    q = select(SmritiMenu).where(
        SmritiMenu.is_active == True,
        SmritiMenu.is_deleted == False,
    ).order_by(SmritiMenu.sequence.asc())

    res = await db.execute(q)
    all_menus = res.scalars().all()

    resolved: List[SmritiMenuResponse] = []

    for m in all_menus:
        # Check tenant/company/branch isolation override if present
        if m.company_id and m.company_id != tenant.company_id and current_user.role != UserRole.SYSADMIN:
            continue
        if m.branch_id and m.branch_id != tenant.branch_id and current_user.role != UserRole.SYSADMIN:
            continue

        # Check role / capability restrictions
        route_id = (m.route or "").lstrip("/")
        if route_id in ADMIN_RESTRICTED_MODULES:
            if current_user.role not in (UserRole.SYSADMIN, UserRole.MANAGER):
                continue

        resolved.append(SmritiMenuResponse.model_validate(m))

    return resolved


@router.get(
    "/",
    response_model=List[SmritiMenuResponse],
)
async def list_all_menus(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all registered Control Plane menus for admin governance.
    """
    q = select(SmritiMenu).where(SmritiMenu.is_deleted == False).order_by(SmritiMenu.sequence.asc())
    res = await db.execute(q)
    return [SmritiMenuResponse.model_validate(m) for m in res.scalars().all()]


@router.put(
    "/{menu_id}",
    response_model=SmritiMenuResponse,
)
async def update_menu_item(
    menu_id: str,
    req: SmritiMenuUpdate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Admin Menu Management.
    Enforces 'system.menu.manage' capability (guarded by SYSADMIN/MANAGER role dependency).
    Modifies menu label, icon, sequence, parent_id, or is_active state.
    Audits changes into smriti_audit_log.
    """
    q = select(SmritiMenu).where(SmritiMenu.id == menu_id, SmritiMenu.is_deleted == False)
    res = await db.execute(q)
    item = res.scalars().first()

    if not item:
        raise HTTPException(status_code=404, detail=f"Menu item '{menu_id}' not found")

    old_data = {
        "title": item.title,
        "icon": item.icon,
        "sequence": item.sequence,
        "is_active": item.is_active,
    }

    if req.title is not None:
        item.title = req.title
    if req.icon is not None:
        item.icon = req.icon
    if req.sequence is not None:
        item.sequence = req.sequence
    if req.parent_id is not None:
        item.parent_id = req.parent_id
    if req.is_active is not None:
        item.is_active = req.is_active
    if req.module is not None:
        item.module = req.module

    new_data = {
        "title": item.title,
        "icon": item.icon,
        "sequence": item.sequence,
        "is_active": item.is_active,
    }

    # Record audit log entry in smriti_audit_log via raw SQL to ensure exact table compliance
    from sqlalchemy import text
    import hashlib
    audit_id = f"aud-{uuid.uuid4().hex[:12]}"
    hash_val = hashlib.sha256(f"{audit_id}:{menu_id}:{new_data}".encode()).hexdigest()
    await db.execute(
        text("""
            INSERT INTO smriti_audit_log (
                id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                old_value, new_value, change_type, change_reason, change_source,
                changed_by, changed_by_name, changed_at, sha256_hash
            )
            VALUES (
                :id, :tenant_id, :entity_id, 'smriti_menus', :record_id, 'menu_config',
                :old_val, :new_val, 'UPDATE', 'Admin Menu Configuration Update', 'Admin Menu Studio',
                :changed_by, :changed_by_name, :changed_at, :sha256_hash
            )
        """),
        {
            "id": audit_id,
            "tenant_id": tenant.company_id,
            "entity_id": menu_id,
            "record_id": menu_id,
            "old_val": str(old_data),
            "new_val": str(new_data),
            "changed_by": current_user.id,
            "changed_by_name": current_user.full_name or current_user.username,
            "changed_at": datetime.now(timezone.utc),
            "sha256_hash": hash_val,
        }
    )

    await db.commit()
    await db.refresh(item)
    return SmritiMenuResponse.model_validate(item)


@router.get("/audit")
async def get_menu_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER)),
):
    """
    Get audit history of menu administration changes from smriti_audit_log.
    """
    from sqlalchemy import text
    res = await db.execute(
        text("""
            SELECT id, entity_id, changed_record_id, old_value, new_value, change_type, changed_by, changed_by_name, changed_at
            FROM smriti_audit_log
            WHERE changed_table = 'smriti_menus'
            ORDER BY changed_at DESC
            LIMIT 50;
        """)
    )
    rows = res.fetchall()
    return [
        {
            "id": r[0],
            "entity_id": r[1],
            "changed_record_id": r[2],
            "old_value": r[3],
            "new_value": r[4],
            "change_type": r[5],
            "changed_by": r[6],
            "changed_by_name": r[7],
            "changed_at": r[8].isoformat() if r[8] else None,
        }
        for r in rows
    ]
