"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    ForeignKey,
    Date,
    DateTime,
    JSON,
    text,
)
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class TaxInvoiceTemplate(BaseEntity):
    """
    Governed Tax Invoice print/export template entity.
    Maintains centralized canonical rendering layout configurations.
    """
    __tablename__ = "tax_invoice_templates"

    template_code = Column(String(100), nullable=False, unique=True, index=True)
    template_name = Column(String(255), nullable=False)
    template_type = Column(String(50), nullable=False, default="TAX_INVOICE")
    status = Column(String(50), nullable=False, default="FROZEN")
    current_version = Column(String(50), nullable=False, default="V1")
    effective_from = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    layout_configuration = Column(JSON, nullable=False)
    configuration_hash = Column(String(64), nullable=False)
    is_default = Column(Boolean, default=True)

    # Relationships
    versions = relationship("TaxInvoiceTemplateVersion", back_populates="template", cascade="all, delete-orphan")


class TaxInvoiceTemplateVersion(BaseEntity):
    """
    Immutable version snapshot of a Tax Invoice template configuration.
    FROZEN versions must never be modified in-place to preserve historical invoice auditability.
    """
    __tablename__ = "tax_invoice_template_versions"

    template_id = Column(String(50), ForeignKey("tax_invoice_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="FROZEN")
    layout_configuration = Column(JSON, nullable=False)
    configuration_hash = Column(String(64), nullable=False)
    effective_from = Column(Date, nullable=False)

    # Relationships
    template = relationship("TaxInvoiceTemplate", back_populates="versions")


class InvoiceDocumentArtifact(BaseEntity):
    """
    Persistent document artifact tracking generated Tax Invoice PDFs,
    their cryptographic SHA256 integrity hashes, storage paths, and template linkage.
    """
    __tablename__ = "invoice_document_artifacts"

    invoice_id = Column(String(50), ForeignKey("sales_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_no = Column(String(100), nullable=False, index=True)
    document_type = Column(String(50), nullable=False, default="TAX_INVOICE")
    template_code = Column(String(100), nullable=False, default="TAX_INVOICE_TATTLY_THREADS")
    template_version = Column(String(50), nullable=False, default="V1")
    template_status = Column(String(50), nullable=False, default="FROZEN")
    storage_path = Column(String(500), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, nullable=False, default=1)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP"))
    is_valid = Column(Boolean, default=True)
    reprint_count = Column(Integer, default=0)
    last_reprinted_at = Column(DateTime(timezone=True), nullable=True)
