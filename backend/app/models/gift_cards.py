"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.119.0
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, Boolean, Integer, DateTime, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from ..db.base import BaseEntity


class GiftCard(BaseEntity):
    """Gift Card master - issued, topped up, redeemed."""
    __tablename__ = "gift_cards"

    card_no       = Column(String(40), unique=True, nullable=False, index=True)
    card_type     = Column(String(20), nullable=False, default="PHYSICAL")   # PHYSICAL | DIGITAL
    status        = Column(String(20), nullable=False, default="ACTIVE")     # ACTIVE | EXPIRED | BLOCKED | REDEEMED
    face_value    = Column(Numeric(15, 2), nullable=False, default=0)
    balance       = Column(Numeric(15, 2), nullable=False, default=0)
    currency      = Column(String(5), nullable=False, default="INR")
    issued_to     = Column(String(100), nullable=True)
    issued_by     = Column(String(50), nullable=True)
    issued_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    valid_from    = Column(DateTime, nullable=True)
    valid_to      = Column(DateTime, nullable=True)
    pin_hash      = Column(String(128), nullable=True)
    notes         = Column(Text, nullable=True)
    meta          = Column(JSONB, server_default=text("'{}'"), default=dict)


class GiftCardTransaction(BaseEntity):
    """Ledger of all gift card top-ups, redemptions, and reversals."""
    __tablename__ = "gift_card_transactions"

    gift_card_id  = Column(String(50), ForeignKey("gift_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    txn_type      = Column(String(20), nullable=False)    # ISSUE | TOPUP | REDEEM | REVERSAL | BLOCK | EXPIRE
    amount        = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=True)
    reference_no  = Column(String(80), nullable=True)     # Invoice / POS txn no
    performed_by  = Column(String(50), nullable=True)
    notes         = Column(Text, nullable=True)


class GiftVoucher(BaseEntity):
    """Gift Vouchers - single-use, value-based discount instruments."""
    __tablename__ = "gift_vouchers"

    voucher_no    = Column(String(40), unique=True, nullable=False, index=True)
    voucher_type  = Column(String(20), nullable=False, default="FIXED")     # FIXED | PCT
    status        = Column(String(20), nullable=False, default="ACTIVE")    # ACTIVE | USED | EXPIRED | CANCELLED
    face_value    = Column(Numeric(15, 2), nullable=False, default=0)
    pct_discount  = Column(Numeric(5, 2), nullable=True)
    min_order_value = Column(Numeric(15, 2), nullable=True)
    max_discount  = Column(Numeric(15, 2), nullable=True)
    issued_to     = Column(String(100), nullable=True)
    issued_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    used_at       = Column(DateTime, nullable=True)
    valid_from    = Column(DateTime, nullable=True)
    valid_to      = Column(DateTime, nullable=True)
    redeemed_invoice_no = Column(String(80), nullable=True)
    notes         = Column(Text, nullable=True)
