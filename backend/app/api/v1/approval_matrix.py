"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-19
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""
Approval Matrix API — /api/v1/approval-matrix

Provides CRUD endpoints for the Multi-Tier Approval Matrix Engine.
Persists approval rules to the `approval_matrices` table in Postgres
(or returns in-memory defaults if table does not yet exist — safe
bootstrap fallback for Phase 4A compliance feature freeze).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    get_company_db,
    get_current_user,
    get_tenant_context,
    require_role,
    TenantContext,
)
from ...models.auth import User, UserRole
from ...core.logging import logger

router = APIRouter()

# ---------------------------------------------------------------------------
# Default approval matrices (mirrors frontend DEFAULT_MATRICES constant)
# Returned when the DB table does not yet exist or is empty.
# ---------------------------------------------------------------------------
_DEFAULT_MATRICES = [
    {
        "id": "AM-001",
        "name": "High Value Purchase Orders",
        "documentType": "Purchase Order",
        "active": True,
        "conditionSummary": "Total Amount > ₹50,000",
        "approverSummary": "Level 1: Procurement Manager → Level 2: Finance Director",
        "conditions": [
            {"id": "c1", "field": "Total Amount", "operator": ">", "value": "50000"}
        ],
        "levels": [
            {"id": "l1", "level": 1, "approverType": "role", "approverValue": "PROCUREMENT_MANAGER"},
            {"id": "l2", "level": 2, "approverType": "role", "approverValue": "FINANCE_DIRECTOR"},
        ],
    },
    {
        "id": "AM-002",
        "name": "Standard Purchase Approvals",
        "documentType": "Purchase Order",
        "active": True,
        "conditionSummary": "Total Amount ≤ ₹50,000",
        "approverSummary": "Level 1: Store Manager",
        "conditions": [
            {"id": "c1", "field": "Total Amount", "operator": "<=", "value": "50000"}
        ],
        "levels": [
            {"id": "l1", "level": 1, "approverType": "role", "approverValue": "STORE_MANAGER"},
        ],
    },
]


async def _table_exists(db: AsyncSession, table_name: str) -> bool:
    """Check if a table exists in the public schema."""
    result = await db.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :tname)"
        ),
        {"tname": table_name},
    )
    return bool(result.scalar())


# ---------------------------------------------------------------------------
# GET /api/v1/approval-matrix
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[dict])
async def list_approval_matrices(
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    List all approval matrix rules.
    Falls back to built-in defaults if the DB table does not yet exist.
    """
    try:
        if not await _table_exists(db, "approval_matrices"):
            logger.info("[ApprovalMatrix] Table not found — returning defaults")
            return _DEFAULT_MATRICES

        result = await db.execute(text("SELECT * FROM approval_matrices ORDER BY id"))
        rows = result.mappings().all()
        if not rows:
            return _DEFAULT_MATRICES
        return [dict(r) for r in rows]
    except Exception as exc:  # pragma: no cover
        logger.warning("[ApprovalMatrix] DB read failed, returning defaults: %s", exc)
        return _DEFAULT_MATRICES


# ---------------------------------------------------------------------------
# GET /api/v1/approval-matrix/{matrix_id}
# ---------------------------------------------------------------------------
@router.get("/{matrix_id}", response_model=dict)
async def get_approval_matrix(
    matrix_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Retrieve a single approval matrix rule by ID."""
    # Check defaults first (works even before table migration)
    for m in _DEFAULT_MATRICES:
        if m["id"] == matrix_id:
            return m

    if not await _table_exists(db, "approval_matrices"):
        raise HTTPException(status_code=404, detail=f"Approval Matrix '{matrix_id}' not found.")

    result = await db.execute(
        text("SELECT * FROM approval_matrices WHERE id = :mid"),
        {"mid": matrix_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Approval Matrix '{matrix_id}' not found.")
    return dict(row)


# ---------------------------------------------------------------------------
# POST /api/v1/approval-matrix
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=dict,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_approval_matrix(
    payload: dict,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Create a new approval matrix rule.
    Returns 501 if the persistence table has not yet been provisioned.
    """
    if not await _table_exists(db, "approval_matrices"):
        raise HTTPException(
            status_code=501,
            detail="Approval Matrix persistence table not yet provisioned. Please run the DB migration first.",
        )

    matrix_id = payload.get("id") or f"AM-{int(__import__('time').time() * 1000) % 10**8}"
    await db.execute(
        text(
            "INSERT INTO approval_matrices (id, name, document_type, active, condition_summary, approver_summary) "
            "VALUES (:id, :name, :dt, :active, :cond, :appr) ON CONFLICT (id) DO NOTHING"
        ),
        {
            "id": matrix_id,
            "name": payload.get("name", ""),
            "dt": payload.get("documentType", ""),
            "active": payload.get("active", True),
            "cond": payload.get("conditionSummary", ""),
            "appr": payload.get("approverSummary", ""),
        },
    )
    await db.commit()
    payload["id"] = matrix_id
    return payload


# ---------------------------------------------------------------------------
# PUT /api/v1/approval-matrix/{matrix_id}
# ---------------------------------------------------------------------------
@router.put(
    "/{matrix_id}",
    response_model=dict,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_approval_matrix(
    matrix_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update an existing approval matrix rule."""
    if not await _table_exists(db, "approval_matrices"):
        raise HTTPException(status_code=501, detail="Approval Matrix table not yet provisioned.")

    await db.execute(
        text(
            "UPDATE approval_matrices SET name=:name, document_type=:dt, active=:active, "
            "condition_summary=:cond, approver_summary=:appr WHERE id=:mid"
        ),
        {
            "mid": matrix_id,
            "name": payload.get("name", ""),
            "dt": payload.get("documentType", ""),
            "active": payload.get("active", True),
            "cond": payload.get("conditionSummary", ""),
            "appr": payload.get("approverSummary", ""),
        },
    )
    await db.commit()
    payload["id"] = matrix_id
    return payload


# ---------------------------------------------------------------------------
# DELETE /api/v1/approval-matrix/{matrix_id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{matrix_id}",
    status_code=204,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_approval_matrix(
    matrix_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an approval matrix rule by ID."""
    if not await _table_exists(db, "approval_matrices"):
        raise HTTPException(status_code=501, detail="Approval Matrix table not yet provisioned.")

    await db.execute(
        text("DELETE FROM approval_matrices WHERE id = :mid"),
        {"mid": matrix_id},
    )
    await db.commit()
