/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.0.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-10-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * UX Revision 3.0.0 — WhatsApp-level simplicity redesign.
 * Replaces all jargon with plain business language.
 * Emoji traffic lights, plain-language guidance, mobile-first card layout.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { PSVParty, PSVPartySkuTracking } from "../types";
import {
  computeSkuLyingWithPartner,
  computeSkuSellThrough,
} from "../services/partnerSellThru.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";

/* ─────────────────────────────────────────────────────────
   PROP TYPES
───────────────────────────────────────────────────────── */
interface PsvTabProps {
  psvParties: PSVParty[];
  currentUser?: { role: string; name: string } | null;
}

/* ─────────────────────────────────────────────────────────
   HELPERS — Plain-language signals
───────────────────────────────────────────────────────── */

/** Returns an emoji + colour class for a party's health status */
function statusSignal(status: PSVParty["status"]) {
  switch (status) {
    case "Healthy":
      return { emoji: "🟢", label: "All Good", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "Monitor":
      return { emoji: "🟡", label: "Keep Watch", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    case "Critical":
      return { emoji: "🔴", label: "Needs Action", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
    case "SOLD_OUT":
      return { emoji: "⚫", label: "Sold Out", cls: "text-gray-400 bg-gray-500/10 border-gray-500/30" };
    default:
      return { emoji: "🔵", label: "Check Stock", cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
  }
}

/** Plain-language explanation of sell-through % */
function sellThroughMessage(pct: number): string {
  if (pct >= 80) return "Excellent — most goods have sold ✅";
  if (pct >= 50) return "Good — about half has sold";
  if (pct >= 25) return "Slow — less than half has sold";
  return "Very slow — most goods are still sitting";
}

/** Plain-language colour for sell-through badge */
function sellThroughColour(pct: number): string {
  if (pct >= 70) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (pct >= 40) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
  return "bg-rose-500/20 text-rose-400 border-rose-500/40";
}

/** Weeks of cover colour */
function weeksColour(weeks: number): string {
  if (weeks >= 4) return "text-emerald-400";
  if (weeks >= 2) return "text-amber-400";
  return "text-rose-400";
}

/** Plain-language guidance for the Tip card */
function tipForParty(p: PSVParty): { icon: string; title: string; body: string } {
  if (p.status === "Critical") {
    return {
      icon: "🚨",
      title: "Stock Not Selling — Take Action Now",
      body:
        "Too much stock is sitting unsold. Call the distributor and ask why. Consider offering a discount, a combo deal, or moving goods to a busier shop.",
    };
  }
  if (p.status === "Monitor") {
    return {
      icon: "👀",
      title: "Keep an Eye — Sales Slightly Slow",
      body:
        "Sales are below normal. Check if the distributor needs more visibility (display, promotions). Monitor for the next 3–5 days before taking action.",
    };
  }
  if (p.status === "SOLD_OUT") {
    return {
      icon: "📦",
      title: "Stock Finished — Reorder if Needed",
      body:
        "All goods at this distributor have sold. If demand is still there, send a fresh invoice. If not, no action needed.",
    };
  }
  return {
    icon: "✅",
    title: "Everything is Running Fine",
    body:
      "Sales are healthy. Stock is moving at a good pace. No action needed — continue with your normal replenishment cycle.",
  };
}

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENT — Metric Tile (reusable)
───────────────────────────────────────────────────────── */
function MetricTile({
  icon,
  label,
  value,
  sub,
  valueClass = "text-theme-body",
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-theme-surface-3/50 rounded-xl p-4 border border-theme-divider flex flex-col gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-theme-muted font-semibold">{label}</span>
      <span className={`text-lg font-bold font-mono ${valueClass}`}>{value}</span>
      {sub && <span className="text-[11px] text-theme-muted leading-snug">{sub}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENT — SKU Row
───────────────────────────────────────────────────────── */
function SkuRow({ sku }: { sku: PSVPartySkuTracking }) {
  const lying = computeSkuLyingWithPartner(sku);
  const sellThrough = computeSkuSellThrough(sku);
  return (
    <tr className="hover:bg-theme-surface-2/40 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-theme-body text-sm">{sku.productName || sku.sku}</div>
        <div className="text-[10px] text-theme-muted font-mono mt-0.5">{sku.sku}</div>
      </td>
      <td className="px-3 py-3 text-right text-theme-body text-sm">{sku.invoicedQty}</td>
      <td className="px-3 py-3 text-right text-emerald-400 text-sm font-semibold">{sku.confirmedSoldQty}</td>
      <td className="px-3 py-3 text-right text-rose-400 text-sm">{sku.returnedQty}</td>
      <td className="px-3 py-3 text-right text-blue-400 text-sm font-bold">{lying}</td>
      <td className="px-4 py-3 text-right">
        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${sellThroughColour(sellThrough)}`}>
          {sellThrough.toFixed(0)}%
        </span>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export const PsvTab: React.FC<PsvTabProps> = ({ psvParties, currentUser }) => {
  const isReadOnly =
    currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER";

  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    psvParties[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const hasMounted = useRef(false);

  // F-10: flip hasMounted after first render so audit skips auto-selection
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Auto-select first party when list loads
  useEffect(() => {
    if (!selectedPartyId && psvParties.length > 0) {
      setSelectedPartyId(psvParties[0].id);
    }
  }, [psvParties, selectedPartyId]);

  const activeParty = psvParties.find((p) => p.id === selectedPartyId);

  // F-10: audit only on explicit user selection after mount
  useEffect(() => {
    if (hasMounted.current && activeParty) {
      recordAuditAction(
        "TRANSACTION_VIEW",
        "psv_parties",
        activeParty.id,
        `Viewed PSV partner details: ${activeParty.name}`
      );
    }
  }, [activeParty]);

  // Filtered & searched party list
  const filteredParties = useMemo(() => {
    if (!search.trim()) return psvParties;
    const q = search.toLowerCase();
    return psvParties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
    );
  }, [psvParties, search]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  const tip = activeParty ? tipForParty(activeParty) : null;

  /* ── EMPTY STATE ── */
  if (psvParties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <span className="text-6xl">📦</span>
        <h3 className="text-xl font-semibold text-theme-body">No Distributors Added Yet</h3>
        <p className="text-sm text-theme-muted max-w-xs">
          Once you start sending goods to distributors or retail partners, their
          stock position will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── READ-ONLY BANNER ── */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-400 text-sm">
          <span className="text-lg">👁️</span>
          <span>
            <span className="font-bold">View-Only Mode.</span> You can see all
            data but cannot make any changes.
          </span>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-xl text-theme-body">
            📊 Distributor Stock Tracker
          </h3>
          <p className="text-sm text-theme-muted mt-0.5">
            See how much goods each distributor has, how much they've sold, and
            whether you need to take any action.
          </p>
        </div>
        <div className="text-xs text-theme-muted bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5">
          {psvParties.length} distributor{psvParties.length !== 1 ? "s" : ""} tracked
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ══════════════════════════════════════════════
            LEFT PANEL — Distributor List
        ══════════════════════════════════════════════ */}
        <div className="lg:col-span-4 bg-theme-surface-1 rounded-xl border border-theme-divider flex flex-col">

          {/* Search */}
          <div className="p-3 border-b border-theme-divider">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search distributor or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-8 pr-3 py-2 text-sm text-theme-body placeholder:text-theme-muted focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-theme-divider/50">
            {filteredParties.length === 0 ? (
              <div className="p-6 text-center text-theme-muted text-sm">
                No results for "{search}"
              </div>
            ) : (
              filteredParties.map((p) => {
                const sig = statusSignal(p.status);
                const isActive = selectedPartyId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPartyId(p.id)}
                    className={`w-full text-left p-4 transition-all ${
                      isActive
                        ? "bg-blue-600/10 border-l-2 border-l-blue-500"
                        : "hover:bg-theme-surface-2/50 border-l-2 border-l-transparent"
                    }`}
                  >
                    {/* Name + status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-semibold text-sm text-theme-body truncate">
                        {p.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sig.cls}`}
                      >
                        {sig.emoji} {sig.label}
                      </span>
                    </div>

                    {/* Location */}
                    <div className="text-xs text-theme-muted mb-2.5">
                      📍 {p.location}
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                        <div className="text-[9px] text-theme-muted uppercase tracking-wide">Stock Left</div>
                        <div className="text-xs font-bold font-mono text-theme-body mt-0.5">
                          {p.stockCount} pcs
                        </div>
                      </div>
                      <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                        <div className="text-[9px] text-theme-muted uppercase tracking-wide">Sold %</div>
                        <div className={`text-xs font-bold font-mono mt-0.5 ${sellThroughColour(p.sellThrough).split(" ")[1]}`}>
                          {p.sellThrough}%
                        </div>
                      </div>
                      <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                        <div className="text-[9px] text-theme-muted uppercase tracking-wide">Weeks Left</div>
                        <div className={`text-xs font-bold font-mono mt-0.5 ${weeksColour(p.weeksOfCover)}`}>
                          {p.weeksOfCover} wk
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            RIGHT PANEL — Detail View
        ══════════════════════════════════════════════ */}
        <div className="lg:col-span-8 bg-theme-surface-1 rounded-xl border border-theme-divider">
          {!activeParty ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center gap-3">
              <span className="text-5xl">👈</span>
              <p className="text-sm text-theme-muted">
                Tap a distributor on the left to see their details.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-6">

              {/* ── HEADER ── */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-theme-divider">
                <div>
                  {(() => {
                    const sig = statusSignal(activeParty.status);
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border mb-2 ${sig.cls}`}>
                        {sig.emoji} {sig.label}
                      </span>
                    );
                  })()}
                  <h3 className="font-display font-bold text-xl text-theme-body">
                    {activeParty.name}
                  </h3>
                  <p className="text-xs text-theme-muted mt-0.5">📍 {activeParty.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-theme-muted uppercase tracking-wide">
                    💰 Money Tied in Unsold Stock
                  </div>
                  <div className="text-rose-400 font-bold font-mono text-xl mt-0.5">
                    {formatCurrency(activeParty.capitalLocked)}
                  </div>
                  <div className="text-[10px] text-theme-muted mt-0.5">
                    This money will come back once goods sell.
                  </div>
                </div>
              </div>

              {/* ── 4 METRIC TILES ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricTile
                  icon="📦"
                  label="Stock with Distributor"
                  value={`${activeParty.stockCount} pcs`}
                  sub="Total pieces currently at their shop/warehouse"
                  valueClass="text-blue-400"
                />
                <MetricTile
                  icon="🛒"
                  label="How Much Has Sold"
                  value={`${activeParty.sellThrough}%`}
                  sub={sellThroughMessage(activeParty.sellThrough)}
                  valueClass={activeParty.sellThrough >= 50 ? "text-emerald-400" : "text-rose-400"}
                />
                <MetricTile
                  icon="⏳"
                  label="Stock Will Last"
                  value={`${activeParty.weeksOfCover} weeks`}
                  sub={
                    activeParty.weeksOfCover >= 4
                      ? "Comfortable — no rush to restock"
                      : activeParty.weeksOfCover >= 2
                      ? "Getting low — plan a reorder"
                      : "Very low — reorder soon!"
                  }
                  valueClass={weeksColour(activeParty.weeksOfCover)}
                />
                <MetricTile
                  icon="💸"
                  label="Locked Capital"
                  value={formatCurrency(activeParty.capitalLocked)}
                  sub="Value of unsold goods at MRP"
                  valueClass="text-rose-400"
                />
              </div>

              {/* ── WHAT DOES THIS MEAN? explainer ── */}
              <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">
                  ℹ️ How to read these numbers
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-theme-muted leading-relaxed">
                  <div>
                    <span className="text-theme-body font-medium">Stock with Distributor</span> — This is how many pieces of your goods are currently sitting with this distributor. If it's very high and Sold % is low, goods are not moving.
                  </div>
                  <div>
                    <span className="text-theme-body font-medium">How Much Has Sold</span> — Out of everything you sent, what % has the distributor sold to their customers. 70%+ is good. Below 30% means goods are stuck.
                  </div>
                  <div>
                    <span className="text-theme-body font-medium">Stock Will Last</span> — At the current selling speed, how many more weeks will the stock last before they run out. Less than 2 weeks = reorder soon.
                  </div>
                  <div>
                    <span className="text-theme-body font-medium">Money Tied in Unsold Stock</span> — This is your money that is "locked" in unsold goods. It will return to you once the distributor sells and pays.
                  </div>
                </div>
              </div>

              {/* ── 4-DAY CHART ── */}
              {activeParty.history && activeParty.history.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-theme-body">
                      📈 Last 4 Days — Stock vs Sales
                    </h4>
                    <span className="text-[10px] text-theme-muted">
                      Blue = stock remaining · Green = daily sales
                    </span>
                  </div>
                  <div className="h-52 bg-theme-surface-3/40 p-4 rounded-xl border border-theme-divider">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={activeParty.history}
                        margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                        <XAxis dataKey="date" stroke="#8892a4" fontSize={11} />
                        <YAxis stroke="#8892a4" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#16213e",
                            borderColor: "#2a3a5c",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "white" }}
                          formatter={(value: number, name: string) => [
                            `${value} pcs`,
                            name === "stock" ? "📦 Stock Remaining" : "🛒 Daily Sales",
                          ]}
                        />
                        <Legend
                          formatter={(value) =>
                            value === "stock" ? "📦 Stock Remaining" : "🛒 Daily Sales"
                          }
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="stock"
                          stroke="#2563EB"
                          strokeWidth={2}
                          activeDot={{ r: 5 }}
                          name="stock"
                        />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          stroke="#22c55e"
                          strokeWidth={2}
                          name="sales"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-theme-muted mt-2 text-center">
                    If the blue line stays flat and green is low, sales have slowed down.
                  </p>
                </div>
              ) : (
                <div className="bg-theme-surface-3/40 border border-theme-divider rounded-xl p-6 text-center text-sm text-theme-muted">
                  <span className="text-2xl block mb-2">📉</span>
                  No sales activity recorded yet for this distributor. Chart will appear once goods start moving.
                </div>
              )}

              {/* ── PER-PRODUCT TABLE ── */}
              {activeParty.skuTracking && activeParty.skuTracking.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-theme-body mb-3">
                    📋 Product-by-Product Breakdown
                  </h4>
                  <p className="text-xs text-theme-muted mb-3">
                    This table shows each product separately — how many were sent, how many sold, and how many are still there.
                  </p>
                  <div className="overflow-x-auto border border-theme-divider rounded-xl bg-theme-surface-3/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 border-b border-theme-divider">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Product</th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">
                            Sent 📤
                          </th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">
                            Sold ✅
                          </th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">
                            Returned 🔄
                          </th>
                          <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">
                            Still There 📦
                          </th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">
                            Sold %
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/50">
                        {activeParty.skuTracking.map((sku) => (
                          <SkuRow key={sku.sku} sku={sku} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-theme-muted mt-2">
                    <span className="text-emerald-400">Green</span> = sold · <span className="text-rose-400">Red</span> = returned · <span className="text-blue-400">Blue</span> = still at distributor
                  </p>
                </div>
              )}

              {/* ── TIP CARD ── */}
              {tip && (
                <div className="bg-theme-surface-3 rounded-xl p-4 border border-theme-divider flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
                  <div>
                    <div className="font-bold text-sm text-theme-body mb-1">{tip.title}</div>
                    <p className="text-xs text-theme-muted leading-relaxed">{tip.body}</p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM LEGEND ── */}
      <div className="flex flex-wrap gap-4 justify-center pt-2 pb-1">
        {[
          { emoji: "🟢", label: "All Good — selling well, no action needed" },
          { emoji: "🟡", label: "Keep Watch — sales slightly slow" },
          { emoji: "🔴", label: "Needs Action — goods not moving" },
          { emoji: "⚫", label: "Sold Out — nothing left, reorder if needed" },
        ].map((item) => (
          <span key={item.emoji} className="text-[11px] text-theme-muted flex items-center gap-1.5">
            <span>{item.emoji}</span> {item.label}
          </span>
        ))}
      </div>

    </div>
  );
};
