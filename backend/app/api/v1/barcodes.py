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
from ...services.barcodes_engine import BarcodesEngine
from ...schemas.barcodes import (
    BarcodeGenerateRequest,
    BarcodeGenerateResponse,
    BarcodeValidateRequest,
    BarcodeValidateResponse,
    LabelCompileRequest,
    LabelCompileResponse,
    BatchLabelPrintRequest,
    BatchLabelPrintResponse,
    PrintHistoryQueryResponse,
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
# BARCODE GENERATION & VALIDATION ENDPOINTS
# ============================================================================

@router.post("/generate", response_model=BarcodeGenerateResponse, summary="Generate Checksummed Barcode Value")
async def generate_barcode(
    req: BarcodeGenerateRequest,
    current_user: Any = Depends(get_current_user),
):
    """Generates a valid, checksum-verified barcode value across symbologies (EAN13, UPC_A, CODE128, QR_CODE)."""
    try:
        return BarcodesEngine.generate_barcode_value(req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate", response_model=BarcodeValidateResponse, summary="Validate Barcode Checksum")
async def validate_barcode(
    req: BarcodeValidateRequest,
    current_user: Any = Depends(get_current_user),
):
    """Validates barcode format and check digit integrity."""
    return BarcodesEngine.validate_barcode_checksum(req)


# ============================================================================
# COMPILATION & PRINT ENDPOINTS
# ============================================================================

@router.post("/compile", response_model=LabelCompileResponse, summary="Compile Thermal Label Commands")
async def compile_label(
    req: LabelCompileRequest,
    current_user: Any = Depends(get_current_user),
):
    """Compiles product context into raw printer command streams (ZPL-II, TSPL, ESC/POS) scaled to DPI."""
    try:
        return BarcodesEngine.compile_label_stream(req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/print/batch", response_model=BatchLabelPrintResponse, status_code=status.HTTP_201_CREATED, summary="Dispatch Batch Label Print Job")
async def dispatch_batch_print(
    req: BatchLabelPrintRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Dispatches batch label printing and records immutable PrintHistory audit entries."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await BarcodesEngine.dispatch_batch_print_job(
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


@router.get("/history", response_model=List[PrintHistoryQueryResponse], summary="Query Print History Ledger")
async def get_print_history(
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Fetches recent label print history audit logs."""
    company_id, _ = _extract_user_info(current_user)
    return await BarcodesEngine.query_print_history(db, company_id, limit=limit)
