/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.9
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Regular UX Dashboard (Simple, Clean, Guided, Everyday Retail)
 */

import React, { useState, useEffect } from 'react';
import { Product, Formula, PSVParty } from '../../types.ts';
import { apiFetchV1 } from '../../lib/apiFetchV1.ts';

interface RegularUxDashboardProps {
  products?: Product[];
  formulas?: Formula[];
  psvParties?: PSVParty[];
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tab: string) => void;
  onSelectFormula?: (f: Formula | null) => void;
}

interface LocationOption {
  id: string;
  label: string;
  type: 'STORE' | 'WAREHOUSE';
}

export const RegularUxDashboard: React.FC<RegularUxDashboardProps> = ({
  products = [],
  formulas = [],
  psvParties = [],
  currentUser,
  onNavigateTab,
}) => {
  const [locations, setLocations] = useState<LocationOption[]>([
    { id: 'CURRENT_STORE', label: 'This Store (Current)', type: 'STORE' },
  ]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('CURRENT_STORE');
  const userName = currentUser?.name || 'Jawahar';

  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const [branchRes, whRes] = await Promise.allSettled([
          apiFetchV1<any[]>('/branches'),
          apiFetchV1<any[]>('/wms/warehouses'),
        ]);

        const opts: LocationOption[] = [
          { id: 'CURRENT_STORE', label: 'This Store (Current)', type: 'STORE' },
        ];

        if (branchRes.status === 'fulfilled' && Array.isArray(branchRes.value)) {
          for (const b of branchRes.value) {
            opts.push({
              id: `BRANCH:${b.id}`,
              label: `[Branch] ${b.code || b.name} - ${b.name}`,
              type: 'STORE',
            });
          }
        }

        if (whRes.status === 'fulfilled' && Array.isArray(whRes.value)) {
          for (const w of whRes.value) {
            if (w.is_active !== false) {
              opts.push({
                id: `WH:${w.id}`,
                label: `[Godown] ${w.code || w.id} - ${w.name}`,
                type: 'WAREHOUSE',
              });
            }
          }
        }

        if (isMounted) {
          setLocations(opts);
        }
      } catch (err) {
        console.warn('[RegularUxDashboard] Failed to load dynamic locations:', err);
      }
    };
    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const recentSalesData = [
    { id: 'SI-000125', time: '22 Oct 10:45', customer: 'Walk-in Customer', items: 3, total: 1850, status: 'Paid' },
    { id: 'SI-000124', time: '22 Oct 10:32', customer: 'Rajesh Shoes', items: 5, total: 3290, status: 'Paid' },
    { id: 'SI-000123', time: '22 Oct 10:15', customer: 'Walk-in Customer', items: 2, total: 990, status: 'Paid' },
    { id: 'SI-000122', time: '22 Oct 09:48', customer: 'Priya Retail', items: 4, total: 2150, status: 'Paid' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 antialiased">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here's what's happening at your store today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#24389c] dark:text-indigo-400">calendar_today</span>
            <span>{todayFormatted}</span>
          </div>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#24389c]"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today Sales */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Today Sales</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">₹ 24,560</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            <span>12%</span>
            <span className="text-slate-400 font-normal ml-1">vs yesterday</span>
          </div>
        </div>

        {/* Card 2: Bills */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Bills</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">42</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            <span>8%</span>
            <span className="text-slate-400 font-normal ml-1">vs yesterday</span>
          </div>
        </div>

        {/* Card 3: Items Sold */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Items Sold</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">128</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            <span>15%</span>
            <span className="text-slate-400 font-normal ml-1">vs yesterday</span>
          </div>
        </div>

        {/* Card 4: New Customers */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">New Customers</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">6</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            <span>20%</span>
            <span className="text-slate-400 font-normal ml-1">vs yesterday</span>
          </div>
        </div>
      </div>

      {/* 4 Large Colorful Quick Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action 1: POS Billing */}
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('billing-workspace')}
          className="group text-left p-6 rounded-2xl bg-gradient-to-br from-[#0284c7] to-[#0369a1] hover:from-[#0369a1] hover:to-[#075985] text-white shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[28px]">shopping_cart</span>
          </div>
          <h3 className="text-lg font-bold">POS Billing</h3>
          <p className="text-xs text-sky-100 mt-1">Start new bill</p>
        </button>

        {/* Action 2: Item Master */}
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('item-master')}
          className="group text-left p-6 rounded-2xl bg-gradient-to-br from-[#059669] to-[#047857] hover:from-[#047857] hover:to-[#065f46] text-white shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[28px]">inventory_2</span>
          </div>
          <h3 className="text-lg font-bold">Item Master</h3>
          <p className="text-xs text-emerald-100 mt-1">Add / Manage</p>
        </button>

        {/* Action 3: Customer */}
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('customer-master')}
          className="group text-left p-6 rounded-2xl bg-gradient-to-br from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
          <h3 className="text-lg font-bold">Customer</h3>
          <p className="text-xs text-orange-100 mt-1">Add / Manage</p>
        </button>

        {/* Action 4: Reports */}
        <button
          type="button"
          onClick={() => onNavigateTab && onNavigateTab('report-designer')}
          className="group text-left p-6 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] hover:from-[#6d28d9] hover:to-[#5b21b6] text-white shadow-md hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[28px]">query_stats</span>
          </div>
          <h3 className="text-lg font-bold">Reports</h3>
          <p className="text-xs text-purple-100 mt-1">View Reports</p>
        </button>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recent Sales</h3>
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('sales')}
            className="text-xs font-semibold text-[#24389c] dark:text-indigo-400 hover:underline cursor-pointer"
          >
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-6">#</th>
                <th className="py-3 px-6">Date & Time</th>
                <th className="py-3 px-6">Customer</th>
                <th className="py-3 px-6 text-center">Items</th>
                <th className="py-3 px-6 text-right">Total (₹)</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {recentSalesData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3.5 px-6 font-mono font-medium text-slate-900 dark:text-white">
                    {row.id}
                  </td>
                  <td className="py-3.5 px-6 text-slate-500 dark:text-slate-400">
                    {row.time}
                  </td>
                  <td className="py-3.5 px-6 font-medium">
                    {row.customer}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {row.items}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {row.total.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {row.status}
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
