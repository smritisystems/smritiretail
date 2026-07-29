"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from datetime import date
from sqlalchemy import Column, String, Numeric, Date, Text, Index
from app.db.base import BaseEntity


class GSTReconciliationRecord(BaseEntity):
    """
    Detailed ITC reconciliation matching record comparing Purchase Register entries against GSTR-2B API statements.
    """
    __tablename__ = "gst_reconciliation_records"

    gstin = Column(String(15), nullable=False, index=True)
    financial_period = Column(String(10), nullable=False, index=True)  # MMYYYY e.g., 072026
    
    supplier_gstin = Column(String(15), nullable=False, index=True)
    supplier_name = Column(String(255), nullable=True)
    invoice_number = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)
    
    purchase_taxable_value = Column(Numeric(15, 2), default=0.00)
    purchase_tax_amount = Column(Numeric(15, 2), default=0.00)
    
    gstr2b_taxable_value = Column(Numeric(15, 2), default=0.00)
    gstr2b_tax_amount = Column(Numeric(15, 2), default=0.00)
    
    variance_amount = Column(Numeric(15, 2), default=0.00)
    reconciliation_status = Column(String(30), nullable=False, default="PENDING", index=True)
    # MATCHED | MISMATCHED_AMOUNT | MISSING_IN_PURCHASE | MISSING_IN_GSTR2B | INELIGIBLE_ITC
    
    remarks = Column(Text, nullable=True)
