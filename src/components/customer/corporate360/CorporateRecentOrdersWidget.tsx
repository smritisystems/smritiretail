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
 * Target UI    : Corporate Recent Orders Table Widget
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { RecentOrderItem } from "./types.ts";

interface CorporateRecentOrdersWidgetProps {
  orders: RecentOrderItem[];
  onViewAllOrders?: () => void;
  onSelectOrder?: (order: RecentOrderItem) => void;
}

export const CorporateRecentOrdersWidget: React.FC<CorporateRecentOrdersWidgetProps> = ({
  orders,
  onViewAllOrders,
  onSelectOrder,
}) => {
  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Recent Orders
          </h2>
          <button
            type="button"
            onClick={onViewAllOrders}
            className="text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] text-xs font-semibold flex items-center gap-1 transition"
          >
            <span>View All</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-3">Order No.</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Stores</th>
                <th className="py-2 px-3">Items</th>
                <th className="py-2 px-3">Value</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {orders.map((o) => (
                <tr
                  key={o.order_no}
                  onClick={() => onSelectOrder?.(o)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                >
                  <td className="py-2 px-3 font-mono font-semibold text-[#0284c7] dark:text-[#38bdf8] whitespace-nowrap group-hover:underline">
                    {o.order_no}
                  </td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {o.date}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {o.stores_count}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {o.items_count}
                  </td>
                  <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatCurrency(o.value)}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      o.status === "Completed"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : o.status === "Dispatched"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    }`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
