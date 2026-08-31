/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.98.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import CustomerSegmentationEngine, {
  CustomerSegment,
  MicroCohort,
  CustomerTransaction,
  SegmentationReport,
} from "../../utils/customerSegmentationEngine";

interface CustomerSegmentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const COHORT_META: Record<MicroCohort, { color: string; icon: string; desc: string }> = {
  CHAMPIONS:           { color: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",   icon: "emoji_events",  desc: "High-value, frequent, recent buyers" },
  LOYAL_CUSTOMERS:     { color: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30", icon: "favorite",     desc: "Frequent buyers, high monetary value" },
  POTENTIAL_LOYALISTS: { color: "text-sky-300 bg-sky-500/20 border-sky-500/30",             icon: "trending_up",  desc: "Recent buyers with growing frequency" },
  NEW_CUSTOMERS:       { color: "text-teal-300 bg-teal-500/20 border-teal-500/30",          icon: "person_add",   desc: "Recently acquired, single purchase" },
  PROMISING:           { color: "text-blue-300 bg-blue-500/20 border-blue-500/30",          icon: "star_half",    desc: "Recent buyers, still low spend" },
  NEED_ATTENTION:      { color: "text-orange-300 bg-orange-500/20 border-orange-500/30",    icon: "notifications_active", desc: "Regular buyers, recency declining" },
  AT_RISK:             { color: "text-amber-300 bg-amber-500/20 border-amber-500/30",       icon: "warning",      desc: "Previously frequent, haven't bought recently" },
  CANT_LOSE_THEM:      { color: "text-rose-300 bg-rose-500/20 border-rose-500/30",          icon: "gpp_maybe",   desc: "High value, low recency â€” act now" },
  HIBERNATING:         { color: "text-violet-300 bg-violet-500/20 border-violet-500/30",    icon: "bedtime",      desc: "Low recency and frequency" },
  LOST:                { color: "text-slate-400 bg-slate-700/30 border-slate-600/30",        icon: "person_off",   desc: "Very long since last purchase" },
};

const PROMO_LABELS: Record<string, string> = {
  winbackOffer:        "Win-Back Offer",
  loyaltyDoublePts:    "Loyalty 2Ã— Points",
  earlyAccess:         "Early Access Sale",
  birthdayCoupon:      "Birthday Coupon",
  flashSaleInvite:     "Flash Sale Invite",
  reEngagementEmail:   "Re-Engagement Email",
};

const SAMPLE_CUSTOMERS = [
  { customerId: "C-001", customerName: "Priya Sharma" },
  { customerId: "C-002", customerName: "Arjun Mehta" },
  { customerId: "C-003", customerName: "Kavya Reddy" },
  { customerId: "C-004", customerName: "Rohan Joshi" },
  { customerId: "C-005", customerName: "Deepa Krishnan" },
];

function makeTxn(customerId: string, isoDate: string, value: number): CustomerTransaction {
  return { customerId, invoiceNo: `INV-${customerId}-${isoDate.slice(0, 10)}`, invoiceDate: isoDate, netValue: value };
}

const SAMPLE_TRANSACTIONS: CustomerTransaction[] = [
  // C-001: Champion
  makeTxn("C-001", "2026-08-25T00:00:00Z", 22000), makeTxn("C-001", "2026-07-10T00:00:00Z", 18000),
  makeTxn("C-001", "2026-06-01T00:00:00Z", 15000), makeTxn("C-001", "2026-04-15T00:00:00Z", 12000),
  makeTxn("C-001", "2026-02-20T00:00:00Z", 9000),  makeTxn("C-001", "2025-12-10T00:00:00Z", 7000),
  makeTxn("C-001", "2025-10-05T00:00:00Z", 5000),
  // C-002: Loyal
  makeTxn("C-002", "2026-08-10T00:00:00Z", 9000), makeTxn("C-002", "2026-06-20T00:00:00Z", 8000),
  makeTxn("C-002", "2026-04-05T00:00:00Z", 7500), makeTxn("C-002", "2026-01-15T00:00:00Z", 6000),
  makeTxn("C-002", "2025-11-20T00:00:00Z", 5500),
  // C-003: At Risk
  makeTxn("C-003", "2026-05-10T00:00:00Z", 14000), makeTxn("C-003", "2026-02-01T00:00:00Z", 11000),
  makeTxn("C-003", "2025-10-20T00:00:00Z", 8000),
  // C-004: New Customer
  makeTxn("C-004", "2026-08-22T00:00:00Z", 3200),
  // C-005: Lost
  makeTxn("C-005", "2025-06-01T00:00:00Z", 1200),
];

const AS_OF = new Date("2026-08-28T00:00:00.000Z");

export const CustomerSegmentationModal: React.FC<CustomerSegmentationModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [activeTab, setActiveTab] = useState<"SEGMENTS" | "COHORTS" | "PROMOTIONS">("SEGMENTS");
  const [selectedCohort, setSelectedCohort] = useState<MicroCohort | "ALL">("ALL");
  const [selectedPromo, setSelectedPromo] = useState<string>("ALL");

  const report: SegmentationReport = useMemo(() =>
    CustomerSegmentationEngine.buildReport({ customers: SAMPLE_CUSTOMERS, allTransactions: SAMPLE_TRANSACTIONS, asOf: AS_OF }), []);

  const displayedSegments = useMemo(() => {
    let segs = report.segments;
    if (activeTab === "PROMOTIONS" && selectedPromo !== "ALL") {
      segs = CustomerSegmentationEngine.filterByPromotion(segs, selectedPromo as any);
    } else if (selectedCohort !== "ALL") {
      segs = CustomerSegmentationEngine.filterByCohort(segs, selectedCohort);
    }
    return segs.sort((a, b) => b.rfm.compositeScore - a.rfm.compositeScore);
  }, [report.segments, activeTab, selectedCohort, selectedPromo]);

  if (!isOpen) return null;

  const ScoreBar = ({ score, color }: { score: number; color: string }) => (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`h-1.5 w-4 rounded-full ${i <= score ? color : "bg-slate-800"}`} />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
              <span className="material-symbols-outlined text-2xl">hub</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Segmentation & AI Micro-Cohort Engine</h2>
              <p className="text-xs text-slate-400">RFM Quintile Scoring Â· 10 Micro-Cohorts Â· Targeted Promotion Eligibility</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["SEGMENTS", "COHORTS", "PROMOTIONS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Total Customers", value: report.totalCustomers, color: "text-slate-300" },
            { label: "Avg Lifetime Value", value: `â‚¹${report.avgLifetimeValue.toLocaleString("en-IN")}`, color: "text-fuchsia-400" },
            { label: "Avg Order Value", value: `â‚¹${report.avgOrderValue.toLocaleString("en-IN")}`, color: "text-sky-400" },
            { label: "Top Cohort", value: report.topCohortByCount.replace(/_/g, " "), color: "text-yellow-400" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-sm font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar filter */}
          <div className="w-52 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-1.5">
            {activeTab === "PROMOTIONS" ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Filter by Promotion</p>
                {["ALL", ...Object.keys(PROMO_LABELS)].map((key) => (
                  <button key={key} onClick={() => setSelectedPromo(key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${selectedPromo === key ? "bg-fuchsia-500/20 text-fuchsia-300 font-bold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`}>
                    {key === "ALL" ? "All Customers" : PROMO_LABELS[key]}
                    {key !== "ALL" && (
                      <span className="ml-1.5 text-[10px] text-slate-500">
                        ({report.segments.filter((s) => s.promotionEligibility[key as keyof typeof s.promotionEligibility]).length})
                      </span>
                    )}
                  </button>
                ))}
              </>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Filter by Cohort</p>
                <button onClick={() => setSelectedCohort("ALL")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${selectedCohort === "ALL" ? "bg-fuchsia-500/20 text-fuchsia-300 font-bold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`}>
                  All Cohorts <span className="text-slate-500">({report.totalCustomers})</span>
                </button>
                {(Object.keys(report.cohortSummary) as MicroCohort[]).map((c) => {
                  const meta = COHORT_META[c];
                  return (
                    <button key={c} onClick={() => setSelectedCohort(c)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${selectedCohort === c ? "bg-fuchsia-500/20 text-fuchsia-300 font-bold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`}>
                      {c.replace(/_/g, " ")} <span className="text-slate-500">({report.cohortSummary[c]})</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Segment cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === "COHORTS" ? (
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(COHORT_META) as [MicroCohort, typeof COHORT_META[MicroCohort]][]).map(([cohort, meta]) => {
                  const count = report.cohortSummary[cohort] ?? 0;
                  return (
                    <div key={cohort} className={`rounded-xl p-4 border bg-slate-800/30 ${count > 0 ? "" : "opacity-40"}`}
                      style={{ borderColor: "rgba(100,116,139,0.3)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg text-slate-400">{meta.icon}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{cohort.replace(/_/g, " ")}</span>
                        </div>
                        <span className="text-xl font-black font-mono text-slate-200">{count}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">{meta.desc}</p>
                    </div>
                  );
                })}
              </div>
            ) : displayedSegments.map((seg) => {
              const meta = COHORT_META[seg.cohort];
              const eligiblePromos = Object.entries(seg.promotionEligibility).filter(([, v]) => v).map(([k]) => k);
              return (
                <div key={seg.customerId} className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100">{seg.customerName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{seg.customerId}</span>
                      </div>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>{seg.cohort.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black font-mono text-fuchsia-400">{seg.rfm.compositeScore}</div>
                      <div className="text-[10px] text-slate-500">RFM Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: "Lifetime Value", value: `â‚¹${seg.lifetimeValue.toLocaleString("en-IN")}`, color: "text-slate-200" },
                      { label: "Transactions", value: seg.totalTransactions, color: "text-slate-300" },
                      { label: "Avg Order", value: `â‚¹${seg.avgOrderValue.toLocaleString("en-IN")}`, color: "text-slate-300" },
                      { label: "Days Since Buy", value: seg.daysSinceLastPurchase, color: seg.daysSinceLastPurchase > 180 ? "text-rose-400" : "text-slate-300" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-900/60 rounded-xl p-2 text-center border border-slate-800/40">
                        <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* RFM bars */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Recency",   score: seg.rfm.recencyScore,   color: "bg-sky-500" },
                      { label: "Frequency", score: seg.rfm.frequencyScore, color: "bg-emerald-500" },
                      { label: "Monetary",  score: seg.rfm.monetaryScore,  color: "bg-fuchsia-500" },
                    ].map((r) => (
                      <div key={r.label}>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{r.label}</span><span className="font-bold text-slate-300">{r.score}/5</span></div>
                        <ScoreBar score={r.score} color={r.color} />
                      </div>
                    ))}
                  </div>

                  {/* Promo chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {eligiblePromos.map((k) => (
                      <span key={k} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                        {PROMO_LABELS[k] ?? k}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default CustomerSegmentationModal;

