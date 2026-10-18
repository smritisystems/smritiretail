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
 * Target UI    : Corporate Store Type Distribution Donut Widget
 */

import React, { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ArrowRight } from "lucide-react";
import { StoreTypeSlice } from "./types.ts";

interface CorporateStoreTypeWidgetProps {
  distribution?: StoreTypeSlice[];
  storeTypes?: StoreTypeSlice[];
  totalStoresCount?: number;
  totalStores?: number;
  onViewStoreDetails?: () => void;
}

export const CorporateStoreTypeWidget: React.FC<CorporateStoreTypeWidgetProps> = ({
  distribution,
  storeTypes,
  totalStoresCount,
  totalStores: totalStoresProp,
  onViewStoreDetails,
}) => {
  const items = distribution || storeTypes || [];
  const [metricMode, setMetricMode] = useState<"COUNT" | "PERCENT">("COUNT");

  const totalStores = totalStoresCount || totalStoresProp || items.reduce((acc, s) => acc + s.count, 0) || 2456;

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Store Type Distribution
          </h2>
          <select
            value={metricMode}
            onChange={(e) => setMetricMode(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
          >
            <option value="COUNT">By Store Count</option>
            <option value="PERCENT">By Percentage</option>
          </select>
        </div>

        {/* Donut Chart & Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">

          {/* Donut Container with Center Label */}
          <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {items.map((entry, index) => (
                    <Cell key={`type-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${Number(val).toLocaleString("en-IN")} stores`, name]}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900 dark:text-white leading-tight">
                {totalStores.toLocaleString("en-IN")}
              </span>
              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                Total Stores
              </span>
            </div>
          </div>

          {/* Breakdown Items List */}
          <div className="flex-1 w-full space-y-2 text-xs">
            {items.map((item) => (
              <div key={item.type} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {item.count.toLocaleString("en-IN")}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {item.type}
                  </span>
                </div>
                <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Footer Navigation Link */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          Multiformat footprint
        </span>
        <button
          type="button"
          onClick={onViewStoreDetails}
          className="text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] font-semibold flex items-center gap-1 transition"
        >
          <span>View Store-wise Details</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
