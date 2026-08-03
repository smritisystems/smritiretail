/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Inventory Dashboard Workspace
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 — Dashboard Zone
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Renders: Health Group + Alerts Group + Operations Group + Timeline
 * Zone: dashboard
 * Shell: WorkspaceShell (zero domain logic in shell)
 */

import React, { useEffect, useState } from "react";
import { WorkspaceShell } from "../../layout_engine/components/WorkspaceShell.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WidgetEngine } from "../../layout_engine/WidgetEngine.js";
import { useSmritiExperience } from "../../context/SmritiExperienceContext.js";
import { SummaryCard } from "../shared/widgets/SummaryCard.js";
import { KPIProgressCard } from "../shared/widgets/KPIProgressCard.js";
import { AlertCard, AlertSeverity } from "../shared/widgets/AlertCard.js";
import { TimelineCard } from "../shared/widgets/TimelineCard.js";
import { TrendCard } from "../shared/widgets/TrendCard.js";
import { InventoryTimelineAdapter } from "../shared/WorkspaceTimeline.js";
import { INVENTORY_WORKSPACE_IDS } from "./inventory.manifest.js";

// ── Mock data (replaced by API calls in Sprint 1 of Phase 3 delivery) ────────

const MOCK_STOCK_VALUE = "₹24,87,450";
const MOCK_HEALTH = { current: 78, target: 100 };
const MOCK_TREND = [
  { label: "Mon", value: 420 },
  { label: "Tue", value: 380 },
  { label: "Wed", value: 510 },
  { label: "Thu", value: 470 },
  { label: "Fri", value: 625 },
  { label: "Sat", value: 590 },
  { label: "Today", value: 682 },
];

const MOCK_ALERTS = [
  { id: "a1", severity: "warning" as AlertSeverity, title: "Stock Below Reorder Point", description: "Nike Air Max 270 (Size 9) — 3 units remaining, reorder level: 10", raisedAt: new Date(Date.now() - 1800000).toISOString(), actionLabel: "Order Now" },
  { id: "a2", severity: "warning" as AlertSeverity, title: "Stock Below Reorder Point", description: "Adidas Stan Smith (Size 8) — 2 units remaining, reorder level: 8", raisedAt: new Date(Date.now() - 3600000).toISOString(), actionLabel: "Order Now" },
  { id: "a3", severity: "info" as AlertSeverity, title: "Batch Nearing Expiry", description: "Cold Storage Item — 15 days to expiry (12 units)", raisedAt: new Date(Date.now() - 7200000).toISOString() },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const InventoryDashboardWorkspace: React.FC = () => {
  const { canRender, mode } = useSmritiExperience();
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  const metadata = WorkspaceRegistry.get(INVENTORY_WORKSPACE_IDS.DASHBOARD)!;
  const widgetsByGroup = WidgetEngine.getWidgetsByGroup("dash.inventory_overview", mode);

  useEffect(() => {
    // When real API is wired: fetch from smriti-api /api/v1/inventory/alerts
    // For now mock data is used
  }, []);

  const filterBar = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
      <select
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--c-border, rgba(255,255,255,0.1))",
          background: "var(--c-surface, #1a1a2e)",
          color: "var(--c-text-primary, #e2e8f0)",
          fontSize: 12,
        }}
      >
        <option value="">All Categories</option>
        <option value="footwear">Footwear</option>
        <option value="apparel">Apparel</option>
        <option value="accessories">Accessories</option>
      </select>
      <select
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--c-border, rgba(255,255,255,0.1))",
          background: "var(--c-surface, #1a1a2e)",
          color: "var(--c-text-primary, #e2e8f0)",
          fontSize: 12,
        }}
      >
        <option value="">All Locations</option>
        <option value="main">Main Store</option>
        <option value="warehouse">Warehouse</option>
        <option value="branch2">Branch 2</option>
      </select>
    </div>
  );

  const dashboardBody = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sxp-widget-gap, 16px)", padding: 16 }}>

      {/* ── Health Group ── */}
      <section aria-label="Stock Health">
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-muted, #64748b)", marginBottom: 12 }}>
          Stock Health
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--sxp-widget-gap, 16px)" }}>
          <SummaryCard
            title="Total Stock Value"
            value={MOCK_STOCK_VALUE}
            subtitle="Across all locations"
            icon="💰"
            accent
          />
          {canRender("reservations") && (
            <SummaryCard
              title="Active Reservations"
              value={12}
              unit="items"
              subtitle="Locked for orders"
              icon="🔒"
            />
          )}
          {canRender("reservations") && (
            <KPIProgressCard
              title="Stock Health Score"
              current={MOCK_HEALTH.current}
              target={MOCK_HEALTH.target}
              unit="%"
              direction="high_is_good"
              icon="❤️"
            />
          )}
          <TrendCard
            title="Units Moved (7 Days)"
            data={MOCK_TREND}
            unit=" units"
            positive
            changeLabel="+15.6%"
          />
        </div>
      </section>

      {/* ── Alerts Group ── */}
      {(widgetsByGroup.get("alerts")?.length ?? 0) > 0 && (
        <section aria-label="Stock Alerts">
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-muted, #64748b)", marginBottom: 12 }}>
            Alerts
          </h3>
          <AlertCard
            alerts={alerts}
            onDismiss={(id) => setAlerts((a) => a.filter((x) => x.id !== id))}
          />
        </section>
      )}

      {/* ── Operations / Timeline Group ── */}
      <section aria-label="Recent Stock Movements">
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-text-muted, #64748b)", marginBottom: 12 }}>
          Recent Movements
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--sxp-widget-gap, 16px)" }}>
          <TimelineCard
            title="Stock Movement Timeline"
            adapter={InventoryTimelineAdapter}
            entityId="all"
            limit={8}
          />
        </div>
      </section>
    </div>
  );

  if (!metadata) {
    return <div style={{ padding: 32, color: "var(--c-text-muted, #64748b)" }}>Inventory workspace not registered. Import inventory.manifest.ts.</div>;
  }

  return (
    <WorkspaceShell
      metadata={metadata}
      filterStrip={filterBar}
      body={dashboardBody}
    />
  );
};
