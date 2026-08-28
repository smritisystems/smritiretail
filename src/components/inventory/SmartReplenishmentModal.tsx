/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.92.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import ReplenishmentEngine, {
  InventoryItem,
  ReplenishmentSuggestion,
  ReplenishmentTrigger,
} from "../../../utils/replenishmentEngine";

interface SmartReplenishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TRIGGER_STYLES: Record<ReplenishmentTrigger, { badge: string; label: string }> = {
  SAFETY_STOCK_BREACH: { badge: "bg-red-600/20 text-red-300 border-red-500/30",   label: "⚠ Safety Stock Breach" },
  REORDER_POINT_HIT:   { badge: "bg-rose-500/20 text-rose-300 border-rose-500/30", label: "Reorder Point Hit" },
  MIN_STOCK_BREACH:    { badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", label: "Min Stock Breach" },
  SEASONAL_PUSH:       { badge: "bg-violet-500/20 text-violet-300 border-violet-500/30", label: "Seasonal Push" },
  MANUAL_OVERRIDE:     { badge: "bg-slate-500/20 text-slate-300 border-slate-500/30", label: "Manual Override" },
};

const SAMPLE_INVENTORY: InventoryItem[] = [
  { sku: "APP-POLO-NAVY-M",   productName: "Polo Shirt Navy M",          category: "Apparel",     branchCode: "BR-MUM-01", currentStock: 12,  minStockLevel: 20, maxStockLevel: 200, reorderPoint: 40, safetyStock: 15, avgDailySales: 5,  leadTimeDays: 7,  unitCost: 600,  preferredSupplierId: "SUP-001" },
  { sku: "DNM-SLIM-BLK-32",   productName: "Slim Fit Denim Black 32",    category: "Denim",       branchCode: "BR-MUM-01", currentStock: 8,   minStockLevel: 15, maxStockLevel: 150, reorderPoint: 30, safetyStock: 10, avgDailySales: 3,  leadTimeDays: 10, unitCost: 950,  preferredSupplierId: "SUP-002" },
  { sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers White Size 8",      category: "Footwear",    branchCode: "BR-MUM-01", currentStock: 35,  minStockLevel: 10, maxStockLevel: 80,  reorderPoint: 20, safetyStock: 5,  avgDailySales: 2,  leadTimeDays: 14, unitCost: 1400, preferredSupplierId: "SUP-003" },
  { sku: "FRM-SHIRT-BLU-M",   productName: "Formal Shirt Blue M",        category: "Formals",     branchCode: "BR-MUM-01", currentStock: 22,  minStockLevel: 25, maxStockLevel: 180, reorderPoint: 50, safetyStock: 20, avgDailySales: 4,  leadTimeDays: 5,  unitCost: 750,  preferredSupplierId: "SUP-001" },
  { sku: "ACC-BELT-BRN-34",   productName: "Leather Belt Brown 34",       category: "Accessories", branchCode: "BR-MUM-01", currentStock: 60,  minStockLevel: 10, maxStockLevel: 100, reorderPoint: 20, safetyStock: 8,  avgDailySales: 1,  leadTimeDays: 7,  unitCost: 450 },
  { sku: "APP-KURTA-WHT-L",   productName: "Cotton Kurta White L",        category: "Apparel",     branchCode: "BR-MUM-01", currentStock: 5,   minStockLevel: 20, maxStockLevel: 120, reorderPoint: 30, safetyStock: 10, avgDailySales: 4,  leadTimeDays: 6,  unitCost: 800,  preferredSupplierId: "SUP-001" },
];

const STATUS_COLORS = {
  PENDING:   "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:  "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  PO_RAISED: "text-teal-300 bg-teal-500/20 border-teal-500/30",
  CANCELLED: "text-slate-400 bg-slate-700/30 border-slate-600/30",
};

export const SmartReplenishmentModal: React.FC<SmartReplenishmentModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [asOf] = useState(new Date(2026, 7, 28));
  const [suggestions, setSuggestions] = useState<ReplenishmentSuggestion[]>(() =>
    ReplenishmentEngine.scanInventory(SAMPLE_INVENTORY, new Date(2026, 7, 28)).suggestions
  );
  const [filter, setFilter] = useState<ReplenishmentTrigger | "ALL">("ALL");

  const report = useMemo(() => ReplenishmentEngine.scanInventory(SAMPLE_INVENTORY, asOf), [asOf]);

  const displayed = filter === "ALL" ? suggestions : suggestions.filter((s) => s.trigger === filter);

  if (!isOpen) return null;

  const handleApprove = (suggId: string) => {
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? ReplenishmentEngine.approve(s) : s));
    onNotification?.("Approved", "Suggestion approved for PO generation.", "success");
  };

  const handleRaisePO = (suggId: string) => {
    const poNum = `PO-AUTO-${Date.now().toString().slice(-6)}`;
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? ReplenishmentEngine.raisePO(s, poNum) : s));
    onNotification?.("PO Raised", `Purchase Order ${poNum} raised automatically.`, "success");
  };

  const handleCancel = (suggId: string) => {
    setSuggestions((prev) => prev.map((s) => s.suggestionId === suggId ? ReplenishmentEngine.cancel(s) : s));
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
              <p className="text-xs text-slate-400">Safety Stock Breach · Reorder Point · Stockout Projection · Auto-PO Generation</p>
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
            { label: "Suggested PO Value", value: `₹${(report.totalSuggestedPOValue).toLocaleString("en-IN")}`, color: "text-teal-400" },
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
          {displayed.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No replenishment suggestions for this filter.</div>
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
                      <div className="text-[10px] text-slate-400 font-mono">{sugg.sku} · {sugg.category} · {sugg.branchCode}</div>
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
                          🤖 Auto-Raise PO
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
                      { label: "Est. PO Value", value: `₹${sugg.estimatedPOValue.toLocaleString("en-IN")}`, color: "text-violet-400" },
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
                        {sugg.preferredSupplierId && ` · Supplier: ${sugg.preferredSupplierId}`}
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
