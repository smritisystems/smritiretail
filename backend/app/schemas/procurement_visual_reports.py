"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.95.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Procurement Visual Reports Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal


class ProcurementKpiCard(BaseModel):
    id: str
    title: str
    value: str
    numeric_value: float
    unit: Optional[str] = None
    subtext: Optional[str] = None
    trend_direction: str = "up"  # "up" | "down"
    trend_percentage: str
    color: str
    icon_name: str
    progress_percentage: Optional[float] = None
    progress_label: Optional[str] = None


class PurchaseSpendTrendPoint(BaseModel):
    period: str
    month_label: str
    ordered_value: float
    received_value: float
    invoiced_value: float
    po_count: int
    ordered_qty: Optional[float] = 0.0
    received_qty: Optional[float] = 0.0


class PurchaseToReceiptStage(BaseModel):
    stage_id: str
    stage_name: str
    count: int
    percentage: int
    subtext_left: str
    subtext_right: str
    color: str
    icon_name: str


class TopSupplierSpend(BaseModel):
    supplier_id: str
    supplier_name: str
    spend_value: float
    formatted_spend: str
    percentage: float
    bar_color: str


class PurchaseOrderStatusSlice(BaseModel):
    status_id: str
    status_name: str
    count: int
    percentage: int
    color: str


class ReorderAlertItem(BaseModel):
    sku: str
    product_name: str
    on_hand: float
    reorder_level: float
    suggested_po_qty: float
    urgency: str = "normal"  # "critical" | "warning" | "normal"


class SupplierPerformanceItem(BaseModel):
    supplier_id: str
    supplier_name: str
    on_time_delivery_pct: Optional[int] = None
    lead_time_days: int


class OpenPoReceiptItem(BaseModel):
    po_no: str
    po_date: str
    supplier_name: str
    ordered_qty: float
    received_qty: float
    pending_qty: float
    purchase_value: float
    formatted_value: str
    status: str
    status_badge: str


class ActiveProcurementStreamItem(BaseModel):
    id: str
    doc_type: str  # "PO" | "GR" | "PI"
    doc_no: str
    date: str
    supplier: str
    item_sku: str
    qty: float
    unit: str = "pairs"
    value: float
    formatted_value: str
    status: str
    status_badge: str
    next_action: Optional[str] = None
    next_action_label: Optional[str] = None
    updated_by: str
    updated_on: str


class ProcurementDashboardConfigPayload(BaseModel):
    layout_mode: str = "standard"  # "standard" (3 Deck) | "compact" (2 Deck)
    kpi_cards_visible: Dict[str, bool] = Field(default_factory=dict)
    charts_visible: Dict[str, bool] = Field(default_factory=dict)
    chart_types: Dict[str, str] = Field(default_factory=dict)
    tables_visible: Dict[str, bool] = Field(default_factory=dict)
    data_display: Dict[str, Any] = Field(default_factory=dict)
    color_theme: str = "system"  # "system" | "custom"
    custom_palette_color: Optional[str] = "#0284c7"


class ProcurementReportsSummaryResponse(BaseModel):
    company_name: str
    store_location_name: str
    date_range_label: str
    kpi_cards: List[ProcurementKpiCard]
    spend_trend: List[PurchaseSpendTrendPoint]
    workflow_stages: List[PurchaseToReceiptStage]
    top_suppliers: List[TopSupplierSpend]
    po_status_breakdown: List[PurchaseOrderStatusSlice]
    total_pos_for_status: int
    reorder_alerts: List[ReorderAlertItem]
    supplier_performance: List[SupplierPerformanceItem]
    open_pos_and_receipts: List[OpenPoReceiptItem]
    fulfillment_stream: List[ActiveProcurementStreamItem]
    stream_counts: Dict[str, int]
    active_filters_count: int
    config: ProcurementDashboardConfigPayload
