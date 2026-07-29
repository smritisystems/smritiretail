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
Classification: Pharma & Healthcare Retail REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body, Query

from app.core.pharma.prescription_manager import PrescriptionManager
from app.core.pharma.generic_salt_search import GenericSaltSearchEngine
from app.core.pharma.batch_expiry_control import BatchExpiryControlEngine

router = APIRouter(prefix="/pharma", tags=["Domain Release: Pharma & Healthcare Engine (v24.0.0)"])


@router.post("/prescriptions/validate")
async def validate_prescription(patient_name: str = Body(...), doctor_name: str = Body(...), doctor_registration_no: str = Body(...), schedule_type: str = Body("SCHEDULE_H"), udms_document_id: str = Body(None)):
    """Validates doctor registration and logs Schedule H / H1 prescription compliance."""
    return PrescriptionManager.validate_prescription(patient_name, doctor_name, doctor_registration_no, schedule_type, udms_document_id)


@router.get("/salts/search")
async def search_generic_salt_substitutes(active_salt: str = Query("PARACETAMOL")):
    """Searches active generic salt composition and substitute medicines."""
    return GenericSaltSearchEngine.search_substitutes(active_salt)


@router.post("/batches/expiry-check")
async def check_batch_expiry_eligibility(batch_number: str = Body(...), expiry_date: str = Body(...)):
    """Enforces near-expiry (< 30 days) sales lock on pharmaceutical batches."""
    return BatchExpiryControlEngine.evaluate_batch_sale_eligibility(batch_number, expiry_date)
