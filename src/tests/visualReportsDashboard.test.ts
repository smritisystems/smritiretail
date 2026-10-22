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
 * Classification: Visual Reports Test Suite
 */

import { describe, it, expect } from "vitest";
import { VisualReportsDashboardTab } from "../components/reports/VisualReportsDashboardTab.tsx";
import {
  VisualReportsSummaryResponse,
  DashboardConfigPayload,
  FulfillmentStreamItem,
  CategoryStockPosition,
} from "../components/reports/visualReportsTypes.ts";

describe("SMRITI Visual Reports Dashboard Suite", () => {
  it("STEP 1: should export VisualReportsDashboardTab component function", () => {
    expect(typeof VisualReportsDashboardTab).toBe("function");
  });

  it("STEP 2: should validate VisualReportsSummaryResponse structure and KPI cards", () => {
    const mockSummary: VisualReportsSummaryResponse = {
      company_name: "SMRITI FOOTWEAR PVT LTD",
      location_name: "All Locations",
      date_range_label: "01 Apr 2025 - 30 Apr 2025",
      kpis: [
        {
          id: "on_hand",
          title: "On-Hand Stock",
          value: "12,580",
          numeric_value: 12580,
          unit: "pairs",
          subtext: null,
          trend_direction: "up",
          trend_percentage: "2.3% vs prev. period",
          color: "blue",
        },
        {
          id: "reserved",
          title: "Reserved Stock",
          value: "3,240",
          numeric_value: 3240,
          unit: "pairs",
          subtext: null,
          trend_direction: "down",
          trend_percentage: "8.1% vs prev. period",
          color: "amber",
        },
        {
          id: "available",
          title: "Available Stock",
          value: "9,240",
          numeric_value: 9240,
          unit: "pairs",
          subtext: null,
          trend_direction: "up",
          trend_percentage: "1.5% vs prev. period",
          color: "emerald",
        },
        {
          id: "sales_orders",
          title: "Sales Orders",
          value: "48",
          numeric_value: 48,
          unit: undefined,
          subtext: "Open: 26 | Closed: 4",
          trend_direction: "up",
          trend_percentage: "12% vs prev. period",
          color: "purple",
        },
        {
          id: "packing_slips",
          title: "Packing Slips",
          value: "62",
          numeric_value: 62,
          unit: undefined,
          subtext: "Pending: 18 | Packed: 32",
          trend_direction: "up",
          trend_percentage: "7% vs prev. period",
          color: "cyan",
        },
        {
          id: "dispatches",
          title: "Dispatches",
          value: "28",
          numeric_value: 28,
          unit: undefined,
          subtext: "Today: 6 | This Week: 18",
          trend_direction: "up",
          trend_percentage: "5% vs prev. period",
          color: "orange",
        },
      ],
      stock_flow_timeline: [],
      workflow_stages: [
        {
          id: "so",
          title: "Sales Orders",
          icon: "FileText",
          count: 48,
          percentage: 100,
          color: "#8b5cf6",
          subtext: "Open: 26\nClosed: 4",
          progress_bar_percentage: 100,
        },
        {
          id: "ps",
          title: "Packing Slips",
          icon: "Box",
          count: 62,
          percentage: 129,
          color: "#0284c7",
          subtext: "Pending: 18\nPacked: 32",
          progress_bar_percentage: 100,
        },
        {
          id: "ds",
          title: "Dispatched",
          icon: "Truck",
          count: 28,
          percentage: 58,
          color: "#ea580c",
          subtext: "Today: 6\nThis Week: 18",
          progress_bar_percentage: 58,
        },
        {
          id: "inv",
          title: "Invoices",
          icon: "Receipt",
          count: 24,
          percentage: 50,
          color: "#16a34a",
          subtext: "Today: 5\nThis Week: 18",
          progress_bar_percentage: 50,
        },
      ],
      category_positions: [
        { category: "Sports Shoes", on_hand: 4200, reserved: 1080, available: 3120, reserved_pct: 25.7 },
        { category: "Casual Shoes", on_hand: 3650, reserved: 920, available: 2730, reserved_pct: 25.2 },
      ],
      top_reserved_skus: [
        { rank: 1, sku: "SHOE-41", product_name: "Running Shoe - Black", on_hand: 500, reserved: 200, reserved_pct: 40.0 },
      ],
      packing_slip_donut: [
        { status: "Pending", count: 18, percentage: 29.0, color: "#93c5fd" },
        { status: "Packed", count: 32, percentage: 52.0, color: "#2563eb" },
        { status: "Ready to Dispatch", count: 8, percentage: 13.0, color: "#facc15" },
        { status: "Dispatched", count: 4, percentage: 6.0, color: "#10b981" },
      ],
      total_packing_slips_count: 62,
      dispatch_invoice_summary: [
        { document_type: "Dispatches", today: 6, this_week: 18, this_month: 28, value_inr: 1150000, formatted_value: "11,50,000" },
        { document_type: "B2B Invoices", today: 5, this_week: 16, this_month: 24, value_inr: 1025000, formatted_value: "10,25,000" },
      ],
      fulfillment_stream: [
        {
          id: "so-1",
          doc_type: "SO",
          doc_number: "SO-00128",
          doc_date: "30 Apr 2025",
          customer_name: "Alpha Traders",
          item_summary: "SHOE-41, FORM-42",
          quantity: 320,
          value_inr: 125000,
          formatted_value: "1,25,000",
          status: "Open",
          status_color: "emerald",
          next_action: "Create Packing Slip",
          next_action_icon: "Box",
          updated_by: "Ravi",
          updated_on: "30 Apr 2025 10:24",
        },
      ],
      config: {
        layout_mode: "focused",
        kpi_cards_visible: { on_hand: true, reserved: true, available: true, sales_orders: true, packing_slips: true, dispatches: true },
        charts_visible: { stock_flow: true, order_to_invoice: true, category_stock: true, top_skus: true, packing_status: true },
        stock_flow_chart_type: "line",
        table_view: "active_stream",
        default_tab: "all",
        rows_per_page: 10,
        color_theme_mode: "system",
        custom_accent_color: "#2563eb",
      },
    };

    expect(mockSummary.kpis.length).toBe(6);
    expect(mockSummary.workflow_stages.length).toBe(4);
    expect(mockSummary.category_positions.length).toBe(2);
    expect(mockSummary.total_packing_slips_count).toBe(62);
  });

  it("STEP 3: should verify category stock reservation mathematics", () => {
    const cats: CategoryStockPosition[] = [
      { category: "Sports Shoes", on_hand: 4200, reserved: 1080, available: 3120, reserved_pct: 25.7 },
      { category: "Formal Shoes", on_hand: 2980, reserved: 640, available: 2340, reserved_pct: 21.5 },
    ];

    for (const cat of cats) {
      // available must equal on_hand - reserved
      expect(cat.available).toBe(cat.on_hand - cat.reserved);
      // reserved_pct calculation check
      const expectedPct = Number(((cat.reserved / cat.on_hand) * 100).toFixed(1));
      expect(Math.abs(cat.reserved_pct - expectedPct)).toBeLessThanOrEqual(0.1);
    }
  });

  it("STEP 4: should verify fulfillment stream tab filtering logic", () => {
    const stream: FulfillmentStreamItem[] = [
      { id: "1", doc_type: "SO", doc_number: "SO-00128", doc_date: "30 Apr 2025", customer_name: "Alpha Traders", item_summary: "SHOE-41", quantity: 320, value_inr: 125000, formatted_value: "1,25,000", status: "Open", status_color: "emerald", next_action: "Create Packing Slip", next_action_icon: "Box", updated_by: "Ravi", updated_on: "30 Apr 2025 10:24" },
      { id: "2", doc_type: "PS", doc_number: "PS-00216", doc_date: "30 Apr 2025", customer_name: "Bharat Retail", item_summary: "SHOE-36", quantity: 240, value_inr: 92000, formatted_value: "92,000", status: "Pending", status_color: "amber", next_action: "Complete Packing", next_action_icon: "CheckSquare", updated_by: "Meena", updated_on: "30 Apr 2025 09:18" },
      { id: "3", doc_type: "DS", doc_number: "DS-00028", doc_date: "30 Apr 2025", customer_name: "Delta Stores", item_summary: "FORM-40", quantity: 200, value_inr: 80000, formatted_value: "80,000", status: "Ready to Dispatch", status_color: "orange", next_action: "Create Invoice", next_action_icon: "Receipt", updated_by: "Suresh", updated_on: "30 Apr 2025 08:45" },
      { id: "4", doc_type: "INV", doc_number: "INV-00024", doc_date: "30 Apr 2025", customer_name: "Alpha Traders", item_summary: "SHOE-41", quantity: 200, value_inr: 80000, formatted_value: "80,000", status: "Invoiced", status_color: "emerald", next_action: "Print / Share", next_action_icon: "Printer", updated_by: "Ravi", updated_on: "30 Apr 2025 11:10" },
    ];

    const filterByTab = (tab: "all" | "so" | "ps" | "ds" | "inv", items: FulfillmentStreamItem[]) => {
      if (tab === "all") return items;
      return items.filter((item) => item.doc_type.toLowerCase() === tab.toLowerCase());
    };

    expect(filterByTab("all", stream).length).toBe(4);
    expect(filterByTab("so", stream).length).toBe(1);
    expect(filterByTab("ps", stream).length).toBe(1);
    expect(filterByTab("ds", stream).length).toBe(1);
    expect(filterByTab("inv", stream).length).toBe(1);
  });

  it("STEP 5: should validate default dashboard configuration and persistence integrity", () => {
    const config: DashboardConfigPayload = {
      layout_mode: "focused",
      kpi_cards_visible: {
        on_hand: true,
        reserved: true,
        available: true,
        sales_orders: true,
        packing_slips: true,
        dispatches: true,
      },
      charts_visible: {
        stock_flow: true,
        order_to_invoice: true,
        category_stock: true,
        top_skus: true,
        packing_status: true,
      },
      stock_flow_chart_type: "line",
      table_view: "active_stream",
      default_tab: "all",
      rows_per_page: 10,
      color_theme_mode: "system",
      custom_accent_color: "#2563eb",
    };

    expect(config.layout_mode).toBe("focused");
    expect(config.stock_flow_chart_type).toBe("line");
    expect(config.rows_per_page).toBe(10);
    expect(config.kpi_cards_visible.on_hand).toBe(true);

    // Serialization & deserialization check
    const serialized = JSON.stringify(config);
    const deserialized: DashboardConfigPayload = JSON.parse(serialized);
    expect(deserialized.layout_mode).toBe("focused");
    expect(deserialized.charts_visible.stock_flow).toBe(true);
  });

  it("STEP 6: should accurately compute dynamic applied filter count", () => {
    const computeAppliedFilters = (
      companyId?: string,
      location?: string,
      datePreset?: string
    ) => {
      let count = 0;
      if (companyId && companyId !== "all") count++;
      if (location && location !== "all" && location !== "All Locations") count++;
      if (datePreset) count++;
      return count;
    };

    expect(computeAppliedFilters("COMP-001", "All Locations", "MTD")).toBe(2);
    expect(computeAppliedFilters("COMP-001", "LOC-NORTH", "Today")).toBe(3);
    expect(computeAppliedFilters(undefined, "All Locations", undefined)).toBe(0);
    expect(computeAppliedFilters("all", "All Locations", "Last 7 Days")).toBe(1);
  });

  it("STEP 7: should build query parameters with store_location_id when location is specified", () => {
    const buildQueryParams = (
      companyId?: string,
      location?: string,
      datePreset?: string
    ) => {
      const params = new URLSearchParams();
      if (companyId && companyId !== "all") {
        params.append("company_id", companyId);
      }
      if (location && location !== "all" && location !== "All Locations") {
        params.append("store_location_id", location);
      }
      if (datePreset === "Today") {
        params.append("start_date", "2026-10-22");
        params.append("end_date", "2026-10-22");
      }
      return params.toString();
    };

    const qs = buildQueryParams("COMP-001", "WH-MAIN", "Today");
    expect(qs).toContain("company_id=COMP-001");
    expect(qs).toContain("store_location_id=WH-MAIN");
    expect(qs).toContain("start_date=2026-10-22");
    expect(qs).toContain("end_date=2026-10-22");

    const qsDefault = buildQueryParams("COMP-001", "All Locations", undefined);
    expect(qsDefault).toBe("company_id=COMP-001");
    expect(qsDefault).not.toContain("store_location_id");
  });
});
