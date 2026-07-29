"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 22.1.0
Created      : 2026-07-21
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Models for Customer Loyalty & Promotions Engine
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey, Numeric
from app.db.base import Base, BaseEntity, RowSecuredMixin


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


class LoyaltyTransactionModel(RowSecuredMixin, BaseEntity):
    """
    LoyaltyTransactionModel — Point accrual, redemption, and expiration ledger.
    """
    __tablename__ = "loyalty_point_transactions"

    customer_id      = Column(String(50), nullable=False, index=True)
    tx_type          = Column(String(30), nullable=False)  # EARN, REDEEM, EXPIRE, ADJUSTMENT
    points           = Column(Integer, nullable=False)
    reference_doc_no = Column(String(100), nullable=True)
    narration        = Column(String(255), nullable=True)

