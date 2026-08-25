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
from ...services.payments_engine import PaymentsEngine
from ...schemas.payments import (
    ProcessPaymentRequest,
    MultiTenderPaymentResponse,
    PaymentTransactionResponse,
    PaymentRefundRequest,
    PaymentRefundResponse,
    PaymentAllocationRequest,
    PaymentAllocationDetail,
    PaymentReceiptResponse,
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


@router.post("/process", response_model=MultiTenderPaymentResponse, status_code=status.HTTP_201_CREATED, summary="Process Multi-Tender Payment")
async def process_payment(
    req: ProcessPaymentRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Processes a single or split multi-tender payment settlement with idempotency gating."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await PaymentsEngine.process_payment(
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


@router.post("/refund", response_model=PaymentRefundResponse, status_code=status.HTTP_201_CREATED, summary="Process Payment Refund")
async def process_refund(
    req: PaymentRefundRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Processes a full or partial refund against a payment transaction with balance checks."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await PaymentsEngine.process_refund(
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


@router.post("/{payment_id}/allocate", response_model=PaymentAllocationDetail, status_code=status.HTTP_201_CREATED, summary="Allocate Payment to Invoice")
async def allocate_payment(
    payment_id: str,
    req: PaymentAllocationRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Distributes unallocated payment balance across an invoice."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await PaymentsEngine.allocate_payment(
            session=db,
            company_id=company_id,
            payment_id=payment_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/receipt/{reference_doc_id}", response_model=PaymentReceiptResponse, summary="Get Payment Receipt")
async def get_payment_receipt(
    reference_doc_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Generates an official payment receipt with tender breakdown and allocation details."""
    try:
        company_id, _ = _extract_user_info(current_user)
        return await PaymentsEngine.generate_payment_receipt(
            session=db,
            company_id=company_id,
            reference_doc_id=reference_doc_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions", response_model=List[PaymentTransactionResponse], summary="Query Payment Transactions")
async def query_payment_transactions(
    party_id: Optional[str] = Query(None),
    reference_doc_id: Optional[str] = Query(None),
    tender_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Queries transaction ledger with multi-field filtering."""
    company_id, _ = _extract_user_info(current_user)
    return await PaymentsEngine.query_transactions(
        session=db,
        company_id=company_id,
        party_id=party_id,
        reference_doc_id=reference_doc_id,
        tender_type=tender_type,
        status=status,
        limit=limit,
    )
