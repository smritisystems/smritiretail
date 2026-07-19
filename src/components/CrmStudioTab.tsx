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

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { LeadManager } from "./crm/LeadManager.tsx";
import { OpportunityPipeline } from "./crm/OpportunityPipeline.tsx";

export interface CrmStudioTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const CrmStudioTab: React.FC<CrmStudioTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "leads" | "pipeline" | "campaigns">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Seed Data
  const [leads, setLeads] = useState([
    { id: "LD-001", name: "Vikram Malhotra", email: "vikram@outlook.com", phone: "9820012345", source: "Website", status: "New", date: "2026-07-11" },
    { id: "LD-002", name: "Ananya Sen", email: "ananya@gmail.com", phone: "9870098765", source: "Referral", status: "Contacted", date: "2026-07-12" },
    { id: "LD-003", name: "Karan Johar", email: "karan@dharmaprod.com", phone: "9910011223", source: "In-Store", status: "Qualified", date: "2026-07-13" },
  ]);

  // Telemetry Audit log triggers
  useEffect(() => {
    recordAuditAction("VIEW", "crm", activeSubTab, `Switched CRM dashboard view to: ${activeSubTab}`);
  }, [activeSubTab]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const delay = setTimeout(() => {
      recordAuditAction("SEARCH", "crm_leads", "search", `Search performed for CRM leads: "${searchQuery}"`);
    }, 1200);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleUpdateLeadStatus = (leadId: string, nextStatus: string) => {
    if (isReadOnly) {
      alert("Access Denied: Read-only operators cannot update lead pipeline stages.");
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: nextStatus } : l));
    recordAuditAction("UPDATE", "crm_leads", leadId, `Updated lead status to: ${nextStatus}`);
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. CRM conversions and pipeline modifications are locked.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            CRM Studio
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Lead acquisition, deal pipeline progression tracking, prospect timelines, and promotional campaigns.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center px-6 bg-theme-surface-2 border-b border-theme-divider gap-2">
        {(["dashboard", "leads", "pipeline", "campaigns"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors ${
              activeSubTab === tab
                ? "border-blue-500 text-blue-400 bg-theme-surface-3"
                : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "dashboard" && "CRM Dashboard"}
            {tab === "leads" && "Leads Manager"}
            {tab === "pipeline" && "Opportunity Pipeline"}
            {tab === "campaigns" && "Campaigns"}
          </button>
        ))}
      </div>

      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Total Leads Collected</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">1,408</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-mono">+12% vs last month</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Conversion Funnel Rate</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">24.5%</div>
                  <div className="text-[10px] text-emerald-400 mt-1 font-mono">+1.2% efficiency upgrade</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Active ROI Campaigns</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">3</div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">Targeting 15k customers</div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "leads" && (
            <LeadManager 
              leads={leads} 
              isReadOnly={isReadOnly} 
              onUpdateStatus={handleUpdateLeadStatus} 
            />
          )}

          {activeSubTab === "pipeline" && (
            <OpportunityPipeline leads={leads} />
          )}

          {activeSubTab === "campaigns" && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">Active Campaigns</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { name: "Monsoon Special Voucher", target: "12,000 Retailers", channel: "WhatsApp/SMS", status: "In Progress" },
                  { name: "VIP Elite Exclusive Invite", target: "240 Gold Members", channel: "Direct Calling", status: "Approved" },
                ].map((c, i) => (
                  <div key={i} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-sm text-theme-primary font-display">{c.name}</span>
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-theme-muted space-y-1 font-mono">
                      <div>Target segment: {c.target}</div>
                      <div>Delivery Channel: {c.channel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </SmritiScrollArea>
    </div>
  );
};
