"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
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
    NumberingAuditLogResponse, AllocationRequest,
    BillPrefixResolveRequest, BillPrefixResolveResponse,
    BillPrefixBatchSaveRequest, YearEndRolloverRequest, YearEndRolloverResponse
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


# =========================================================================
# Shoper 9 Bill Prefix Endpoints
# =========================================================================

@router.get(
    "/bill-prefixes",
    response_model=List[DocumentSeriesResponse],
)
async def list_bill_prefixes(
    transaction_group: Optional[str] = None,
    terminal_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List bill prefixes with optional group, terminal, and branch filters.
    """
    service = NumberingService(db)
    return await service.list_bill_prefixes(
        company_id=getattr(current_user, "company_id", None),
        branch_id=branch_id,
        transaction_group=transaction_group,
        terminal_id=terminal_id
    )


@router.post(
    "/bill-prefixes/resolve",
    response_model=BillPrefixResolveResponse,
)
async def resolve_bill_prefix(
    req: BillPrefixResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolves the active Bill Prefix, sequence preview, and statutory GST Rule 46(b) validation
    for a POS terminal counter before transaction creation.
    """
    service = NumberingService(db)
    return await service.resolve_bill_prefix(
        company_id=getattr(current_user, "company_id", None),
        branch_id=req.branchId,
        terminal_id=req.terminalId or "COMMON",
        transaction_type=req.transactionType,
        bill_type=req.billType or "Product"
    )


@router.post(
    "/bill-prefixes/save-batch",
    response_model=List[DocumentSeriesResponse],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def save_bill_prefixes_batch(
    req: BillPrefixBatchSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Batch save or update document prefix schemes from the Prefix Management window.
    Enforces GST Rule 46(b) validation on each prefix scheme.
    """
    service = NumberingService(db)
    return await service.save_bill_prefixes_batch(
        company_id=getattr(current_user, "company_id", None),
        branch_id=req.branchId,
        req=req,
        operator=current_user.username
    )


@router.post(
    "/year-end-rollover",
    response_model=YearEndRolloverResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def execute_year_end_rollover(
    req: YearEndRolloverRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Supervisory Year End Process:
    Increments financial year suffix across all active document series,
    resets starting document numbers, and logs immutable audit trail.
    """
    service = NumberingService(db)
    return await service.execute_year_end_rollover(
        company_id=getattr(current_user, "company_id", None),
        req=req,
        operator=current_user.username
    )


@router.get(
    "/terminal-prefixes-report",
    dependencies=[Depends(require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def get_terminal_prefixes_report(
    terminal_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Terminal Prefix Listing report: detailed breakdown of bill prefixes defined per terminal node.
    """
    service = NumberingService(db)
    series_list = await service.list_bill_prefixes(
        company_id=getattr(current_user, "company_id", None),
        branch_id=branch_id,
        terminal_id=terminal_id
    )
    rows = []
    for s in series_list:
        pfx = s.prefix or ""
        sfx = s.suffix or ""
        next_n = (s.current_number or (s.start_number - 1)) + 1
        fmt = str(next_n).zfill(s.running_length or 4)
        preview = service._assemble_doc_no(
            pfx, fmt, sfx,
            s.financial_year,
            getattr(s, "number_format", None)
        )
        gst_eval = service.validate_gst_rule_46b(pfx, fmt, sfx)
        rows.append({
            "seriesId": s.id,
            "name": s.name,
            "terminalId": s.terminal_id or "COMMON",
            "isCommonAcrossTerminals": s.is_common_across_terminals if s.is_common_across_terminals is not None else True,
            "documentType": s.document_type,
            "transactionGroup": s.transaction_group or "SALES",
            "prefix": pfx,
            "suffix": sfx,
            "startNumber": s.start_number or 1,
            "currentNumber": s.current_number or 0,
            "nextDocumentNo": next_n,
            "preview": preview,
            "runningLength": s.running_length or 4,
            "financialYear": s.financial_year or "2026-2027",
            "isActive": s.is_active,
            "gstRule46bValid": gst_eval["isValid"],
            "gstRule46bLength": gst_eval["length"],
            "numberFormat": getattr(s, "number_format", None) or "PREFIX_NUM_SUFFIX",
        })
    return {"success": True, "count": len(rows), "items": rows}

