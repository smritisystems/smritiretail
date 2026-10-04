"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.2
Created      : 2026-07-12
Modified     : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Changes v3.16.2 (2026-10-04 - Phase 1E):
  - list_roles (R-4): Applies tenant-safe scoping.
      SYSADMIN: sees all active roles.
      Non-SYSADMIN: sees active global system roles
        (is_system=TRUE) UNION active custom roles
        belonging to current_user.company_id.
      Prevents cross-tenant custom-role information leak.
  - update_role (R-5): Relaxes guard from SYSADMIN-only to
      SYSADMIN|MANAGER. For non-SYSADMIN callers, enforces
      company_id ownership - role.company_id MUST equal
      current_user.company_id. Returns 404 on mismatch to
      avoid leaking whether another company role exists.
  - delete_role (R-5): Same guard and ownership policy as update_role.
  - RoleResponse: companyId field added for architectural visibility.

Changes v3.16.1 (2026-10-04 - Phase 1E pre-condition):
  - create_role: assigns company_id from requesting user.
  - create_role: duplicate check is tenant-scoped.
  - System roles guard preserved.
"""

import json
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.role import Role
from ...schemas.role import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter()


def _is_sysadmin(user: User) -> bool:
    """
    Returns True if the user holds the SYSADMIN enum role.
    SYSADMIN users have global scope -- no company_id check is applied.
    """
    return user.role == UserRole.SYSADMIN


@router.get(
    "/",
    response_model=List[RoleResponse],
)
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List active roles visible to the calling user.

    SYSADMIN: Returns ALL active roles (system + all custom across tenants).

    Non-SYSADMIN: Returns active roles where:
        is_system = TRUE  (global standard templates)
        OR company_id = current_user.company_id  (own custom roles)

    Cross-tenant custom roles are NEVER returned to non-SYSADMIN callers.
    """
    if _is_sysadmin(current_user):
        q = select(Role).where(Role.is_deleted == False)
    else:
        company_id = getattr(current_user, "company_id", None)
        q = select(Role).where(
            Role.is_deleted == False,
            or_(
                Role.is_system == True,
                Role.company_id == company_id,
            ),
        )

    res = await db.execute(q)
    roles = res.scalars().all()

    return [
        RoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=json.loads(r.permissions_json) if r.permissions_json else [],
            isSystem=r.is_system or False,
            companyId=r.company_id,
        )
        for r in roles
    ]


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
    Register a new custom user access role scoped to the requesting user company.

    System roles (is_system=True) cannot be created via this API -- they are
    global templates managed exclusively by the seeding process.
    """
    if req.isSystem:
        raise HTTPException(
            status_code=400,
            detail="System roles are global templates and cannot be created via this endpoint."
        )

    company_id: Optional[str] = getattr(current_user, "company_id", None)

    q = select(Role).where(
        Role.name.ilike(req.name),
        Role.company_id == company_id,
        Role.is_deleted == False,
        Role.is_system == False,
    )
    res = await db.execute(q)
    if res.scalars().first():
        raise HTTPException(
            status_code=400,
            detail=f"A custom access role named '{req.name}' already exists for your organisation."
        )

    import uuid as _uuid
    new_id = f"rol-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{_uuid.uuid4().hex[:6]}"
    role = Role(
        id=new_id,
        name=req.name,
        description=req.description,
        permissions_json=json.dumps(req.permissions),
        is_system=False,
        company_id=company_id,
        created_by=current_user.username,
        updated_by=current_user.username,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=req.permissions,
        isSystem=False,
        companyId=role.company_id,
    )


@router.put(
    "/{id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER))],
)
async def update_role(
    id: str,
    req: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update access permission mappings for a custom role.

    R-5 Ownership Rules:
      - System roles (is_system=True): ALWAYS rejected.
      - Custom roles:
          SYSADMIN: unrestricted (global scope, no company check).
          Non-SYSADMIN: role.company_id MUST equal current_user.company_id.
          Mismatch -> 404 (prevents info leak about another company role).
    """
    role = await db.get(Role, id)

    if not role or role.is_deleted:
        raise HTTPException(status_code=404, detail="Access role definition not found.")

    if role.is_system:
        raise HTTPException(
            status_code=400,
            detail="System configuration roles are global templates and cannot be altered."
        )

    if not _is_sysadmin(current_user):
        user_company = getattr(current_user, "company_id", None)
        if role.company_id != user_company:
            raise HTTPException(status_code=404, detail="Access role definition not found.")

    if req.description is not None:
        role.description = req.description
    if req.permissions is not None:
        role.permissions_json = json.dumps(req.permissions)
    role.updated_by = current_user.username
    role.modified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=json.loads(role.permissions_json) if role.permissions_json else [],
        isSystem=role.is_system or False,
        companyId=role.company_id,
    )


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER))],
)
async def delete_role(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retire / soft-delete a custom access role definition.

    R-5 Ownership Rules:
      - System roles: ALWAYS rejected.
      - Custom roles:
          SYSADMIN: unrestricted.
          Non-SYSADMIN: role.company_id MUST equal current_user.company_id.
          Mismatch -> 404 (prevents info leak).
    """
    role = await db.get(Role, id)

    if not role or role.is_deleted:
        raise HTTPException(status_code=404, detail="Access role definition not found.")

    if role.is_system:
        raise HTTPException(
            status_code=400,
            detail="System configuration roles cannot be deleted."
        )

    if not _is_sysadmin(current_user):
        user_company = getattr(current_user, "company_id", None)
        if role.company_id != user_company:
            raise HTTPException(status_code=404, detail="Access role definition not found.")

    role.is_deleted = True
    role.is_active = False
    role.deleted_at = datetime.now(timezone.utc)
    role.deleted_by = current_user.username
    await db.commit()
    return {"success": True}
