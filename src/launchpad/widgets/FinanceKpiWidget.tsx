/**
 * Project      : SMRITI Retail OS
 * Module       : Finance & Accounting KPI Plugin Widget (Rule SLP-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { DollarSign, ShieldAlert, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { LaunchpadWidgetPlugin, LaunchpadWidgetPluginProps } from "../types/widgetTypes.ts";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

export const FinanceKpiWidgetComponent: React.FC<LaunchpadWidgetPluginProps> = ({ onSelectTab }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        onClick={() => onSelectTab("ledger")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Net Cash Balance</span>
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹2,14,000</div>
        <div className="text-[10px] text-emerald-500 mt-1">Bank & Cash In Hand</div>
      </div>

      <div
        onClick={() => onSelectTab("ledger")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Accounts Receivable</span>
          <ArrowDownLeft className="w-3.5 h-3.5 text-sky-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹38,200</div>
        <div className="text-[10px] text-theme-muted mt-1">Customer Outstandings</div>
      </div>

      <div
        onClick={() => onSelectTab("ledger")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Accounts Payable</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹52,100</div>
        <div className="text-[10px] text-theme-muted mt-1">Vendor Bills Due</div>
      </div>

      <div
        onClick={() => onSelectTab("reports")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>GST Liability (Est.)</span>
          <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹8,820</div>
        <div className="text-[10px] text-indigo-500 mt-1">GSTR-3B Current Period</div>
      </div>
    </div>
  );
};

export const FinanceKpiWidgetPlugin: LaunchpadWidgetPlugin = {
  id: "widget-finance-kpi",
  title: "Financial Ledger & Cash Flow",
  zone: "ZoneB_BusinessSnapshot",
  targetRoles: ["*", "Owner", "Accountant", "Manager"],
  orderIndex: 4,
  renderWidget: (props) => <FinanceKpiWidgetComponent {...props} />
};

WidgetRegistry.register(FinanceKpiWidgetPlugin);
