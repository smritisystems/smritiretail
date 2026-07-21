"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 26.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for NIC GSTN E-Way Bill & E-Invoice Gateway
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text
from app.db.base_class import Base


class EInvoiceIRNRecordModel(Base):
    """NIC E-Invoice IRN Log Model."""
    __tablename__ = "nic_einvoice_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_number = Column(String(50), nullable=False, unique=True, index=True)
    seller_gstin = Column(String(15), nullable=False)
    buyer_gstin = Column(String(15), nullable=False)
    total_invoice_value = Column(Float, nullable=False)
    irn_hash = Column(String(64), nullable=False, unique=True, index=True)
    signed_qr_code = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EWayBillRecordModel(Base):
    """NIC E-Way Bill Log Model."""
    __tablename__ = "nic_ewaybill_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    eway_bill_no = Column(String(20), nullable=False, unique=True, index=True)
    invoice_number = Column(String(50), nullable=False)
    transporter_id = Column(String(15), nullable=False)
    vehicle_number = Column(String(20), nullable=False)
    consignment_value = Column(Float, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
