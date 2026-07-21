"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.purchase import BlanketPurchaseAgreement, BlanketPurchaseAgreementLine, Supplier
from app.schemas.purchase import BPACreate, BPAResponse, BPAReleaseRequest, PurchaseOrderResponse
from app.procurement.engine.blanket_release_engine import BlanketReleaseEngine

router = APIRouter(prefix="/purchase/bpa", tags=["Procurement Blanket Purchase Agreements"])


@router.post("", response_model=BPAResponse, status_code=status.HTTP_201_CREATED)
async def create_bpa(
    bpa_in: BPACreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates and activates a new Blanket Purchase Agreement (BPA) with committed product lines and value ceiling.
    """
    # Validate supplier
    sup_stmt = select(Supplier).where(Supplier.id == bpa_in.supplier_id)
    sup = (await db.execute(sup_stmt)).scalars().first()
    if not sup:
        raise HTTPException(status_code=404, detail=f"Supplier '{bpa_in.supplier_id}' not found")

    bpa_id = f"bpa-{uuid.uuid4().hex[:12]}"
    max_val = Decimal(str(bpa_in.max_commitment_value))

    bpa_obj = BlanketPurchaseAgreement(
        id=bpa_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        bpa_code=bpa_in.bpa_code,
        title=bpa_in.title,
        supplier_id=bpa_in.supplier_id,
        valid_from=bpa_in.valid_from,
        valid_to=bpa_in.valid_to,
        max_commitment_value=max_val,
        released_value=Decimal("0.00"),
        remaining_value=max_val,
        terms_and_conditions=bpa_in.terms_and_conditions,
        status="Active"
    )
    db.add(bpa_obj)

    line_objs = []
    for line in bpa_in.lines:
        qty = Decimal(str(line.committed_quantity))
        price = Decimal(str(line.agreed_unit_price))

        b_line = BlanketPurchaseAgreementLine(
            id=f"bpal-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            bpa_id=bpa_id,
            product_id=line.product_id,
            agreed_unit_price=price,
            committed_quantity=qty,
            released_quantity=Decimal("0.00"),
            remaining_quantity=qty
        )
        line_objs.append(b_line)

    db.add_all(line_objs)
    await db.commit()
    await db.refresh(bpa_obj)
    bpa_obj.lines = line_objs
    return bpa_obj


@router.get("", response_model=List[BPAResponse])
async def list_bpas(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all Blanket Purchase Agreements for the tenant.
    """
    stmt = select(BlanketPurchaseAgreement).where(
        BlanketPurchaseAgreement.company_id == tenant.company_id,
        BlanketPurchaseAgreement.is_deleted == False
    )
    bpas = list((await db.execute(stmt)).scalars().all())
    for b in bpas:
        l_stmt = select(BlanketPurchaseAgreementLine).where(BlanketPurchaseAgreementLine.bpa_id == b.id)
        b.lines = list((await db.execute(l_stmt)).scalars().all())
    return bpas


@router.get("/{bpa_id}", response_model=BPAResponse)
async def get_bpa(
    bpa_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves a Blanket Purchase Agreement by ID.
    """
    stmt = select(BlanketPurchaseAgreement).where(
        BlanketPurchaseAgreement.id == bpa_id,
        BlanketPurchaseAgreement.company_id == tenant.company_id,
        BlanketPurchaseAgreement.is_deleted == False
    )
    bpa = (await db.execute(stmt)).scalars().first()
    if not bpa:
        raise HTTPException(status_code=404, detail="Blanket Purchase Agreement not found")

    l_stmt = select(BlanketPurchaseAgreementLine).where(BlanketPurchaseAgreementLine.bpa_id == bpa.id)
    bpa.lines = list((await db.execute(l_stmt)).scalars().all())
    return bpa


@router.post("/{bpa_id}/release", response_model=PurchaseOrderResponse)
async def issue_bpa_release(
    bpa_id: str,
    req: BPAReleaseRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Issues a scheduled delivery release against an active BPA.
    Generates a release Purchase Order and updates BPA commitment limits.
    """
    release_engine = BlanketReleaseEngine(db, tenant)
    items_in = [{"product_id": item.product_id, "release_quantity": item.release_quantity} for item in req.items]
    return await release_engine.issue_bpa_release(bpa_id=bpa_id, release_items=items_in)
