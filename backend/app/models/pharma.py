"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 24.0.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Pharma & Healthcare Retail Engine
"""

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, Date
from app.db.base import Base


class PharmaBatchModel(Base):
    """Pharma Product FEFO (First-Expiry-First-Out) Batch Stock Model."""
    __tablename__ = "pharma_batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(50), nullable=False, index=True)
    batch_number = Column(String(50), nullable=False, index=True)
    expiry_date = Column(Date, nullable=False, index=True)  # FEFO sorting key
    mfg_date = Column(Date, nullable=True)
    quantity_available = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    mrp = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    ptr = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))  # Price to Retailer
    drug_license_no = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)



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
