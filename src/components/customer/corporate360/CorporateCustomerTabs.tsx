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
import { CorporateTabKey } from "./types.ts";

interface CorporateCustomerTabsProps {
  activeTab: CorporateTabKey;
  onTabChange: (tab: CorporateTabKey) => void;
  storesCount: number;
}

export const CorporateCustomerTabs: React.FC<CorporateCustomerTabsProps> = ({
  activeTab,
  onTabChange,
  storesCount,
}) => {
  const tabs: { key: CorporateTabKey; label: string; badge?: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "stores", label: `Stores (${storesCount.toLocaleString("en-IN")})` },
    { key: "orders", label: "Orders" },
    { key: "invoices", label: "Invoices" },
    { key: "payments", label: "Payments" },
    { key: "psv", label: "PSV & Inventory" },
    { key: "products", label: "Products" },
    { key: "communication", label: "Communication" },
    { key: "contracts", label: "Contracts" },
    { key: "addresses", label: "Addresses" },
    { key: "team", label: "Team" },
    { key: "notes", label: "Notes" },
    { key: "history", label: "History" },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none bg-white dark:bg-[#1e222d] rounded-t-xl px-2">
      <nav className="flex items-center space-x-1 sm:space-x-4 min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`py-3 px-2 sm:px-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 relative ${
                isActive
                  ? "text-[#0284c7] dark:text-[#38bdf8] border-[#0284c7] dark:border-[#38bdf8] font-bold"
                  : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-[#0284c7] dark:bg-[#38bdf8] rounded-t-sm" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
