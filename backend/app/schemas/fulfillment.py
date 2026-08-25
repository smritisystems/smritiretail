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

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# PACKING SLIP SCHEMAS
# ============================================================================

class PackingSlipItemCreate(BaseModel):
    product_id: str
    sku: str
    quantity: Decimal = Field(..., gt=0)
    batch_number: Optional[str] = None


class PackingSlipCreateRequest(BaseModel):
    sales_invoice_id: str
    packed_by_user_id: Optional[str] = None
    total_packages: int = Field(1, ge=1)
    weight_kg: Decimal = Field(Decimal("0.500"), ge=0)
    items: List[PackingSlipItemCreate] = Field(..., min_length=1)


class PackingSlipItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    sku: str
    quantity: Decimal
    batch_number: Optional[str] = None


class PackingSlipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    packing_slip_number: str
    sales_invoice_id: str
    packed_by_user_id: Optional[str] = None
    status: str
    total_packages: int
    weight_kg: Decimal
    items: List[PackingSlipItemResponse] = Field(default_factory=list)
    created_at: datetime


# ============================================================================
# DISPATCH SCHEMAS
# ============================================================================

class DispatchItemCreate(BaseModel):
    product_id: str
    quantity: Decimal = Field(..., gt=0)


class DispatchCreateRequest(BaseModel):
    packing_slip_id: str
    courier_partner: Optional[str] = "Delhivery"  # BlueDart, Delhivery, In-House Driver
    tracking_number: Optional[str] = None
    driver_person_id: Optional[str] = None
    delivery_fee: Decimal = Field(Decimal("0.00"), ge=0)
    driver_commission: Decimal = Field(Decimal("50.00"), ge=0)
    items: Optional[List[DispatchItemCreate]] = None


class DispatchItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    quantity: Decimal


class DispatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    dispatch_number: str
    packing_slip_id: str
    courier_partner: Optional[str] = None
    tracking_number: Optional[str] = None
    driver_person_id: Optional[str] = None
    status: str
    dispatch_date: datetime
    delivered_date: Optional[datetime] = None
    delivery_fee: Decimal
    driver_commission: Decimal
    items: List[DispatchItemResponse] = Field(default_factory=list)


# ============================================================================
# DELIVERY STATUS & TRACKING SCHEMAS
# ============================================================================

class DeliveryStatusUpdateRequest(BaseModel):
    dispatch_id: str
    status: str = Field(..., description="DISPATCHED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RETURNED, FAILED")
    notes: Optional[str] = None


class DeliveryTrackingResponse(BaseModel):
    dispatch_number: str
    tracking_number: Optional[str] = None
    courier_partner: Optional[str] = None
    current_status: str
    dispatch_date: datetime
    delivered_date: Optional[datetime] = None
    commission_settled: bool


# ============================================================================
# REVERSE LOGISTICS & TIMELINE SCHEMAS
# ============================================================================

class ReverseLogisticsCreateRequest(BaseModel):
    original_dispatch_id: str
    sales_return_id: str
    reason: Optional[str] = None
    restock_status: str = Field("RESTOCKED", description="RESTOCKED, SCRAPPED, INSPECTION")


class ReverseLogisticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    return_manifest_number: str
    original_dispatch_id: str
    sales_return_id: str
    reason: Optional[str] = None
    restock_status: str
    commission_reversed: bool
    timestamp: datetime


class FulfillmentTimelineEvent(BaseModel):
    stage: str
    reference_number: str
    status: str
    timestamp: datetime
    details: Dict[str, Any] = Field(default_factory=dict)


class FulfillmentTimelineResponse(BaseModel):
    sales_invoice_id: str
    current_stage: str
    events: List[FulfillmentTimelineEvent] = Field(default_factory=list)
