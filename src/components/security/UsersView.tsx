/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security & Access Management — Users View
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Unlock, Download, Search, Filter, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, Shield, Users, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, User, X,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { initialSecurityGroups } from "../../services/securityStore.ts";

interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  displayName?: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin?: string;
  isLocked?: boolean;
  groupId?: string;
}

interface Notification {
  type: "success" | "error" | "warning";
  message: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin:     "bg-purple-100 text-purple-800 border-purple-200",
  manager:   "bg-blue-100   text-blue-800   border-blue-200",
  cashier:   "bg-green-100  text-green-800  border-green-200",
  purchase:  "bg-orange-100 text-orange-800 border-orange-200",
  store:     "bg-teal-100   text-teal-800   border-teal-200",
  accountant:"bg-pink-100   text-pink-800   border-pink-200",
  viewer:    "bg-slate-100  text-slate-700  border-slate-200",
  test:      "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const roleColor = (role: string) =>
  ROLE_COLORS[role?.toLowerCase()] ?? "bg-slate-100 text-slate-700 border-slate-200";

const fmtLastLogin = (ts?: string) => {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today  " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday  " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }) + "  " +
           d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
};

interface UsersViewProps {
  onNotification?: (n: Notification) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ onNotification }) => {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "delete" | "unlock" | "lock";
    userId: string;
    userName: string;
  } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const notify = useCallback((type: Notification["type"], message: string) => {
    if (onNotification) onNotification({ type, message });
  }, [onNotification]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String((page - 1) * pageSize),
        limit: String(pageSize),
        ...(search ? { search } : {}),
        ...(filterRole !== "All" ? { role: filterRole } : {}),
        ...(filterStatus !== "All" ? { status: filterStatus } : {}),
      });
      const res: any = await apiFetchV1(`/users/?${params.toString()}`);
      if (Array.isArray(res?.users)) {
        setUsers(res.users.map((u: any) => ({
          id: u.id || u.userId,
          username: u.username || u.id,
          fullName: u.fullName || u.displayName || u.username || u.id,
          role: u.role || u.groupId || "—",
          status: u.status === "Active" ? "Active" : "Inactive",
          lastLogin: u.lastLogin || u.last_login,
          isLocked: u.status === "Inactive",
        })));
        setTotal(res.total ?? res.users.length);
      }
    } catch {
      notify("error", "Failed to load users. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, filterRole, filterStatus, notify]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleDelete = async (userId: string) => {
    try {
      await apiFetchV1(`/users/${userId}`, { method: "DELETE" });
      notify("success", "User deactivated successfully.");
      void loadUsers();
    } catch (e: any) {
      notify("error", e?.message ?? "Failed to delete user.");
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await apiFetchV1(`/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" }),
      });
      notify("success", "User account unlocked successfully.");
      void loadUsers();
    } catch (e: any) {
      notify("error", e?.message ?? "Failed to unlock user.");
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleExport = () => {
    const rows = [["User ID", "Full Name", "Role", "Status", "Last Login"]];
    users.forEach(u => rows.push([u.username, u.fullName, u.role, u.status, fmtLastLogin(u.lastLogin)]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
    URL.revokeObjectURL(url);
    notify("success", "User list exported to CSV.");
  };

  const allSelected = users.length > 0 && users.every(u => selected.has(u.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(users.map(u => u.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const groups = initialSecurityGroups;
  const getGroupName = (roleId: string) =>
    groups.find(g => g.id === roleId)?.name || roleId;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">

      {/* Page Header */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0f172a] font-display">User Listing</h2>
          <p className="text-xs text-[#64748b] mt-0.5">Create and manage system users</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users, name, email..."
              aria-label="Search users"
              className="pl-8 pr-3 py-2 text-xs border border-[#cbd5e1] rounded-xl bg-white w-56 focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(o => !o)}
              aria-expanded={filterOpen}
              aria-label="Filter users"
              className={"flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-xl transition " + (filterOpen ? "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]" : "bg-white border-[#cbd5e1] text-[#475569] hover:border-[#1e40af]/40")}
            >
              <Filter size={13} /> Filter
              <ChevronDown size={11} className={filterOpen ? "rotate-180" : ""} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-3 z-20 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1 block">Role</label>
                  <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}
                    className="w-full text-xs border border-[#cbd5e1] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#1e40af]">
                    <option value="All">All Roles</option>
                    {["admin","manager","cashier","purchase","store","accountant","viewer"].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1 block">Status</label>
                  <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                    className="w-full text-xs border border-[#cbd5e1] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#1e40af]">
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <button type="button" onClick={() => { setFilterRole("All"); setFilterStatus("All"); setPage(1); }}
                  className="w-full text-xs text-[#64748b] hover:text-[#1e40af] text-center py-1 transition">
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white border-b border-[#e2e8f0] px-6 py-3 flex items-center gap-2 shrink-0 flex-wrap">
        <button type="button" className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-xl transition min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
          <Plus size={14} /> New User
        </button>
        <button type="button" disabled={selected.size !== 1}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f1f5f9] rounded-xl transition min-h-[36px] disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
          <Pencil size={13} /> Edit
        </button>
        <button type="button" disabled={selected.size === 0}
          onClick={() => {
            if (selected.size === 1) {
              const id = [...selected][0];
              const u = users.find(u => u.id === id);
              if (u) setConfirmDialog({ type: "delete", userId: id, userName: u.fullName });
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#334155] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 rounded-xl transition min-h-[36px] disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          <Trash2 size={13} /> Delete
        </button>
        <button type="button" disabled={selected.size === 0}
          onClick={() => {
            if (selected.size === 1) {
              const id = [...selected][0];
              const u = users.find(u => u.id === id);
              if (u) setConfirmDialog({ type: "unlock", userId: id, userName: u.fullName });
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#334155] hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 rounded-xl transition min-h-[36px] disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <Unlock size={13} /> Unlock
        </button>
        <button type="button" onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f1f5f9] rounded-xl transition min-h-[36px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
          <Download size={13} /> Export
          <ChevronDown size={11} />
        </button>
        <button type="button" onClick={() => void loadUsers()}
          aria-label="Refresh user list"
          className="ml-auto flex items-center gap-1 px-2.5 py-2 text-xs text-[#64748b] hover:text-[#1e40af] border border-transparent hover:border-[#bfdbfe] rounded-xl transition min-h-[36px]">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[720px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] sticky top-0 z-10">
                <th className="px-4 py-3 w-10 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all users"
                    className="w-3.5 h-3.5 rounded border-[#cbd5e1] accent-[#1e40af] cursor-pointer" />
                </th>
                {["User ID", "Description", "Group / Role", "Status", "Last Login", "Actions"].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-bold text-[#475569] uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-[#e2e8f0] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[#94a3b8]">
                    <User size={32} className="mx-auto mb-2 text-[#cbd5e1]" />
                    <div className="font-semibold text-sm text-[#64748b]">No users found</div>
                    <div className="text-xs mt-1">Try adjusting your search or filters, or create a new user.</div>
                  </td>
                </tr>
              ) : users.map((u, idx) => (
                <tr key={u.id}
                  className={"border-b border-[#f1f5f9] transition-colors " + (selected.has(u.id) ? "bg-[#eff6ff]" : idx % 2 === 0 ? "bg-white hover:bg-[#f8fafc]" : "bg-[#fafafa] hover:bg-[#f8fafc]")}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)}
                      aria-label={`Select ${u.fullName}`}
                      className="w-3.5 h-3.5 rounded border-[#cbd5e1] accent-[#1e40af] cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-[#1e40af]">{u.username}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe] font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                        {u.fullName.slice(0, 2)}
                      </div>
                      <span className="font-semibold text-[#0f172a]">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={"px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize " + roleColor(u.role)}>
                      {getGroupName(u.role)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {u.status === "Active"
                        ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        : <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                      <span className={"font-semibold " + (u.status === "Active" ? "text-emerald-700" : "text-rose-700")}>{u.status}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#64748b] font-mono text-[10px]">{fmtLastLogin(u.lastLogin)}</td>
                  <td className="px-3 py-3 text-right relative">
                    <button
                      type="button"
                      aria-label={`Actions for ${u.fullName}`}
                      onClick={() => setActionMenu(prev => prev === u.id ? null : u.id)}
                      className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {actionMenu === u.id && (
                      <div className="absolute right-4 top-10 w-36 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-20 py-1 text-left">
                        <button type="button" className="w-full px-3 py-2 text-xs text-[#334155] hover:bg-[#f8fafc] flex items-center gap-2 transition" onClick={() => setActionMenu(null)}>
                          <Pencil size={11} /> Edit
                        </button>
                        <button type="button" onClick={() => { setConfirmDialog({ type: "unlock", userId: u.id, userName: u.fullName }); setActionMenu(null); }}
                          className="w-full px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition">
                          <Unlock size={11} /> Unlock
                        </button>
                        <div className="border-t border-[#f1f5f9] my-0.5" />
                        <button type="button" onClick={() => { setConfirmDialog({ type: "delete", userId: u.id, userName: u.fullName }); setActionMenu(null); }}
                          className="w-full px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="bg-white border-t border-[#e2e8f0] px-6 py-3 flex items-center justify-between text-xs text-[#64748b] shrink-0 flex-wrap gap-2">
        <span>Showing {users.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1 rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] disabled:opacity-40 transition"><ChevronLeft size={14} /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
            <button key={pg} type="button" onClick={() => setPage(pg)}
              className={"w-7 h-7 rounded-lg text-[11px] font-bold transition " + (page === pg ? "bg-[#1e40af] text-white" : "text-[#475569] hover:bg-[#f1f5f9]")}>
              {pg}
            </button>
          ))}
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-1 rounded-lg border border-[#e2e8f0] hover:bg-[#f1f5f9] disabled:opacity-40 transition"><ChevronRight size={14} /></button>
          <span className="ml-2 text-[#94a3b8]">25 / page</span>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={"w-10 h-10 rounded-xl flex items-center justify-center shrink-0 " + (confirmDialog.type === "delete" ? "bg-rose-100" : "bg-emerald-100")}>
                {confirmDialog.type === "delete" ? <Trash2 size={18} className="text-rose-600" /> : <Unlock size={18} className="text-emerald-600" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#0f172a]">
                  {confirmDialog.type === "delete" ? "Deactivate User" : "Unlock Account"}
                </h3>
                <p className="text-[11px] text-[#64748b]">This action requires confirmation</p>
              </div>
            </div>
            <p className="text-xs text-[#334155] mb-5 leading-relaxed">
              {confirmDialog.type === "delete"
                ? `Are you sure you want to deactivate "${confirmDialog.userName}"? This will revoke their system access.`
                : `Unlock account for "${confirmDialog.userName}"? They will be able to log in again.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-semibold border border-[#cbd5e1] rounded-xl text-[#475569] hover:bg-[#f8fafc] transition">
                Cancel
              </button>
              <button type="button"
                onClick={() => confirmDialog.type === "delete" ? void handleDelete(confirmDialog.userId) : void handleUnlock(confirmDialog.userId)}
                className={"px-4 py-2 text-xs font-bold rounded-xl text-white transition " + (confirmDialog.type === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")}>
                {confirmDialog.type === "delete" ? "Deactivate" : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss action menu on outside click */}
      {actionMenu && <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} aria-hidden="true" />}
    </div>
  );
};

export default UsersView;
