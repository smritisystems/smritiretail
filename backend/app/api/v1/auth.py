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

* Version    : 3.22.0
* Created    : 2026-07-11
* Modified   : 2026-08-13
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user
from ...services.auth import AuthService
from ...schemas.auth import (
    LoginRequest, TokenResponse, AccessTokenResponse,
    RefreshRequest, BootstrapRequest, UserResponse, TenantContextSwitchRequest,
)
from ...schemas.masters_tier2 import CompanyResponse, BranchResponse
from ...models.auth import User, UserRole
from ...models.tenant import Company, Branch
from ...models.company_registry import CompanyDatabaseRegistry
from ...models.user_assignment import UserCompanyAssignment, UserBranchAssignment

router = APIRouter()


@router.post("/bootstrap", response_model=UserResponse, status_code=201)
async def bootstrap_admin(
    req: BootstrapRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    First-run endpoint. Creates the global SYSADMIN account.

    Only works when zero users exist. Returns 403 on all subsequent calls.
    No authentication required (cannot authenticate before the first user exists).
    """
    service = AuthService(db)
    user = await service.bootstrap_admin(req)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate with username + password.

    Returns an access token (60-min) and a refresh token (7-day).
    """
    service = AuthService(db)
    return await service.login(req)


@router.get("/tenants")
async def list_tenant_options(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticated endpoint for tenant selection after login.
    Returns companies and branches that the current user may access,
    strictly filtered to companies having an active, READY database registry.
    """
    if current_user.role == UserRole.SYSADMIN:
        # SYSADMIN has access to all registered ready companies
        q_companies = (
            select(Company)
            .join(CompanyDatabaseRegistry, Company.id == CompanyDatabaseRegistry.company_id)
            .where(
                CompanyDatabaseRegistry.status == "READY",
                Company.is_active.is_(True),
                Company.is_deleted.is_(False),
            )
            .order_by(Company.name.asc())
        )
        companies = (await db.execute(q_companies)).scalars().all()
        ready_comp_ids = [c.id for c in companies]

        if ready_comp_ids:
            q_branches = (
                select(Branch)
                .where(
                    Branch.company_id.in_(ready_comp_ids),
                    Branch.is_active.is_(True),
                    Branch.is_deleted.is_(False),
                )
                .order_by(Branch.name.asc())
            )
            branches = (await db.execute(q_branches)).scalars().all()
        else:
            branches = []

    else:
        # Non-SYSADMIN: Check user_company_assignments first, fallback to user.company_id
        assigned_comp_res = await db.execute(
            select(UserCompanyAssignment.company_id).where(
                UserCompanyAssignment.user_id == current_user.id,
                UserCompanyAssignment.is_active.is_(True),
                UserCompanyAssignment.is_deleted.is_(False),
            )
        )
        assigned_comp_ids = list(assigned_comp_res.scalars().all())

        if not assigned_comp_ids and current_user.company_id:
            assigned_comp_ids = [current_user.company_id]

        if not assigned_comp_ids:
            return {"companies": [], "branches": []}

        # Filter assigned companies to only those with a READY database registry
        q_companies = (
            select(Company)
            .join(CompanyDatabaseRegistry, Company.id == CompanyDatabaseRegistry.company_id)
            .where(
                Company.id.in_(assigned_comp_ids),
                CompanyDatabaseRegistry.status == "READY",
                Company.is_active.is_(True),
                Company.is_deleted.is_(False),
            )
            .order_by(Company.name.asc())
        )
        companies = (await db.execute(q_companies)).scalars().all()
        ready_comp_ids = [c.id for c in companies]

        if not ready_comp_ids:
            return {"companies": [], "branches": []}

        # Check assigned branches
        assigned_br_res = await db.execute(
            select(UserBranchAssignment.branch_id).where(
                UserBranchAssignment.user_id == current_user.id,
                UserBranchAssignment.company_id.in_(ready_comp_ids),
                UserBranchAssignment.is_active.is_(True),
                UserBranchAssignment.is_deleted.is_(False),
            )
        )
        assigned_br_ids = list(assigned_br_res.scalars().all())

        if assigned_br_ids:
            q_branches = (
                select(Branch)
                .where(
                    Branch.id.in_(assigned_br_ids),
                    Branch.company_id.in_(ready_comp_ids),
                    Branch.is_active.is_(True),
                    Branch.is_deleted.is_(False),
                )
                .order_by(Branch.name.asc())
            )
        elif current_user.branch_id:
            q_branches = (
                select(Branch)
                .where(
                    Branch.id == current_user.branch_id,
                    Branch.company_id.in_(ready_comp_ids),
                    Branch.is_active.is_(True),
                    Branch.is_deleted.is_(False),
                )
                .order_by(Branch.name.asc())
            )
        else:
            q_branches = (
                select(Branch)
                .where(
                    Branch.company_id.in_(ready_comp_ids),
                    Branch.is_active.is_(True),
                    Branch.is_deleted.is_(False),
                )
                .order_by(Branch.name.asc())
            )
        branches = (await db.execute(q_branches)).scalars().all()

    return {
        "companies": [CompanyResponse.from_orm_model(c) for c in companies],
        "branches": [BranchResponse.from_orm_model(b) for b in branches],
    }



@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(
    req: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access token.

    Returns 401 if the refresh token is expired, tampered, or has been logged out.
    """
    service = AuthService(db)
    return await service.refresh(req.refresh_token)


@router.post("/logout", status_code=200)
async def logout(
    req: RefreshRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidate the supplied refresh token.

    The access token will still work until it expires (max 60 min).
    Future refresh attempts with the blacklisted token will return 401.
    """
    service = AuthService(db)
    await service.logout(req.refresh_token, current_user.id)
    return {"message": "You have been logged out successfully."}


@router.post("/switch-context", response_model=TokenResponse)
async def switch_context(
    req: TenantContextSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dynamically switch active company/branch context for multi-company users.

    Validates that the user has active assignments to the target company and branch,
    and returns updated JWT tokens scoped to the new tenant context.
    """
    service = AuthService(db)
    return await service.switch_context(current_user, req)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Return the current authenticated user's profile.
    """
    return current_user

