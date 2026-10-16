/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Requisition (PR / Indent) Workspace
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import { withCapability } from "../../types/architecture.ts";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  Filter,
  RefreshCw,
  Building,
  Layers,
  ShoppingBag,
} from "lucide-react";

interface RequisitionItem {
  id: string;
  product_id: string;
  code: string;
  name: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_ordered: number;
  estimated_cost: number;
  line_total: number;
  notes?: string;
}

interface Requisition {
  id: string;
  requisition_no: string;
  requisition_date: string;
  required_by_date: string;
  department?: string;
  priority: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "CONVERTED_TO_PO";
  justification: string;
  notes?: string;
  estimated_total: number;
  approved_total: number;
  submitted_by?: string;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
  po_id?: string;
  po_no?: string;
  items: RequisitionItem[];
  created_at: string;
}

export const PurchaseRequisitionWorkspaceBase: React.FC = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showConvertToPOModal, setShowConvertToPOModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Create Form State
  const [department, setDepartment] = useState("Store Operations");
  const [requiredByDate, setRequiredByDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [priority, setPriority] = useState("NORMAL");
  const [justification, setJustification] = useState("");
  const [createLines, setCreateLines] = useState<Array<{ product_id: string; code: string; name: string; quantity: number; cost: number }>>([
    { product_id: "prod-sample-1", code: "SKU-FOOT-001", name: "Classic Formal Leather Shoe - Tan", quantity: 10, cost: 850 },
  ]);

  // Convert to PO State
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/purchase/requisitions/");
      setRequisitions(Array.isArray(data) ? data : []);
      if (selectedReq) {
        const refreshed = data.find((r: Requisition) => r.id === selectedReq.id);
        if (refreshed) setSelectedReq(refreshed);
      }
    } catch (e: any) {
      console.error(e);
      setNotification({ type: "error", msg: `Failed to load requisitions: ${e?.message || "Server error"}` });
    } finally {
      setLoading(false);
    }
  }, [selectedReq]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await apiFetchV1("/purchase/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
      if (data && data.length > 0) setSelectedSupplierId(data[0].id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadRequisitions();
    loadSuppliers();
  }, []);

  const handleCreateRequisition = async (submitNow: boolean) => {
    if (!justification.trim()) {
      setNotification({ type: "error", msg: "Justification is required for purchase indents." });
      return;
    }
    if (createLines.length === 0) {
      setNotification({ type: "error", msg: "At least one item line is required." });
      return;
    }

    try {
      const payload = {
        department,
        required_by_date: requiredByDate,
        priority,
        justification,
        items: createLines.map((l) => ({
          product_id: l.product_id,
          code: l.code,
          name: l.name,
          quantity_requested: Number(l.quantity),
          estimated_cost: Number(l.cost),
        })),
      };

      const created = await apiFetchV1("/purchase/requisitions/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (submitNow) {
        await apiFetchV1(`/purchase/requisitions/${created.id}/submit`, { method: "POST" });
      }

      setNotification({
        type: "success",
        msg: `Requisition ${created.requisition_no} created ${submitNow ? "and submitted" : "as draft"}!`,
      });
      setShowCreateModal(false);
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: `Failed to create requisition: ${e?.message || "Error"}` });
    }
  };

  const handleSubmit = async (reqId: string) => {
    try {
      await apiFetchV1(`/purchase/requisitions/${reqId}/submit`, { method: "POST" });
      setNotification({ type: "success", msg: "Requisition submitted for approval." });
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Submit failed" });
    }
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    try {
      await apiFetchV1(`/purchase/requisitions/${selectedReq.id}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotification({ type: "success", msg: `Requisition ${selectedReq.requisition_no} approved!` });
      setShowApproveModal(false);
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Approval failed" });
    }
  };

  const handleReject = async () => {
    if (!selectedReq || !rejectReason.trim()) return;
    try {
      await apiFetchV1(`/purchase/requisitions/${selectedReq.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setNotification({ type: "info", msg: `Requisition ${selectedReq.requisition_no} rejected.` });
      setShowRejectModal(false);
      setRejectReason("");
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Rejection failed" });
    }
  };

  const handleConvertToPO = async () => {
    if (!selectedReq || !selectedSupplierId) return;
    try {
      const po = await apiFetchV1(`/purchase/requisitions/${selectedReq.id}/convert-to-po`, {
        method: "POST",
        body: JSON.stringify({ supplier_id: selectedSupplierId }),
      });
      setNotification({
        type: "success",
        msg: `Successfully converted Requisition to Draft PO ${po.order_no}!`,
      });
      setShowConvertToPOModal(false);
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "PO Conversion failed" });
    }
  };

  const filtered = requisitions.filter((r) => {
    const matchesSearch =
      r.requisition_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.justification.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Draft</span>;
      case "SUBMITTED":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Submitted</span>;
      case "APPROVED":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Approved</span>;
      case "CONVERTED_TO_PO":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">PO Created</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Rejected</span>;
      case "CANCELLED":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">Cancelled</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3 rounded-lg flex items-center justify-between text-sm ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : notification.type === "error"
              ? "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
              : "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800"
          }`}
        >
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-semibold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Purchase Requisitions (Store Indents)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Internal purchase requests, approval workflow, and one-click conversion to Purchase Orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRequisitions}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Indent
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by indent no, department, or justification..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="CONVERTED_TO_PO">PO Created</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Split Workspace View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Requisitions List Table */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Indents ({filtered.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No purchase requisitions found matching current filters.
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedReq?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReq(r)}
                    className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-l-4 border-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                        {r.requisition_no}
                      </span>
                      {getStatusBadge(r.status)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>{r.department || "Operations"}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        ₹{Number(r.estimated_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                      "{r.justification}"
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>Required: {r.required_by_date}</span>
                      <span>{r.items.length} lines</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Requisition Detail Card */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          {selectedReq ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedReq.requisition_no}</h2>
                    {getStatusBadge(selectedReq.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Department: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReq.department}</span> • Required By:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReq.required_by_date}</span>
                  </p>
                </div>

                {/* Workflow Actions */}
                <div className="flex items-center gap-2">
                  {selectedReq.status === "DRAFT" && (
                    <button
                      onClick={() => handleSubmit(selectedReq.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Submit Indent
                    </button>
                  )}

                  {selectedReq.status === "SUBMITTED" && (
                    <>
                      <button
                        onClick={() => setShowApproveModal(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  )}

                  {selectedReq.status === "APPROVED" && (
                    <button
                      onClick={() => setShowConvertToPOModal(true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Convert to PO
                    </button>
                  )}

                  {selectedReq.status === "CONVERTED_TO_PO" && selectedReq.po_no && (
                    <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      PO: {selectedReq.po_no}
                    </div>
                  )}
                </div>
              </div>

              {/* Justification Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Business Justification</span>
                <p className="text-slate-800 dark:text-slate-200">{selectedReq.justification}</p>
                {selectedReq.rejection_reason && (
                  <div className="mt-2 text-rose-700 dark:text-rose-400 font-medium">
                    Rejection Reason: {selectedReq.rejection_reason}
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              <div className="flex-1 overflow-y-auto p-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Line Items ({selectedReq.items.length})
                </span>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5 font-semibold">SKU / Item</th>
                        <th className="p-2.5 font-semibold text-right">Req Qty</th>
                        <th className="p-2.5 font-semibold text-right">Appr Qty</th>
                        <th className="p-2.5 font-semibold text-right">Ord Qty</th>
                        <th className="p-2.5 font-semibold text-right">Est Cost</th>
                        <th className="p-2.5 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedReq.items.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{it.name}</div>
                            <div className="text-[11px] text-slate-400">{it.code}</div>
                          </td>
                          <td className="p-2.5 text-right font-medium">{Number(it.quantity_requested)}</td>
                          <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {Number(it.quantity_approved)}
                          </td>
                          <td className="p-2.5 text-right font-medium text-indigo-600 dark:text-indigo-400">
                            {Number(it.quantity_ordered)}
                          </td>
                          <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">
                            ₹{Number(it.estimated_cost).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            ₹{Number(it.line_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center text-sm">
                <span className="font-medium text-slate-500">Estimated Total Commitment</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  ₹{Number(selectedReq.status === "APPROVED" || selectedReq.status === "CONVERTED_TO_PO" ? selectedReq.approved_total : selectedReq.estimated_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-sm">
              <Layers className="w-12 h-12 mb-3 stroke-[1.5] text-slate-300 dark:text-slate-700" />
              Select a purchase requisition on the left to inspect lines, approve, or convert to a purchase order.
            </div>
          )}
        </div>
      </div>

      {/* CREATE REQUISITION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                New Purchase Requisition (Store Indent)
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Required By Date</label>
                <input
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-semibold block mb-1">Business Justification *</label>
              <textarea
                rows={2}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Reason for requisition (e.g. Stock breach, seasonal footwear assortment reorder)..."
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            {/* Line Items Editor */}
            <div className="text-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold">Required Line Items</span>
                <button
                  type="button"
                  onClick={() =>
                    setCreateLines([
                      ...createLines,
                      { product_id: `prod-${Date.now()}`, code: "SKU-GEN", name: "Footwear / Retail Item", quantity: 5, cost: 500 },
                    ])
                  }
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-lg border-slate-200 dark:border-slate-700">
                {createLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Item Name"
                      value={line.name}
                      onChange={(e) => {
                        const copy = [...createLines];
                        copy[idx].name = e.target.value;
                        setCreateLines(copy);
                      }}
                      className="flex-1 p-1.5 border rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const copy = [...createLines];
                        copy[idx].quantity = Number(e.target.value);
                        setCreateLines(copy);
                      }}
                      className="w-20 p-1.5 border rounded text-right bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="number"
                      placeholder="Cost"
                      value={line.cost}
                      onChange={(e) => {
                        const copy = [...createLines];
                        copy[idx].cost = Number(e.target.value);
                        setCreateLines(copy);
                      }}
                      className="w-24 p-1.5 border rounded text-right bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    />
                    {createLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCreateLines(createLines.filter((_, i) => i !== idx))}
                        className="text-rose-500 font-bold px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateRequisition(false)}
                className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleCreateRequisition(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {showApproveModal && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Approve Requisition {selectedReq.requisition_no}
            </h3>
            <p className="text-xs text-slate-500">
              Confirm authorization of requested quantities for this store indent. Once approved, it can be converted to a Purchase Order or RFQ.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Reject Requisition {selectedReq.requisition_no}
            </h3>
            <div className="text-xs">
              <label className="font-semibold block mb-1">Rejection Reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify reason for rejecting this purchase request..."
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowRejectModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button onClick={handleReject} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT TO PO MODAL */}
      {showConvertToPOModal && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              Convert Indent to Purchase Order
            </h3>
            <p className="text-xs text-slate-500">
              This will generate an official Draft Purchase Order from the approved lines of{" "}
              <span className="font-semibold">{selectedReq.requisition_no}</span>.
            </p>

            <div className="text-xs">
              <label className="font-semibold block mb-1">Target Supplier *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowConvertToPOModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button onClick={handleConvertToPO} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                Generate Draft PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PurchaseRequisitionWorkspace = withCapability(PurchaseRequisitionWorkspaceBase, {
  entity: "purchase",
  capability: "purchase_requisitions",
  role: "CANONICAL",
  canonicalOwner: "src/components/purchase/PurchaseRequisitionWorkspace.tsx",
  description: "Purchase Requisition Indent Creation, Approval, and PO Conversion",
});
