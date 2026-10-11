/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BadgeIndianRupee, ChevronLeft, ChevronRight, CreditCard,
  DollarSign, FileText, IndianRupee, Loader2, RefreshCw, Search,
  TrendingDown, TrendingUp, UserCheck, Wallet,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LedgerEntry {
  id: string;
  participant_id: string;
  participant_role: string;
  transaction_type: "EARNED" | "REVERSED" | "PAID";
  gross_sales_amount: number;
  commission_amount: number;
  reference_invoice_id: string | null;
  reference_return_id: string | null;
  narration: string | null;
  timestamp: string | null;
}

interface CommissionSummary {
  success: boolean;
  user_id: string | null;
  participant_id: string | null;
  period: string;
  transaction_count: number;
  gross_sales: number;
  returned_sales: number;
  net_sales: number;
  earned_commission: number;
  reversed_commission: number;
  paid_commission: number;
  net_commission: number;
  unsettled_commission: number;
  entries: LedgerEntry[];
}

interface PersonnelProfile { id: string; username: string; fullName: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const TX_COLORS: Record<string, string> = {
  EARNED:   "bg-emerald-100 text-emerald-700",
  REVERSED: "bg-red-100 text-red-700",
  PAID:     "bg-blue-100 text-blue-700",
};
const TX_ICONS: Record<string, React.ReactNode> = {
  EARNED:   <TrendingUp size={11} />,
  REVERSED: <TrendingDown size={11} />,
  PAID:     <CreditCard size={11} />,
};
const PAYMENT_MODES = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "WALLET"];
const PAGE_SIZE = 25;
const CURRENT_MONTH = new Date().toISOString().slice(0, 7); // YYYY-MM

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
function fmtTs(ts: string | null) {
  if (!ts) return "--";
  return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  currentUser?: { id?: string; role?: string; username?: string; full_name?: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const CommissionWorkspaceTab: React.FC<Props> = ({ currentUser, onNotification }) => {
  const [summary, setSummary]         = useState<CommissionSummary | null>(null);
  const [personnel, setPersonnel]     = useState<PersonnelProfile[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [section, setSection]         = useState<"ledger" | "settle">("ledger");

  // ── filters
  const [selectedUser, setSelectedUser] = useState("");
  const [period, setPeriod]             = useState(CURRENT_MONTH);
  const [txFilter, setTxFilter]         = useState("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);

  // ── settle form
  const [settleAmt, setSettleAmt]         = useState("");
  const [settleMode, setSettleMode]       = useState("CASH");
  const [settleNotes, setSettleNotes]     = useState("");
  const [settling, setSettling]           = useState(false);
  const [lastPayout, setLastPayout]       = useState<{ ref: string; amount: number; mode: string } | null>(null);

  const isManager = ["SYSADMIN","ADMIN","MANAGER","STORE_MANAGER","BRANCH_ADMIN"]
    .includes((currentUser?.role ?? "").toUpperCase());

  const notify = useCallback(
    (t: string, m: string, type: "success"|"error"|"info"|"warning") => onNotification?.(t, m, type),
    [onNotification]
  );

  const loadPersonnel = useCallback(async () => {
    try { const d = await apiFetchV1<PersonnelProfile[]>("/staff/personnel"); setPersonnel(Array.isArray(d) ? d : []); }
    catch { /* non-fatal */ }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const uid   = isManager ? selectedUser : currentUser?.id ?? "";
      const params = new URLSearchParams();
      if (uid)    params.set("user_id", uid);
      if (period) params.set("period", period);
      const d = await apiFetchV1<CommissionSummary>(`/staff/commissions/summary?${params}`, { cache: "no-store" });
      setSummary(d);
      setPage(1);
    } catch (e: any) { setError(e?.message ?? "Failed to load commission data."); }
    finally { setLoading(false); }
  }, [isManager, selectedUser, period, currentUser]);

  useEffect(() => { loadPersonnel(); }, [loadPersonnel]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleSettle = async () => {
    const uid = isManager ? selectedUser : currentUser?.id ?? "";
    if (!uid && !summary?.participant_id) { notify("Settle", "Select a staff member first.", "warning"); return; }
    if (settleAmt && (isNaN(Number(settleAmt)) || Number(settleAmt) <= 0)) {
      notify("Invalid Amount", "Settle amount must be a positive number.", "warning"); return;
    }
    setSettling(true);
    try {
      const payload: Record<string, unknown> = { payment_mode: settleMode };
      if (uid)         payload.user_id = uid;
      if (summary?.participant_id) payload.participant_id = summary.participant_id;
      if (settleAmt)   payload.amount = Number(settleAmt);
      if (settleNotes.trim()) payload.notes = settleNotes.trim();
      const d = await apiFetchV1<{ payout_ref: string; disbursed_amount: number; remaining_balance: number; message: string }>(
        "/staff/commissions/settle", { method: "POST", body: JSON.stringify(payload) }
      );
      setLastPayout({ ref: d.payout_ref, amount: d.disbursed_amount, mode: settleMode });
      notify("Commission Settled", d.message, "success");
      setSettleAmt(""); setSettleNotes(""); setSection("ledger");
      loadSummary();
    } catch (e: any) { notify("Settlement Failed", e?.message ?? "Could not process the payout.", "error"); }
    finally { setSettling(false); }
  };

  // ── derived
  const filteredEntries = useMemo(() => {
    let e = summary?.entries ?? [];
    if (txFilter) e = e.filter(x => x.transaction_type === txFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      e = e.filter(x =>
        (x.reference_invoice_id ?? "").toLowerCase().includes(q) ||
        (x.narration ?? "").toLowerCase().includes(q) ||
        x.transaction_type.toLowerCase().includes(q)
      );
    }
    return e;
  }, [summary, txFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paged      = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasBalance = (summary?.unsettled_commission ?? 0) > 0;

  const personnelMap = useMemo(() => {
    const m: Record<string, PersonnelProfile> = {};
    for (const p of personnel) m[p.id] = p;
    return m;
  }, [personnel]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
            <BadgeIndianRupee size={18} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white">Commission Workspace</h1>
            <p className="text-xs text-slate-400">
              {summary ? `${summary.transaction_count} ledger entries · Period: ${summary.period}` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button id="commission-refresh" onClick={loadSummary}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <RefreshCw size={13} /> Refresh
          </button>
          {isManager && hasBalance && (
            <button id="commission-settle-btn" onClick={() => setSection("settle")}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700">
              <Wallet size={13} /> Settle Payout
            </button>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        {isManager && (
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} className="text-slate-400" />
            <select id="commission-user-filter" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="">All Staff</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName} (@{p.username})</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">Period</span>
          <input id="commission-period" type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 px-6 py-3 sm:grid-cols-4 lg:grid-cols-4">
        {([
          { label: "Gross Sales",       value: inr(summary?.gross_sales ?? 0),       color: "text-slate-700",   bg: "bg-white",        icon: <TrendingUp size={14} className="text-slate-400" /> },
          { label: "Net Commission",    value: inr(summary?.net_commission ?? 0),     color: "text-emerald-700", bg: "bg-emerald-50",   icon: <IndianRupee size={14} className="text-emerald-500" /> },
          { label: "Already Paid",      value: inr(summary?.paid_commission ?? 0),    color: "text-blue-700",    bg: "bg-blue-50",      icon: <CreditCard size={14} className="text-blue-400" /> },
          { label: "Unsettled Balance", value: inr(summary?.unsettled_commission ?? 0), color: hasBalance ? "text-amber-700" : "text-slate-400", bg: hasBalance ? "bg-amber-50" : "bg-slate-50", icon: <Wallet size={14} className={hasBalance ? "text-amber-500" : "text-slate-300"} /> },
        ] as const).map(k => (
          <div key={k.label} className={`flex flex-col rounded-xl px-4 py-3 ${k.bg} border border-slate-100`}>
            <div className="mb-1 flex items-center gap-1.5">{k.icon}<span className="text-[10px] font-semibold text-slate-400">{k.label}</span></div>
            <span className={`text-lg font-black ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        {([
          { key: "ledger" as const, label: "Commission Ledger", Icon: FileText },
          { key: "settle" as const, label: "Settle / Disburse",  Icon: Wallet  },
        ]).map(t => (
          <button key={t.key} id={`commission-tab-${t.key}`} onClick={() => setSection(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              section === t.key ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            <t.Icon size={13} /> {t.label}
            {t.key === "settle" && hasBalance && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">!</span>
            )}
          </button>
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Loading commission data…
          </div>
        )}

        {/* ── LEDGER section ── */}
        {section === "ledger" && !loading && (
          <div>
            {/* ledger sub-filters */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                <Search size={12} className="text-slate-400" />
                <input id="commission-search" placeholder="Search invoice / narration…" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-48 bg-transparent text-xs outline-none dark:text-slate-200" />
              </div>
              <select id="commission-tx-filter" value={txFilter} onChange={e => { setTxFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">All Types</option>
                <option value="EARNED">EARNED</option>
                <option value="REVERSED">REVERSED</option>
                <option value="PAID">PAID</option>
              </select>
              <span className="text-xs text-slate-400">{filteredEntries.length} entries</span>
            </div>

            {/* table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    {["Date & Time","Type","Role","Invoice","Sales Amount","Commission","Narration"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <DollarSign size={22} className="mx-auto mb-2 opacity-25" />
                        No commission entries match your filters.
                      </td>
                    </tr>
                  ) : paged.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtTs(e.timestamp)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${TX_COLORS[e.transaction_type] ?? "bg-slate-100 text-slate-600"}`}>
                          {TX_ICONS[e.transaction_type]} {e.transaction_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{e.participant_role}</td>
                      <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                        {e.reference_invoice_id ?? e.reference_return_id ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${e.gross_sales_amount >= 0 ? "text-slate-700" : "text-red-600"}`}>
                        {inr(e.gross_sales_amount)}
                      </td>
                      <td className={`px-3 py-2 text-right font-black ${e.commission_amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {inr(e.commission_amount)}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-slate-400" title={e.narration ?? ""}>
                        {e.narration ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button id="commission-prev" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-lg border px-2 py-1 disabled:opacity-40 hover:bg-slate-100">
                    <ChevronLeft size={13} />
                  </button>
                  <button id="commission-next" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="rounded-lg border px-2 py-1 disabled:opacity-40 hover:bg-slate-100">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* last payout notice */}
            {lastPayout && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CreditCard size={15} />
                <span>
                  Last payout <strong>{inr(lastPayout.amount)}</strong> via <strong>{lastPayout.mode}</strong>
                  &nbsp;— Ref: <span className="font-mono">{lastPayout.ref}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── SETTLE section ── */}
        {section === "settle" && !loading && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow">
                  <Wallet size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">Disburse Commission Payout</h2>
                  <p className="text-xs text-slate-400">Creates an immutable PAID ledger entry against the accrued balance.</p>
                </div>
              </div>

              {/* Balance summary card */}
              <div className="mb-5 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700">Unsettled Balance</span>
                  <span className="text-xl font-black text-amber-700">{inr(summary?.unsettled_commission ?? 0)}</span>
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-amber-600">
                  <span>Earned: {inr(summary?.earned_commission ?? 0)}</span>
                  <span>Reversed: −{inr(summary?.reversed_commission ?? 0)}</span>
                  <span>Already Paid: −{inr(summary?.paid_commission ?? 0)}</span>
                </div>
              </div>

              {!isManager ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                  <AlertCircle size={14} /> Only Store Managers and Administrators may disburse commissions.
                </div>
              ) : !hasBalance ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                  <AlertCircle size={14} /> No positive balance available to settle.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Payout Amount <span className="font-normal text-slate-400">(leave blank to settle full balance)</span>
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-emerald-400 dark:border-slate-700">
                      <IndianRupee size={13} className="text-slate-400" />
                      <input id="commission-settle-amount" type="number" min="1" step="0.01"
                        placeholder={`Max ${inr(summary?.unsettled_commission ?? 0)}`}
                        value={settleAmt} onChange={e => setSettleAmt(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none dark:text-slate-200" />
                    </div>
                  </div>

                  {/* Payment mode */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Payment Mode</label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_MODES.map(m => (
                        <button key={m} id={`commission-mode-${m}`}
                          onClick={() => setSettleMode(m)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            settleMode === m
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                          }`}>
                          {m.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Notes <span className="font-normal text-slate-400">(optional)</span></label>
                    <textarea id="commission-settle-notes" rows={2} value={settleNotes} onChange={e => setSettleNotes(e.target.value)}
                      placeholder="Salary slip reference, bank UTR, etc."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
                  </div>

                  <button id="commission-settle-confirm" onClick={handleSettle} disabled={settling}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white shadow hover:bg-emerald-700 disabled:opacity-60">
                    {settling ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                    {settling ? "Processing Payout…" : `Disburse ${settleAmt ? inr(Number(settleAmt)) : "Full Balance"} via ${settleMode.replace("_"," ")}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionWorkspaceTab;
