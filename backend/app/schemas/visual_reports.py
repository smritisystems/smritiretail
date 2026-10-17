"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.94.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Visual Reports Dashboard Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
from decimal import Decimal


class VisualKpiCard(BaseModel):
    id: str
    title: str
    value: str
    numeric_value: float
    unit: Optional[str] = None
    subtext: Optional[str] = None
    trend_direction: str = "up"  # "up" or "down"
    trend_percentage: Optional[str] = None
    color: str  # blue, amber, green, purple, orange


class StockFlowDataPoint(BaseModel):
    date: str
    day_label: str
    on_hand: int
    reserved: int
    available: int
    dispatched: int
    invoiced: int


class WorkflowStageProgress(BaseModel):
    id: str
    title: str
    icon: str
    count: int
    percentage: int
    color: str
    subtext: str
    progress_bar_percentage: int


class CategoryStockPosition(BaseModel):
    category: str
    on_hand: int
    reserved: int
    available: int
    reserved_pct: float


class TopReservedSku(BaseModel):
    rank: int
    sku: str
    product_name: str
    on_hand: int
    reserved: int
    reserved_pct: float


class PackingSlipStatusSlice(BaseModel):
    status: str
    count: int
    percentage: float
    color: str


class DispatchInvoiceSummaryRow(BaseModel):
    document_type: str
    today: int
    this_week: int
    this_month: int
    value_inr: float
    formatted_value: str


class FulfillmentStreamItem(BaseModel):
    id: str
    doc_type: str  # SO, PS, DS, INV
    doc_number: str
    doc_date: str
    customer_name: str
    item_summary: str
    quantity: int
    value_inr: float
    formatted_value: str
    status: str
    status_color: str
    next_action: str
    next_action_icon: str
    updated_by: str
    updated_on: str


class DashboardConfigPayload(BaseModel):
    layout_mode: str = "focused"  # "standard" | "focused"
    kpi_cards_visible: Dict[str, bool] = Field(default_factory=dict)
    charts_visible: Dict[str, bool] = Field(default_factory=dict)
    stock_flow_chart_type: str = "line"  # "line" | "area" | "bar"
    table_view: str = "active_stream"
    default_tab: str = "all"
    rows_per_page: int = 10
    color_theme_mode: str = "system"  # "system" | "custom"
    custom_accent_color: str = "#2563eb"


class VisualReportsSummaryResponse(BaseModel):
    company_name: str
    location_name: str
    date_range_label: str
    kpis: List[VisualKpiCard]
    stock_flow_timeline: List[StockFlowDataPoint]
    workflow_stages: List[WorkflowStageProgress]
    category_positions: List[CategoryStockPosition]
    top_reserved_skus: List[TopReservedSku]
    packing_slip_donut: List[PackingSlipStatusSlice]
    total_packing_slips_count: int
    dispatch_invoice_summary: List[DispatchInvoiceSummaryRow]
    fulfillment_stream: List[FulfillmentStreamItem]
    config: DashboardConfigPayload
