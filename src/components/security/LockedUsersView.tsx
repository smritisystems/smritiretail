/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — Locked Users View
 */
import React, { useState, useEffect, useCallback } from "react";
import { Unlock, RefreshCw, Lock, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  lastLogin?: string;
}

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

const fmtDate = (ts?: string) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      "  " + new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
};

export const LockedUsersView: React.FC<Props> = ({ onNotification }) => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const notify = useCallback(
    (type: Notification["type"], message: string) => onNotification?.({ type, message }),
    [onNotification],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiFetchV1("/users/?status=Inactive&limit=100");
      if (Array.isArray(res?.users)) {
        setUsers(res.users.map((u: any) => ({
          id: u.id || u.userId,
          username: u.username || u.id,
          fullName: u.fullName || u.displayName || u.username || u.id,
          role: u.role || "—",
          status: u.status || "Inactive",
          lastLogin: u.lastLogin || u.last_login,
        })));
      }
    } catch {
      notify("error", "Failed to load locked accounts.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  const handleUnlock = async (userId: string, name: string) => {
    setUnlocking(userId);
    try {
      await apiFetchV1(`/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" }),
      });
      notify("success", `${name} unlocked successfully.`);
      void load();
    } catch (e: any) {
      notify("error", e?.message ?? "Failed to unlock account.");
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0f172a] font-display">Locked Users</h2>
          <p className="text-xs text-[#64748b] mt-0.5">Review and unlock operator accounts</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Refresh"
          className="p-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Summary banner */}
      {!loading && users.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 flex items-center gap-2 text-xs text-rose-700 shrink-0">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{users.length} locked account{users.length !== 1 ? "s" : ""} require admin attention.</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[560px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-0 z-10">
                {["User ID", "Full Name", "Role", "Last Login", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#475569] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f1f5f9]">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-3 bg-[#e2e8f0] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : users.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-[#94a3b8]">
                        <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                        <div className="font-semibold text-sm text-emerald-700">All accounts are active</div>
                        <div className="text-xs mt-1 text-[#94a3b8]">No locked accounts found.</div>
                      </td>
                    </tr>
                  )
                  : users.map((u, i) => (
                    <tr key={u.id}
                      className={"border-b border-[#f1f5f9] " + (i % 2 === 0 ? "bg-white hover:bg-rose-50/30" : "bg-[#fafafa] hover:bg-rose-50/30") + " transition-colors"}>
                      <td className="px-4 py-3 font-mono font-bold text-rose-700">{u.username}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                            {u.fullName.slice(0, 2)}
                          </div>
                          <span className="font-semibold text-[#0f172a]">{u.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-[#475569]">{u.role}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[#64748b]">{fmtDate(u.lastLogin)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={unlocking === u.id}
                          onClick={() => void handleUnlock(u.id, u.fullName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <Unlock size={12} />
                          {unlocking === u.id ? "Unlocking…" : "Unlock"}
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LockedUsersView;
