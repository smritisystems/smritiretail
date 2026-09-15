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


class CustomerPriceAssignment(BaseEntity):
    """Authoritative customer-to-price-tier assignment."""
    __tablename__ = "customer_price_assignments"
    __table_args__ = (
        UniqueConstraint("customer_id", name="uq_customer_price_assignment_customer"),
    )

    customer_id = Column(String(50), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    price_tier_id = Column(String(50), ForeignKey("customer_price_tiers.id", ondelete="RESTRICT"), nullable=False, index=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_to = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default="ACTIVE")
    notes = Column(Text, nullable=True)


class SalesFactor(BaseEntity):
    """
    Authoritative Sales Factor Master governing Add-ons, Deductions,
    Retail Price Factors, and Bill Round-Off rules.
    Enforces statutory Above vs Below Sales Tax timing (CGST Section 15).
    """
    __tablename__ = "sales_factors"

    code = Column(String(50), nullable=False, index=True)
    description = Column(String(200), nullable=False)
    factor_type = Column(String(30), nullable=False, default="ADD_ON")  # RETAIL_PRICE_FACTOR, PRICE_ROUND_OFF, ADD_ON, DEDUCTION, BILL_ROUND_OFF
    factor_category = Column(String(30), nullable=False, default="ALL_CUSTOMERS")  # CUSTOMER_SPECIFIC, PRICE_GROUP_SPECIFIC, ALL_CUSTOMERS
    
    # Target Scope
    customer_id = Column(String(50), nullable=True, index=True)
    price_group_code = Column(String(50), nullable=True, index=True)
    applicable_categories = Column(JSONB, server_default=text("'[]'"), default=list)
    applicable_brands = Column(JSONB, server_default=text("'[]'"), default=list)
    
    # Computation Mechanics
    computation_timing = Column(String(20), nullable=False, default="ABOVE_TAX")  # ABOVE_TAX (Consider for Tax), BELOW_TAX (Ignore for Tax)
    computed_on = Column(String(30), nullable=False, default="DISCOUNTED_VALUE")  # SALE_VALUE_BEFORE_DISCOUNT, DISCOUNTED_VALUE, VALUE_INCLUSIVE_OF_TAX
    rate_or_amount = Column(String(10), nullable=False, default="RATE")  # RATE (%), AMOUNT (₹)
    value = Column(Numeric(12, 4), nullable=False, default=0.0000)
    is_variable = Column(Boolean, nullable=False, default=False)  # Cashier override allowed
    
    # Thresholds & Validity
    min_bill_value = Column(Numeric(15, 2), nullable=True)
    max_bill_value = Column(Numeric(15, 2), nullable=True)
    valid_from = Column(String(20), nullable=True)
    valid_to = Column(String(20), nullable=True)
    applicable_days = Column(JSONB, server_default=text("'[]'"), default=list)
    is_active = Column(Boolean, nullable=False, default=True)

