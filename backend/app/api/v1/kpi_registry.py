"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Router : KPI Definition Registry CRUD API
"""

import uuid as _uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, get_tenant_context, TenantContext
from ...models.auth import User, UserRole
from ...models.kpi_definition import KPIDefinition

# smriti_capability(entity="ANALYTICS", capability="KPI_REGISTRY", role="CANONICAL")

router = APIRouter(prefix="/kpi-registry", tags=["KPI Registry"])

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class KPIDefinitionCreate(BaseModel):
    name:                str            = Field(..., max_length=150, description="Human-readable KPI name")
    code:                str            = Field(..., max_length=60,  description="Machine-readable code (unique per company)")
    description:         Optional[str]  = None
    category:            Optional[str]  = Field(None, max_length=80)
    icon:                Optional[str]  = Field(None, max_length=50)
    color:               Optional[str]  = Field(None, max_length=30)
    formula_key:         str            = Field(..., max_length=250, description="Dot-path to analytics resolver")
    unit:                Optional[str]  = Field(None, max_length=30, description="Display unit: ₹, %, units")
    aggregation:         Optional[str]  = Field("SUM", max_length=30)
    target_value:        Optional[Decimal] = None
    alert_below:         Optional[Decimal] = None
    alert_above:         Optional[Decimal] = None
    alert_severity:      Optional[str]  = Field(None, max_length=20)
    dashboard_placement: Optional[str]  = Field(None, max_length=80)
    sort_order:          Optional[str]  = Field("0", max_length=10)
    status:              Optional[str]  = Field("ACTIVE", max_length=20)


class KPIDefinitionUpdate(BaseModel):
    name:                Optional[str]     = Field(None, max_length=150)
    description:         Optional[str]     = None
    category:            Optional[str]     = Field(None, max_length=80)
    icon:                Optional[str]     = Field(None, max_length=50)
    color:               Optional[str]     = Field(None, max_length=30)
    formula_key:         Optional[str]     = Field(None, max_length=250)
    unit:                Optional[str]     = Field(None, max_length=30)
    aggregation:         Optional[str]     = Field(None, max_length=30)
    target_value:        Optional[Decimal] = None
    alert_below:         Optional[Decimal] = None
    alert_above:         Optional[Decimal] = None
    alert_severity:      Optional[str]     = Field(None, max_length=20)
    dashboard_placement: Optional[str]     = Field(None, max_length=80)
    sort_order:          Optional[str]     = Field(None, max_length=10)
    status:              Optional[str]     = Field(None, max_length=20)
    is_active:           Optional[bool]    = None


class KPIDefinitionOut(BaseModel):
    id:                  str
    uuid:                str
    company_id:          Optional[str]
    name:                str
    code:                str
    description:         Optional[str]
    category:            Optional[str]
    icon:                Optional[str]
    color:               Optional[str]
    formula_key:         str
    unit:                Optional[str]
    aggregation:         Optional[str]
    target_value:        Optional[Decimal]
    alert_below:         Optional[Decimal]
    alert_above:         Optional[Decimal]
    alert_severity:      Optional[str]
    dashboard_placement: Optional[str]
    sort_order:          Optional[str]
    status:              str
    is_active:           bool
    created_by:          Optional[str]
    updated_by:          Optional[str]
    created_at:          datetime
    updated_at:          datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_manager_or_above(current_user: User) -> None:
    """Raise 403 unless caller is MANAGER or SYSADMIN."""
    allowed = {UserRole.MANAGER, UserRole.SYSADMIN}
    if current_user.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "SMRITI-PERM-006",
                "title": "Insufficient Permissions",
                "message": "Creating or modifying KPI definitions requires Manager or SYSADMIN role.",
                "action": "Please contact your system administrator to request elevated permissions.",
            }
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[KPIDefinitionOut], summary="List all KPI definitions")
async def list_kpi_definitions(
    category:    Optional[str] = Query(None, description="Filter by category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    include_inactive: bool = Query(False, description="Include inactive/deprecated KPIs"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> List[KPIDefinitionOut]:
    """
    Returns KPI definitions scoped to the caller's company, plus any
    platform-wide KPIs (company_id IS NULL) available to all tenants.
    """
    q = select(KPIDefinition).where(
        KPIDefinition.is_deleted == False,  # noqa: E712
    )

    if not include_inactive:
        q = q.where(KPIDefinition.is_active == True)  # noqa: E712

    if category:
        q = q.where(KPIDefinition.category == category)

    if status_filter:
        q = q.where(KPIDefinition.status == status_filter)

    # Tenant scoping: return company-specific + platform defaults
    q = q.where(
        (KPIDefinition.company_id == tenant_ctx.company_id) |
        (KPIDefinition.company_id == None)  # noqa: E711
    )

    q = q.order_by(KPIDefinition.sort_order, KPIDefinition.name).offset(skip).limit(limit)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [KPIDefinitionOut.model_validate(r) for r in rows]


@router.get("/{kpi_id}", response_model=KPIDefinitionOut, summary="Get KPI definition by ID")
async def get_kpi_definition(
    kpi_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> KPIDefinitionOut:
    result = await db.execute(
        select(KPIDefinition).where(
            KPIDefinition.id == kpi_id,
            KPIDefinition.is_deleted == False,  # noqa: E712
        )
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SMRITI-DATA-010",
                "title": "KPI Not Found",
                "message": f"No KPI definition found with ID '{kpi_id}'.",
                "action": "Verify the KPI ID and try again, or browse the KPI registry for available definitions.",
            }
        )
    return KPIDefinitionOut.model_validate(kpi)


@router.post("/", response_model=KPIDefinitionOut, status_code=status.HTTP_201_CREATED,
             summary="Create a new KPI definition")
async def create_kpi_definition(
    payload: KPIDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> KPIDefinitionOut:
    """Requires MANAGER or SYSADMIN role."""
    _require_manager_or_above(current_user)

    # Duplicate code check (per company)
    existing = await db.execute(
        select(KPIDefinition).where(
            KPIDefinition.company_id == tenant_ctx.company_id,
            KPIDefinition.code == payload.code.upper(),
            KPIDefinition.is_deleted == False,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "SMRITI-VAL-022",
                "title": "Duplicate KPI Code",
                "message": f"A KPI with code '{payload.code.upper()}' already exists for this company.",
                "action": "Choose a different code or update the existing KPI definition.",
            }
        )

    kpi = KPIDefinition(
        id=f"kpi-{_uuid.uuid4().hex[:12]}",
        uuid=str(_uuid.uuid4()),
        company_id=tenant_ctx.company_id,
        name=payload.name,
        code=payload.code.upper(),
        description=payload.description,
        category=payload.category,
        icon=payload.icon,
        color=payload.color,
        formula_key=payload.formula_key,
        unit=payload.unit,
        aggregation=payload.aggregation or "SUM",
        target_value=payload.target_value,
        alert_below=payload.alert_below,
        alert_above=payload.alert_above,
        alert_severity=payload.alert_severity,
        dashboard_placement=payload.dashboard_placement,
        sort_order=payload.sort_order or "0",
        status=payload.status or "ACTIVE",
        is_active=True,
        is_deleted=False,
        created_by=current_user.username,
        updated_by=current_user.username,
    )
    db.add(kpi)
    await db.flush()
    await db.commit()
    await db.refresh(kpi)
    return KPIDefinitionOut.model_validate(kpi)


@router.patch("/{kpi_id}", response_model=KPIDefinitionOut, summary="Update a KPI definition")
async def update_kpi_definition(
    kpi_id: str,
    payload: KPIDefinitionUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> KPIDefinitionOut:
    """Requires MANAGER or SYSADMIN role."""
    _require_manager_or_above(current_user)

    result = await db.execute(
        select(KPIDefinition).where(
            KPIDefinition.id == kpi_id,
            KPIDefinition.is_deleted == False,  # noqa: E712
        )
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SMRITI-DATA-010",
                "title": "KPI Not Found",
                "message": f"No KPI definition found with ID '{kpi_id}'.",
                "action": "Verify the KPI ID and try again.",
            }
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kpi, field, value)

    kpi.updated_by = current_user.username
    kpi.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.commit()
    await db.refresh(kpi)
    return KPIDefinitionOut.model_validate(kpi)


@router.delete("/{kpi_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a KPI definition")
async def delete_kpi_definition(
    kpi_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft-delete. Requires MANAGER or SYSADMIN role."""
    _require_manager_or_above(current_user)

    result = await db.execute(
        select(KPIDefinition).where(
            KPIDefinition.id == kpi_id,
            KPIDefinition.is_deleted == False,  # noqa: E712
        )
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SMRITI-DATA-010",
                "title": "KPI Not Found",
                "message": f"No KPI definition found with ID '{kpi_id}'.",
                "action": "Verify the KPI ID and try again.",
            }
        )

    kpi.is_deleted = True
    kpi.is_active = False
    kpi.status = "DEPRECATED"
    kpi.updated_by = current_user.username
    kpi.updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.commit()
