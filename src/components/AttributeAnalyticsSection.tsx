/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, Award, DollarSign, ListCollapse, BarChart3, PieChartIcon } from "lucide-react";
import { AttributeDefinition } from "../types.js";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface AttributeAnalyticsSectionProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const AttributeAnalyticsSection: React.FC<AttributeAnalyticsSectionProps> = ({ 
  onNotification 
}) => {
  const [definitions, setDefinitions] = useState<AttributeDefinition[]>([]);
  const [selectedAttr, setSelectedAttr] = useState("Color");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch attribute list on mount
  useEffect(() => {
    apiFetchV1("/attributes/definitions")
      .then(data => {
        setDefinitions(data);
        if (data.length > 0) {
          // Default to the first select/variant attribute if possible
          const first = data.find((d: any) => d.dataType === "select") || data[0];
          setSelectedAttr(first.name);
        }
      })
      .catch(err => {
        console.error("Error loading definitions:", err);
      });
  }, []);

  // Fetch reports whenever attribute changes
  useEffect(() => {
    if (!selectedAttr) return;
    setLoading(true);
    
    Promise.all([
      apiFetchV1(`/attributes/reports/sales-by-attribute?attributeName=${selectedAttr}`),
      apiFetchV1(`/attributes/reports/stock-by-attribute?attributeName=${selectedAttr}`)
    ])
      .then(([sales, stock]) => {
        setSalesData(sales);
        setStockData(stock);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        onNotification("Report Error", "Failed to compile attribute analytics reports.", "error");
        setLoading(false);
      });
  }, [selectedAttr]);

  // Derived metrics
  const bestPerforming = [...salesData].sort((a, b) => b.quantitySold - a.quantitySold)[0];
  const mostValuable = [...stockData].sort((a, b) => b.valuation - a.valuation)[0];
  const totalStockCount = stockData.reduce((sum, item) => sum + item.stockCount, 0);
  const totalStockValuation = stockData.reduce((sum, item) => sum + item.valuation, 0);

  // Chart Colors palette
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#a855f7"];

  return (
    <div className="space-y-6">
      
      {/* Top Selector Ribbon */}
      <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
            <BarChart3 size={16} className="text-violet-400" />
            <span>SMRITI Attribute Intelligence Analytics</span>
          </h4>
          <p className="text-[11px] text-theme-muted mt-0.5">Aggregate inventory valuation and sales performance across custom data-driven attributes</p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-theme-muted font-mono">Select Dimension:</span>
          <select
            value={selectedAttr}
            onChange={(e) => setSelectedAttr(e.target.value)}
            className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono font-bold"
          >
            {definitions.map(d => (
              <option key={d.id} value={d.name}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex items-center justify-between">
          <div>
            <span className="text-[9px] text-theme-muted font-mono block tracking-wider uppercase">BEST PERFORMING {selectedAttr.toUpperCase()}</span>
            <span className="text-xl font-bold font-display text-theme-body mt-1.5 block truncate max-w-[180px]">
              {bestPerforming ? bestPerforming.value : "None"}
            </span>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              Qty Sold: <span className="font-bold">{bestPerforming ? bestPerforming.quantitySold : 0} pcs</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-900">
            <Award size={18} />
          </div>
        </div>

        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex items-center justify-between">
          <div>
            <span className="text-[9px] text-theme-muted font-mono block tracking-wider uppercase">MOST HEAVILY CAPITALIZED</span>
            <span className="text-xl font-bold font-display text-theme-body mt-1.5 block truncate max-w-[180px]">
              {mostValuable ? mostValuable.value : "None"}
            </span>
            <span className="text-[11px] text-amber-400 mt-1 block">
              Locked Value: <span className="font-bold">₹{mostValuable ? mostValuable.valuation.toLocaleString("en-IN") : 0}</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950 flex items-center justify-center text-amber-400 border border-amber-900">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex items-center justify-between">
          <div>
            <span className="text-[9px] text-theme-muted font-mono block tracking-wider uppercase">TOTAL PIECES INSTORE</span>
            <span className="text-xl font-bold font-display text-sky-400 mt-1.5 block">
              {totalStockCount.toLocaleString("en-IN")} pcs
            </span>
            <span className="text-[11px] text-theme-muted mt-1 block">
              Spread across <span className="text-theme-body font-medium">{stockData.length} unique values</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950 flex items-center justify-center text-sky-400 border border-sky-900">
            <ListCollapse size={18} />
          </div>
        </div>

        <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex items-center justify-between">
          <div>
            <span className="text-[9px] text-theme-muted font-mono block tracking-wider uppercase">CONSOLIDATED VALUATION</span>
            <span className="text-xl font-bold font-display text-indigo-400 mt-1.5 block">
              ₹{totalStockValuation.toLocaleString("en-IN")}
            </span>
            <span className="text-[11px] text-theme-muted mt-1 block">
              Evaluated at selling price
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-900">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* Graphical Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Sales Velocity */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
            <BarChart3 size={15} className="text-emerald-400" />
            <h3 className="font-display font-bold text-sm text-theme-body">Sales Velocity & Yield</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" opacity={0.3} />
                <XAxis dataKey="value" stroke="#8892a4" fontSize={10} fontStyle="mono" />
                <YAxis stroke="#8892a4" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#121c35", border: "1px solid #2a3a5c", borderRadius: "8px" }} 
                  labelStyle={{ color: "#fff", fontFamily: "mono" }}
                />
                <Bar dataKey="quantitySold" fill="#10b981" radius={[4, 4, 0, 0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Stock Valuation Breakdown */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-theme-divider/50 pb-3">
            <PieChartIcon size={15} className="text-sky-400" />
            <h3 className="font-display font-bold text-sm text-theme-body">Inventory Locked Capital (INR)</h3>
          </div>

          <div className="h-64 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="valuation"
                  nameKey="value"
                >
                  {stockData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#121c35", border: "1px solid #2a3a5c", borderRadius: "8px" }}
                  itemStyle={{ fontSize: "11px" }}
                  formatter={(value: any) => `₹${Number(value).toLocaleString("en-IN")}`}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "10px", color: "#8892a4" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};
