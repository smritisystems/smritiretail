/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.122.0
 * Created      : 2026-10-27
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * ProPosStoreDayPanel
 * ====================
 * Store Business Day control panel:
 *   - Shows current store day status (OPEN / CLOSED / LOCKED / none)
 *   - Open Day button (MANAGER/SYSADMIN only)
 *   - Cross-shift EOD aggregation table (live from /pos/store-days/{id}/eod-report)
 *   - Close Day and Lock Day buttons with blocking-condition feedback
 *   - Sign-off notes textarea
 *   - Pending approval / offline sync blockers displayed inline
 *
 * Design principle: Power of an Enterprise ERP. Simplicity of WhatsApp.
 * No shadow aggregation tables — all totals from backend dynamic query.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Store,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  Banknote,
  CreditCard,
  QrCode,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { StoreBusinessDay, StoreDayEodReport } from "./types.ts";

interface ProPosStoreDayPanelProps {
  branchId: string;
  businessDate: string;                   // YYYY-MM-DD
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const fmt = (v: string | number | undefined | null, prefix = "₹") =>
  v !== undefined && v !== null ? `${prefix}${Number(v).toFixed(2)}` : "—";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    OPEN:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    CLOSED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    LOCKED: "bg-[#00288e]/10 text-[#00288e] dark:bg-[#1e40af]/30 dark:text-[#a8b8ff]",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
};

export const ProPosStoreDayPanel: React.FC<ProPosStoreDayPanelProps> = ({
  branchId,
  businessDate,
  onNotification,
}) => {
  const [storeDay, setStoreDay]         = useState<StoreBusinessDay | null>(null);
  const [eodReport, setEodReport]       = useState<StoreDayEodReport | null>(null);
  const [loading, setLoading]           = useState(false);
  const [acting, setActing]             = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showReport, setShowReport]     = useState(false);
  const [signOffNotes, setSignOffNotes] = useState("");

  // --- Fetch current open store day for branch ---------------------
  const loadStoreDay = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try fetching by listing recent store days for this branch+date
      const list = await apiFetchV1<StoreBusinessDay[]>(
        `/pos/store-days?branch_id=${branchId}&business_date=${businessDate}`
      );
      const open = (list || []).find((d) => d.status === "OPEN") || (list || [])[0] || null;
      setStoreDay(open);
      if (open && showReport) {
        await loadEodReport(open.id);
      }
    } catch {
      setStoreDay(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, businessDate, showReport]);

  const loadEodReport = async (storeDayId: string) => {
    try {
      const report = await apiFetchV1<StoreDayEodReport>(
        `/pos/store-days/${storeDayId}/eod-report`
      );
      setEodReport(report);
    } catch (e: any) {
      setEodReport(null);
    }
  };

  useEffect(() => {
    loadStoreDay();
  }, [loadStoreDay]);

  // --- Open Day ---------------------------------------------------
  const handleOpenDay = async () => {
    setActing(true);
    setError(null);
    try {
      const day = await apiFetchV1<StoreBusinessDay>("/pos/store-days/open", {
        method: "POST",
        body: JSON.stringify({ branch_id: branchId, business_date: businessDate }),
      });
      setStoreDay(day);
      onNotification?.("Store Day Opened", `Business day ${businessDate} is now OPEN.`, "success");
    } catch (e: any) {
      const msg = e?.detail || e?.message || "Could not open the store business day.";
      setError(msg);
      onNotification?.("Cannot Open Store Day", msg, "error");
    } finally {
      setActing(false);
    }
  };

  // --- Close Day --------------------------------------------------
  const handleCloseDay = async () => {
    if (!storeDay) return;
    setActing(true);
    setError(null);
    try {
      const day = await apiFetchV1<StoreBusinessDay>(
        `/pos/store-days/${storeDay.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({ sign_off_notes: signOffNotes.trim() || undefined }),
        }
      );
      setStoreDay(day);
      setEodReport(null);
      onNotification?.("Store Day Closed", `Business day ${businessDate} is now CLOSED.`, "success");
    } catch (e: any) {
      const msg = e?.detail || e?.message || "Could not close the store business day.";
      setError(msg);
      onNotification?.("Cannot Close Store Day", msg, "error");
    } finally {
      setActing(false);
    }
  };

  // --- Lock Day ---------------------------------------------------
  const handleLockDay = async () => {
    if (!storeDay) return;
    setActing(true);
    setError(null);
    try {
      const day = await apiFetchV1<StoreBusinessDay>(
        `/pos/store-days/${storeDay.id}/lock`,
        { method: "POST" }
      );
      setStoreDay(day);
      onNotification?.("Store Day Locked", `Business day ${businessDate} is permanently LOCKED.`, "success");
    } catch (e: any) {
      const msg = e?.detail || e?.message || "Could not lock the store business day.";
      setError(msg);
      onNotification?.("Cannot Lock Store Day", msg, "error");
    } finally {
      setActing(false);
    }
  };

  // --- Toggle EOD report ------------------------------------------
  const handleToggleReport = async () => {
    if (!storeDay) return;
    if (!showReport) {
      await loadEodReport(storeDay.id);
    }
    setShowReport((v) => !v);
  };

  const isLocked  = storeDay?.status === "LOCKED";
  const isClosed  = storeDay?.status === "CLOSED";
  const isOpen    = storeDay?.status === "OPEN";
  const hasDay    = !!storeDay;
  const noDay     = !hasDay;

  return (
    <div className="bg-white dark:bg-[#1a1f2e] border border-[#c4c5d5] dark:border-[#2d3148] rounded-2xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-[#f0f4ff] dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#2d3148]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#00288e] text-white shadow-sm">
            <Store size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#00288e] dark:text-[#a8b8ff] flex items-center gap-2">
              Store Business Day Control
              {storeDay && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(storeDay.status)}`}>
                  {storeDay.status}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar size={11} />
              <span>{businessDate} · Branch: {branchId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={loadStoreDay}
            disabled={loading}
            className="p-2 rounded-xl border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] transition text-slate-500"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Open Day */}
          {noDay && (
            <button
              type="button"
              disabled={acting}
              onClick={handleOpenDay}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Unlock size={13} />
              Open Store Day
            </button>
          )}

          {/* Close Day */}
          {isOpen && (
            <button
              type="button"
              disabled={acting}
              onClick={handleCloseDay}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Lock size={13} />
              Close Store Day
            </button>
          )}

          {/* Lock Day */}
          {isClosed && (
            <button
              type="button"
              disabled={acting}
              onClick={handleLockDay}
              className="px-4 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldCheck size={13} />
              Lock & Sign Off
            </button>
          )}

          {/* EOD Report toggle */}
          {hasDay && (
            <button
              type="button"
              onClick={handleToggleReport}
              className="px-4 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] text-xs font-bold rounded-xl transition flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
            >
              <ClipboardList size={13} />
              EOD Report
              {showReport ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex gap-2 items-start text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No day yet */}
      {noDay && !loading && (
        <div className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
          No store business day is open for {businessDate}. Open the day to begin recording cashier shifts.
        </div>
      )}

      {/* Day open — blockers summary */}
      {isOpen && storeDay && (
        <div className="px-5 py-4 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#f0fdf4] dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Opened</span>
              <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {storeDay.opened_at ? new Date(storeDay.opened_at).toLocaleTimeString() : "—"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#fffbeb] dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Opened By</span>
              <div className="font-mono font-bold text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {storeDay.opened_by || "Unknown / not recorded"}
              </div>
            </div>
          </div>

          {/* Sign-off notes for Close Day */}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Close Day Notes / Manager Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={signOffNotes}
              onChange={(e) => setSignOffNotes(e.target.value)}
              placeholder="Enter any closing remarks, cash drop references, or unresolved exception notes..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#191c1e] outline-none transition"
            />
          </div>
        </div>
      )}

      {/* CLOSED state — Lock prompt */}
      {isClosed && storeDay && (
        <div className="px-5 py-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex gap-3 items-start">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <div className="font-bold">Store Day is CLOSED — awaiting final manager lock.</div>
              <div className="mt-0.5">Review the EOD report, then click <strong>Lock & Sign Off</strong> to permanently seal the business day. This action cannot be undone.</div>
              {storeDay.sign_off_notes && (
                <div className="mt-1 italic text-[11px]">Notes: {storeDay.sign_off_notes}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOCKED banner */}
      {isLocked && storeDay && (
        <div className="px-5 py-4">
          <div className="p-4 rounded-xl bg-[#dde1ff] dark:bg-[#1e40af]/20 border border-[#00288e]/20 dark:border-[#1e40af]/50 flex gap-3 items-start">
            <ShieldCheck size={16} className="text-[#00288e] dark:text-[#a8b8ff] mt-0.5 shrink-0" />
            <div className="text-xs text-[#00288e] dark:text-[#a8b8ff]">
              <div className="font-bold">Store Day LOCKED by {storeDay.locked_by || "Manager"}</div>
              <div className="mt-0.5 font-mono">
                Locked at: {storeDay.locked_at ? new Date(storeDay.locked_at).toLocaleString() : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EOD Cross-Shift Aggregation Report (collapsible) */}
      {showReport && eodReport && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#eceef0] dark:border-[#2d3148] pt-4">

          {/* Pending blockers */}
          {(eodReport.pending_approvals > 0 || eodReport.pending_offline_sync > 0) && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2 items-start text-xs text-red-700 dark:text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                {eodReport.pending_approvals > 0 && (
                  <div>⚠ {eodReport.pending_approvals} approval request(s) still PENDING</div>
                )}
                {eodReport.pending_offline_sync > 0 && (
                  <div>⚠ {eodReport.pending_offline_sync} offline transaction(s) pending sync</div>
                )}
                <div className="text-[10px] mt-0.5 text-red-600 dark:text-red-400">
                  Day close is blocked until these are resolved (or a SYSADMIN force-closes).
                </div>
              </div>
            </div>
          )}

          {/* Store-level totals strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#f0f4ff] dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#2d3148]">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Sales</div>
              <div className="text-base font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] mt-0.5">
                {fmt(eodReport.store_totals.total_sales)}
              </div>
              <div className="text-[10px] text-slate-500">{eodReport.store_totals.total_invoices} invoices</div>
            </div>
            <div className="p-3 rounded-xl bg-[#f0fdf4] dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Banknote size={10} /> Cash
              </div>
              <div className="text-base font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {fmt(eodReport.store_totals.cash_sales)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#eff6ff] dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <CreditCard size={10} /> Card
              </div>
              <div className="text-base font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                {fmt(eodReport.store_totals.card_sales)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#faf5ff] dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <QrCode size={10} /> UPI
              </div>
              <div className="text-base font-mono font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                {fmt(eodReport.store_totals.upi_sales)}
              </div>
            </div>
          </div>

          {/* Cash variance */}
          {(() => {
            const variance = parseFloat(eodReport.store_totals.cash_variance || "0");
            return (
              <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                Math.abs(variance) < 0.01
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
              }`}>
                {Math.abs(variance) < 0.01
                  ? <CheckCircle2 size={14} />
                  : <AlertTriangle size={14} />
                }
                <span>
                  Cross-Shift Cash Variance: <strong>{fmt(variance)}</strong>
                  {Math.abs(variance) < 0.01 ? " — Balanced" : " — Variance detected"}
                </span>
              </div>
            );
          })()}

          {/* Per-shift breakdown */}
          {eodReport.shifts.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[#c4c5d5] dark:border-[#2d3148]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9fa] dark:bg-[#131b2e] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5"><span className="flex items-center gap-1"><Users size={10} /> Cashier</span></th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Total Sales</th>
                    <th className="px-4 py-2.5 text-right">Cash</th>
                    <th className="px-4 py-2.5 text-right">Card</th>
                    <th className="px-4 py-2.5 text-right">UPI</th>
                    <th className="px-4 py-2.5 text-right">Variance</th>
                    <th className="px-4 py-2.5 text-right">Bills</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3148]">
                  {eodReport.shifts.map((s) => {
                    const v = s.cash_variance !== null ? parseFloat(s.cash_variance) : null;
                    return (
                      <tr key={s.shift_id} className="hover:bg-[#f8f9fa] dark:hover:bg-[#1a1f2e]">
                        <td className="px-4 py-2.5 font-mono font-bold">{s.cashier_id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                          {fmt(s.total_sales)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmt(s.cash_sales)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmt(s.card_sales)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmt(s.upi_sales)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${
                          v === null ? "text-slate-400"
                          : Math.abs(v) < 0.01 ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                        }`}>
                          {v !== null ? fmt(v) : "Open"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.total_invoices}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProPosStoreDayPanel;
