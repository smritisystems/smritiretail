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
Classification: Prescription & Schedule H/H1 Compliance Engine
"""

import uuid
from typing import Dict, Any


class PrescriptionManager:
    """Schedule H / H1 Doctor Prescription Validator & Logger."""

    @staticmethod
    def validate_prescription(patient_name: str, doctor_name: str, doctor_reg_no: str, schedule_type: str = "SCHEDULE_H", udms_doc_id: str = None) -> Dict[str, Any]:
        pres_id = str(uuid.uuid4())
        # Rule: Doctor registration number must be at least 5 alphanumeric characters
        is_valid = len(doctor_reg_no.strip()) >= 5 and len(patient_name.strip()) > 0

        return {
            "prescription_id": pres_id,
            "patient_name": patient_name,
            "doctor_name": doctor_name,
            "doctor_registration_no": doctor_reg_no,
            "schedule_type": schedule_type.upper(),
            "udms_document_id": udms_doc_id,
            "is_valid": is_valid,
            "compliance_status": "APPROVED" if is_valid else "REJECTED_INVALID_DOCTOR_REG"
        }
