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

import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.auth import User, RefreshTokenBlacklist, UserRole
from ..models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from ..schemas.auth import LoginRequest, BootstrapRequest, TenantContextSwitchRequest
from ..core.security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, create_refresh_token, decode_token,
)
from ..core.config import settings


def _build_token_payload(user: User, company_id: str = None, branch_id: str = None) -> dict:
    """Build the common JWT payload for a given user."""
    return {
        "sub":        user.id,
        "username":   user.username,
        "role":       user.role.value,
        "company_id": company_id if company_id is not None else user.company_id,
        "branch_id":  branch_id if branch_id is not None else user.branch_id,
        "jti":        str(uuid.uuid4()),   # unique ID per token — used for blacklisting
    }


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Bootstrap — first-run SYSADMIN creation
    # ------------------------------------------------------------------
    async def bootstrap_admin(self, req: BootstrapRequest) -> User:
        """
        Create the global SYSADMIN account.
        Only succeeds when zero users exist in the database.
        """
        count_res = await self.db.execute(select(User))
        if count_res.scalars().first() is not None:
            raise HTTPException(
                status_code=403,
                detail="System already has registered users. Bootstrap is only allowed on a fresh installation."
            )

        validate_password_strength(req.password)
        admin = User(
            id=f"usr-{uuid.uuid4().hex[:6]}",
            username=req.username,
            email=req.email,
            mobile=req.mobile,
            hashed_password=hash_password(req.password),
            role=UserRole.SYSADMIN,
            is_active=True,
            is_deleted=False,
            company_id=None,   # SYSADMIN is global
            branch_id=None,
            status="PendingPasswordChange",
        )
        self.db.add(admin)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="A user with this username or email already exists."
            )
        await self.db.refresh(admin)
        return admin

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------
    async def login(self, req: LoginRequest) -> dict:
        """Authenticate the user and return access + refresh tokens."""
        uname = str(req.username).strip()
        alt_uname = uname[4:] if uname.startswith("usr_") else f"usr_{uname}"
        res = await self.db.execute(
            select(User).where(
                (User.username == uname) | (User.username == alt_uname) | (User.email == uname),
                User.is_deleted == False
            )
        )
        user = res.scalars().first()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if req.company_id is not None and user.company_id is not None and user.company_id != req.company_id:
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if req.branch_id is not None and user.branch_id is not None and user.branch_id != req.branch_id:
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not verify_password(req.password, user.hashed_password):
            raise HTTPException(
                status_code=401,
                detail="Incorrect username or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Resolve default company/branch from user_company_assignments for ALL roles.
        # SYSADMIN users have company_id=NULL on the User record by design (they are global),
        # but are assigned a default working company via user_company_assignments.
        # NOTE: The UserCompanyAssignment ORM model does not map branch_id (it exists in the
        # DB table but not in the SQLAlchemy model). We use a raw SQL query to retrieve both
        # company_id and branch_id in one shot to avoid silent None from unmapped attributes.
        resolved_company_id = user.company_id
        resolved_branch_id = user.branch_id

        if not resolved_company_id:
            from sqlalchemy import text as sa_text
            raw_res = await self.db.execute(
                sa_text(
                    "SELECT company_id, branch_id FROM user_company_assignments "
                    "WHERE user_id = :uid AND is_default = true "
                    "AND is_deleted = false AND is_active = true LIMIT 1"
                ),
                {"uid": user.id},
            )
            row = raw_res.fetchone()
            if row:
                resolved_company_id = row[0]
                if row[1]:
                    resolved_branch_id = row[1]

        if not resolved_branch_id and resolved_company_id:
            default_br_res = await self.db.execute(
                select(UserBranchAssignment).where(
                    UserBranchAssignment.user_id == user.id,
                    UserBranchAssignment.company_id == resolved_company_id,
                    UserBranchAssignment.is_default == True,
                    UserBranchAssignment.is_deleted == False,
                    UserBranchAssignment.is_active == True,
                )
            )
            default_br = default_br_res.scalars().first()
            if default_br:
                resolved_branch_id = default_br.branch_id

        # For non-SYSADMIN users, company+branch must be resolved or login is rejected.
        # SYSADMIN users may operate without a company (global admin access).
        if user.role != UserRole.SYSADMIN and (not resolved_company_id or not resolved_branch_id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Your operator account is not assigned to a company and branch. "
                    "A SYSADMIN must assign tenant access before you can sign in."
                ),
            )


        if resolved_company_id and not user.company_id:
            user.company_id = resolved_company_id
        if resolved_branch_id and not user.branch_id:
            user.branch_id = resolved_branch_id

        payload = _build_token_payload(user, company_id=resolved_company_id, branch_id=resolved_branch_id)
        return {
            "access_token":  create_access_token(payload),
            "refresh_token": create_refresh_token(payload),
            "token_type":    "bearer",
            "role":          user.role,
            "company_id":    resolved_company_id,
            "branch_id":     resolved_branch_id,
            "password_reset_required": user.status == "PendingPasswordChange",
            "user":          user,
        }

    # ------------------------------------------------------------------
    # Switch Context (Multi-Company/Branch)
    # ------------------------------------------------------------------
    async def switch_context(self, user: User, req: TenantContextSwitchRequest) -> dict:
        """Dynamically switch active company/branch context and return updated tokens."""
        if user.role != UserRole.SYSADMIN:
            # Verify company assignment
            comp_res = await self.db.execute(
                select(UserCompanyAssignment).where(
                    UserCompanyAssignment.user_id == user.id,
                    UserCompanyAssignment.company_id == req.target_company_id,
                    UserCompanyAssignment.is_deleted == False,
                    UserCompanyAssignment.is_active == True,
                )
            )
            if not comp_res.scalars().first():
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are not assigned to the specified target company.",
                )

            # Verify branch assignment
            br_res = await self.db.execute(
                select(UserBranchAssignment).where(
                    UserBranchAssignment.user_id == user.id,
                    UserBranchAssignment.branch_id == req.target_branch_id,
                    UserBranchAssignment.is_deleted == False,
                    UserBranchAssignment.is_active == True,
                )
            )
            if not br_res.scalars().first():
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: You are not assigned to the specified target branch.",
                )

        payload = _build_token_payload(user, company_id=req.target_company_id, branch_id=req.target_branch_id)
        user.company_id = req.target_company_id
        user.branch_id = req.target_branch_id
        return {
            "access_token":  create_access_token(payload),
            "refresh_token": create_refresh_token(payload),
            "token_type":    "bearer",
            "role":          user.role,
            "company_id":    req.target_company_id,
            "branch_id":     req.target_branch_id,
            "password_reset_required": user.status == "PendingPasswordChange",
            "user":          user,
        }

    # ------------------------------------------------------------------
    # Refresh
    # ------------------------------------------------------------------
    async def refresh(self, refresh_token: str) -> dict:
        """Issue a new access token given a valid, non-blacklisted refresh token."""
        payload = decode_token(refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=401,
                detail="Invalid token type. A refresh token is required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jti = payload.get("jti")
        if jti:
            blacklisted = await self.db.execute(
                select(RefreshTokenBlacklist).where(RefreshTokenBlacklist.token_jti == jti)
            )
            if blacklisted.scalars().first():
                raise HTTPException(
                    status_code=401,
                    detail="This session has been logged out. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # Load user to ensure still active
        user_res = await self.db.execute(
            select(User).where(User.id == payload.get("sub"), User.is_deleted == False)
        )
        user = user_res.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User account is no longer active.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        new_payload = _build_token_payload(user)
        return {
            "access_token": create_access_token(new_payload),
            "token_type":   "bearer",
        }

    # ------------------------------------------------------------------
    # Logout
    # ------------------------------------------------------------------
    async def logout(self, refresh_token: str, user_id: str) -> None:
        """Blacklist the refresh token so it cannot be used again."""
        payload = decode_token(refresh_token)
        jti = payload.get("jti") or str(uuid.uuid4())
        exp = payload.get("exp")
        expires_at = (
            datetime.fromtimestamp(exp, tz=timezone.utc)
            if exp
            else datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        entry = RefreshTokenBlacklist(
            token_jti=jti,
            user_id=user_id,
            expires_at=expires_at,
        )
        self.db.add(entry)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()  # already blacklisted — idempotent

    # ------------------------------------------------------------------
    # Get current user by ID
    # ------------------------------------------------------------------
    async def get_user_by_id(self, user_id: str) -> User:
        res = await self.db.execute(
            select(User).where(User.id == user_id, User.is_deleted == False)
        )
        user = res.scalars().first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User account is inactive or does not exist.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
