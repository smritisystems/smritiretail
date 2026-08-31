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

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_company_db, get_current_user
from app.models.auth import User
from app.services.pdt_engine import PDTIntelligenceEngine
from app.schemas.pdt import (
    PDTModelRegisterReq,
    PDTDemandSignalReq,
    PDTSkuTwinUpdateReq,
    PDTPredictionGenerateReq,
    PDTPredictionResponse,
)

router = APIRouter(prefix="/pdt", tags=["Predictive Distribution Twin (PDT)"])


@router.post("/models")
async def register_model(
    req: PDTModelRegisterReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Registers an analytical model version in the predictive catalog."""
    model = await PDTIntelligenceEngine.register_model(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "model_id": model.id,
        "model_code": model.model_code,
        "algorithm": model.algorithm,
        "version": model.version,
    }


@router.post("/demand-signals")
async def record_demand_signal(
    req: PDTDemandSignalReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Records an external or market demand indicator."""
    signal = await PDTIntelligenceEngine.record_demand_signal(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "signal_id": signal.id,
        "signal_code": signal.signal_code,
        "impact_factor": float(signal.impact_factor),
    }


@router.post("/sku-twins")
async def update_sku_twin(
    req: PDTSkuTwinUpdateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Updates digital twin velocity and safety parameters for a SKU."""
    twin = await PDTIntelligenceEngine.update_sku_twin(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "twin_id": twin.id,
        "sku": twin.sku,
        "recommended_safety_stock": float(twin.recommended_safety_stock),
    }


@router.post("/predictions", response_model=PDTPredictionResponse)
async def generate_distribution_prediction(
    req: PDTPredictionGenerateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> PDTPredictionResponse:
    """Generates read-only demand forecasting and replenishment recommendations."""
    res = await PDTIntelligenceEngine.generate_prediction(
        session=session,
        company_id=company_id,
        req=req,
    )
    return res
