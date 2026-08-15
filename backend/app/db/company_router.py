"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional, Any
from fastapi import HTTPException, status, Header, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.auth import User, UserRole
from ..services.control_database_registry import ControlDatabaseRegistryService
from ..models.control.control_models import ControlCompanyDatabase


async def verify_user_company_access(
    current_user: Any,
    requested_company_code: str
) -> str:
    """
    Security-First Authorization Guard for Multi-Tenant Connection Routing.
    X-Company-Code is strictly treated as a routing hint.
    Access is authorized against user's permitted company list before resolving database mapping.
    """
    clean_code = requested_company_code.strip().upper()

    # SYSADMIN / Superuser bypasses company assignment checks
    is_super = getattr(current_user, "is_superuser", False)
    user_role = getattr(current_user, "role", None)

    if is_super or user_role == UserRole.SYSADMIN or user_role == "SYSADMIN":
        return clean_code

    # Verify user's assigned/allowed company codes
    user_allowed_codes = getattr(current_user, "allowed_company_codes", None) or []
    user_company_code = getattr(current_user, "company_code", None)

    is_authorized = (
        clean_code in [c.upper() for c in user_allowed_codes] or
        (user_company_code and user_company_code.upper() == clean_code)
    )

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: You do not have authorization to access company data for '{clean_code}'."
        )

    return clean_code


async def resolve_authorized_company_db_url(
    control_session: AsyncSession,
    current_user: Any,
    x_company_code: str = Header(..., alias="X-Company-Code")
) -> str:
    """
    Resolves authoritative company connection URL from SmritiSys Control Registry
    after verifying user authorization.
    """
    if not x_company_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'X-Company-Code' is required for company data routing."
        )

    # 1. Authorize user for requested company code
    authorized_code = await verify_user_company_access(current_user, x_company_code)

    # 2. Look up database mapping in SmritiSys Control Database Registry
    db_meta = await ControlDatabaseRegistryService.get_company_database(
        control_session,
        authorized_code
    )

    if not db_meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active business database registered in SmritiSys for company code '{authorized_code}'."
        )

    # 3. Build & return connection URL from control registry metadata
    return ControlDatabaseRegistryService.build_connection_url(db_meta)
