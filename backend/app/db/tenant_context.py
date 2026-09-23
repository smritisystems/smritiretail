"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Architecture Contract

SMRITI Tenant Database Context Contract (TDB-v2.0)
═════════════════════════════════════════════════
Provides an immutable context holding a validated tenant database session.
Enforces that tenant operational repositories and services CANNOT operate on
the smritisys Control Plane database.

This brings database boundary enforcement to the application type level:
operational services accept TenantDBContext instead of raw AsyncSession.
"""

from typing import Optional, Callable, Any, TypeVar
import functools
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.db.session import (
    resolve_company_database_name,
    get_company_sessionmaker,
    validate_company_database_name,
)


class TenantContextRequired(HTTPException):
    """Raised when tenant context is missing or resolves to smritisys."""
    def __init__(self, detail: str = "Tenant database context is required. Operational data cannot target smritisys."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class TenantDBContext:
    """
    Immutable context object that carries a validated tenant database session.
    Cannot be constructed without explicit tenant validation.
    Guarantees that db session is connected to a registered tenant database, never smritisys.
    """
    def __init__(self, db: AsyncSession, tenant_id: str, database_name: str):
        clean_db = str(database_name).strip().lower()
        if clean_db == "smritisys":
            raise TenantContextRequired(
                "CRITICAL BOUNDARY VIOLATION: TenantDBContext cannot wrap smritisys. "
                "smritisys is the SMRITI Control Plane."
            )
        if not validate_company_database_name(clean_db):
            raise TenantContextRequired(
                f"CRITICAL BOUNDARY VIOLATION: Database name '{clean_db}' is not a valid tenant database shape."
            )
        self._db = db
        self._tenant_id = str(tenant_id).strip()
        self._database_name = clean_db

    @property
    def db(self) -> AsyncSession:
        return self._db

    @property
    def tenant_id(self) -> str:
        return self._tenant_id

    @property
    def database_name(self) -> str:
        return self._database_name

    @classmethod
    async def require(cls, tenant_id: str) -> "TenantDBContext":
        """
        Factory method: resolves tenant_id to its registered company database,
        validates the boundary, creates a dedicated tenant session, and returns the context.
        """
        if not tenant_id or not str(tenant_id).strip():
            raise TenantContextRequired("tenant_id is required.")
        candidate = str(tenant_id).strip()
        if candidate.lower() == "smritisys":
            raise TenantContextRequired("Control Plane 'smritisys' is not a valid tenant ID.")

        db_name = await resolve_company_database_name(candidate)
        if db_name == "smritisys":
            raise TenantContextRequired("Resolved database for tenant is smritisys. Boundary violated.")

        session_maker = get_company_sessionmaker(db_name)
        session = session_maker()
        return cls(db=session, tenant_id=candidate, database_name=db_name)

    async def __aenter__(self) -> "TenantDBContext":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self._db.close()


F = TypeVar("F", bound=Callable[..., Any])


def require_tenant_context(fn: F) -> F:
    """
    Decorator for operational service methods ensuring they receive a valid TenantDBContext.
    """
    @functools.wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        ctx = kwargs.get("tenant_ctx")
        if not ctx:
            for arg in args:
                if isinstance(arg, TenantDBContext):
                    ctx = arg
                    break
        if not ctx or not isinstance(ctx, TenantDBContext):
            raise TenantContextRequired(
                f"{fn.__name__} requires a validated TenantDBContext parameter."
            )
        return fn(*args, **kwargs)
    return wrapper  # type: ignore[return-value]
