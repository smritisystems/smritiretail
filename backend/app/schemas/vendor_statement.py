# -*- coding: utf-8 -*-
"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class VendorStatementLine(BaseModel):
    id: str
    date: date
    voucher_no: str
    voucher_type: str
    reference_doc_type: Optional[str] = None
    reference_doc_no: Optional[str] = None
    account_code: str
    account_name: str
    narration: Optional[str] = None
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    running_balance: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class VendorStatementSummary(BaseModel):
    opening_balance: Decimal = Decimal("0.00")
    total_billed: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    total_knocked_off: Decimal = Decimal("0.00")
    total_debit_notes: Decimal = Decimal("0.00")
    closing_balance: Decimal = Decimal("0.00")
    unallocated_advance: Decimal = Decimal("0.00")
    net_payable: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class VendorStatementSupplier(BaseModel):
    id: str
    code: str
    name: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30

    model_config = ConfigDict(from_attributes=True)


class VendorStatementResponse(BaseModel):
    company_id: str
    company_name: str
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    supplier: VendorStatementSupplier
    summary: VendorStatementSummary
    lines: List[VendorStatementLine] = []
    unpaid_bills_count: int = 0
    active_advances_count: int = 0
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
