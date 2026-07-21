"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 24.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Pharma Engine
"""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class PrescriptionValidateRequest(BaseModel):
    patient_name: str
    doctor_name: str
    doctor_registration_no: str
    schedule_type: str = "SCHEDULE_H"
    udms_document_id: Optional[str] = None


class PrescriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    patient_name: str
    doctor_name: str
    doctor_registration_no: str
    schedule_type: str
    is_valid: bool


class SaltSearchResponse(BaseModel):
    active_salt_name: str
    matches_found: int
    substitutes: List[dict]
