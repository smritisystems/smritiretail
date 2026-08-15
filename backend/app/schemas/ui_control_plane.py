"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ThemeVariantResponse(BaseModel):
    id: str
    theme_id: str
    variant: str
    primary_color: str
    secondary_color: str
    accent_color: str
    background_color: str
    surface_color: str
    text_primary: str
    text_secondary: str
    border_color: str
    danger_color: str
    success_color: str
    warning_color: str
    is_default: bool

    class Config:
        from_attributes = True


class ThemeResponse(BaseModel):
    id: str
    company_id: str
    theme_name: str
    icon_pack: Optional[str] = None
    font_heading: Optional[str] = None
    font_body: Optional[str] = None
    border_radius_px: Optional[int] = 6
    is_active: bool
    variants: List[ThemeVariantResponse] = []

    class Config:
        from_attributes = True


class WorkspaceProfileResponse(BaseModel):
    id: str
    code: str
    name: str
    persona: str
    default_workspace_id: str
    layout_json: Optional[str] = None
    theme: str
    shortcuts_json: Optional[str] = None
    is_default: bool
    is_active: bool

    class Config:
        from_attributes = True
