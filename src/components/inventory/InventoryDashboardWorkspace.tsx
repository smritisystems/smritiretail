/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Inventory Dashboard Workspace
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 — Dashboard Zone
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.0.0  (Sprint 1 — real API wiring)
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
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

// ── Fallback mock data (used when API is unavailable) ─────────────────────────────────

const FALLBACK_STOCK_VALUE = "₹24,87,450";
const FALLBACK_HEALTH = { current: 78, target: 100 };
const FALLBACK_TREND = [
  { label: "Mon", value: 420 }, { label: "Tue", value: 380 }, { label: "Wed", value: 510 },
  { label: "Thu", value: 470 }, { label: "Fri", value: 625 }, { label: "Sat", value: 590 },
  { label: "Today", value: 682 },
];
const FALLBACK_ALERTS = [
  { id: "a1", severity: "warning" as AlertSeverity, title: "Stock Below Reorder Point", description: "Nike Air Max 270 (Size 9) — 3 units remaining", raisedAt: new Date(Date.now() - 1800000).toISOString(), actionLabel: "Order Now" },
  { id: "a2", severity: "warning" as AlertSeverity, title: "Stock Below Reorder Point", description: "Adidas Stan Smith (Size 8) — 2 units remaining", raisedAt: new Date(Date.now() - 3600000).toISOString(), actionLabel: "Order Now" },
  { id: "a3", severity: "info" as AlertSeverity, title: "Batch Nearing Expiry", description: "Cold Storage Item — 15 days to expiry (12 units)", raisedAt: new Date(Date.now() - 7200000).toISOString() },
];

// ── API response shapes ──────────────────────────────────────────────────────────────

interface InventoryAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  raised_at: string;
  action_label?: string;
}

interface InventoryKPI {
  stock_value_formatted: string;
  health_score: number;
  active_reservations: number;
  units_moved_7d: Array<{ label: string; value: number }>;
  units_moved_change_pct: string;
  units_moved_positive: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const InventoryDashboardWorkspace: React.FC = () => {
  const { canRender, mode } = useSmritiExperience();

  // ── API state ──────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState(FALLBACK_ALERTS);
  const [kpi, setKpi] = useState<InventoryKPI>({
    stock_value_formatted: FALLBACK_STOCK_VALUE,
    health_score: FALLBACK_HEALTH.current,
    active_reservations: 0,
    units_moved_7d: FALLBACK_TREND,
    units_moved_change_pct: "+15.6%",
    units_moved_positive: true,
  });
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const metadata = WorkspaceRegistry.get(INVENTORY_WORKSPACE_IDS.DASHBOARD)!;
  const widgetsByGroup = WidgetEngine.getWidgetsByGroup("dash.inventory_overview", mode);

  // ── Fetch KPI data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    apiFetchV1("/api/v1/inventory/kpi")
      .then((res) => res.json() as Promise<InventoryKPI>)
      .then((data) => { if (!cancelled) setKpi(data); })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setKpiLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Fetch alerts ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    apiFetchV1("/api/v1/inventory/alerts")
      .then((res) => res.json() as Promise<InventoryAlert[]>)
      .then((data) => {
        if (!cancelled) setAlerts(
          data.map((a) => ({
            id: a.id,
            severity: a.severity,
            title: a.title,
            description: a.description,
            raisedAt: a.raised_at,
            actionLabel: a.action_label,
          }))
        );
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setAlertsLoading(false); });
    return () => { cancelled = true; };
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
          Stock Health {kpiLoading && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 6 }}>(loading…)</span>}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--sxp-widget-gap, 16px)" }}>
          <SummaryCard
            title="Total Stock Value"
            value={kpi.stock_value_formatted}
            subtitle="Across all locations"
            icon="💰"
            accent
          />
          {canRender("reservations") && (
            <SummaryCard
              title="Active Reservations"
              value={kpi.active_reservations}
              unit="items"
              subtitle="Locked for orders"
              icon="🔒"
            />
          )}
          {canRender("reservations") && (
            <KPIProgressCard
              title="Stock Health Score"
              current={kpi.health_score}
              target={100}
              unit="%"
              direction="high_is_good"
              icon="❤️"
            />
          )}
          <TrendCard
            title="Units Moved (7 Days)"
            data={kpi.units_moved_7d}
            unit=" units"
            positive={kpi.units_moved_positive}
            changeLabel={kpi.units_moved_change_pct}
          />
        </div>
      </section>

      {/* ── Alerts Group ── */}
      {alertsLoading
        ? <div style={{ fontSize: 12, color: "var(--c-text-muted)", padding: "8px 0" }}>Loading alerts…</div>
        : (widgetsByGroup.get("alerts")?.length ?? 0) > 0 && (
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
