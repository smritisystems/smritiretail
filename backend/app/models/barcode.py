"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Boolean, Text, Numeric, Integer, ForeignKey
from ..db.base import BaseEntity



class BarcodeLayout(BaseEntity):
    """
    Thermal label dimensions and positioned design elements configurations.
    """
    __tablename__ = "barcode_layouts"

    name          = Column(String(200), nullable=False)
    width_mm      = Column(Numeric(10, 2), nullable=False, default=50.00)
    height_mm     = Column(Numeric(10, 2), nullable=False, default=25.00)
    columns       = Column(Integer, default=1)
    is_default    = Column(Boolean, default=False)
    elements_json = Column(Text, nullable=False)  # JSON structure containing elements array


class PrintHistory(BaseEntity):
    """
    Audit log tracking generated and dispatched physical barcode label batches.
    """
    __tablename__ = "print_histories"

    user          = Column(String(100), nullable=False)
    item_code     = Column(String(50), nullable=False)
    item_name     = Column(String(255), nullable=False)
    barcode       = Column(String(100), nullable=False)
    quantity      = Column(Integer, nullable=False, default=1)
    status        = Column(String(50), nullable=False, default="Success")  # Success, Failed
    error_message = Column(Text, nullable=True)


class PrintTemplate(BaseEntity):
    """
    Barcode / Label printing design templates configuration.
    """
    __tablename__ = "print_templates"

    title            = Column(String(200), nullable=False)
    label_size       = Column(String(50), nullable=False)
    printer_language = Column(String(50), nullable=False)
    printer_family   = Column(String(100), nullable=False)
    is_default_size  = Column(Boolean, default=False)
    raw_prn          = Column(Text, nullable=False)
    field_mappings   = Column(Text, nullable=True)  # JSON representation


class PrintProfile(BaseEntity):
    """
    Physical hardware connection properties for barcode label printers.
    """
    __tablename__ = "print_profiles"

    name        = Column(String(200), nullable=False)
    template_id = Column(String(50), ForeignKey("print_templates.id", ondelete="RESTRICT"), nullable=False)
    printer_ip  = Column(String(50), nullable=False)
    printer_port= Column(Integer, default=9100)
    dpi         = Column(Integer, default=203)
    copies      = Column(Integer, default=1)
    label_size  = Column(String(50), default="50x25")
    is_default  = Column(Boolean, default=False)


class BarcodePrintJob(BaseEntity):
    """
    Print job lifecycle entity tracking multi-item label generation, status, and device dispatch.
    """
    __tablename__ = "barcode_print_jobs"

    idempotency_key  = Column(String(128), unique=True, nullable=True, index=True)
    requested_by     = Column(String(100), nullable=False)
    printer_id       = Column(String(128), nullable=False)
    template_id      = Column(String(64), nullable=False)
    target_dpi       = Column(Integer, nullable=False, default=203)
    target_protocol  = Column(String(16), nullable=False, default="ZPL")  # ZPL, DPL, SVG, TSPL, RAW
    total_labels     = Column(Integer, nullable=False, default=1)
    total_items      = Column(Integer, nullable=False, default=1)
    status           = Column(String(32), nullable=False, default="QUEUED", index=True)  # QUEUED, COMPILING, READY, PRINTING, COMPLETED, FAILED, CANCELLED
    error_message    = Column(Text, nullable=True)
    payload_hash     = Column(String(64), nullable=True)
    payload_stream   = Column(Text, nullable=True)
    labels_metadata  = Column(Text, nullable=True)  # JSON summary of items in batch



