"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.17.1
Created      : 2026-09-14
Modified     : 2026-09-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SalesFactorDTO(BaseModel):
    """Authoritative DTO for Sales Factor master."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    description: str
    factor_type: str = Field("ADD_ON", description="RETAIL_PRICE_FACTOR, PRICE_ROUND_OFF, ADD_ON, DEDUCTION, BILL_ROUND_OFF")
    factor_category: str = Field("ALL_CUSTOMERS", description="CUSTOMER_SPECIFIC, PRICE_GROUP_SPECIFIC, ALL_CUSTOMERS")
    customer_id: Optional[str] = None
    price_group_code: Optional[str] = None
    applicable_categories: List[str] = Field(default_factory=list)
    applicable_brands: List[str] = Field(default_factory=list)
    computation_timing: str = Field("ABOVE_TAX", description="ABOVE_TAX (Consider for Tax), BELOW_TAX (Ignore for Tax)")
    computed_on: str = Field("DISCOUNTED_VALUE", description="SALE_VALUE_BEFORE_DISCOUNT, DISCOUNTED_VALUE, VALUE_INCLUSIVE_OF_TAX")
    rate_or_amount: str = Field("RATE", description="RATE (%), AMOUNT (₹)")
    value: float = Field(0.0, ge=0.0)
    is_variable: bool = False
    min_bill_value: Optional[float] = None
    max_bill_value: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    applicable_days: List[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SalesFactorUpsertRequest(BaseModel):
    """Payload to create or update a sales factor."""
    id: Optional[str] = None
    code: str = Field(..., max_length=50)
    description: str = Field(..., max_length=200)
    factor_type: str = Field("ADD_ON")
    factor_category: str = Field("ALL_CUSTOMERS")
    customer_id: Optional[str] = None
    price_group_code: Optional[str] = None
    applicable_categories: List[str] = Field(default_factory=list)
    applicable_brands: List[str] = Field(default_factory=list)
    computation_timing: str = Field("ABOVE_TAX")
    computed_on: str = Field("DISCOUNTED_VALUE")
    rate_or_amount: str = Field("RATE")
    value: float = Field(0.0, ge=0.0)
    is_variable: bool = False
    min_bill_value: Optional[float] = None
    max_bill_value: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    applicable_days: List[str] = Field(default_factory=list)
    is_active: bool = True


class SalesFactorEvaluationRequest(BaseModel):
    """Evaluate applicable sales factors on cart totals."""
    customer_id: Optional[str] = None
    customer_price_group_code: Optional[str] = None
    gross_amount: float = Field(..., ge=0.0)
    discount_amount: float = Field(0.0, ge=0.0)
    tax_rate: float = Field(0.0, ge=0.0)
    channel: str = Field("POS")


class EvaluatedFactorItem(BaseModel):
    code: str
    description: str
    factor_type: str
    computation_timing: str
    rate_or_amount: str
    rate: float = 0.0
    amount: float = 0.0


class SalesFactorEvaluationResponse(BaseModel):
    above_tax_addons: float = 0.0
    above_tax_deductions: float = 0.0
    adjusted_taxable_value: float
    calculated_tax_amount: float
    below_tax_addons: float = 0.0
    below_tax_deductions: float = 0.0
    bill_round_off: float = 0.0
    net_payable: float
    applied_factors: List[EvaluatedFactorItem] = Field(default_factory=list)
