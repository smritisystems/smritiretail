/**
 * Project      : SMRITI Retail OS
 * Module       : Zone F — Plugin Widget Engine (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

interface PluginWidgetEngineProps {
  currentUser?: { role: string; name: string } | null;
  onSelectTab: (tabId: string) => void;
}

export const PluginWidgetEngine: React.FC<PluginWidgetEngineProps> = ({
  currentUser,
  onSelectTab
}) => {
  const pluginWidgets = WidgetRegistry.getWidgetsForZone(
    "ZoneF_PluginWidgets",
    currentUser?.role
  );

  if (pluginWidgets.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-theme-divider pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-[#0a6ed1] rounded-xs" />
          Extension Plugin Widgets
        </h3>
        <span className="text-[11px] font-mono text-theme-muted">Zone F Plugins</span>
      </div>

      <div className="space-y-3">
        {pluginWidgets.map((plugin) => (
          <React.Fragment key={plugin.id}>
            {plugin.renderWidget({ currentUser, onSelectTab })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
