/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Dashboard Registry (UDR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UDR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PlatformContext } from "../../context/PlatformContext.js";

export type WidgetType = "kpi_card" | "line_chart" | "bar_chart" | "pie_chart" | "table_summary";

export interface DashboardWidget {
  id: string;             // Widget ID (e.g. "w_today_sales", "w_stock_alerts", "w_top_skus")
  title: string;
  type: WidgetType;
  gridSpan: { colSpan: number; rowSpan: number };
  entityId: string;       // Data source entity ID
  permissionId?: string;
  refreshIntervalMs?: number;
  config?: Record<string, any>;
}

export interface DashboardDefinition {
  id: string;             // Dashboard key (e.g. "dash.executive_hq", "dash.store_operations")
  name: string;
  description?: string;
  domainId: string;       // Active domain scope (e.g. "sales", "inventory", "accounting")
  permissionId: string;   // Required permission key
  widgets: DashboardWidget[];
}

export interface RenderedWidgetData {
  widgetId: string;
  title: string;
  type: WidgetType;
  renderedAt: string;
  data: any;
}

export class DashboardRegistryService {
  private dashboards: Map<string, Readonly<DashboardDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultDashboards();
  }

  private seedDefaultDashboards() {
    const defaults: DashboardDefinition[] = [
      {
        id: "dash.store_operations",
        name: "Store Operations & POS Executive Dashboard",
        description: "Real-time POS revenue KPI cards, hourly sales charts, and low stock alerts",
        domainId: "sales",
        permissionId: "sales.pos.billing",
        widgets: [
          { id: "w_today_sales", title: "Today's POS Revenue", type: "kpi_card", gridSpan: { colSpan: 3, rowSpan: 1 }, entityId: "sales_invoice" },
          { id: "w_transaction_count", title: "Bill Count", type: "kpi_card", gridSpan: { colSpan: 3, rowSpan: 1 }, entityId: "sales_invoice" },
          { id: "w_hourly_sales", title: "Hourly Revenue Trend", type: "line_chart", gridSpan: { colSpan: 6, rowSpan: 2 }, entityId: "sales_invoice" },
          { id: "w_low_stock", title: "Reorder Alert Items", type: "table_summary", gridSpan: { colSpan: 6, rowSpan: 2 }, entityId: "product" }
        ]
      }
    ];

    defaults.forEach((d) => this.registerDashboard(d));
  }

  public registerDashboard(dashboard: DashboardDefinition): void {
    const payload = Object.freeze({ ...dashboard, id: dashboard.id.toLowerCase() });
    this.dashboards.set(payload.id, payload);
    this.emitChange();
  }

  public getDashboard(id: string): Readonly<DashboardDefinition> | undefined {
    if (!id) return undefined;
    return this.dashboards.get(id.toLowerCase());
  }

  public getDashboards(): ReadonlyArray<Readonly<DashboardDefinition>> {
    return Array.from(this.dashboards.values());
  }

  public renderWidget(
    widgetId: string,
    dashboardId: string,
    context: Readonly<PlatformContext>
  ): RenderedWidgetData {
    const dash = this.getDashboard(dashboardId);
    if (!dash) throw new Error(`Dashboard '${dashboardId}' not registered in UDR.`);

    const widget = dash.widgets.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`Widget '${widgetId}' not found in dashboard '${dashboardId}'.`);

    // Mock widget analytics calculation
    let widgetData: any = { value: "₹48,920.00", changePercent: "+12.4%" };
    if (widget.type === "line_chart") {
      widgetData = { labels: ["10 AM", "12 PM", "2 PM", "4 PM", "6 PM"], values: [12000, 18500, 24000, 31000, 48920] };
    }

    return {
      widgetId: widget.id,
      title: widget.title,
      type: widget.type,
      renderedAt: new Date().toISOString(),
      data: widgetData
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.dashboards.clear();
    this.seedDefaultDashboards();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const DashboardRegistry = new DashboardRegistryService();
