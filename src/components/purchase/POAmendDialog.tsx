/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Order Amendment Dialog (Phase D)
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
 * Phase D — Amendment/Revision Chain UI
 * ───────────────────────────────────────
 * Presents an amendment form for CONFIRMED purchase orders.
 * - Carries forward all items from the original (editable quantities/prices)
 * - Requires a new order number and amendment reason
 * - Sends { new_order_no, reason, items[] } to POST /orders/{id}/amend
 * - Shows amendment chain history via GET /orders/{id}/amendment-history
 *
 * Constraint (user preference): DO NOT convert, rewrite, or reinterpret
 * existing POs. This dialog only creates a new revision.
 */

import React, { useEffect, useRef, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmendItem {
  product_id: string;
  code: string;
  name: string;
  quantity: number;
  cost_price: number;
  gst_rate: number;
}

export interface AmendmentHistoryEntry {
  id: string;
  order_no: string;
  status: string;
  amend_revision: number;
  parent_order_id: string | null;
  amended_at: string | null;
  amended_by: string | null;
  grand_total: string;
  created_at: string | null;
}

export interface POAmendRequest {
  new_order_no: string;
  reason: string;
  items: AmendItem[];
}

interface OriginalPO {
  id: string;
  order_no: string;
  supplier_name?: string;
  amend_revision?: number;
  items: Array<{
    product_id: string;
    code: string;
    name: string;
    quantity: number | string;
    cost_price: number | string;
    gst_rate: number | string;
  }>;
}

interface POAmendDialogProps {
  isOpen: boolean;
  po: OriginalPO | null;
  onConfirm: (request: POAmendRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

// ─── Status badge colours (reused pattern) ───────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: "bg-emerald-900/60 text-emerald-300",
  CANCELLED: "bg-red-900/60 text-red-400",
  DRAFT:     "bg-amber-900/60 text-amber-300",
  SUBMITTED: "bg-blue-900/60 text-blue-300",
};

function RevisionBadge({ rev }: { rev: number }) {
  return rev === 0 ? (
    <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-medium">Original</span>
  ) : (
    <span className="text-[10px] bg-violet-900/60 text-violet-300 px-2 py-0.5 rounded-full font-medium">Rev {rev}</span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const POAmendDialog: React.FC<POAmendDialogProps> = ({
  isOpen,
  po,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [newOrderNo, setNewOrderNo] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<AmendItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<AmendmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "history">("edit");
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Initialise form when PO changes ───────────────────────────────────────
  useEffect(() => {
    if (isOpen && po) {
      // Pre-fill items from original PO
      const mapped: AmendItem[] = (po.items || []).map((it) => ({
        product_id: it.product_id,
        code: it.code,
        name: it.name,
        quantity: Number(it.quantity),
        cost_price: Number(it.cost_price),
        gst_rate: Number(it.gst_rate),
      }));
      setItems(mapped);

      // Suggest next order number: e.g. PO-001 → PO-001-R1, PO-001-R1 → PO-001-R2
      const baseNo = po.order_no.replace(/-R\d+$/, "");
      const nextRev = (po.amend_revision ?? 0) + 1;
      setNewOrderNo(`${baseNo}-R${nextRev}`);
      setReason("");
      setErrors({});
      setActiveTab("edit");
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [isOpen, po]);

  // ── Load amendment history ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !po) return;
    let cancelled = false;
    setHistoryLoading(true);
    apiFetchV1(`/purchase/orders/${po.id}/amendment-history`)
      .then((d: unknown) => {
        if (!cancelled && Array.isArray(d)) setHistory(d as AmendmentHistoryEntry[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, po]);

  if (!isOpen || !po) return null;

  // ── Item field updates ─────────────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof AmendItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const n = parseFloat(value);
      (next[idx] as unknown as Record<string, unknown>)[field] = isNaN(n) ? value : n;
      return next;
    });
  };

  // ── Computed totals ────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + it.quantity * it.cost_price, 0);
  const tax = items.reduce((s, it) => s + it.quantity * it.cost_price * it.gst_rate / 100, 0);
  const grand = subtotal + tax;

  const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Validate + submit ──────────────────────────────────────────────────────
  const handleConfirm = () => {
    const errs: Record<string, string> = {};
    if (!newOrderNo.trim()) errs.order_no = "New order number is required.";
    if (!reason.trim()) errs.reason = "Amendment reason is required.";
    if (items.length === 0) errs.items = "At least one item is required.";
    items.forEach((it, i) => {
      if (it.quantity <= 0) errs[`qty_${i}`] = "Quantity must be > 0.";
      if (it.cost_price <= 0) errs[`price_${i}`] = "Cost price must be > 0.";
    });
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    onConfirm({
      new_order_no: newOrderNo.trim(),
      reason: reason.trim(),
      items,
    });
  };

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Amend purchase order ${po.order_no}`}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[700px] max-w-[96vw] flex flex-col max-h-[92vh] overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-violet-950/40 border-b border-violet-900/40 px-5 py-4 flex items-start gap-3 shrink-0">
          <div className="mt-0.5 w-9 h-9 rounded-full bg-violet-900/60 border border-violet-700/50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-violet-400 text-lg">edit_document</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">Amend Purchase Order</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono text-violet-300 text-xs">{po.order_no}</span>
              {po.supplier_name && (
                <span className="text-slate-400 text-xs">· {po.supplier_name}</span>
              )}
              <RevisionBadge rev={po.amend_revision ?? 0} />
            </div>
            <p className="text-slate-400 text-xs mt-1.5">
              A new Confirmed revision will be created. The original PO will be marked Superseded.
            </p>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-800 shrink-0 bg-slate-900/80">
          {(["edit", "history"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-xs font-medium transition border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab === "edit" ? (
                <><span className="material-symbols-outlined text-[12px] mr-1 align-text-bottom">edit</span>Edit Items</>
              ) : (
                <><span className="material-symbols-outlined text-[12px] mr-1 align-text-bottom">history</span>History</>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Edit Tab ────────────────────────────────────────────────── */}
          {activeTab === "edit" && (
            <div className="p-5 space-y-4">
              {/* New order number + reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    New Order No.<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="amend-new-order-no"
                    type="text"
                    value={newOrderNo}
                    onChange={(e) => {
                      setNewOrderNo(e.target.value);
                      if (errors.order_no) setErrors((p) => ({ ...p, order_no: "" }));
                    }}
                    className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition
                      ${errors.order_no ? "border-red-600 focus:border-red-500" : "border-slate-700 focus:border-violet-500"}`}
                    placeholder="e.g. PO-001-R1"
                  />
                  {errors.order_no && <p className="mt-1 text-[11px] text-red-400">{errors.order_no}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Amendment Reason<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    id="amend-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (errors.reason) setErrors((p) => ({ ...p, reason: "" }));
                    }}
                    className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition
                      ${errors.reason ? "border-red-600 focus:border-red-500" : "border-slate-700 focus:border-violet-500"}`}
                    placeholder="e.g. Price revision from supplier"
                  />
                  {errors.reason && <p className="mt-1 text-[11px] text-red-400">{errors.reason}</p>}
                </div>
              </div>

              {/* Items table */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  Items
                  <span className="text-slate-600 ml-2 font-normal">(edit quantity / price as needed)</span>
                </p>
                {errors.items && <p className="mb-2 text-[11px] text-red-400">{errors.items}</p>}

                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-medium">Product</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-20">Qty</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-24">Cost ₹</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-16">GST%</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium w-24">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {items.map((it, i) => {
                        const lineTotal = it.quantity * it.cost_price * (1 + it.gst_rate / 100);
                        return (
                          <tr key={i} className="hover:bg-slate-800/30 transition">
                            <td className="px-3 py-2">
                              <p className="text-white font-medium">{it.name}</p>
                              <p className="text-slate-500 font-mono text-[10px]">{it.code}</p>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                id={`amend-qty-${i}`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={it.quantity}
                                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                                className={`w-full bg-slate-800 border rounded px-2 py-1 text-right text-white focus:outline-none focus:border-violet-500 transition
                                  ${errors[`qty_${i}`] ? "border-red-600" : "border-slate-700"}`}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                id={`amend-price-${i}`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={it.cost_price}
                                onChange={(e) => updateItem(i, "cost_price", e.target.value)}
                                className={`w-full bg-slate-800 border rounded px-2 py-1 text-right text-white focus:outline-none focus:border-violet-500 transition
                                  ${errors[`price_${i}`] ? "border-red-600" : "border-slate-700"}`}
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-slate-400">{it.gst_rate}%</td>
                            <td className="px-3 py-2 text-right text-slate-200 font-mono">
                              {fmt(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-800/60 border-t border-slate-700">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-slate-400 text-xs font-medium">
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right text-white font-semibold font-mono">{fmt(grand)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── History Tab ─────────────────────────────────────────────── */}
          {activeTab === "history" && (
            <div className="p-5">
              <p className="text-xs font-medium text-slate-400 mb-3">Amendment chain for this PO</p>
              {historyLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/60" />)}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <span className="material-symbols-outlined block text-2xl mb-2 text-slate-700">history</span>
                  No amendment history found.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((h, idx) => {
                    const isLast = idx === history.length - 1;
                    const badgeCls = STATUS_BADGE[h.status] ?? "bg-slate-700 text-slate-400";
                    return (
                      <div
                        key={h.id}
                        className={`rounded-lg border p-3 flex items-center gap-3 ${
                          isLast ? "border-violet-700/50 bg-violet-900/10" : "border-slate-800 bg-slate-800/30"
                        }`}
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-3 h-3 rounded-full border-2 ${isLast ? "border-violet-500 bg-violet-500" : "border-slate-600 bg-slate-700"}`} />
                          {idx < history.length - 1 && <div className="w-px h-4 bg-slate-700 mt-1" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-white text-xs font-medium">{h.order_no}</span>
                            <RevisionBadge rev={h.amend_revision} />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${badgeCls}`}>
                              {h.status}
                            </span>
                            {isLast && <span className="text-[10px] text-violet-400 font-medium">Current</span>}
                          </div>
                          <div className="flex gap-4 mt-1 text-[11px] text-slate-500">
                            <span>Grand Total: <span className="text-slate-300 font-mono">₹{Number(h.grand_total).toLocaleString("en-IN")}</span></span>
                            {h.amended_at && <span>Amended: {fmtDate(h.amended_at)}</span>}
                            {h.amended_by && <span>By: {h.amended_by}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-800 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 bg-slate-900/80">
          <p className="text-[11px] text-slate-500">
            <span className="material-symbols-outlined text-[12px] align-text-bottom mr-0.5">info</span>
            Original PO will be marked Superseded.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="po-amend-dialog-cancel-btn"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            {activeTab === "edit" && (
              <button
                type="button"
                id="po-amend-dialog-confirm-btn"
                onClick={handleConfirm}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs rounded-lg bg-violet-700 hover:bg-violet-600 text-white font-semibold transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[13px]">progress_activity</span>
                    Amending…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[13px]">edit_document</span>
                    Create Amendment
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
