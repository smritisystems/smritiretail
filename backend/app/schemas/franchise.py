"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 21.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pydantic DTO Schemas for Franchise & Royalty Engine
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict


class FranchiseStoreCreate(BaseModel):
    store_code: str
    store_name: str
    store_type: str = "FOFO"
    royalty_percentage: float = 5.0
    tech_fee_monthly: float = 250.0


class RoyaltyCalculationResponse(BaseModel):
    store_code: str
    gross_sales: float
    royalty_percentage: float
    royalty_amount: float
    tech_fee: float
    total_due_to_headquarters: float
