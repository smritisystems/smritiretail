/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Wallet } from "../../services/loyaltyService.ts";

interface WalletManagerProps {
  wallets: Wallet[];
  isReadOnly: boolean;
}

export const WalletManager: React.FC<WalletManagerProps> = ({ wallets, isReadOnly }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = wallets.filter(w =>
    w.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
          Member Points Wallet
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search wallets..."
          className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 w-64"
        />
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
              <th className="px-6 py-4 font-semibold">Wallet ID</th>
              <th className="px-6 py-4 font-semibold">Customer Name</th>
              <th className="px-6 py-4 font-semibold">Loyalty Tier</th>
              <th className="px-6 py-4 font-semibold text-right">Available Points</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-theme-divider">
            {filtered.map(w => (
              <tr key={w.id} className="hover:bg-theme-surface-hover transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-blue-400">{w.id}</td>
                <td className="px-6 py-4 font-medium text-theme-body font-display">{w.customer}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    w.tier === "Platinum" ? "bg-purple-900/50 text-purple-400 border border-purple-500/30" :
                    w.tier === "Gold" ? "bg-amber-900/50 text-amber-400 border border-amber-500/30" :
                    "bg-slate-700 text-slate-300 border border-slate-500/30"
                  }`}>
                    {w.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                  {w.points.toLocaleString()} Pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
