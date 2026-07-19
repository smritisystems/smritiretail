"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Index, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from ..db.base import BaseEntity, RowSecuredMixin

class Product(RowSecuredMixin, BaseEntity):
    __tablename__ = "products"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(15, 2), nullable=False, default=0.00)
    stock = Column(Integer, nullable=False, default=0)
    category = Column(String(100), nullable=False, index=True)
    is_favorite = Column(Boolean, default=False)
    barcode = Column(String(100), nullable=False, unique=True, index=True)
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
    attributes = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    primary_image_url = Column(String(512))
    gallery_images = Column(ARRAY(String), server_default="{}")

    __table_args__ = (
        Index("idx_products_attributes", "attributes", postgresql_using="gin"),
    )


class StockMovement(BaseEntity):
    __tablename__ = "stock_movements"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    movement_type = Column(String(20), nullable=False) # IN, OUT, ADJUSTMENT, TRANSFER
    reference_doc_type = Column(String(50))
    reference_doc_id = Column(String(50))
    warehouse = Column(String(100))
    bin = Column(String(50))
    batch = Column(String(50))
    serial = Column(String(50))
    unit_cost = Column(Numeric(15, 2))
    remarks = Column(Text)
    user = Column(String(100))
    device = Column(String(100))
    branch = Column(String(100))
    source_module = Column(String(50))
    approval = Column(String(50))


class Store(BaseEntity):
    __tablename__ = "stores"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    store_type = Column(String(50))
    address = Column(Text)


class Warehouse(BaseEntity):
    __tablename__ = "warehouses"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    is_transit = Column(Boolean, default=False)
    address = Column(Text)

