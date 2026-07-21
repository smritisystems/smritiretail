"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-11
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime
from ..db.base import BaseEntity, RowSecuredMixin
from sqlalchemy import Column, String, Numeric, Boolean, Integer, Index, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship, foreign
from .attributes import VariantTemplate

class Product(RowSecuredMixin, BaseEntity):
    __tablename__ = "products"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(15, 2), nullable=False, default=0.00)
    stock = Column(Integer, nullable=False, default=0)
    category = Column(String(100), nullable=False, index=True)
    is_favorite = Column(Boolean, default=False)
    barcode = Column(String(100), nullable=False, unique=True, index=True)
    brand = Column(String(100))
    color = Column(String(50))
    size = Column(String(50))
    mrp = Column(Numeric(15, 2))
    gst_percentage = Column(Numeric(5, 2), nullable=True)
    style_code = Column(String(100))
    cost_price = Column(Numeric(15, 2))
    sku = Column(String(100), unique=True)
    hsn_code = Column(String(15))
    pricing_mode = Column(String(30), default="Fixed")
    tracking_mode = Column(String(30), default="Standard")
    variant_template_id = Column(String(50), nullable=True, index=True)
    weight_grams = Column(Numeric(10, 2), default=0.00)
    attributes = Column(JSONB, server_default="'{}'::jsonb", default=dict)
    primary_image_url = Column(String(512))
    gallery_images = Column(ARRAY(String), server_default="{}")

    # Relationships
    barcodes = relationship("ProductBarcode", back_populates="product", cascade="all, delete-orphan")
    variant_template = relationship("VariantTemplate", primaryjoin="foreign(Product.variant_template_id) == VariantTemplate.id", backref="products")

    @property
    def secondary_barcodes(self) -> list[str]:
        # Return only the non-primary barcodes
        return [bc.barcode for bc in self.barcodes if not bc.is_primary]

    @secondary_barcodes.setter
    def secondary_barcodes(self, values: list[str]) -> None:
        import uuid as uuid_pkg
        # Re-sync secondary barcodes
        existing_sec = [bc for bc in self.barcodes if not bc.is_primary]
        existing_vals = {bc.barcode: bc for bc in existing_sec}
        # Add new ones
        for val in values:
            if not val:
                continue
            if val not in existing_vals:
                new_bc = ProductBarcode(
                    id=f"BC-{uuid_pkg.uuid4().hex[:8]}",
                    uuid=str(uuid_pkg.uuid4()),
                    product_id=self.id,
                    barcode=val,
                    is_primary=False,
                    tenant_id=self.tenant_id,
                    company_id=self.company_id,
                    branch_id=self.branch_id
                )
                self.barcodes.append(new_bc)
        # Remove deleted ones
        new_vals_set = set(values)
        for bc in existing_sec:
            if bc.barcode not in new_vals_set:
                self.barcodes.remove(bc)

    __table_args__ = (
        Index("idx_products_attributes", "attributes", postgresql_using="gin"),
    )


class ProductBarcode(BaseEntity):
    __tablename__ = "product_barcodes"

    product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    barcode = Column(String(100), nullable=False, unique=True, index=True)
    is_primary = Column(Boolean, nullable=False, default=False)

    # Relationships
    product = relationship("Product", back_populates="barcodes")


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

