"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.13.0
* Created    : 2026-07-11
* Modified   : 2026-07-11
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
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
