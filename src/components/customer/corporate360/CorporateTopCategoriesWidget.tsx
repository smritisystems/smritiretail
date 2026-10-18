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
 * Target UI    : Corporate Top Categories Breakdown Widget
 */

import React from "react";
import { ArrowRight } from "lucide-react";
import { CategoryShareItem } from "./types.ts";

interface CorporateTopCategoriesWidgetProps {
  categories: CategoryShareItem[];
  onViewAllCategories?: () => void;
}

export const CorporateTopCategoriesWidget: React.FC<CorporateTopCategoriesWidgetProps> = ({
  categories,
  onViewAllCategories,
}) => {
  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${val.toLocaleString("en-IN")}`;
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Top Categories (Last 12 Months)
          </h2>
          <button
            type="button"
            onClick={onViewAllCategories}
            className="text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] text-xs font-semibold flex items-center gap-1 transition"
          >
            <span>View All</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Categories Table / Progress List */}
        <div className="space-y-2.5">
          {/* Table Header */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 px-1">
            <span className="w-1/3">Category</span>
            <span className="w-1/4 text-right">Value</span>
            <span className="w-1/6 text-right">Share</span>
            <span className="w-1/4 text-right pr-2">Distribution</span>
          </div>

          {/* Category Rows */}
          {categories.map((cat) => {
            const pct = cat.share_pct ?? cat.share_percentage ?? 0;
            return (
              <div key={cat.category} className="flex items-center justify-between gap-2 text-xs py-1 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded transition">
                <span className="w-1/3 font-medium text-slate-800 dark:text-slate-200 truncate" title={cat.category}>
                  {cat.category}
                </span>
                <span className="w-1/4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                  {cat.value_formatted || formatCurrency(cat.value)}
                </span>
                <span className="w-1/6 text-right font-mono text-slate-500 dark:text-slate-400">
                  {pct}%
                </span>
                <div className="w-1/4 flex items-center justify-end pr-2">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3b82f6] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pct * 2.2, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
