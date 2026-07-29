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

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.screen_studio import ScreenLayoutTemplate

logger = logging.getLogger("smriti.screen_studio_service")


class ScreenStudioService:
    """
    CRUD & Layout Metadata Engine for SMRITI Screen Studio.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_layout_template(
        self,
        screen_id: str,
        template_name: str,
        industry_pack: str = "GENERAL_RETAIL",
        max_primary_buttons: int = 7,
        fields_config: Optional[List[Dict[str, Any]]] = None,
        buttons_config: Optional[List[Dict[str, Any]]] = None,
        is_default: bool = False,
        description: Optional[str] = None,
    ) -> ScreenLayoutTemplate:
        fields = fields_config or []
        buttons = buttons_config or []

        stmt = select(ScreenLayoutTemplate).where(
            ScreenLayoutTemplate.screen_id == screen_id,
            ScreenLayoutTemplate.template_name == template_name,
        )
        res = await self.db.execute(stmt)
        template = res.scalar_one_or_none()

        if not template:
            template = ScreenLayoutTemplate(
                screen_id=screen_id,
                template_name=template_name,
                industry_pack=industry_pack,
                max_primary_buttons=max_primary_buttons,
                fields_config=fields,
                buttons_config=buttons,
                is_default=is_default,
                description=description,
            )
            self.db.add(template)
        else:
            template.industry_pack = industry_pack
            template.max_primary_buttons = max_primary_buttons
            template.fields_config = fields
            template.buttons_config = buttons
            template.is_default = is_default
            template.description = description

        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def list_layout_templates(
        self,
        screen_id: Optional[str] = None,
        industry_pack: Optional[str] = None,
    ) -> List[ScreenLayoutTemplate]:
        stmt = select(ScreenLayoutTemplate).where(ScreenLayoutTemplate.is_active == True)
        if screen_id:
            stmt = stmt.where(ScreenLayoutTemplate.screen_id == screen_id)
        if industry_pack:
            stmt = stmt.where(ScreenLayoutTemplate.industry_pack == industry_pack)
        
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
