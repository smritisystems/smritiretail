/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Modern Trade & Customer Inventory Visibility (CIV Studio — ADR-CSV-001 v2.0)
 * Standard     : WNG-002: List Report & Dashboard Pattern (Commercial Stock Visibility)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React, { useState, useMemo } from "react";
import {
  Store, Building2, Package, TrendingUp, AlertTriangle, CheckCircle2,
  Upload, Download, Search, RefreshCw, Layers, ShieldCheck, ArrowUpRight,
  Filter, Calendar, Clock, DollarSign, Sparkles, Truck, Check, FileText, MapPin, Tag
} from "lucide-react";
import { CustomerStockVisibilityEngine, CustomerStoreStockRecord, SuggestedDispatchOrder } from "../services/customerStockVisibilityEngine.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";

export const CustomerStockVisibilityTab: React.FC = () => {
  const engine = CustomerStockVisibilityEngine.getInstance();
  const [stockRecords, setStockRecords] = useState<CustomerStoreStockRecord[]>(engine.getCustomerStoreStock());
  const [suggestedDispatches, setSuggestedDispatches] = useState<SuggestedDispatchOrder[]>(engine.getSuggestedDispatches());
  const [activeSubTab, setActiveSubTab] = useState<"visibility" | "hierarchy" | "aging" | "claims" | "replenishment">("visibility");
  const [selectedKeyAccountFilter, setSelectedKeyAccountFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const filteredRecords = useMemo(() => {
    return stockRecords.filter((r) => {
      const matchCust = selectedKeyAccountFilter === "ALL" || r.hierarchy.keyAccount === selectedKeyAccountFilter;
      const matchSearch =
        searchQuery === "" ||
        r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.hierarchy.storeName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCust && matchSearch;
    });
  }, [stockRecords, selectedKeyAccountFilter, searchQuery]);

  const handleSimulateSellOutImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      const res = engine.importSellOutData([
        { customerCode: "Reliance", storeCode: "WH-01", sku: "SHOE-001", sellOutQty: 10, sellOutDate: new Date().toISOString().slice(0, 10) },
        { customerCode: "D-Mart", storeCode: "WH-02", sku: "TSHIRT-001", sellOutQty: 15, sellOutDate: new Date().toISOString().slice(0, 10) },
      ]);
      setStockRecords(engine.getCustomerStoreStock());
      setIsImporting(false);
      recordAuditAction("IMPORT", "customer_stock", "sellout_csv", `Imported ${res.importedRows} customer sell-out POS rows.`);
    }, 1200);
  };

  const handleApproveDispatch = (id: string) => {
    engine.approveDispatch(id);
    setSuggestedDispatches(engine.getSuggestedDispatches());
  };

  const totalInvoiced = stockRecords.reduce((acc, r) => acc + r.invoicedQty, 0);
  const totalSold = stockRecords.reduce((acc, r) => acc + r.confirmedSoldQty, 0);
  const totalLying = stockRecords.reduce((acc, r) => acc + r.currentLyingStock, 0);
  const overallSellThrough = totalInvoiced > 0 ? ((totalSold / totalInvoiced) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col h-full bg-theme-base text-theme-body font-sans">
      {/* Header Banner */}
      <div className="p-5 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold font-display text-theme-heading">SMRITI Modern Trade &amp; Customer Inventory Visibility (CIV Studio)</h1>
          </div>
          <p className="text-xs text-theme-muted mt-0.5">
            Off-balance commercial visibility across Key Accounts (Reliance, D-Mart, Lifestyle, Croma) post GST Tax Invoice
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub-Tab Switcher */}
          <div className="flex bg-theme-surface-2 p-1 rounded-lg font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab("visibility")}
              className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                activeSubTab === "visibility" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-body"
              }`}
            >
              Stock Visibility
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("hierarchy")}
              className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                activeSubTab === "hierarchy" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-body"
              }`}
            >
              Store Hierarchy
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("aging")}
              className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                activeSubTab === "aging" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-body"
              }`}
            >
              Invoice Aging
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("replenishment")}
              className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                activeSubTab === "replenishment" ? "bg-theme-surface-1 text-emerald-400 shadow-sm" : "text-theme-muted hover:text-theme-body"
              }`}
            >
              Auto Replenishment
            </button>
          </div>

          <button
            type="button"
            onClick={handleSimulateSellOutImport}
            disabled={isImporting}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload size={14} />
            <span>{isImporting ? "Importing..." : "Import Sell-Out CSV / EDI"}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 bg-theme-surface-2 border-b border-theme-divider">
        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl">
          <span className="text-[10px] text-theme-muted font-bold uppercase block">Invoiced to Accounts</span>
          <div className="text-xl font-black text-white mt-1">{totalInvoiced.toLocaleString()} Units</div>
          <span className="text-[10px] text-theme-muted">Cumulative GST Invoices</span>
        </div>

        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl">
          <span className="text-[10px] text-theme-muted font-bold uppercase block">Confirmed Customer Sell-Out</span>
          <div className="text-xl font-black text-emerald-400 mt-1">{totalSold.toLocaleString()} Units</div>
          <span className="text-[10px] text-emerald-400 font-bold">POS Secondary Sales</span>
        </div>

        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl">
          <span className="text-[10px] text-theme-muted font-bold uppercase block">Lying at Customer Stores</span>
          <div className="text-xl font-black text-blue-400 mt-1">{totalLying.toLocaleString()} Units</div>
          <span className="text-[10px] text-blue-400 font-bold">Off-Balance Commercial Stock</span>
        </div>

        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl">
          <span className="text-[10px] text-theme-muted font-bold uppercase block">Overall Sell-Through %</span>
          <div className="text-xl font-black text-purple-400 mt-1">{overallSellThrough}%</div>
          <div className="w-full h-1.5 bg-theme-surface-3 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-purple-500" style={{ width: `${overallSellThrough}%` }} />
          </div>
        </div>
      </div>

      {/* Active View Sub-Tab Contents */}
      {activeSubTab === "visibility" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Bar */}
          <div className="px-5 py-3 border-b border-theme-divider bg-theme-surface-1 flex justify-between items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-theme-muted" />
                <span className="text-theme-muted">Key Account:</span>
              </div>
              <select
                value={selectedKeyAccountFilter}
                onChange={(e) => setSelectedKeyAccountFilter(e.target.value)}
                className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading font-bold text-xs outline-none"
              >
                <option value="ALL">All Key Accounts (Reliance, D-Mart, Lifestyle)</option>
                <option value="Reliance Retail Ltd">Reliance Retail Ltd</option>
                <option value="Avenue Supermarts (D-Mart)">Avenue Supermarts (D-Mart)</option>
                <option value="Lifestyle Stores">Lifestyle Stores</option>
              </select>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search store location or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-heading w-64 outline-none"
              />
            </div>
          </div>

          {/* Main Stock Visibility Table */}
          <div className="flex-1 overflow-auto p-5">
            <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-theme-surface-2 border-b border-theme-divider text-[10px] font-bold uppercase text-theme-muted">
                    <th className="p-3">Key Account / Store Location</th>
                    <th className="p-3">SKU &amp; Product</th>
                    <th className="p-3 text-right">Invoiced</th>
                    <th className="p-3 text-right">Confirmed Sold</th>
                    <th className="p-3 text-right">Lying Stock</th>
                    <th className="p-3 text-right">Sell-Through %</th>
                    <th className="p-3 text-right">Days of Stock</th>
                    <th className="p-3">Replenishment Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-theme-surface-2/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-theme-heading font-sans text-sm">{r.hierarchy.keyAccount}</div>
                        <div className="text-[10px] text-theme-muted flex items-center gap-1 mt-0.5">
                          <Store size={10} /> {r.hierarchy.storeName}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-theme-heading font-sans">{r.productName}</div>
                        <div className="text-[10px] text-indigo-400 font-mono">{r.sku}</div>
                      </td>

                      <td className="p-3 text-right font-bold text-theme-body">{r.invoicedQty}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">{r.confirmedSoldQty}</td>
                      <td className="p-3 text-right font-bold text-blue-400 text-sm">{r.currentLyingStock}</td>

                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          r.sellThroughPct >= 70
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : r.sellThroughPct >= 40
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}>
                          {r.sellThroughPct}%
                        </span>
                      </td>

                      <td className="p-3 text-right font-bold text-amber-400">{r.daysOfStock} Days ({r.weeksOfCover}W)</td>

                      <td className="p-3">
                        <div className={`p-2 rounded-lg border text-[11px] font-mono ${
                          r.replenishmentRecommendation.urgency === "CRITICAL_REORDER"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            : r.replenishmentRecommendation.urgency === "EXCESS_STOCK"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        }`}>
                          <div className="font-bold uppercase text-[9px] mb-0.5">{r.replenishmentRecommendation.urgency}</div>
                          <div>{r.replenishmentRecommendation.actionMessage}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Auto Replenishment Dispatch Sub-Tab */}
      {activeSubTab === "replenishment" && (
        <div className="flex-1 p-5 overflow-auto space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-theme-heading font-display">Automated Replenishment Dispatch Preparation</h3>
              <p className="text-xs text-theme-muted">Pre-generated dispatch orders for stores with critical stock cover under 8 days</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestedDispatches.map((dsp) => (
              <div key={dsp.id} className="p-5 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3 font-mono text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-theme-muted font-bold uppercase">{dsp.id}</span>
                    <h4 className="font-bold text-sm text-theme-heading font-sans">{dsp.customerName}</h4>
                    <p className="text-[11px] text-emerald-400 font-sans">{dsp.destinationStore}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                    dsp.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}>
                    {dsp.status}
                  </span>
                </div>

                <div className="p-3 bg-theme-surface-2 rounded-lg space-y-1">
                  <div className="flex justify-between text-theme-muted"><span>Target SKU:</span><span className="font-bold text-white">{dsp.sku}</span></div>
                  <div className="flex justify-between text-theme-muted"><span>Product Name:</span><span className="font-bold text-white">{dsp.productName}</span></div>
                  <div className="flex justify-between text-theme-muted"><span>Current Stock DOS:</span><span className="font-bold text-rose-400">{dsp.currentStockDOS} Days</span></div>
                  <div className="flex justify-between text-theme-muted"><span>Suggested Dispatch Qty:</span><span className="font-bold text-emerald-400">{dsp.suggestedQty} Units</span></div>
                  <div className="flex justify-between text-theme-muted"><span>Estimated Value:</span><span className="font-bold text-white">₹{dsp.estimatedTotal.toLocaleString("en-IN")}</span></div>
                </div>

                {dsp.status === "DRAFT_SUGGESTED" ? (
                  <button
                    type="button"
                    onClick={() => handleApproveDispatch(dsp.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} /> Approve Suggested Dispatch
                  </button>
                ) : (
                  <div className="text-center py-1 text-emerald-400 font-bold text-[11px] flex items-center justify-center gap-1">
                    <CheckCircle2 size={13} /> Approved — Dispatch Prepared
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
