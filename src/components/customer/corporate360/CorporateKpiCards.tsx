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
 * Target UI    : Corporate 6-KPI Summary Cards Component
 */

import React from "react";
import {
  ShoppingCart,
  IndianRupee,
  BarChart3,
  Calendar,
  Store,
  Package,
  ArrowUpRight
} from "lucide-react";
import { CorporateKpis } from "./types.ts";

interface CorporateKpiCardsProps {
  kpis: CorporateKpis;
}

export const CorporateKpiCards: React.FC<CorporateKpiCardsProps> = ({ kpis }) => {
  const formatCurrency = (val: number) => {
    if (val >= 10000000) {
      return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  const cards = [
    {
      id: "orders",
      label: "Total Orders",
      value: kpis.total_orders.toLocaleString("en-IN"),
      trend: `^ ${kpis.orders_growth_pct || 18}%`,
      subtext: "Last 12 months",
      icon: ShoppingCart,
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400",
    },
    {
      id: "purchase_value",
      label: "Total Purchase Value",
      value: formatCurrency(kpis.total_purchase_value),
      trend: `^ ${kpis.purchase_growth_pct || 22}%`,
      subtext: "Last 12 months",
      icon: IndianRupee,
      iconBg: "bg-blue-100 text-[#0284c7] dark:bg-blue-950/80 dark:text-blue-400",
    },
    {
      id: "aov",
      label: "Average Order Value",
      value: formatCurrency(kpis.average_order_value),
      trend: `^ ${kpis.aov_growth_pct || 6}%`,
      subtext: "Last 12 months",
      icon: BarChart3,
      iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400",
    },
    {
      id: "last_order",
      label: "Last Order Date",
      value: kpis.last_order_date || "—",
      trend: null,
      subtext: kpis.last_order_relative || "—",
      icon: Calendar,
      iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-950/80 dark:text-orange-400",
    },
    {
      id: "active_stores",
      label: "Active Stores",
      value: `${(kpis.active_stores ?? 0).toLocaleString("en-IN")} / ${(kpis.total_stores ?? 0).toLocaleString("en-IN")}`,
      trend: `${kpis.active_stores_pct ?? 0}% active`,
      subtext: "All India",
      icon: Store,
      iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400",
    },
    {
      id: "psv_stock",
      label: "Total Store Stock (PSV)",
      value: formatCurrency(kpis.total_psv_value),
      trend: "Live Visibility",
      subtext: `${(kpis.psv_stores_count ?? 0).toLocaleString("en-IN")} stores`,
      icon: Package,
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                <Icon size={16} />
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {card.label}
              </span>
            </div>

            <div>
              <div className="text-base lg:text-lg font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {card.value}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] mt-1">
                {card.trend && (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                    {card.trend.startsWith("^") && <ArrowUpRight size={11} className="mr-0.5" />}
                    <span>{card.trend.replace("^", "")}</span>
                  </span>
                )}
                <span className="text-slate-400 dark:text-slate-500">
                  {card.subtext}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
