import React, { useState } from "react";
import { Product } from "../../types.ts";

interface ClassicUxWorkspaceProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tab: string) => void;
  onNotification?: (title: string, message: string, type?: any) => void;
}

const treeCategories = [
  {
    name: "Sales",
    icon: "point_of_sale",
    items: [
      { label: "Billing Workspace", tab: "billing-workspace" },
      { label: "Sales Documents", tab: "sales" },
      { label: "Customer", tab: "customer-master" },
      { label: "Price List", tab: "price-revision" },
    ],
  },
  {
    name: "Purchase",
    icon: "shopping_bag",
    items: [
      { label: "Purchase Order", tab: "purchase" },
      { label: "Goods Receipt (GRN)", tab: "grn-studio" },
      { label: "Vendor Master", tab: "vendor-360" },
    ],
  },
  {
    name: "Inventory",
    icon: "inventory_2",
    items: [
      { label: "Stock Ledger", tab: "stock-ledger" },
      { label: "Barcode Studio", tab: "barcode" },
      { label: "Physical Stock", tab: "stock-ledger" },
    ],
  },
  {
    name: "Accounts",
    icon: "account_balance",
    items: [
      { label: "Business Ledger", tab: "business-ledger" },
      { label: "Day Close", tab: "day-close" },
    ],
  },
  {
    name: "CRM",
    icon: "groups",
    items: [
      { label: "CRM Studio", tab: "crm" },
      { label: "Loyalty Studio", tab: "loyalty" },
    ],
  },
  {
    name: "Reports",
    icon: "bar_chart",
    items: [
      { label: "Report Designer", tab: "report-designer" },
      { label: "Visual Reports", tab: "visual-reports" },
    ],
  },
  {
    name: "Masters",
    icon: "storage",
    items: [
      { label: "Item Master", tab: "item-master" },
      { label: "Customer Master", tab: "customer-master" },
      { label: "Document Series", tab: "document-series" },
    ],
  },
  {
    name: "Tools",
    icon: "build",
    items: [
      { label: "Backup & Restore", tab: "database-manager" },
      { label: "System Parameters", tab: "system-parameters" },
    ],
  },
  {
    name: "Settings",
    icon: "settings",
    items: [
      { label: "User Profile", tab: "user-profile" },
      { label: "POS Profiles", tab: "profiles" },
    ],
  },
];

export const ClassicUxWorkspace: React.FC<ClassicUxWorkspaceProps> = ({ onNavigateTab }) => {
  const [expandedCategory, setExpandedCategory] = useState("Sales");
  const [selectedSubItem, setSelectedSubItem] = useState("Billing Workspace");

  return (
    <div className="flex flex-col h-full w-full bg-[#f1f5f9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden">
      <div className="bg-[#1e293b] text-slate-200 text-xs px-3 py-1 flex items-center justify-between border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-white tracking-wide flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-sm bg-blue-600 flex items-center justify-center text-[10px] text-white font-mono">S</span>
            SMRITI Retail OS
          </span>
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-300">
            {[
              ["Master", "item-master"],
              ["Transactions", "billing-workspace"],
              ["Inventory", "stock-ledger"],
              ["Accounts", "business-ledger"],
              ["CRM", "crm"],
              ["Reports", "report-designer"],
              ["Tools", "system-parameters"],
              ["Settings", "profiles"],
              ["Help", "wiki"],
            ].map(([label, tab]) => (
              <button
                key={label}
                type="button"
                onClick={() => onNavigateTab?.(tab)}
                className="hover:text-white hover:underline cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span>PORT: 8000</span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">FASTAPI POSTGRES</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-52 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          {treeCategories.map((category) => {
            const isOpen = expandedCategory === category.name;
            return (
              <div key={category.name} className="border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isOpen ? "" : category.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer ${
                    isOpen
                      ? "bg-[#2563eb] text-white shadow-xs"
                      : "bg-slate-100/70 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">{category.icon}</span>
                    {category.name}
                  </span>
                  <span className="material-symbols-outlined text-[14px]">{isOpen ? "expand_less" : "chevron_right"}</span>
                </button>
                {isOpen && (
                  <div className="bg-slate-50 dark:bg-slate-950/60 py-1 space-y-0.5">
                    {category.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setSelectedSubItem(item.label);
                          onNavigateTab?.(item.tab);
                        }}
                        className={`w-full text-left pl-7 pr-3 py-1.5 text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                          selectedSubItem === item.label
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="text-[10px]">›</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-slate-900 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Classic ERP Operational Overview</h2>
          <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300 dark:border-slate-700">
                <tr>
                  <th className="p-2.5">Metric Module</th>
                  <th className="p-2.5 text-right">Today Count</th>
                  <th className="p-2.5 text-right">Value (INR)</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                <tr>
                  <td className="p-2.5 font-sans font-medium">POS Retail Billing</td>
                  <td className="p-2.5 text-right">42</td>
                  <td className="p-2.5 text-right font-bold text-emerald-600">₹ 24,560.00</td>
                  <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">RECONCILED</span></td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium">Goods Receipt (GRN)</td>
                  <td className="p-2.5 text-right">3</td>
                  <td className="p-2.5 text-right">₹ 1,18,400.00</td>
                  <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">INSPECTED</span></td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-medium">Active Inventory SKUs</td>
                  <td className="p-2.5 text-right">128</td>
                  <td className="p-2.5 text-right">₹ 4,82,310.00</td>
                  <td className="p-2.5 font-sans"><span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">NORMAL</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
};
