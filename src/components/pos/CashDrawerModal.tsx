/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.111.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import CashDrawerEngine, {
  CashDrawer, Denomination, ReconcileStatus,
  STANDARD_DENOMINATIONS,
} from "../../utils/cashDrawerEngine";

interface CashDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const RECONCILE_STYLE: Record<ReconcileStatus, string> = {
  BALANCED: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  SHORT:    "text-rose-300 bg-rose-500/15 border-rose-500/25",
  OVER:     "text-amber-300 bg-amber-500/15 border-amber-500/25",
};

const fmt = (n: number) => `â‚¹${n.toLocaleString("en-IN")}`;

const INITIAL_FLOAT: Denomination[] = [
  { value: 2000, count: 1 },
  { value: 500,  count: 4 },
  { value: 100,  count: 10 },
  { value: 50,   count: 4 },
  { value: 20,   count: 5 },
  { value: 10,   count: 10 },
  { value: 5,    count: 10 },
  { value: 2,    count: 10 },
  { value: 1,    count: 30 },
];

function buildSampleDrawer(): CashDrawer {
  let d = CashDrawerEngine.openDrawer({
    branchCode: "BR-MUM-01", posTerminal: "POS-01",
    shiftId: "SHIFT-001", openedBy: "CASHIER-007",
    denominations: INITIAL_FLOAT,
  });
  d = CashDrawerEngine.recordMovement(d, "SALE",     1500, "CASHIER-007", "Invoice INV-0001");
  d = CashDrawerEngine.recordMovement(d, "SALE",     800,  "CASHIER-007", "Invoice INV-0002");
  d = CashDrawerEngine.recordMovement(d, "CASH_OUT", 200,  "CASHIER-007", "Petty expense â€” courier");
  d = CashDrawerEngine.recordMovement(d, "CASH_IN",  500,  "CASHIER-007", "Petty cash top-up");
  return d;
}

export const CashDrawerModal: React.FC<CashDrawerModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [drawer, setDrawer]   = useState<CashDrawer>(buildSampleDrawer);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "DENOMINATIONS" | "MOVEMENTS" | "RECONCILE">("OVERVIEW");
  const [reconDenoms, setReconDenoms] = useState<Denomination[]>(
    STANDARD_DENOMINATIONS.map((v) => ({ value: v, count: 0 }))
  );

  const reconTotal = useMemo(
    () => CashDrawerEngine.countDenominations(reconDenoms),
    [reconDenoms]
  );
  const reconVariance = useMemo(
    () => Math.round((reconTotal - drawer.expectedCash) * 100) / 100,
    [reconTotal, drawer.expectedCash]
  );

  if (!isOpen) return null;

  const updateCount = (value: number, count: number) =>
    setReconDenoms((prev) => prev.map((d) => d.value === value ? { ...d, count: Math.max(0, count) } : d));

  const handleReconcile = () => {
    const reconciled = CashDrawerEngine.reconcile(drawer, "SHIFT-MGR-001", reconDenoms, 5);
    setDrawer(reconciled);
    setActiveTab("OVERVIEW");
    onNotification?.(
      `EOD ${reconciled.reconciliation!.status}`,
      `Expected ${fmt(reconciled.reconciliation!.expectedCash)} Â· Actual ${fmt(reconciled.reconciliation!.actualCash)} Â· Variance ${fmt(reconciled.reconciliation!.variance)}`,
      reconciled.reconciliation!.status === "BALANCED" ? "success" : "error"
    );
  };

  const reconStatus: ReconcileStatus | null =
    drawer.reconciliation?.status ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <span className="material-symbols-outlined text-2xl">point_of_sale</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Cash Drawer & Float Management</h2>
              <p className="text-xs text-slate-400">{drawer.drawerNo} Â· {drawer.posTerminal} Â· {drawer.branchCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["OVERVIEW", "DENOMINATIONS", "MOVEMENTS", "RECONCILE"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-green-500/20 text-green-300 border border-green-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "DENOMINATIONS" ? "Float" : tab === "MOVEMENTS" ? "Ledger" : tab === "RECONCILE" ? "EOD" : "Overview"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-6 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Status",       value: drawer.status,                    color: drawer.status === "OPEN" ? "text-emerald-400" : "text-teal-400" },
            { label: "Opening Float", value: fmt(drawer.openingFloat),        color: "text-slate-300" },
            { label: "Net Sales",    value: fmt(drawer.netSales),             color: "text-teal-400" },
            { label: "Cash In",      value: fmt(drawer.totalCashIn),          color: "text-sky-400" },
            { label: "Cash Out",     value: fmt(drawer.totalCashOut),         color: "text-rose-400" },
            { label: "Expected",     value: fmt(drawer.expectedCash),         color: "text-slate-200" },
            { label: "Balance",      value: fmt(drawer.currentBalance),       color: "text-emerald-400" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-bold font-mono ${m.color}`}>{m.value}</span>
            </div>
          ))}
          {reconStatus && (
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${RECONCILE_STYLE[reconStatus]}`}>
              {reconStatus}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Opening Float",  value: fmt(drawer.openingFloat),   color: "text-slate-300" },
                  { label: "Net Sales",      value: fmt(drawer.netSales),       color: "text-teal-400" },
                  { label: "Refunds",        value: fmt(drawer.netRefunds),     color: "text-rose-400" },
                  { label: "Cash In",        value: fmt(drawer.totalCashIn),    color: "text-sky-400" },
                  { label: "Cash Out",       value: fmt(drawer.totalCashOut),   color: "text-orange-400" },
                  { label: "Expected Cash",  value: fmt(drawer.expectedCash),   color: "text-yellow-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
              {drawer.reconciliation && (
                <div className={`rounded-xl border p-4 ${RECONCILE_STYLE[drawer.reconciliation.status]}`}>
                  <p className="text-xs font-bold mb-2">EOD Reconciliation â€” {new Date(drawer.reconciliation.reconciledAt).toLocaleString("en-IN")}</p>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    {[
                      { label: "Expected", value: fmt(drawer.reconciliation.expectedCash) },
                      { label: "Actual",   value: fmt(drawer.reconciliation.actualCash) },
                      { label: "Variance", value: fmt(drawer.reconciliation.variance) },
                    ].map((m) => (
                      <div key={m.label} className="bg-black/20 rounded-lg p-2">
                        <div className="font-black font-mono">{m.value}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Audit trail */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Audit Trail</p>
                <div className="space-y-1.5">
                  {[...drawer.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        e.action === "SALE"     ? "text-teal-300 bg-teal-500/10 border-teal-500/20"
                        : e.action === "CASH_IN"  ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                        : e.action === "CASH_OUT" ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                        : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                      }`}>{e.action.replace(/_/g, " ")}</span>
                      <span className="text-slate-400 flex-1 truncate">{e.note}</span>
                      {e.amount !== undefined && <span className="font-mono text-slate-300">{fmt(e.amount)}</span>}
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{new Date(e.timestamp).toLocaleTimeString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "DENOMINATIONS" && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Float Denominations</p>
              <div className="grid grid-cols-2 gap-2">
                {INITIAL_FLOAT.map((d) => (
                  <div key={d.value} className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border border-slate-700/60 rounded-xl text-xs">
                    <span className="font-mono text-slate-300 font-bold">â‚¹{d.value}</span>
                    <span className="text-slate-500">Ã—</span>
                    <span className="font-mono text-slate-400">{d.count}</span>
                    <span className="font-mono text-emerald-400 font-bold">{fmt(d.value * d.count)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border border-green-500/20 rounded-xl">
                <span className="text-xs font-bold text-slate-300">Total Opening Float</span>
                <span className="font-mono font-black text-green-400">{fmt(drawer.openingFloat)}</span>
              </div>
            </div>
          )}

          {activeTab === "MOVEMENTS" && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Movement Ledger ({drawer.movements.length} entries)</p>
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Note</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">By</th>
                    <th className="py-2 px-3">Time</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800/40 font-mono">
                    {[...drawer.movements].reverse().map((m) => (
                      <tr key={m.movementId}>
                        <td className="py-2 px-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            m.kind === "SALE"     ? "text-teal-300 bg-teal-500/10 border-teal-500/20"
                            : m.kind === "CASH_IN"  ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                            : m.kind === "CASH_OUT" ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                            : m.kind === "REFUND"   ? "text-orange-300 bg-orange-500/10 border-orange-500/20"
                            : "text-slate-300 bg-slate-700/10 border-slate-600/20"
                          }`}>{m.kind.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-2 px-3 font-sans text-[10px] text-slate-400 max-w-[180px] truncate">{m.note}</td>
                        <td className="py-2 px-3 text-right text-slate-200">{fmt(m.amount)}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-500">{m.performedBy}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(m.timestamp).toLocaleTimeString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "RECONCILE" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-200">End-of-Day Physical Count</p>
                  <p className="text-xs text-slate-400">Enter denomination counts â€” expected: <span className="font-mono text-yellow-400">{fmt(drawer.expectedCash)}</span></p>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-black font-mono ${reconVariance === 0 ? "text-emerald-400" : reconVariance > 0 ? "text-amber-400" : "text-rose-400"}`}>{fmt(reconTotal)}</div>
                  <div className={`text-xs font-mono ${reconVariance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {reconVariance >= 0 ? "+" : ""}{fmt(reconVariance)} variance
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {reconDenoms.map((d) => (
                  <div key={d.value} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/30 border border-slate-700/60 rounded-xl">
                    <span className="text-xs font-mono font-bold text-slate-300 w-16">â‚¹{d.value}</span>
                    <input
                      type="number" min={0} value={d.count}
                      onChange={(e) => updateCount(d.value, parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200 text-center focus:outline-none focus:border-green-500/60"
                    />
                    <span className="text-[10px] font-mono text-emerald-400 ml-auto">{fmt(d.value * d.count)}</span>
                  </div>
                ))}
              </div>
              {drawer.status === "OPEN" && (
                <button onClick={handleReconcile}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-green-700 hover:bg-green-600 transition-all">
                  âœ“ Reconcile & Close Drawer
                </button>
              )}
              {drawer.status === "RECONCILED" && (
                <div className={`p-4 rounded-xl border ${RECONCILE_STYLE[drawer.reconciliation!.status]}`}>
                  <p className="text-sm font-bold">{drawer.reconciliation!.status} â€” Reconciled</p>
                  <p className="text-xs mt-1">Variance: {fmt(drawer.reconciliation!.variance)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default CashDrawerModal;

