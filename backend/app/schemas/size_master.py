"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.5.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class SizeConversionCreate(BaseModel):
    region_code: str = Field(..., description="Region code e.g. UK, US, EU, JP, CM")
    converted_size_label: str = Field(..., description="Equivalent size label e.g. 42, 9, 27.0")


class SizeConversionResponse(SizeConversionCreate):
    id: str
    size_value_id: str
    model_config = ConfigDict(from_attributes=True)


class SizeValueCreate(BaseModel):
    display_size: str = Field(..., description="Size label e.g. 8, M, 32")
    sort_order: int = Field(0, description="Sort order index")
    conversions: Optional[List[SizeConversionCreate]] = None


class SizeValueResponse(BaseModel):
    id: str
    size_scale_id: str
    display_size: str
    sort_order: int
    conversions: List[SizeConversionResponse] = []
    model_config = ConfigDict(from_attributes=True)


class SizeScaleCreate(BaseModel):
    name: str = Field(..., description="Scale name e.g. Footwear UK/IN Standard")
    code: Optional[str] = None
    scale_type_id: Optional[str] = None
    category_id: Optional[str] = None
    gender_id: Optional[str] = None
    base_region_id: str = "UK"
    description: Optional[str] = None
    size_values: Optional[List[SizeValueCreate]] = None


class SizeScaleUpdate(BaseModel):
    name: Optional[str] = None
    scale_type_id: Optional[str] = None
    category_id: Optional[str] = None
    gender_id: Optional[str] = None
    base_region_id: Optional[str] = None
    description: Optional[str] = None
    size_values: Optional[List[SizeValueCreate]] = None


class SizeScaleResponse(BaseModel):
    id: str
    code: str
    name: str
    scale_type_id: Optional[str] = None
    category_id: Optional[str] = None
    gender_id: Optional[str] = None
    base_region_id: str
    description: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    size_values: List[SizeValueResponse] = []
    model_config = ConfigDict(from_attributes=True)
