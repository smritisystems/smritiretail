from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_company_db, get_current_user, get_tenant_context, require_role
from ...models.auth import User, UserRole
from ...schemas.barcode_registry import BarcodeAssignRequest, BarcodeBulkCommitRequest, BarcodeBulkPreviewRequest, BarcodeBulkPreviewResponse, BarcodeIntakeRequest, BarcodeRegistryResponse
from ...services.barcode_registry import BarcodeRegistryService

router = APIRouter()


@router.get("/types")
async def barcode_type_policy():
    return BarcodeRegistryService.type_policy()


@router.get("/metrics")
async def registry_metrics(db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context)):
    return await BarcodeRegistryService.metrics(db, tenant_ctx.company_id)


@router.get("/detect")
async def detect_barcode(q: str = Query(..., min_length=1, max_length=500)):
    return BarcodeRegistryService.detect(q)


@router.get("", response_model=List[BarcodeRegistryResponse])
async def list_registry(q: Optional[str] = Query(None, max_length=100), status: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500), db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context)):
    try:
        rows = await BarcodeRegistryService.list_records(db, tenant_ctx.company_id, q, status, limit)
        return [BarcodeRegistryService.serialize(row) for row in rows]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/intake", response_model=BarcodeRegistryResponse, status_code=201, dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def intake_barcode(req: BarcodeIntakeRequest, db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context), current_user: User = Depends(get_current_user)):
    try:
        row = await BarcodeRegistryService.intake(db, tenant_ctx.company_id, tenant_ctx.branch_id, current_user.id, req.barcode, req.barcode_type, req.source, req.source_reference, req.barcode_purpose, req.encoding_standard)
        return BarcodeRegistryService.serialize(row)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/{barcode_id}/assign", response_model=BarcodeRegistryResponse, dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def assign_barcode(barcode_id: str, req: BarcodeAssignRequest, db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context), current_user: User = Depends(get_current_user)):
    try:
        row = await BarcodeRegistryService.assign(db, tenant_ctx.company_id, tenant_ctx.branch_id, current_user.id, barcode_id, req.variant_sku, req.item_code, req.reason)
        return BarcodeRegistryService.serialize(row)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/bulk/preview", response_model=BarcodeBulkPreviewResponse, dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def preview_bulk(req: BarcodeBulkPreviewRequest, db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context)):
    return await BarcodeRegistryService.preview_bulk(db, tenant_ctx.company_id, [row.model_dump() for row in req.rows])


@router.post("/bulk/commit", dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))])
async def commit_bulk(req: BarcodeBulkCommitRequest, db: AsyncSession = Depends(get_company_db), tenant_ctx: TenantContext = Depends(get_tenant_context), current_user: User = Depends(get_current_user)):
    try:
        return await BarcodeRegistryService.commit_bulk(db, tenant_ctx.company_id, tenant_ctx.branch_id, current_user.id, [row.model_dump() for row in req.rows], req.approval_reason)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))