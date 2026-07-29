"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 25.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Apparel Engine
"""

from typing import Optional, List
from pydantic import BaseModel


class MatrixGridGenerateRequest(BaseModel):
    style_code: str
    colors: List[str]
    sizes: List[str]
    base_mrp: float
    initial_stock_per_variant: int = 10


class MarkdownApplyRequest(BaseModel):
    style_code: str
    inventory_age_days: int


class HangtagRenderResponse(BaseModel):
    style_code: str
    color: str
    size: str
    mrp: float
    barcode: str
    thermal_zpl_payload: str
