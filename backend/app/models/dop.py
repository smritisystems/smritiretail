"""
Project      : SMRITI Retail OS
Module       : DXP Document Experience Platform SQLAlchemy Models
Standard     : SCS-DXP-001 (Universal Document Experience Platform v1.0 — FROZEN)
Author       : Jawahar Ramkripal Mallah
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from sqlalchemy import Column, String, Boolean, Text, Numeric, Integer, ForeignKey
from ..db.base import BaseEntity


class DOPOutputProfile(BaseEntity):
    """Multi-channel output profile mapping physical devices and digital channels."""
    __tablename__ = "dop_output_profiles"

    name             = Column(String(200), nullable=False)
    default_channel  = Column(String(50), nullable=False, default="PRINT") # PRINT, PDF, EMAIL, WHATSAPP
    printer_name     = Column(String(200), nullable=True)
    command_language = Column(String(50), nullable=False, default="ZPL") # ZPL, TSPL, ESC_POS, PDF
    dpi              = Column(Integer, nullable=False, default=203)
    connection_type  = Column(String(50), nullable=False, default="USB")
    auto_print       = Column(Boolean, default=True)
    require_confirm  = Column(Boolean, default=False)


class DOPTemplate(BaseEntity):
    """Versioned metadata-driven document output templates."""
    __tablename__ = "dop_templates"

    title            = Column(String(200), nullable=False)
    template_type    = Column(String(50), nullable=False, default="LABEL")
    version          = Column(Integer, nullable=False, default=1)
    status           = Column(String(30), nullable=False, default="PUBLISHED") # DRAFT, PUBLISHED, ARCHIVED
    label_width_mm   = Column(Numeric(10, 2), nullable=False, default=50.00)
    label_height_mm  = Column(Numeric(10, 2), nullable=False, default=25.00)
    elements_json    = Column(Text, nullable=False)


class DOPOutputHistory(BaseEntity):
    """Multi-channel document output history & audit log."""
    __tablename__ = "dop_output_histories"

    job_id           = Column(String(50), nullable=False, index=True)
    tenant_id        = Column(String(50), nullable=True, index=True)
    company_id       = Column(String(50), nullable=True, index=True)
    branch_id        = Column(String(50), nullable=True, index=True)
    user_id          = Column(String(50), nullable=False, index=True)
    username         = Column(String(100), nullable=False)
    module_name      = Column(String(50), nullable=False, index=True)
    document_ref     = Column(String(100), nullable=False, index=True)
    channel          = Column(String(50), nullable=False, default="PRINT") # PRINT, PREVIEW, DOWNLOAD, EMAIL, WHATSAPP
    template_id      = Column(String(50), ForeignKey("dop_templates.id"), nullable=True)
    template_version = Column(Integer, nullable=False, default=1)
    output_target    = Column(String(200), nullable=False)
    item_count       = Column(Integer, nullable=False, default=1)
    status           = Column(String(30), nullable=False, default="COMPLETED")
    execution_time_ms= Column(Integer, nullable=True)


class DOPRawTemplate(BaseEntity):
    """Raw imported template mapping store (DXP-RTE-001)."""
    __tablename__ = "dop_raw_templates"

    template_name      = Column(String(200), nullable=False)
    printer_language   = Column(String(50), nullable=False, default="ZPL") # ZPL, TSPL, EPL, ESC_POS, RAW
    original_file_name = Column(String(255), nullable=False)
    raw_content        = Column(Text, nullable=False)
    detected_variables = Column(Text, nullable=False) # JSON array of extracted strings
    field_mapping      = Column(Text, nullable=False) # JSON dictionary map
    preview_image      = Column(Text, nullable=True)
    printer_profile_id = Column(String(50), nullable=True)
    company_id         = Column(String(50), nullable=True, index=True)
    branch_id          = Column(String(50), nullable=True, index=True)
    version            = Column(Integer, nullable=False, default=1)
    is_default         = Column(Boolean, default=False)

