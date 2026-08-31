"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.72.0
Created      : 2026-07-16
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid as uuid_pkg
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import BaseEntity


class ReportSchedule(BaseEntity):
    """
    Automated Scheduled Reports Master.
    Stores report automation schedule metadata per tenant with multi-channel distribution.
    """
    __tablename__ = "report_schedules"

    schedule_name = Column(String(150), nullable=False, index=True)
    report_code = Column(String(50), nullable=False, index=True)  # e.g., 'RPT-SAL-001', 'RPT-TAX-006'
    
    # Backward-compatible fields
    report_id = Column(String(50), nullable=True)
    report_name = Column(String(200), nullable=True)
    frequency = Column(String(20), nullable=True)   # DAILY / WEEKLY / MONTHLY
    execution_time = Column(String(10), nullable=True)    # "08:00"
    delivery_channel = Column(String(20), nullable=True)   # EMAIL / WHATSAPP / SMS
    delivery_target = Column(String(200), nullable=True)   # email or phone
    delivery_format = Column(String(20), nullable=True, default="XLSX")  # XLSX, PDF, CSV, JSON
    
    cron_expression = Column(String(50), nullable=False, default="0 21 * * *")
    export_format = Column(String(20), nullable=False, default="XLSX")  # XLSX, PDF, CSV, JSON
    
    # Target delivery channels: ["EMAIL", "WHATSAPP", "STATUTORY_VAULT"]
    channels = Column(JSONB, server_default=text("'[]'"), default=list)
    
    # Detailed recipient config:
    # { "emails": ["audit@tattly.com"], "phone_numbers": ["+919876543210"], "vault_folder": "/statutory/2026" }
    recipients = Column(JSONB, server_default=text("'{}'"), default=dict)
    
    # Runtime filter overrides (e.g. {"date_range": "TODAY", "branch_id": "BR-MAIN-001"})
    filter_overrides = Column(JSONB, server_default=text("'{}'"), default=dict)
    
    is_active = Column(Boolean, default=True, index=True)
    status = Column(String(30), default="IDLE", index=True)  # IDLE, RUNNING, COMPLETED, FAILED
    
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_execution_latency_ms = Column(Integer, nullable=True)
    last_status_message = Column(Text, nullable=True)
    created_by_id = Column(String(100), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    dispatch_logs = relationship(
        "ReportDispatchLog",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="desc(ReportDispatchLog.created_at)"
    )


class ReportDispatchLog(BaseEntity):
    """
    Tamper-evident Forensic Audit Trail for Scheduled Report Dispatches.
    Records delivery statuses, SHA-256 integrity digests, and channel latency metrics.
    """
    __tablename__ = "report_dispatch_logs"

    schedule_id = Column(String(50), ForeignKey("report_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    report_code = Column(String(50), nullable=False, index=True)
    dispatch_channel = Column(String(30), nullable=False)  # EMAIL, WHATSAPP, STATUTORY_VAULT
    recipient_target = Column(String(255), nullable=False)  # target email, phone, or file path
    export_format = Column(String(20), nullable=False)     # XLSX, PDF, CSV, JSON
    
    payload_size_bytes = Column(Integer, default=0)
    execution_time_ms = Column(Integer, default=0)
    status = Column(String(30), nullable=False, default="PENDING")  # DELIVERED, FAILED, PENDING
    error_message = Column(Text, nullable=True)
    
    # Cryptographic integrity sealing token
    forensic_envelope_hash = Column(String(64), nullable=True, index=True)
    delivery_metadata = Column(JSONB, server_default=text("'{}'"), default=dict)

    schedule = relationship("ReportSchedule", back_populates="dispatch_logs")
