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
import { CommissionRule } from "./types.ts";
import { Award, Plus, Trash2, Save, User, Percent, ShieldCheck } from "lucide-react";

export const SmritiProPosCommissionBuilder: React.FC = () => {
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([
    {
      id: "comm-1",
      salesStaffCode: "SM1",
      staffName: "Staff Member 01",
      category: "Footwear",
      tierMin: 0,
      tierMax: 50000,
      commissionPct: 2.5,
      effectiveFrom: "2026-08-01",
      isActive: true
    },
    {
      id: "comm-2",
      salesStaffCode: "SM1",
      staffName: "Staff Member 01",
      category: "Footwear",
      tierMin: 50001,
      tierMax: 150000,
      commissionPct: 4.0,
      effectiveFrom: "2026-08-01",
      isActive: true
    },
    {
      id: "comm-3",
      salesStaffCode: "SM2",
      staffName: "Staff Member 02",
      category: "Apparel",
      tierMin: 0,
      tierMax: 100000,
      commissionPct: 3.0,
      effectiveFrom: "2026-08-01",
      isActive: true
    }
  ]);

  const handleAddRow = () => {
    setCommissionRules(prev => [
      ...prev,
      {
        id: `comm-${Date.now()}`,
        salesStaffCode: "SM1",
        staffName: "Staff Member 01",
        category: "All Categories",
        tierMin: 0,
        tierMax: 100000,
        commissionPct: 3.0,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: true
      }
    ]);
  };

  const handleDeleteRow = (id: string) => {
    setCommissionRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-y-auto p-6 font-sans">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c4c5d5] dark:border-[#444653]">
          <div>
            <h1 className="text-xl font-bold text-[#00288e] dark:text-[#a8b8ff] flex items-center gap-2">
              <Award size={22} />
              Sales Staff Commission &amp; Incentive Rule Builder
            </h1>
            <p className="text-xs text-[#565e74] dark:text-[#bec6e0] mt-0.5">
              Define tiered volume commissions, brand kickers, and salesperson reward structures.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-4 py-2 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              Add Commission Slab
            </button>
          </div>
        </div>

        {/* Rule Table */}
        <div className="bg-white dark:bg-[#2d3133] rounded-2xl border border-[#c4c5d5] dark:border-[#444653] overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
              <tr>
                <th className="px-4 py-3">Salesperson Code</th>
                <th className="px-4 py-3">Staff Name</th>
                <th className="px-4 py-3">Category Filter</th>
                <th className="px-4 py-3 text-right">Min Sales (₹)</th>
                <th className="px-4 py-3 text-right">Max Sales (₹)</th>
                <th className="px-4 py-3 text-right text-[#00288e] dark:text-[#a8b8ff]">Commission %</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
              {commissionRules.map(r => (
                <tr key={r.id} className="hover:bg-[#f8f9fa] dark:hover:bg-[#131b2e] transition">
                  <td className="px-4 py-3 font-mono font-bold">{r.salesStaffCode}</td>
                  <td className="px-4 py-3 font-semibold">{r.staffName}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{r.tierMin.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{r.tierMax.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-sm text-[#00288e] dark:text-[#a8b8ff]">
                    {r.commissionPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(r.id)}
                      className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition"
                      title="Delete Slab"
                    >
                      <Trash2 size={14} />
                    </button>
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

export default SmritiProPosCommissionBuilder;
