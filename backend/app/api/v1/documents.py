"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.documents_engine import DocumentsEngine
from ...schemas.documents import (
    DocumentSeriesCreateRequest,
    DocumentSeriesResponse,
    SequenceAllocateRequest,
    SequenceAllocateResponse,
    DocumentTemplateCreateRequest,
    DocumentTemplateResponse,
    DocumentRenderRequest,
    DocumentRenderResponse,
    DocumentPrintJobRequest,
    DocumentPrintJobResponse,
    DocumentLifecycleUpdateRequest,
    DocumentLifecycleStatusResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


# ============================================================================
# NUMBERING ENDPOINTS
# ============================================================================

@router.post("/numbering/series", response_model=DocumentSeriesResponse, status_code=status.HTTP_201_CREATED, summary="Create Numbering Series")
async def create_document_series(
    req: DocumentSeriesCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a document numbering series configuration."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        series = await DocumentsEngine.create_document_series(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
        return DocumentSeriesResponse(
            id=series.id,
            name=series.name,
            document_type=series.document_type,
            module=series.module,
            prefix=series.prefix or "",
            suffix=series.suffix or "",
            running_length=series.running_length or 4,
            reset_rule=series.reset_rule or "Financial Year",
            current_number=series.current_number or 0,
            financial_year=series.financial_year,
            company_code=series.company_code,
            mode=series.mode or "Auto",
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/numbering/allocate", response_model=SequenceAllocateResponse, status_code=status.HTTP_201_CREATED, summary="Allocate Next Sequential Number")
async def allocate_next_number(
    req: SequenceAllocateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Allocates the next document sequence number using row-level locking."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await DocumentsEngine.allocate_next_number(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TEMPLATE & RENDERING ENDPOINTS
# ============================================================================

@router.post("/templates", response_model=DocumentTemplateResponse, status_code=status.HTTP_201_CREATED, summary="Create Document Template")
async def create_document_template(
    req: DocumentTemplateCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a versioned layout configuration template with SHA256 integrity hash."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await DocumentsEngine.create_template(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/render", response_model=DocumentRenderResponse, summary="Render Document Artifact")
async def render_document(
    req: DocumentRenderRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Renders document output, generates cryptographic hash, and records document artifact."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await DocumentsEngine.render_document(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PRINT & LIFECYCLE ENDPOINTS
# ============================================================================

@router.post("/print", response_model=DocumentPrintJobResponse, summary="Dispatch Document Print Job")
async def dispatch_print_job(
    req: DocumentPrintJobRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Dispatches print job, increments reprint counter, and attaches legal watermark."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await DocumentsEngine.dispatch_print_job(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lifecycle", response_model=DocumentLifecycleStatusResponse, summary="Validate & Transition Document Lifecycle")
async def update_document_lifecycle(
    req: DocumentLifecycleUpdateRequest,
    current_state: str = Query("DRAFT", description="Current state of the document"),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Validates and executes a state transition along the canonical document lifecycle graph."""
    try:
        company_id, _ = _extract_user_info(current_user)
        return await DocumentsEngine.update_lifecycle_state(
            session=db,
            company_id=company_id,
            current_state=current_state,
            req=req,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
