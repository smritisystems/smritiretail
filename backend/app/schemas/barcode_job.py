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

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from ..services.barcode_engine.models import PrintItemPayload, LabelTemplate


class PrintJobCreateRequest(BaseModel):
    idempotency_key: Optional[str] = None
    printer_id: str = Field(..., description="Target printer identifier or queue name")
    template_id: str = Field("tattly-threads-footwear-100x50.7", description="Template identifier from registry")
    dpi: int = Field(203, description="Target printer head resolution (e.g. 203, 300, 600)")
    protocol: str = Field("ZPL", description="Target stream protocol: ZPL, DPL, SVG, TSPL")
    items: List[PrintItemPayload] = Field(..., min_items=1, description="List of items with label quantities and attributes")


class PrintJobStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="New status: PRINTING, COMPLETED, FAILED, CANCELLED")
    error_message: Optional[str] = None


class PrintJobAckRequest(BaseModel):
    success: bool = Field(..., description="True if dispatched and printed, False on hardware/spooler error")
    printer_name: Optional[str] = Field(None, description="Reported printer queue name")
    error_message: Optional[str] = Field(None, description="Error message from printer spooler or QZ Tray")


class PrintJobResponse(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    requested_by: str
    printer_id: str
    template_id: str
    template_name: Optional[str] = None
    target_dpi: int
    target_protocol: str
    total_items: int
    total_labels: int
    status: str
    payload_stream: Optional[str] = None
    payload_hash: Optional[str] = None
    svg_preview: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TemplateSummaryResponse(BaseModel):
    id: str
    name: str
    width_mm: float
    height_mm: float
    default_dpi: int
    description: Optional[str] = None
    sample_svg: Optional[str] = None
