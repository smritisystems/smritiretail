"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.role import Role
from ...schemas.role import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter()


@router.get(
    "/",
    response_model=List[RoleResponse],
)
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active access roles with matching mapped permissions arrays.
    """
    q = select(Role).where(Role.is_deleted == False)
    res = await db.execute(q)
    roles = res.scalars().all()
    
    serialized = []
    for r in roles:
        serialized.append(RoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=json.loads(r.permissions_json) if r.permissions_json else [],
            isSystem=r.is_system or False
        ))
    return serialized


@router.post(
    "/",
    response_model=RoleResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def create_role(
    req: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a new custom user access role mapping.
    """
    # Check if role exists
    q = select(Role).where(Role.name.ilike(req.name), Role.is_deleted == False)
    res = await db.execute(q)
    existing = res.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Access role '{req.name}' already registered.")

    new_id = f"rol-{int(datetime.now(timezone.utc).timestamp())}"
    role = Role(
        id=new_id,
        name=req.name,
        description=req.description,
        permissions_json=json.dumps(req.permissions),
        is_system=req.isSystem or False,
        created_by=current_user.username,
        updated_by=current_user.username
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=req.permissions,
        isSystem=role.is_system or False
    )


@router.put(
    "/{id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def update_role(
    id: str,
    req: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update access permission mappings for a custom role.
    """
    role = await db.get(Role, id)
    if not role or role.is_deleted:
        raise HTTPException(status_code=404, detail="Access role definition not found.")

    if role.is_system:
        raise HTTPException(status_code=400, detail="System configuration roles permissions cannot be altered.")

    if req.description is not None: role.description = req.description
    if req.permissions is not None: role.permissions_json = json.dumps(req.permissions)
    role.updated_by = current_user.username
    role.modified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=json.loads(role.permissions_json) if role.permissions_json else [],
        isSystem=role.is_system or False
    )


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(UserRole.SYSADMIN))],
)
async def delete_role(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retire / Delete a custom access role definition.
    """
    role = await db.get(Role, id)
    if not role or role.is_deleted:
        raise HTTPException(status_code=404, detail="Access role definition not found.")

    if role.is_system:
        raise HTTPException(status_code=400, detail="System configuration roles cannot be deleted.")

    role.is_deleted = True
    role.is_active = False
    role.deleted_at = datetime.now(timezone.utc)
    role.deleted_by = current_user.username
    await db.commit()
    return {"success": True}
