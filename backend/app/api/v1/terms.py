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

import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...schemas.terms import (
    TermsClauseCreate, TermsClauseUpdate, TermsClauseResponse,
    TermsDefaultCreate, TermsDefaultResponse, TermsResolveRequest, TermsResolveResponse,
    TermsSnapshotCreate, TermsSnapshotResponse, ApprovalWorkflowLogResponse
)
from ...services.terms import TermsService

router = APIRouter()


@router.get(
    "/clauses",
    response_model=List[TermsClauseResponse],
)
async def list_clauses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all legal terms clauses in the library.
    """
    service = TermsService(db)
    clauses = await service.list_clauses()
    res = []
    for c in clauses:
        res.append(TermsClauseResponse(
            id=c.id,
            title=c.title,
            category=c.category,
            content=c.content,
            code=c.code,
            isActive=c.is_active,
            version=c.version or 1,
            lastUpdated=c.modified_at.isoformat(),
            updatedBy=c.updated_by,
            status=c.status,
            language=c.language
        ))
    return res


@router.post(
    "/clauses",
    response_model=TermsClauseResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_clause(
    req: TermsClauseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new legal clause draft or approved term.
    """
    service = TermsService(db)
    c = await service.create_clause(req, current_user.username)
    return TermsClauseResponse(
        id=c.id,
        title=c.title,
        category=c.category,
        content=c.content,
        code=c.code,
        isActive=c.is_active,
        version=c.version or 1,
        lastUpdated=c.modified_at.isoformat(),
        updatedBy=c.updated_by,
        status=c.status,
        language=c.language
    )


@router.put(
    "/clauses/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_clause(
    id: str,
    req: TermsClauseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update or submit revision of a terms clause.
    """
    service = TermsService(db)
    res = await service.update_clause(id, req, current_user.username)
    if "clause" in res:
        c = res["clause"]
        return {
            "success": True,
            "clause": TermsClauseResponse(
                id=c.id,
                title=c.title,
                category=c.category,
                content=c.content,
                code=c.code,
                isActive=c.is_active,
                version=c.version or 1,
                lastUpdated=c.modified_at.isoformat(),
                updatedBy=c.updated_by,
                status=c.status,
                language=c.language
            )
        }
    return res


@router.delete(
    "/clauses/{id}",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def delete_clause(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a terms clause from library.
    """
    service = TermsService(db)
    await service.delete_clause(id, current_user.username)
    return {"success": True}


@router.post(
    "/clauses/{id}/approve",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def approve_clause(
    id: str,
    comments: dict = Body({"comments": ""}),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve clause revision and merge proposed changes.
    """
    service = TermsService(db)
    cmt = comments.get("comments", "")
    c = await service.approve_clause(id, cmt, current_user.username)
    return {
        "success": True,
        "clause": TermsClauseResponse(
            id=c.id,
            title=c.title,
            category=c.category,
            content=c.content,
            code=c.code,
            isActive=c.is_active,
            version=c.version or 1,
            lastUpdated=c.modified_at.isoformat(),
            updatedBy=c.updated_by,
            status=c.status,
            language=c.language
        )
    }


@router.post(
    "/clauses/{id}/reject",
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def reject_clause(
    id: str,
    comments: dict = Body({"comments": ""}),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject proposed clause revision.
    """
    service = TermsService(db)
    cmt = comments.get("comments", "")
    c = await service.reject_clause(id, cmt, current_user.username)
    return {
        "success": True,
        "clause": TermsClauseResponse(
            id=c.id,
            title=c.title,
            category=c.category,
            content=c.content,
            code=c.code,
            isActive=c.is_active,
            version=c.version or 1,
            lastUpdated=c.modified_at.isoformat(),
            updatedBy=c.updated_by,
            status=c.status,
            language=c.language
        )
    }


@router.get(
    "/defaults",
    response_model=List[TermsDefaultResponse],
)
async def list_defaults(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all level defaults configuration records.
    """
    service = TermsService(db)
    defaults = await service.list_defaults()
    res = []
    for d in defaults:
        res.append(TermsDefaultResponse(
            id=d.id,
            level=d.level,
            refId=d.ref_id,
            clauseIds=json.loads(d.clause_ids) if d.clause_ids else [],
            isActive=d.is_active,
            lastUpdated=d.modified_at.isoformat(),
            updatedBy=d.updated_by
        ))
    return res


@router.post(
    "/defaults",
    response_model=TermsDefaultResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def save_default(
    req: TermsDefaultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Map default clause sequences toCompany/Branch/Document/Party levels.
    """
    service = TermsService(db)
    d = await service.save_default(req, current_user.username)
    return TermsDefaultResponse(
        id=d.id,
        level=d.level,
        refId=d.ref_id,
        clauseIds=json.loads(d.clause_ids) if d.clause_ids else [],
        isActive=d.is_active,
        lastUpdated=d.modified_at.isoformat(),
        updatedBy=d.updated_by
    )


@router.post(
    "/resolve",
    response_model=TermsResolveResponse,
)
async def resolve_terms(
    req: TermsResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolve legal terms sequences inheriting configs across all levels.
    """
    service = TermsService(db)
    return await service.resolve_terms(req)


@router.get(
    "/snapshots",
    response_model=List[TermsSnapshotResponse],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_snapshots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all generated document terms snapshots.
    """
    service = TermsService(db)
    snaps = await service.list_snapshots()
    res = []
    for s in snaps:
        res.append(TermsSnapshotResponse(
            id=s.id,
            documentType=s.document_type,
            documentNo=s.document_no,
            snapshotAt=s.snapshot_at.isoformat(),
            clausesSnapshot=json.loads(s.clauses_snapshot) if s.clauses_snapshot else []
        ))
    return res


@router.get(
    "/snapshots/{doc_type}/{doc_no}",
    response_model=TermsSnapshotResponse,
)
async def get_snapshot(
    doc_type: str,
    doc_no: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch resolved terms snapshot for a specific document.
    """
    service = TermsService(db)
    s = await service.get_snapshot(doc_type, doc_no)
    return TermsSnapshotResponse(
        id=s.id,
        documentType=s.document_type,
        documentNo=s.document_no,
        snapshotAt=s.snapshot_at.isoformat(),
        clausesSnapshot=json.loads(s.clauses_snapshot) if s.clauses_snapshot else []
    )


@router.post(
    "/snapshots",
    response_model=TermsSnapshotResponse,
    status_code=201,
)
async def save_snapshot(
    req: TermsSnapshotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save resolved terms snapshot for a newly generated document.
    """
    service = TermsService(db)
    s = await service.save_snapshot(req.documentType, req.documentNo, req.clauses)
    return TermsSnapshotResponse(
        id=s.id,
        documentType=s.document_type,
        documentNo=s.document_no,
        snapshotAt=s.snapshot_at.isoformat(),
        clausesSnapshot=json.loads(s.clauses_snapshot) if s.clauses_snapshot else []
    )


@router.get(
    "/logs",
    response_model=List[ApprovalWorkflowLogResponse],
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def list_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch terms clause approval workflow logs.
    """
    service = TermsService(db)
    logs = await service.list_logs()
    res = []
    for l in logs:
        res.append(ApprovalWorkflowLogResponse(
            id=l.id,
            clauseId=l.clause_id,
            title=l.title,
            version=l.version or 1,
            submittedBy=l.submitted_by,
            submittedAt=l.submitted_at.isoformat() if l.submitted_at else "",
            status=l.status,
            approvedBy=l.approved_by,
            approvedAt=l.approved_at.isoformat() if l.approved_at else "",
            proposedChanges=json.loads(l.proposed_changes) if l.proposed_changes else None,
            comments=l.comments
        ))
    return res
