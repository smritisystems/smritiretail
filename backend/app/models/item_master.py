"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.0
Created      : 2026-08-23
Modified     : 2026-09-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Boolean, Integer, BigInteger, ForeignKey, Text, text, Date, UniqueConstraint, Index, Enum as SAEnum
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
    identity_code = Column(String(100), nullable=True, unique=True, index=True)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(30), nullable=False, default="FINISHED_GOOD")  # FINISHED_GOOD, RAW_MATERIAL, SERVICE, PACKAGING, CONSUMABLE
    category = Column(String(100), nullable=True, index=True)
    category_code = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True, index=True)
    brand = Column(String(100), nullable=True)
    style_code = Column(String(100), nullable=True, index=True)
    color = Column(String(50), nullable=True, index=True)
    size = Column(String(50), nullable=True, index=True)
    vendor_code = Column(String(100), nullable=True, index=True)
    hsn_code = Column(String(15), nullable=True)
    # hsn_sac_code: Added by v1469 (cross-DB parity). Coexists with hsn_code for
    # the GST HSN (goods) vs SAC (services) distinction. is_service_yn=True → use
    # hsn_sac_code as the SAC code. is_service_yn=False → hsn_code is authoritative.
    # Listed as alias of item.hsn_code in field_registry.py and in STANDARD_MIGRATION_COLUMNS.
    hsn_sac_code = Column(String(50), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=Decimal("18.00"), server_default=text("'18.00'"))
    primary_uom = Column(String(20), nullable=True)
    # uom: Added by v1469 (cross-DB column parity with smritisys). Secondary alias for
    # primary_uom. No API reads this column directly; primary_uom is the authoritative field.
    # Listed in STANDARD_MIGRATION_COLUMNS. Do not remove — column exists in live DB.
    uom = Column(String(50), nullable=True)
    least_saleable_qty = Column(Numeric(10, 4), nullable=False, default=Decimal("1.0000"), server_default=text("'1.0000'"))

    
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

    # ── v2.2 Promoted Attribute Columns ────────────────────────────────────────
    # These were previously buried in attributes_json. Promoted to first-class
    # SQL columns for queryability, reporting, and IM-001 controlled-field validation.
    gender           = Column(String(30),  nullable=True, index=True)   # GENDER (Col O) — System Master Lookup
    purchase_class   = Column(String(100), nullable=True)                # PURCHASE_CLASS (Col P)
    product_type     = Column(String(100), nullable=True, index=True)    # PRODUCT_TYPE (Col T) — System Master Lookup
    design_attribute = Column(String(100), nullable=True)                # DESIGN_ATTRIBUTE (Col U) — System Master Lookup
    heel_type        = Column(String(100), nullable=True)                # HEEL_TYPE (Col V) — System Master Lookup
    upper_material   = Column(String(100), nullable=True)                # UPPER_MATERIAL (Col W) — System Master Lookup
    outsole_material = Column(String(100), nullable=True)                # OUTSOLE_MATERIAL (Col X)
    collection_type  = Column(String(100), nullable=True)                # COLLECTION_TYPE (Col D)

    # ── v2.2 Business Logic Flags (IM-008 / IM-009) ───────────────────────────
    # IM-008: Only Y/N accepted on import; stored as Boolean here.
    # IM-009: is_service_yn=True forces is_inventory_yn=False.
    is_inventory_yn  = Column(Boolean, nullable=False, default=True,  server_default=text("true"))   # IS_INVENTORY_YN (Col AE)
    is_billable_yn   = Column(Boolean, nullable=False, default=True,  server_default=text("true"))   # IS_BILLABLE_YN  (Col AF)
    is_service_yn    = Column(Boolean, nullable=False, default=False, server_default=text("false"))  # IS_SERVICE_YN   (Col AG)

    # ── v2.2 Workflow Validation Columns ──────────────────────────────────────
    # Persisted per item so import results are queryable post-import.
    validation_status  = Column(String(30), nullable=True)   # VALIDATION_STATUS  (Col AI): PASS/FAIL/ADVISORY
    validation_message = Column(Text,       nullable=True)   # VALIDATION_MESSAGE (Col AJ)

    # Extended attributes & assets
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    # metadata_json: Added by v1469 (cross-DB parity). Generic extensible metadata bag.
    # Listed in STANDARD_MIGRATION_COLUMNS. Distinct from attributes_json (which holds
    # controlled product attributes). metadata_json holds import/integration metadata.
    metadata_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    primary_image_url = Column(String(512), nullable=True)
    tags = Column(ARRAY(String), server_default="{}")
    # tracking_type: Added by v1469 (cross-DB parity). Specifies item tracking mode
    # (e.g. 'BATCH', 'SERIAL', 'SIMPLE'). Listed in STANDARD_MIGRATION_COLUMNS.
    tracking_type = Column(String(50), nullable=True)
    # tracking_mode: Added by v1517 (data integrity refactor).
    # Single canonical source of truth replacing dual boolean flags: NONE | BATCH | SERIAL | EXPIRY | IMEI.
    tracking_mode = Column(String(20), nullable=False, default="NONE", server_default=text("'NONE'"))


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
    
    # First-class physical variant dimensions (Standard v2.2)
    color = Column(String(50), nullable=True, index=True)
    size = Column(String(50), nullable=True, index=True)
    attributes_json = Column(JSONB, server_default=text("'{}'"), default=dict)  # {"size": "XL", "color": "Navy"}
    
    # Explicit Statutory / Compliance Overrides (First-Class Schema Columns)
    hsn_code = Column(String(15), nullable=True)
    tax_rate = Column(Numeric(5, 2), nullable=True)
    
    # Decoupled Commercial Pricing (Pricing Domain is authoritative system-of-record)
    mrp = Column(Numeric(15, 2), nullable=True, default=0.00)
    selling_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    cost_price = Column(Numeric(15, 2), nullable=True, default=0.00)
    is_active = Column(Boolean, nullable=False, default=True)

    @property
    def style_id(self) -> str:
        """Domain alias: item_id is style_id."""
        return self.item_id

    @property
    def sku(self) -> str:
        """Canonical business identity alias for variant_sku per blueprint."""
        return self.variant_sku

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
        Index(
            "uq_barcodes_one_primary_per_variant",
            "company_id",
            "variant_id",
            unique=True,
            postgresql_where=text("is_primary = true AND is_deleted = false AND variant_id IS NOT NULL"),
        ),
    )

    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=True, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    price_book_entry_id = Column(String(50), ForeignKey("price_book_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    barcode = Column(String(100), nullable=False, index=True)
    barcode_normalized = Column(String(100), nullable=True, index=True)
    barcode_type = Column(String(30), nullable=False, default="EAN13")  # EAN13, CODE128, UPC, QR, CUSTOM

    @property
    def item_variant_id(self) -> Optional[str]:
        """Domain alias: variant_id is item_variant_id per canonical blueprint."""
        return self.variant_id
    barcode_purpose = Column(String(20), nullable=False, default="RETAIL")
    encoding_standard = Column(String(20), nullable=False, default="NONE")
    is_primary = Column(Boolean, nullable=False, default=False)
    is_tax_inclusive = Column(Boolean, nullable=True, default=None)  # Explicit sellable unit tax policy override
    least_saleable_qty = Column(Numeric(10, 4), nullable=True, default=None)  # Barcode pack/bundle minimum multiplier
    status = Column(String(20), nullable=False, default="ASSIGNED")
    source = Column(String(30), nullable=False, default="MANUAL")
    source_reference = Column(String(100), nullable=True)
    assigned_at = Column(Date, nullable=True)
    assigned_by = Column(String(100), nullable=True)
    retired_at = Column(Date, nullable=True)
    retirement_reason = Column(Text, nullable=True)

    # Relationships
    item = relationship("Item", back_populates="barcodes")
    variant = relationship("ItemVariant", back_populates="barcodes")
    audit_events = relationship("BarcodeRegistryAudit", back_populates="barcode_record", cascade="all, delete-orphan")


# ── Canonical Domain Aliases ──────────────────────────────────────────────────
# ItemStyle represents product/style identity. ItemVariant represents physical variant.
ItemStyle = Item


class BarcodeRegistryAudit(BaseEntity):
    """Immutable audit event for barcode intake and assignment."""
    __tablename__ = "barcode_registry_audit"

    barcode_id = Column(String(50), ForeignKey("item_barcodes.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(30), nullable=False)
    previous_status = Column(String(20), nullable=True)
    next_status = Column(String(20), nullable=False)
    details_json = Column(JSONB, server_default=text("'{}'"), default=dict)
    reason = Column(Text, nullable=True)

    barcode_record = relationship("ItemBarcode", back_populates="audit_events")


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

