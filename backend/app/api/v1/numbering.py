"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...schemas.numbering import (
    DocumentSeriesCreate, DocumentSeriesUpdate, DocumentSeriesResponse,
    NumberingAuditLogResponse, AllocationRequest
)
from ...services.numbering import NumberingService

router = APIRouter()


@router.get(
    "/series",
    response_model=List[DocumentSeriesResponse],
)
async def list_series(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all active document series configuration parameters.
    """
    service = NumberingService(db)
    return await service.list_series()


@router.post(
    "/series",
    response_model=DocumentSeriesResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_series(
    req: DocumentSeriesCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new document series sequence scheme.
    """
    service = NumberingService(db)
    return await service.create_series(req, current_user.username)


@router.put(
    "/series/{id}",
    response_model=DocumentSeriesResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_series(
    id: str,
    req: DocumentSeriesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update document series sequence properties.
    """
    service = NumberingService(db)
    return await service.update_series(id, req, current_user.username)


@router.delete(
    "/series/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_series(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft-retire/Deactivate document series sequence configuration.
    """
    service = NumberingService(db)
    await service.delete_series(id, current_user.username)
    return {"success": True, "message": f"Series retired/deactivated."}


@router.get(
    "/logs",
    response_model=List[NumberingAuditLogResponse],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch number sequence allocation and adjustments history logs.
    """
    service = NumberingService(db)
    return await service.list_audit_logs()


from typing import Optional
from fastapi import Header

@router.post(
    "/series/{id}/allocate",
)
async def allocate_number(
    id: str,
    req: AllocationRequest,
    db: AsyncSession = Depends(get_db),
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key"),
    authorization: Optional[str] = Header(None),
):
    """
    Atomically allocate next serial sequence document number.
    """
    from ...core.config import settings
    username = "System"

    if x_internal_service_key and x_internal_service_key == settings.INTERNAL_SERVICE_KEY:
        # Internal service request authorized
        pass
    else:
        # Fall back to standard access token auth
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="A valid access token or internal service key is required."
            )
        token = authorization.split(" ")[1]
        # Avoid circular imports
        from ...api.deps import get_current_user
        current_user = await get_current_user(token=token, db=db)
        username = current_user.username

    service = NumberingService(db)
    doc_no = await service.allocate_voucher_number(
        series_id=id,
        branch=req.branch or "HQ",
        fy=req.fy or "26-27",
        username=username
    )
    return {"success": True, "documentNo": doc_no}
