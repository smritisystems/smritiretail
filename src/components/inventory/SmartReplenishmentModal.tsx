/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.93.0
 * Created      : 2026-08-28
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.93.0 (2026-10-17):
 *   - Replaced static SAMPLE_INVENTORY demo array with live backend /inventory
 *     data fetching via apiFetchV1.
 *   - Added dynamic stock scanning, loading indicator, and honest empty states.
 */

import React, { useState, useMemo, useEffect } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

// â”€â”€â”€ Inlined from replenishmentEngine (R-27) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ReorderStatus = "PENDING" | "APPROVED" | "PO_RAISED" | "CANCELLED";
type ReplenishmentTrigger =
  | "MIN_STOCK_BREACH"
  | "REORDER_POINT_HIT"
  | "SAFETY_STOCK_BREACH"
  | "SEASONAL_PUSH"
  | "MANUAL_OVERRIDE";

interface InventoryItem {
  sku: string;
  productName: string;
  category: string;
  branchCode: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  safetyStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  unitCost: number;
  preferredSupplierId?: string;
}

interface ReplenishmentSuggestion {
  suggestionId: string;
  sku: string;
  productName: string;
  category: string;
  branchCode: string;
  trigger: ReplenishmentTrigger;
  currentStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  daysOfStockRemaining: number;
  estimatedStockoutDate: string;
  preferredSupplierId?: string;
  estimatedPOValue: number;
  status: ReorderStatus;
  createdAt: string;
  raisedPONumber?: string;
}

interface ReplenishmentReport {
  asOfDate: string;
  branchCode: string;
  totalSKUs: number;
  criticalSKUs: number;
  reorderDueSKUs: number;
  totalSuggestedPOValue: number;
  suggestions: ReplenishmentSuggestion[];
}

function _daysRemaining(item: InventoryItem): number {
  if (item.avgDailySales <= 0) return 999;
  return Math.floor(item.currentStock / item.avgDailySales);
}

function _stockoutDate(item: InventoryItem, asOf: Date): string {
  const d = new Date(asOf);
  d.setDate(d.getDate() + _daysRemaining(item));
  return d.toISOString();
}

function _getTrigger(item: InventoryItem): ReplenishmentTrigger | null {
  if (item.currentStock <= item.safetyStock) return "SAFETY_STOCK_BREACH";
  if (item.currentStock <= item.reorderPoint) return "REORDER_POINT_HIT";
  if (item.currentStock <= item.minStockLevel) return "MIN_STOCK_BREACH";
  return null;
}

const _TRIGGER_PRIORITY: Record<ReplenishmentTrigger, number> = {
  SAFETY_STOCK_BREACH: 0, REORDER_POINT_HIT: 1, MIN_STOCK_BREACH: 2,
  SEASONAL_PUSH: 3, MANUAL_OVERRIDE: 4,
};

function scanInventory(items: InventoryItem[], asOf: Date = new Date()): ReplenishmentReport {
  const suggestions: ReplenishmentSuggestion[] = [];
  for (const item of items) {
    const trigger = _getTrigger(item);
    if (!trigger) continue;
    const qty = Math.max(0, item.maxStockLevel - item.currentStock);
    if (qty <= 0) continue;
    suggestions.push({
      suggestionId: `SUGG-${item.sku}-${Date.now()}`,
      sku: item.sku, productName: item.productName,
      category: item.category, branchCode: item.branchCode,
      trigger, currentStock: item.currentStock, reorderPoint: item.reorderPoint,
      suggestedOrderQty: qty,
      daysOfStockRemaining: _daysRemaining(item),
      estimatedStockoutDate: _stockoutDate(item, asOf),
      preferredSupplierId: item.preferredSupplierId,
      estimatedPOValue: Math.round(qty * item.unitCost * 100) / 100,
      status: "PENDING", createdAt: asOf.toISOString(),
    });
  }
  suggestions.sort((a, b) => _TRIGGER_PRIORITY[a.trigger] - _TRIGGER_PRIORITY[b.trigger]);
  const criticalSKUs    = suggestions.filter((s) => s.trigger === "SAFETY_STOCK_BREACH").length;
  const reorderDueSKUs  = suggestions.filter((s) => s.trigger === "REORDER_POINT_HIT" || s.trigger === "MIN_STOCK_BREACH").length;
  const totalSuggestedPOValue = Math.round(suggestions.reduce((s, sg) => s + sg.estimatedPOValue, 0) * 100) / 100;
  return { asOfDate: asOf.toISOString(), branchCode: items[0]?.branchCode ?? "ALL",
    totalSKUs: items.length, criticalSKUs, reorderDueSKUs, totalSuggestedPOValue, suggestions };
}

const raisePO  = (s: ReplenishmentSuggestion, poNumber: string): ReplenishmentSuggestion => ({ ...s, status: "PO_RAISED",  raisedPONumber: poNumber });
const approve  = (s: ReplenishmentSuggestion): ReplenishmentSuggestion             => ({ ...s, status: "APPROVED"  });
const cancelSg = (s: ReplenishmentSuggestion): ReplenishmentSuggestion             => ({ ...s, status: "CANCELLED" });
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SmartReplenishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TRIGGER_STYLES: Record<ReplenishmentTrigger, { badge: string; label: string }> = {
  SAFETY_STOCK_BREACH: { badge: "bg-red-600/20 text-red-300 border-red-500/30",   label: "? Safety Stock Breach" },
  REORDER_POINT_HIT:   { badge: "bg-rose-500/20 text-rose-300 border-rose-500/30", label: "Reorder Point Hit" },
  MIN_STOCK_BREACH:    { badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "Min Stock Breach" },
  SEASONAL_PUSH:       { badge: "bg-violet-500/20 text-violet-300 border-violet-500/30", label: "Seasonal Push" },
  MANUAL_OVERRIDE:     { badge: "bg-slate-500/20 text-slate-300 border-slate-500/30", label: "Manual Override" },
};

const STATUS_COLORS = {
  PENDING:   "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:  "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  PO_RAISED: "text-teal-300 bg-teal-500/20 border-teal-500/30",
  CANCELLED: "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

export const SmartReplenishmentModal: React.FC<SmartReplenishmentModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [asOf] = useState(() => new Date());
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReplenishmentTrigger | "ALL">("ALL");

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setFetchError(null);
    apiFetchV1<any>("/inventory?page_size=100")
      .then((res) => {
        const items = res?.items || [];
        const mapped: InventoryItem[] = items.map((p: any) => ({
          sku: p.sku || p.barcode || p.id,
          productName: p.name || p.title || "Catalog Product",
          category: p.category || "General",
          branchCode: "MAIN-01",
          currentStock: Number(p.stock_quantity ?? p.current_stock ?? p.quantity ?? 0),
          minStockLevel: Number(p.min_stock_level ?? 10),
          maxStockLevel: Number(p.max_stock_level ?? 100),
          reorderPoint: Number(p.reorder_point ?? 20),
          safetyStock: Number(p.safety_stock ?? 5),
          avgDailySales: Number(p.avg_daily_sales ?? 2),
          leadTimeDays: Number(p.lead_time_days ?? 7),
          unitCost: Number(p.cost_price ?? p.purchase_rate ?? 500),
          preferredSupplierId: p.supplier_id,
        }));
        setInventoryItems(mapped);
        const rep = scanInventory(mapped, new Date());
        setSuggestions(rep.suggestions);
      })
      .catch((err: any) => {
        console.error("Failed to load authoritative inventory:", err);
        setFetchError(err?.message || "Failed to load inventory from database.");
        setInventoryItems([]);
        setSuggestions([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  const report = useMemo(() => scanInventory(inventoryItems, asOf), [inventoryItems, asOf]);

  const displayed = filter === "ALL" ? suggestions : suggestions.filter((s) => s.trigger === filter);

  if (!isOpen) return null;

  const handleApprove = (suggId: string) => {
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? approve(s) : s));
    onNotification?.("Approved", "Suggestion approved for PO generation.", "success");
  };

  const handleRaisePO = (suggId: string) => {
    const poNum = `PO-AUTO-${Date.now().toString().slice(-6)}`;
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? raisePO(s, poNum) : s));
    onNotification?.("PO Raised", `Purchase Order ${poNum} raised automatically.`, "success");
  };

  const handleCancel = (suggId: string) => {
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? cancelSg(s) : s));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Smart Replenishment & Min-Max Inventory Reorder Automation</h2>
              <p className="text-xs text-slate-400">Safety Stock Breach Â· Reorder Point Â· Stockout Projection Â· Auto-PO Generation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-4 gap-0 border-b border-slate-800 divide-x divide-slate-800 bg-slate-950/30">
          {[
            { label: "Total SKUs", value: report.totalSKUs, color: "text-slate-300" },
            { label: "Critical (Safety Breach)", value: report.criticalSKUs, color: "text-red-400" },
            { label: "Reorder Due", value: report.reorderDueSKUs, color: "text-amber-400" },
            { label: "Suggested PO Value", value: `â‚¹${(report.totalSuggestedPOValue).toLocaleString("en-IN")}`, color: "text-teal-400" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3 text-center">
              <div className={`text-lg font-black font-mono ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800 bg-slate-950/20 overflow-x-auto">
          {(["ALL", "SAFETY_STOCK_BREACH", "REORDER_POINT_HIT", "MIN_STOCK_BREACH"] as const).map((f) => {
            const ts = f !== "ALL" ? TRIGGER_STYLES[f] : null;
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border whitespace-nowrap transition-all ${filter === f ? (ts ? ts.badge : "bg-slate-700/60 text-slate-300 border-slate-600") : "text-slate-500 border-transparent hover:text-slate-300"}`}>
                {f === "ALL" ? `All (${suggestions.length})` : TRIGGER_STYLES[f].label}
              </button>
            );
          })}
        </div>

        {/* Suggestion Cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
              Connecting to authoritative inventory ledger and evaluating stock levels...
            </div>
          ) : fetchError ? (
            <div className="text-center py-12 text-rose-400 text-sm">
              <div className="font-bold text-rose-300">Inventory Sync Notice</div>
              <div className="text-xs mt-1 text-rose-400">{fetchError}</div>
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <div className="font-bold text-slate-200">No Replenishment Alerts Required</div>
              <div className="text-xs text-slate-400 mt-1">
                All catalog products currently maintain stock levels above safety stock and reorder thresholds.
              </div>
            </div>
          ) : (
            displayed.map((sugg) => {
              const ts = TRIGGER_STYLES[sugg.trigger];
              const sc = STATUS_COLORS[sugg.status];
              const stockoutDate = new Date(sugg.estimatedStockoutDate);
              return (
                <div key={sugg.suggestionId} className={`rounded-2xl border p-5 transition-all ${sugg.trigger === "SAFETY_STOCK_BREACH" ? "bg-red-950/10 border-red-600/30" : sugg.trigger === "REORDER_POINT_HIT" ? "bg-amber-950/10 border-amber-600/30" : "bg-slate-800/30 border-slate-700/60"}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-slate-100">{sugg.productName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ts.badge}`}>{ts.label}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sc}`}>{sugg.status}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{sugg.sku} Â· {sugg.category} Â· {sugg.branchCode}</div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {sugg.status === "PENDING" && (
                        <>
                          <button onClick={() => handleApprove(sugg.suggestionId)} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all">Approve</button>
                          <button onClick={() => handleCancel(sugg.suggestionId)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all">Cancel</button>
                        </>
                      )}
                      {sugg.status === "APPROVED" && (
                        <button onClick={() => handleRaisePO(sugg.suggestionId)} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-teal-600 hover:bg-teal-500 transition-all shadow-lg shadow-teal-500/20">
                          Ã°Å¸Â¤â€“ Auto-Raise PO
                        </button>
                      )}
                      {sugg.status === "PO_RAISED" && (
                        <span className="text-[10px] font-bold text-teal-400 font-mono">{sugg.raisedPONumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Stock Metrics */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Current Stock", value: sugg.currentStock, color: sugg.currentStock <= 10 ? "text-red-400" : "text-amber-400" },
                      { label: "Reorder Point", value: sugg.reorderPoint, color: "text-slate-300" },
                      { label: "Order Qty", value: sugg.suggestedOrderQty, color: "text-teal-400" },
                      { label: "Days Remaining", value: `${sugg.daysOfStockRemaining}d`, color: sugg.daysOfStockRemaining <= 7 ? "text-red-400" : "text-amber-400" },
                      { label: "Est. PO Value", value: `â‚¹${sugg.estimatedPOValue.toLocaleString("en-IN")}`, color: "text-violet-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-center">
                        <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Stockout Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Today</span>
                      <span className={sugg.daysOfStockRemaining <= 7 ? "text-red-400 font-bold" : "text-slate-400"}>
                        Stockout: {stockoutDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {sugg.preferredSupplierId && ` Â· Supplier: ${sugg.preferredSupplierId}`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${sugg.daysOfStockRemaining <= 3 ? "bg-red-500" : sugg.daysOfStockRemaining <= 7 ? "bg-amber-500" : "bg-teal-500"}`}
                        style={{ width: `${Math.min(100, (sugg.daysOfStockRemaining / 30) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default SmartReplenishmentModal;

