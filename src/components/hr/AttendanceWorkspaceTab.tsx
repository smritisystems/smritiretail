/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.3.0
 * Created      : 2026-10-11
 * Modified     : 2026-10-14
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v1.3.0 (2026-10-14):
 *   - Added Form II Statutory Muster Roll 1..31 horizontal matrix with CSV export and print.
 *   - Added Payroll & Daily Wage reconciliation sheet with LOP deduction and statement freeze.
 *   - Added WEEKLY_OFF status badge support.
 *
 * Changelog v1.2.0 (2026-10-12):
 *   - Unified /staff/personnel and /staff/directory in loadPersonnel so all company staff are selectable.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BadgeCheck, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Clock, Loader2, Pencil, RefreshCw,
  Search, Shield, UserCheck, UserMinus, Users, XCircle,
  Download, FileSpreadsheet, Lock, Printer, DollarSign, Calculator,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

// Types
interface AttendanceRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | "WEEKLY_OFF";
  check_in_at: string | null;
  check_out_at: string | null;
  register_source: string | null;
  device_source: string | null;
  correction_status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  correction_reason: string | null;
  branch_source_id: string | null;
  username?: string;
  full_name?: string;
}
interface PersonnelProfile { id: string; username: string; fullName: string; }
interface BranchOption { id: string; name: string; code: string; }

const STATUS_COLORS: Record<string, string> = {
  PRESENT:    "bg-emerald-100 text-emerald-700",
  LATE:       "bg-amber-100 text-amber-700",
  ABSENT:     "bg-red-100 text-red-700",
  HALF_DAY:   "bg-violet-100 text-violet-700",
  LEAVE:      "bg-blue-100 text-blue-700",
  HOLIDAY:    "bg-slate-100 text-slate-600",
  WEEKLY_OFF: "bg-teal-100 text-teal-700",
};
const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present", LATE: "Late", ABSENT: "Absent",
  HALF_DAY: "Half Day", LEAVE: "On Leave", HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly Off",
};
const MUSTER_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  P:  { bg: "bg-emerald-100", text: "text-emerald-700", label: "Present" },
  L:  { bg: "bg-amber-100",   text: "text-amber-700",   label: "Late" },
  HD: { bg: "bg-violet-100",  text: "text-violet-700",  label: "Half Day" },
  A:  { bg: "bg-red-100",     text: "text-red-700",     label: "Absent" },
  LV: { bg: "bg-blue-100",    text: "text-blue-700",    label: "Leave" },
  WO: { bg: "bg-teal-100",    text: "text-teal-700",    label: "Weekly Off" },
  H:  { bg: "bg-slate-200",   text: "text-slate-700",   label: "Holiday" },
  "-":{ bg: "bg-slate-50",    text: "text-slate-400",   label: "Unrecorded" },
};
const PAGE_SIZE = 25;

function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtTime(iso: string | null): string {
  if (!iso) return "--";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
  catch { return iso; }
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export interface AttendanceWorkspaceTabProps {
  currentUser?: { role: string; name: string; id?: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
  initialSection?: "register" | "muster_roll" | "wages" | "corrections" | "summary";
}

export const AttendanceWorkspaceTab: React.FC<AttendanceWorkspaceTabProps> = ({
  currentUser,
  onNotification,
  initialSection = "register",
}) => {
  const [records, setRecords]       = useState<AttendanceRecord[]>([]);
  const [personnel, setPersonnel]   = useState<PersonnelProfile[]>([]);
  const [branches, setBranches]     = useState<BranchOption[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fromDate, setFromDate]     = useState(firstOfMonth());
  const [toDate, setToDate]         = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [punchUserId, setPunchUserId] = useState("");
  const [punchType, setPunchType]   = useState<"AUTO" | "IN" | "OUT">("AUTO");
  const [punching, setPunching]     = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDate, setBulkDate]     = useState(todayISO());
  const [bulkStatus, setBulkStatus] = useState<"HOLIDAY" | "ABSENT">("HOLIDAY");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [section, setSection]       = useState<"register" | "muster_roll" | "wages" | "corrections" | "summary">(initialSection);
  const [corrections, setCorrections] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);
  // R-12: correction request modal
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);

  // Muster Roll & Wages State
  const [musterPeriod, setMusterPeriod] = useState(firstOfMonth().slice(0, 7));
  const [musterData, setMusterData] = useState<any>(null);
  const [musterLoading, setMusterLoading] = useState(false);

  const [wagePeriod, setWagePeriod] = useState(firstOfMonth().slice(0, 7));
  const [wagesList, setWagesList] = useState<any[]>([]);
  const [wagesLoading, setWagesLoading] = useState(false);
  const [finalizingUserId, setFinalizingUserId] = useState<string | null>(null);

  const notify = useCallback((t: string, m: string, type: "success" | "error" | "info" | "warning") => {
    onNotification?.(t, m, type);
  }, [onNotification]);

  const loadPersonnel = useCallback(async () => {
    try {
      const [pRes, dirRes] = await Promise.all([
        apiFetchV1<PersonnelProfile[]>("/staff/personnel").catch(() => []),
        apiFetchV1<{ users?: any[]; items?: any[] }>("/staff/directory").catch(() => ({ users: [] })),
      ]);
      const list: PersonnelProfile[] = [];
      const seen = new Set<string>();

      const rawP = Array.isArray(pRes) ? pRes : (pRes as any)?.users || [];
      for (const p of rawP) {
        const uid = p.id || (p as any).user_id;
        if (uid && !seen.has(uid)) {
          seen.add(uid);
          list.push({
            id: uid,
            username: (p as any).username || (p as any).code || uid,
            fullName: (p as any).fullName || (p as any).full_name || (p as any).person_name || "Staff Member",
          });
        }
      }

      const rawD = Array.isArray(dirRes) ? dirRes : (dirRes as any)?.users || (dirRes as any)?.items || [];
      for (const d of rawD) {
        const uid = d.id || d.user_id;
        if (uid && !seen.has(uid)) {
          seen.add(uid);
          list.push({
            id: uid,
            username: d.username || d.employeeCode || uid,
            fullName: d.fullName || d.full_name || d.name || "Staff Member",
          });
        }
      }

      setPersonnel(list);
    } catch { /* non-fatal */ }
  }, []);

  const loadBranches = useCallback(async () => {
    try { const d = await apiFetchV1<{ branches: BranchOption[] }>("/branches"); setBranches(Array.isArray(d?.branches) ? d.branches : []); }
    catch { /* non-fatal */ }
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `/staff/attendance?from_date=${fromDate}&to_date=${toDate}`;
      if (branchFilter) url += `&branch_id=${branchFilter}`;
      const d = await apiFetchV1<{ records: AttendanceRecord[] }>(url, { cache: "no-store" });
      const recs = Array.isArray(d?.records) ? d.records : [];
      setRecords(recs);
      setCorrections(recs.filter(r => r.correction_status === "PENDING"));
      setPage(1);
    } catch (e: any) { setError(e?.message || "Failed to load attendance records."); }
    finally { setLoading(false); }
  }, [fromDate, toDate, branchFilter]);

  useEffect(() => { loadPersonnel(); loadBranches(); }, [loadPersonnel, loadBranches]);
  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const handlePunch = async () => {
    if (!punchUserId) { notify("Punch Error", "Select a staff member first.", "warning"); return; }
    setPunching(true);
    try {
      const res = await apiFetchV1<{ success: boolean; action: string; message: string }>(
        "/staff/attendance/punch",
        { method: "POST", body: JSON.stringify({ user_id: punchUserId, punch_type: punchType, device_source: "WEB_PORTAL" }) }
      );
      if (res?.success) { notify("Punch Recorded", `${(res.action || "").replace(/_/g, " ")} -- ${res.message || ""}`, "success"); loadAttendance(); }
      else notify("Punch Failed", res?.message || "Unexpected response.", "error");
    } catch (e: any) { notify("Punch Error", e?.message || "Could not record punch.", "error"); }
    finally { setPunching(false); }
  };

  const handleBulkMark = async () => {
    if (!bulkSelected.length) { notify("Bulk Mark", "Select at least one staff member.", "warning"); return; }
    setBulkSubmitting(true);
    try {
      const payload = bulkSelected.map(uid => ({ user_id: uid, attendance_date: bulkDate, status: bulkStatus, register_source: "MANAGER_BULK" }));
      const res = await apiFetchV1<{ success: boolean; created: number; skipped: number; errors: number }>(
        "/staff/attendance/bulk", { method: "POST", body: JSON.stringify(payload) }
      );
      notify("Bulk Mark Complete", `Created: ${res?.created ?? 0} | Skipped: ${res?.skipped ?? 0} | Errors: ${res?.errors ?? 0}`, res?.errors ? "warning" : "success");
      setShowBulkModal(false); setBulkSelected([]); loadAttendance();
    } catch (e: any) { notify("Bulk Mark Failed", e?.message || "Could not complete bulk marking.", "error"); }
    finally { setBulkSubmitting(false); }
  };

  const handleCorrectionDecision = async (id: string, decision: "APPROVED" | "REJECTED") => {
    try {
      await apiFetchV1(`/staff/attendance/${id}/correction`, { method: "PATCH", body: JSON.stringify({ correction_status: decision }) });
      notify("Correction " + decision.toLowerCase(), `Record ${decision.toLowerCase()} successfully.`, "success");
      loadAttendance();
    } catch (e: any) { notify("Decision Failed", e?.message || "Could not update correction.", "error"); }
  };

  const handleRequestCorrection = async () => {
    if (!correctionTarget) return;
    if (!correctionReason.trim()) { notify("Reason Required", "Please enter a reason for the correction request.", "warning"); return; }
    setCorrectionSubmitting(true);
    try {
      await apiFetchV1(`/staff/attendance/${correctionTarget.id}/correction`, {
        method: "PATCH",
        body: JSON.stringify({ correction_status: "PENDING", correction_reason: correctionReason.trim() }),
      });
      notify("Request Submitted", "Your correction request has been submitted for manager review.", "success");
      setCorrectionTarget(null);
      setCorrectionReason("");
      loadAttendance();
    } catch (e: any) { notify("Request Failed", e?.message || "Could not submit correction request.", "error"); }
  };

  const loadMusterRoll = useCallback(async () => {
    setMusterLoading(true);
    try {
      const q = new URLSearchParams({ period: musterPeriod });
      if (branchFilter) q.set("branch_id", branchFilter);
      const res = await apiFetchV1<any>(`/staff/attendance/muster-roll?${q.toString()}`);
      setMusterData(res);
    } catch (e: any) {
      notify("Muster Roll Error", e?.message || "Failed to load muster roll matrix.", "error");
    } finally {
      setMusterLoading(false);
    }
  }, [musterPeriod, branchFilter, notify]);

  const loadWages = useCallback(async () => {
    setWagesLoading(true);
    try {
      const res = await apiFetchV1<any>("/staff/wages/calculate", {
        method: "POST",
        body: JSON.stringify({ period: wagePeriod }),
      });
      setWagesList(res?.wages || []);
    } catch (e: any) {
      notify("Payroll Error", e?.message || "Failed to calculate wages.", "error");
    } finally {
      setWagesLoading(false);
    }
  }, [wagePeriod, notify]);

  const handleFinalizeWage = async (userId: string) => {
    setFinalizingUserId(userId);
    try {
      await apiFetchV1("/staff/wages/finalize", {
        method: "POST",
        body: JSON.stringify({ period: wagePeriod, user_id: userId }),
      });
      notify("Finalized", "Payroll statement frozen successfully.", "success");
      await loadWages();
    } catch (e: any) {
      notify("Finalization Error", e?.message || "Failed to finalize wage statement.", "error");
    } finally {
      setFinalizingUserId(null);
    }
  };

  const handleExportMusterCsv = () => {
    const q = new URLSearchParams({ period: musterPeriod });
    if (branchFilter) q.set("branch_id", branchFilter);
    window.open(`/api/v1/staff/attendance/muster-roll/export-csv?${q.toString()}`, "_blank");
  };

  useEffect(() => {
    if (section === "muster_roll") {
      loadMusterRoll();
    }
  }, [section, loadMusterRoll]);

  useEffect(() => {
    if (section === "wages") {
      loadWages();
    }
  }, [section, loadWages]);

  const filtered = useMemo(() => {
    let r = records;
    if (statusFilter) r = r.filter(x => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => (x.username || "").toLowerCase().includes(q) || (x.full_name || "").toLowerCase().includes(q) || x.attendance_date.includes(q));
    }
    return r;
  }, [records, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const summary = useMemo(() => ({
    present: records.filter(r => r.status === "PRESENT").length,
    late:    records.filter(r => r.status === "LATE").length,
    absent:  records.filter(r => r.status === "ABSENT").length,
    halfDay: records.filter(r => r.status === "HALF_DAY").length,
    leave:   records.filter(r => r.status === "LEAVE").length,
    holiday: records.filter(r => r.status === "HOLIDAY").length,
    total:   records.length,
  }), [records]);

  const isManager = ["SYSADMIN", "ADMIN", "MANAGER", "STORE_MANAGER", "BRANCH_ADMIN"].includes((currentUser?.role || "").toUpperCase());

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-600">
            <CalendarDays size={14} /> Attendance Register
          </div>
          <h1 className="mt-0.5 text-xl font-black text-slate-900 dark:text-white">Staff Attendance Workspace</h1>
          <p className="mt-0.5 text-xs text-slate-500">Daily register &middot; Punch console &middot; Bulk marking &middot; Correction queue</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button id="att-bulk-mark-btn" onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors">
              <Users size={14} /> Bulk Mark
            </button>
          )}
          <button id="att-refresh-btn" onClick={loadAttendance}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
        {(["register", "muster_roll", "wages", "corrections", "summary"] as const).map(s => (
          <button key={s} id={`att-section-${s}`} onClick={() => setSection(s)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold capitalize transition-colors ${section === s ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {s === "muster_roll" ? "Muster Roll (Form II)" : s === "wages" ? "Payroll & Wages" : s === "corrections" ? `Corrections${corrections.length ? ` (${corrections.length})` : ""}` : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Filter bar (shown for register, corrections, summary) */}
      {section !== "muster_roll" && section !== "wages" && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            <CalendarDays size={12} className="text-slate-400" />
            <input id="att-from-date" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-transparent outline-none text-xs" />
            <span className="text-slate-400">to</span>
            <input id="att-to-date" type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-transparent outline-none text-xs" />
          </div>
          {branches.length > 0 && (
            <select id="att-branch-filter" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
          )}
          <select id="att-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <Search size={12} className="text-slate-400" />
            <input id="att-search" type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none" />
            {search && <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><XCircle size={12} /></button>}
          </div>
        </div>
      )}

      {/* KPI bar (shown for register, corrections, summary) */}
      {section !== "muster_roll" && section !== "wages" && (
        <div className="grid grid-cols-3 gap-3 px-6 py-3 sm:grid-cols-6">
          {[
            { label: "Present",  value: summary.present,  color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Late",     value: summary.late,     color: "text-amber-600",   bg: "bg-amber-50" },
            { label: "Absent",   value: summary.absent,   color: "text-red-600",     bg: "bg-red-50" },
            { label: "Half Day", value: summary.halfDay,  color: "text-violet-600",  bg: "bg-violet-50" },
            { label: "Leave",    value: summary.leave,    color: "text-blue-600",    bg: "bg-blue-50" },
            { label: "Holiday",  value: summary.holiday,  color: "text-slate-600",   bg: "bg-slate-100" },
          ].map(k => (
            <div key={k.label} className={`flex flex-col rounded-xl px-4 py-3 ${k.bg}`}>
              <span className={`text-2xl font-black ${k.color}`}>{k.value}</span>
              <span className="mt-0.5 text-xs text-slate-500">{k.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 gap-4 overflow-hidden px-6 pb-6">
        {/* DataTable / Sections */}
        <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          {error && (
            <div className="flex items-center gap-2 rounded-t-xl border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Loading records...
            </div>
          )}

          {/* Register */}
          {section === "register" && !loading && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-900">
                      {["Date", "Employee", "Status", "Clock In", "Clock Out", "Source", "Correction"].map(h => (
                        <th key={h} className="px-4 py-3 font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {paged.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
                        No attendance records for the selected filters.
                      </td></tr>
                    ) : paged.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{fmtDate(rec.attendance_date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{rec.full_name || rec.username || rec.user_id}</div>
                          {rec.username && <div className="text-slate-400">@{rec.username}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[rec.status] || ""}`}>
                            {STATUS_LABELS[rec.status] || rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{fmtTime(rec.check_in_at)}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{fmtTime(rec.check_out_at)}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[100px] truncate" title={rec.device_source || rec.register_source || ""}>
                          {rec.device_source || rec.register_source || "--"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {rec.correction_status === "PENDING" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                <Clock size={10} /> Pending review
                              </span>
                            )}
                            {rec.correction_status === "APPROVED" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={10} /> Approved
                              </span>
                            )}
                            {rec.correction_status === "REJECTED" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                <XCircle size={10} /> Rejected
                              </span>
                            )}
                            {rec.correction_status === "NONE" && (
                              <button
                                id={`att-req-correction-${rec.id}`}
                                onClick={() => { setCorrectionTarget(rec); setCorrectionReason(""); }}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                title="Request a correction for this attendance record"
                              >
                                <Pencil size={10} /> Request Fix
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-400">{filtered.length} records · Page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button id="att-prev-page" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700">
                      <ChevronLeft size={14} />
                    </button>
                    <button id="att-next-page" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                      className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Corrections */}
          {section === "corrections" && (
            <div className="p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-700">Pending Corrections {corrections.length ? `(${corrections.length})` : ""}</h3>
              {corrections.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" /> No pending corrections.
                </div>
              ) : corrections.map(rec => (
                <div key={rec.id} className="mb-2 flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{rec.full_name || rec.username || rec.user_id} &middot; {fmtDate(rec.attendance_date)}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Status: <span className="font-semibold">{STATUS_LABELS[rec.status]}</span>
                      {rec.correction_reason && <> &middot; &ldquo;{rec.correction_reason}&rdquo;</>}
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex gap-2">
                      <button id={`att-approve-${rec.id}`} onClick={() => handleCorrectionDecision(rec.id, "APPROVED")}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button id={`att-reject-${rec.id}`} onClick={() => handleCorrectionDecision(rec.id, "REJECTED")}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {section === "summary" && (
            <div className="p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-700">Attendance Summary &middot; {fromDate} to {toDate}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { label: "Total Records", value: summary.total,   icon: <Users size={18} /> },
                  { label: "Present",       value: summary.present, icon: <UserCheck size={18} className="text-emerald-500" /> },
                  { label: "Late Arrivals", value: summary.late,    icon: <Clock size={18} className="text-amber-500" /> },
                  { label: "Absent",        value: summary.absent,  icon: <UserMinus size={18} className="text-red-500" /> },
                  { label: "Half Days",     value: summary.halfDay, icon: <Shield size={18} className="text-violet-500" /> },
                  { label: "On Leave",      value: summary.leave,   icon: <BadgeCheck size={18} className="text-blue-500" /> },
                ].map(s => (
                  <div key={s.label} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 text-slate-400">{s.icon}</div>
                    <div className="text-3xl font-black text-slate-800">{s.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Muster Roll (Form II) */}
          {section === "muster_roll" && (
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Period:</label>
                  <input
                    id="att-muster-period"
                    type="month"
                    value={musterPeriod}
                    onChange={e => setMusterPeriod(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    id="att-muster-refresh"
                    onClick={loadMusterRoll}
                    disabled={musterLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <RefreshCw size={12} className={musterLoading ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="att-muster-export-csv"
                    onClick={handleExportMusterCsv}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <FileSpreadsheet size={13} /> Export Form II CSV
                  </button>
                  <button
                    id="att-muster-print"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Printer size={13} /> Print
                  </button>
                </div>
              </div>

              {/* Form II Header Subtitle */}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div><span className="font-bold text-slate-700 dark:text-slate-200">Form II Statutory Muster Roll (Rule 27(1))</span> &middot; {musterData?.total_employees || 0} Employees Recorded</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> P (Present)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> L (Late)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500"></span> HD (Half)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"></span> A (Absent)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500"></span> WO (Off)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> LV (Leave)</span>
                </div>
              </div>

              {musterLoading ? (
                <div className="flex flex-1 items-center justify-center py-16 text-xs text-slate-400">
                  <Loader2 size={24} className="mr-2 animate-spin text-indigo-600" /> Generating Muster Roll Matrix...
                </div>
              ) : (
                <div className="flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <th className="sticky left-0 top-0 z-30 min-w-[150px] border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold shadow-xs dark:border-slate-800 dark:bg-slate-900">Employee</th>
                        <th className="min-w-[80px] border-r border-slate-200 px-2 py-2 text-left font-semibold dark:border-slate-800">Dept</th>
                        {Array.from({ length: musterData?.days_in_month || 31 }, (_, i) => i + 1).map(d => (
                          <th key={d} className="min-w-[28px] border-r border-slate-200 px-1 py-1 font-bold dark:border-slate-800">{d}</th>
                        ))}
                        <th className="min-w-[36px] border-r border-slate-200 px-1.5 py-1 font-bold text-emerald-700">P</th>
                        <th className="min-w-[36px] border-r border-slate-200 px-1.5 py-1 font-bold text-violet-700">HD</th>
                        <th className="min-w-[36px] border-r border-slate-200 px-1.5 py-1 font-bold text-red-700">A</th>
                        <th className="min-w-[36px] border-r border-slate-200 px-1.5 py-1 font-bold text-blue-700">LV</th>
                        <th className="min-w-[36px] border-r border-slate-200 px-1.5 py-1 font-bold text-teal-700">WO</th>
                        <th className="min-w-[44px] border-r border-slate-200 px-1.5 py-1 font-bold text-indigo-700">OT (h)</th>
                        <th className="min-w-[50px] bg-indigo-50 px-2 py-1 font-black text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(!musterData?.rows || musterData.rows.length === 0) ? (
                        <tr><td colSpan={42} className="py-12 text-center text-slate-400">No muster roll records found.</td></tr>
                      ) : (
                        musterData.rows.map((row: any) => {
                          const s = row.summary || {};
                          return (
                            <tr key={row.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="sticky left-0 z-10 min-w-[150px] border-r border-slate-200 bg-white px-3 py-2 text-left shadow-xs dark:border-slate-800 dark:bg-slate-950">
                                <div className="font-bold text-slate-800 dark:text-white truncate max-w-[140px]">{row.full_name}</div>
                                <div className="font-mono text-[10px] text-slate-400">{row.employee_code}</div>
                              </td>
                              <td className="border-r border-slate-200 px-2 py-2 text-left text-[11px] text-slate-500 truncate max-w-[80px] dark:border-slate-800">
                                {row.department}
                              </td>
                              {Array.from({ length: musterData.days_in_month || 31 }, (_, i) => i + 1).map(d => {
                                const dayInfo = row.days?.[String(d)] || { code: "-" };
                                const badge = MUSTER_BADGES[dayInfo.code] || MUSTER_BADGES["-"];
                                return (
                                  <td key={d} className="border-r border-slate-100 p-0.5 dark:border-slate-800" title={`${row.full_name} Day ${d}: ${dayInfo.status || ""}${dayInfo.clock_in ? ` (${dayInfo.clock_in} - ${dayInfo.clock_out})` : ""}`}>
                                    <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                      {dayInfo.code}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-emerald-700 dark:border-slate-800">{s.present_days || 0}</td>
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-violet-700 dark:border-slate-800">{s.half_days || 0}</td>
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-red-700 dark:border-slate-800">{s.absent_days || 0}</td>
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-blue-700 dark:border-slate-800">{s.paid_leave_days || 0}</td>
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-teal-700 dark:border-slate-800">{s.weekly_off_days || 0}</td>
                              <td className="border-r border-slate-200 px-1.5 py-1 font-bold text-indigo-700 dark:border-slate-800">{s.total_overtime_hours || 0}</td>
                              <td className="bg-indigo-50/50 px-2 py-1 font-black text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">{s.effective_payable_days || 0}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Wages / Payroll Sheet */}
          {section === "wages" && (
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Payroll Period:</label>
                  <input
                    id="att-wage-period"
                    type="month"
                    value={wagePeriod}
                    onChange={e => setWagePeriod(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    id="att-wages-recalc"
                    onClick={loadWages}
                    disabled={wagesLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <RefreshCw size={12} className={wagesLoading ? "animate-spin" : ""} /> Recalculate
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <Printer size={13} /> Print Statement
                  </button>
                </div>
              </div>

              <div className="mb-2 text-xs text-slate-500">
                Authoritative Wage & Salary Statements &middot; Loss of Pay (LOP) & Casual Daily Wage Reconciliation
              </div>

              {wagesLoading ? (
                <div className="flex flex-1 items-center justify-center py-16 text-xs text-slate-400">
                  <Loader2 size={24} className="mr-2 animate-spin text-indigo-600" /> Computing Period Wages...
                </div>
              ) : (
                <div className="flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <th className="sticky left-0 top-0 z-30 min-w-[150px] border-r border-slate-200 bg-slate-100 px-3 py-2.5 font-bold shadow-xs dark:border-slate-800 dark:bg-slate-900">Employee</th>
                        <th className="px-2 py-2.5 font-semibold">Type</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Base Rate</th>
                        <th className="px-2 py-2.5 font-semibold text-center">Working / Present</th>
                        <th className="px-2 py-2.5 font-semibold text-right text-red-600">LOP Deduct</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Overtime</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Allowances</th>
                        <th className="px-2 py-2.5 font-semibold text-right">Commissions</th>
                        <th className="px-2 py-2.5 font-bold text-right text-emerald-700">Net Payable</th>
                        <th className="px-2 py-2.5 font-semibold text-center">Status</th>
                        {isManager && <th className="px-3 py-2.5 font-semibold text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {wagesList.length === 0 ? (
                        <tr><td colSpan={11} className="py-12 text-center text-slate-400">No wage statements calculated.</td></tr>
                      ) : (
                        wagesList.map((w: any) => (
                          <tr key={w.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                            <td className="sticky left-0 z-10 min-w-[150px] border-r border-slate-200 bg-white px-3 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                              <div className="font-bold text-slate-800 dark:text-white truncate max-w-[140px]">{w.employee_name}</div>
                              <div className="font-mono text-[10px] text-slate-400">{w.employee_code} &middot; {w.designation}</div>
                            </td>
                            <td className="px-2 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${w.wage_type === "DAILY" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                                {w.wage_type}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono">
                              ₹{w.base_rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              <div className="text-[10px] text-slate-400">{w.wage_type === "DAILY" ? "/ day" : "/ mo"}</div>
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">
                              <div>{w.present_days + 0.5 * w.half_days} / {w.working_days} d</div>
                              {w.half_days > 0 && <span className="text-[10px] text-violet-600">({w.half_days} HD)</span>}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-red-600">
                              {w.lop_deduction > 0 ? `-₹${w.lop_deduction.toFixed(2)}` : "--"}
                              {w.lop_days > 0 && <div className="text-[10px] text-slate-400">({w.lop_days}d LOP)</div>}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono">
                              {w.overtime_earnings > 0 ? `+₹${w.overtime_earnings.toFixed(2)}` : "--"}
                              {w.overtime_hours > 0 && <div className="text-[10px] text-slate-400">({w.overtime_hours}h)</div>}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                              {w.allowances_amount > 0 ? `₹${w.allowances_amount.toFixed(2)}` : "--"}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                              {w.commission_amount > 0 ? `₹${w.commission_amount.toFixed(2)}` : "--"}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-sm font-black text-emerald-600">
                              ₹{w.net_wages.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${w.is_finalized ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                {w.is_finalized ? <><Lock size={9} /> Frozen</> : "Draft"}
                              </span>
                            </td>
                            {isManager && (
                              <td className="px-3 py-2.5 text-center">
                                {w.is_finalized ? (
                                  <span className="text-[10px] text-slate-400 font-semibold">Finalized</span>
                                ) : (
                                  <button
                                    id={`att-finalize-wage-${w.user_id}`}
                                    onClick={() => handleFinalizeWage(w.user_id)}
                                    disabled={finalizingUserId === w.user_id}
                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {finalizingUserId === w.user_id ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />}
                                    Finalize
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Punch Console (shown for register, corrections, summary) */}
        {section !== "muster_roll" && section !== "wages" && (
          <div className="flex w-64 shrink-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                <Clock size={12} /> Punch Console
              </h3>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Staff Member</label>
              <select id="att-punch-user" value={punchUserId} onChange={e => setPunchUserId(e.target.value)}
                className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
                <option value="">Select staff...</option>
                {personnel.map(p => <option key={p.id} value={p.id}>{p.fullName || p.username}</option>)}
              </select>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Punch Type</label>
              <div className="mb-3 flex gap-1">
                {(["AUTO", "IN", "OUT"] as const).map(t => (
                  <button key={t} id={`att-punch-type-${t.toLowerCase()}`} onClick={() => setPunchType(t)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${punchType === t ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700"}`}>
                    {t === "IN" ? "In" : t === "OUT" ? "Out" : "Auto"}
                  </button>
                ))}
              </div>
              <button id="att-punch-btn" disabled={!punchUserId || punching} onClick={handlePunch}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {punching ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                {punching ? "Recording..." : "Record Punch"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Snapshot</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Total", value: summary.total, color: "text-slate-800" },
                  { label: "Present", value: summary.present, color: "text-emerald-600" },
                  { label: "Late", value: summary.late, color: "text-amber-600" },
                  { label: "Absent", value: summary.absent, color: "text-red-500" },
                  { label: "Corrections", value: corrections.length, color: "text-amber-500" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between">
                    <span className="text-slate-500">{s.label}</span>
                    <span className={`font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* R-12: Correction Request Modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800 dark:text-white">
                <Pencil size={16} className="mr-1.5 inline text-indigo-600" />
                Request Attendance Correction
              </h2>
              <button id="att-correction-close" onClick={() => setCorrectionTarget(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
            <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <div className="flex gap-4">
                <div><span className="font-semibold text-slate-500">Date</span><div className="mt-0.5 font-mono text-slate-700 dark:text-slate-200">{fmtDate(correctionTarget.attendance_date)}</div></div>
                <div><span className="font-semibold text-slate-500">Current Status</span>
                  <div className="mt-0.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[correctionTarget.status] || ""}`}>{STATUS_LABELS[correctionTarget.status]}</span></div>
                </div>
                <div><span className="font-semibold text-slate-500">Employee</span><div className="mt-0.5 text-slate-700 dark:text-slate-200">{correctionTarget.full_name || correctionTarget.username}</div></div>
              </div>
            </div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Why does this need a correction? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="att-correction-reason"
              rows={3}
              value={correctionReason}
              onChange={e => setCorrectionReason(e.target.value)}
              placeholder="e.g. Forgot to clock in — was present from 9 AM. Please correct to PRESENT with 09:00 clock-in."
              className="mb-4 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <p className="mb-4 text-xs text-slate-400">
              Your manager will review this request. You will see the status update in the Corrections tab.
            </p>
            <div className="flex gap-3">
              <button id="att-correction-cancel" onClick={() => setCorrectionTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button id="att-correction-submit" disabled={correctionSubmitting || !correctionReason.trim()} onClick={handleRequestCorrection}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {correctionSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                {correctionSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-800 dark:text-white">Bulk Attendance Mark</h2>
              <button id="att-bulk-close" onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Date</label>
                <input id="att-bulk-date" type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Mark As</label>
                <select id="att-bulk-status" value={bulkStatus} onChange={e => setBulkStatus(e.target.value as "HOLIDAY" | "ABSENT")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400">
                  <option value="HOLIDAY">Holiday</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>
            </div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Select Staff ({bulkSelected.length} selected)</label>
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
              <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setBulkSelected(personnel.map(p => p.id))}>Select All</button>
                <span className="text-slate-300">|</span>
                <button className="text-xs font-semibold text-slate-500 hover:underline" onClick={() => setBulkSelected([])}>Clear</button>
              </div>
              {personnel.map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-100">
                  <input type="checkbox" checked={bulkSelected.includes(p.id)} className="accent-indigo-600"
                    onChange={e => e.target.checked ? setBulkSelected(prev => [...prev, p.id]) : setBulkSelected(prev => prev.filter(id => id !== p.id))} />
                  <span className="text-xs text-slate-700">{p.fullName || p.username}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button id="att-bulk-cancel" onClick={() => setShowBulkModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button id="att-bulk-submit" disabled={bulkSubmitting || !bulkSelected.length} onClick={handleBulkMark}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {bulkSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                {bulkSubmitting ? "Marking..." : `Mark ${bulkSelected.length} Staff`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceWorkspaceTab;
