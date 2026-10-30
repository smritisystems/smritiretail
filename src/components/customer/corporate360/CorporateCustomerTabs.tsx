/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Customer Navigation Tab Strip
 */

import React from "react";
import {
  LayoutDashboard,
  User,
  Building2,
  MapPin,
  GitFork,
  Store,
  BadgePercent,
  Package,
  Receipt,
} from "lucide-react";
import { CorporateTabKey } from "./types.ts";

interface CorporateCustomerTabsProps {
  activeTab: CorporateTabKey;
  onTabChange: (tab: CorporateTabKey) => void;
}

export const CorporateCustomerTabs: React.FC<CorporateCustomerTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs: {
    key: CorporateTabKey;
    label: string;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
  }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "basic", label: "Basic Details", icon: User },
    { key: "corporate_tax", label: "Corporate & Tax", icon: Building2 },
    { key: "addresses", label: "Addresses", icon: MapPin },
    { key: "parent_child", label: "Parent – Child", icon: GitFork },
    { key: "stores", label: "Stores / Outlets", icon: Store },
    { key: "commercial", label: "Commercial Terms", icon: BadgePercent },
    { key: "sales_invoices", label: "Sales & Invoices", icon: Receipt },
    { key: "psv", label: "PSV Reconciliation", icon: Package },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
      <nav aria-label="Customer profile sections" className="flex min-w-max items-center gap-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 border-b-2 px-1 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? "border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-300"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              }`}
            >
              <Icon size={14} className={isActive ? "text-sky-700 dark:text-sky-300" : "text-slate-500 dark:text-slate-400"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
