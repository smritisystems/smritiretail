"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# --- Warehouse Schemas ---
class WarehouseBase(BaseModel):
    code: str
    name: str
    is_transit: bool = False
    is_central_godown: bool = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    is_central_godown: Optional[bool] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseResponse(WarehouseBase):
    id: str
    company_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Product Batch Stock Schemas ---
class ProductBatchStockResponse(BaseModel):
    id: str
    product_id: str
    warehouse_id: str
    batch_no: str
    mfg_date: Optional[date] = None
    expiry_date: Optional[date] = None
    mrp: Optional[Decimal] = None
    purchase_rate: Optional[Decimal] = None
    sale_rate: Optional[Decimal] = None
    quantity: Decimal
    reserved_quantity: Decimal
    damaged_quantity: Decimal
    available_quantity: Optional[Decimal] = None
    last_counted_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BatchAllocationItem(BaseModel):
    batch_id: str
    batch_no: str
    allocated_quantity: float
    mfg_date: Optional[date] = None
    expiry_date: Optional[date] = None
    mrp: Optional[float] = None
    purchase_rate: Optional[float] = None
    sale_rate: Optional[float] = None


class BatchAllocationRequest(BaseModel):
    product_id: str
    warehouse_id: str
    quantity: Decimal


# --- Stock Transfer Schemas ---
class StockTransferItemCreate(BaseModel):
    product_id: str
    batch_no: str
    quantity: Decimal
    unit_cost: Optional[Decimal] = Decimal("0.00")
    notes: Optional[str] = None

class StockTransferItemResponse(BaseModel):
    id: str
    transfer_id: str
    product_id: str
    batch_no: str
    quantity_dispatched: Decimal
    quantity_received: Decimal
    quantity_shortage: Decimal
    quantity_damaged: Decimal
    unit_cost: Decimal
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StockTransferCreate(BaseModel):
    source_warehouse_id: str
    dest_warehouse_id: str
    items: List[StockTransferItemCreate]
    transporter_name: Optional[str] = None
    lr_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    notes: Optional[str] = None

class StockTransferReceiptItem(BaseModel):
    item_id: str
    quantity_received: Decimal
    quantity_shortage: Optional[Decimal] = Decimal("0.0000")
    quantity_damaged: Optional[Decimal] = Decimal("0.0000")

class StockTransferReceiptRequest(BaseModel):
    receipt_details: List[StockTransferReceiptItem]

class StockTransferResponse(BaseModel):
    id: str
    transfer_no: str
    source_warehouse_id: str
    dest_warehouse_id: str
    status: str
    dispatch_date: Optional[datetime] = None
    received_date: Optional[datetime] = None
    transporter_name: Optional[str] = None
    lr_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    e_way_bill_no: Optional[str] = None
    notes: Optional[str] = None
    items: List[StockTransferItemResponse] = []
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
