/**
 * Project      : SMRITI Retail OS
 * Module       : Sales KPI Plugin Widget (Rule SLP-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { TrendingUp, ShoppingBag, CreditCard, Users } from "lucide-react";
import { LaunchpadWidgetPlugin, LaunchpadWidgetPluginProps } from "../types/widgetTypes.ts";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

export const SalesKpiWidgetComponent: React.FC<LaunchpadWidgetPluginProps> = ({ onSelectTab }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        onClick={() => onSelectTab("sales")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Sales Today</span>
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹48,920.00</div>
        <div className="text-[10px] text-emerald-500 font-medium mt-1">â†‘ +14.2% vs yesterday</div>
      </div>

      <div
        onClick={() => onSelectTab("pos")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Bills Issued</span>
          <ShoppingBag className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">142 Invoices</div>
        <div className="text-[10px] text-theme-muted mt-1">Avg Bill: â‚¹344.50</div>
      </div>

      <div
        onClick={() => onSelectTab("pos")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Cash Drawer</span>
          <CreditCard className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">â‚¹18,450.00</div>
        <div className="text-[10px] text-theme-muted mt-1">Shift Active</div>
      </div>

      <div
        onClick={() => onSelectTab("customers")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[var(--c-seef-accent)] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Customers Served</span>
          <Users className="w-3.5 h-3.5 text-rose-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">98 CRM Clients</div>
        <div className="text-[10px] text-emerald-500 mt-1">12 Loyalty Registrations</div>
      </div>
    </div>
  );
};

export const SalesKpiWidgetPlugin: LaunchpadWidgetPlugin = {
  id: "widget-sales-kpi",
  title: "Sales & POS Performance",
  zone: "ZoneB_BusinessSnapshot",
  targetRoles: ["*", "Owner", "Cashier", "Manager"],
  orderIndex: 1,
  renderWidget: (props) => <SalesKpiWidgetComponent {...props} />
};

WidgetRegistry.register(SalesKpiWidgetPlugin);
