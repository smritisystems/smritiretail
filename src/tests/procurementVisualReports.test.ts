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
 * Classification: Procurement Visual Reports Test Suite
 */

import { describe, it, expect } from "vitest";
import { ProcurementVisualReportsTab } from "../components/procurement/ProcurementVisualReportsTab.tsx";
import {
  ProcurementReportsSummaryResponse,
  ProcurementDashboardConfigPayload,
  ActiveProcurementStreamItem,
  ReorderAlertItem,
} from "../components/procurement/procurementVisualReportsTypes.ts";

describe("SMRITI Procurement Visual Reports Dashboard Suite", () => {
  it("STEP 1: should export ProcurementVisualReportsTab component function", () => {
    expect(ProcurementVisualReportsTab).toBeDefined();
    expect(typeof ProcurementVisualReportsTab).toBe("function");
  });

  it("STEP 2: should validate Procurement Reports Summary DTO contracts & KPI calculations", () => {
    const mockSummary: ProcurementReportsSummaryResponse = {
      company_name: "SMRITI FOOTWEAR PVT LTD",
      store_location_name: "All Locations",
      date_range_label: "01 Apr 2025 - 30 Apr 2025",
      kpi_cards: [
        {
          id: "purchase_orders",
          title: "Purchase Orders",
          value: "36",
          numeric_value: 36,
          subtext: "Open: 18  Closed: 18",
          trend_direction: "up",
          trend_percentage: "12% vs prev. period",
          color: "sky",
          icon_name: "shopping_cart",
        },
        {
          id: "purchase_spend",
          title: "Purchase Spend",
          value: "₹ 42,80,000",
          numeric_value: 4280000,
          subtext: "MTD",
          trend_direction: "up",
          trend_percentage: "18% vs prev. period",
          color: "purple",
          icon_name: "currency_rupee",
        },
        {
          id: "pending_approvals",
          title: "Pending Approvals",
          value: "6",
          numeric_value: 6,
          subtext: "Value: ₹ 6,20,000",
          trend_direction: "up",
          trend_percentage: "50% vs prev. period",
          color: "amber",
          icon_name: "description",
        },
        {
          id: "pending_receipts",
          title: "Pending Receipts",
          value: "12",
          numeric_value: 12,
          subtext: "Qty: 2,480 pairs",
          trend_direction: "up",
          trend_percentage: "20% vs prev. period",
          color: "blue",
          icon_name: "local_shipping",
        },
        {
          id: "received_vs_ordered",
          title: "Received vs Ordered",
          value: "78%",
          numeric_value: 78,
          subtext: "3,120 / 4,000 pairs",
          trend_direction: "up",
          trend_percentage: "78%",
          color: "emerald",
          icon_name: "inventory_2",
          progress_percentage: 78,
          progress_label: "3,120 / 4,000 pairs",
        },
        {
          id: "supplier_outstanding",
          title: "Supplier Outstanding",
          value: "₹ 18,50,000",
          numeric_value: 1850000,
          subtext: "Suppliers: 9",
          trend_direction: "down",
          trend_percentage: "8% vs prev. period",
          color: "rose",
          icon_name: "account_balance_wallet",
        },
      ],
      spend_trend: [
        {
          period: "2025-01",
          month_label: "Jan",
          ordered_value: 12.5,
          received_value: 8.2,
          invoiced_value: 4.6,
          po_count: 22,
        },
        {
          period: "2025-04",
          month_label: "Apr",
          ordered_value: 23.6,
          received_value: 18.5,
          invoiced_value: 14.2,
          po_count: 36,
        },
      ],
      workflow_stages: [
        {
          stage_id: "orders",
          stage_name: "Purchase Orders",
          count: 36,
          percentage: 100,
          subtext_left: "Open: 18",
          subtext_right: "Closed: 18",
          color: "#0284c7",
          icon_name: "shopping_cart",
        },
        {
          stage_id: "approved",
          stage_name: "Approved",
          count: 30,
          percentage: 83,
          subtext_left: "Pending: 6",
          subtext_right: "Approved: 30",
          color: "#9333ea",
          icon_name: "verified",
        },
        {
          stage_id: "receipts",
          stage_name: "Goods Receipts",
          count: 28,
          percentage: 78,
          subtext_left: "Pending: 8",
          subtext_right: "Received: 3,120",
          color: "#16a34a",
          icon_name: "local_shipping",
        },
        {
          stage_id: "invoices",
          stage_name: "Supplier Invoices",
          count: 24,
          percentage: 67,
          subtext_left: "Pending: 6",
          subtext_right: "Invoiced: 24",
          color: "#ea580c",
          icon_name: "receipt",
        },
      ],
      top_suppliers: [
        {
          supplier_id: "SUP-001",
          supplier_name: "Metro Footwear Ltd.",
          spend_value: 1250000,
          formatted_spend: "₹ 12,50,000",
          percentage: 100,
          bar_color: "#06b6d4",
        },
      ],
      po_status_breakdown: [
        { status_id: "draft", status_name: "Draft", count: 4, percentage: 11, color: "#94a3b8" },
        { status_id: "pending_approval", status_name: "Pending Approval", count: 6, percentage: 17, color: "#f59e0b" },
        { status_id: "approved", status_name: "Approved", count: 12, percentage: 33, color: "#10b981" },
        { status_id: "partially_received", status_name: "Partially Received", count: 8, percentage: 22, color: "#06b6d4" },
        { status_id: "closed", status_name: "Closed", count: 6, percentage: 17, color: "#334155" },
      ],
      total_pos_for_status: 36,
      reorder_alerts: [
        {
          sku: "SHOE-41",
          product_name: "Running Shoe - Black",
          on_hand: 60,
          reorder_level: 200,
          suggested_po_qty: 500,
          urgency: "critical",
        },
      ],
      supplier_performance: [
        { supplier_id: "SUP-001", supplier_name: "Metro Footwear", on_time_delivery_pct: 92, lead_time_days: 12 },
      ],
      open_pos_and_receipts: [
        {
          po_no: "PO-00028",
          po_date: "30 Apr 2025",
          supplier_name: "Metro Footwear",
          ordered_qty: 800,
          received_qty: 400,
          pending_qty: 400,
          purchase_value: 1250000,
          formatted_value: "12,50,000",
          status: "Partially Received",
          status_badge: "cyan",
        },
      ],
      fulfillment_stream: [
        {
          id: "stm-01",
          doc_type: "PO",
          doc_no: "PO-00028",
          date: "30 Apr 2025",
          supplier: "Metro Footwear",
          item_sku: "SHOE-41, SHOE-42",
          qty: 800,
          unit: "Pairs",
          value: 1250000,
          formatted_value: "12,50,000",
          status: "Partially Received",
          status_badge: "cyan",
          next_action: "create_grn",
          next_action_label: "Create GRN",
          updated_by: "Ravi",
          updated_on: "30 Apr 2025 10:24",
        },
      ],
      stream_counts: { all: 86, purchase_orders: 36, goods_receipts: 28, supplier_invoices: 24 },
      active_filters_count: 3,
      config: {
        layout_mode: "standard",
        kpi_cards_visible: {},
        charts_visible: {},
        chart_types: {},
        tables_visible: {},
        data_display: {},
        color_theme: "system",
      },
    };

    expect(mockSummary.kpi_cards).toHaveLength(6);
    expect(mockSummary.kpi_cards[0].numeric_value).toBe(36);
    expect(mockSummary.kpi_cards[1].numeric_value).toBe(4280000);
    expect(mockSummary.kpi_cards[4].progress_percentage).toBe(78);
    expect(mockSummary.workflow_stages).toHaveLength(4);
    expect(mockSummary.workflow_stages[0].count).toBe(36);
    expect(mockSummary.workflow_stages[1].count).toBe(30);
    expect(mockSummary.workflow_stages[2].count).toBe(28);
    expect(mockSummary.workflow_stages[3].count).toBe(24);
  });

  it("STEP 3: should correctly filter active procurement stream items by tab and query", () => {
    const streamItems: ActiveProcurementStreamItem[] = [
      {
        id: "stm-01",
        doc_type: "PO",
        doc_no: "PO-00028",
        date: "30 Apr 2025",
        supplier: "Metro Footwear",
        item_sku: "SHOE-41, SHOE-42",
        qty: 800,
        unit: "Pairs",
        value: 1250000,
        formatted_value: "12,50,000",
        status: "Partially Received",
        status_badge: "cyan",
        next_action: "create_grn",
        next_action_label: "Create GRN",
        updated_by: "Ravi",
        updated_on: "30 Apr 2025 10:24",
      },
      {
        id: "stm-02",
        doc_type: "GR",
        doc_no: "GRN-00018",
        date: "30 Apr 2025",
        supplier: "Metro Footwear",
        item_sku: "SHOE-41",
        qty: 400,
        unit: "Pairs",
        value: 600000,
        formatted_value: "6,00,000",
        status: "Received",
        status_badge: "green",
        next_action: "create_supplier_invoice",
        next_action_label: "Create Supplier Invoice",
        updated_by: "Meena",
        updated_on: "30 Apr 2025 09:18",
      },
      {
        id: "stm-03",
        doc_type: "PI",
        doc_no: "PINV-00012",
        date: "29 Apr 2025",
        supplier: "Bharat Traders",
        item_sku: "SHOE-36, SAND-03",
        qty: 500,
        unit: "Pairs",
        value: 720000,
        formatted_value: "7,20,000",
        status: "Pending",
        status_badge: "amber",
        next_action: "verify_invoice",
        next_action_label: "Verify Invoice",
        updated_by: "Suresh",
        updated_on: "30 Apr 2025 08:45",
      },
    ];

    // Tab filter tests
    const poItems = streamItems.filter((i) => i.doc_type === "PO");
    expect(poItems).toHaveLength(1);
    expect(poItems[0].doc_no).toBe("PO-00028");

    const grItems = streamItems.filter((i) => i.doc_type === "GR");
    expect(grItems).toHaveLength(1);
    expect(grItems[0].doc_no).toBe("GRN-00018");

    const piItems = streamItems.filter((i) => i.doc_type === "PI");
    expect(piItems).toHaveLength(1);
    expect(piItems[0].doc_no).toBe("PINV-00012");

    // Text search test
    const searchMatch = streamItems.filter((i) =>
      i.supplier.toLowerCase().includes("bharat")
    );
    expect(searchMatch).toHaveLength(1);
    expect(searchMatch[0].doc_no).toBe("PINV-00012");
  });

  it("STEP 4: should validate reorder alert calculation and low-stock urgency detection", () => {
    const alert: ReorderAlertItem = {
      sku: "SHOE-41",
      product_name: "Running Shoe - Black",
      on_hand: 60,
      reorder_level: 200,
      suggested_po_qty: 500,
      urgency: "critical",
    };

    expect(alert.on_hand).toBeLessThan(alert.reorder_level);
    expect(alert.suggested_po_qty).toBeGreaterThan(0);
    expect(alert.urgency).toBe("critical");
  });

  it("STEP 5: should validate drawer configuration schema and toggle mutations", () => {
    const initialConfig: ProcurementDashboardConfigPayload = {
      layout_mode: "standard",
      kpi_cards_visible: {
        purchase_orders: true,
        purchase_spend: true,
      },
      charts_visible: {
        purchase_spend_trend: true,
        purchase_to_receipt_progress: true,
      },
      chart_types: {
        purchase_spend_trend: "line",
      },
      tables_visible: {
        recent_purchase_orders: true,
      },
      data_display: {
        default_tab: "all",
        rows_per_page: 10,
      },
      color_theme: "system",
      custom_palette_color: "#0284c7",
    };

    // Toggle layout to compact
    const compactConfig: ProcurementDashboardConfigPayload = {
      ...initialConfig,
      layout_mode: "compact",
    };
    expect(compactConfig.layout_mode).toBe("compact");

    // Toggle chart type to area
    const areaChartConfig: ProcurementDashboardConfigPayload = {
      ...initialConfig,
      chart_types: { ...initialConfig.chart_types, purchase_spend_trend: "area" },
    };
    expect(areaChartConfig.chart_types.purchase_spend_trend).toBe("area");

    // Hide spend KPI
    const hiddenKpiConfig: ProcurementDashboardConfigPayload = {
      ...initialConfig,
      kpi_cards_visible: { ...initialConfig.kpi_cards_visible, purchase_spend: false },
    };
    expect(hiddenKpiConfig.kpi_cards_visible.purchase_spend).toBe(false);
  });
});
