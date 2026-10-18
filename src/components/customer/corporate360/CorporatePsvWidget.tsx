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
 * Target UI    : Corporate PSV Donut Chart Widget
 */

import React, { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ArrowRight, ChevronDown } from "lucide-react";
import { CorporatePsvSummary } from "./types.ts";

interface CorporatePsvWidgetProps {
  psvSummary: CorporatePsvSummary;
  onNavigatePsv?: () => void;
}

export const CorporatePsvWidget: React.FC<CorporatePsvWidgetProps> = ({
  psvSummary,
  onNavigatePsv,
}) => {
  const [metricUnit, setMetricUnit] = useState<"VALUE" | "UNITS">("VALUE");

  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${val.toLocaleString("en-IN")}`;
  };

  const chartData = [
    {
      name: "In Stock",
      value: psvSummary.in_stock_value || 1624000000,
      stores: psvSummary.in_stock_stores || 2012,
      color: "#0284c7",
    },
    {
      name: "Low Stock",
      value: psvSummary.low_stock_value || 186000000,
      stores: psvSummary.low_stock_stores || 231,
      color: "#f59e0b",
    },
    {
      name: "Out of Stock",
      value: psvSummary.out_of_stock_value || 57000000,
      stores: psvSummary.out_of_stock_stores || 75,
      color: "#ef4444",
    },
  ];

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Widget Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            PSV (Party Stock Visibility)
          </h2>
          <select
            value={metricUnit}
            onChange={(e) => setMetricUnit(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
          >
            <option value="VALUE">Value (₹)</option>
            <option value="UNITS">Store Count</option>
          </select>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-4 text-[11px] mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
            <span className="text-slate-600 dark:text-slate-300">In Stock</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span className="text-slate-600 dark:text-slate-300">Low Stock</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span className="text-slate-600 dark:text-slate-300">Out of Stock</span>
          </div>
        </div>

        {/* Donut Chart & Breakdown */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">

          {/* Donut Container with Center Overlay */}
          <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`psv-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderRadius: "8px",
                    border: "none",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900 dark:text-white leading-tight">
                {formatCurrency(psvSummary.total_value || 1867000000)}
              </span>
              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                Total Store Stock
              </span>
            </div>
          </div>

          {/* Breakdown Items List */}
          <div className="flex-1 w-full space-y-3 text-xs">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-1.5 last:border-none">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block font-mono">
                      {formatCurrency(item.value)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.name} ({item.stores.toLocaleString("en-IN")} stores)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Footer Navigation Link */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          Live consignment audit
        </span>
        <button
          type="button"
          onClick={onNavigatePsv}
          className="text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] font-semibold flex items-center gap-1 transition"
        >
          <span>View PSV Dashboard</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
