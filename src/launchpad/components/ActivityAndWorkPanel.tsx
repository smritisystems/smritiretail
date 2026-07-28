/**
 * Project      : SMRITI Retail OS
 * Module       : Zone G — Activity & Pending Work Panel (Rule SLP-002 & SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Clock, FileText, CheckSquare, ArrowRight, Play } from "lucide-react";
import { LaunchpadCache } from "../cache/launchpadCache.ts";

interface ActivityAndWorkPanelProps {
  onSelectTab: (tabId: string) => void;
}

export const ActivityAndWorkPanel: React.FC<ActivityAndWorkPanelProps> = ({ onSelectTab }) => {
  const cacheData = LaunchpadCache.get();

  const pendingWorkItems = [
    { id: "work-1", title: "Draft Purchase Order PO-2026-088", subtitle: "Awaiting approval from Manager", tab: "purchase" },
    { id: "work-2", title: "2 Unposted Inventory Receipts (GRN)", subtitle: "Pending stock ledger posting", tab: "stock-ledger" },
    { id: "work-3", title: "Customer Credit Refund Request", subtitle: "RMA #7719 pending review", tab: "sales-returns" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Pending Work Items */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-theme-divider pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-heading flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#0a6ed1]" /> My Pending Work
          </h3>
          <span className="text-[11px] font-mono text-theme-muted">{pendingWorkItems.length} Items</span>
        </div>

        <div className="space-y-2">
          {pendingWorkItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectTab(item.tab)}
              className="p-3 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-[#0a6ed1] flex items-center justify-between cursor-pointer transition-all shadow-xs group"
            >
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-theme-heading group-hover:text-[#0a6ed1] transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-theme-muted">{item.subtitle}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-theme-muted group-hover:text-[#0a6ed1] group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Recent Activity & Continue Working Shortcuts */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-theme-divider pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-theme-heading flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" /> Recent Activity
          </h3>
          <span className="text-[11px] font-mono text-theme-muted">Continue Working</span>
        </div>

        <div className="space-y-2">
          {cacheData.recentActivities.map((act) => (
            <div
              key={act.id}
              onClick={() => onSelectTab(act.tab)}
              className="p-3 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-emerald-500 flex items-center justify-between cursor-pointer transition-all shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Play className="w-3.5 h-3.5 fill-emerald-500" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-theme-heading group-hover:text-emerald-500 transition-colors">
                    {act.title}
                  </h4>
                  <span className="text-[10px] font-mono text-theme-muted">{act.timestamp}</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#0a6ed1] group-hover:underline">Open →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
