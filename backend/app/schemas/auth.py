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

* Version    : 3.9.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from typing import Optional
from pydantic import BaseModel, EmailStr
from ..models.auth import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole
    company_id: Optional[str] = None
    branch_id: Optional[str] = None


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


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: UserRole
    is_active: bool
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    model_config = {"from_attributes": True}
