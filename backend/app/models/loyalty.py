"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 22.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Customer Loyalty & Promotions Engine
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime
from app.db.base_class import Base


class CustomerLoyaltyModel(Base):
    """Customer Loyalty Account & Points Ledger."""
    __tablename__ = "loyalty_customer_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(50), nullable=False, unique=True, index=True)
    customer_name = Column(String(100), nullable=False)
    tier = Column(String(20), nullable=False, default="BRONZE")  # BRONZE, SILVER, GOLD, PLATINUM
    points_balance = Column(Integer, nullable=False, default=0)
    total_lifetime_spend = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class GiftCardModel(Base):
    """Digital Gift Card Ledger Record."""
    __tablename__ = "loyalty_gift_cards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_number = Column(String(50), nullable=False, unique=True, index=True)
    balance_amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
