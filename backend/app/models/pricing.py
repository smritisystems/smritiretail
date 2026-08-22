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

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, ForeignKey, DateTime, Text, text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class PriceBook(BaseEntity):
    """
    Price Book master governing pricing rules, wholesale/retail lists, and customer segment catalogs.
    """
    __tablename__ = "price_books"

    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    currency = Column(String(10), nullable=False, default="INR")
    is_default = Column(Boolean, nullable=False, default=False)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")
    description = Column(Text, nullable=True)

    # Relationships
    entries = relationship("PriceBookEntry", back_populates="price_book", cascade="all, delete-orphan")


class PriceBookEntry(BaseEntity):
    """
    Specific price point for an Item / Variant within a designated Price Book.
    Supports volume breaks via min_quantity.
    """
    __tablename__ = "price_book_entries"
    __table_args__ = (
        UniqueConstraint("price_book_id", "item_id", "variant_id", "min_quantity", name="uq_pbe_matrix"),
    )

    price_book_id = Column(String(50), ForeignKey("price_books.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(50), ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(String(50), ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True, index=True)
    min_quantity = Column(Numeric(12, 4), nullable=False, default=1.0000)
    selling_price = Column(Numeric(15, 2), nullable=False)
    mrp = Column(Numeric(15, 2), nullable=False)
    cost_price = Column(Numeric(15, 2), nullable=True)

    # Relationships
    price_book = relationship("PriceBook", back_populates="entries")


class CustomerPriceTier(BaseEntity):
    """
    Customer classification tier mapped to specific price books or discount modifiers.
    """
    __tablename__ = "customer_price_tiers"

    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    price_book_id = Column(String(50), ForeignKey("price_books.id", ondelete="SET NULL"), nullable=True)
    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0.00)
    description = Column(Text, nullable=True)
