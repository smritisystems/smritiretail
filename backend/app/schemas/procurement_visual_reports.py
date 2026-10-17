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
    article_breakdown: Dict[str, float] = Field(default_factory=dict)


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


class ArticleSpendItem(BaseModel):
    article: str
    spend_value: float
    formatted_spend: str
    quantity: float
    po_count: int
    percentage: float
    bar_color: str


class ColorSpendItem(BaseModel):
    color: str
    spend_value: float
    formatted_spend: str
    quantity: float
    percentage: float
    color_code: str


class SizeBreakdownItem(BaseModel):
    size: str
    ordered_qty: float
    received_qty: float
    pending_qty: float


class AttributeReorderAlertItem(BaseModel):
    sku: str
    article: str
    color: str
    size: str
    product_name: str
    on_hand: float
    reorder_level: float
    pending_qty: float
    suggested_po_qty: float
    urgency: str = "normal"


class ArticleColorHeatmapCell(BaseModel):
    article: str
    color: str
    ordered_qty: float
    received_qty: float
    spend_value: float


class ArticleColorHeatmap(BaseModel):
    articles: List[str] = Field(default_factory=list)
    colors: List[str] = Field(default_factory=list)
    cells: List[ArticleColorHeatmapCell] = Field(default_factory=list)
    max_qty: float = 0.0


class SupplierLeadTimeScatterPoint(BaseModel):
    supplier_id: str
    supplier_name: str
    article: str
    avg_lead_time_days: float
    order_value_lakh: float
    po_count: int
    bubble_color: str


class FilterOptions(BaseModel):
    articles: List[str] = Field(default_factory=list)
    colors: List[str] = Field(default_factory=list)
    sizes: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    brands: List[str] = Field(default_factory=list)
    suppliers: List[Dict[str, str]] = Field(default_factory=list)
    seasons: List[str] = Field(default_factory=list)


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
    selected_widget: Optional[str] = "purchase_spend_trend"
    group_by_primary: Optional[str] = "article"
    group_by_secondary: Optional[str] = "color"
    selected_measures: List[str] = Field(default_factory=lambda: ["ordered_qty", "received_qty", "pending_qty"])
    time_grouping: Optional[str] = "monthly"
    top_n: Optional[int] = 10
    attribute_filters: Dict[str, Any] = Field(default_factory=dict)


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
    filter_options: FilterOptions = Field(default_factory=FilterOptions)
    top_articles: List[ArticleSpendItem] = Field(default_factory=list)
    spend_by_color: List[ColorSpendItem] = Field(default_factory=list)
    order_vs_receipt_by_size: List[SizeBreakdownItem] = Field(default_factory=list)
    reorder_alerts_detailed: List[AttributeReorderAlertItem] = Field(default_factory=list)
    article_color_heatmap: Optional[ArticleColorHeatmap] = None
    supplier_lead_time_vs_value: List[SupplierLeadTimeScatterPoint] = Field(default_factory=list)

