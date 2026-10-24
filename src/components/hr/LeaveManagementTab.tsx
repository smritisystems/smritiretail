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
  AlertCircle, BadgeCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, FileText, Loader2, Plus, RefreshCw, Search, Umbrella, UserCheck, XCircle,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

interface LeaveRequest {
  id: string; user_id: string;
  leave_type: "CL" | "SL" | "EL" | "UNPAID";
  start_date: string; end_date: string; total_days: number;
  reason: string | null; status: "PENDING" | "APPROVED" | "REJECTED";
  approver_id: string | null; decision_reason: string | null;
  decided_at: string | null; username?: string; full_name?: string;
}
interface LeaveBalance {
  id: string; user_id: string; leave_year: number; leave_type: string;
  entitled_days: number; used_days: number; pending_days: number;
}
interface PersonnelProfile { id: string; username: string; fullName: string; }

const LEAVE_LABELS: Record<string, string> = {
  CL: "Casual Leave", SL: "Sick Leave", EL: "Earned Leave", UNPAID: "Unpaid Leave",
};
const LEAVE_COLORS: Record<string, string> = {
  CL: "bg-violet-100 text-violet-700", SL: "bg-amber-100 text-amber-700",
  EL: "bg-blue-100 text-blue-700",     UNPAID: "bg-slate-100 text-slate-600",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};
const PAGE_SIZE = 20;
const CURRENT_YEAR = new Date().getFullYear();

function todayISO() { return new Date().toISOString().split("T")[0]; }
function fmtDate(s: string | null) {
  if (!s) return "--";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function daysBetween(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

interface Props {
  currentUser?: { id?: string; role?: string; username?: string; full_name?: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

export const LeaveManagementTab: React.FC<Props> = ({ currentUser, onNotification }) => {
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [balances, setBalances]   = useState<LeaveBalance[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelProfile[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [section, setSection]           = useState<"requests" | "balances" | "apply">("requests");
  const [leaveYear, setLeaveYear]       = useState(CURRENT_YEAR);
  const [applyUserId, setApplyUserId]   = useState("");
  const [applyType, setApplyType]       = useState<"CL" | "SL" | "EL" | "UNPAID">("CL");
  const [applyFrom, setApplyFrom]       = useState(todayISO());
  const [applyTo, setApplyTo]           = useState(todayISO());
  const [applyReason, setApplyReason]   = useState("");
  const [applying, setApplying]         = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<LeaveRequest | null>(null);
  const [decisionChoice, setDecisionChoice] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionReason, setDecisionReason] = useState("");
  const [deciding, setDeciding]             = useState(false);

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

  const loadRequests = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = statusFilter ? `/staff/leave/requests?status=${statusFilter}` : "/staff/leave/requests";
      const d = await apiFetchV1<{ requests: LeaveRequest[]; total: number }>(url, { cache: "no-store" });
      setRequests(Array.isArray(d?.requests) ? d.requests : []);
      setPage(1);
    } catch (e: any) { setError(e?.message ?? "Failed to load leave requests."); }
    finally { setLoading(false); }
  }, [statusFilter]);

  const loadBalances = useCallback(async () => {
    try {
      const d = await apiFetchV1<{ balances: LeaveBalance[] }>(
        `/staff/leave/balances?leave_year=${leaveYear}`, { cache: "no-store" });
      setBalances(Array.isArray(d?.balances) ? d.balances : []);
    } catch { /* non-fatal */ }
  }, [leaveYear]);

  useEffect(() => { loadPersonnel(); }, [loadPersonnel]);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { if (section === "balances") loadBalances(); }, [section, loadBalances]);

  const handleApply = async () => {
    const uid = applyUserId || currentUser?.id || "";
    if (!uid) { notify("Apply Leave", "Select a staff member.", "warning"); return; }
    if (applyFrom > applyTo) { notify("Date Error", "End date cannot be before start date.", "warning"); return; }
    if (!applyReason.trim()) { notify("Reason Required", "Please enter a reason.", "warning"); return; }
    setApplying(true);
    try {
      await apiFetchV1("/staff/leave/requests", { method: "POST",
        body: JSON.stringify({ user_id: uid, leave_type: applyType,
          start_date: applyFrom, end_date: applyTo, reason: applyReason.trim() }) });
      notify("Leave Applied", "Leave request submitted. Pending manager approval.", "success");
      setApplyReason(""); setApplyUserId(""); setApplyFrom(todayISO()); setApplyTo(todayISO());
      setSection("requests"); loadRequests();
    } catch (e: any) { notify("Apply Failed", e?.message ?? "Could not submit leave request.", "error"); }
    finally { setApplying(false); }
  };

  const handleDecide = async () => {
    if (!decisionTarget) return;
    setDeciding(true);
    try {
      await apiFetchV1(`/staff/leave/requests/${decisionTarget.id}/decision`, { method: "PATCH",
        body: JSON.stringify({ status: decisionChoice, decision_reason: decisionReason.trim() || null }) });
      notify(`Leave ${decisionChoice === "APPROVED" ? "Approved" : "Rejected"}`,
        `Request for ${decisionTarget.full_name || decisionTarget.username || decisionTarget.user_id} ${decisionChoice.toLowerCase()}.`,
        decisionChoice === "APPROVED" ? "success" : "info");
      setDecisionTarget(null); setDecisionReason("");
      loadRequests(); loadBalances();
    } catch (e: any) { notify("Decision Failed", e?.message ?? "Could not record the decision.", "error"); }
    finally { setDeciding(false); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return requests;
    return requests.filter(x =>
      (x.full_name ?? "").toLowerCase().includes(q) ||
      (x.username ?? "").toLowerCase().includes(q) ||
      x.leave_type.toLowerCase().includes(q) ||
      x.start_date.includes(q));
  }, [requests, search]);

  const totalPages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged         = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount  = requests.filter(r => r.status === "PENDING").length;
  const approvedCount = requests.filter(r => r.status === "APPROVED").length;
  const rejectedCount = requests.filter(r => r.status === "REJECTED").length;
  const totalDays     = requests.filter(r => r.status === "APPROVED").reduce((s, r) => s + r.total_days, 0);
  const applyDays     = useMemo(() => daysBetween(applyFrom, applyTo), [applyFrom, applyTo]);

  const groupedBalances = useMemo(() => {
    const map: Record<string, LeaveBalance[]> = {};
    for (const b of balances) { map[b.user_id] = map[b.user_id] ?? []; map[b.user_id].push(b); }
    return map;
  }, [balances]);

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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow"><Umbrella size={18} /></div>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white">Leave Management</h1>
            <p className="text-xs text-slate-400">{requests.length} requests · {pendingCount} pending approval</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button id="leave-refresh" onClick={() => { loadRequests(); loadBalances(); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <RefreshCw size={13} /> Refresh
          </button>
          <button id="leave-apply-btn" onClick={() => setSection("apply")}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700">
            <Plus size={13} /> Apply Leave
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 px-6 py-3 sm:grid-cols-4">
        {([
          { label: "Pending",       value: pendingCount,  color: "text-amber-600",   bg: "bg-amber-50" },
          { label: "Approved",      value: approvedCount, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Rejected",      value: rejectedCount, color: "text-red-600",     bg: "bg-red-50" },
          { label: "Days Approved", value: totalDays,     color: "text-indigo-600",  bg: "bg-indigo-50" },
        ] as const).map(k => (
          <div key={k.label} className={`flex flex-col rounded-xl px-4 py-3 ${k.bg}`}>
            <span className={`text-2xl font-black ${k.color}`}>{k.value}</span>
            <span className="mt-0.5 text-xs text-slate-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        {([
          { key: "requests" as const, label: "Leave Requests", Icon: FileText },
          { key: "balances" as const, label: "Leave Balances",  Icon: BadgeCheck },
          { key: "apply"    as const, label: "Apply / New",     Icon: Plus },
        ]).map(t => (
          <button key={t.key} id={`leave-tab-${t.key}`} onClick={() => setSection(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              section === t.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.Icon size={13} /> {t.label}
            {t.key === "requests" && pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
            <Loader2 size={14} className="animate-spin" /> Loading leave data...
          </div>
        )}

        {/* REQUESTS TAB */}
        {section === "requests" && !loading && (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="leave-search" type="text" placeholder="Search employee or leave type…"
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
              </div>
              <select id="leave-status-filter" value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900">
                    {(["Employee","Leave Type","From","To","Days","Reason","Status", isManager ? "Action" : ""] as string[])
                      .filter(Boolean).map(h => <th key={h} className="px-4 py-3 font-semibold text-slate-500">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {paged.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <Umbrella size={32} className="mx-auto mb-2 opacity-30" />
                      No leave requests match the current filters.
                    </td></tr>
                  ) : paged.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{req.full_name || req.username || req.user_id}</div>
                        {req.username && <div className="text-slate-400">@{req.username}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${LEAVE_COLORS[req.leave_type] ?? ""}`}>
                          {LEAVE_LABELS[req.leave_type] ?? req.leave_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{fmtDate(req.start_date)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{fmtDate(req.end_date)}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{req.total_days}</td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="line-clamp-2 text-slate-500" title={req.reason ?? ""}>{req.reason || "--"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[req.status] ?? ""}`}>
                          {req.status === "PENDING" && <Clock size={10} />}
                          {req.status === "APPROVED" && <CheckCircle2 size={10} />}
                          {req.status === "REJECTED" && <XCircle size={10} />}
                          {req.status}
                        </span>
                        {req.decision_reason && (
                          <div className="mt-0.5 text-[10px] text-slate-400 italic line-clamp-1" title={req.decision_reason}>{req.decision_reason}</div>
                        )}
                      </td>
                      {isManager && (
                        <td className="px-4 py-3">
                          {req.status === "PENDING" ? (
                            <div className="flex gap-1.5">
                              <button id={`leave-approve-${req.id}`}
                                onClick={() => { setDecisionTarget(req); setDecisionChoice("APPROVED"); setDecisionReason(""); }}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors">
                                <CheckCircle2 size={11} /> Approve
                              </button>
                              <button id={`leave-reject-${req.id}`}
                                onClick={() => { setDecisionTarget(req); setDecisionChoice("REJECTED"); setDecisionReason(""); }}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition-colors">
                                <XCircle size={11} /> Reject
                              </button>
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <span className="text-xs text-slate-400">{filtered.length} records · Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button id="leave-prev-page" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700"><ChevronLeft size={14} /></button>
                  <button id="leave-next-page" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BALANCES TAB */}
        {section === "balances" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Leave Year</label>
              <select id="leave-year-select" value={leaveYear} onChange={e => setLeaveYear(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {Object.keys(groupedBalances).length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-950">
                <BadgeCheck size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">No leave balance data for {leaveYear}.</p>
                <p className="mt-1 text-xs text-slate-300">Balances auto-create when a staff member first views leave details.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(groupedBalances).map(([uid, bals]) => {
                  const person = personnelMap[uid];
                  return (
                    <div key={uid} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700">
                          {(person?.fullName ?? uid).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{person?.fullName ?? uid}</div>
                          {person && <div className="text-xs text-slate-400">@{person.username}</div>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {bals.map(b => {
                          const remaining = b.entitled_days - b.used_days - b.pending_days;
                          const pct = b.entitled_days > 0 ? Math.round((b.used_days / b.entitled_days) * 100) : 0;
                          return (
                            <div key={b.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEAVE_COLORS[b.leave_type] ?? "bg-slate-100 text-slate-600"}`}>
                                  {LEAVE_LABELS[b.leave_type] ?? b.leave_type}
                                </span>
                                <span className="text-[10px] text-slate-400">{remaining} / {b.entitled_days} left</span>
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-500 mb-1.5">
                                <span>Entitled: <b className="text-slate-700 dark:text-slate-300">{b.entitled_days}</b></span>
                                <span>Used: <b className="text-slate-700 dark:text-slate-300">{b.used_days}</b></span>
                                <span>Pending: <b className="text-amber-600">{b.pending_days}</b></span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* APPLY TAB */}
        {section === "apply" && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Plus size={18} /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white">Apply for Leave</h2>
                  <p className="text-xs text-slate-400">Submit a leave request for manager approval</p>
                </div>
              </div>
              {isManager && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600"><UserCheck size={11} className="mr-1 inline" /> Staff Member</label>
                  <select id="leave-apply-user" value={applyUserId} onChange={e => setApplyUserId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <option value="">— Select employee —</option>
                    {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName} (@{p.username})</option>)}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Leave Type</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["CL","SL","EL","UNPAID"] as const).map(t => (
                    <button key={t} id={`leave-type-${t}`} onClick={() => setApplyType(t)}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all ${applyType === t ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950" : "border-slate-200 text-slate-500 hover:border-indigo-300 dark:border-slate-700"}`}>
                      {t}
                      <div className="mt-0.5 text-[9px] font-normal opacity-70">{LEAVE_LABELS[t]?.split(" ")[0]}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">From Date</label>
                  <input id="leave-apply-from" type="date" value={applyFrom} onChange={e => setApplyFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">To Date</label>
                  <input id="leave-apply-to" type="date" value={applyTo} onChange={e => setApplyTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                </div>
              </div>
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950">
                <CalendarDays size={12} /> {applyDays} day{applyDays !== 1 ? "s" : ""} — {LEAVE_LABELS[applyType]}
              </div>
              <div className="mb-5">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Reason <span className="text-red-500">*</span></label>
                <textarea id="leave-apply-reason" rows={3} value={applyReason} onChange={e => setApplyReason(e.target.value)}
                  placeholder="e.g. Attending a family function from 15–17 Oct."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
              </div>
              <div className="flex gap-3">
                <button id="leave-apply-cancel" onClick={() => setSection("requests")}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700">Cancel</button>
                <button id="leave-apply-submit" disabled={applying || !applyReason.trim()} onClick={handleApply}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Umbrella size={14} />}
                  {applying ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decisionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                {decisionChoice === "APPROVED"
                  ? <><CheckCircle2 size={16} className="mr-1.5 inline text-emerald-600" />Approve Leave</>
                  : <><XCircle size={16} className="mr-1.5 inline text-red-600" />Reject Leave</>}
              </h2>
              <button id="leave-decision-close" onClick={() => setDecisionTarget(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
            </div>
            <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="font-semibold text-slate-500">Employee</span>
                  <div className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">{decisionTarget.full_name || decisionTarget.username}</div>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Leave Type</span>
                  <div className="mt-0.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEAVE_COLORS[decisionTarget.leave_type] ?? ""}`}>{LEAVE_LABELS[decisionTarget.leave_type] ?? decisionTarget.leave_type}</span></div>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Duration</span>
                  <div className="mt-0.5 text-slate-700 dark:text-slate-200">{fmtDate(decisionTarget.start_date)} → {fmtDate(decisionTarget.end_date)}</div>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Days</span>
                  <div className="mt-0.5 text-lg font-black text-slate-700 dark:text-slate-200">{decisionTarget.total_days}</div>
                </div>
                {decisionTarget.reason && (
                  <div className="col-span-2">
                    <span className="font-semibold text-slate-500">Reason</span>
                    <div className="mt-0.5 italic text-slate-600 dark:text-slate-400">{decisionTarget.reason}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="mb-4 flex gap-2">
              <button id="leave-decision-approve-toggle" onClick={() => setDecisionChoice("APPROVED")}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${decisionChoice === "APPROVED" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400 hover:border-emerald-300"}`}>
                <CheckCircle2 size={12} className="mr-1 inline" /> Approve
              </button>
              <button id="leave-decision-reject-toggle" onClick={() => setDecisionChoice("REJECTED")}
                className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${decisionChoice === "REJECTED" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-400 hover:border-red-300"}`}>
                <XCircle size={12} className="mr-1 inline" /> Reject
              </button>
            </div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              {decisionChoice === "REJECTED" ? "Reason for rejection" : "Manager note (optional)"}
              {decisionChoice === "REJECTED" && <span className="text-red-500"> *</span>}
            </label>
            <textarea id="leave-decision-reason" rows={2} value={decisionReason} onChange={e => setDecisionReason(e.target.value)}
              placeholder={decisionChoice === "REJECTED" ? "e.g. Insufficient notice. Please re-apply with 7 days advance." : "e.g. Approved. Enjoy your leave!"}
              className="mb-4 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
            <div className="flex gap-3">
              <button id="leave-decision-cancel" onClick={() => setDecisionTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700">Cancel</button>
              <button id="leave-decision-confirm"
                disabled={deciding || (decisionChoice === "REJECTED" && !decisionReason.trim())}
                onClick={handleDecide}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${decisionChoice === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                {deciding ? <Loader2 size={14} className="animate-spin" /> : decisionChoice === "APPROVED" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {deciding ? "Processing…" : decisionChoice === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagementTab;
