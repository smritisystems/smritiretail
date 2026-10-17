/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.95.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Procurement Visual Reports Types
 * Capability    : @SmritiCapability("REPORTS", "PROCUREMENT_VISUAL_REPORTS_TYPES")
 */

export interface ProcurementKpiCard {
  id: string;
  title: string;
  value: string;
  numeric_value: number;
  unit?: string | null;
  subtext?: string | null;
  trend_direction: "up" | "down";
  trend_percentage: string;
  color: string;
  icon_name: string;
  progress_percentage?: number | null;
  progress_label?: string | null;
}

export interface PurchaseSpendTrendPoint {
  period: string;
  month_label: string;
  ordered_value: number;
  received_value: number;
  invoiced_value: number;
  po_count: number;
  ordered_qty?: number;
  received_qty?: number;
}

export interface PurchaseToReceiptStage {
  stage_id: string;
  stage_name: string;
  count: number;
  percentage: number;
  subtext_left: string;
  subtext_right: string;
  color: string;
  icon_name: string;
}

export interface TopSupplierSpend {
  supplier_id: string;
  supplier_name: string;
  spend_value: number;
  formatted_spend: string;
  percentage: number;
  bar_color: string;
}

export interface PurchaseOrderStatusSlice {
  status_id: string;
  status_name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ReorderAlertItem {
  sku: string;
  product_name: string;
  on_hand: number;
  reorder_level: number;
  suggested_po_qty: number;
  urgency: "critical" | "warning" | "normal";
}

export interface SupplierPerformanceItem {
  supplier_id: string;
  supplier_name: string;
  on_time_delivery_pct?: number | null;
  lead_time_days: number;
}

export interface OpenPoReceiptItem {
  po_no: string;
  po_date: string;
  supplier_name: string;
  ordered_qty: number;
  received_qty: number;
  pending_qty: number;
  purchase_value: number;
  formatted_value: string;
  status: string;
  status_badge: string;
}

export interface ActiveProcurementStreamItem {
  id: string;
  doc_type: "PO" | "GR" | "PI";
  doc_no: string;
  date: string;
  supplier: string;
  item_sku: string;
  qty: number;
  unit: string;
  value: number;
  formatted_value: string;
  status: string;
  status_badge: string;
  next_action?: string | null;
  next_action_label?: string | null;
  updated_by: string;
  updated_on: string;
}

export interface ProcurementDashboardConfigPayload {
  layout_mode: "standard" | "compact";
  kpi_cards_visible: Record<string, boolean>;
  charts_visible: Record<string, boolean>;
  chart_types: Record<string, string>;
  tables_visible: Record<string, boolean>;
  data_display: Record<string, any>;
  color_theme: "system" | "custom";
  custom_palette_color?: string | null;
}

export interface ProcurementReportsSummaryResponse {
  company_name: string;
  store_location_name: string;
  date_range_label: string;
  kpi_cards: ProcurementKpiCard[];
  spend_trend: PurchaseSpendTrendPoint[];
  workflow_stages: PurchaseToReceiptStage[];
  top_suppliers: TopSupplierSpend[];
  po_status_breakdown: PurchaseOrderStatusSlice[];
  total_pos_for_status: number;
  reorder_alerts: ReorderAlertItem[];
  supplier_performance: SupplierPerformanceItem[];
  open_pos_and_receipts: OpenPoReceiptItem[];
  fulfillment_stream: ActiveProcurementStreamItem[];
  stream_counts: Record<string, number>;
  active_filters_count: number;
  config: ProcurementDashboardConfigPayload;
}
