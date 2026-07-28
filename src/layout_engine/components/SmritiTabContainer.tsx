/**
 * Project      : SMRITI Retail OS
 * Module       : Standardized Tabbed Container Component (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
  content: React.ReactNode;
}

interface SmritiTabContainerProps {
  tabs: TabItem[];
  defaultTabId?: string;
  toolbarRight?: React.ReactNode;
}

export const SmritiTabContainer: React.FC<SmritiTabContainerProps> = ({
  tabs,
  defaultTabId,
  toolbarRight
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(defaultTabId || tabs[0]?.id || "");
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-theme-base select-none">
      {/* Fixed Tab Strip Header (shrink-0) */}
      <div className="shrink-0 border-b border-theme-divider bg-theme-surface-1 px-4 pt-2 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-[#0a6ed1] text-[#0a6ed1] bg-theme-surface-2/60"
                    : "border-transparent text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover"
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#0a6ed1]/15 text-[#0a6ed1] font-mono">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {toolbarRight && <div className="pb-2">{toolbarRight}</div>}
      </div>

      {/* Scrollable Tab Content Pane (flex-1 min-h-0 overflow-y-auto) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab?.content}
      </div>
    </div>
  );
};
