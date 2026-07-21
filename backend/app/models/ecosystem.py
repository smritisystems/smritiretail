"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for SMRITI Digital Platform Ecosystem
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, Text, JSON
from app.db.base_class import Base


class CustomerLicenseModel(Base):
    """Customer License Entity Model."""
    __tablename__ = "ecosystem_customer_licenses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_name = Column(String(100), nullable=False)
    license_key = Column(String(64), nullable=False, unique=True, index=True)
    edition = Column(String(50), nullable=False, default="ENTERPRISE")  # STARTER, PROFESSIONAL, ENTERPRISE
    max_stores = Column(Integer, nullable=False, default=5)
    max_pos_terminals = Column(Integer, nullable=False, default=20)
    is_active = Column(Boolean, nullable=False, default=True)
    valid_until = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AcademyCourseModel(Base):
    """Learning Academy Course Model."""
    __tablename__ = "ecosystem_academy_courses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    course_code = Column(String(50), nullable=False, unique=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False, default="ONBOARDING")
    duration_minutes = Column(Integer, nullable=False, default=30)
    level = Column(String(30), nullable=False, default="BEGINNER")  # BEGINNER, INTERMEDIATE, ADVANCED
    modules_count = Column(Integer, nullable=False, default=5)
    certification_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
