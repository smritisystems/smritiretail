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
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, BigInteger, ForeignKey,
    Text, text, Date, DateTime, UniqueConstraint, Index, CheckConstraint, Enum as SAEnum, Computed
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import Base, BaseEntity


class Item(BaseEntity):
    """
    Universal Item Master in SMRITI Tenant Data Plane (smritiXXX).
    Canonical catalog entity across POS, B2B Sales, Procurement, WMS, and Distribution.
    NOTE: Pricing is authoritatively governed by the Pricing Domain (price_books / price_book_entries).
    """
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("company_id", "item_code", name="uq_items_company_item_code"),
        CheckConstraint("NOT (is_batch_tracked = TRUE AND is_serial_tracked = TRUE)", name="chk_no_dual_tracking"),
        CheckConstraint(
            "(tracking_mode = 'BATCH' AND is_batch_tracked = TRUE AND is_serial_tracked = FALSE) OR "
            "(tracking_mode = 'SERIAL' AND is_serial_tracked = TRUE AND is_batch_tracked = FALSE) OR "
            "(tracking_mode = 'NONE' AND is_batch_tracked = FALSE AND is_serial_tracked = FALSE)",
            name="chk_tracking_mode_matches_flags",
        ),
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
    # DEPRECATED (Phase 10 / ADR-0021): Color and Size are strictly variant-level attributes.
    # In retail architecture, styles encompass multiple variations. Authoritative variation
    # attributes reside in item_variants.color and item_variants.size.
    # Retained for database schema compatibility; queries should read from ItemVariant.
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
    # ('BATCH', 'SERIAL', 'NONE'). Harmonized in Phase 11.
    tracking_type = Column(String(50), nullable=False, default="NONE", server_default=text("'NONE'"))
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

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
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

    # Canonical business identity (PostgreSQL GENERATED ALWAYS AS (variant_sku) STORED - Phase R-09)
    sku = Column(String(100), Computed("variant_sku"), nullable=False, index=True)

    @property
    def style_id(self) -> str:
        """Domain alias: item_id is style_id."""
        return self.item_id

    # Relationships
    item = relationship("Item", back_populates="variants")
    barcodes = relationship("ItemBarcode", back_populates="variant", cascade="all, delete-orphan")
    batches = relationship("ItemBatch", back_populates="variant", cascade="all, delete-orphan")
    serials = relationship("ItemSerial", back_populates="variant", cascade="all, delete-orphan")
    uom_setting = relationship("ItemUOMSetting", back_populates="variant", uselist=False, cascade="all, delete-orphan")
    price_setting = relationship("ItemPrice", back_populates="variant", uselist=False, cascade="all, delete-orphan")
    tax_profile = relationship("ItemTaxProfile", back_populates="variant", uselist=False, cascade="all, delete-orphan")
    supplier_setting = relationship("ItemSupplierSetting", back_populates="variant", uselist=False, cascade="all, delete-orphan")
    sales_setting = relationship("ItemSalesSetting", back_populates="variant", uselist=False, cascade="all, delete-orphan")
    inventory_policy = relationship("ItemInventoryPolicy", back_populates="variant", uselist=False, cascade="all, delete-orphan")


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

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
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

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
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

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
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

    company_id = Column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True)
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


# ══════════════════════════════════════════════════════════════════════════════
# ITEM MASTER PHASE 2 EXTENSION ENTITIES
# ══════════════════════════════════════════════════════════════════════════════

class ItemUOMSetting(Base):
    """
    Authoritative variant UOM configuration.
    Stock UOM is inventory truth. Purchase/Sales UOM and conversion factors are optional.
    """
    __tablename__ = "item_uom_settings"
    __table_args__ = (
        CheckConstraint("conversion_factor > 0", name="chk_ius_conversion_factor_positive"),
        Index("idx_ius_company_id", "company_id"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    stock_uom_id = Column(String(50), ForeignKey("uoms_ref.id", ondelete="RESTRICT"), nullable=False)
    sales_uom_id = Column(String(50), ForeignKey("uoms_ref.id", ondelete="RESTRICT"), nullable=True)
    purchase_uom_id = Column(String(50), ForeignKey("uoms_ref.id", ondelete="RESTRICT"), nullable=True)
    conversion_factor = Column(Numeric(18, 6), nullable=False, default=Decimal("1.000000"), server_default=text("'1.000000'"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="uom_setting")
    stock_uom = relationship("UnitOfMeasurementRef", foreign_keys=[stock_uom_id])
    sales_uom = relationship("UnitOfMeasurementRef", foreign_keys=[sales_uom_id])
    purchase_uom = relationship("UnitOfMeasurementRef", foreign_keys=[purchase_uom_id])


class ItemPrice(Base):
    """
    Authoritative Item Commercial Pricing Policy.
    Decoupled from legacy item_variants columns, maintaining rich commercial parameters.
    """
    __tablename__ = "item_prices"
    __table_args__ = (
        CheckConstraint("selling_price >= 0", name="chk_ip_selling_price_non_neg"),
        CheckConstraint("mrp >= 0", name="chk_ip_mrp_non_neg"),
        CheckConstraint("maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100)", name="chk_ip_discount_pct_range"),
        Index("idx_ip_company_id", "company_id"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    cost_price = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    selling_price = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    mrp = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    dealer_price = Column(Numeric(15, 2), nullable=True)
    wholesale_price = Column(Numeric(15, 2), nullable=True)
    minimum_selling_price = Column(Numeric(15, 2), nullable=True)
    maximum_discount_percent = Column(Numeric(5, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    currency = Column(String(10), nullable=False, default="INR", server_default=text("'INR'"))
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="price_setting")


class ItemTaxProfile(Base):
    """
    Authoritative Item Tax Profile.
    Statutory GST, HSN/SAC, tax inclusiveness and exemption policy.
    """
    __tablename__ = "item_tax_profiles"
    __table_args__ = (
        Index("idx_itp_company_id", "company_id"),
        Index("idx_itp_hsn", "hsn_sac_code"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    hsn_sac_code = Column(String(20), nullable=True, index=True)
    tax_category = Column(String(50), nullable=True)
    gst_rate = Column(Numeric(6, 2), nullable=True)
    tax_inclusive = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    sales_tax_rate = Column(Numeric(6, 2), nullable=True)
    purchase_tax_rate = Column(Numeric(6, 2), nullable=True)
    tax_exempt = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="tax_profile")


class ItemSupplierSetting(Base):
    """
    Authoritative variant purchasing & supplier configuration.
    Links variant to preferred supplier, purchase UOM, and purchasing constraints.
    """
    __tablename__ = "item_supplier_settings"
    __table_args__ = (
        CheckConstraint("minimum_purchase_qty IS NULL OR minimum_purchase_qty > 0", name="chk_iss_min_purchase_qty"),
        CheckConstraint("purchase_lead_time IS NULL OR purchase_lead_time >= 0", name="chk_iss_lead_time_non_neg"),
        Index("idx_iss_company_id", "company_id"),
        Index("idx_iss_supplier", "preferred_supplier_id"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    preferred_supplier_id = Column(String(50), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_item_code = Column(String(100), nullable=True)
    purchase_uom_id = Column(String(50), ForeignKey("uoms_ref.id", ondelete="RESTRICT"), nullable=True)
    minimum_purchase_qty = Column(Numeric(12, 4), nullable=True, default=Decimal("1.0000"), server_default=text("'1.0000'"))
    purchase_cost = Column(Numeric(15, 2), nullable=True)
    last_purchase_price = Column(Numeric(15, 2), nullable=True)
    purchase_lead_time = Column(Integer, nullable=True, default=0, server_default=text("0"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="supplier_setting")
    preferred_supplier = relationship("Supplier")
    purchase_uom = relationship("UnitOfMeasurementRef")


class ItemSalesSetting(Base):
    """
    Authoritative variant sales configuration.
    Controls sales UOM, commercial selling pricing rules, and billable eligibility.
    """
    __tablename__ = "item_sales_settings"
    __table_args__ = (
        CheckConstraint("selling_price >= 0", name="chk_isales_selling_price_non_neg"),
        CheckConstraint("maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100)", name="chk_isales_discount_pct_range"),
        Index("idx_isales_company_id", "company_id"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    sales_uom_id = Column(String(50), ForeignKey("uoms_ref.id", ondelete="RESTRICT"), nullable=True)
    selling_price = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    mrp = Column(Numeric(15, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    wholesale_price = Column(Numeric(15, 2), nullable=True)
    minimum_selling_price = Column(Numeric(15, 2), nullable=True)
    maximum_discount_percent = Column(Numeric(5, 2), nullable=True, default=Decimal("0.00"), server_default=text("'0.00'"))
    allow_discount = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    billable = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="sales_setting")
    sales_uom = relationship("UnitOfMeasurementRef")


class ItemInventoryPolicy(Base):
    """
    Authoritative variant replenishment and inventory policy.
    STRICT POLICY ONLY — ZERO PHYSICAL QUANTITY STORED IN THIS TABLE.
    """
    __tablename__ = "item_inventory_policies"
    __table_args__ = (
        CheckConstraint("minimum_stock >= 0", name="chk_iip_min_stock"),
        CheckConstraint("reorder_level >= 0", name="chk_iip_reorder_level"),
        CheckConstraint("reorder_quantity >= 0", name="chk_iip_reorder_qty"),
        CheckConstraint("maximum_stock >= 0", name="chk_iip_max_stock"),
        CheckConstraint("safety_stock >= 0", name="chk_iip_safety_stock"),
        CheckConstraint("lead_time >= 0", name="chk_iip_lead_time"),
        CheckConstraint("maximum_stock = 0 OR reorder_level <= maximum_stock", name="chk_iip_reorder_lte_max"),
        Index("idx_iip_company_id", "company_id"),
        Index("idx_iip_supplier", "preferred_supplier_id"),
    )

    item_variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), primary_key=True)
    company_id = Column(String(50), nullable=False, index=True)
    branch_id = Column(String(50), nullable=True)
    minimum_stock = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"), server_default=text("'0.0000'"))
    reorder_level = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"), server_default=text("'0.0000'"))
    reorder_quantity = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"), server_default=text("'0.0000'"))
    maximum_stock = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"), server_default=text("'0.0000'"))
    safety_stock = Column(Numeric(12, 4), nullable=False, default=Decimal("0.0000"), server_default=text("'0.0000'"))
    lead_time = Column(Integer, nullable=False, default=0, server_default=text("0"))
    preferred_supplier_id = Column(String(50), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    modified_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def id(self) -> str:
        return self.item_variant_id

    # Relationships
    variant = relationship("ItemVariant", back_populates="inventory_policy")
    preferred_supplier = relationship("Supplier")

