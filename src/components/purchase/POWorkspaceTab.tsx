/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Order Workspace (Phase B)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-01
 * Modified     : 2026-10-01
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Phase B — Status-Aware PO Workspace
 * ─────────────────────────────────────
 * Displays existing purchase orders grouped by lifecycle status tab.
 * Per-role action buttons (Submit, Confirm, Cancel) appear inline for
 * each PO row. Uses the backend ?status= filter for efficient fetching.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  POStatus,
  normalizePOStatus,
  formatPOStatusLabel,
  isPOSubmittable,
  isPOConfirmable,
  isPOCancellable,
} from "./poLifecycle.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface POWorkspaceTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (
    title: string,
    message: string,
    type?: "success" | "error" | "info" | "warning"
  ) => void;
  /** Called when user wants to open/edit a PO in the generation tab. */
  onOpenPO?: (orderNo: string) => void;
}

/** Minimal PO row shape returned by GET /purchase/orders/ */
interface PORow {
  id: string;
  order_no: string;
  status: string;
  supplier_id: string;
  supplier_name?: string;
  order_date?: string;
  delivery_date?: string;
  total_amount?: number;
  items?: { id: string }[];
  submitted_by?: string | null;
  submitted_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at?: string;
  notes?: string | null;
}

// ─── Status Tab Config ────────────────────────────────────────────────────────

interface StatusTabDef {
  id: POStatus | "ALL";
  label: string;
  icon: string;
  color: string;          // Tailwind text colour
  borderColor: string;    // active tab border accent
  badgeBg: string;        // badge background
  badgeText: string;      // badge text colour
}

const STATUS_TABS: StatusTabDef[] = [
  {
    id: "ALL",
    label: "All POs",
    icon: "list_alt",
    color: "text-slate-300",
    borderColor: "border-slate-400",
    badgeBg: "bg-slate-700",
    badgeText: "text-slate-200",
  },
  {
    id: "DRAFT",
    label: "Draft",
    icon: "edit_note",
    color: "text-amber-300",
    borderColor: "border-amber-400",
    badgeBg: "bg-amber-900/60",
    badgeText: "text-amber-300",
  },
  {
    id: "SUBMITTED",
    label: "Submitted",
    icon: "pending_actions",
    color: "text-blue-300",
    borderColor: "border-blue-400",
    badgeBg: "bg-blue-900/60",
    badgeText: "text-blue-300",
  },
  {
    id: "CONFIRMED",
    label: "Confirmed",
    icon: "task_alt",
    color: "text-emerald-300",
    borderColor: "border-emerald-400",
    badgeBg: "bg-emerald-900/60",
    badgeText: "text-emerald-300",
  },
  {
    id: "RECEIVED",
    label: "Received",
    icon: "inventory_2",
    color: "text-indigo-300",
    borderColor: "border-indigo-400",
    badgeBg: "bg-indigo-900/60",
    badgeText: "text-indigo-300",
  },
  {
    id: "CANCELLED",
    label: "Cancelled",
    icon: "cancel",
    color: "text-red-400",
    borderColor: "border-red-500",
    badgeBg: "bg-red-900/60",
    badgeText: "text-red-400",
  },
];

// ─── Role Helpers ─────────────────────────────────────────────────────────────

function canActOnPO(role?: string): boolean {
  const r = (role || "").toUpperCase();
  return r === "MANAGER" || r === "SYSADMIN" || r === "ADMIN";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function POStatusBadge({ status }: { status: string }) {
  const s = normalizePOStatus(status);
  const tab = STATUS_TABS.find((t) => t.id === s);
  const bg = tab?.badgeBg ?? "bg-slate-700";
  const text = tab?.badgeText ?? "text-slate-300";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${bg} ${text}`}
    >
      <span className="material-symbols-outlined text-[11px]">{tab?.icon ?? "circle"}</span>
      {formatPOStatusLabel(status)}
    </span>
  );
}

// ─── Cancel Confirmation Dialog ───────────────────────────────────────────────

interface CancelDialogProps {
  orderNo: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

const CancelDialog: React.FC<CancelDialogProps> = ({
  orderNo,
  onConfirm,
  onCancel,
  loading,
}) => {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-[420px] max-w-full">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-red-400 text-2xl">cancel</span>
          <div>
            <p className="text-white font-semibold text-sm">Cancel Purchase Order</p>
            <p className="text-slate-400 text-xs mt-0.5">
              PO <span className="font-mono text-slate-300">{orderNo}</span> will be cancelled. This cannot be undone.
            </p>
          </div>
        </div>
        <label className="block text-xs text-slate-400 mb-1 font-medium">
          Reason for cancellation
        </label>
        <input
          ref={inputRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Vendor unavailable, budget constraint..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-4"
          onKeyDown={(e) => {
            if (e.key === "Enter" && reason.trim()) onConfirm(reason.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Keep PO
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 text-xs rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin material-symbols-outlined text-[14px]">progress_activity</span>
                Cancelling...
              </span>
            ) : (
              "Confirm Cancel"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const POWorkspaceTab: React.FC<POWorkspaceTabProps> = ({
  currentUser,
  onNotification,
  onOpenPO,
}) => {
  const [activeTab, setActiveTab] = useState<POStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [cancelTarget, setCancelTarget] = useState<PORow | null>(null);
  const [search, setSearch] = useState("");
  const [tabCounts, setTabCounts] = useState<Partial<Record<POStatus | "ALL", number>>>({});

  const isManager = canActOnPO(currentUser?.role);

  // ── Fetch orders for active tab ──────────────────────────────────────────
  const fetchOrders = useCallback(async (tab: POStatus | "ALL") => {
    setLoading(true);
    setError(null);
    try {
      const qs = tab === "ALL" ? "" : `?status=${encodeURIComponent(tab)}`;
      const data = (await apiFetchV1(`/purchase/orders/${qs}`)) as PORow[];
      setOrders(Array.isArray(data) ? data : []);
      // Update count for this tab
      setTabCounts((prev) => ({ ...prev, [tab]: Array.isArray(data) ? data.length : 0 }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load purchase orders.";
      setError(msg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

  // ── Derived: filtered by search ──────────────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (o.order_no || "").toLowerCase().includes(q) ||
      (o.supplier_name || o.supplier_id || "").toLowerCase().includes(q) ||
      (o.notes || "").toLowerCase().includes(q)
    );
  });

  // ── Tab change ───────────────────────────────────────────────────────────
  const handleTabChange = (tab: POStatus | "ALL") => {
    setActiveTab(tab);
    setSearch("");
  };

  // ── Action: Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (po: PORow) => {
    setActionLoading((p) => ({ ...p, [po.id]: true }));
    try {
      await apiFetchV1(`/purchase/orders/${po.id}/submit`, { method: "POST" });
      onNotification?.("PO Submitted", `${po.order_no} is now awaiting confirmation.`, "success");
      fetchOrders(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submit failed.";
      onNotification?.("Submit Failed", msg, "error");
    } finally {
      setActionLoading((p) => ({ ...p, [po.id]: false }));
    }
  };

  // ── Action: Confirm ──────────────────────────────────────────────────────
  const handleConfirm = async (po: PORow) => {
    setActionLoading((p) => ({ ...p, [po.id]: true }));
    try {
      await apiFetchV1(`/purchase/orders/${po.id}/confirm`, { method: "POST" });
      onNotification?.("PO Confirmed", `${po.order_no} has been confirmed for fulfillment.`, "success");
      fetchOrders(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Confirm failed.";
      onNotification?.("Confirm Failed", msg, "error");
    } finally {
      setActionLoading((p) => ({ ...p, [po.id]: false }));
    }
  };

  // ── Action: Cancel ───────────────────────────────────────────────────────
  const handleCancelConfirmed = async (reason: string) => {
    if (!cancelTarget) return;
    const po = cancelTarget;
    setActionLoading((p) => ({ ...p, [po.id]: true }));
    setCancelTarget(null);
    try {
      await apiFetchV1(`/purchase/orders/${po.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      onNotification?.("PO Cancelled", `${po.order_no} has been cancelled.`, "info");
      fetchOrders(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancel failed.";
      onNotification?.("Cancel Failed", msg, "error");
    } finally {
      setActionLoading((p) => ({ ...p, [po.id]: false }));
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmtDate = (s?: string | null) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return s; }
  };

  const fmtAmount = (n?: number | null) => {
    if (n == null) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const activeTabDef = STATUS_TABS.find((t) => t.id === activeTab)!;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-sm select-none">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-indigo-400 text-base">receipt_long</span>
          <span className="font-semibold text-slate-200 text-sm">PO Workspace</span>
          {isManager && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-emerald-400 text-[10px] font-medium">
              <span className="material-symbols-outlined text-[11px]">verified_user</span>
              {currentUser?.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO / Supplier..."
              className="bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
            />
          </div>
          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchOrders(activeTab)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Refresh"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Status Tabs ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-end gap-0 bg-slate-900 border-b border-slate-800 px-4 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap
                ${isActive
                  ? `${tab.color} ${tab.borderColor} bg-slate-800/60`
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/40"
                }
              `}
            >
              <span className={`material-symbols-outlined text-[14px] ${isActive ? tab.color : ""}`}>
                {tab.icon}
              </span>
              {tab.label}
              {count != null && (
                <span className={`ml-0.5 px-1.5 py-0 rounded-full text-[10px] font-bold ${tab.badgeBg} ${tab.badgeText}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-800/60" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span className="material-symbols-outlined text-red-400 text-4xl">error_outline</span>
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => fetchOrders(activeTab)}
              className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span className={`material-symbols-outlined text-5xl ${activeTabDef.color} opacity-40`}>
              {activeTabDef.icon}
            </span>
            <p className="text-slate-500 text-sm">
              {search.trim()
                ? `No ${activeTabDef.label} POs match "${search}"`
                : `No ${activeTabDef.label === "All POs" ? "" : activeTabDef.label + " "}purchase orders found`}
            </p>
          </div>
        )}

        {/* PO Table */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 text-left">
                  <th className="py-2 pr-3 font-medium w-[120px]">PO Number</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Supplier</th>
                  <th className="py-2 pr-3 font-medium w-[90px]">PO Date</th>
                  <th className="py-2 pr-3 font-medium w-[90px]">Delivery</th>
                  <th className="py-2 pr-3 font-medium text-right w-[110px]">Amount</th>
                  <th className="py-2 pr-3 font-medium w-[55px] text-center">Lines</th>
                  <th className="py-2 font-medium w-[200px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => {
                  const busy = actionLoading[po.id];
                  const s = normalizePOStatus(po.status);
                  return (
                    <tr
                      key={po.id}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* PO Number */}
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => onOpenPO?.(po.order_no)}
                          className="font-mono text-blue-400 hover:text-blue-300 hover:underline transition"
                          title="Open PO"
                        >
                          {po.order_no || po.id.slice(0, 8)}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 pr-3">
                        <POStatusBadge status={po.status} />
                      </td>

                      {/* Supplier */}
                      <td className="py-2.5 pr-3 text-slate-300 max-w-[180px]">
                        <span className="truncate block" title={po.supplier_name || po.supplier_id}>
                          {po.supplier_name || po.supplier_id || "—"}
                        </span>
                      </td>

                      {/* PO Date */}
                      <td className="py-2.5 pr-3 text-slate-400">
                        {fmtDate(po.order_date || po.created_at)}
                      </td>

                      {/* Delivery Date */}
                      <td className="py-2.5 pr-3 text-slate-400">
                        {fmtDate(po.delivery_date)}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 pr-3 text-right text-slate-300 font-mono">
                        {fmtAmount(po.total_amount)}
                      </td>

                      {/* Lines count */}
                      <td className="py-2.5 pr-3 text-center text-slate-500">
                        {po.items ? po.items.length : "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">

                          {/* SUBMIT — DRAFT only, MANAGER+ */}
                          {isPOSubmittable(s) && isManager && (
                            <button
                              type="button"
                              onClick={() => handleSubmit(po)}
                              disabled={busy}
                              title="Submit for confirmation"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-semibold transition disabled:opacity-50"
                            >
                              {busy ? (
                                <span className="animate-spin material-symbols-outlined text-[12px]">progress_activity</span>
                              ) : (
                                <span className="material-symbols-outlined text-[12px]">send</span>
                              )}
                              Submit
                            </button>
                          )}

                          {/* CONFIRM — SUBMITTED only, MANAGER+ */}
                          {isPOConfirmable(s) && isManager && (
                            <button
                              type="button"
                              onClick={() => handleConfirm(po)}
                              disabled={busy}
                              title="Confirm purchase order"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-semibold transition disabled:opacity-50"
                            >
                              {busy ? (
                                <span className="animate-spin material-symbols-outlined text-[12px]">progress_activity</span>
                              ) : (
                                <span className="material-symbols-outlined text-[12px]">task_alt</span>
                              )}
                              Confirm
                            </button>
                          )}

                          {/* VIEW — always available */}
                          <button
                            type="button"
                            onClick={() => onOpenPO?.(po.order_no)}
                            title="Open PO"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                          >
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            Open
                          </button>

                          {/* CANCEL — DRAFT/SUBMITTED/CONFIRMED, MANAGER+ */}
                          {isPOCancellable(s) && isManager && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(po)}
                              disabled={busy}
                              title="Cancel purchase order"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-400 text-[10px] transition disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[12px]">cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit footer for selected row (expanded detail) */}
        {/* Phase B displays audit in tooltip / hover. Full detail panel is Phase C. */}
      </div>

      {/* ── Footer summary ────────────────────────────────────────────────── */}
      {!loading && filteredOrders.length > 0 && (
        <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-1.5 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            Showing <span className="text-slate-400 font-medium">{filteredOrders.length}</span>
            {orders.length !== filteredOrders.length && (
              <> of <span className="text-slate-400 font-medium">{orders.length}</span></>
            )}{" "}
            {activeTabDef.label === "All POs" ? "purchase orders" : activeTabDef.label.toLowerCase() + " POs"}
          </span>
          {!isManager && (
            <span className="flex items-center gap-1 text-amber-500/70">
              <span className="material-symbols-outlined text-[11px]">info</span>
              Submit / Confirm / Cancel require Manager role
            </span>
          )}
        </div>
      )}

      {/* ── Cancel confirmation dialog ─────────────────────────────────────── */}
      {cancelTarget && (
        <CancelDialog
          orderNo={cancelTarget.order_no}
          loading={actionLoading[cancelTarget.id] ?? false}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
};
