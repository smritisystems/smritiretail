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

 * Version    : 3.31.0
 * Created    : 2026-07-11
 * Modified   : 2026-07-19
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
"""

from dataclasses import dataclass
from typing import Callable, Tuple
from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.config import settings

from ..db.session import get_db as _get_db, active_tenant_ctx, active_security_context, SecurityContext
from ..models.auth import User, UserRole
from ..core.security import decode_token
from ..services.security import SecurityService

get_db = _get_db  # re-exported for router convenience

# OAuth2 Bearer scheme — token URL points at the login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class TenantContext:
    company_id: str
    branch_id: str
    tenant_id: str = "default"





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
# get_tenant_context — now sourced from the JWT, not raw headers
# ---------------------------------------------------------------------------
async def get_tenant_context(
    current_user: User = Depends(get_current_user),
) -> TenantContext:
    """
    Extract tenant context from the authenticated user's JWT claims.

    Replaces the old X-Company-Id / X-Branch-Id header trust model.
    SYSADMIN users (no company/branch) cannot call tenant-scoped endpoints.
    """
    if not current_user.company_id or not current_user.branch_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your account is not assigned to a company and branch. "
                "A SYSADMIN must assign you to a branch before you can access business data."
            ),
        )
    # Default to "default" if user has no tenant_id assigned yet
    tenant_id = getattr(current_user, "tenant_id", None) or "default"
    ctx = TenantContext(
        tenant_id=tenant_id,
        company_id=current_user.company_id,
        branch_id=current_user.branch_id,
    )
    active_tenant_ctx.set(ctx)
    return ctx



# ---------------------------------------------------------------------------
# require_role — RBAC guard factory
# ---------------------------------------------------------------------------
def require_role(*allowed_roles: UserRole) -> Callable:
    """
    Returns a FastAPI dependency that raises 403 if the current user's role
    is not in the allowed set.

    Usage:
        @router.post("/products/")
        async def create(current_user = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))):
            ...
    """
    async def _guard(current_user: User = Depends(get_current_user)) -> User:
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
# require_permission — dynamic permission guard
# ---------------------------------------------------------------------------
def require_permission(permission_code: str) -> Callable:
    """
    Returns a FastAPI dependency that verifies whether the current user has the 
    specified permission code allowed. Explicit deny overrides inherit/allow.
    """
    async def _guard(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        service = SecurityService(db)
        is_allowed = await service.verify_user_permission(current_user.id, permission_code)
        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail={
                    "title": "Access Denied",
                    "explanation": f"Your account does not have the required permission ({permission_code}) to perform this action.",
                    "suggested_action": "Please contact your system administrator to assign the appropriate policy.",
                    "reference_id": "SMRITI-PERM-001"
                }
            )

        # Resolve scope for the permission
        from sqlalchemy import select
        from ..models.security import SMRITIPermission
        from ..core.permissions import MANIFEST

        perm_def = next((p for p in MANIFEST if p.code == permission_code), None)
        
        # Try loading scope from database for dynamic overrides, fallback to manifest
        stmt = select(SMRITIPermission.scope).where(SMRITIPermission.code == permission_code)
        res = await db.execute(stmt)
        db_scope = res.scalar_one_or_none()
        print(f"DEBUG PERMISSION SCOPE: permission_code={permission_code}, db_scope={db_scope}", flush=True)
        perm_scope = db_scope if db_scope else (perm_def.scope if perm_def else "OWN_BRANCH")

        # Map to RLS ResolvedScope (SELF, TEAM, BRANCH, COMPANY, ALL)
        mapping = {
            "GLOBAL": "ALL",
            "OWN_BRANCH": "BRANCH",
            "OWN_COMPANY": "COMPANY",
            "SELF": "SELF",
            "TEAM": "TEAM"
        }
        resolved_scope = mapping.get(perm_scope, "BRANCH")

        # Build request-scoped SecurityContext
        company_ids = [current_user.company_id] if current_user.company_id else []
        branch_ids = [current_user.branch_id] if current_user.branch_id else []
        
        ctx = SecurityContext(
            user_id=current_user.id,
            username=current_user.username,
            platform_admin=current_user.is_platform_admin,
            tenant_id=current_user.tenant_id or "default",
            company_ids=company_ids,
            branch_ids=branch_ids,
            department_ids=[],
            warehouse_ids=[],
            cost_center_ids=[],
            record_scope=resolved_scope,
            license={},
            feature_flags={},
            session="",
            api_key=""
        )
        active_security_context.set(ctx)

        # Sync active_tenant_ctx for backwards compatibility
        t_ctx = TenantContext(
            tenant_id=ctx.tenant_id,
            company_id=current_user.company_id,
            branch_id=current_user.branch_id
        )
        active_tenant_ctx.set(t_ctx)

        return current_user
    return _guard

