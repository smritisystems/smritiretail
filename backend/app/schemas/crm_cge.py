"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field


class LeadStatus(str, Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    PROPOSAL = "PROPOSAL"
    WON = "WON"
    LOST = "LOST"
    DISQUALIFIED = "DISQUALIFIED"


class OpportunityStage(str, Enum):
    PROSPECTING = "PROSPECTING"
    QUALIFICATION = "QUALIFICATION"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"


class CustomerSegment(str, Enum):
    VIP = "VIP"
    FREQUENT = "FREQUENT"
    AT_RISK = "AT_RISK"
    DORMANT = "DORMANT"
    NEW = "NEW"


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------
class LeadCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    mobile: Optional[str] = Field(None, max_length=30)
    lead_source: str = Field(default="DIRECT")
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    company_name: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    mobile: Optional[str] = Field(None, max_length=30)
    status: Optional[LeadStatus] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    lead_no: str
    first_name: str
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    lead_source: str
    status: str
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Opportunities / Deals
# ---------------------------------------------------------------------------
class OpportunityCreate(BaseModel):
    name: str = Field(..., max_length=255)
    lead_id: Optional[str] = None
    customer_id: Optional[str] = None
    stage: OpportunityStage = Field(default=OpportunityStage.PROSPECTING)
    probability_percent: Decimal = Field(default=Decimal("10.00"))
    expected_revenue: Decimal = Field(default=Decimal("0.00"))
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = None


class OpportunityUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    stage: Optional[OpportunityStage] = None
    probability_percent: Optional[Decimal] = None
    expected_revenue: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = None


class OpportunityResponse(BaseModel):
    id: str
    opp_no: str
    name: str
    lead_id: Optional[str] = None
    customer_id: Optional[str] = None
    stage: str
    probability_percent: Decimal
    expected_revenue: Decimal
    expected_close_date: Optional[date] = None
    assigned_to: Optional[str] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Customer RFM & Segmentation
# ---------------------------------------------------------------------------
class CustomerSegmentationResponse(BaseModel):
    customer_id: str
    customer_name: str
    recency_days: int
    frequency_orders: int
    monetary_total_spend: Decimal
    rfm_score: str
    segment: CustomerSegment
    loyalty_tier: Optional[str] = None
    points_balance: Decimal = Decimal("0.00")


# ---------------------------------------------------------------------------
# Loyalty & Points Ledger
# ---------------------------------------------------------------------------
class LoyaltyMemberEnrollRequest(BaseModel):
    customer_id: str
    card_number: Optional[str] = None
    loyalty_tier_id: Optional[str] = None


class LoyaltyMemberResponse(BaseModel):
    id: str
    customer_id: str
    card_number: Optional[str] = None
    loyalty_tier_id: Optional[str] = None
    total_points_earned: Decimal
    total_points_redeemed: Decimal
    current_points_balance: Decimal
    total_lifetime_spend: Decimal
    joined_date: Optional[datetime] = None


class PointsAdjustmentRequest(BaseModel):
    member_id: str
    transaction_type: str = Field(..., description="EARN, REDEEM, ADJUSTMENT, BONUS, EXPIRY, REVERSAL")
    points: Decimal = Field(..., description="Positive for earn/adjustment, negative for redeem/burn")
    reference_invoice_id: Optional[str] = None
    reference_return_id: Optional[str] = None
    narration: Optional[str] = None


class LoyaltyLedgerItemResponse(BaseModel):
    id: str
    member_id: str
    transaction_type: str
    points: Decimal
    reference_invoice_id: Optional[str] = None
    reference_return_id: Optional[str] = None
    narration: Optional[str] = None
    timestamp: Optional[datetime] = None


class LoyaltyLedgerListResponse(BaseModel):
    total: int
    current_balance: Decimal
    items: List[LoyaltyLedgerItemResponse]


# ---------------------------------------------------------------------------
# Commission & Incentive Governance
# ---------------------------------------------------------------------------
class CalculateCommissionRequest(BaseModel):
    participant_id: str
    participant_role: str = Field(default="SALESPERSON", description="SALESPERSON, DRIVER, AGENT, REFERRER")
    invoice_id: Optional[str] = None
    gross_sales_amount: Decimal = Field(default=Decimal("0.00"))
    fixed_order_delivery: bool = False


class CalculateCommissionResponse(BaseModel):
    success: bool
    participant_id: str
    participant_role: str
    gross_sales_amount: Decimal
    commission_amount: Decimal
    calculation_rule_applied: str
    ledger_id: Optional[str] = None


class CommissionLedgerItemResponse(BaseModel):
    id: str
    participant_id: str
    participant_role: str
    transaction_type: str
    gross_sales_amount: Decimal
    commission_amount: Decimal
    reference_invoice_id: Optional[str] = None
    reference_return_id: Optional[str] = None
    narration: Optional[str] = None
    timestamp: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Referral Engine
# ---------------------------------------------------------------------------
class ReferralEnrollRequest(BaseModel):
    program_id: str
    referrer_person_id: str
    referred_customer_id: str
    referral_code: str


class ReferralRelationshipResponse(BaseModel):
    id: str
    program_id: str
    referrer_person_id: str
    referred_customer_id: str
    referral_code_used: str
    status: str
    created_at: Optional[datetime] = None


class ReferralRewardCreditRequest(BaseModel):
    relationship_id: str
    invoice_id: Optional[str] = None
    qualifying_order_amount: Decimal = Field(default=Decimal("0.00"))


class ReferralRewardResponse(BaseModel):
    success: bool
    reward_id: str
    referrer_person_id: str
    reward_amount: Decimal
    status: str
    narration: Optional[str] = None
