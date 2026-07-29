/**
 * Project      : SMRITI Retail OS
 * Module       : Inventory KPI Plugin Widget (Rule SLP-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Package, AlertTriangle, RefreshCw, Barcode } from "lucide-react";
import { LaunchpadWidgetPlugin, LaunchpadWidgetPluginProps } from "../types/widgetTypes.ts";
import { WidgetRegistry } from "../registry/WidgetRegistry.ts";

export const InventoryKpiWidgetComponent: React.FC<LaunchpadWidgetPluginProps> = ({ onSelectTab }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        onClick={() => onSelectTab("item-master")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[#0a6ed1] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Total SKUs</span>
          <Package className="w-3.5 h-3.5 text-[#0a6ed1]" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">1,420 Active</div>
        <div className="text-[10px] text-theme-muted mt-1">Master Database</div>
      </div>

      <div
        onClick={() => onSelectTab("item-master")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-amber-500 p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Low Stock Alerts</span>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">8 Items</div>
        <div className="text-[10px] text-amber-500 mt-1">Below Reorder Level</div>
      </div>

      <div
        onClick={() => onSelectTab("stock-ledger")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[#0a6ed1] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Stock Valuation</span>
          <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">₹14,80,450</div>
        <div className="text-[10px] text-theme-muted mt-1">FIFO Cost Basis</div>
      </div>

      <div
        onClick={() => onSelectTab("print-studio")}
        className="bg-theme-surface-1 border border-theme-divider hover:border-[#0a6ed1] p-3.5 rounded-lg cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center justify-between text-xs text-theme-muted mb-1">
          <span>Labels Printed Today</span>
          <Barcode className="w-3.5 h-3.5 text-sky-500" />
        </div>
        <div className="text-lg font-bold text-theme-heading font-mono">240 Labels</div>
        <div className="text-[10px] text-emerald-500 mt-1">Thermal Ready</div>
      </div>
    </div>
  );
};

export const InventoryKpiWidgetPlugin: LaunchpadWidgetPlugin = {
  id: "widget-inventory-kpi",
  title: "Inventory & Stock Health",
  zone: "ZoneB_BusinessSnapshot",
  targetRoles: ["*", "Owner", "Warehouse", "Manager"],
  orderIndex: 2,
  renderWidget: (props) => <InventoryKpiWidgetComponent {...props} />
};

WidgetRegistry.register(InventoryKpiWidgetPlugin);
