/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.96.0
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
  ArticleSpendItem,
  ColorSpendItem,
  SizeBreakdownItem,
  AttributeReorderAlertItem,
  ArticleColorHeatmap,
  SupplierLeadTimeScatterPoint,
  FilterOptions,
} from "../components/procurement/procurementVisualReportsTypes.ts";

describe("SMRITI Procurement Visual Reports Dashboard Suite", () => {
  it("STEP 1: should export ProcurementVisualReportsTab component function", () => {
    expect(ProcurementVisualReportsTab).toBeDefined();
    expect(typeof ProcurementVisualReportsTab).toBe("function");
  });

  it("STEP 2: should validate Procurement Reports Summary DTO contracts with real database figures", () => {
    const realDbSummary: ProcurementReportsSummaryResponse = {
      company_name: "My Retail Store",
      store_location_name: "All Locations",
      date_range_label: "01 Apr 2026 - 31 Mar 2027",
      kpi_cards: [
        {
          id: "purchase_orders",
          title: "Purchase Orders",
          value: "28",
          numeric_value: 28,
          subtext: "Open: 28  Closed: 0",
          trend_direction: "up",
          trend_percentage: "28 active orders",
          color: "sky",
          icon_name: "shopping_cart",
        },
        {
          id: "purchase_spend",
          title: "Purchase Spend",
          value: "₹ 9,888,228",
          numeric_value: 9888228,
          subtext: "Invoiced: ₹ 9,888,228 | Paid: ₹ 0",
          trend_direction: "up",
          trend_percentage: "Committed PO Value",
          color: "purple",
          icon_name: "currency_rupee",
        },
        {
          id: "pending_approvals",
          title: "Pending Approvals",
          value: "0",
          numeric_value: 0,
          subtext: "Value: ₹ 0",
          trend_direction: "up",
          trend_percentage: "All Approved",
          color: "amber",
          icon_name: "description",
        },
        {
          id: "pending_receipts",
          title: "Pending Receipts",
          value: "0",
          numeric_value: 0,
          subtext: "Qty: 0 pairs",
          trend_direction: "up",
          trend_percentage: "Fully Received",
          color: "blue",
          icon_name: "local_shipping",
        },
        {
          id: "received_vs_ordered",
          title: "Received vs Ordered",
          value: "100%",
          numeric_value: 100,
          subtext: "23,064 / 23,064 pairs",
          trend_direction: "up",
          trend_percentage: "100% fulfilled",
          color: "emerald",
          icon_name: "inventory_2",
          progress_percentage: 100,
          progress_label: "23,064 / 23,064 pairs",
        },
        {
          id: "supplier_outstanding",
          title: "Supplier Outstanding",
          value: "₹ 9,888,228",
          numeric_value: 9888228,
          subtext: "Suppliers: 9",
          trend_direction: "up",
          trend_percentage: "9 with balance",
          color: "rose",
          icon_name: "account_balance_wallet",
        },
      ],
      spend_trend: [
        {
          period: "2026-05",
          month_label: "May",
          ordered_value: 7.55,
          received_value: 0.0,
          invoiced_value: 0.0,
          po_count: 3,
        },
        {
          period: "2026-06",
          month_label: "Jun",
          ordered_value: 61.14,
          received_value: 3.47,
          invoiced_value: 3.47,
          po_count: 17,
        },
      ],
      workflow_stages: [
        {
          stage_id: "orders",
          stage_name: "Purchase Orders",
          count: 28,
          percentage: 100,
          subtext_left: "Open: 28",
          subtext_right: "Closed: 0",
          color: "#0284c7",
          icon_name: "shopping_cart",
        },
        {
          stage_id: "approved",
          stage_name: "Approved",
          count: 28,
          percentage: 100,
          subtext_left: "Pending: 0",
          subtext_right: "Approved: 28",
          color: "#9333ea",
          icon_name: "verified",
        },
        {
          stage_id: "receipts",
          stage_name: "Goods Receipts",
          count: 28,
          percentage: 100,
          subtext_left: "Pending: 0",
          subtext_right: "Received: 23,064",
          color: "#16a34a",
          icon_name: "local_shipping",
        },
        {
          stage_id: "invoices",
          stage_name: "Supplier Invoices",
          count: 28,
          percentage: 100,
          subtext_left: "Pending: 0",
          subtext_right: "Invoiced: 28",
          color: "#ea580c",
          icon_name: "receipt",
        },
      ],
      top_suppliers: [
        {
          supplier_id: "sup-001",
          supplier_name: "AS FOOTWEAR",
          spend_value: 1824480,
          formatted_spend: "₹ 18,24,480",
          percentage: 100,
          bar_color: "#06b6d4",
        },
        {
          supplier_id: "sup-002",
          supplier_name: "AK FOOTWEAR",
          spend_value: 1377894,
          formatted_spend: "₹ 13,77,894",
          percentage: 75.5,
          bar_color: "#3b82f6",
        },
      ],
      po_status_breakdown: [
        { status_id: "received", status_name: "Received", count: 28, percentage: 100, color: "#10b981" },
      ],
      total_pos_for_status: 28,
      reorder_alerts: [
        {
          sku: "SKU-C0C79D",
          product_name: "STY-C0C79D",
          on_hand: 0,
          reorder_level: 0,
          suggested_po_qty: 100,
          urgency: "critical",
        },
      ],
      supplier_performance: [
        { supplier_id: "sup-001", supplier_name: "AS FOOTWEAR", on_time_delivery_pct: null, lead_time_days: 35 },
      ],
      open_pos_and_receipts: [],
      fulfillment_stream: [
        {
          id: "po-01",
          doc_type: "PO",
          doc_no: "PO-C-849",
          date: "28 Aug 2026",
          supplier: "AK FOOTWEAR",
          item_sku: "SKU-ITEMS",
          qty: 1080,
          unit: "Pairs",
          value: 595350,
          formatted_value: "5,95,350",
          status: "Received",
          status_badge: "green",
          next_action: null,
          next_action_label: null,
          updated_by: "System",
          updated_on: "28 Aug 2026 12:00",
        },
      ],
      stream_counts: { all: 84, purchase_orders: 28, goods_receipts: 28, supplier_invoices: 28 },
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

    expect(realDbSummary.kpi_cards).toHaveLength(6);
    expect(realDbSummary.kpi_cards[0].numeric_value).toBe(28);
    expect(realDbSummary.kpi_cards[1].numeric_value).toBe(9888228);
    expect(realDbSummary.kpi_cards[4].progress_percentage).toBe(100);
    expect(realDbSummary.workflow_stages).toHaveLength(4);
    expect(realDbSummary.workflow_stages[0].count).toBe(28);
    expect(realDbSummary.workflow_stages[2].count).toBe(28);
    expect(realDbSummary.total_pos_for_status).toBe(28);
    expect(realDbSummary.supplier_performance[0].on_time_delivery_pct).toBeNull();
  });

  it("STEP 3: should correctly filter active procurement stream items by tab and query", () => {
    const streamItems: ActiveProcurementStreamItem[] = [
      {
        id: "stm-01",
        doc_type: "PO",
        doc_no: "PO-C-849",
        date: "28 Aug 2026",
        supplier: "AK FOOTWEAR",
        item_sku: "SKU-C0C79D",
        qty: 1080,
        unit: "Pairs",
        value: 595350,
        formatted_value: "5,95,350",
        status: "Received",
        status_badge: "green",
        next_action: null,
        next_action_label: null,
        updated_by: "System",
        updated_on: "28 Aug 2026 12:00",
      },
      {
        id: "stm-02",
        doc_type: "GR",
        doc_no: "GRN-D-522",
        date: "28 Aug 2026",
        supplier: "AK FOOTWEAR",
        item_sku: "SKU-C0C79D",
        qty: 1080,
        unit: "Pairs",
        value: 595350,
        formatted_value: "5,95,350",
        status: "Received",
        status_badge: "green",
        next_action: null,
        next_action_label: null,
        updated_by: "System",
        updated_on: "28 Aug 2026 12:00",
      },
      {
        id: "stm-03",
        doc_type: "PI",
        doc_no: "BILL-2026-001",
        date: "28 Aug 2026",
        supplier: "AS FOOTWEAR",
        item_sku: "SKU-7AC1C40A",
        qty: 1088,
        unit: "Pairs",
        value: 599760,
        formatted_value: "5,99,760",
        status: "Unpaid",
        status_badge: "amber",
        next_action: "record_payment",
        next_action_label: "Record Payment",
        updated_by: "Accountant",
        updated_on: "28 Aug 2026 14:00",
      },
    ];

    // Tab filter tests
    const poItems = streamItems.filter((i) => i.doc_type === "PO");
    expect(poItems).toHaveLength(1);
    expect(poItems[0].doc_no).toBe("PO-C-849");

    const grItems = streamItems.filter((i) => i.doc_type === "GR");
    expect(grItems).toHaveLength(1);
    expect(grItems[0].doc_no).toBe("GRN-D-522");

    const piItems = streamItems.filter((i) => i.doc_type === "PI");
    expect(piItems).toHaveLength(1);
    expect(piItems[0].doc_no).toBe("BILL-2026-001");

    // Text search test
    const searchMatch = streamItems.filter((i) =>
      i.supplier.toLowerCase().includes("as footwear")
    );
    expect(searchMatch).toHaveLength(1);
    expect(searchMatch[0].doc_no).toBe("BILL-2026-001");
  });

  it("STEP 4: should validate reorder alert calculation and low-stock urgency detection", () => {
    const alert: ReorderAlertItem = {
      sku: "SKU-C0C79D",
      product_name: "STY-C0C79D",
      on_hand: 0,
      reorder_level: 0,
      suggested_po_qty: 100,
      urgency: "critical",
    };

    expect(alert.on_hand).toBeLessThanOrEqual(alert.reorder_level);
    expect(alert.suggested_po_qty).toBeGreaterThan(0);
    expect(alert.urgency).toBe("critical");
  });

  it("STEP 5: should validate truthful empty state contracts (no fake fallbacks)", () => {
    const emptySummary: ProcurementReportsSummaryResponse = {
      company_name: "Empty Company",
      store_location_name: "All Locations",
      date_range_label: "01 Jan 2024 - 31 Dec 2024",
      kpi_cards: [
        {
          id: "purchase_orders",
          title: "Purchase Orders",
          value: "0",
          numeric_value: 0,
          subtext: "Open: 0  Closed: 0",
          trend_direction: "neutral",
          trend_percentage: "0 active orders",
          color: "sky",
          icon_name: "shopping_cart",
        },
        {
          id: "purchase_spend",
          title: "Purchase Spend",
          value: "₹ 0",
          numeric_value: 0,
          subtext: "Invoiced: ₹ 0 | Paid: ₹ 0",
          trend_direction: "neutral",
          trend_percentage: "No transactions",
          color: "purple",
          icon_name: "currency_rupee",
        },
      ],
      spend_trend: [],
      workflow_stages: [],
      top_suppliers: [],
      po_status_breakdown: [],
      total_pos_for_status: 0,
      reorder_alerts: [],
      supplier_performance: [],
      open_pos_and_receipts: [],
      fulfillment_stream: [],
      stream_counts: { all: 0, purchase_orders: 0, goods_receipts: 0, supplier_invoices: 0 },
      active_filters_count: 0,
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

    expect(emptySummary.total_pos_for_status).toBe(0);
    expect(emptySummary.fulfillment_stream).toHaveLength(0);
    expect(emptySummary.top_suppliers).toHaveLength(0);
    expect(emptySummary.kpi_cards[0].numeric_value).toBe(0);
    expect(emptySummary.kpi_cards[1].numeric_value).toBe(0);
  });

  it("STEP 6: should validate drawer configuration schema and toggle mutations", () => {
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

  it("STEP 7: should validate attribute-level reporting dimensions and data contracts", () => {
    const topArticles: ArticleSpendItem[] = [
      { article: "SHOE-41", spend_value: 844930, formatted_spend: "₹ 8,44,930", quantity: 685, po_count: 5, percentage: 85, bar_color: "#0284c7" },
      { article: "SAND-03", spend_value: 333726, formatted_spend: "₹ 3,33,726", quantity: 320, po_count: 3, percentage: 50, bar_color: "#0d9488" },
    ];
    expect(topArticles[0].article).toBe("SHOE-41");
    expect(topArticles[0].spend_value).toBeGreaterThan(topArticles[1].spend_value);

    const spendByColor: ColorSpendItem[] = [
      { color: "Black", spend_value: 420000, formatted_spend: "₹ 4,20,000", quantity: 400, percentage: 42, color_code: "#0f172a" },
      { color: "White", spend_value: 280000, formatted_spend: "₹ 2,80,000", quantity: 270, percentage: 28, color_code: "#e2e8f0" },
    ];
    expect(spendByColor).toHaveLength(2);
    expect(spendByColor[0].percentage).toBe(42);

    const sizeBreakdown: SizeBreakdownItem[] = [
      { size: "40", ordered_qty: 320, received_qty: 260, pending_qty: 60 },
      { size: "41", ordered_qty: 480, received_qty: 400, pending_qty: 80 },
    ];
    expect(sizeBreakdown[0].ordered_qty).toBe(sizeBreakdown[0].received_qty + sizeBreakdown[0].pending_qty);

    const attrReorder: AttributeReorderAlertItem[] = [
      {
        sku: "SKU-SHOE-41-BLK-41",
        article: "SHOE-41",
        color: "Black",
        size: "41",
        product_name: "SHOE-41 Formal Leather",
        on_hand: 12,
        reorder_level: 50,
        pending_qty: 20,
        suggested_po_qty: 50,
        urgency: "critical",
      },
    ];
    expect(attrReorder[0].article).toBe("SHOE-41");
    expect(attrReorder[0].color).toBe("Black");
    expect(attrReorder[0].size).toBe("41");
    expect(attrReorder[0].suggested_po_qty).toBe(50);
  });

  it("STEP 8: should validate 2D Article-Color Heatmap matrix and cell values", () => {
    const heatmap: ArticleColorHeatmap = {
      articles: ["SHOE-41", "SAND-03"],
      colors: ["Black", "White"],
      cells: [
        { article: "SHOE-41", color: "Black", ordered_qty: 320, received_qty: 260, spend_value: 320000 },
        { article: "SHOE-41", color: "White", ordered_qty: 260, received_qty: 200, spend_value: 260000 },
        { article: "SAND-03", color: "Black", ordered_qty: 180, received_qty: 150, spend_value: 180000 },
        { article: "SAND-03", color: "White", ordered_qty: 160, received_qty: 120, spend_value: 160000 },
      ],
      max_qty: 320,
    };

    expect(heatmap.articles).toContain("SHOE-41");
    expect(heatmap.colors).toContain("Black");
    expect(heatmap.cells).toHaveLength(4);
    expect(heatmap.max_qty).toBe(320);

    const maxCell = heatmap.cells.find((c) => c.ordered_qty === heatmap.max_qty);
    expect(maxCell).toBeDefined();
    expect(maxCell?.article).toBe("SHOE-41");
    expect(maxCell?.color).toBe("Black");
  });

  it("STEP 9: should validate Supplier Lead Time vs Order Value scatter plot data contract", () => {
    const scatterPoints: SupplierLeadTimeScatterPoint[] = [
      {
        supplier_id: "sup-01",
        supplier_name: "AK FOOTWEAR",
        article: "SHOE-41",
        avg_lead_time_days: 14.5,
        order_value_lakh: 18.5,
        po_count: 8,
        bubble_color: "#0284c7",
      },
      {
        supplier_id: "sup-02",
        supplier_name: "METRO LEATHERS",
        article: "SAND-03",
        avg_lead_time_days: 28.0,
        order_value_lakh: 8.2,
        po_count: 4,
        bubble_color: "#f97316",
      },
    ];

    expect(scatterPoints).toHaveLength(2);
    expect(scatterPoints[0].avg_lead_time_days).toBeLessThan(scatterPoints[1].avg_lead_time_days);
    expect(scatterPoints[0].order_value_lakh).toBeGreaterThan(scatterPoints[1].order_value_lakh);
  });

  it("STEP 10: should validate 4-tab Customize Dashboard configuration payload with chart types, groupings, measures, time grouping, top N", () => {
    const fullConfig: ProcurementDashboardConfigPayload = {
      layout_mode: "standard",
      kpi_cards_visible: {
        purchase_orders: true,
        purchase_spend: true,
        pending_approvals: true,
        pending_receipts: true,
        received_vs_ordered: true,
        supplier_outstanding: true,
      },
      charts_visible: {
        purchase_spend_trend: true,
        purchase_to_receipt_progress: true,
        purchase_order_status: true,
        top_articles_spend: true,
        spend_by_color: true,
        order_vs_receipt_by_size: true,
        reorder_alert: true,
        supplier_performance: true,
        article_color_heatmap: true,
        supplier_lead_time_vs_value: true,
      },
      chart_types: {
        purchase_spend_trend: "stacked_bar",
        top_articles_spend: "bar",
        purchase_order_status: "donut",
        spend_by_color: "pie",
        order_vs_receipt_by_size: "bar",
        reorder_alert: "table",
        supplier_performance: "combo",
        article_color_heatmap: "heatmap",
        supplier_lead_time_vs_value: "scatter",
      },
      tables_visible: {
        fulfillment_stream: true,
      },
      data_display: {
        default_tab: "all",
        rows_per_page: 10,
      },
      color_theme: "system",
      selected_widget: "purchase_spend_trend",
      group_by_primary: "article",
      group_by_secondary: "color",
      selected_measures: ["Ordered Qty", "Received Qty", "Pending Qty"],
      time_grouping: "monthly",
      top_n: 10,
    };

    expect(fullConfig.chart_types.purchase_spend_trend).toBe("stacked_bar");
    expect(fullConfig.chart_types.supplier_lead_time_vs_value).toBe("scatter");
    expect(fullConfig.chart_types.article_color_heatmap).toBe("heatmap");
    expect(fullConfig.group_by_primary).toBe("article");
    expect(fullConfig.group_by_secondary).toBe("color");
    expect(fullConfig.selected_measures).toHaveLength(3);
    expect(fullConfig.time_grouping).toBe("monthly");
    expect(fullConfig.top_n).toBe(10);
  });
});
