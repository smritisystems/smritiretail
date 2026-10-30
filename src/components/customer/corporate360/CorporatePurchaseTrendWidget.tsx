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
 * Target UI    : Corporate Purchase Trend Combo Chart Widget
 */

import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";
import { PurchaseTrendItem } from "./types.ts";

interface CorporatePurchaseTrendWidgetProps {
  trendData: PurchaseTrendItem[];
}

export const CorporatePurchaseTrendWidget: React.FC<CorporatePurchaseTrendWidgetProps> = ({
  trendData,
}) => {
  const [period, setPeriod] = useState("12_MONTHS");

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Purchase Trend
          </h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
          >
            <option value="12_MONTHS">Last 12 Months</option>
            <option value="6_MONTHS">Last 6 Months</option>
            <option value="YTD">Year to Date (YTD)</option>
          </select>
        </div>

        {/* Combo Chart Container */}
        <div className="h-48 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                tickFormatter={(val) => `₹ ${val} Cr`}
                domain={[0, 60]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={9}
                tickLine={false}
                hide={true}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "8px",
                  border: "none",
                  color: "#fff",
                  fontSize: "11px",
                }}
                formatter={(val: any, name: any) => {
                  if (name === "Purchase Value") return [`₹ ${val} Cr`, name];
                  return [`${Number(val).toLocaleString("en-IN")} orders`, name];
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="purchase_value"
                name="Purchase Value"
                fill="#3b82f6"
                barSize={14}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: "#10b981" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-6 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Purchase Value</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
          <span className="text-slate-600 dark:text-slate-300 font-medium">Orders</span>
        </div>
      </div>
    </div>
  );
};
