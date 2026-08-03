/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — WorkspaceTimeline Engine (SWEF P-005)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 — Certification Gate SXP-CS-005
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (SWEF P-005):
 *   All timeline views MUST use WorkspaceTimeline.
 *   No custom timeline components are permitted in any studio.
 *
 * DESIGN: Single renderer — domain adapters supplied as props.
 *   Timeline entries always show PLAIN LANGUAGE — never ERP codes.
 *   "Purchase Receipt" not "ITEX_INWARD_MOVEMENT"
 */

import React from "react";

// ── Adapter Interface ─────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  /** Plain-language label — "Purchase Receipt", not "ITEX_INWARD_MOVEMENT" */
  label: string;
  /** Plain description — "25 units received from Nike India" */
  description?: string;
  timestamp: string;
  status: "completed" | "active" | "pending" | "failed";
  /** Lucide icon name or emoji */
  icon?: string;
  /** Metadata shown on hover/expand (plain language only) */
  meta?: Record<string, string>;
}

export interface TimelineAdapter {
  id: string;
  /** Fetch timeline entries for a given entity */
  getEntries(entityId: string, limit?: number): Promise<TimelineEntry[]>;
}

// ── Built-in Adapter Stubs ────────────────────────────────────────────────────
// Inventory Studio wires real data to these adapters in Phase 3.

export const InventoryTimelineAdapter: TimelineAdapter = {
  id: "inventory",
  async getEntries(entityId, limit = 10) {
    // Placeholder — replaced by real API call in InventoryDashboardWorkspace
    return ([
      { id: "1", label: "Purchase Receipt", description: "25 units received", timestamp: new Date().toISOString(), status: "completed" as const, icon: "📦" },
      { id: "2", label: "Transferred Out", description: "10 units to Branch 2", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "completed" as const, icon: "🚚" },
      { id: "3", label: "Reserved", description: "5 units reserved for Order #1042", timestamp: new Date(Date.now() - 7200000).toISOString(), status: "active" as const, icon: "🔒" },
    ] satisfies TimelineEntry[]).slice(0, limit);
  },
};

export const SalesTimelineAdapter: TimelineAdapter = {
  id: "sales",
  async getEntries(_entityId, limit = 10) {
    return ([
      { id: "1", label: "Quotation Sent", timestamp: new Date().toISOString(), status: "completed" as const, icon: "📄" },
      { id: "2", label: "Order Confirmed", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "completed" as const, icon: "✅" },
      { id: "3", label: "Invoice Generated", timestamp: new Date(Date.now() - 7200000).toISOString(), status: "active" as const, icon: "🧾" },
    ] satisfies TimelineEntry[]).slice(0, limit);
  },
};

export const PurchaseTimelineAdapter: TimelineAdapter = {
  id: "purchase",
  async getEntries(_entityId, limit = 10) {
    return ([
      { id: "1", label: "Purchase Order Raised", timestamp: new Date().toISOString(), status: "completed" as const, icon: "📋" },
      { id: "2", label: "Goods Receipt", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "active" as const, icon: "🏭" },
    ] satisfies TimelineEntry[]).slice(0, limit);
  },
};

export const WorkflowTimelineAdapter: TimelineAdapter = {
  id: "workflow",
  async getEntries(_entityId, limit = 10) {
    return ([
      { id: "1", label: "Submitted for Approval", timestamp: new Date().toISOString(), status: "completed" as const, icon: "📤" },
      { id: "2", label: "Under Review", timestamp: new Date(Date.now() - 1800000).toISOString(), status: "active" as const, icon: "👁" },
    ] satisfies TimelineEntry[]).slice(0, limit);
  },
};

// ── Timeline Component ────────────────────────────────────────────────────────

export interface WorkspaceTimelineProps {
  adapter: TimelineAdapter;
  entityId: string;
  limit?: number;
  /** If true, shows a compact strip (for dashboard widgets) */
  compact?: boolean;
}

export const WorkspaceTimeline: React.FC<WorkspaceTimelineProps> = ({
  adapter,
  entityId,
  limit = 10,
  compact = false,
}) => {
  const [entries, setEntries] = React.useState<TimelineEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    adapter.getEntries(entityId, limit).then((data) => {
      setEntries(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [adapter, entityId, limit]);

  if (loading) {
    return (
      <div style={{ padding: 16, color: "var(--c-text-muted, #64748b)", fontSize: 13 }}>
        Loading timeline…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--c-text-muted, #64748b)", fontSize: 13 }}>
        No activity yet
      </div>
    );
  }

  const statusColors = {
    completed: "#22c55e",
    active: "#818cf8",
    pending: "#94a3b8",
    failed: "#ef4444",
  };

  return (
    <div
      style={{
        padding: compact ? "8px 0" : "16px 0",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sxp-timeline-gap, 12px)",
      }}
    >
      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          {/* Node */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <div
              style={{
                width: compact ? 24 : "var(--sxp-timeline-node, 32px)",
                height: compact ? 24 : "var(--sxp-timeline-node, 32px)",
                borderRadius: "50%",
                background: `${statusColors[entry.status]}22`,
                border: `2px solid ${statusColors[entry.status]}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: compact ? 11 : 14,
                flexShrink: 0,
              }}
            >
              {entry.icon ?? "●"}
            </div>
            {idx < entries.length - 1 && (
              <div
                style={{
                  width: "var(--sxp-timeline-connector, 2px)",
                  flex: 1,
                  minHeight: 16,
                  background: "var(--c-border, rgba(255,255,255,0.1))",
                  margin: "2px 0",
                }}
              />
            )}
          </div>

          {/* Content */}
          <div style={{ paddingTop: 2, flex: 1 }}>
            <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: "var(--c-text-primary, #e2e8f0)" }}>
              {entry.label}
            </div>
            {entry.description && !compact && (
              <div style={{ fontSize: 12, color: "var(--c-text-secondary, #94a3b8)", marginTop: 2 }}>
                {entry.description}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", marginTop: 2 }}>
              {new Date(entry.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
