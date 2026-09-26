/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.2
 * Created      : 2026-08-28
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "SUPPLIER_SCORECARD")
 * Target UI    : Supplier Scorecard & Vendor SLA Compliance Audit
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import SupplierScorecardEngine, {
  SupplierProfile,
  PurchaseOrderRecord,
  SupplierSLAStatus,
} from "../../utils/supplierScorecardEngine.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface SupplierScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplierId?: string;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

const STATUS_STYLES: Record<SupplierSLAStatus, { bg: string; border: string; text: string; badge: string }> = {
  GREEN:    { bg: "bg-emerald-950/20", border: "border-emerald-600/40", text: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  AMBER:    { bg: "bg-amber-950/20",   border: "border-amber-600/40",   text: "text-amber-400",   badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  RED:      { bg: "bg-rose-950/20",    border: "border-rose-600/40",    text: "text-rose-400",    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  CRITICAL: { bg: "bg-red-950/30",     border: "border-red-600/50",     text: "text-red-400",     badge: "bg-red-600/20 text-red-300 border-red-500/30" },
};

const SAMPLE_DEMO_PROFILES: SupplierProfile[] = [
  { supplierId: "SUP-001", supplierName: "Kapoor Textiles Ltd.",    gstIn: "27AABCK1234A1Z5", category: "Apparel",     contractedLeadTimeDays: 7,  contractedFillRatePct: 95, penaltyPerDayDelay: 500 },
  { supplierId: "SUP-002", supplierName: "Mehta Synthetics Pvt.",   gstIn: "29AABCM5678B2Z6", category: "Footwear",    contractedLeadTimeDays: 10, contractedFillRatePct: 90, penaltyPerDayDelay: 200 },
  { supplierId: "SUP-003", supplierName: "Sharma Accessories Co.",  gstIn: "07AABCS9012C3Z7", category: "Accessories", contractedLeadTimeDays: 5,  contractedFillRatePct: 98, penaltyPerDayDelay: 300 },
];

function makeSampleDemoOrders(): PurchaseOrderRecord[] {
  const makeO = (supplierId: string, poNum: string, oQty: number, acc: number, rej: number, daysLate: number): PurchaseOrderRecord => {
    const pd = new Date(2026, 5, 1);
    const ed = new Date(pd);
    ed.setDate(ed.getDate() + 7);
    const ad = new Date(ed);
    ad.setDate(ad.getDate() + daysLate);
    return {
      poNumber: poNum,
      supplierId,
      orderedQty: oQty,
      orderedValue: oQty * 800,
      poDate: pd.toISOString(),
      expectedDeliveryDate: ed.toISOString(),
      actualDeliveryDate: ad.toISOString(),
      receivedQty: acc + rej,
      acceptedQty: acc,
      rejectedQty: rej,
      qualityVerdict: rej > 0 ? "PARTIAL_REJECTION" : "ACCEPTED",
    };
  };
  return [
    makeO("SUP-001", "PO-001", 200, 198, 2, 0),
    makeO("SUP-001", "PO-002", 150, 148, 0, 0),
    makeO("SUP-001", "PO-003", 100, 90, 5, 3),
    makeO("SUP-002", "PO-004", 300, 240, 30, 5),
    makeO("SUP-002", "PO-005", 250, 210, 20, 8),
    makeO("SUP-003", "PO-006", 80, 80, 0, 0),
    makeO("SUP-003", "PO-007", 100, 99, 1, 1),
  ];
}

export const SupplierScorecardModal: React.FC<SupplierScorecardModalProps> = ({
  isOpen,
  onClose,
  initialSupplierId,
  onNotification,
}) => {
  const [dataMode, setDataMode] = useState<"live" | "demo">("live");
  const [loading, setLoading] = useState(false);
  const [dbSuppliers, setDbSuppliers] = useState<SupplierProfile[]>([]);
  const [dbOrders, setDbOrders] = useState<PurchaseOrderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [scorecardTab, setScorecardTab] = useState<"overview" | "radar" | "price_trend">("overview");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suppRes, orderRes] = await Promise.all([
        apiFetchV1("/purchase/suppliers/").catch(() => []),
        apiFetchV1("/purchase/orders/").catch(() => []),
      ]);

      const rawSuppliers = Array.isArray(suppRes) ? suppRes : suppRes?.items || [];
      const rawOrders = Array.isArray(orderRes) ? orderRes : orderRes?.items || [];

      const profiles: SupplierProfile[] = rawSuppliers.map((s: any) => ({
        supplierId: s.id,
        supplierName: s.name,
        gstIn: s.gst_number || s.gstin || "—",
        category: s.category || s.city || "Commercial Sourcing",
        contractedLeadTimeDays: Number(s.lead_time_days) || 7,
        contractedFillRatePct: Number(s.fill_rate_pct) || 95,
        penaltyPerDayDelay: Number(s.penalty_per_day) || 300,
      }));

      const orders: PurchaseOrderRecord[] = rawOrders.map((o: any) => {
        const totalItems = (o.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
        const isFulfilled = o.status === "RECEIVED" || o.status === "DELIVERED" || o.status === "CLOSED";
        const poDate = o.created_at || new Date().toISOString();
        const expectedDate = o.delivery_date || new Date(new Date(poDate).getTime() + 7 * 86400000).toISOString();
        const actualDate = isFulfilled ? (o.updated_at || expectedDate) : undefined;

        return {
          poNumber: o.order_no || o.order_number || o.id,
          supplierId: o.supplier_id,
          orderedQty: Math.max(1, totalItems),
          orderedValue: Number(o.total_amount || o.grand_total || 0),
          poDate,
          expectedDeliveryDate: expectedDate,
          actualDeliveryDate: actualDate,
          receivedQty: isFulfilled ? totalItems : undefined,
          acceptedQty: isFulfilled ? totalItems : undefined,
          rejectedQty: 0,
          qualityVerdict: isFulfilled ? "ACCEPTED" : undefined,
        };
      });

      setDbSuppliers(profiles);
      setDbOrders(orders);

      if (profiles.length > 0) {
        if (initialSupplierId && profiles.some((p) => p.supplierId === initialSupplierId)) {
          setSelectedId(initialSupplierId);
        } else {
          setSelectedId(profiles[0].supplierId);
        }
        setDataMode("live");
      } else {
        // Fallback to demo mode if no suppliers in DB
        setDataMode("demo");
        setSelectedId("SUP-001");
      }
    } catch {
      setDataMode("demo");
      setSelectedId("SUP-001");
    } finally {
      setLoading(false);
    }
  }, [initialSupplierId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const activeProfiles = useMemo(() => {
    return dataMode === "live" && dbSuppliers.length > 0 ? dbSuppliers : SAMPLE_DEMO_PROFILES;
  }, [dataMode, dbSuppliers]);

  const activeOrders = useMemo(() => {
    return dataMode === "live" && dbSuppliers.length > 0 ? dbOrders : makeSampleDemoOrders();
  }, [dataMode, dbSuppliers, dbOrders]);

  const report = useMemo(() => {
    return SupplierScorecardEngine.generateReport(activeProfiles, activeOrders);
  }, [activeProfiles, activeOrders]);

  const selected = useMemo(() => {
    return report.entries.find((e) => e.supplierId === selectedId) ?? report.entries[0];
  }, [report, selectedId]);

  if (!isOpen) return null;

  const st = selected ? STATUS_STYLES[selected.slaStatus] : STATUS_STYLES.GREEN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Supplier Scorecard &amp; Vendor SLA Compliance Audit</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {dataMode === "live" ? "● PostgreSQL Live Sourcing" : "● Demo SLA Benchmark"}
                </span>
              </div>
              <p className="text-xs text-slate-400">OTD % · Fill Rate · Quality Rejection · Penalty Accrual · Composite Score</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const nextMode = dataMode === "live" ? "demo" : "live";
                setDataMode(nextMode);
                if (nextMode === "demo") {
                  setSelectedId("SUP-001");
                } else if (dbSuppliers.length > 0) {
                  setSelectedId(dbSuppliers[0].supplierId);
                }
                onNotification?.("Audit Source Switched", `Switched to ${nextMode.toUpperCase()} mode.`, "info");
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              {dataMode === "live" ? "Show Demo Benchmark" : "Show DB Live Data"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-5 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Total Suppliers", value: report.totalSuppliers, color: "text-slate-300" },
            { label: "Green", value: report.greenSuppliers, color: "text-emerald-400" },
            { label: "Amber", value: report.amberSuppliers, color: "text-amber-400" },
            { label: "Red", value: report.redSuppliers, color: "text-rose-400" },
            { label: "Critical", value: report.criticalSuppliers, color: "text-red-400" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm">
            <span>Loading supplier SLA metrics from database...</span>
          </div>
        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-sm space-y-3">
            <p>No supplier records found in active database.</p>
            <button
              type="button"
              onClick={() => setDataMode("demo")}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500"
            >
              Load Demo Benchmark Model
            </button>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Supplier List */}
            <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">
                Suppliers ({report.entries.length})
              </p>
              {report.entries.map((entry) => {
                const tc = STATUS_STYLES[entry.slaStatus];
                return (
                  <button
                    key={entry.supplierId}
                    type="button"
                    onClick={() => setSelectedId(entry.supplierId)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                      selectedId === entry.supplierId ? `${tc.bg} ${tc.border}` : "border-transparent hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 truncate">{entry.supplierName}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tc.badge}`}>
                        {entry.slaStatus}
                      </span>
                    </div>
                    <div className={`text-lg font-black font-mono mt-0.5 ${tc.text}`}>
                      {entry.scorecard}
                      <span className="text-[10px] text-slate-500">/100</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Supplier Detail */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex gap-1 mb-4 border-b border-slate-700 pb-2">
                {(["overview", "radar", "price_trend"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setScorecardTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t transition-colors ${
                      scorecardTab === tab ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "overview" ? "Overview" : tab === "radar" ? "Radar" : "Price Trend"}
                  </button>
                ))}
              </div>

              {/* Profile Header */}
              <div className={`rounded-2xl border p-5 ${st.bg} ${st.border}`}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xl font-bold text-slate-100">{selected.supplierName}</p>
                    <p className="text-xs text-slate-400">
                      {selected.category} · GSTIN: {activeProfiles.find((p) => p.supplierId === selected.supplierId)?.gstIn ?? "—"}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.badge}`}>
                        {selected.slaStatus}
                      </span>
                      <span className="text-xs text-slate-400">{selected.totalOrders} POs processed</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-black font-mono ${st.text}`}>{selected.scorecard}</div>
                    <div className="text-[10px] text-slate-400">Composite Score / 100</div>
                    {selected.totalPenaltyAccrued > 0 && (
                      <div className="text-xs text-rose-400 font-bold mt-1">
                        Penalty: ₹{selected.totalPenaltyAccrued.toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score Bar */}
                <div className="mt-4">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        selected.scorecard >= 85
                          ? "bg-emerald-500"
                          : selected.scorecard >= 70
                          ? "bg-amber-500"
                          : selected.scorecard >= 50
                          ? "bg-rose-500"
                          : "bg-red-600"
                      }`}
                      style={{ width: `${selected.scorecard}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  {
                    label: "On-Time Delivery",
                    value: `${selected.onTimeDeliveryPct}%`,
                    sub: `${selected.onTimeDeliveries}/${selected.totalOrders} on time`,
                    color: selected.onTimeDeliveryPct >= 90 ? "text-emerald-400" : selected.onTimeDeliveryPct >= 75 ? "text-amber-400" : "text-rose-400",
                  },
                  {
                    label: "Fill Rate",
                    value: `${selected.fillRatePct}%`,
                    sub: "Contracted: 95%",
                    color: selected.fillRatePct >= 95 ? "text-emerald-400" : "text-amber-400",
                  },
                  {
                    label: "Quality Rejection",
                    value: `${selected.qualityRejectionPct}%`,
                    sub: `${selected.lateDeliveries} late deliveries`,
                    color: selected.qualityRejectionPct <= 2 ? "text-emerald-400" : selected.qualityRejectionPct <= 5 ? "text-amber-400" : "text-rose-400",
                  },
                  {
                    label: "Avg Lead Time",
                    value: `${selected.avgLeadTimeDays}d`,
                    sub: `Contracted: ${selected.contractedLeadTimeDays}d`,
                    color: selected.avgLeadTimeDays <= selected.contractedLeadTimeDays ? "text-emerald-400" : "text-rose-400",
                  },
                  {
                    label: "Late Deliveries",
                    value: selected.lateDeliveries,
                    sub: `of ${selected.totalOrders} POs`,
                    color: selected.lateDeliveries === 0 ? "text-emerald-400" : "text-rose-400",
                  },
                  {
                    label: "Penalty Accrued",
                    value: `₹${selected.totalPenaltyAccrued.toLocaleString("en-IN")}`,
                    sub: "Current period",
                    color: selected.totalPenaltyAccrued === 0 ? "text-emerald-400" : "text-rose-400",
                  },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                    <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.label}</div>
                    <div className="text-[10px] text-slate-500">{m.sub}</div>
                  </div>
                ))}
              </div>

              {scorecardTab === "radar" && (() => {
                const radarData = [
                  { axis: "OTD", value: Math.min(100, selected.onTimeDeliveryPct ?? 0) },
                  { axis: "Fill Rate", value: Math.min(100, selected.fillRatePct ?? 0) },
                  { axis: "Quality", value: Math.max(0, 100 - (selected.qualityRejectionPct ?? 0) * 10) },
                  {
                    axis: "Lead Time",
                    value: selected.avgLeadTimeDays <= (selected.contractedLeadTimeDays ?? 7)
                      ? 100
                      : Math.max(0, 100 - (selected.avgLeadTimeDays - (selected.contractedLeadTimeDays ?? 7)) * 10),
                  },
                  { axis: "Composite", value: selected.scorecard ?? 0 },
                ];
                return (
                  <div className="h-64 bg-slate-950/30 rounded-xl border border-slate-800 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="axis" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                        <Radar name={selected.supplierName} dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                        <Tooltip
                          contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, fontSize: 11 }}
                          formatter={(value: number) => [value.toFixed(1), ""]}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {scorecardTab === "price_trend" && (() => {
                const byMonth: Record<string, { po: number[]; accepted: number[] }> = {};
                selected.orders.forEach((order) => {
                  const date = new Date(order.poDate || Date.now());
                  const month = `${date.toLocaleString("default", { month: "short" })} ${date.getFullYear()}`;
                  if (!byMonth[month]) byMonth[month] = { po: [], accepted: [] };
                  byMonth[month].po.push(Number(order.orderedValue || 0));
                  if (order.acceptedQty != null && order.orderedQty > 0) {
                    byMonth[month].accepted.push(Number(order.orderedValue || 0) * Number(order.acceptedQty) / order.orderedQty);
                  }
                });
                const trendData = Object.entries(byMonth).slice(-6).map(([month, values]) => ({
                  month,
                  "PO Value": values.po.length ? Math.round(values.po.reduce((a, b) => a + b, 0) / values.po.length) : 0,
                  "Accepted Value": values.accepted.length ? Math.round(values.accepted.reduce((a, b) => a + b, 0) / values.accepted.length) : 0,
                }));
                return (
                  <div className="h-64 bg-slate-950/30 rounded-xl border border-slate-800 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, fontSize: 11 }}
                          formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                        <Line type="monotone" dataKey="PO Value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Accepted Value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[10px] text-slate-500 mt-2 text-center">6-month PO commitment vs accepted value trend</p>
                  </div>
                );
              })()}

              {/* PO Table */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Recent Purchase Orders ({selected.orders.length})
                </p>
                {selected.orders.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 text-center">
                    No purchase orders recorded for this supplier yet.
                  </div>
                ) : (
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                          <th className="py-2 px-3">PO No.</th>
                          <th className="py-2 px-3 text-right">Ordered</th>
                          <th className="py-2 px-3 text-right">Accepted</th>
                          <th className="py-2 px-3 text-right">Rejected</th>
                          <th className="py-2 px-3 text-center">Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.orders.map((o) => (
                          <tr key={o.poNumber}>
                            <td className="py-2 px-3 text-slate-300">{o.poNumber}</td>
                            <td className="py-2 px-3 text-right text-slate-300">{o.orderedQty}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{o.acceptedQty ?? "—"}</td>
                            <td className="py-2 px-3 text-right text-rose-400">{o.rejectedQty ?? 0}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  o.qualityVerdict === "ACCEPTED"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                }`}
                              >
                                {o.qualityVerdict ?? "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierScorecardModal;
