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

from typing import Optional
from pydantic import BaseModel, EmailStr
from ..models.auth import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: UserRole
    is_active: bool
    status: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    password_reset_required: bool = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    password_reset_required: bool = False
    user: Optional[UserResponse] = None


class AccessTokenResponse(BaseModel):
    """Returned by the refresh endpoint — new access token only."""
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class BootstrapRequest(BaseModel):
    """First-run: create the global SYSADMIN account."""
    username: str
    password: str
    email: Optional[str] = None
    mobile: Optional[str] = None
