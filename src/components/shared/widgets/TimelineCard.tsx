/**
 * SXP v1.0 â€” TimelineCard Widget
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

const _TimelineCardComponent: React.FC<TimelineCardProps> = ({ title, adapter, entityId, limit = 5 }) => (
  <div style={{
    padding: "var(--sxp-widget-padding, 20px)",
    borderRadius: "var(--sxp-widget-radius, 10px)",
    border: "1px solid var(--c-theme-divider)",
    background: "var(--c-theme-surface-2)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 200,
  }}>
    <div style={{ fontSize: 11, color: "var(--c-theme-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
      {title}
    </div>
    <WorkspaceTimeline adapter={adapter} entityId={entityId} limit={limit} compact />
  </div>
);

/** Sprint 3: React.memo prevents re-renders on every EventBus tick */
export const TimelineCard = React.memo(_TimelineCardComponent);
