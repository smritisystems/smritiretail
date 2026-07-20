"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.2.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.auth import User
from app.services.screen_studio_service import ScreenStudioService

router = APIRouter(prefix="/screen-studio", tags=["SMRITI Screen Studio Metadata Engine"])


@router.post(
    "/templates/save",
    summary="Save Screen Studio Layout Template",
    description="Saves or updates custom field layout, drag-and-drop column order, and primary button limits."
)
async def save_screen_template(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    screen_id = payload.get("screen_id", "pos")
    template_name = payload.get("template_name", "Default Layout")
    industry_pack = payload.get("industry_pack", "GENERAL_RETAIL")
    max_buttons = int(payload.get("max_primary_buttons", 7))
    fields = payload.get("fields_config", [])
    buttons = payload.get("buttons_config", [])
    is_default = bool(payload.get("is_default", False))
    description = payload.get("description")

    svc = ScreenStudioService(db)
    tpl = await svc.save_layout_template(
        screen_id=screen_id,
        template_name=template_name,
        industry_pack=industry_pack,
        max_primary_buttons=max_buttons,
        fields_config=fields,
        buttons_config=buttons,
        is_default=is_default,
        description=description,
    )
    return {
        "success": True,
        "template_id": str(tpl.id),
        "screen_id": tpl.screen_id,
        "template_name": tpl.template_name,
        "industry_pack": tpl.industry_pack,
        "max_primary_buttons": tpl.max_primary_buttons,
    }


@router.get(
    "/templates/list",
    summary="List Screen Studio Templates",
    description="Retrieves available layout metadata templates filtered by screen ID or industry pack."
)
async def list_screen_templates(
    screen_id: Optional[str] = Query(None),
    industry_pack: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ScreenStudioService(db)
    templates = await svc.list_layout_templates(screen_id=screen_id, industry_pack=industry_pack)
    return {
        "count": len(templates),
        "templates": [
            {
                "id": str(t.id),
                "screen_id": t.screen_id,
                "template_name": t.template_name,
                "industry_pack": t.industry_pack,
                "max_primary_buttons": t.max_primary_buttons,
                "fields_config": t.fields_config,
                "buttons_config": t.buttons_config,
                "is_default": t.is_default,
            }
            for t in templates
        ],
    }
