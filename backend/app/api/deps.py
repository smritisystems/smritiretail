"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.25.0
* Created    : 2026-07-11
* Modified   : 2026-08-20
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import json
from dataclasses import dataclass
from typing import Callable, Tuple, AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm.attributes import set_committed_value
from ..core.config import settings

from ..db.session import (
    get_db as _get_db,
    get_company_async_engine,
    get_company_sessionmaker,
    resolve_company_database_name,
    get_session_by_db_name,
)
from ..models.auth import User, UserRole
from ..models.role import Role
from ..models.security import SmritiPermission
from ..models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from ..core.security import decode_token

get_db = _get_db  # re-exported for router convenience

# OAuth2 Bearer scheme — token URL points at the login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class TenantContext:
    company_id: str
    branch_id: str


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------
async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(_get_db),
) -> User:
    """
    Decode the Bearer JWT and return the authenticated User object.

    Raises 401 if:
    - Token is missing, expired, or tampered.
    - User referenced by the token is inactive or deleted.
    """
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail="A valid access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Token is missing user identity. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lazy-import to avoid circular imports (AuthService ↔ deps)
    from ..services.auth import AuthService
    service = AuthService(db)
    user = await service.get_user_by_id(user_id)

    # Set token-specified company/branch context without dirtying ORM session
    token_comp = payload.get("company_id")
    token_branch = payload.get("branch_id")
    if token_comp and user.company_id != token_comp:
        set_committed_value(user, "company_id", token_comp)
    if token_branch and user.branch_id != token_branch:
        set_committed_value(user, "branch_id", token_branch)

    if user.status == "PendingPasswordChange":
        allowed_paths = {
            "/api/v1/auth/me",
            "/api/v1/users/me/password",
            "/api/v1/auth/logout",
            "/api/v1/auth/refresh",
        }
        if request.url.path not in allowed_paths:
            raise HTTPException(
                status_code=403,
                detail="Password change is required before accessing the application.",
            )

    return user


# ---------------------------------------------------------------------------
# get_tenant_context — sourced from user context with assignment validation
# ---------------------------------------------------------------------------


def normalize_company_id(cid: Optional[str]) -> Optional[str]:
    if not cid:
        return None
    raw = str(cid).strip()
    c = raw.upper()
    if len(c) == 3 and c.isalnum() and c not in ("000", "SYS"):
        return f"COMP-{c}"
    if c.startswith("COMP-") and len(c) == 8 and c[5:].isalnum():
        return c
    return raw


async def get_tenant_context(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantContext:
    """
    Extract tenant context from the authenticated user's JWT claims & validate assignments.
    Enforces header tampering checks against X-Company-Code and X-Branch-Code headers.
    Normalizes company codes (e.g. '001' and 'COMP-001') before validation.
    """
    header_company_id = request.headers.get("x-company-id") or request.headers.get("X-Company-ID")
    header_company = header_company_id or request.headers.get("x-company-code") or request.headers.get("X-Company-Code")
    header_branch = (
        request.headers.get("x-branch-code")
        or request.headers.get("X-Branch-Code")
        or request.headers.get("x-branch-id")
        or request.headers.get("X-Branch-ID")
    )

    raw_target = header_company if header_company else current_user.company_id
    target_company = normalize_company_id(raw_target)
    if not target_company:
        raise HTTPException(
            status_code=400,
            detail="Tenant company context is required.",
        )
    
    target_branch = header_branch if header_branch else current_user.branch_id
    if not target_branch or not str(target_branch).strip():
        target_branch = "BR-001"

    if current_user.role != UserRole.SYSADMIN:
        # Header Tampering Security Check with normalized company IDs
        norm_user_company = normalize_company_id(current_user.company_id)
        if header_company and normalize_company_id(header_company) != norm_user_company:
            raise HTTPException(
                status_code=403,
                detail=f"Header Tampering Forbidden: Access to company '{header_company}' is denied.",
            )

        # If user has company assignment records, enforce matching active assignment
        any_comp_res = await db.execute(
            select(UserCompanyAssignment).where(
                UserCompanyAssignment.user_id == current_user.id,
            )
        )
        if any_comp_res.scalars().first() is not None:
            comp_res = await db.execute(
                select(UserCompanyAssignment).where(
                    UserCompanyAssignment.user_id == current_user.id,
                    UserCompanyAssignment.company_id == target_company,
                    UserCompanyAssignment.is_deleted == False,
                    UserCompanyAssignment.is_active == True,
                )
            )
            if not comp_res.scalars().first():
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are not assigned to this company.",
                )

        # If user has branch assignment records, enforce matching active assignment
        any_br_res = await db.execute(
            select(UserBranchAssignment).where(
                UserBranchAssignment.user_id == current_user.id,
            )
        )
        if any_br_res.scalars().first() is not None:
            br_res = await db.execute(
                select(UserBranchAssignment).where(
                    UserBranchAssignment.user_id == current_user.id,
                    UserBranchAssignment.branch_id == target_branch,
                    UserBranchAssignment.is_deleted == False,
                    UserBranchAssignment.is_active == True,
                )
            )
            if not br_res.scalars().first():
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are not assigned to this branch.",
                )

    return TenantContext(
        company_id=target_company,
        branch_id=target_branch,
    )


# ---------------------------------------------------------------------------
# get_company_db — Multi-Tenant Company Database Session Dependency
# ---------------------------------------------------------------------------
async def get_company_db(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> AsyncGenerator[AsyncSession, None]:
    """
    Authoritative SMRITI Multi-Tenant Company Database Dependency.
    Extracts tenant target strictly from validated TenantContext (cryptographic JWT + assignment check).
    Never trusts raw unvalidated client headers or query parameters.
    """
    target_db_name = await resolve_company_database_name(tenant_ctx.company_id)
    session_factory = get_company_sessionmaker(target_db_name)
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# require_role — RBAC guard factory
# ---------------------------------------------------------------------------
def require_role(*allowed_roles: UserRole) -> Callable:
    """
    Returns a FastAPI dependency that raises 403 if the current user's role
    is not in the allowed set. Checked against role_id permissions table if set,
    falling back to enum role check.
    """
    async def _guard(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(_get_db),
    ) -> User:
        if current_user.role_id:
            res = await db.execute(select(Role).where(Role.id == current_user.role_id, Role.is_deleted == False))
            role_obj = res.scalars().first()
            if role_obj:
                perms = []
                if role_obj.permissions_json:
                    try:
                        perms = json.loads(role_obj.permissions_json)
                    except Exception:
                        perms = []
                if "*" in perms:
                    return current_user
                allowed_role_names = {r.value.upper() for r in allowed_roles}
                role_name_normalized = role_obj.name.upper().replace(" ", "_")
                if role_obj.name.upper() in allowed_role_names or role_name_normalized in allowed_role_names:
                    return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Your role ({current_user.role.value}) does not have permission to perform this action. "
                    f"Required: {', '.join(r.value for r in allowed_roles)}."
                ),
            )
        return current_user
    return _guard


# ---------------------------------------------------------------------------
# verify_internal_service_key — internal API guard
# ---------------------------------------------------------------------------
async def verify_internal_service_key(
    x_internal_service_key: str = Header(None, alias="X-Internal-Service-Key")
) -> None:
    """
    FastAPI dependency to authorize internal service requests using a shared secret key.
    """
    if not x_internal_service_key or x_internal_service_key != settings.INTERNAL_SERVICE_KEY:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Invalid or missing internal service authorization."
        )


# ---------------------------------------------------------------------------
# require_permission — Granular Action-Level Security Guard Factory
# ---------------------------------------------------------------------------
def require_permission(resource: str, action: str) -> Callable:
    """
    FastAPI dependency factory enforcing granular action-level permissions.
    Evaluates:
    1. SYSADMIN role wildcard access ('*').
    2. User-specific explicit grant or denial in 'smriti_permissions' (tenant scoped).
    3. Assigned Role permissions in 'roles.permissions_json'.
    4. Scoped standard role defaults (MANAGER allowlist, CASHIER scoped allowlist).
    Raises 403 Forbidden with business error SMRITI-AUTH-001 if unauthorized.
    """
    async def _perm_guard(
        current_user: User = Depends(get_current_user),
        tenant: TenantContext = Depends(get_tenant_context),
        db: AsyncSession = Depends(_get_db),
    ) -> User:
        from ..core.security_matrix import evaluate_action_permission

        allowed = await evaluate_action_permission(
            db=db,
            current_user=current_user,
            tenant=tenant,
            resource=resource,
            action=action
        )
        if allowed:
            return current_user

        raise HTTPException(
            status_code=403,
            detail=f"SMRITI-AUTH-001: Permission denied for operation '{action}' on '{resource}'. Required privilege missing."
        )

    return _perm_guard


