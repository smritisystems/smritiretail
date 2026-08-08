/**
 * Project      : SMRITI Retail OS
 * Module       : Zone B â€” Business Snapshot Engine (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

interface BusinessSnapshotEngineProps {
  currentUser?: { role: string; name: string } | null;
  onSelectTab: (tabId: string) => void;
}

export const BusinessSnapshotEngine: React.FC<BusinessSnapshotEngineProps> = ({
  currentUser,
  onSelectTab
}) => {
  const widgetPlugins = WidgetRegistry.getWidgetsForZone(
    "ZoneB_BusinessSnapshot",
    currentUser?.role
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-theme-divider pb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-[var(--c-seef-accent)] rounded-xs" />
          Business Health Snapshot
        </h2>
        <span className="text-[11px] font-mono text-theme-muted">Live Dashboard Metrics</span>
      </div>

      {widgetPlugins.length === 0 ? (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-6 text-center text-xs text-theme-muted font-mono">
          No KPI widgets registered for current role: {currentUser?.role || "Staff"}
        </div>
      ) : (
        <div className="space-y-3">
          {widgetPlugins.map((plugin) => (
            <React.Fragment key={plugin.id}>
              {plugin.renderWidget({ currentUser, onSelectTab })}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
