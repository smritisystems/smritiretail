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
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Territories & Dealer Assignments
# ---------------------------------------------------------------------------
class TerritoryCreateReq(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    region: str = Field(default="WEST")
    parent_code: Optional[str] = None


class TerritoryResponse(BaseModel):
    id: str
    code: str
    name: str
    region: str
    parent_territory_code: Optional[str] = None
    status: str


class DealerAssignReq(BaseModel):
    party_id: str
    territory_code: str
    salesman_id: Optional[str] = None
    credit_limit: Decimal = Field(default=Decimal("500000.00"))
    credit_days: int = Field(default=30)


class DealerAssignResponse(BaseModel):
    id: str
    party_id: str
    territory_code: str
    salesman_id: Optional[str] = None
    credit_limit: Decimal
    credit_days: int
    is_active: bool


# ---------------------------------------------------------------------------
# Distribution Routes & Stops
# ---------------------------------------------------------------------------
class RouteStopReq(BaseModel):
    party_id: str
    stop_sequence: int = 1
    planned_time: Optional[str] = None


class RouteCreateReq(BaseModel):
    route_code: str
    name: str
    territory_code: str
    assigned_salesman_id: Optional[str] = None
    assigned_driver_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    stops: Optional[List[RouteStopReq]] = None


class RouteStopResponse(BaseModel):
    id: str
    party_id: str
    stop_sequence: int
    planned_time: Optional[str] = None
    is_active: bool


class RouteResponse(BaseModel):
    id: str
    route_code: str
    name: str
    territory_code: str
    assigned_salesman_id: Optional[str] = None
    assigned_driver_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    status: str
    stops: List[RouteStopResponse] = []


# ---------------------------------------------------------------------------
# Distribution Orders (Primary & Secondary)
# ---------------------------------------------------------------------------
class OrderLineReq(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: Decimal = Field(default=Decimal("1.0000"), gt=0)


class DistributionOrderCreateReq(BaseModel):
    party_id: str
    order_type: str = Field(default="PRIMARY", description="PRIMARY or SECONDARY")
    territory_code: Optional[str] = None
    salesman_id: Optional[str] = None
    route_id: Optional[str] = None
    delivery_route: Optional[str] = None
    line_items: List[OrderLineReq]
    supplier_state: str = "27"
    recipient_state: str = "27"
    price_book_code: Optional[str] = None


class DistributionOrderItemResponse(BaseModel):
    id: str
    item_id: str
    variant_id: Optional[str] = None
    quantity: Decimal
    unit_price: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    line_total: Decimal


class DistributionOrderResponse(BaseModel):
    id: str
    order_no: str
    party_id: str
    order_type: str
    status: str
    territory_code: Optional[str] = None
    salesman_id: Optional[str] = None
    delivery_route: Optional[str] = None
    delivery_challan_no: Optional[str] = None
    taxable_amount: Decimal
    tax_total: Decimal
    grand_total: Decimal
    governance_snapshot_id: Optional[str] = None
    lines: List[DistributionOrderItemResponse] = []


# ---------------------------------------------------------------------------
# Loading Sheets
# ---------------------------------------------------------------------------
class LoadingSheetCreateReq(BaseModel):
    route_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    dispatch_date: Optional[date] = None
    order_ids: List[str] = Field(..., min_length=1)


class LoadingSheetItemResponse(BaseModel):
    id: str
    order_id: str
    item_id: str
    loaded_quantity: Decimal
    returned_quantity: Decimal


class LoadingSheetResponse(BaseModel):
    id: str
    sheet_no: str
    route_id: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    dispatch_date: Optional[date] = None
    status: str
    total_orders_count: int
    total_boxes: int
    total_value: Decimal
    items: List[LoadingSheetItemResponse] = []


# ---------------------------------------------------------------------------
# Claims Workflow
# ---------------------------------------------------------------------------
class ClaimSubmitReq(BaseModel):
    party_id: str
    claim_type: str = Field(..., description="DAMAGE, EXPIRY, PRICE_DIFF, SCHEME_INCENTIVE, SHORTAGE")
    reference_order_no: Optional[str] = None
    claim_amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = None


class ClaimReviewReq(BaseModel):
    approved_amount: Decimal
    status: str = Field(..., description="APPROVED or REJECTED")
    remarks: Optional[str] = None


class ClaimResponse(BaseModel):
    id: str
    claim_no: str
    party_id: str
    claim_type: str
    reference_order_no: Optional[str] = None
    claim_amount: Decimal
    approved_amount: Optional[Decimal] = None
    status: str
    reviewed_by: Optional[str] = None
    settlement_credit_note_id: Optional[str] = None
    remarks: Optional[str] = None


# ---------------------------------------------------------------------------
# Route Settlement
# ---------------------------------------------------------------------------
class SettlementCreateReq(BaseModel):
    loading_sheet_id: str
    route_id: Optional[str] = None
    driver_id: Optional[str] = None
    salesman_id: Optional[str] = None
    cash_collected: Decimal = Decimal("0.00")
    cheques_collected: Decimal = Decimal("0.00")
    upi_collected: Decimal = Decimal("0.00")
    credit_extended: Decimal = Decimal("0.00")
    returned_stock_value: Decimal = Decimal("0.00")


class SettlementResponse(BaseModel):
    id: str
    settlement_no: str
    loading_sheet_id: Optional[str] = None
    route_id: Optional[str] = None
    total_sales_value: Decimal
    cash_collected: Decimal
    cheques_collected: Decimal
    upi_collected: Decimal
    credit_extended: Decimal
    returned_stock_value: Decimal
    shortage_excess_amount: Decimal
    status: str
    settled_at: Optional[datetime] = None
