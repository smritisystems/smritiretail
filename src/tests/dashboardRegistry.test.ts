/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Dashboard Registry (UDR Phase 7 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UDR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";
import { DashboardRegistry, type DashboardDefinition } from "../kernel/upr/dashboard/DashboardRegistry.js";

describe("Universal Dashboard Registry (UDR Phase 7 Core)", () => {
  beforeEach(() => {
    DashboardRegistry.clear();
  });

  it("should seed default store operations dashboard (dash.store_operations)", () => {
    const dashboards = SPK.dashboard.getDashboards();
    expect(dashboards.length).toBeGreaterThanOrEqual(1);

    const storeDash = SPK.dashboard.getDashboard("dash.store_operations");
    expect(storeDash).toBeDefined();
    expect(storeDash?.domainId).toBe("sales");
    expect(storeDash?.widgets.length).toBeGreaterThanOrEqual(4);
  });

  it("should render widget analytical calculation data", () => {
    const context = createPlatformContext();
    const widgetData = SPK.dashboard.renderWidget("w_today_sales", "dash.store_operations", context);

    expect(widgetData.widgetId).toBe("w_today_sales");
    expect(widgetData.type).toBe("kpi_card");
    expect(widgetData.data.value).toBe("₹48,920.00");
  });

  it("should support dynamic registration of plugin dashboards", () => {
    const customDash: DashboardDefinition = {
      id: "dash.jewellery_analytics",
      name: "Gold & Bullion Vault Analytics Dashboard",
      domainId: "inventory",
      permissionId: "inventory.item.read",
      widgets: [
        { id: "w_gold_rate", title: "Live 24K Gold Rate", type: "kpi_card", gridSpan: { colSpan: 4, rowSpan: 1 }, entityId: "rates" }
      ]
    };

    SPK.dashboard.registerDashboard(customDash);

    const registered = SPK.dashboard.getDashboard("dash.jewellery_analytics");
    expect(registered).toBeDefined();
    expect(registered?.name).toBe("Gold & Bullion Vault Analytics Dashboard");
  });
});
