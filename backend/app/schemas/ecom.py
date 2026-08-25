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
# eCommerce Channel Configuration
# ---------------------------------------------------------------------------
class ChannelCreateReq(BaseModel):
    channel_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    channel_type: str = Field(..., description="SHOPIFY, WOOCOMMERCE, AMAZON, FLIPKART, INTERNAL_STORE, CUSTOMER_PORTAL")
    store_url: Optional[str] = None
    credential_ref: Optional[str] = None
    webhook_secret: Optional[str] = None
    sync_inventory: bool = True
    sync_pricing: bool = True
    auto_converge_orders: bool = True
    settings: Optional[Dict[str, Any]] = None


class ChannelResponse(BaseModel):
    id: str
    channel_code: str
    name: str
    channel_type: str
    store_url: Optional[str] = None
    is_active: bool
    sync_inventory: bool
    sync_pricing: bool
    auto_converge_orders: bool


# ---------------------------------------------------------------------------
# SKU Mapping
# ---------------------------------------------------------------------------
class SkuMappingReq(BaseModel):
    channel_code: str
    external_sku: str
    external_product_id: Optional[str] = None
    smriti_sku: str
    item_id: str
    variant_id: Optional[str] = None


class SkuMappingResponse(BaseModel):
    id: str
    channel_code: str
    external_sku: str
    external_product_id: Optional[str] = None
    smriti_sku: str
    item_id: str
    variant_id: Optional[str] = None
    is_active: bool


# ---------------------------------------------------------------------------
# Webhook Ingress & Order Convergence
# ---------------------------------------------------------------------------
class EcomOrderItemLine(BaseModel):
    sku: str
    quantity: Decimal
    unit_price: Decimal
    tax_amount: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")


class InboundOrderPayload(BaseModel):
    channel_code: str
    external_order_id: str
    external_order_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_mobile: Optional[str] = None
    currency: str = "INR"
    gross_amount: Decimal
    tax_amount: Decimal = Decimal("0.00")
    shipping_amount: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    net_amount: Decimal
    line_items: List[EcomOrderItemLine] = []
    raw_payload: Optional[Dict[str, Any]] = None


class OrderImportResponse(BaseModel):
    id: str
    channel_code: str
    external_order_id: str
    order_status: str
    idempotency_key: Optional[str] = None
    gross_amount: Decimal
    net_amount: Decimal
    converged_invoice_id: Optional[str] = None
    error_message: Optional[str] = None


class OrderConvergenceResponse(BaseModel):
    success: bool
    import_id: str
    channel_code: str
    external_order_id: str
    status: str
    invoice_id: Optional[str] = None
    invoice_no: Optional[str] = None
    reserved_sku_list: List[str] = []
    message: str


# ---------------------------------------------------------------------------
# Stock Broadcast
# ---------------------------------------------------------------------------
class StockBroadcastReq(BaseModel):
    channel_code: str
    sku: str
    available_stock: Decimal


class StockBroadcastResponse(BaseModel):
    success: bool
    channel_code: str
    sku: str
    synced_quantity: Decimal
    status: str


# ---------------------------------------------------------------------------
# Reconciliation & DLQ
# ---------------------------------------------------------------------------
class ReconciliationRunReq(BaseModel):
    channel_code: str
    period_start: date
    period_end: date
    channel_gross_revenue: Decimal
    channel_order_count: int


class ReconciliationReportResponse(BaseModel):
    id: str
    reconciliation_no: str
    channel_code: str
    period_start: date
    period_end: date
    channel_order_count: int
    channel_gross_revenue: Decimal
    smriti_order_count: int
    smriti_gross_revenue: Decimal
    variance_amount: Decimal
    status: str


class DlqRetryReq(BaseModel):
    import_ids: List[str] = Field(..., min_length=1)


class DlqRetryResponse(BaseModel):
    processed_count: int
    succeeded_count: int
    failed_count: int
    results: List[Dict[str, Any]] = []
