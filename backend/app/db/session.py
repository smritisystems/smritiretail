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

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from sqlalchemy import event, bindparam
from sqlalchemy.orm import with_loader_criteria, Session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from ..core.config import settings

# Create Async SQLAlchemy Engine with connection pool parameters
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800
)

# Create Async Session factory
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Context variable to hold active request-scoped TenantContext
active_tenant_ctx: ContextVar = ContextVar("active_tenant_ctx", default=None)

# Context variable to hold active request-scoped SecurityContext
@dataclass
class SecurityContext:
    user_id: str
    username: str
    platform_admin: bool
    tenant_id: str
    company_ids: List[str]
    branch_ids: List[str]
    department_ids: List[str]
    warehouse_ids: List[str]
    cost_center_ids: List[str]
    record_scope: str  # SELF, TEAM, BRANCH, COMPANY, ALL
    license: Dict[str, Any]
    feature_flags: Dict[str, Any]
    session: str
    api_key: str

active_security_context: ContextVar = ContextVar("active_security_context", default=None)

@event.listens_for(Session, "do_orm_execute")
def apply_tenant_filter(execute_state):
    """
    ORM query interceptor injecting tenant_id filters dynamically.
    Avoids before_compile issues in SQLAlchemy 2.0.
    """
    if execute_state.is_select and not execute_state.execution_options.get("ignore_tenant_isolation", False):
        ctx = active_tenant_ctx.get()
        if ctx and getattr(ctx, "tenant_id", None):
            tenant_id = ctx.tenant_id
            from ..db.base import BaseEntity

            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    BaseEntity,
                    lambda cls: cls.tenant_id == tenant_id
                )
            )

def get_current_user_id() -> str:
    ctx = active_security_context.get()
    return str(ctx.user_id) if (ctx and ctx.user_id) else ""

def get_current_branch_ids() -> tuple:
    ctx = active_security_context.get()
    return tuple(ctx.branch_ids) if (ctx and ctx.branch_ids) else ()

def get_current_company_ids() -> tuple:
    ctx = active_security_context.get()
    return tuple(ctx.company_ids) if (ctx and ctx.company_ids) else ()

def get_current_department_ids() -> tuple:
    ctx = active_security_context.get()
    return tuple(ctx.department_ids) if (ctx and ctx.department_ids) else ()

@event.listens_for(Session, "do_orm_execute")
def apply_rls_filter(execute_state):
    """
    ORM query interceptor injecting row-level security (RLS) filters dynamically.
    Enforces SELF, TEAM, BRANCH, COMPANY, or ALL visibility.
    """
    if execute_state.is_select and not execute_state.execution_options.get("ignore_rls_isolation", False):
        ctx = active_security_context.get()
        print(f"DEBUG RLS INTERCEPTOR: ctx={ctx}", flush=True)
        if ctx and not ctx.platform_admin:
            from ..db.base import RowSecuredMixin
            scope = ctx.record_scope

            if scope == "ALL":
                # No RLS filter required, can view all companies/branches in the tenant
                return

            user_id = str(ctx.user_id) if ctx.user_id else ""
            branch_ids = tuple(ctx.branch_ids) if ctx.branch_ids else ()
            company_ids = tuple(ctx.company_ids) if ctx.company_ids else ()
            department_ids = tuple(ctx.department_ids) if ctx.department_ids else ()

            for mapper in execute_state.all_mappers:
                target_cls = mapper.class_
                if issubclass(target_cls, RowSecuredMixin):
                    if scope == "SELF":
                        uid = get_current_user_id()
                        if uid:
                            execute_state.statement = execute_state.statement.options(
                                with_loader_criteria(
                                    target_cls,
                                    lambda cls: cls.created_by == uid,
                                    track_closure_variables=True
                                )
                            )
                    elif scope == "TEAM":
                        dids = get_current_department_ids()
                        if dids and hasattr(target_cls, "department_id"):
                            execute_state.statement = execute_state.statement.options(
                                with_loader_criteria(
                                    target_cls,
                                    lambda cls: cls.department_id.in_(dids),
                                    track_closure_variables=True
                                )
                            )
                    elif scope == "BRANCH":
                        bids = get_current_branch_ids()
                        if bids:
                            execute_state.statement = execute_state.statement.options(
                                with_loader_criteria(
                                    target_cls,
                                    lambda cls: cls.branch_id.in_(bids),
                                    track_closure_variables=True
                                )
                            )
                    elif scope == "COMPANY":
                        cids = get_current_company_ids()
                        if cids:
                            execute_state.statement = execute_state.statement.options(
                                with_loader_criteria(
                                    target_cls,
                                    lambda cls: cls.company_id.in_(cids),
                                    track_closure_variables=True
                                )
                            )

# Async Generator dependency to provide DB sessions to routes
async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
            
async def verify_db_connectivity() -> bool:
    try:
        from sqlalchemy import text
        async with async_session() as session:
            res = await session.execute(text("SELECT 1"))
            return res.scalar() == 1
    except Exception as e:
        print(f"[SDIC Database] Connectivity check failed: {e}")
        return False
