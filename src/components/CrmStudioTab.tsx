/**
 * Project      : SMRITI Retail OS v6.5
 * Module       : Enterprise CRM Studio & Sales Lifecycle Platform
 *                Leads · Opportunity Kanban · Field Visits · Campaigns · AI Nudges
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.5.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import {
  Users, UserCheck, Building2, Plus, Search, X, Phone, Mail, MapPin,
  CheckCircle2, AlertCircle, FileText, ShieldCheck, DollarSign,
  Briefcase, AlertTriangle, Scale, Award, CreditCard, Percent, Truck,
  Tag, Calendar, Clock, MessageSquare, Send, History, Lock, Unlock,
  CheckSquare, FileCheck, PackageCheck, TrendingUp, Trash2, UploadCloud,
  FilePlus, Star, ChevronRight, ChevronDown, ChevronUp, Zap, Settings2,
  RotateCcw, Save, AlertOctagon, Info, Globe, Store, Layers, Sparkles,
  ShoppingBag, Receipt, ArrowUpRight, ArrowDownRight, Compass, Ticket,
  Network, Activity, PieChart, BarChart2, Filter, Layers3
} from "lucide-react";

export interface CrmStudioTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export interface LeadRecord {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  source: "In-Store Walk-in" | "Website" | "Referral" | "WhatsApp" | "Telecall" | "Campaign";
  status: "New" | "Contacted" | "Qualified" | "Proposal Sent" | "Negotiation" | "Closed Won" | "Closed Lost";
  value: number;
  score: number;
  assignedRep: string;
  date: string;
  expectedClose?: string;
}

export interface FieldVisitRecord {
  id: string;
  customerName: string;
  repName: string;
  timestamp: string;
  location: string;
  purpose: string;
  notes: string;
  status: "Completed" | "Scheduled" | "Cancelled";
}

export const CrmStudioTab: React.FC<CrmStudioTabProps> = ({ currentUser, onNotification }) => {
  const isReadOnly = currentUser?.role === "Report User";

  /* ── Sub Tab Selector ── */
  const [activeSubTab, setActiveSubTab] = useState<
    "dashboard" | "leads" | "pipeline" | "visits" | "campaigns"
  >("dashboard");

  /* ── Lead Datastore ── */
  const [leads, setLeads] = useState<LeadRecord[]>([
    { id: "LD-2026-001", name: "Vikram Malhotra", company: "Malhotra Electronics", email: "vikram@outlook.com", phone: "+91 98200 12345", source: "Website", status: "New", value: 150000, score: 85, assignedRep: "Ramesh Chandra", date: "2026-07-25", expectedClose: "2026-08-15" },
    { id: "LD-2026-002", name: "Ananya Sen", company: "Sen Textiles Pvt Ltd", email: "ananya@sentextiles.com", phone: "+91 98700 98765", source: "Referral", status: "Contacted", value: 420000, score: 72, assignedRep: "Anil Kapoor", date: "2026-07-26", expectedClose: "2026-08-20" },
    { id: "LD-2026-003", name: "Karan Johar", company: "Dharma Productions", email: "karan@dharmaprod.com", phone: "+91 99100 11223", source: "In-Store Walk-in", status: "Qualified", value: 850000, score: 94, assignedRep: "Ramesh Chandra", date: "2026-07-27", expectedClose: "2026-08-10" },
    { id: "LD-2026-004", name: "Priya Desai", company: "Desai Supermarkets", email: "priya@desaisuper.com", phone: "+91 98222 33445", source: "WhatsApp", status: "Proposal Sent", value: 1200000, score: 98, assignedRep: "Suresh Sharma", date: "2026-07-28", expectedClose: "2026-08-05" },
  ]);

  /* ── Field Visits Datastore ── */
  const [fieldVisits, setFieldVisits] = useState<FieldVisitRecord[]>([
    { id: "VST-101", customerName: "Reliance Retail Ltd", repName: "Ramesh Chandra", timestamp: "2026-07-29 10:30", location: "Andheri East, Mumbai", purpose: "Annual Rate Contract Review", notes: "Reviewed catalog add-ons. Client requested 5% extra discount on bulk FMCG.", status: "Completed" },
    { id: "VST-102", customerName: "Malhotra Electronics", repName: "Anil Kapoor", timestamp: "2026-07-30 14:00", location: "Hinjewadi Phase 1, Pune", purpose: "Product Demo & Proposal Discussion", notes: "Scheduled live demo of POS terminal hardware.", status: "Scheduled" },
  ]);

  /* ── Filter & Modal States ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadSource, setNewLeadSource] = useState<LeadRecord["source"]>("In-Store Walk-in");
  const [newLeadValue, setNewLeadValue] = useState("100000");

  /* ── Telemetry Audit Triggers ── */
  useEffect(() => {
    recordAuditAction("VIEW", "crm", activeSubTab, `Switched CRM view to: ${activeSubTab}`);
  }, [activeSubTab]);

  /* ── Move Lead Stage ── */
  const handleUpdateLeadStatus = (leadId: string, nextStatus: LeadRecord["status"]) => {
    if (isReadOnly) {
      onNotification?.("Access Denied", "Read-only operators cannot update pipeline stages.", "error");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus } : l)));
    onNotification?.("Stage Updated", `Lead Moved to ${nextStatus}`, "success");
    recordAuditAction("UPDATE", "crm_leads", leadId, `Updated status to: ${nextStatus}`);
  };

  /* ── Add New Lead ── */
  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      onNotification?.("Validation Error", "Lead Name and Phone are required.", "error");
      return;
    }

    const id = `LD-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newLd: LeadRecord = {
      id,
      name: newLeadName.trim(),
      company: newLeadCompany.trim() || undefined,
      phone: newLeadPhone.trim(),
      email: newLeadEmail.trim() || `${newLeadName.toLowerCase().replace(/\s+/g, "")}@example.com`,
      source: newLeadSource,
      status: "New",
      value: parseFloat(newLeadValue) || 100000,
      score: 75,
      assignedRep: currentUser?.name || "Ramesh Chandra",
      date: new Date().toISOString().substring(0, 10),
      expectedClose: new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
    };

    setLeads((p) => [newLd, ...p]);
    onNotification?.("Lead Captured ✓", `${newLd.name} registered in CRM pipeline.`, "success");
    setIsLeadModalOpen(false);
    setNewLeadName("");
    setNewLeadCompany("");
    setNewLeadPhone("");
    setNewLeadEmail("");
  };

  /* ── Pipeline Calculation ── */
  const pipelineStages: LeadRecord["status"][] = ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];
  const totalPipelineValue = leads.reduce((sum, l) => sum + (l.status !== "Closed Lost" ? l.value : 0), 0);
  const hotLeadsCount = leads.filter((l) => l.score >= 80).length;

  /* ── Filtered Leads ── */
  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.company && l.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans select-none">
      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2 flex items-center gap-2 text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono font-bold uppercase tracking-wider">Read-Only Mode</span>
          <span className="text-amber-400/80">Write operations and lead conversions are locked.</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4 gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-[#0a6ed1]" /> Enterprise CRM &amp; Sales Lifecycle Studio
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            Lead Acquisition · 0-100% Lead Scoring · Interactive Kanban Deal Pipeline · Field Visits &amp; Multi-Channel Campaigns
          </p>
        </div>
        <div className="flex items-center gap-4 bg-theme-surface-3 px-4 py-2 rounded-xl border border-theme-divider">
          <div className="text-right font-mono">
            <div className="text-[10px] text-theme-muted uppercase font-bold">Total Pipeline Value</div>
            <div className="text-sm font-bold text-emerald-400">₹{totalPipelineValue.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-px h-8 bg-theme-divider" />
          <div className="text-right font-mono">
            <div className="text-[10px] text-theme-muted uppercase font-bold">Hot Prospects</div>
            <div className="text-sm font-bold text-purple-400">{hotLeadsCount} Leads (&ge;80%)</div>
          </div>
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center justify-between px-6 bg-theme-surface-2 border-b border-theme-divider overflow-x-auto scrollbar-none">
        <div className="flex items-center">
          {(["dashboard", "leads", "pipeline", "visits", "campaigns"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === tab
                  ? "border-[#0a6ed1] text-[#0a6ed1] bg-theme-surface-3"
                  : "border-transparent text-theme-muted hover:text-theme-primary"
              }`}
            >
              {tab === "dashboard" && "CRM Dashboard"}
              {tab === "leads" && "Leads Manager"}
              {tab === "pipeline" && "Opportunity Kanban"}
              {tab === "visits" && "Sales Field Visits"}
              {tab === "campaigns" && "Marketing Campaigns"}
            </button>
          ))}
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setIsLeadModalOpen(true)}
            className="my-2 px-4 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4" /> Capture New Lead
          </button>
        )}
      </div>

      {/* Main Content Body */}
      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div key={activeSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

          {/* DASHBOARD */}
          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5 font-mono">
                {[
                  { l: "Total Leads", v: leads.length, c: "text-[#0a6ed1]", sub: "+12% vs last month" },
                  { l: "Pipeline Value", v: `₹${totalPipelineValue.toLocaleString("en-IN")}`, c: "text-emerald-400", sub: "Weighted forecast" },
                  { l: "Conversion Rate", v: "24.5%", c: "text-purple-400", sub: "Lead to Customer" },
                  { l: "Hot Prospects", v: hotLeadsCount, c: "text-amber-400", sub: "High buying intent" },
                ].map((k) => (
                  <div key={k.l} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-1">
                    <span className="text-[10px] text-theme-muted uppercase font-bold block">{k.l}</span>
                    <strong className={`text-2xl font-bold ${k.c}`}>{k.v}</strong>
                    <span className="text-[10px] text-theme-muted block">{k.sub}</span>
                  </div>
                ))}
              </div>

              {/* Conversion Funnel Overview */}
              <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#0a6ed1]" /> Sales Funnel Conversion Distribution
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 font-mono text-center">
                  {pipelineStages.map((stage) => {
                    const count = leads.filter((l) => l.status === stage).length;
                    return (
                      <div key={stage} className="p-3 bg-theme-surface-3 rounded-lg border border-theme-divider">
                        <span className="text-[10px] text-theme-muted uppercase block font-bold truncate">{stage}</span>
                        <strong className="text-lg font-bold text-theme-heading">{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* LEADS MANAGER */}
          {activeSubTab === "leads" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-lg">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Lead Name, Company, Phone, or ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[#0a6ed1]"
                  />
                </div>
                <span className="font-mono text-xs text-theme-muted">{filteredLeads.length} leads listed</span>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left font-mono">
                  <thead>
                    <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase text-theme-muted">
                      <th className="px-4 py-3">Lead ID</th>
                      <th className="px-4 py-3">Prospect &amp; Company</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-right">Deal Value</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-theme-divider">
                    {filteredLeads.map((l) => (
                      <tr key={l.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-4 py-3 font-bold text-[#0a6ed1]">{l.id}</td>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-bold text-theme-heading">{l.name}</div>
                          <div className="text-[10px] text-theme-muted font-mono">{l.company || "Individual"} | {l.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-theme-surface-3 text-theme-muted border border-theme-divider rounded text-[10px] font-bold">
                            {l.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${l.score >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                            {l.score}% Hot
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">
                          ₹{l.value.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-[10px] font-bold">
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={l.status}
                            onChange={(e) => handleUpdateLeadStatus(l.id, e.target.value as any)}
                            disabled={isReadOnly}
                            className="p-1 text-[11px] bg-theme-surface-1 border border-theme-divider rounded text-theme-heading cursor-pointer"
                          >
                            {pipelineStages.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* OPPORTUNITY KANBAN PIPELINE */}
          {activeSubTab === "pipeline" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-theme-heading font-display uppercase tracking-wider flex items-center gap-2">
                <Layers3 className="w-5 h-5 text-[#0a6ed1]" /> Opportunity Deal Kanban Pipeline
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
                {(["New", "Contacted", "Qualified", "Proposal Sent"] as const).map((stage) => {
                  const stageLeads = leads.filter((l) => l.status === stage);
                  const stageVal = stageLeads.reduce((a, b) => a + b.value, 0);
                  return (
                    <div key={stage} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex flex-col h-[520px]">
                      <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-3">
                        <span className="font-bold text-xs uppercase text-theme-heading">{stage}</span>
                        <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded-full text-[10px] font-bold">
                          {stageLeads.length} Deals
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold mb-3">Total: ₹{stageVal.toLocaleString("en-IN")}</div>
                      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {stageLeads.map((ld) => (
                          <div key={ld.id} className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-2 hover:border-[#0a6ed1] transition-all">
                            <div className="flex items-center justify-between font-sans">
                              <span className="font-bold text-theme-heading text-xs truncate">{ld.name}</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">₹{(ld.value / 1000).toFixed(0)}k</span>
                            </div>
                            {ld.company && <div className="text-[10px] text-theme-muted font-mono">{ld.company}</div>}
                            <div className="flex items-center justify-between text-[9px] text-theme-muted pt-1 border-t border-theme-divider/40">
                              <span>Rep: {ld.assignedRep}</span>
                              <span>Score: {ld.score}%</span>
                            </div>
                          </div>
                        ))}
                        {stageLeads.length === 0 && (
                          <div className="text-center py-10 text-theme-muted text-xs">No deals in stage.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FIELD VISITS */}
          {activeSubTab === "visits" && (
            <div className="space-y-4 font-mono">
              <h3 className="text-sm font-bold text-theme-heading font-display uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#0a6ed1]" /> Field Sales Visits &amp; Meeting Logs
              </h3>
              <div className="space-y-3">
                {fieldVisits.map((v) => (
                  <div key={v.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="font-sans text-sm text-theme-heading">{v.customerName}</strong>
                        <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded text-[10px] font-bold">{v.purpose}</span>
                      </div>
                      <p className="text-xs text-theme-muted">{v.timestamp} | Rep: {v.repName} | Location: {v.location}</p>
                      <p className="text-xs text-theme-heading font-sans mt-1 bg-theme-surface-1 p-2 rounded border border-theme-divider">{v.notes}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold uppercase">{v.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMPAIGNS */}
          {activeSubTab === "campaigns" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-theme-heading font-display uppercase tracking-wider flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-400" /> Active Marketing &amp; Promotion Campaigns
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono">
                {[
                  { name: "Monsoon Special Discount Voucher", target: "12,000 Retailers", channel: "WhatsApp Business API", reach: "11,840 Delivered", status: "Active" },
                  { name: "VIP Corporate Exclusive Invite", target: "240 Corporate Accounts", channel: "Direct Telecall & Email", reach: "210 Contacted", status: "In Progress" },
                ].map((c, i) => (
                  <div key={i} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <strong className="font-sans text-sm text-theme-heading">{c.name}</strong>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">{c.status}</span>
                    </div>
                    <div className="text-xs text-theme-muted space-y-1">
                      <div>Target Segment: {c.target}</div>
                      <div>Channel: {c.channel}</div>
                      <div>Delivery Reach: {c.reach}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </SmritiScrollArea>

      {/* ════════════════════════════════════════════════ */}
      {/*             CAPTURE LEAD MODAL                   */}
      {/* ════════════════════════════════════════════════ */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-theme-surface-3 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <h3 className="text-sm font-bold text-theme-heading font-display">Capture New CRM Prospect Lead</h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-theme-muted hover:text-theme-heading"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-theme-muted font-bold mb-1 uppercase text-[10px]">Prospect Name *</label>
                <input type="text" required placeholder="e.g. Anand Kumar" value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} className="w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading" />
              </div>

              <div>
                <label className="block text-theme-muted font-bold mb-1 uppercase text-[10px]">Company / Business Name</label>
                <input type="text" placeholder="e.g. Kumar Supermarket" value={newLeadCompany} onChange={(e) => setNewLeadCompany(e.target.value)} className="w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading" />
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-theme-muted font-bold mb-1 uppercase text-[10px]">Phone Number *</label>
                  <input type="tel" required placeholder="9820012345" value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} className="w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading" />
                </div>
                <div>
                  <label className="block text-theme-muted font-bold mb-1 uppercase text-[10px]">Estimated Value (₹)</label>
                  <input type="number" value={newLeadValue} onChange={(e) => setNewLeadValue(e.target.value)} className="w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading" />
                </div>
              </div>

              <div>
                <label className="block text-theme-muted font-bold mb-1 uppercase text-[10px]">Lead Acquisition Source</label>
                <select value={newLeadSource} onChange={(e) => setNewLeadSource(e.target.value as any)} className="w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading cursor-pointer">
                  {["In-Store Walk-in", "Website", "Referral", "WhatsApp", "Telecall", "Campaign"].map((src) => <option key={src} value={src}>{src}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-theme-divider">
                <button type="button" onClick={() => setIsLeadModalOpen(false)} className="px-4 py-2 border border-theme-divider text-theme-muted hover:text-theme-heading rounded-lg font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#0a6ed1] hover:bg-[#085caf] text-white font-bold rounded-lg shadow-xs cursor-pointer">Save Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
