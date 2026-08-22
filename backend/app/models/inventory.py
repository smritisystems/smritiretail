"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-11
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 """

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, BigInteger, Index, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity

class Product(BaseEntity):
    __tablename__ = "products"

    variant_id = Column(BigInteger, autoincrement=True, index=True)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(15, 2), nullable=False, default=0.00)
    stock = Column(Integer, nullable=False, default=0)
    category = Column(String(100), nullable=False, index=True)
    is_favorite = Column(Boolean, default=False)
    barcode = Column(String(100), nullable=False, index=True)
    secondary_barcodes = Column(ARRAY(String), server_default="{}")
    brand = Column(String(100))
    color = Column(String(50))
    size = Column(String(50))
    mrp = Column(Numeric(15, 2))
    gst_percentage = Column(Numeric(5, 2), default=18.00)
    style_code = Column(String(100))
    cost_price = Column(Numeric(15, 2))
    sku = Column(String(100), unique=True)
    hsn_code = Column(String(15))
    pricing_mode = Column(String(30), default="Fixed")
    tracking_mode = Column(String(30), default="Standard")
    variant_template_id = Column(String(50))
    weight_grams = Column(Numeric(10, 2), default=0.00)
    attributes = Column(JSONB, server_default=text("'{}'"), default=dict)
    primary_image_url = Column(String(512))
    gallery_images = Column(ARRAY(String), server_default="{}")
    
    # Extended Enterprise Item Master Attributes
    reserved_stock = Column(Numeric(12, 4), nullable=False, default=0.0000)
    category_code = Column(String(50))
    cbm_m3 = Column(Numeric(10, 4))
    document_number = Column(String(80))
    size_scale_id = Column(String(50))
    sourcing_mode_override = Column(String(30))
    tenant_id = Column(String(50))
    workflow_status = Column(String(30), default="Approved")

    __table_args__ = (
        Index("idx_products_attributes", "attributes", postgresql_using="gin"),
        Index("idx_products_variant_id", "variant_id"),
        Index(
            "uq_variant_identity_active",
            "company_id",
            text("lower(style_code)"),
            text("lower(color)"),
            text("lower(size)"),
            unique=True,
            postgresql_where=text("is_deleted = false AND style_code IS NOT NULL AND color IS NOT NULL AND size IS NOT NULL"),
        ),
        Index(
            "uq_company_barcode_active",
            "company_id",
            "barcode",
            unique=True,
            postgresql_where=text("is_deleted = false AND barcode IS NOT NULL"),
        ),
    )


import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Numeric, Boolean, Integer, BigInteger,
    Index, ForeignKey, Text, Date, DateTime, text
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship
from ..db.base import BaseEntity


class TransferStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    DISPATCHED = "DISPATCHED"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    PARTIAL = "PARTIAL"
    CANCELLED = "CANCELLED"


class StockMovement(BaseEntity):
    __tablename__ = "stock_movements"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    movement_type = Column(String(20), nullable=False) # IN, OUT, ADJUSTMENT, TRANSFER, INWARD_GRN, OUTWARD_SALE, TRANSFER_OUT, TRANSFER_IN
    reference_doc_type = Column(String(50), nullable=True)
    reference_doc_id = Column(String(50), nullable=True)
    warehouse = Column(String(100), nullable=True) # Legacy text reference
    warehouse_id = Column(String(50), ForeignKey("warehouses.id", ondelete="SET NULL"), nullable=True, index=True)
    bin = Column(String(50), nullable=True)
    batch = Column(String(50), nullable=True)
    serial = Column(String(50), nullable=True)
    unit_cost = Column(Numeric(15, 2), nullable=True)
    remarks = Column(Text, nullable=True)
    user = Column(String(100), nullable=True)
    device = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    source_module = Column(String(50), nullable=True)
    approval = Column(String(50), nullable=True)


class Store(BaseEntity):
    __tablename__ = "stores"

    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    store_type = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)

    __table_args__ = (
        Index(
            "uq_company_store_code_active",
            "company_id",
            "code",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class Warehouse(BaseEntity):
    __tablename__ = "warehouses"

    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    is_transit = Column(Boolean, default=False)
    is_central_godown = Column(Boolean, default=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)

    __table_args__ = (
        Index(
            "uq_company_warehouse_code_active",
            "company_id",
            "code",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class ProductBatchStock(BaseEntity):
    __tablename__ = "product_batch_stocks"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id = Column(String(50), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    batch_no = Column(String(100), nullable=False, index=True)
    mfg_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)
    mrp = Column(Numeric(15, 2), nullable=True)
    purchase_rate = Column(Numeric(15, 2), nullable=True)
    sale_rate = Column(Numeric(15, 2), nullable=True)
    
    # Granular inventory state
    quantity = Column(Numeric(12, 4), nullable=False, default=0.0000)          # Total physical on-hand
    reserved_quantity = Column(Numeric(12, 4), nullable=False, default=0.0000) # Committed to pending dispatch
    damaged_quantity = Column(Numeric(12, 4), nullable=False, default=0.0000)  # Quarantined / Damaged
    
    last_counted_date = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "uq_company_wh_prod_batch_active",
            "company_id",
            "warehouse_id",
            "product_id",
            "batch_no",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class StockTransfer(BaseEntity):
    __tablename__ = "stock_transfers"

    transfer_no = Column(String(100), nullable=False)
    source_warehouse_id = Column(String(50), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    dest_warehouse_id = Column(String(50), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(30), nullable=False, default=TransferStatus.DRAFT.value)
    
    dispatch_date = Column(DateTime(timezone=True), nullable=True)
    received_date = Column(DateTime(timezone=True), nullable=True)
    
    transporter_name = Column(String(100), nullable=True)
    lr_number = Column(String(100), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    e_way_bill_no = Column(String(50), nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
    notes = Column(Text, nullable=True)

    # Relationships
    items = relationship("StockTransferItem", back_populates="transfer", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index(
            "uq_company_transfer_no_active",
            "company_id",
            "transfer_no",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
    )


class StockTransferItem(BaseEntity):
    __tablename__ = "stock_transfer_items"

    transfer_id = Column(String(50), ForeignKey("stock_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    batch_no = Column(String(100), nullable=False)
    
    quantity_dispatched = Column(Numeric(12, 4), nullable=False)
    quantity_received = Column(Numeric(12, 4), nullable=False, default=0.0000)
    quantity_shortage = Column(Numeric(12, 4), nullable=False, default=0.0000)
    quantity_damaged = Column(Numeric(12, 4), nullable=False, default=0.0000)
    unit_cost = Column(Numeric(15, 2), nullable=False)
    notes = Column(Text, nullable=True)

    transfer = relationship("StockTransfer", back_populates="items")

