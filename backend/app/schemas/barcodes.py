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

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# BARCODE GENERATION & VALIDATION SCHEMAS
# ============================================================================

class BarcodeGenerateRequest(BaseModel):
    symbology: str = Field("EAN13", description="EAN13, UPC_A, CODE128, QR_CODE, CODE39, ITF14")
    seed_digits: Optional[str] = Field(None, description="12 digits for EAN13, 11 digits for UPC_A, or custom string for CODE128")
    prefix: Optional[str] = "890"  # 890 is India GS1 country code prefix


class BarcodeGenerateResponse(BaseModel):
    barcode_value: str
    symbology: str
    is_checksum_valid: bool
    formatted_display: str


class BarcodeValidateRequest(BaseModel):
    barcode: str
    symbology: str = Field("EAN13", description="EAN13, UPC_A, CODE128, QR_CODE, CODE39, ITF14")


class BarcodeValidateResponse(BaseModel):
    barcode: str
    symbology: str
    is_valid: bool
    check_digit: Optional[str] = None
    validation_message: str


# ============================================================================
# THERMAL LABEL COMPILATION & DISPATCH SCHEMAS
# ============================================================================

class LabelCompileRequest(BaseModel):
    printer_language: str = Field("ZPL", description="ZPL, TSPL, ESC_POS")
    dpi: int = Field(203, description="203, 300, 600")
    width_mm: float = 50.0
    height_mm: float = 25.0
    item_code: str
    item_name: str
    barcode: str
    mrp: Decimal
    selling_price: Decimal
    size: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = "SMRITI"
    hsn_code: Optional[str] = None


class LabelCompileResponse(BaseModel):
    printer_language: str
    dpi: int
    compiled_command_stream: str
    byte_count: int


class BatchLabelItem(BaseModel):
    item_code: str
    item_name: str
    barcode: str
    mrp: Decimal
    selling_price: Decimal
    quantity: int = Field(1, ge=1, le=1000)
    size: Optional[str] = None
    color: Optional[str] = None
    brand: Optional[str] = "SMRITI"


class BatchLabelPrintRequest(BaseModel):
    printer_language: str = Field("ZPL", description="ZPL, TSPL, ESC_POS")
    dpi: int = 203
    width_mm: float = 50.0
    height_mm: float = 25.0
    items: List[BatchLabelItem] = Field(..., min_length=1)
    target_printer_ip: Optional[str] = None


class BatchLabelPrintResponse(BaseModel):
    batch_id: str
    total_labels_spooled: int
    printer_language: str
    status: str
    dispatched_at: datetime


class PrintHistoryQueryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user: str
    item_code: str
    item_name: str
    barcode: str
    quantity: int
    status: str
    error_message: Optional[str] = None
