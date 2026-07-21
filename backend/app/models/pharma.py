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
Classification: Database Models for Pharma & Healthcare Retail Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from app.db.base_class import Base


class ScheduleHPrescriptionModel(Base):
    """Schedule H / H1 Doctor Prescription Log."""
    __tablename__ = "pharma_prescriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_name = Column(String(100), nullable=False)
    doctor_name = Column(String(100), nullable=False)
    doctor_registration_no = Column(String(50), nullable=False, index=True)
    schedule_type = Column(String(20), nullable=False, default="SCHEDULE_H")  # SCHEDULE_H or SCHEDULE_H1
    udms_document_id = Column(String(36), nullable=True)  # Link to UDMS Attachment
    created_at = Column(DateTime, default=datetime.utcnow)


class MedicineSaltMappingModel(Base):
    """Generic Salt Composition Model for Alternative Medicine Search."""
    __tablename__ = "pharma_salt_mappings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    medicine_name = Column(String(100), nullable=False, index=True)
    active_salt_name = Column(String(100), nullable=False, index=True)  # e.g., Paracetamol 500mg
    dosage_form = Column(String(50), nullable=False, default="TABLET")
    manufacturer = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
