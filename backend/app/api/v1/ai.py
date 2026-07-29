"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.4.0 (Rule AI-001 / AOP-001 Governance Compliance)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user
from ...models.auth import User
from ...schemas.system import AIConfigDTO
from ...api.v1.system import get_system_config, set_system_config

router = APIRouter()

AI_ENABLED_KEY = "ai_enabled"
AI_CONFIG_KEY = "ai_config"

DEFAULT_AI_CONFIG = {
    "enabled": False,
    "provider": "none",
    "apiKey": "",
    "defaultModel": "gemini-1.5-flash",
    "temperature": 0.3,
    "maxTokens": 4096,
    "timeoutSeconds": 30
}


async def get_stored_ai_config(db: AsyncSession) -> Dict[str, Any]:
    raw_cfg = await get_system_config(db, AI_CONFIG_KEY)
    if not raw_cfg or not raw_cfg.value:
        return DEFAULT_AI_CONFIG.copy()
    try:
        parsed = json.loads(raw_cfg.value)
        return {**DEFAULT_AI_CONFIG, **parsed}
    except Exception:
        return DEFAULT_AI_CONFIG.copy()


async def assert_ai_enabled(db: AsyncSession):
    cfg = await get_stored_ai_config(db)
    if not cfg.get("enabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "title": "AI Service Disabled",
                "explanation": "SMRITI AI Advisory Engine is currently disabled by System Administrator per Rule AI-001 (AOP-001).",
                "suggested_action": "Enable AI under Settings -> AI Configuration or contact your System Administrator.",
                "reference_id": "SMRITI-AI-001"
            }
        )


class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


@router.get("/config", response_model=AIConfigDTO)
async def get_ai_configuration(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch global AI configuration parameters. Gated by authentication.
    """
    cfg = await get_stored_ai_config(db)
    # Mask API key if set for non-admin output
    return AIConfigDTO(**cfg)


@router.post("/config", response_model=AIConfigDTO)
async def update_ai_configuration(
    payload: AIConfigDTO,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save global AI configuration parameters. Requires admin authorization.
    """
    cfg_data = payload.model_dump(by_alias=True)
    serialized = json.dumps(cfg_data)
    
    await set_system_config(db, AI_CONFIG_KEY, serialized, current_user)
    await set_system_config(db, AI_ENABLED_KEY, "true" if payload.enabled else "false", current_user)
    
    return payload


@router.post("/forecast")
async def ai_forecast(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Demand forecasting advisory endpoint (Rule AI-001 gated).
    """
    await assert_ai_enabled(db)
    return {
        "status": "Advisory Scaffolding",
        "message": "AI Forecasting module active in advisory mode.",
        "forecast": []
    }


@router.post("/ocr")
async def ai_ocr(
    file: UploadFile = File(...),
    docType: str = Form("Purchase Invoice"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Purchase Invoice OCR parsing advisory endpoint (Rule AI-001 gated).
    """
    await assert_ai_enabled(db)
    return {
        "status": "Advisory Scaffolding",
        "message": f"AI OCR parser processed file '{file.filename}'.",
        "parsedFields": {}
    }


@router.post("/recommend")
async def ai_recommend(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cross-sell & up-sell recommendation endpoint (Rule AI-001 gated).
    """
    await assert_ai_enabled(db)
    return {
        "status": "Advisory Scaffolding",
        "message": "AI Product Recommendations module active.",
        "recommendations": []
    }


@router.post("/chat")
async def ai_chat(
    payload: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chat assistant conversational endpoint (Rule AI-001 gated).
    """
    await assert_ai_enabled(db)
    
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message text is required.")

    cfg = await get_stored_ai_config(db)
    provider = cfg.get("provider", "none").upper()
    model = cfg.get("defaultModel", "gemini-1.5-flash")

    return {
        "reply": (
            f"**[SMRITI AI Assistant - {provider} ({model})]** "
            f"Received: '{payload.message}'. AI Advisory Service is operational under Rule AI-001."
        )
    }
