"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import date, datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Index, 
    Numeric, String, Text, text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class CustomerArticleMapping(BaseEntity):
    """
    Enterprise Cross-Reference Mapping between Internal SMRITI SKUs and Buyer ERP Catalog Codes.
    
    Governance & Constraints:
    - Unique Buyer Code per Customer: One active buyer article per (company, customer).
    - Unique Variant per Customer: One active variant mapping per (company, customer).
    - Temporal Validity: Governed by effective_from and effective_to.
    - Lifecycle Audit: Tracks source_system, verified_by, and verification_status.
    """
    __tablename__ = "customer_article_mappings"
    __table_args__ = (
        # 1. Forward Uniqueness: A buyer code cannot point to two different internal SKUs for the same customer
        Index(
            "uq_cam_customer_article_active",
            "company_id", "customer_id", "customer_article",
            unique=True,
            postgresql_where=text("is_active = true AND is_deleted = false"),
        ),
        # 2. Reverse Uniqueness: An internal variant cannot have multiple conflicting buyer codes for the same customer
        Index(
            "uq_cam_customer_variant_active",
            "company_id", "customer_id", "variant_id",
            unique=True,
            postgresql_where=text("is_active = true AND is_deleted = false"),
        ),
        # 3. High-Speed Lookup Indexes
        Index("ix_cam_lookup", "company_id", "customer_id", "customer_article"),
        Index("ix_cam_barcode", "company_id", "barcode"),
        Index("ix_cam_vendor_article", "company_id", "vendor_article"),
    )

    # Scoping & Master References
    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    barcode_id = Column(String(50), ForeignKey("item_barcodes.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identifiers
    customer_article = Column(String(100), nullable=False)           # Buyer Code (e.g. '450180905001')
    vendor_article = Column(String(100), nullable=False, index=True) # Factory Style (e.g. 'CH-01-A')
    color = Column(String(50), nullable=False)                       # e.g. 'NAVY'
    size = Column(String(20), nullable=False)                        # e.g. '38'
    barcode = Column(String(50), nullable=False, index=True)         # GS1 EAN-13 (e.g. '8904551000019')

    # Buyer Catalog Metadata
    customer_style_description = Column(String(255), nullable=True)  # e.g. 'CHETAK CASUAL SLIPON NAVY 38'
    buyer_division = Column(String(100), nullable=True)              # e.g. 'TRENDS FOOTWEAR'
    buyer_hsn = Column(String(15), nullable=True)                   # e.g. '64041990'

    # Commercial Contract Snapshot
    currency = Column(String(3), nullable=False, default="INR")
    base_mrp = Column(Numeric(15, 2), nullable=False, default=0.00)
    contract_discount_pct = Column(Numeric(7, 4), nullable=True)    # e.g. 43.7600 %
    contract_rate = Column(Numeric(15, 2), nullable=True)            # e.g. 1068.00 (MRP * 0.5624)

    # Lifecycle & Temporal Validity
    effective_from = Column(Date, nullable=False, default=date.today)
    effective_to = Column(Date, nullable=True)                       # NULL = indefinite
    status = Column(String(30), nullable=False, default="ACTIVE")    # ACTIVE, EXPIRED, SUSPENDED

    # Source & Audit Trail
    source_system = Column(String(50), nullable=False, default="EXCEL_IMPORT") # RELIANCE_SAP_EDI, EXCEL_IMPORT, MANUAL
    source_reference = Column(String(100), nullable=True)           # e.g. 'PO-BATCH-08092026'
    verification_status = Column(String(30), nullable=False, default="VERIFIED") # VERIFIED, PENDING_REVIEW
    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSONB, server_default=text("'{}'::jsonb"), nullable=False)

    # Relationships
    customer = relationship("Customer")
    item = relationship("Item")
    variant = relationship("ItemVariant")
    barcode_rel = relationship("ItemBarcode", foreign_keys=[barcode_id])
