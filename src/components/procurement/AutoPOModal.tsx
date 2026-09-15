/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.122.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import AutoPOEngine, {
  StockItem, ReorderBreach, AutoPurchaseOrder, AutoPOStatus, BreachSeverity,
} from "../../utils/autoPOEngine";

interface AutoPOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<AutoPOStatus, string> = {
  DRAFT:        "text-slate-300 bg-slate-700/20 border-slate-600/30",
  SUBMITTED:    "text-amber-300 bg-amber-500/15 border-amber-500/25",
  ACKNOWLEDGED: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED:    "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const SEVERITY_STYLE: Record<BreachSeverity, string> = {
  CRITICAL: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  LOW:      "text-amber-400 bg-amber-500/10 border-amber-500/20",
  NORMAL:   "text-sky-400 bg-sky-500/10 border-sky-500/20",
};

const fmt  = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const ITEMS: StockItem[] = [
  { sku: "MED-PARA-500",  productName: "Paracetamol 500mg",  branchCode: "BR-MUM-01", supplierId: "SUP-001", supplierName: "PharmaCo",    currentStock: 0,   reorderPoint: 50,  reorderQty: 200, supplierMOQ: 100, unitCost: 12,  leadTimeDays: 3 },
  { sku: "MED-AMOX-250",  productName: "Amoxicillin 250mg",  branchCode: "BR-MUM-01", supplierId: "SUP-001", supplierName: "PharmaCo",    currentStock: 20,  reorderPoint: 50,  reorderQty: 100, supplierMOQ: 50,  unitCost: 28,  leadTimeDays: 3 },
  { sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m",      branchCode: "BR-MUM-01", supplierId: "SUP-002", supplierName: "FabricWorld", currentStock: 80,  reorderPoint: 100, reorderQty: 300, supplierMOQ: 200, unitCost: 180, leadTimeDays: 7 },
  { sku: "FAB-SILK-RED",  productName: "Silk Red 1m",        branchCode: "BR-MUM-01", supplierId: "SUP-002", supplierName: "FabricWorld", currentStock: 5,   reorderPoint: 40,  reorderQty: 100, supplierMOQ: 50,  unitCost: 450, leadTimeDays: 7 },
  { sku: "ACC-BELT-BRN",  productName: "Leather Belt Brown", branchCode: "BR-MUM-01", supplierId: "SUP-003", supplierName: "AccessoCo",  currentStock: 200, reorderPoint: 50,  reorderQty: 150, supplierMOQ: 100, unitCost: 320, leadTimeDays: 5 },  // No breach
];

export const AutoPOModal: React.FC<AutoPOModalProps> = ({ isOpen, onClose, onNotification }) => {
  const breaches = useMemo(() => AutoPOEngine.detectBreaches(ITEMS), []);
  const [pos, setPOs] = useState<AutoPurchaseOrder[]>(() => AutoPOEngine.consolidatePOs(breaches));
  const [selectedPOId, setSelectedPOId]   = useState(pos[0]?.poId ?? "");
  const [activeTab, setActiveTab]         = useState<"LINES" | "BREACHES">("BREACHES");

  const selected = pos.find((p) => p.poId === selectedPOId);
  const summary  = useMemo(() => AutoPOEngine.poSummary(pos), [pos]);

  if (!isOpen) return null;

  const update = (updated: AutoPurchaseOrder) =>
    setPOs((prev) => prev.map((p) => p.poId === updated.poId ? updated : p));

  const handleSubmit = () => {
    if (!selected) return;
    try { update(AutoPOEngine.submit(selected, "PURCHASE-MGR")); onNotification?.("Submitted", selected.poNo, "info"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleAck = () => {
    if (!selected) return;
    try { update(AutoPOEngine.acknowledge(selected)); onNotification?.("Acknowledged", selected.poNo, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleCancel = () => {
    if (!selected) return;
    try { update(AutoPOEngine.cancel(selected, "Budget hold")); onNotification?.("Cancelled", selected.poNo, "error"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-2xl">ðŸ¤–</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Purchase Order Auto-Generation Engine</h2>
              <p className="text-xs text-slate-400">Reorder Breach Detection · MOQ Enforcement · PO Consolidation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["BREACHES", "LINES"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-lime-500/20 text-lime-300 border border-lime-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "BREACHES" ? `Breaches (${breaches.length})` : "PO Lines"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2"><span className="material-symbols-outlined text-lg">close</span></button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Auto-POs",   value: summary.totalPOs },
            { label: "Total Value",value: fmt(summary.totalValue), style: "text-lime-400 font-black" },
            { label: "Total Qty",  value: summary.totalQty },
            ...Object.entries(summary.byStatus).map(([s, c]) => ({ label: s, value: c, style: STATUS_STYLE[s as AutoPOStatus].split(" ")[0] })),
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-mono font-bold ${m.style ?? "text-slate-300"}`}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* PO sidebar */}
          <div className="w-52 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {pos.map((po) => (
              <button key={po.poId} onClick={() => { setSelectedPOId(po.poId); setActiveTab("LINES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedPOId === po.poId ? "bg-lime-950/20 border-lime-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200 truncate">{po.poNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{po.supplierName}</p>
                <p className="text-xs font-black font-mono text-lime-400 mt-1">{fmt(po.totalValue)}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[po.status]}`}>{po.status}</span>
                  <span className="text-[8px] text-slate-500">{po.totalLines} SKU · {po.totalQty} units</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "BREACHES" && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reorder Point Breaches — {breaches.length} item(s)</p>
                {breaches.map((b) => (
                  <div key={b.sku} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${b.severity === "CRITICAL" ? "bg-rose-950/15 border-rose-500/25" : b.severity === "LOW" ? "bg-amber-950/10 border-amber-500/20" : "bg-sky-950/10 border-sky-500/20"}`}>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{b.productName}</p>
                      <p className="text-[10px] text-slate-500">{b.sku} · {b.supplierName} · lead {b.leadTimeDays}d</p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-[9px] text-slate-500">Stock / ROP</p>
                        <p className="text-xs font-mono font-bold text-slate-300">{b.currentStock} / {b.reorderPoint}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500">Order Qty</p>
                        <p className="text-xs font-mono font-bold text-lime-400">{b.suggestedQty}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500">Line Total</p>
                        <p className="text-xs font-mono font-bold text-emerald-400">{fmt(b.lineTotal)}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${SEVERITY_STYLE[b.severity]}`}>{b.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "LINES" && selected && (
              <>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold font-mono text-slate-100">{selected.poNo}</p>
                    <p className="text-xs text-slate-400">{selected.supplierName} · {selected.branchCode}</p>
                    {selected.expectedDelivery && <p className="text-[10px] text-slate-500">Expected: {selected.expectedDelivery}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                    {selected.status === "DRAFT"     && <button onClick={handleSubmit} className="px-3 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-xl">Submit to Supplier</button>}
                    {selected.status === "SUBMITTED" && <button onClick={handleAck}   className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl">Mark Acknowledged</button>}
                    {["DRAFT","SUBMITTED"].includes(selected.status) && <button onClick={handleCancel} className="px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-950/30 rounded-xl">Cancel</button>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total SKUs",  value: selected.totalLines, color: "text-slate-300" },
                    { label: "Total Qty",   value: selected.totalQty,   color: "text-lime-400 font-black" },
                    { label: "Total Value", value: fmt(selected.totalValue), color: "text-emerald-400 font-black" },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-right">Stock / ROP</th>
                      <th className="py-2 px-3 text-right">Order Qty</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.lines.map((l) => (
                        <tr key={l.lineId}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                          <td className="py-2 px-3 text-right text-slate-500">{l.currentStock} / {l.reorderPoint}</td>
                          <td className="py-2 px-3 text-right font-bold text-lime-400">{l.orderedQty}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{fmt(l.unitCost)}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400">{fmt(l.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default AutoPOModal;

