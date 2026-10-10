"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.49
Created      : 2026-10-10
Modified     : 2026-10-10
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field


class ElementType(str, Enum):
    TEXT = "text"
    INVERTED_BOX = "inverted_box"
    BOX = "box"
    LINE = "line"
    BARCODE_128 = "barcode_128"
    QR_CODE = "qr_code"
    IMAGE = "image"


class ProtocolType(str, Enum):
    ZPL = "ZPL"
    DPL = "DPL"
    SVG = "SVG"
    TSPL = "TSPL"


class LabelElement(BaseModel):
    id: str
    type: ElementType
    x_mm: float
    y_mm: float
    width_mm: Optional[float] = None
    height_mm: Optional[float] = None
    stroke_width_mm: Optional[float] = 0.3
    font_size_pt: Optional[float] = 10.0
    font_weight: Optional[str] = "normal"  # normal, bold, 900
    font_family: Optional[str] = "Arial"
    rotation_deg: Optional[int] = 0        # 0, 90, 180, 270
    field_binding: Optional[str] = None    # e.g., "item.brand", "item.barcode"
    text_binding: Optional[str] = None     # For inverted box text
    static_text: Optional[str] = None      # Constant string literal
    letter_spacing_pt: Optional[float] = 0.0
    show_hri: Optional[bool] = True        # Human Readable Interpretation for barcodes
    fill_color: Optional[str] = "#000000"
    stroke_color: Optional[str] = "#000000"


class LabelTemplate(BaseModel):
    id: str
    name: str
    width_mm: float
    height_mm: float
    default_dpi: int = 203
    description: Optional[str] = ""
    elements: List[LabelElement] = Field(default_factory=list)


class PrintItemPayload(BaseModel):
    code: Optional[str] = ""
    barcode: Optional[str] = ""
    name: Optional[str] = ""
    brand: Optional[str] = "SMRITI"
    style: Optional[str] = ""
    color: Optional[str] = ""
    size: Optional[str] = ""
    mrp: Optional[float] = 0.0
    price: Optional[float] = 0.0
    selling_price: Optional[float] = None
    cost_price: Optional[float] = 0.0
    qty: int = 1
    category: Optional[str] = "General"
    mfg_date: Optional[str] = "10/26"
    net_contents: Optional[str] = "NET CONTENTS:1 Pair Footwear"
    company_name: Optional[str] = "Tattly Threads"
    company_address: Optional[str] = "81,Umerkhadi,Mumbai,400003"
    company_email: Optional[str] = "care@tattlythreads.com"
    attributes: Dict[str, Any] = Field(default_factory=dict)
