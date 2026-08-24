"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from sqlalchemy import Column, String, Numeric, Boolean, Integer, BigInteger, ForeignKey, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity


class Item(BaseEntity):
    """
    Universal Item Master in SMRITI Tenant Data Plane (smritiXXX).
    Canonical catalog entity across POS, B2B Sales, Procurement, WMS, and Distribution.
    """
    __tablename__ = "items"

    item_code = Column(String(50), nullable=False, unique=True, index=True)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(30), nullable=False, default="FINISHED_GOOD")  # FINISHED_GOOD, RAW_MATERIAL, SERVICE, PACKAGING, CONSUMABLE
    category = Column(String(100), nullable=False, index=True)
    category_code = Column(String(50), nullable=True)
    brand = Column(String(100), nullable=True)
    hsn_code = Column(String(15), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=18.00)
    primary_uom = Column(String(20), nullable=False, default="PCS")
    
    # Standard pricing baseline
    mrp = Column(Numeric(15, 2), nullable=False, default=0.00)
    selling_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    buying_price = Column(Numeric(15, 2), nullable=True)
    cost_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    
    # Inventory tracking configuration
    is_batch_tracked = Column(Boolean, nullable=False, default=False)
    is_serial_tracked = Column(Boolean, nullable=False, default=False)
    is_favorite = Column(Boolean, nullable=False, default=False)
    status = Column(String(30), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE, DISCONTINUED
    
    # Extended attributes & assets
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    primary_image_url = Column(String(512), nullable=True)
    tags = Column(ARRAY(String), server_default="{}")

    # Relationships
    variants = relationship("ItemVariant", back_populates="item", cascade="all, delete-orphan")
    barcodes = relationship("ItemBarcode", back_populates="item", cascade="all, delete-orphan")


class ItemVariant(BaseEntity):
    """
    Item Variant entity representing SKU dimensions (e.g. Size, Color, Fit, Pack).
    """
    __tablename__ = "item_variants"

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_sku = Column(String(100), nullable=False, unique=True, index=True)
    variant_name = Column(String(255), nullable=False)
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)  # {"size": "XL", "color": "Navy"}
    mrp = Column(Numeric(15, 2), nullable=False, default=0.00)
    selling_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    cost_price = Column(Numeric(15, 2), nullable=False, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    item = relationship("Item", back_populates="variants")
    barcodes = relationship("ItemBarcode", back_populates="variant", cascade="all, delete-orphan")


class ItemBarcode(BaseEntity):
    """
    Universal Barcode mapping for rapid POS typeahead and WMS barcode scanners.
    """
    __tablename__ = "item_barcodes"
    __table_args__ = (
        UniqueConstraint("barcode", name="uq_item_barcode_value"),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    barcode = Column(String(100), nullable=False, index=True)
    barcode_type = Column(String(30), nullable=False, default="EAN13")  # EAN13, CODE128, UPC, QR, CUSTOM
    is_primary = Column(Boolean, nullable=False, default=False)

    # Relationships
    item = relationship("Item", back_populates="barcodes")
    variant = relationship("ItemVariant", back_populates="barcodes")
