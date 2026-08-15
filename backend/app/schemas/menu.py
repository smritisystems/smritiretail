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

from typing import List, Optional
from pydantic import BaseModel, Field

class SmritiMenuBase(BaseModel):
    title: str
    route: Optional[str] = None
    icon: Optional[str] = None
    module: str
    permission: Optional[str] = None
    sequence: int = 0
    parent_id: Optional[str] = None
    feature_flag: Optional[str] = None
    badge: Optional[str] = None
    is_active: bool = True

class SmritiMenuCreate(SmritiMenuBase):
    id: str

class SmritiMenuUpdate(BaseModel):
    title: Optional[str] = None
    route: Optional[str] = None
    icon: Optional[str] = None
    module: Optional[str] = None
    permission: Optional[str] = None
    sequence: Optional[int] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None

class SmritiMenuResponse(SmritiMenuBase):
    id: str
    uuid: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None

    class Config:
        from_attributes = True

class MenuNode(SmritiMenuResponse):
    children: List["MenuNode"] = Field(default_factory=list)

MenuNode.model_rebuild()
