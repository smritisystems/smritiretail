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

* Version    : 3.16.0
* Created    : 2026-07-11
* Modified   : 2026-07-12
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from dataclasses import dataclass
from typing import Callable, Tuple
from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.config import settings

from ..db.session import get_db as _get_db
from ..models.auth import User, UserRole
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
    return TenantContext(
        company_id=current_user.company_id,
        branch_id=current_user.branch_id,
    )


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
