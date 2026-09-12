"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Column, String, Numeric, Boolean, Integer, BigInteger, ForeignKey, Text, text, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class Item(BaseEntity):
    """
    Universal Item Master in SMRITI Tenant Data Plane (smritiXXX).
    Canonical catalog entity across POS, B2B Sales, Procurement, WMS, and Distribution.
    NOTE: Pricing is authoritatively governed by the Pricing Domain (price_books / price_book_entries).
    """
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("company_id", "item_code", name="uq_items_company_item_code"),
    )

    item_code = Column(String(50), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(30), nullable=False, default="FINISHED_GOOD")  # FINISHED_GOOD, RAW_MATERIAL, SERVICE, PACKAGING, CONSUMABLE
    category = Column(String(100), nullable=True, index=True)
    category_code = Column(String(50), nullable=True)
    brand = Column(String(100), nullable=True)
    hsn_code = Column(String(15), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)
    primary_uom = Column(String(20), nullable=True)
    
    # Non-authoritative legacy baseline fields (Pricing Domain is sole system-of-record)
    mrp = Column(Numeric(15, 2), nullable=True, default=0.00)
    selling_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    buying_price = Column(Numeric(15, 2), nullable=True)
    cost_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    
    # Inventory tracking configuration
    is_batch_tracked = Column(Boolean, nullable=False, default=False)
    is_serial_tracked = Column(Boolean, nullable=False, default=False)
    is_favorite = Column(Boolean, nullable=False, default=False)
    status = Column(String(30), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE, DISCONTINUED, REQUIRES_REVIEW
    
    # Extended attributes & assets
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    primary_image_url = Column(String(512), nullable=True)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    variants = relationship("ItemVariant", back_populates="item", cascade="all, delete-orphan")
    barcodes = relationship("ItemBarcode", back_populates="item", cascade="all, delete-orphan")
    batches = relationship("ItemBatch", back_populates="item", cascade="all, delete-orphan")
    serials = relationship("ItemSerial", back_populates="item", cascade="all, delete-orphan")
    locations = relationship("ItemWarehouseLocation", back_populates="item", cascade="all, delete-orphan")


class ItemVariant(BaseEntity):
    """
    Item Variant entity representing SKU dimensions (e.g. Size, Color, Fit, Pack).
    NOTE: Pricing is authoritatively governed by the Pricing Domain (price_books / price_book_entries).
    """
    __tablename__ = "item_variants"
    __table_args__ = (
        UniqueConstraint("company_id", "variant_sku", name="uq_variants_company_sku"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_sku = Column(String(100), nullable=False, index=True)
    variant_name = Column(String(255), nullable=False)
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)  # {"size": "XL", "color": "Navy"}
    
    # Explicit Statutory / Compliance Overrides (First-Class Schema Columns)
    hsn_code = Column(String(15), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)
    
    mrp = Column(Numeric(15, 2), nullable=True, default=0.00)
    selling_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    cost_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    item = relationship("Item", back_populates="variants")
    barcodes = relationship("ItemBarcode", back_populates="variant", cascade="all, delete-orphan")
    batches = relationship("ItemBatch", back_populates="variant", cascade="all, delete-orphan")
    serials = relationship("ItemSerial", back_populates="variant", cascade="all, delete-orphan")


class ItemBarcode(BaseEntity):
    """
    Universal Barcode mapping for rapid POS typeahead and WMS barcode scanners.
    """
    __tablename__ = "item_barcodes"
    __table_args__ = (
        UniqueConstraint("company_id", "barcode", name="uq_barcodes_company_barcode"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    barcode = Column(String(100), nullable=False, index=True)
    barcode_type = Column(String(30), nullable=False, default="EAN13")  # EAN13, CODE128, UPC, QR, CUSTOM
    is_primary = Column(Boolean, nullable=False, default=False)

    # Relationships
    item = relationship("Item", back_populates="barcodes")
    variant = relationship("ItemVariant", back_populates="barcodes")


class ItemBatch(BaseEntity):
    """
    Batch & Lot tracking for perishable, statutory, or pharmaceutical items.
    """
    __tablename__ = "item_batches"
    __table_args__ = (
        UniqueConstraint("item_id", "batch_number", name="uq_item_batch_no"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    batch_number = Column(String(100), nullable=False, index=True)
    mfg_date = Column(Date, nullable=True)
    exp_date = Column(Date, nullable=True)
    mrp = Column(Numeric(15, 2), nullable=False, default=0.00)
    cost_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    item = relationship("Item", back_populates="batches")
    variant = relationship("ItemVariant", back_populates="batches")


class ItemSerial(BaseEntity):
    """
    Unique unit serial number tracking for electronics, high-value goods, and warranty service.
    """
    __tablename__ = "item_serials"
    __table_args__ = (
        UniqueConstraint("item_id", "serial_number", name="uq_item_serial_no"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    serial_number = Column(String(100), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="AVAILABLE")  # AVAILABLE, ALLOCATED, SOLD, RETURNED, DEFECTIVE
    warehouse_id = Column(String(50), nullable=True, index=True)

    # Relationships
    item = relationship("Item", back_populates="serials")
    variant = relationship("ItemVariant", back_populates="serials")


class ItemWarehouseLocation(BaseEntity):
    """
    Multi-warehouse and location bin configuration per item.
    """
    __tablename__ = "item_warehouse_locations"
    __table_args__ = (
        UniqueConstraint("item_id", "warehouse_id", name="uq_item_warehouse"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(String(50), nullable=False, index=True)
    location_bin = Column(String(50), nullable=True)
    min_reorder_level = Column(Numeric(15, 2), nullable=False, default=0.00)
    max_capacity = Column(Numeric(15, 2), nullable=False, default=0.00)
    reorder_quantity = Column(Numeric(15, 2), nullable=False, default=0.00)

    # Relationships
    item = relationship("Item", back_populates="locations")


class LegacyIdMapping(BaseEntity):
    """
    Immutable Permanent Lineage Mapping Table.
    Preserves audit trails, historical transactions, and cross-model references
    between legacy tables (e.g. products) and canonical models (items, item_variants).
    """
    __tablename__ = "legacy_id_mappings"
    __table_args__ = (
        UniqueConstraint("legacy_table", "legacy_id", name="uq_legacy_mapping_source"),
    )

    migration_run_id = Column(String(50), nullable=False, index=True)
    legacy_table = Column(String(50), nullable=False, index=True)
    legacy_id = Column(String(50), nullable=False, index=True)
    legacy_uuid = Column(String(36), nullable=True)
    canonical_table = Column(String(50), nullable=False, index=True)
    canonical_id = Column(String(50), nullable=False, index=True)
    canonical_uuid = Column(String(36), nullable=True)
    disposition = Column(String(50), nullable=False, default="MIGRATED")  # MIGRATED, CONFLICT_REVIEW, MERGED, RETIRED
    conflict_reason = Column(Text, nullable=True)
    audit_checksum = Column(String(64), nullable=True)

