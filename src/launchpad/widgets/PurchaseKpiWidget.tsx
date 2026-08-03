/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase & Procurement KPI Plugin Widget (Rule SLP-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Briefcase, Building, FileCheck, Clock } from "lucide-react";
import { LaunchpadWidgetPlugin, LaunchpadWidgetPluginProps } from "../types/widgetTypes.ts";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

export const PurchaseKpiWidgetComponent: React.FC<LaunchpadWidgetPluginProps> = ({ onSelectTab }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        onClick={() => onSelectTab("purchase")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Purchases Today</span>
          <Briefcase className="w-3.5 h-3.5 text-purple-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹24,500</div>
        <div className="text-[10px] text-theme-muted mt-1">2 Approved POs</div>
      </div>

      <div
        onClick={() => onSelectTab("supplier-mgmt")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Active Vendors</span>
          <Building className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">42 Suppliers</div>
        <div className="text-[10px] text-emerald-500 mt-1">Verified Registry</div>
      </div>

      <div
        onClick={() => onSelectTab("purchase")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-amber-500 p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Pending GRNs</span>
          <Clock className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">3 GRNs</div>
        <div className="text-[10px] text-amber-500 mt-1">Awaiting Inspection</div>
      </div>

      <div
        onClick={() => onSelectTab("purchase")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Completed Bills</span>
          <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">18 Invoices</div>
        <div className="text-[10px] text-theme-muted mt-1">Matched & Filed</div>
      </div>
    </div>
  );
};

export const PurchaseKpiWidgetPlugin: LaunchpadWidgetPlugin = {
  id: "widget-purchase-kpi",
  title: "Procurement & Vendor Health",
  zone: "ZoneB_BusinessSnapshot",
  targetRoles: ["*", "Owner", "Purchaser", "Manager"],
  orderIndex: 3,
  renderWidget: (props) => <PurchaseKpiWidgetComponent {...props} />
};

WidgetRegistry.register(PurchaseKpiWidgetPlugin);
