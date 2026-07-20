"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.48.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Numeric, DateTime, Text, Integer, func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import BaseEntity


class GSTRFilingRecord(BaseEntity):
    """
    Tracks monthly GSTR-1 and GSTR-3B return filing payloads and digital signatures.
    """
    __tablename__ = "gstr_filing_records"

    gstin = Column(String(15), nullable=False, index=True)
    financial_period = Column(String(10), nullable=False, index=True)  # MMYYYY e.g. 072026
    return_type = Column(String(20), nullable=False, index=True)      # GSTR1 | GSTR3B
    
    total_taxable_value = Column(Numeric(14, 2), default=0.0)
    total_igst = Column(Numeric(14, 2), default=0.0)
    total_cgst = Column(Numeric(14, 2), default=0.0)
    total_sgst = Column(Numeric(14, 2), default=0.0)
    total_cess = Column(Numeric(14, 2), default=0.0)
    
    payload_json = Column(JSONB, nullable=False, default=dict)
    digital_signature_hash = Column(String(64), nullable=True)
    verification_mode = Column(String(20), default="DSC")  # DSC | EVC
    arn_number = Column(String(50), nullable=True, index=True)
    
    filing_status = Column(String(30), default="DRAFT", index=True)
    # DRAFT | VALIDATED | SUBMITTED | FILED | REJECTED
    error_details = Column(Text, nullable=True)


class GSTROutboxLog(BaseEntity):
    """
    Outbox log engine tracking GST portal API auto-pull sync and return filing tasks.
    """
    __tablename__ = "gstr_outbox_logs"

    gstin = Column(String(15), nullable=False, index=True)
    action_type = Column(String(50), nullable=False, index=True)  # AUTO_PULL_GSTR2B | SUBMIT_GSTR1 | SUBMIT_GSTR3B
    financial_period = Column(String(10), nullable=False)
    
    request_payload = Column(JSONB, nullable=True)
    response_payload = Column(JSONB, nullable=True)
    
    status = Column(String(30), default="PENDING", index=True)  # PENDING | SUCCESS | FAILED
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
