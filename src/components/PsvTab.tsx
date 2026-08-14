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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { PSVParty } from "../types";
import { computeSkuLyingWithPartner, computeSkuSellThrough } from "../services/partnerSellThroughEngine.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";

interface PsvTabProps {
  psvParties: PSVParty[];
  currentUser?: { role: string; name: string } | null;
}

export const PsvTab: React.FC<PsvTabProps> = ({ psvParties, currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [selectedPartyId, setSelectedPartyId] = useState<string>(psvParties[0]?.id || "");

  useEffect(() => {
    if (!selectedPartyId && psvParties.length > 0) {
      setSelectedPartyId(psvParties[0].id);
    }
  }, [psvParties, selectedPartyId]);

  const activeParty = psvParties.find(p => p.id === selectedPartyId);

  // Formatting INR Currencies
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  useEffect(() => {
    if (activeParty) {
      recordAuditAction("TRANSACTION_VIEW", "psv_parties", activeParty.id, `Viewed PSV partner details and sell-through report: ${activeParty.name}`);
    }
  }, [activeParty]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {isReadOnly && (
        <div className="lg:col-span-12 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-amber-400 text-xs shadow-lg">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}
      
      {/* Left Column: Distributor List (Col span 5) */}
      <div className="lg:col-span-5 bg-theme-surface-1 p-5 rounded-xl border border-theme-divider space-y-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-theme-body">Party Stock Visibility (PSV)</h3>
          <p className="text-xs text-theme-muted">Downstream Channel Distribution Ledger</p>
        </div>

        <div className="space-y-3 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
          {psvParties.map(p => (
            <div
              key={p.id}
              onClick={() => setSelectedPartyId(p.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2.5 ${
                selectedPartyId === p.id 
                  ? "bg-theme-surface-3 border-[#2563EB]" 
                  : "bg-theme-surface-1 border-theme-divider hover:border-[#2563EB]"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-theme-body text-sm font-display">{p.name}</h4>
                  <p className="text-[11px] text-theme-muted flex items-center">
                    <span className="material-symbols-outlined text-xs mr-1 text-gray-500">location_on</span>
                    {p.location}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  p.status === "Healthy" 
                    ? "bg-emerald-500 bg-opacity-20 text-emerald-400 border-emerald-500" 
                    : p.status === "Monitor"
                    ? "bg-amber-500 bg-opacity-20 text-amber-400 border-amber-500"
                    : "bg-rose-500 bg-opacity-20 text-rose-400 border-rose-500"
                }`}>
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center border-t border-theme-divider pt-2.5 mt-1">
                <div>
                  <span className="block text-[9px] uppercase text-theme-muted">Stock Balance</span>
                  <span className="text-xs font-bold text-theme-body font-mono">{p.stockCount} u</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-theme-muted">Sell-Through</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{p.sellThrough}%</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-theme-muted">Runway Cover</span>
                  <span className="text-xs font-bold text-amber-400 font-mono">{p.weeksOfCover} W</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Detailed analysis with charts (Col span 7) */}
      <div className="lg:col-span-7 bg-theme-surface-1 p-6 rounded-xl border border-theme-divider flex flex-col justify-between">
        {activeParty ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-theme-divider">
              <div>
                <span className="text-xs text-theme-muted font-mono">Node ID: {activeParty.id}</span>
                <h3 className="font-display font-semibold text-lg text-theme-body mt-0.5">{activeParty.name}</h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-theme-muted block uppercase">Locked Capital</span>
                <span className="text-rose-400 font-bold font-mono text-sm">{formatCurrency(activeParty.capitalLocked)}</span>
              </div>
            </div>

            {/* Recharts daily velocity ledger */}
            <div>
              <h4 className="text-xs font-semibold text-theme-muted uppercase font-display mb-4">4-Day Stock vs Sales Velocity Trends</h4>
              <div className="h-60 bg-theme-surface-3 bg-opacity-40 p-4 rounded-lg border border-theme-divider">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeParty.history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                    <XAxis dataKey="date" stroke="#8892a4" fontSize={11} />
                    <YAxis stroke="#8892a4" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#16213e", borderColor: "#2a3a5c", borderRadius: 8 }}
                      labelStyle={{ color: "white" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="stock" stroke="#2563EB" activeDot={{ r: 6 }} name="On-Hand Inventory" strokeWidth={2} />
                    <Line type="monotone" dataKey="sales" stroke="#22c55e" name="Daily Sales Velocity" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Granular Per-SKU Inventory Tracking Table */}
            {activeParty.skuTracking && activeParty.skuTracking.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-theme-muted uppercase font-display mb-3">Granular Per-SKU Inventory Tracking</h4>
                <div className="overflow-x-auto border border-theme-divider rounded-lg bg-theme-surface-3 bg-opacity-40">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-2 border-b border-theme-divider">
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Product / SKU</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Invoiced</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Sold</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Returned</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Lying Stock</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Sell-Through</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider text-xs font-mono">
                      {activeParty.skuTracking.map((sku) => {
                        const lying = computeSkuLyingWithPartner(sku);
                        const sellThrough = computeSkuSellThrough(sku);
                        return (
                          <tr key={sku.sku} className="hover:bg-theme-surface-2/40 transition-colors">
                            <td className="px-4 py-2 text-theme-body font-sans font-medium">
                              <div>{sku.productName}</div>
                              <div className="text-[10px] text-theme-muted">{sku.sku}</div>
                            </td>
                            <td className="px-3 py-2 text-right text-theme-body">{sku.invoicedQty}</td>
                            <td className="px-3 py-2 text-right text-emerald-400">{sku.confirmedSoldQty}</td>
                            <td className="px-3 py-2 text-right text-rose-400">{sku.returnedQty}</td>
                            <td className="px-3 py-2 text-right text-blue-400 font-bold">{lying}</td>
                            <td className="px-4 py-2 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                sellThrough >= 70 
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                  : sellThrough >= 40 
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              }`}>
                                {sellThrough.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Suggestions card */}
            <div className="bg-theme-surface-3 rounded-lg p-4 border border-theme-divider flex items-start space-x-3">
              <span className="material-symbols-outlined text-amber-400 mt-0.5">lightbulb</span>
              <div>
                <h5 className="text-xs font-bold text-theme-body uppercase tracking-wider font-display">Operational Recommendation</h5>
                <p className="mt-1 text-xs text-theme-primary leading-relaxed">
                  {activeParty.status === "Critical" 
                    ? "Capital is severely stagnating. Immediately deploy pricing markdown schemes, bundle promotions, or generate an internal stock transfer request to move high-demand categories to active retail zones."
                    : activeParty.status === "Monitor"
                    ? "Stock runways are slightly below safety parameters. Monitor sales velocity indices and configure alert flags before generating standard replenishments."
                    : "No action required. Node continues to maintain high efficiency and steady stock turns. Proceed with standard operational cycles."}
                </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-theme-muted">
            Select a distributor to view downstream inventory analysis.
          </div>
        )}
      </div>

    </div>
  );
};
