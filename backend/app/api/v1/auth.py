"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_current_user, get_current_user_optional
from ...services.auth import AuthService
from ...schemas.auth import (
    LoginRequest, TokenResponse, AccessTokenResponse,
    RefreshRequest, BootstrapRequest, UserResponse,
    ResumeSessionRequest,
)
from ...schemas.masters_tier2 import CompanyResponse, BranchResponse
from ...models.auth import User, UserRole
from ...models.tenant import Company, Branch
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
    Returns companies and branches that the current user is explicitly assigned to
    via UserCompanyAssignment. SYSADMIN users see all companies.
    """
    if current_user.role == UserRole.SYSADMIN:
        q_companies = select(Company).where(Company.is_deleted.is_(False)).order_by(Company.name.asc())
        q_branches = select(Branch).where(Branch.is_deleted.is_(False)).order_by(Branch.name.asc())
        companies = (await db.execute(q_companies)).scalars().all()
        branches = (await db.execute(q_branches)).scalars().all()
    else:
        # Use UserCompanyAssignment — return only explicitly assigned companies
        ca_res = await db.execute(
            select(UserCompanyAssignment).where(
                UserCompanyAssignment.user_id == current_user.id,
                UserCompanyAssignment.is_deleted == False,
            )
        )
        assigned_company_ids = [a.company_id for a in ca_res.scalars().all()]
        if not assigned_company_ids:
            return {"companies": [], "branches": []}

        q_companies = select(Company).where(
            Company.id.in_(assigned_company_ids),
            Company.is_deleted.is_(False),
        ).order_by(Company.name.asc())
        companies = (await db.execute(q_companies)).scalars().all()

        # Branches: all branches belonging to any of the user's assigned companies
        q_branches = select(Branch).where(
            Branch.company_id.in_(assigned_company_ids),
            Branch.is_deleted.is_(False),
        ).order_by(Branch.name.asc())
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


@router.post("/session/resume", response_model=TokenResponse)
async def resume_session(
    req: ResumeSessionRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Re-authenticate and resume a locked or expired session.
    Identity is established strictly from server-side context (current_user).
    Enforces server-side rate limiting and password verification.
    """
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Session has expired. Complete re-authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    service = AuthService(db)
    return await service.resume_session(current_user, req.password)


@router.get("/my-companies")
async def get_my_companies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    SCS-WSC-002: Returns only the companies explicitly assigned to the authenticated user.
    SYSADMIN users receive all active companies.
    Used by the frontend CompanySwitcherBadge to populate the company dropdown.
    Never returns companies the user is not assigned to.
    """
    if current_user.role == UserRole.SYSADMIN:
        comp_res = await db.execute(
            select(Company)
            .where(Company.is_deleted == False)
            .order_by(Company.name.asc())
        )
        companies = comp_res.scalars().all()
        return {
            "companies": [
                {
                    "id": c.id,
                    "name": c.name,
                    "is_default": False,
                    "is_active": not c.is_deleted,
                }
                for c in companies
            ],
            "active_company_id": current_user.company_id,
        }

    # Non-SYSADMIN: return only explicitly assigned companies
    ca_res = await db.execute(
        select(UserCompanyAssignment, Company)
        .join(Company, Company.id == UserCompanyAssignment.company_id)
        .where(
            UserCompanyAssignment.user_id == current_user.id,
            UserCompanyAssignment.is_deleted == False,
            Company.is_deleted == False,
        )
        .order_by(Company.name.asc())
    )
    rows = ca_res.all()
    return {
        "companies": [
            {
                "id": company.id,
                "name": company.name,
                "is_default": assignment.is_default,
                "is_active": True,
            }
            for assignment, company in rows
        ],
        "active_company_id": current_user.company_id,
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Return the current authenticated user's profile.
    """
    return current_user
