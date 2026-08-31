"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.30.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 10 -- Staff Management parity.
Shoper9 MnuNo 612 (SR442900/SR443900).
Personnel Catalogue backed by commission_participants table.
Incentive Definition backed by commission_rules + commission_programs.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.commission import CommissionParticipant, CommissionProgram, CommissionRule

router = APIRouter(prefix="/staff")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PersonnelOut(BaseModel):
    id: str
    person_name: str
    user_id: Optional[str]
    participant_role: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True

class IncentiveOut(BaseModel):
    id: str
    program_id: str
    program_name: str
    participant_role: str
    calculation_type: str
    rate_percent: float
    fixed_amount: float
    min_order_amount: float
    is_active: bool

    class Config:
        from_attributes = True

class IncentiveCreate(BaseModel):
    program_id: str
    participant_role: str = "SALESPERSON"
    calculation_type: str = "PERCENTAGE"  # PERCENTAGE | FIXED_AMOUNT | SLAB_BASED
    rate_percent: float = 0.0
    fixed_amount: float = 0.0
    min_order_amount: float = 0.0
    max_commission_amount: Optional[float] = None


# ---------------------------------------------------------------------------
# STAFF-001: Personnel Catalogue  (Shoper9: SR442900.EXE MnuNo 612/6121)
# GET /api/v1/staff/personnel
# ---------------------------------------------------------------------------

@router.get("/personnel", response_model=List[PersonnelOut])
async def list_personnel(
    role:        Optional[str] = Query(default=None, description="Filter by role e.g. SALESPERSON, DRIVER"),
    active_only: bool = Query(default=True),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-001 -- Personnel Catalogue (Shoper9: SR442900.EXE MnuNo 612/6121).
    Lists all registered participants (salespersons, drivers, agents, referrers).
    Backed by commission_participants table.
    """
    stmt = select(CommissionParticipant).where(CommissionParticipant.is_deleted == False)
    if active_only:
        stmt = stmt.where(CommissionParticipant.is_active == True)
    if role:
        stmt = stmt.where(CommissionParticipant.participant_role.ilike(f"%{role}%"))
    stmt = stmt.order_by(CommissionParticipant.person_name)
    participants = (await db.execute(stmt)).scalars().all()

    return [
        PersonnelOut(
            id=p.id,
            person_name=p.person_name,
            user_id=getattr(p, "user_id", None),
            participant_role=getattr(p, "participant_role", "SALESPERSON") or "SALESPERSON",
            is_active=getattr(p, "is_active", True),
            created_at=str(p.created_at)[:10] if p.created_at else "",
        )
        for p in participants
    ]


# ---------------------------------------------------------------------------
# STAFF-002: Incentive Definition  (Shoper9: SR443900.EXE MnuNo 612/6124)
# GET  /api/v1/staff/incentives
# POST /api/v1/staff/incentives
# ---------------------------------------------------------------------------

@router.get("/incentives")
async def list_incentives(
    program_id:  Optional[str] = Query(default=None),
    role:        Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-002 -- Incentive Definition (Shoper9: SR443900.EXE MnuNo 612/6124).
    Lists commission rules (incentive slabs) per program and participant role.
    """
    # Load programs for name join
    progs = (await db.execute(
        select(CommissionProgram).where(CommissionProgram.is_deleted == False)
    )).scalars().all()
    prog_map = {p.id: p.name for p in progs}

    stmt = select(CommissionRule).where(CommissionRule.is_deleted == False)
    if active_only:
        stmt = stmt.where(CommissionRule.is_active == True)
    if program_id:
        stmt = stmt.where(CommissionRule.program_id == program_id)
    if role:
        stmt = stmt.where(CommissionRule.participant_role.ilike(f"%{role}%"))
    stmt = stmt.order_by(CommissionRule.participant_role)
    rules = (await db.execute(stmt)).scalars().all()

    lines = [
        {
            "id":                 r.id,
            "program_id":         r.program_id,
            "program_name":       prog_map.get(r.program_id, ""),
            "participant_role":   getattr(r, "participant_role", "") or "",
            "calculation_type":   getattr(r, "calculation_type", "PERCENTAGE") or "PERCENTAGE",
            "rate_percent":       float(getattr(r, "rate_percent", 0) or 0),
            "fixed_amount":       float(getattr(r, "fixed_amount", 0) or 0),
            "min_order_amount":   float(getattr(r, "min_order_amount", 0) or 0),
            "max_commission_amount": float(getattr(r, "max_commission_amount", 0) or 0)
                                     if getattr(r, "max_commission_amount", None) else None,
            "is_active":          bool(getattr(r, "is_active", True)),
        }
        for r in rules
    ]

    return {
        "report_id":    "STAFF-002",
        "sh9_exe":      "SR443900",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_rules":  len(lines),
        "programs_available": len(prog_map),
        "lines":        lines,
    }


@router.post("/incentives", status_code=status.HTTP_201_CREATED)
async def create_incentive(
    payload: IncentiveCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-002 (write) -- Create Incentive Rule (Shoper9: SR443900.EXE MnuNo 612/6124).
    Adds a new commission rule (incentive slab) to an existing program.
    Role guard: ADMIN or SYSADMIN.
    """
    role = getattr(current_user, "role", "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "SMRITI-PERM-001",
                "message": "You do not have permission to define incentive rules.",
                "action":  "Contact your system administrator to request access.",
            },
        )

    # Verify program exists
    prog = (await db.execute(
        select(CommissionProgram).where(
            CommissionProgram.id == payload.program_id,
            CommissionProgram.is_deleted == False,
        )
    )).scalar_one_or_none()
    if not prog:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code":    "SMRITI-VAL-001",
                "message": f"Commission program '{payload.program_id}' was not found.",
                "action":  "Check the program ID or create a new program first.",
            },
        )

    new_rule = CommissionRule(
        program_id=payload.program_id,
        participant_role=payload.participant_role,
        calculation_type=payload.calculation_type,
        rate_percent=payload.rate_percent,
        fixed_amount=payload.fixed_amount,
        min_order_amount=payload.min_order_amount,
        max_commission_amount=payload.max_commission_amount,
        is_active=True,
        created_by=getattr(current_user, "id", None) or "system",
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return {
        "id":               new_rule.id,
        "program_id":       new_rule.program_id,
        "program_name":     prog.name,
        "participant_role": new_rule.participant_role,
        "calculation_type": new_rule.calculation_type,
        "rate_percent":     float(new_rule.rate_percent or 0),
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# STAFF-003: Commission Programs List  (supporting endpoint for UI)
# GET /api/v1/staff/programs
# ---------------------------------------------------------------------------

@router.get("/programs")
async def list_programs(
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    STAFF-003 -- Commission Programs (supporting endpoint).
    Lists all commission programs available for incentive definition.
    """
    progs = (await db.execute(
        select(CommissionProgram)
        .where(CommissionProgram.is_deleted == False)
        .order_by(CommissionProgram.name)
    )).scalars().all()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total":        len(progs),
        "programs": [
            {
                "id":          p.id,
                "name":        p.name,
                "description": getattr(p, "description", None) or "",
                "is_active":   bool(getattr(p, "is_active", True)),
            }
            for p in progs
        ],
    }
