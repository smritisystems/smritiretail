"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version      : 3.16.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class TrainingSessionModel(Base):
    __tablename__ = "training_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    trainee_name = Column(String(255), nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    current_day = Column(Integer, default=1, nullable=False)
    level = Column(String(100), default="Level 1 — Retail Operator", nullable=False)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class TrainingProgressModel(Base):
    __tablename__ = "training_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(64), nullable=False, index=True)
    day = Column(Integer, nullable=False)
    step = Column(String(50), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)

class TrainingCertificateModel(Base):
    __tablename__ = "training_certificates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    certificate_id = Column(String(64), unique=True, nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    trainee_name = Column(String(255), nullable=False)
    certification_level = Column(String(100), nullable=False)
    score_percentage = Column(Float, nullable=False)
    certificate_hash = Column(String(128), nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_valid = Column(Boolean, default=True, nullable=False)
