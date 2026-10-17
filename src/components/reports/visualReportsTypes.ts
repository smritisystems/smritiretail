/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.94.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Visual Reports Types
 * Capability    : @SmritiCapability("REPORTS", "VISUAL_REPORTS_TYPES")
 */

export interface VisualKpiCard {
  id: string;
  title: string;
  value: string;
  numeric_value: number;
  unit?: string | null;
  subtext?: string | null;
  trend_direction: "up" | "down";
  trend_percentage?: string | null;
  color: string;
}

export interface StockFlowDataPoint {
  date: string;
  day_label: string;
  on_hand: number;
  reserved: number;
  available: number;
  dispatched: number;
  invoiced: number;
}

export interface WorkflowStageProgress {
  id: string;
  title: string;
  icon: string;
  count: number;
  percentage: number;
  color: string;
  subtext: string;
  progress_bar_percentage: number;
}

export interface CategoryStockPosition {
  category: string;
  on_hand: number;
  reserved: number;
  available: number;
  reserved_pct: number;
}

export interface TopReservedSku {
  rank: number;
  sku: string;
  product_name: string;
  on_hand: number;
  reserved: number;
  reserved_pct: number;
}

export interface PackingSlipStatusSlice {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DispatchInvoiceSummaryRow {
  document_type: string;
  today: number;
  this_week: number;
  this_month: number;
  value_inr: number;
  formatted_value: string;
}

export interface FulfillmentStreamItem {
  id: string;
  doc_type: string;
  doc_number: string;
  doc_date: string;
  customer_name: string;
  item_summary: string;
  quantity: number;
  value_inr: number;
  formatted_value: string;
  status: string;
  status_color: string;
  next_action: string;
  next_action_icon: string;
  updated_by: string;
  updated_on: string;
}

export interface DashboardConfigPayload {
  layout_mode: "standard" | "focused";
  kpi_cards_visible: Record<string, boolean>;
  charts_visible: Record<string, boolean>;
  stock_flow_chart_type: "line" | "area" | "bar";
  table_view: string;
  default_tab: "all" | "so" | "ps" | "ds" | "inv";
  rows_per_page: number;
  color_theme_mode: "system" | "custom";
  custom_accent_color: string;
}

export interface VisualReportsSummaryResponse {
  company_name: string;
  location_name: string;
  date_range_label: string;
  kpis: VisualKpiCard[];
  stock_flow_timeline: StockFlowDataPoint[];
  workflow_stages: WorkflowStageProgress[];
  category_positions: CategoryStockPosition[];
  top_reserved_skus: TopReservedSku[];
  packing_slip_donut: PackingSlipStatusSlice[];
  total_packing_slips_count: number;
  dispatch_invoice_summary: DispatchInvoiceSummaryRow[];
  fulfillment_stream: FulfillmentStreamItem[];
  config: DashboardConfigPayload;
}
