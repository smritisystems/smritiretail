"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

from datetime import datetime
from sqlalchemy import Column, String, Numeric, ForeignKey, Date, Text
from ..db.base import BaseEntity


class SupplierPayment(BaseEntity):
    """
    Records a cash/bank/cheque payment made to a supplier.

    On creation, `supplier.outstanding` is decremented atomically.

    Business rules:
    - Amount must be > 0.
    - Amount must not exceed supplier.outstanding at time of payment
      (overpayment guard — configurable; currently enforced).
    - payment_mode: CASH | BANK_TRANSFER | CHEQUE | UPI
    - reference_no: cheque number, UTR, transaction ID, etc.
    """
    __tablename__ = "supplier_payments"

    supplier_id    = Column(String(50),  ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount         = Column(Numeric(15, 2), nullable=False)
    payment_mode   = Column(String(30),  nullable=False, default="CASH")   # CASH | BANK_TRANSFER | CHEQUE | UPI
    payment_date   = Column(Date,        nullable=False)
    reference_no   = Column(String(100), nullable=True)
    notes          = Column(Text,        nullable=True)
