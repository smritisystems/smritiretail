/**
 * Project      : SMRITI Retail OS
 * Module       : SCDM — SMRITI Channel Distribution Management Studio Workspace
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Capabilities (SWSDK Contract):
 *   - Visibility KPI Dashboard
 *   - Channel Dispatch Register (Auto-created from SalesInvoices)
 *   - Immutable Channel Stock Movements & Projection Ledger
 *   - Sell-Out Import Studio (Excel / CSV / Manual)
 *   - Quantity & Value Reconciliation Matrix
 *   - Replenishment Suggestions & Stock Health Analytics
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import {
  TrendingUp, PackageCheck, Truck, RefreshCw, AlertCircle, FileText,
  CheckCircle2, UploadCloud, Search, Filter, ArrowUpRight, ArrowDownRight,
  ShieldAlert, DollarSign, Calendar, Layers, Activity, PieChart, BarChart2,
  ChevronRight, Download, Eye, Plus, AlertTriangle, FileCheck, Sliders
} from "lucide-react";

export interface SCDMStudioTabProps {
  initialSubTab?: "dashboard" | "dispatches" | "projection" | "import" | "reconciliation" | "replenishment";
}

export const SCDMStudioTab: React.FC<SCDMStudioTabProps> = ({ initialSubTab = "dashboard" }) => {
  const [activeTab, setActiveTab] = useState<string>(initialSubTab);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("CUST-001");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Data states
  const [kpis, setKpis] = useState<any>(null);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [projection, setProjection] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [replenishment, setReplenishment] = useState<any[]>([]);
  const [imports, setImports] = useState<any[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Import modal / form state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState<string>("Excel");
  const [pasteData, setPasteData] = useState<string>("");

  // Load customer list
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await apiFetchV1("/customers");
        if (Array.isArray(res)) {
          setCustomers(res);
          if (res.length > 0) setSelectedCustomerId(res[0].id);
        }
      } catch (err) {
        console.warn("[SCDM] Failed to fetch customers:", err);
      }
    }
    loadCustomers();
  }, []);

  // Fetch SCDM data for selected customer
  const fetchScdmData = useCallback(async (custId: string) => {
    if (!custId) return;
    setLoading(true);
    try {
      const [kpiRes, dispRes, projRes, reconRes, repRes, impRes] = await Promise.allSettled([
        apiFetchV1(`/scdm/kpis/${custId}`),
        apiFetchV1(`/scdm/dispatches?customer_id=${custId}`),
        apiFetchV1(`/scdm/projection/${custId}`),
        apiFetchV1(`/scdm/reconciliation/${custId}`),
        apiFetchV1(`/scdm/replenishment/${custId}`),
        apiFetchV1(`/scdm/sellout-imports?customer_id=${custId}`),
      ]);

      if (kpiRes.status === "fulfilled") setKpis(kpiRes.value);
      if (dispRes.status === "fulfilled") setDispatches(Array.isArray(dispRes.value) ? dispRes.value : []);
      if (projRes.status === "fulfilled") setProjection(Array.isArray(projRes.value) ? projRes.value : []);
      if (reconRes.status === "fulfilled") setReconciliation(reconRes.value);
      if (repRes.status === "fulfilled") setReplenishment(Array.isArray(repRes.value) ? repRes.value : []);
      if (impRes.status === "fulfilled") setImports(Array.isArray(impRes.value) ? impRes.value : []);
    } catch (err) {
      console.error("[SCDM] Error fetching SCDM data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScdmData(selectedCustomerId);
  }, [selectedCustomerId, fetchScdmData]);

  // Handle Quick Import Submit
  const handleQuickImportSubmit = async () => {
    if (!pasteData.trim()) return;
    try {
      // Parse TSV/CSV format lines: Barcode \t Qty \t Price
      const lines = pasteData.trim().split("\n").map(row => {
        const parts = row.split(/[\t,]/);
        return {
          source_barcode: parts[0]?.trim() || "",
          qty_sold: parseFloat(parts[1]?.trim() || "1"),
          selling_price: parseFloat(parts[2]?.trim() || "0"),
        };
      });

      const importPayload = {
        customer_id: selectedCustomerId,
        import_source: importSource,
        notes: `Quick import submitted from SCDM Studio`,
        lines: lines,
      };

      const createdJob = await apiFetchV1("/scdm/sellout-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });

      if (createdJob?.id) {
        // Auto-process
        await apiFetchV1(`/scdm/sellout-imports/${createdJob.id}/process`, { method: "POST" });
        alert(`✅ Sell-out import processed successfully!`);
        setShowImportModal(false);
        setPasteData("");
        fetchScdmData(selectedCustomerId);
      }
    } catch (err: any) {
      alert(`❌ Import failed: ${err?.message || err}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--seds-color-bg-app)] text-[var(--seds-color-text-primary)] font-sans antialiased overflow-hidden">
      {/* ── HEADER TOOLBAR ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--seds-color-bg-container)] border-b border-[var(--seds-color-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--seds-color-text-primary)]">
                SCDM — SMRITI Channel Distribution Management
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                v1.0 Platform Capability
              </span>
            </div>
            <p className="text-xs text-[var(--seds-color-text-secondary)] mt-0.5">
              Event-driven channel inventory visibility, immutable ledger projection, sell-out ingestion & value reconciliation
            </p>
          </div>
        </div>

        {/* Customer Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--seds-color-bg-hover)] px-3 py-1.5 rounded-lg border border-[var(--seds-color-border)] text-xs">
            <span className="text-[var(--seds-color-text-secondary)] font-medium">Customer:</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-transparent font-semibold text-[var(--seds-color-text-primary)] outline-none cursor-pointer"
            >
              {customers.length > 0 ? (
                customers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[var(--seds-color-bg-container)] text-[var(--seds-color-text-primary)]">
                    {c.name} ({c.code || c.id})
                  </option>
                ))
              ) : (
                <option value="CUST-001">Reliance Retail Ltd (Modern Trade)</option>
              )}
            </select>
          </div>

          <button
            onClick={() => fetchScdmData(selectedCustomerId)}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--seds-color-border)] hover:bg-[var(--seds-color-bg-hover)] text-[var(--seds-color-text-secondary)] transition-colors"
            title="Refresh SCDM Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Ingest Sell-Out</span>
          </button>
        </div>
      </div>

      {/* ── TAB NAVIGATION BAR ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 bg-[var(--seds-color-bg-container)] border-b border-[var(--seds-color-border)] text-xs font-medium">
        {[
          { id: "dashboard", label: "Visibility Dashboard", icon: BarChart2 },
          { id: "dispatches", label: "Channel Dispatches", icon: Truck },
          { id: "projection", label: "Stock Ledger & Projection", icon: Layers },
          { id: "import", label: "Sell-Out Import Jobs", icon: UploadCloud },
          { id: "reconciliation", label: "Reconciliation Matrix", icon: Activity },
          { id: "replenishment", label: "Replenishment Suggestions", icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all cursor-pointer ${
                isActive
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-[var(--seds-color-text-secondary)] hover:text-[var(--seds-color-text-primary)] hover:border-[var(--seds-color-border)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden p-6 bg-[var(--seds-color-bg-app)]">
        <SmritiScrollArea className="h-full pr-2">
          {/* TAB 1: VISIBILITY DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--seds-color-text-secondary)] mb-1">
                    <span>Days of Cover</span>
                    <Calendar className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-[var(--seds-color-text-primary)]">
                    {kpis?.days_of_cover ?? 0} <span className="text-xs font-normal text-[var(--seds-color-text-secondary)]">days</span>
                  </div>
                  <p className="text-[11px] text-[var(--seds-color-text-secondary)] mt-1">
                    Weeks of Inv: {kpis?.weeks_of_inventory ?? 0} wks
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--seds-color-text-secondary)] mb-1">
                    <span>Sell-Through Rate</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {kpis?.sell_through_pct ?? 0}%
                  </div>
                  <p className="text-[11px] text-[var(--seds-color-text-secondary)] mt-1">
                    Sell-Out / Dispatched Qty
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--seds-color-text-secondary)] mb-1">
                    <span>Current Channel Stock</span>
                    <PackageCheck className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-[var(--seds-color-text-primary)]">
                    {kpis?.current_qty ?? 0} <span className="text-xs font-normal text-[var(--seds-color-text-secondary)]">pcs</span>
                  </div>
                  <p className="text-[11px] text-[var(--seds-color-text-secondary)] mt-1">
                    Dispatched: {kpis?.total_dispatched ?? 0} | Sold: {kpis?.total_sellout ?? 0}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--seds-color-text-secondary)] mb-1">
                    <span>Stock Health Status</span>
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-lg font-bold text-amber-600">
                    {kpis?.stock_health ?? "Healthy"}
                  </div>
                  <p className="text-[11px] text-[var(--seds-color-text-secondary)] mt-1">
                    Avg daily sales: {kpis?.avg_daily_sales ?? 0} pcs/day
                  </p>
                </div>
              </div>

              {/* Ageing Breakdown & Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <h3 className="text-sm font-semibold text-[var(--seds-color-text-primary)] mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-500" />
                    Channel Inventory Ageing Buckets
                  </h3>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xs text-emerald-600 font-medium">0–30 Days</div>
                      <div className="text-lg font-bold text-emerald-700 mt-1">{kpis?.ageing_0_30 ?? 0}</div>
                      <div className="text-[10px] text-[var(--seds-color-text-secondary)]">Fresh Stock</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xs text-blue-600 font-medium">31–60 Days</div>
                      <div className="text-lg font-bold text-blue-700 mt-1">{kpis?.ageing_31_60 ?? 0}</div>
                      <div className="text-[10px] text-[var(--seds-color-text-secondary)]">Active</div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-xs text-amber-600 font-medium">61–90 Days</div>
                      <div className="text-lg font-bold text-amber-700 mt-1">{kpis?.ageing_61_90 ?? 0}</div>
                      <div className="text-[10px] text-[var(--seds-color-text-secondary)]">Slow Moving</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="text-xs text-red-600 font-medium">90+ Days</div>
                      <div className="text-lg font-bold text-red-700 mt-1">{kpis?.ageing_90_plus ?? 0}</div>
                      <div className="text-[10px] text-[var(--seds-color-text-secondary)]">Dead Risk</div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] shadow-xs">
                  <h3 className="text-sm font-semibold text-[var(--seds-color-text-primary)] mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    SCDM Platform Architecture Guarantees
                  </h3>
                  <ul className="space-y-2 text-xs text-[var(--seds-color-text-secondary)]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Warehouse inventory is <strong>NEVER modified</strong> by SCDM visibility movements.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Accounting double-entry general ledger entries remain <strong>100% untouched</strong>.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Single Source of Truth: <strong>ChannelStockMovement</strong> immutable append-only ledger.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Stock balance computed dynamically from DB projection view <code>v_scdm_stock_projection</code>.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANNEL DISPATCHES */}
          {activeTab === "dispatches" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)]">
                  Channel Dispatches Register
                </h3>
                <span className="text-xs text-[var(--seds-color-text-secondary)]">
                  Auto-created on SalesInvoice.posted
                </span>
              </div>

              <div className="rounded-xl border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-container)] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--seds-color-bg-hover)] border-b border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-semibold">
                      <th className="p-3">Dispatch No</th>
                      <th className="p-3">Invoice Ref</th>
                      <th className="p-3">Dispatch Date</th>
                      <th className="p-3 text-right">Dispatch Qty</th>
                      <th className="p-3 text-right">Invoice Value</th>
                      <th className="p-3 text-right">Sell-Out Qty</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--seds-color-border)]">
                    {dispatches.length > 0 ? (
                      dispatches.map((d) => (
                        <tr key={d.id} className="hover:bg-[var(--seds-color-bg-hover)] transition-colors">
                          <td className="p-3 font-semibold text-indigo-600">{d.dispatch_no}</td>
                          <td className="p-3 text-[var(--seds-color-text-secondary)]">{d.invoice_id}</td>
                          <td className="p-3">{d.dispatch_date}</td>
                          <td className="p-3 text-right font-medium">{d.total_dispatch_qty} pcs</td>
                          <td className="p-3 text-right font-semibold">₹{Number(d.total_invoice_value || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right font-medium text-emerald-600">{d.total_sellout_qty} pcs</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              d.status === "Posted" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                              d.status === "Cancelled" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                              "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[var(--seds-color-text-secondary)]">
                          No channel dispatches found for this customer. Dispatches auto-generate when a SalesInvoice is posted for a channel-enabled customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STOCK LEDGER & PROJECTION */}
          {activeTab === "projection" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)]">
                  Channel Stock Projection (Computed from Immutable Ledger)
                </h3>
                <span className="text-xs text-[var(--seds-color-text-secondary)]">
                  View: <code>v_scdm_stock_projection</code>
                </span>
              </div>

              <div className="rounded-xl border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-container)] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--seds-color-bg-hover)] border-b border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-semibold">
                      <th className="p-3">Product ID</th>
                      <th className="p-3 text-right">Dispatched Qty</th>
                      <th className="p-3 text-right">Sell-Out Qty</th>
                      <th className="p-3 text-right">Returned Qty</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-right">MRP Value</th>
                      <th className="p-3 text-right font-bold text-indigo-600">Ageing (Days)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--seds-color-border)]">
                    {projection.length > 0 ? (
                      projection.map((p, idx) => (
                        <tr key={idx} className="hover:bg-[var(--seds-color-bg-hover)] transition-colors">
                          <td className="p-3 font-semibold text-[var(--seds-color-text-primary)]">{p.product_id}</td>
                          <td className="p-3 text-right text-[var(--seds-color-text-secondary)]">{p.total_dispatched} pcs</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">{p.total_sellout} pcs</td>
                          <td className="p-3 text-right text-amber-600">{p.total_returned} pcs</td>
                          <td className="p-3 text-right font-bold text-indigo-600">{p.current_qty} pcs</td>
                          <td className="p-3 text-right font-semibold">₹{Number(p.current_mrp_value || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right font-bold">{p.ageing_days ?? 0} days</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[var(--seds-color-text-secondary)]">
                          No stock projection rows found. Post a SalesInvoice to populate the channel stock movement ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SELL-OUT IMPORT JOBS */}
          {activeTab === "import" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)]">
                  Sell-Out Ingestion Jobs
                </h3>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Ingestion Job</span>
                </button>
              </div>

              <div className="rounded-xl border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-container)] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--seds-color-bg-hover)] border-b border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-semibold">
                      <th className="p-3">Import No</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Import Date</th>
                      <th className="p-3 text-right">Total Lines</th>
                      <th className="p-3 text-right">Accepted</th>
                      <th className="p-3 text-right">Rejected</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--seds-color-border)]">
                    {imports.length > 0 ? (
                      imports.map((imp) => (
                        <tr key={imp.id} className="hover:bg-[var(--seds-color-bg-hover)] transition-colors">
                          <td className="p-3 font-semibold text-indigo-600">{imp.import_no}</td>
                          <td className="p-3 font-medium">{imp.import_source}</td>
                          <td className="p-3">{imp.import_date}</td>
                          <td className="p-3 text-right">{imp.total_lines}</td>
                          <td className="p-3 text-right text-emerald-600 font-bold">{imp.accepted_lines}</td>
                          <td className="p-3 text-right text-red-600 font-bold">{imp.rejected_lines}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              {imp.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[var(--seds-color-text-secondary)]">
                          No sell-out import jobs found. Click "New Ingestion Job" to ingest sell-out data from Excel, CSV, or API.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: RECONCILIATION MATRIX */}
          {activeTab === "reconciliation" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)]">
                  Quantity & Value Reconciliation Matrix
                </h3>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Formula: Opening + Dispatch - Sellout - Returns = Closing
                </span>
              </div>

              <div className="rounded-xl border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-container)] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--seds-color-bg-hover)] border-b border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-semibold">
                      <th className="p-3">Product ID</th>
                      <th className="p-3 text-right">Dispatch Qty</th>
                      <th className="p-3 text-right">Sell-Out Qty</th>
                      <th className="p-3 text-right">Returns Qty</th>
                      <th className="p-3 text-right font-bold text-indigo-600">Computed Closing</th>
                      <th className="p-3 text-right font-bold text-emerald-600">MRP Value</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--seds-color-border)]">
                    {reconciliation?.lines?.length > 0 ? (
                      reconciliation.lines.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--seds-color-bg-hover)] transition-colors">
                          <td className="p-3 font-semibold">{l.product_id}</td>
                          <td className="p-3 text-right">{l.dispatch_qty} pcs</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">{l.sellout_qty} pcs</td>
                          <td className="p-3 text-right text-amber-600">{l.return_qty} pcs</td>
                          <td className="p-3 text-right font-bold text-indigo-600">{l.closing_computed} pcs</td>
                          <td className="p-3 text-right font-semibold">₹{l.mrp_value.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            {l.has_mismatch ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                                Mismatch ({l.mismatch_qty})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                Reconciled
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[var(--seds-color-text-secondary)]">
                          No reconciliation data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: REPLENISHMENT SUGGESTIONS */}
          {activeTab === "replenishment" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)]">
                  Automated Replenishment Suggestions
                </h3>
                <span className="text-xs text-[var(--seds-color-text-secondary)]">
                  Triggered when Days of Cover &lt; 14 days
                </span>
              </div>

              <div className="rounded-xl border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-container)] overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--seds-color-bg-hover)] border-b border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-semibold">
                      <th className="p-3">Product ID</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-right">Avg Daily Sales</th>
                      <th className="p-3 text-right">Days of Cover</th>
                      <th className="p-3 text-right font-bold text-indigo-600">Suggested Order Qty</th>
                      <th className="p-3">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--seds-color-border)]">
                    {replenishment.length > 0 ? (
                      replenishment.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[var(--seds-color-bg-hover)] transition-colors">
                          <td className="p-3 font-semibold">{r.product_id}</td>
                          <td className="p-3 text-right">{r.current_qty} pcs</td>
                          <td className="p-3 text-right text-emerald-600 font-medium">{r.avg_daily_sales} pcs/day</td>
                          <td className="p-3 text-right font-bold">{r.days_of_cover} days</td>
                          <td className="p-3 text-right font-bold text-indigo-600">{r.suggested_replenishment_qty} pcs</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.priority === "High" ? "bg-red-500/10 text-red-600 border border-red-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            }`}>
                              {r.priority} Priority
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-[var(--seds-color-text-secondary)]">
                          All channel inventory levels are well within target Days of Cover (&gt; 14 days). No replenishment required.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SmritiScrollArea>
      </div>

      {/* ── INGEST SELL-OUT MODAL ─────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--seds-color-bg-container)] border border-[var(--seds-color-border)] rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--seds-color-border)]">
              <h3 className="text-sm font-bold text-[var(--seds-color-text-primary)] flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                Ingest Sell-Out Data
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-[var(--seds-color-text-secondary)] hover:text-[var(--seds-color-text-primary)]">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1 text-[var(--seds-color-text-secondary)]">Import Source</label>
                <select
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                  className="w-full p-2 rounded-lg border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-app)] text-[var(--seds-color-text-primary)]"
                >
                  <option value="Excel">Excel / Spreadsheet</option>
                  <option value="CSV">CSV File</option>
                  <option value="Manual">Manual Entry</option>
                  <option value="API">API Feed</option>
                  <option value="POSFeed">POS Feed</option>
                  <option value="FTP">FTP / SFTP Drop</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1 text-[var(--seds-color-text-secondary)]">
                  Paste Data (Format: <code>Barcode [tab/comma] Qty [tab/comma] Price</code>)
                </label>
                <textarea
                  rows={5}
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder="8901234567890&#9;10&#9;499&#n;8901234567891&#9;5&#9;299"
                  className="w-full p-2.5 rounded-lg border border-[var(--seds-color-border)] bg-[var(--seds-color-bg-app)] font-mono text-[11px] text-[var(--seds-color-text-primary)] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--seds-color-border)] bg-[var(--seds-color-bg-hover)]">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--seds-color-border)] text-[var(--seds-color-text-secondary)] font-medium hover:bg-[var(--seds-color-bg-app)]"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickImportSubmit}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-xs"
              >
                Process Ingestion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
