"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Company Profile & Settings Router
 * Capability    : @SmritiCapability("FOUNDATION", "COMPANY_PROFILE_STUDIO")
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    TenantContext,
    get_company_db,
    get_current_user,
    get_tenant_context,
)
from ...models.auth import User, UserRole
from ...schemas.company_profile import (
    CompanyProfileResponse,
    CompanyProfileUpdateRequest,
)
from ...services.company_profile_service import CompanyProfileService

router = APIRouter(prefix="", tags=["Company Profile & Settings"])

_ALLOWED_WRITE_ROLES = {UserRole.SYSADMIN, UserRole.MANAGER, UserRole.ADMIN}


def _enforce_company_write_permission(user: User) -> None:
    """Enforces role-based access control for mutating corporate identity."""
    user_role = user.role
    if user_role not in _ALLOWED_WRITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "SMRITI-PERM-003",
                "title": "Access Denied",
                "explanation": (
                    "Updating company profile and corporate settings requires Manager "
                    "or System Administrator privileges."
                ),
                "suggested_action": (
                    "Contact your system administrator to make modifications to corporate configuration."
                ),
            },
        )


@router.get("/profile", response_model=CompanyProfileResponse)
@router.get("", response_model=CompanyProfileResponse, include_in_schema=False)
async def get_company_profile_endpoint(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> CompanyProfileResponse:
    """
    Retrieve authoritative corporate identity, statutory tax identifiers,
    communication channels, registered branches, and bank accounts for the active tenant.
    """
    return await CompanyProfileService.get_company_profile(db=db, tenant_ctx=tenant_ctx)


@router.put("/profile", response_model=CompanyProfileResponse)
@router.put("", response_model=CompanyProfileResponse, include_in_schema=False)
async def update_company_profile_endpoint(
    payload: CompanyProfileUpdateRequest,
    request: Request,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> CompanyProfileResponse:
    """
    Update corporate profile, registered branches, and bank accounts.
    Protected by role checks (SYSADMIN / MANAGER) and produces a cryptographically
    chained immutable audit event.
    """
    _enforce_company_write_permission(current_user)

    ip_address = request.client.host if request.client else None

    return await CompanyProfileService.update_company_profile(
        db=db,
        tenant_ctx=tenant_ctx,
        payload=payload,
        current_user=current_user,
        ip_address=ip_address,
    )
