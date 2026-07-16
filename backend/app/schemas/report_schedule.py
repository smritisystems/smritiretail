"""
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-16
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, EmailStr


DeliveryChannel = Literal["EMAIL", "WHATSAPP", "SMS"]
DeliveryFormat  = Literal["PDF", "Excel", "CSV"]
Frequency       = Literal["DAILY", "WEEKLY", "MONTHLY"]


class ReportScheduleCreate(BaseModel):
    report_id        : str             = Field(..., description="Report catalog ID, e.g. RPT-SAL-001")
    report_name      : str             = Field(..., description="Human-readable report name")
    frequency        : Frequency       = Field(..., description="DAILY | WEEKLY | MONTHLY")
    execution_time   : Optional[str]   = Field(default="08:00", description="HH:MM execution time")
    delivery_channel : DeliveryChannel = Field(..., description="EMAIL | WHATSAPP | SMS")
    delivery_target  : str             = Field(..., description="Email address or phone number")
    delivery_format  : DeliveryFormat  = Field(default="PDF", description="PDF | Excel | CSV")

    model_config = {"from_attributes": True}


class ReportScheduleResponse(BaseModel):
    id               : str
    report_id        : str
    report_name      : str
    frequency        : str
    execution_time   : Optional[str]
    cron_expression  : Optional[str]
    delivery_channel : str
    delivery_target  : str
    delivery_format  : str
    is_active        : bool
    company_id       : Optional[str]
    branch_id        : Optional[str]
    created_at       : Optional[datetime]
    created_by_id    : Optional[str]

    model_config = {"from_attributes": True}
