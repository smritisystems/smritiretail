# -*- coding: utf-8 -*-
"""
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.51.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
"""

from decimal import Decimal
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class TdsCalculationRequest(BaseModel):
    gross_amount: Decimal = Field(..., gt=0, description="Gross transactional amount subject to TDS")
    section: str = Field("194Q", description="Income Tax Section (194Q, 194C, 194J, 194H, 194I)")
    pan: Optional[str] = Field(None, description="10-digit Permanent Account Number of supplier")
    is_company_or_firm: Optional[bool] = Field(None, description="True if entity is Company/Firm/LLP, False if Individual/HUF")
    custom_rate: Optional[Decimal] = Field(None, description="Explicit override rate (e.g. from lower deduction certificate)")

    model_config = ConfigDict(from_attributes=True)


class TdsCalculationResult(BaseModel):
    gross_amount: Decimal
    section: str
    pan: Optional[str] = None
    has_valid_pan: bool = True
    rate_percentage: Decimal
    tds_amount: Decimal
    net_payable: Decimal
    is_penal_rate: bool = False
    legal_provision: str

    model_config = ConfigDict(from_attributes=True)


class TdsVendorSummaryResponse(BaseModel):
    company_id: str
    supplier_id: str
    supplier_code: str
    supplier_name: str
    pan: Optional[str] = None
    has_valid_pan: bool = True
    active_section: Optional[str] = "194Q"
    active_rate: Decimal = Decimal("0.10")
    total_invoiced_fy: Decimal = Decimal("0.00")
    total_tds_deducted_fy: Decimal = Decimal("0.00")
    section_breakdown: Dict[str, Decimal] = Field(default_factory=dict)
    threshold_applicable: bool = True
    threshold_limit: Decimal = Decimal("5000000.00")  # ₹50 Lakhs for 194Q
    threshold_exceeded: bool = False

    model_config = ConfigDict(from_attributes=True)
