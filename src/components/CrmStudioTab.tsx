/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-25
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : CRM Studio (Fiori Horizon Inspired Light Theme)
 */


import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { LeadManager } from "./crm/LeadManager.tsx";
import { OpportunityPipeline } from "./crm/OppPipe.tsx";
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
  Sparkles,
  Gift,
  Minus,
  Star,
  Loader2,
  X
} from "lucide-react";

import { apiFetchV1 } from "../lib/apiFetchV1";


export interface CrmStudioTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const CrmStudioTab: React.FC<CrmStudioTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER";
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "leads" | "pipeline" | "campaigns" | "loyalty">("dashboard");

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
        {(["dashboard", "leads", "pipeline", "campaigns", "loyalty"] as const).map((tab) => (
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
            {tab === "loyalty" && (
              <span className="flex items-center gap-1.5">
                <Star size={11} />
                Loyalty Adjustments
              </span>
            )}
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

          {activeSubTab === "loyalty" && (
            <LoyaltyAdjPanel currentUser={currentUser} />
          )}
        </motion.div>
      </SmritiScrollArea>
    </div>
  );
};
// ─── Loyalty Adjustment Panel (Sprint 20 -- LYL-ADJ-001/002) ─────────────────
// Allows MANAGER+ to grant BONUS or expire points for a loyalty member.
// Calls: POST /api/v1/crm/loyalty/members/{id}/bonus|expire

interface CustomerHit {
  id: string;
  name: string;
  mobile?: string | null;
  code?: string | null;
}

interface LoyaltyAdjPanelProps {
  currentUser?: { role: string; name: string } | null;
}

const LoyaltyAdjPanel: React.FC<LoyaltyAdjPanelProps> = ({ currentUser }) => {
  const [searchQ, setSearchQ]               = useState("");
  const [searchResults, setSearchResults]   = useState<CustomerHit[]>([]);
  const [searching, setSearching]           = useState(false);
  const [selectedMember, setSelectedMember] = useState<CustomerHit | null>(null);
  const debounceRef                         = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [adjType, setAdjType] = useState<"bonus" | "expire">("bonus");
  const [points, setPoints]   = useState("");
  const [reason, setReason]   = useState("");
  const [refId, setRefId]     = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash]     = useState<{ msg: string; ok: boolean } | null>(null);

  const role      = (currentUser?.role || "").toUpperCase();
  const canAdjust = ["ADMIN","SYSADMIN","SUPERADMIN","MANAGER"].includes(role);
  const memberId  = selectedMember?.id ?? "";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim() || searchQ.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await apiFetchV1<CustomerHit[]>(
          `/crm/customers/search?q=${encodeURIComponent(searchQ)}&limit=5`
        );
        setSearchResults(hits ?? []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQ]);

  const selectMember = (hit: CustomerHit) => {
    setSelectedMember(hit); setSearchQ(""); setSearchResults([]);
  };
  const clearMember = () => {
    setSelectedMember(null); setSearchQ(""); setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) { setFlash({ msg: "Select a member before submitting.", ok: false }); return; }
    const pts = parseFloat(points);
    if (isNaN(pts) || pts <= 0) { setFlash({ msg: "Points must be a positive number.", ok: false }); return; }
    if (!reason.trim()) { setFlash({ msg: "Reason is required.", ok: false }); return; }
    setLoading(true); setFlash(null);
    try {
      await apiFetchV1(`/crm/loyalty/members/${memberId}/${adjType}`, {
        method: "POST",
        body: JSON.stringify({ points: pts, reason, reference_id: refId.trim() || undefined }),
      });
      const action = adjType === "bonus" ? "granted" : "expired";
      setFlash({ msg: `${pts} pts ${action} for ${selectedMember?.name ?? memberId}.`, ok: true });
      setPoints(""); setReason(""); setRefId("");
    } catch (err: any) {
      setFlash({ msg: err?.detail?.message || err?.message || "Request failed.", ok: false });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Star size={16} className="text-amber-500" />
        <h3 className="text-xs font-bold text-theme-body uppercase tracking-wider font-mono">
          Loyalty Points Adjustment
        </h3>
      </div>

      {!canAdjust && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          Only MANAGER or ADMIN accounts can make loyalty adjustments.
        </div>
      )}

      {canAdjust && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle */}
          <div className="flex gap-2">
            <button type="button" id="lyl-adj-bonus-btn" onClick={() => setAdjType("bonus")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${adjType === "bonus" ? "bg-emerald-600 border-emerald-500 text-white" : "bg-theme-surface-1 border-theme-border text-theme-muted hover:text-theme-body"}`}>
              <Gift size={13} /> Grant Bonus
            </button>
            <button type="button" id="lyl-adj-expire-btn" onClick={() => setAdjType("expire")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${adjType === "expire" ? "bg-red-600 border-red-500 text-white" : "bg-theme-surface-1 border-theme-border text-theme-muted hover:text-theme-body"}`}>
              <Minus size={13} /> Expire Points
            </button>
          </div>

          {/* Member Search */}
          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-theme-muted font-mono uppercase tracking-wider">Search Member *</label>
            {selectedMember ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-semibold text-emerald-800">{selectedMember.name}</span>
                  <span className="ml-2 text-xs text-emerald-600 font-mono">{selectedMember.id}{selectedMember.mobile ? ` · ${selectedMember.mobile}` : ""}</span>
                </div>
                <button type="button" id="lyl-clear-member" onClick={clearMember} className="text-emerald-500 hover:text-red-500 ml-2 transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <input id="lyl-member-search" type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    placeholder="Name, mobile, or member code…"
                    className="w-full px-3 py-2 pr-8 rounded-lg border border-theme-border bg-theme-surface-1 text-theme-body text-sm outline-none focus:border-theme-primary"
                    autoComplete="off" />
                  {searching && <Loader2 size={14} className="absolute right-2.5 top-2.5 animate-spin text-theme-muted" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-theme-surface-1 border border-theme-border rounded-xl shadow-lg overflow-hidden">
                    {searchResults.map(hit => (
                      <button key={hit.id} type="button" id={`lyl-member-hit-${hit.id}`} onClick={() => selectMember(hit)}
                        className="w-full text-left px-4 py-2.5 hover:bg-theme-surface-hover border-b border-theme-border/50 last:border-0 transition-colors">
                        <span className="text-sm font-semibold text-theme-body">{hit.name}</span>
                        <span className="ml-2 text-xs text-theme-muted font-mono">{hit.id}{hit.mobile ? ` · ${hit.mobile}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-theme-muted mt-1 pl-1">No members found for &quot;{searchQ}&quot;.</p>
                )}
              </>
            )}
          </div>

          {/* Points */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-theme-muted font-mono uppercase tracking-wider">Points *</label>
            <input id="lyl-points" type="number" min="0.01" step="0.01" value={points} onChange={e => setPoints(e.target.value)}
              placeholder="e.g. 250"
              className="w-full px-3 py-2 rounded-lg border border-theme-border bg-theme-surface-1 text-theme-body text-sm font-mono outline-none focus:border-theme-primary" required />
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-theme-muted font-mono uppercase tracking-wider">Reason *</label>
            <input id="lyl-reason" type="text" value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Birthday bonus / Points expired after 1 year"
              className="w-full px-3 py-2 rounded-lg border border-theme-border bg-theme-surface-1 text-theme-body text-sm outline-none focus:border-theme-primary" required />
          </div>

          {/* Reference ID */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-theme-muted font-mono uppercase tracking-wider">Reference ID <span className="text-theme-muted/60">(optional)</span></label>
            <input id="lyl-ref-id" type="text" value={refId} onChange={e => setRefId(e.target.value)}
              placeholder="e.g. Campaign ID, Invoice No."
              className="w-full px-3 py-2 rounded-lg border border-theme-border bg-theme-surface-1 text-theme-body text-sm font-mono outline-none focus:border-theme-primary" />
          </div>

          {flash && (
            <div className={`rounded-lg px-4 py-2.5 text-sm font-mono ${flash.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {flash.msg}
            </div>
          )}

          <button id="lyl-adj-submit" type="submit" disabled={loading || !selectedMember}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-50 ${adjType === "bonus" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : adjType === "bonus" ? <Gift size={14} /> : <Minus size={14} />}
            {adjType === "bonus" ? "Grant Bonus Points" : "Expire Points"}
          </button>
        </form>
      )}
    </div>
  );
};
