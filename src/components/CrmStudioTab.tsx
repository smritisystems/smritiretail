/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : CRM Studio (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { LeadManager } from "./crm/LeadManager.tsx";
import { OpportunityPipeline } from "./crm/OpportunityPipeline.tsx";
import { 
  Users, 
  TrendingUp, 
  Target, 
  Megaphone, 
  ShieldAlert, 
  Search, 
  Plus, 
  Download,
  Send,
  Sparkles
} from "lucide-react";

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
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-body font-sans space-y-5 p-6">
      
      {/* Read Only Warning */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center space-x-2 text-amber-800 text-xs shadow-xs">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. CRM conversions and pipeline modifications are locked.</span>
        </div>
      )}

      {/* Top Workspace Subheader */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-theme-body tracking-tight">CRM &amp; Lead Opportunity Studio</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Pipeline Active
            </span>
          </div>
          <p className="text-xs text-theme-muted font-mono mt-0.5">
            CRM &amp; Loyalty &gt; CRM Studio &gt; Lead Acquisition &amp; Campaigns
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => recordAuditAction("EXPORT", "crm", "export", "Exported lead pipeline report")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
          >
            <Download size={13} className="text-theme-muted" />
            <span>Export Pipeline</span>
          </button>
          <button 
            onClick={() => recordAuditAction("CREATE", "crm_campaigns", "new", "Triggered campaign creator")}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-theme-primary text-white font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles size={13} />
            <span>+ New Campaign</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Pills Bar */}
      <div className="flex items-center border-b border-theme-divider gap-1">
        {(["dashboard", "leads", "pipeline", "campaigns"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
              activeSubTab === tab
                ? "border-theme-primary text-theme-primary bg-theme-surface-2 font-bold"
                : "border-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "dashboard" && "CRM Dashboard"}
            {tab === "leads" && "Leads Manager"}
            {tab === "pipeline" && "Opportunity Pipeline"}
            {tab === "campaigns" && "Campaigns & Marketing"}
          </button>
        ))}
      </div>

      {/* Main Content Workspace */}
      <SmritiScrollArea className="flex-1">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === "dashboard" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Total Leads Collected</span>
                    <Users size={16} className="text-theme-primary" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-theme-body font-mono">1,408</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">+12% vs last month</span>
                  </div>
                </div>

                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Conversion Funnel Rate</span>
                    <TrendingUp size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-emerald-600 font-mono">24.5%</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">+1.2% efficiency</span>
                  </div>
                </div>

                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-theme-muted text-xs">
                    <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Active ROI Campaigns</span>
                    <Megaphone size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-theme-body font-mono">3</span>
                    <span className="text-[10px] text-theme-muted font-mono">Targeting 15k customers</span>
                  </div>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-theme-body uppercase tracking-wider font-mono">
                  Promotional Marketing Campaigns
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { name: "Monsoon Special Voucher", target: "12,000 Retailers", channel: "WhatsApp/SMS", status: "In Progress" },
                  { name: "VIP Elite Exclusive Invite", target: "240 Gold Members", channel: "Direct Calling", status: "Approved" },
                ].map((c, i) => (
                  <div key={i} className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-theme-body">{c.name}</span>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-theme-muted space-y-1 font-mono">
                      <div>Target segment: <strong className="text-theme-body">{c.target}</strong></div>
                      <div>Delivery Channel: <strong className="text-theme-body">{c.channel}</strong></div>
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

