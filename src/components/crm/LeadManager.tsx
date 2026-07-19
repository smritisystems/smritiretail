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
import { Lead, scoreLead } from "../../services/crmService.ts";

interface LeadManagerProps {
  leads: Lead[];
  isReadOnly: boolean;
  onUpdateStatus: (id: string, nextStatus: string) => void;
}

export const LeadManager: React.FC<LeadManagerProps> = ({
  leads,
  isReadOnly,
  onUpdateStatus
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = leads.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
          Leads Directory
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search leads..."
          className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 w-64"
        />
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
              <th className="px-6 py-4 font-semibold">Lead ID</th>
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Contact</th>
              <th className="px-6 py-4 font-semibold text-center">Score</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-theme-divider">
            {filtered.map((l) => {
              const score = scoreLead(l);
              return (
                <tr key={l.id} className="hover:bg-theme-surface-hover transition-colors">
                  <td className="px-6 py-4 font-mono font-bold">{l.id}</td>
                  <td className="px-6 py-4 font-medium text-theme-body font-display">{l.name}</td>
                  <td className="px-6 py-4 text-theme-muted">
                    <div>{l.phone}</div>
                    <div className="text-[10px] opacity-75">{l.email}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded ${
                      score >= 70 ? "bg-emerald-950 text-emerald-400" :
                      score >= 50 ? "bg-amber-950 text-amber-400" :
                      "bg-rose-950 text-rose-400"
                    }`}>
                      {score}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-900/50 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onUpdateStatus(l.id, "Contacted")}
                      disabled={isReadOnly || l.status === "Contacted"}
                      className={`text-xs font-bold px-3 py-1 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded transition-colors ${
                        isReadOnly || l.status === "Contacted" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      {l.status === "Contacted" ? "Contacted" : "Move to Contacted"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
