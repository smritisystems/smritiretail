"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class SalesOrderItemCreate(BaseModel):
    product_id: str
    ordered_quantity: Decimal
    unit_price: Decimal


class SalesOrderCreate(BaseModel):
    order_no: str
    customer_id: str
    notes: Optional[str] = None
    items: List[SalesOrderItemCreate] = []


class SalesOrderItemResponse(BaseModel):
    id: str
    order_id: str
    product_id: str
    ordered_quantity: Decimal
    reserved_quantity: Decimal
    unit_price: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class SalesOrderResponse(BaseModel):
    id: str
    order_no: str
    customer_id: str
    subtotal: Decimal
    tax_total: Decimal
    grand_total: Decimal
    status: str
    fulfillment_status: str
    payment_status: str
    notes: Optional[str] = None
    created_at: datetime
    items: List[SalesOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FulfillmentWaveRequest(BaseModel):
    order_ids: List[str]


class PickListItemResponse(BaseModel):
    id: str
    pick_list_id: str
    order_id: str
    product_id: str
    quantity_to_pick: Decimal
    quantity_picked: Decimal
    status: str

    model_config = ConfigDict(from_attributes=True)


class PickListResponse(BaseModel):
    id: str
    pick_list_no: str
    wave_id: str
    status: str
    items: List[PickListItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class FulfillmentWaveResponse(BaseModel):
    id: str
    wave_no: str
    status: str
    total_orders: int
    total_items: int
    created_at: datetime
    pick_lists: List[PickListResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PackShipmentRequest(BaseModel):
    order_id: str
    wave_id: Optional[str] = None
    carrier: Optional[str] = "Standard Express"
    tracking_no: Optional[str] = None
    weight_kg: Decimal = Decimal("1.500")
    shipping_cost: Decimal = Decimal("50.00")


class ShipmentPackageResponse(BaseModel):
    id: str
    package_no: str
    order_id: str
    wave_id: Optional[str] = None
    carrier: Optional[str] = None
    tracking_no: Optional[str] = None
    weight_kg: Decimal
    shipping_cost: Decimal
    status: str
    dispatch_date: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
