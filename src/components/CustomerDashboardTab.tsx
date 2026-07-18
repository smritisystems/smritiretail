/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-19
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { getCustomers, getCustomerGroups } from "../services/customerStore.ts";
import { Customer } from "../types";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { 
  Users, TrendingUp, AlertTriangle, ShieldCheck, 
  HelpCircle, Search, BarChart3, Star, Clock, 
  ShieldAlert, Landmark, DollarSign 
} from "lucide-react";

export const CustomerDashboardTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"sales" | "directory" | "performance">("sales");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<any[]>([]);

  // Load customer data
  useEffect(() => {
    setCustomers(getCustomers());
    setGroups(getCustomerGroups());
  }, []);

  // 1. Live KPIs calculations
  const activeCustomers = customers.filter(c => c.status === "Active").length;
  const totalReceivables = customers.reduce((sum, c) => sum + (c.outstanding || 0), 0);
  const highOutstandingCount = customers.filter(c => (c.outstanding || 0) > 50000).length;
  const vipCustomersCount = customers.filter(c => {
    const pgId = (c as any).pricingGroupId || (c as any).pricing_group_id || "";
    return pgId.toLowerCase().includes("vip") || pgId.toLowerCase().includes("pg-vip");
  }).length;

  // 2. Customer Performance computations
  const avgReceivable = activeCustomers > 0 ? totalReceivables / activeCustomers : 0;
  const blockedCount = customers.filter(c => c.status === "Blocked").length;
  const retentionRate = 94.2; // Mock compliance performance metric

  // Top accounts by outstanding
  const topAccounts = [...customers]
    .sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0))
    .slice(0, 5);

  // Pricing Group Distribution
  const pgDistribution = customers.reduce((acc, c) => {
    const pg = (c as any).pricingGroupId || (c as any).pricing_group_id || "Standard Price";
    acc[pg] = (acc[pg] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filtered customer directory list
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.mobile && c.mobile.includes(searchQuery))
  );

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {/* Header */}
      <div className="border-b border-theme-divider bg-theme-surface-2 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Customer Dashboard
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            Real-time accounts receivable tracking, profile distributions, and CRM metrics.
          </p>
        </div>

        {/* Sub-tab Switchers */}
        <div className="flex bg-theme-surface-3 border border-theme-divider rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "sales" ? "bg-blue-600 text-white shadow" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <BarChart3 size={12} />
            Sales Dashboard
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "directory" ? "bg-blue-600 text-white shadow" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <Search size={12} />
            Customer Directory
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`px-4 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === "performance" ? "bg-blue-600 text-white shadow" : "text-theme-muted hover:text-theme-body"
            }`}
          >
            <TrendingUp size={12} />
            Customer Performance
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <SmritiScrollArea className="flex-1 p-6 bg-theme-base">
        {activeTab === "sales" && (
          <div className="space-y-6">
            
            {/* 4 Live KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    Active Customers
                  </span>
                  <span className="text-2xl font-bold text-theme-body block mt-1 font-display">
                    {activeCustomers}
                  </span>
                </div>
                <div className="bg-blue-950/40 text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
                  <Users size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    Total Receivables
                  </span>
                  <span className="text-2xl font-bold text-emerald-400 block mt-1 font-mono">
                    ₹{totalReceivables.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-emerald-950/40 text-emerald-400 p-2.5 rounded-lg border border-emerald-500/20">
                  <Landmark size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    High Outstanding (&gt;50k)
                  </span>
                  <span className="text-2xl font-bold text-amber-500 block mt-1 font-mono">
                    {highOutstandingCount}
                  </span>
                </div>
                <div className="bg-amber-950/40 text-amber-500 p-2.5 rounded-lg border border-amber-500/20">
                  <AlertTriangle size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    VIP Customer Profiles
                  </span>
                  <span className="text-2xl font-bold text-indigo-400 block mt-1 font-mono">
                    {vipCustomersCount}
                  </span>
                </div>
                <div className="bg-indigo-950/40 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
                  <Star size={20} />
                </div>
              </div>
            </div>

            {/* Bottom Section: Top Accounts / Distributions / Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Side: Top Accounts */}
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wider border-b border-theme-divider pb-2 mb-4 flex items-center gap-1.5 font-mono">
                  <Landmark size={14} className="text-blue-400" />
                  Top Accounts Receivable
                </h3>
                <div className="space-y-3.5">
                  {topAccounts.map((c) => (
                    <div key={c.id} className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-theme-body block">{c.name}</span>
                        <span className="text-[10px] text-theme-muted font-mono">{c.id}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{(c.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  {topAccounts.length === 0 && (
                    <p className="text-center text-theme-muted py-6 italic text-[11px]">No customer accounts found.</p>
                  )}
                </div>
              </div>

              {/* Middle: Pricing Group Distribution */}
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wider border-b border-theme-divider pb-2 mb-4 flex items-center gap-1.5 font-mono">
                  <Star size={14} className="text-indigo-400" />
                  Pricing Group Profiles
                </h3>
                <div className="space-y-3.5">
                  {Object.entries(pgDistribution).map(([pg, count]) => {
                    const pct = customers.length > 0 ? (count / customers.length) * 100 : 0;
                    return (
                      <div key={pg} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-sans">
                          <span className="font-medium text-theme-body">{pg}</span>
                          <span className="font-bold text-theme-muted font-mono">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div 
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(pgDistribution).length === 0 && (
                    <p className="text-center text-theme-muted py-6 italic text-[11px]">No distribution metrics available.</p>
                  )}
                </div>
              </div>

              {/* Right: Credit Aging Analysis */}
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow">
                <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wider border-b border-theme-divider pb-2 mb-4 flex items-center gap-1.5 font-mono">
                  <Clock size={14} className="text-amber-500" />
                  AR Credit Aging (Mock)
                </h3>
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>0 - 30 Days</span>
                      <span className="font-bold text-theme-body">₹{Math.round(totalReceivables * 0.65).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: "65%" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>31 - 60 Days</span>
                      <span className="font-bold text-theme-body">₹{Math.round(totalReceivables * 0.20).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: "20%" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>61 - 90 Days</span>
                      <span className="font-bold text-theme-body">₹{Math.round(totalReceivables * 0.10).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: "10%" }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-rose-400">
                      <span>90+ Days (Overdue)</span>
                      <span className="font-bold">₹{Math.round(totalReceivables * 0.05).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5">
                      <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: "5%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 8 Future KPIs Block (FastAPI Placeholder) */}
            <div className="border-t border-theme-divider/50 pt-4 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950 border border-amber-500/20 px-2 py-0.5 rounded uppercase font-mono">
                  Future Capability Stubs
                </span>
                <p className="text-[11px] text-theme-muted">
                  Requires transactional FastAPI integration data to compute dynamically.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Total Sales (All-Time)</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">₹0.00</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Average Payment Days</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">0 Days</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Credit Limit Used %</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">0.00%</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Returns Value</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">₹0.00</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Open Orders</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">0 Bills</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Open Invoices</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">0 Bills</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Lifetime Value (CLV)</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">₹0.00</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>

                <div className="bg-theme-surface-2/40 border border-theme-divider/50 p-3.5 rounded-xl text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors" />
                  <span className="text-[9px] font-bold text-theme-muted uppercase tracking-wider block font-mono">Last Purchase Date</span>
                  <span className="text-lg font-bold text-theme-body/50 block mt-1.5">—</span>
                  <span className="text-[8px] font-mono text-amber-500/80 block mt-1">FASTAPI SALES DATA REQUIRED</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === "directory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wider font-mono">
                Customer Master Directory
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, or mobile..."
                className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body placeholder-theme-muted w-72 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                    <th className="px-6 py-4 font-semibold">Customer ID</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Group</th>
                    <th className="px-6 py-4 font-semibold">Pricing Policy</th>
                    <th className="px-6 py-4 font-semibold text-right">Outstanding</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-divider">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-theme-surface-hover transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-blue-400">{c.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-theme-body font-display">{c.name}</div>
                        <div className="text-[10px] text-theme-muted mt-0.5">{c.email || c.mobile || "No Contact"}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">{(c as any).customerGroupId || (c as any).customer_group_id || "—"}</td>
                      <td className="px-6 py-4">
                        {(c as any).pricingGroupId || (c as any).pricing_group_id ? (
                          <span className="font-mono text-blue-300 bg-blue-950/40 border border-blue-500/30 rounded px-1.5 py-0.5 text-[10px]">
                            {(c as any).pricingGroupId || (c as any).pricing_group_id}
                          </span>
                        ) : (
                          <span className="text-theme-muted font-mono text-[10px]">Standard Price</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                        ₹{(c.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          c.status === "Active" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" :
                          c.status === "Inactive" ? "bg-slate-700 text-slate-300" :
                          "bg-rose-950 text-rose-400 border border-rose-500/30 font-bold"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-theme-muted italic">
                        No customer matches found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "performance" && (
          <div className="space-y-6">
            
            {/* Perform metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    Retention Rate
                  </span>
                  <span className="text-2xl font-bold text-emerald-400 block mt-1 font-display">
                    {retentionRate}%
                  </span>
                </div>
                <div className="bg-emerald-950/40 text-emerald-400 p-2.5 rounded-lg border border-emerald-500/20">
                  <ShieldCheck size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    Avg Outstanding / Profile
                  </span>
                  <span className="text-2xl font-bold text-theme-body block mt-1 font-mono">
                    ₹{avgReceivable.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-blue-950/40 text-blue-400 p-2.5 rounded-lg border border-blue-500/20">
                  <DollarSign size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    Blocked Accounts
                  </span>
                  <span className="text-2xl font-bold text-rose-500 block mt-1 font-mono">
                    {blockedCount}
                  </span>
                </div>
                <div className="bg-rose-950/40 text-rose-500 p-2.5 rounded-lg border border-rose-500/20">
                  <ShieldAlert size={20} />
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider p-4 rounded-xl shadow flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-wider block font-mono">
                    CLV Index
                  </span>
                  <span className="text-2xl font-bold text-indigo-400 block mt-1 font-mono">
                    Stable
                  </span>
                </div>
                <div className="bg-indigo-950/40 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
                  <TrendingUp size={20} />
                </div>
              </div>
            </div>

            {/* Performance charts explanation / documentation */}
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow space-y-4">
              <h3 className="text-xs font-bold text-theme-primary uppercase tracking-wider border-b border-theme-divider pb-2 flex items-center gap-1.5 font-mono">
                <BarChart3 size={14} className="text-blue-400" />
                Customer Performance Insights
              </h3>
              <p className="text-xs text-theme-muted leading-relaxed">
                The Customer Performance index calculates churn rate, collection efficiency, and overall customer lifetime value metrics.
                Once POS bills and B2B ledger postings are connected directly to the FastAPI server, these performance indexes will dynamically recalculate with transaction history.
              </p>
            </div>

          </div>
        )}
      </SmritiScrollArea>
    </div>
  );
};
