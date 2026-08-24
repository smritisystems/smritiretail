/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  Calendar, 
  Download, 
  Filter,
  BarChart3,
  PieChart
} from "lucide-react";

export const SmritiProPosDailyReportsDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const HOURLY_SALES = [
    { hour: "10:00 AM", bills: 4, sales: 8450 },
    { hour: "11:00 AM", bills: 7, sales: 15200 },
    { hour: "12:00 PM", bills: 12, sales: 24900 },
    { hour: "01:00 PM", bills: 6, sales: 11400 },
    { hour: "02:00 PM", bills: 5, sales: 9800 },
    { hour: "03:00 PM", bills: 8, sales: 16500 },
    { hour: "04:00 PM", bills: 11, sales: 22800 },
    { hour: "05:00 PM", bills: 15, sales: 31200 },
    { hour: "06:00 PM", bills: 18, sales: 38900 },
    { hour: "07:00 PM", bills: 14, sales: 29400 }
  ];

  const CASHIER_STATS = [
    { name: "John Doe (T-01)", bills: 28, totalSales: 58400, avgTicket: 2085, returns: 1 },
    { name: "Jane Smith (T-02)", bills: 24, totalSales: 48900, avgTicket: 2037, returns: 0 },
    { name: "Suresh Kumar (T-03)", bills: 19, totalSales: 39200, avgTicket: 2063, returns: 1 }
  ];

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-y-auto p-6 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c4c5d5] dark:border-[#444653]">
          <div>
            <h1 className="text-xl font-bold text-[#00288e] dark:text-[#a8b8ff] flex items-center gap-2">
              <BarChart3 size={22} />
              ProPOS Daily Sales &amp; Shift Analytics
            </h1>
            <p className="text-xs text-[#565e74] dark:text-[#bec6e0] mt-0.5">
              Live intraday performance, hourly rush hours, and cashier performance breakdown.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#2d3133] text-xs font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition flex items-center gap-1.5 shadow-sm"
            >
              <Download size={14} />
              Export Daily Report
            </button>
          </div>
        </div>

        {/* Hourly Rush Bar Matrix */}
        <div className="bg-white dark:bg-[#2d3133] p-6 rounded-2xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#eceef0] dark:border-[#444653]">
            <h3 className="text-sm font-bold text-[#191c1d] dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} className="text-[#00288e]" />
              Hourly Sales &amp; Customer Footfall Trend
            </h3>
            <span className="text-xs text-[#565e74] font-mono font-bold">Peak Rush: 06:00 PM - 07:00 PM</span>
          </div>

          <div className="grid grid-cols-10 gap-2 h-44 items-end pt-4">
            {HOURLY_SALES.map(h => {
              const maxSale = 40000;
              const heightPct = Math.round((h.sales / maxSale) * 100);
              return (
                <div key={h.hour} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] opacity-0 group-hover:opacity-100 transition">
                    ₹{(h.sales / 1000).toFixed(1)}k
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-[#00288e] hover:bg-[#1e40af] rounded-t-lg transition shadow-xs cursor-pointer"
                    title={`${h.hour}: ₹${h.sales.toLocaleString()} (${h.bills} bills)`}
                  ></div>
                  <span className="text-[9px] font-mono text-[#565e74] dark:text-[#bec6e0] truncate w-full text-center">
                    {h.hour.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cashier & Register Performance */}
        <div className="bg-white dark:bg-[#2d3133] p-6 rounded-2xl border border-[#c4c5d5] dark:border-[#444653] shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#191c1d] dark:text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#eceef0] dark:border-[#444653]">
            <Users size={16} className="text-[#00288e]" />
            Cashier Shift Breakdown &amp; Average Basket Value
          </h3>

          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
              <tr>
                <th className="px-4 py-3">Cashier / Terminal</th>
                <th className="px-4 py-3 text-center">Bills Count</th>
                <th className="px-4 py-3 text-right">Gross Turn</th>
                <th className="px-4 py-3 text-right">Avg Ticket Size</th>
                <th className="px-4 py-3 text-center">Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
              {CASHIER_STATS.map(c => (
                <tr key={c.name} className="hover:bg-[#f8f9fa] dark:hover:bg-[#131b2e] transition">
                  <td className="px-4 py-3 font-bold">{c.name}</td>
                  <td className="px-4 py-3 text-center font-mono">{c.bills}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                    ₹{c.totalSales.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">₹{c.avgTicket}</td>
                  <td className="px-4 py-3 text-center font-mono">{c.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosDailyReportsDashboard;
