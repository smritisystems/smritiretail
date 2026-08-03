/**
 * SXP v1.0 — TimelineCard Widget
 * SWEF: WidgetType "timeline_card" | Embeds WorkspaceTimeline in a card shell
 */
import React from "react";
import { WorkspaceTimeline, TimelineAdapter } from "../WorkspaceTimeline.js";

interface TimelineCardProps {
  title: string;
  adapter: TimelineAdapter;
  entityId: string;
  limit?: number;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ title, adapter, entityId, limit = 5 }) => (
  <div style={{
    padding: "var(--sxp-widget-padding, 20px)",
    borderRadius: "var(--sxp-widget-radius, 10px)",
    border: "1px solid var(--c-border, rgba(255,255,255,0.08))",
    background: "var(--c-surface-elevated, rgba(255,255,255,0.04))",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 200,
  }}>
    <div style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
      {title}
    </div>
    <WorkspaceTimeline adapter={adapter} entityId={entityId} limit={limit} compact />
  </div>
);
