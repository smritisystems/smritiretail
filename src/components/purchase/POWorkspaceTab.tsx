/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Order Workspace (Phase B + C + D)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.3.0
 * Created      : 2026-10-01
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Phase B — Status-Aware PO Workspace
 * Phase C — Cancellation Policy Picker (PO_CANCEL_REASON master + fallback).
 * Phase D — Amendment/Revision Chain: Amend button for CONFIRMED POs,
 *            POAmendDialog with item editor + history tab.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { UniversalStatusBadge, DocumentActionToolbar } from "../common/lifecycle";
import {
  POStatus,
  normalizePOStatus,
  formatPOStatusLabel,
  isPOSubmittable,
  isPOConfirmable,
  isPOCancellable,
  isPOAmendable,
} from "./poLifecycle.ts";
import {
  POCancelReasonDialog,
  type POCancelReasonResult,
} from "./POCancelReasonDialog.tsx";
import {
  POAmendDialog,
  type POAmendRequest,
} from "./POAmendDialog.tsx";
import { ProcurementReportsModal } from "./ProcurementReportsModal.tsx";

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
  received_date?: string;
  vendor_bill_date?: string;
  vendor_bill_no?: string;
  total_amount?: number;
  items?: Array<{
    id: string;
    product_id?: string;
    code?: string;
    name?: string;
    quantity?: number | string;
    cost_price?: number | string;
    gst_rate?: number | string;
  }>;
  submitted_by?: string | null;
  submitted_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  // Phase D amendment chain
  parent_order_id?: string | null;
  amend_revision?: number;
  amended_by?: string | null;
  amended_at?: string | null;
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
    color: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-600 dark:border-slate-400",
    badgeBg: "bg-slate-200 dark:bg-slate-700",
    badgeText: "text-slate-800 dark:text-slate-200",
  },
  {
    id: "DRAFT",
    label: "Draft",
    icon: "edit_note",
    color: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-500 dark:border-amber-400",
    badgeBg: "bg-amber-100 dark:bg-amber-900/60",
    badgeText: "text-amber-800 dark:text-amber-300",
  },
  {
    id: "SUBMITTED",
    label: "Submitted",
    icon: "pending_actions",
    color: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-500 dark:border-blue-400",
    badgeBg: "bg-blue-100 dark:bg-blue-900/60",
    badgeText: "text-blue-800 dark:text-blue-300",
  },
  {
    id: "CONFIRMED",
    label: "Confirmed",
    icon: "task_alt",
    color: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-500 dark:border-emerald-400",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/60",
    badgeText: "text-emerald-800 dark:text-emerald-300",
  },
  {
    id: "RECEIVED",
    label: "Received",
    icon: "inventory_2",
    color: "text-indigo-700 dark:text-indigo-300",
    borderColor: "border-indigo-500 dark:border-indigo-400",
    badgeBg: "bg-indigo-100 dark:bg-indigo-900/60",
    badgeText: "text-indigo-800 dark:text-indigo-300",
  },
  {
    id: "CANCELLED",
    label: "Cancelled",
    icon: "cancel",
    color: "text-red-700 dark:text-red-400",
    borderColor: "border-red-500",
    badgeBg: "bg-red-100 dark:bg-red-900/60",
    badgeText: "text-red-800 dark:text-red-400",
  },
];

// ─── Role Helpers ─────────────────────────────────────────────────────────────

function canActOnPO(role?: string): boolean {
  const r = (role || "").toUpperCase();
  return r === "MANAGER" || r === "SYSADMIN" || r === "ADMIN";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function POStatusBadge({ status }: { status: string }) {
  return <UniversalStatusBadge status={status} size="sm" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const POWorkspaceTab: React.FC<POWorkspaceTabProps> = ({
  currentUser,
  onNotification,
  onOpenPO,
}) => {
  const [activeTab, setActiveTab] = useState<POStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<PORow[]>([]);
  const [supplierMap, setSupplierMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [cancelTarget, setCancelTarget] = useState<PORow | null>(null);
  const [amendTarget, setAmendTarget] = useState<PORow | null>(null);
  const [amendLoading, setAmendLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tabCounts, setTabCounts] = useState<Partial<Record<POStatus | "ALL", number>>>({});
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const isManager = canActOnPO(currentUser?.role);

  // ── Fetch suppliers map for resilient vendor name resolution ──────────────
  useEffect(() => {
    let active = true;
    apiFetchV1("/purchase/suppliers/")
      .then((data: unknown) => {
        if (!active || !Array.isArray(data)) return;
        const map: Record<string, string> = {};
        for (const s of data) {
          if (s && s.id && s.name) {
            map[s.id] = s.name;
          }
        }
        setSupplierMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
    const supName = o.supplier_name || supplierMap[o.supplier_id] || o.supplier_id || "";
    return (
      (o.order_no || "").toLowerCase().includes(q) ||
      supName.toLowerCase().includes(q) ||
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

  // ── Action: Cancel (Phase C — receives structured POCancelReasonResult) ──
  const handleCancelConfirmed = async (result: POCancelReasonResult) => {
    if (!cancelTarget) return;
    const po = cancelTarget;
    setActionLoading((p) => ({ ...p, [po.id]: true }));
    setCancelTarget(null);
    // Compose human-readable reason string for cancellation_reason column
    const reasonText = result.reason_note
      ? `${result.reason_label}: ${result.reason_note}`
      : result.reason_label;
    try {
      await apiFetchV1(`/purchase/orders/${po.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          reason: reasonText,
          reason_code: result.reason_code,
        }),
      });
      onNotification?.(
        "PO Cancelled",
        `${po.order_no} has been cancelled. Reason: ${result.reason_label}`,
        "info",
      );
      fetchOrders(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cancel failed.";
      onNotification?.("Cancel Failed", msg, "error");
    } finally {
      setActionLoading((p) => ({ ...p, [po.id]: false }));
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  // ── Action: Amend (Phase D — creates a new Confirmed revision) ──────────
  const handleAmendConfirmed = async (req: POAmendRequest) => {
    if (!amendTarget) return;
    const po = amendTarget;
    setAmendLoading(true);
    try {
      await apiFetchV1(`/purchase/orders/${po.id}/amend`, {
        method: "POST",
        body: JSON.stringify(req),
      });
      onNotification?.(
        "PO Amended",
        `${po.order_no} superseded — ${req.new_order_no} created as revision ${(po.amend_revision ?? 0) + 1}.`,
        "success",
      );
      setAmendTarget(null);
      fetchOrders(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Amendment failed.";
      onNotification?.("Amendment Failed", msg, "error");
    } finally {
      setAmendLoading(false);
    }
  };

  const handleReceivePO = (po: PORow) => {
    try {
      sessionStorage.setItem("smriti_grn_selected_po", po.id);
      window.dispatchEvent(
        new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: "grn-studio", orderId: po.id, orderNo: po.order_no },
        })
      );
    } catch {
      // fallback
    }
  };

  const fmtDate = (s?: string | null) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  const fmtAmount = (n?: number | null) => {
    if (n == null) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const activeTabDef = STATUS_TABS.find((t) => t.id === activeTab) || STATUS_TABS[0];

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm select-none">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-base">receipt_long</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">PO Workspace</span>
          {isManager && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
              <span className="material-symbols-outlined text-[11px]">verified_user</span>
              {currentUser?.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[14px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO / Supplier..."
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition w-52"
            />
          </div>
          {/* Reports */}
          <button
            type="button"
            id="po-workspace-reports-btn"
            onClick={() => setIsReportsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 text-xs font-semibold shadow-2xs transition"
            title="Open Procurement Reports & Audit Studio"
          >
            <span className="material-symbols-outlined text-[15px]">query_stats</span>
            <span>Reports</span>
          </button>
          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchOrders(activeTab)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition"
            title="Refresh"
          >
            <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Status Tabs ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-end gap-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 overflow-x-auto">
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
                  ? `${tab.color} ${tab.borderColor} bg-slate-100 dark:bg-slate-800/60`
                  : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
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
              <div key={i} className="h-14 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-4xl">error_outline</span>
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => fetchOrders(activeTab)}
              className="px-4 py-2 text-xs rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-2xs"
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
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {search.trim()
                ? `No ${activeTabDef.label} POs match "${search}"`
                : `No ${activeTabDef.label === "All POs" ? "" : activeTabDef.label + " "}purchase orders found`}
            </p>
          </div>
        )}

        {/* PO Table */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-left font-semibold">
                  <th className="py-2.5 px-3 w-[140px]">PO Number</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 pr-3">Supplier</th>
                  <th className="py-2.5 pr-3 w-[95px]">PO Date</th>
                  <th className="py-2.5 pr-3 w-[105px]">Receiving Date</th>
                  <th className="py-2.5 pr-3 text-right w-[120px]">Amount</th>
                  <th className="py-2.5 pr-3 w-[60px] text-center">Lines</th>
                  <th className="py-2.5 pr-3 font-medium w-[200px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => {
                  const busy = actionLoading[po.id];
                  const s = normalizePOStatus(po.status);
                  const resolvedSupplier = po.supplier_name || supplierMap[po.supplier_id] || po.supplier_id;
                  return (
                    <tr
                      key={po.id}
                      className="border-b border-slate-200/80 dark:border-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* PO Number */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => onOpenPO?.(po.order_no)}
                          className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition"
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
                      <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-200 max-w-[200px]">
                        <span className="truncate block font-medium" title={resolvedSupplier}>
                          {resolvedSupplier || "—"}
                        </span>
                      </td>

                      {/* PO Date (Authoritative PO creation date) */}
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(po.order_date || po.created_at)}
                      </td>

                      {/* Receiving Date (Resolved from Vendor Bill / Delivery) */}
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {fmtDate(po.delivery_date || po.received_date || po.vendor_bill_date)}
                      </td>

                      {/* Amount (Authoritative grand total) */}
                      <td className="py-2.5 pr-3 text-right text-slate-900 dark:text-slate-100 font-mono font-semibold whitespace-nowrap">
                        {fmtAmount(po.total_amount ?? (po as any).grand_total)}
                      </td>

                      {/* Lines count */}
                      <td className="py-2.5 pr-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {po.items ? po.items.length : "—"}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 pr-3 text-right">
                        <DocumentActionToolbar
                          currentStatus={s}
                          busy={busy}
                          canManage={isManager}
                          onSubmit={() => handleSubmit(po)}
                          onConfirm={() => handleConfirm(po)}
                          onAmend={() => setAmendTarget(po)}
                          onOpen={() => onOpenPO?.(po.order_no)}
                          onCancel={() => setCancelTarget(po)}
                          onReceive={() => handleReceivePO(po)}
                        />
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
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>
            Showing <span className="text-slate-900 dark:text-slate-200 font-semibold">{filteredOrders.length}</span>
            {orders.length !== filteredOrders.length && (
              <> of <span className="text-slate-900 dark:text-slate-200 font-semibold">{orders.length}</span></>
            )}{" "}
            {activeTabDef.label === "All POs" ? "purchase orders" : activeTabDef.label.toLowerCase() + " POs"}
          </span>
          {!isManager && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500/80 text-[11px]">
              <span className="material-symbols-outlined text-[13px]">info</span>
              Submit / Confirm / Cancel / Amend require Manager role
            </span>
          )}
        </div>
      )}

      {/* ── Cancel Reason Picker Dialog (Phase C) ─────────────────────────── */}
      {cancelTarget && (
        <POCancelReasonDialog
          isOpen={true}
          orderNo={cancelTarget.order_no}
          supplierName={cancelTarget.supplier_name}
          status={cancelTarget.status}
          loading={actionLoading[cancelTarget.id] ?? false}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {/* ── Amendment Dialog (Phase D) ───────────────────────────────────── */}
      {amendTarget && (
        <POAmendDialog
          isOpen={true}
          po={{
            id: amendTarget.id,
            order_no: amendTarget.order_no,
            supplier_name: amendTarget.supplier_name,
            amend_revision: amendTarget.amend_revision ?? 0,
            items: (amendTarget.items ?? []).map((it) => ({
              product_id: it.product_id ?? "",
              code: it.code ?? "",
              name: it.name ?? "",
              quantity: Number(it.quantity ?? 1),
              cost_price: Number(it.cost_price ?? 0),
              gst_rate: Number(it.gst_rate ?? 18),
            })),
          }}
          loading={amendLoading}
          onConfirm={handleAmendConfirmed}
          onCancel={() => setAmendTarget(null)}
        />
      )}

      {/* ── Procurement Reports & Audit Studio Modal ────────────────────── */}
      <ProcurementReportsModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
      />
    </div>
  );
};
