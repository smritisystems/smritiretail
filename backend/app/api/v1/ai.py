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

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body

from ...api.deps import get_current_user
from ...models.auth import User

router = APIRouter()


class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


@router.post(
    "/forecast",
)
async def ai_forecast(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """
    Scaffolding for demand forecasting. Under Rule 3, remains mock stub.
    """
    return {
        "status": "Scaffolding Only",
        "message": "AI Forecasting module is offline. Awaiting sufficient transactional Postgres history.",
        "forecast": []
    }


@router.post(
    "/ocr",
)
async def ai_ocr(
    file: UploadFile = File(...),
    docType: str = Form("Purchase Invoice"),
    current_user: User = Depends(get_current_user),
):
    """
    Scaffolding for Purchase Invoice OCR scanning. Under Rule 3, remains mock stub.
    """
    return {
        "status": "Scaffolding Only",
        "message": f"AI OCR parser offline. Uploaded file '{file.filename}' received and logged.",
        "parsedFields": {}
    }


@router.post(
    "/recommend",
)
async def ai_recommend(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
):
    """
    Scaffolding for Cross-sell and up-sell recommendation engine. Under Rule 3, remains mock stub.
    """
    return {
        "status": "Scaffolding Only",
        "message": "AI Product Recommendations module is offline. Awaiting transaction data volume.",
        "recommendations": []
    }


@router.post(
    "/chat",
)
async def ai_chat(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Chat assistant endpoint for dashboard conversational insight.
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message text is required.")

    return {
        "reply": (
            "**[Demo AI Mode]** SMRITI Assistant is running in offline fallback mode. "
            "Your message has been received. Configure `GEMINI_API_KEY` if you need live generative intelligence "
            "from the upstream Gemini service."
        )
    }
