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

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

interface RequisitionDraftLine {
  product_id: string;
  item_id?: string;
  variant_id?: string;
  code: string;
  name: string;
  quantity: string;
  cost: string;
}

interface RequisitionCatalogProduct {
  product_id: string;
  item_id?: string;
  variant_id?: string;
  code: string;
  name: string;
  suggestedCost: number;
}

export function validateRequisitionDraft(
  requiredByDate: string,
  justification: string,
  lines: ReadonlyArray<RequisitionDraftLine>
): string | null {
  if (!requiredByDate) return "Choose when these items are needed.";
  if (!justification.trim()) return "Explain why these items are needed.";
  if (lines.length === 0) return "Add at least one catalog item to this purchase request.";
  if (lines.some((line) => !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
    return "Enter a quantity greater than zero for every item.";
  }
  if (lines.some((line) => !Number.isFinite(Number(line.cost)) || Number(line.cost) <= 0)) {
    return "Enter an estimated unit cost greater than zero for every item.";
  }
  return null;
}

export function validateRequisitionApproval(
  lines: ReadonlyArray<Pick<RequisitionItem, "id" | "quantity_requested">>,
  quantities: Readonly<Record<string, string>>
): string | null {
  if (lines.length === 0) return "This request has no items to approve.";

  const approvedQuantities = lines.map((line) => {
    const value = quantities[line.id];
    return value?.trim() ? Number(value) : Number.NaN;
  });

  if (approvedQuantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
    return "Enter an approved quantity of zero or more for every item.";
  }
  if (approvedQuantities.some((quantity, index) => quantity > Number(lines[index].quantity_requested))) {
    return "An approved quantity cannot exceed the quantity requested.";
  }
  if (approvedQuantities.every((quantity) => quantity === 0)) {
    return "Approve at least one unit, or reject the request with a reason.";
  }
  return null;
}

const getDefaultRequiredByDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
};

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
  const [approvalQuantities, setApprovalQuantities] = useState<Record<string, string>>({});
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvingRequisition, setApprovingRequisition] = useState(false);
  const [rejectFormError, setRejectFormError] = useState<string | null>(null);
  const [rejectingRequisition, setRejectingRequisition] = useState(false);
  const [submittingRequisition, setSubmittingRequisition] = useState(false);
  const [convertingRequisition, setConvertingRequisition] = useState(false);

  // Create Form State
  const [department, setDepartment] = useState("Store Operations");
  const [requiredByDate, setRequiredByDate] = useState(getDefaultRequiredByDate);
  const [priority, setPriority] = useState("NORMAL");
  const [justification, setJustification] = useState("");
  const [createLines, setCreateLines] = useState<RequisitionDraftLine[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<RequisitionCatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [creatingRequisition, setCreatingRequisition] = useState(false);

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

  useEffect(() => {
    if (!showCreateModal) return;

    let active = true;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const data = await apiFetchV1("/inventory/?page=1&page_size=5000&sort=created_at&order=desc");
        const products = Array.isArray(data) ? data : data?.items;
        if (!Array.isArray(products)) {
          throw new Error("The catalog response did not contain a product list.");
        }

        const catalog = products.flatMap((product: any) => {
          if (!product || product.is_active === false || product.is_deleted === true) return [];
          const productId = product.id == null ? "" : String(product.id);
          const code = String(product.code || product.sku || product.barcode || "").trim();
          const name = String(product.name || "").trim();
          if (!productId || !code || !name) return [];

          const knownCosts = [Number(product.buying_price), Number(product.cost_price)];
          const suggestedCost = knownCosts.find((cost) => Number.isFinite(cost) && cost > 0) || 0;
          return [{
            product_id: productId,
            item_id: product.item_id == null ? undefined : String(product.item_id),
            variant_id: product.item_variant_id == null
              ? (product.variant_id == null ? undefined : String(product.variant_id))
              : String(product.item_variant_id),
            code,
            name,
            suggestedCost: Number.isFinite(suggestedCost) && suggestedCost > 0 ? suggestedCost : 0,
          }];
        });
        if (active) setCatalogProducts(catalog);
      } catch (error: unknown) {
        console.error("Failed to load catalog items for purchase request:", error);
        if (active) {
          setCatalogError(error instanceof Error ? error.message : "Unable to load catalog items.");
        }
      } finally {
        if (active) setCatalogLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [showCreateModal, catalogRetry]);

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return catalogProducts
      .filter((product) => !query || `${product.code} ${product.name}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [catalogProducts, catalogSearch]);

  const estimatedRequestTotal = useMemo(
    () => createLines.reduce((total, line) => {
      const quantity = Number(line.quantity);
      const cost = Number(line.cost);
      return total + (
        Number.isFinite(quantity) && quantity > 0 && Number.isFinite(cost) && cost > 0
          ? quantity * cost
          : 0
      );
    }, 0),
    [createLines]
  );

  const openCreateModal = () => {
    setDepartment("Store Operations");
    setRequiredByDate(getDefaultRequiredByDate());
    setPriority("NORMAL");
    setJustification("");
    setCreateLines([]);
    setCatalogSearch("");
    setCreateFormError(null);
    setShowCreateModal(true);
  };

  const addCatalogProduct = (product: RequisitionCatalogProduct) => {
    setCreateLines((lines) => lines.some((line) => line.product_id === product.product_id)
      ? lines
      : [...lines, {
          product_id: product.product_id,
          item_id: product.item_id,
          variant_id: product.variant_id,
          code: product.code,
          name: product.name,
          quantity: "1",
          cost: product.suggestedCost > 0 ? String(product.suggestedCost) : "",
        }]);
    setCreateFormError(null);
  };

  const handleCreateRequisition = async (submitNow: boolean) => {
    const validationError = validateRequisitionDraft(requiredByDate, justification, createLines);
    if (validationError) {
      setCreateFormError(validationError);
      return;
    }

    setCreateFormError(null);
    setCreatingRequisition(true);
    let created: { id: string; requisition_no: string };
    try {
      const payload = {
        department: department.trim() || undefined,
        required_by_date: requiredByDate,
        priority,
        justification: justification.trim(),
        items: createLines.map((l) => ({
          product_id: l.product_id,
          item_id: l.item_id,
          variant_id: l.variant_id,
          code: l.code,
          name: l.name,
          quantity_requested: Number(l.quantity),
          estimated_cost: Number(l.cost),
        })),
      };

      created = await apiFetchV1("/purchase/requisitions/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error: unknown) {
      setCreateFormError(`Could not save purchase request: ${error instanceof Error ? error.message : "Server error"}`);
      setCreatingRequisition(false);
      return;
    }

    if (submitNow) {
      try {
        await apiFetchV1(`/purchase/requisitions/${created.id}/submit`, { method: "POST" });
      } catch (error: unknown) {
        setShowCreateModal(false);
        setCreateLines([]);
        setNotification({
          type: "error",
          msg: `${created.requisition_no} was saved as a draft, but could not be submitted for approval: ${error instanceof Error ? error.message : "Server error"}`,
        });
        loadRequisitions();
        setCreatingRequisition(false);
        return;
      }
    }

    setNotification({
      type: "success",
      msg: `Purchase request ${created.requisition_no} ${submitNow ? "created and submitted for approval" : "saved as a draft"}.`,
    });
    setShowCreateModal(false);
    setCreateLines([]);
    loadRequisitions();
    setCreatingRequisition(false);
  };

  const handleSubmit = async (reqId: string) => {
    setSubmittingRequisition(true);
    try {
      await apiFetchV1(`/purchase/requisitions/${reqId}/submit`, { method: "POST" });
      setNotification({ type: "success", msg: "Requisition submitted for approval." });
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Submit failed" });
    } finally {
      setSubmittingRequisition(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    const validationError = validateRequisitionApproval(selectedReq.items, approvalQuantities);
    if (validationError) {
      setApprovalError(validationError);
      return;
    }

    setApprovalError(null);
    setApprovingRequisition(true);
    try {
      await apiFetchV1(`/purchase/requisitions/${selectedReq.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approved_quantities: Object.fromEntries(
            selectedReq.items.map((item) => [item.id, Number(approvalQuantities[item.id])])
          ),
          notes: approvalNotes.trim() || undefined,
        }),
      });
      setNotification({ type: "success", msg: `Requisition ${selectedReq.requisition_no} approved!` });
      setShowApproveModal(false);
      setApprovalNotes("");
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Approval failed" });
    } finally {
      setApprovingRequisition(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    if (!rejectReason.trim()) {
      setRejectFormError("Enter a reason so the requester knows what needs to change.");
      return;
    }

    setRejectingRequisition(true);
    try {
      await apiFetchV1(`/purchase/requisitions/${selectedReq.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setNotification({ type: "info", msg: `Requisition ${selectedReq.requisition_no} rejected.` });
      setShowRejectModal(false);
      setRejectReason("");
      setRejectFormError(null);
      loadRequisitions();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Rejection failed" });
    } finally {
      setRejectingRequisition(false);
    }
  };

  const handleConvertToPO = async () => {
    if (!selectedReq || !selectedSupplierId) return;
    setConvertingRequisition(true);
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
    } finally {
      setConvertingRequisition(false);
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

  const workflowSteps = [
    { label: "Draft", description: "Request prepared" },
    { label: "Approval", description: "Awaiting review" },
    { label: "Approved", description: "Ready to purchase" },
    { label: "PO created", description: "Draft order generated" },
  ];

  const workflowGuidance: Record<Requisition["status"], { title: string; description: string }> = {
    DRAFT: {
      title: "Next step: submit for approval",
      description: "Check the items, quantities, and need-by date before sending this request to an approver.",
    },
    SUBMITTED: {
      title: "Review requested quantities",
      description: "Approve full or partial quantities, or reject with a reason the requester can act on.",
    },
    APPROVED: {
      title: "Ready to create a purchase order",
      description: "Only approved quantities will be included in the draft purchase order.",
    },
    CONVERTED_TO_PO: {
      title: "Purchase order created",
      description: selectedReq?.po_no
        ? `${selectedReq.po_no} is a draft purchase order ready for the next purchasing step.`
        : "A draft purchase order was created from this request.",
    },
    REJECTED: {
      title: "Request rejected",
      description: "Review the rejection reason below and create a revised request if needed.",
    },
    CANCELLED: {
      title: "Request cancelled",
      description: "This request is closed and cannot continue through approval.",
    },
  };
  const workflowStepIndex = selectedReq
    ? ({
        DRAFT: 0,
        SUBMITTED: 1,
        APPROVED: 2,
        CONVERTED_TO_PO: 3,
        REJECTED: 1,
        CANCELLED: 0,
      } as const)[selectedReq.status]
    : 0;
  const isTerminalRequest = selectedReq?.status === "REJECTED" || selectedReq?.status === "CANCELLED";

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
            Purchase requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Request items for a department, track approvals, and turn approved requests into purchase orders.
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
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New purchase request
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
            placeholder="Search by request number, department, or reason..."
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
              Purchase requests ({filtered.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              requisitions.length === 0 && statusFilter === "ALL" && !searchQuery.trim() ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No purchase requests yet.</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Create a request with the items your department needs, then save it or send it for approval.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    <Plus className="w-4 h-4" />
                    Create purchase request
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No purchase requests match your search and status filters.
                </div>
              )
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
                      <span>Needed by: {r.required_by_date}</span>
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
                    Department: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReq.department || "Operations"}</span> • Needed By:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedReq.required_by_date}</span>
                  </p>
                </div>

                {/* Workflow Actions */}
                <div className="flex items-center gap-2">
                  {selectedReq.status === "DRAFT" && (
                    <button
                      onClick={() => handleSubmit(selectedReq.id)}
                      disabled={submittingRequisition}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {submittingRequisition ? "Submitting..." : "Submit for approval"}
                    </button>
                  )}

                  {selectedReq.status === "SUBMITTED" && (
                    <>
                      <button
                        onClick={() => {
                          setApprovalQuantities(Object.fromEntries(
                            selectedReq.items.map((item) => [item.id, String(item.quantity_requested)])
                          ));
                          setApprovalNotes("");
                          setApprovalError(null);
                          setShowApproveModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectReason("");
                          setRejectFormError(null);
                          setShowRejectModal(true);
                        }}
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

              {isTerminalRequest ? (
                <div
                  role="status"
                  className={`px-4 py-3 border-b text-xs ${
                    selectedReq.status === "REJECTED"
                      ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-200"
                      : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  <p className="font-semibold">{workflowGuidance[selectedReq.status].title}</p>
                  <p className="mt-1">{workflowGuidance[selectedReq.status].description}</p>
                </div>
              ) : (
                <section
                  aria-label="Purchase request progress"
                  className="px-4 py-3 border-b border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {workflowGuidance[selectedReq.status].title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {workflowGuidance[selectedReq.status].description}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                      Step {workflowStepIndex + 1} of {workflowSteps.length}
                    </span>
                  </div>
                  <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {workflowSteps.map((step, index) => {
                      const complete = index < workflowStepIndex;
                      const current = index === workflowStepIndex;
                      return (
                        <li
                          key={step.label}
                          aria-current={current ? "step" : undefined}
                          className={`flex items-start gap-2 rounded-md p-2 ${
                            current
                              ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                              : complete
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {complete ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                          </span>
                          <span>
                            <span className="block text-[11px] font-semibold">{step.label}</span>
                            <span className="block text-[10px] opacity-80">{step.description}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {/* Justification Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Why these items are needed</span>
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
                        <th className="p-2.5 font-semibold text-right">Requested qty</th>
                        <th className="p-2.5 font-semibold text-right">Approved qty</th>
                        <th className="p-2.5 font-semibold text-right">Ordered qty</th>
                        <th className="p-2.5 font-semibold text-right">Est. unit cost</th>
                        <th className="p-2.5 font-semibold text-right">Line total</th>
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
                <span className="font-medium text-slate-500">Estimated total</span>
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                New purchase request
              </h3>
              <button type="button" aria-label="Close purchase request form" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose catalog items, enter quantities and estimated unit costs, then save a draft or send the request for approval.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label htmlFor="requisition-department" className="font-semibold block mb-1">Department</label>
                <input
                  id="requisition-department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="requisition-required-date" className="font-semibold block mb-1">Items needed by *</label>
                <input
                  id="requisition-required-date"
                  type="date"
                  value={requiredByDate}
                  onChange={(e) => {
                    setRequiredByDate(e.target.value);
                    setCreateFormError(null);
                  }}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="requisition-priority" className="font-semibold block mb-1">Priority</label>
                <select
                  id="requisition-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="text-xs">
              <label htmlFor="requisition-justification" className="font-semibold block mb-1">Why are these items needed? *</label>
              <textarea
                id="requisition-justification"
                rows={2}
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  setCreateFormError(null);
                }}
                placeholder="For example: Replenish low stock before the weekend."
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            <section className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold">Items to request *</h4>
                <span className="text-[11px] text-slate-500">{createLines.length} added</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Add items from the active catalog. A known buying or cost price is prefilled when available; otherwise enter an estimate.
              </p>
              <label htmlFor="requisition-catalog-search" className="sr-only">Search catalog items</label>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-2 bg-slate-50 dark:bg-slate-800">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="requisition-catalog-search"
                  type="search"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search by item code or product name"
                  className="w-full py-2 bg-transparent outline-none text-xs"
                />
              </div>

              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {catalogLoading ? (
                  <p className="p-3 text-xs text-slate-500">Loading catalog items...</p>
                ) : catalogError ? (
                  <div className="p-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-rose-600 dark:text-rose-400">Could not load catalog: {catalogError}</p>
                    <button
                      type="button"
                      onClick={() => setCatalogRetry((retry) => retry + 1)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0"
                    >
                      Try again
                    </button>
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No active catalog items are available to add.</p>
                ) : filteredCatalog.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No catalog items match that search.</p>
                ) : (
                  filteredCatalog.map((product) => {
                    const alreadyAdded = createLines.some((line) => line.product_id === product.product_id);
                    return (
                      <div key={product.product_id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{product.name}</div>
                          <div className="text-[10px] text-slate-500">{product.code}</div>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addCatalogProduct(product)}
                          className="px-2 py-1 text-[11px] font-semibold rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                        >
                          {alreadyAdded ? "Added" : "Add item"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {createLines.length > 0 ? (
                <div className="space-y-2">
                  {createLines.map((line) => (
                    <div key={line.product_id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_auto] items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{line.name}</div>
                        <div className="text-[10px] text-slate-500">{line.code}</div>
                      </div>
                      <label className="text-[10px] text-slate-500">
                        Quantity
                        <input
                          aria-label={`Quantity for ${line.name} (${line.code})`}
                          type="number"
                          min="0.0001"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => {
                            setCreateLines((lines) => lines.map((item) =>
                              item.product_id === line.product_id ? { ...item, quantity: e.target.value } : item
                            ));
                            setCreateFormError(null);
                          }}
                          className="mt-1 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Est. unit cost (₹)
                        <input
                          aria-label={`Estimated unit cost for ${line.name} (${line.code})`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.cost}
                          onChange={(e) => {
                            setCreateLines((lines) => lines.map((item) =>
                              item.product_id === line.product_id ? { ...item, cost: e.target.value } : item
                            ));
                            setCreateFormError(null);
                          }}
                          className="mt-1 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-right text-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => {
                          setCreateLines((lines) => lines.filter((item) => item.product_id !== line.product_id));
                          setCreateFormError(null);
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-end text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Estimated subtotal: ₹{estimatedRequestTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">No items added. Search the catalog and add at least one.</p>
              )}
            </section>

            {createFormError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{createFormError}</p>}

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
                disabled={creatingRequisition || catalogLoading || createLines.length === 0}
                className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingRequisition ? "Saving..." : "Save draft"}
              </button>
              <button
                type="button"
                onClick={() => handleCreateRequisition(true)}
                disabled={creatingRequisition || catalogLoading || createLines.length === 0}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingRequisition ? "Submitting..." : "Submit for approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {showApproveModal && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-requisition-title"
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 id="approve-requisition-title" className="font-bold text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Review quantities for {selectedReq.requisition_no}
            </h3>
            <p className="text-xs text-slate-500">
              Set the quantity approved for each item. Use zero to exclude an item; at least one approved quantity must be greater than zero.
            </p>
            <div className="space-y-2">
              {selectedReq.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem_7.5rem] items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-500">{item.code}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Requested {Number(item.quantity_requested)} · ₹{Number(item.estimated_cost).toFixed(2)} per unit
                    </p>
                  </div>
                  <div>
                    <label htmlFor={`approved-quantity-${item.id}`} className="text-[10px] text-slate-500">Approved qty</label>
                    <input
                      id={`approved-quantity-${item.id}`}
                      aria-label={`Approved quantity for ${item.name}`}
                      type="number"
                      min="0"
                      max={Number(item.quantity_requested)}
                      step="any"
                      value={approvalQuantities[item.id] ?? ""}
                      onChange={(event) => {
                        setApprovalQuantities((quantities) => ({ ...quantities, [item.id]: event.target.value }));
                        setApprovalError(null);
                      }}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                    />
                  </div>
                  <p className="text-right font-semibold text-slate-700 dark:text-slate-200">
                    ₹{(
                      Number(approvalQuantities[item.id] ?? item.quantity_requested) *
                      Number(item.estimated_cost)
                    ).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
              Estimated approved total: ₹{selectedReq.items.reduce(
                (total, item) =>
                  total +
                  Number(approvalQuantities[item.id] ?? item.quantity_requested) *
                    Number(item.estimated_cost),
                0
              ).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="text-xs">
              <label htmlFor="requisition-approval-notes" className="font-semibold block mb-1">Approval notes (optional)</label>
              <textarea
                id="requisition-approval-notes"
                rows={2}
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                placeholder="Add context for the requester or purchasing team."
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            {approvalError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{approvalError}</p>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setApprovalError(null);
                }}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approvingRequisition}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approvingRequisition ? "Approving..." : "Confirm approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && selectedReq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-requisition-title"
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <h3 id="reject-requisition-title" className="font-bold text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Reject {selectedReq.requisition_no}
            </h3>
            <p className="text-xs text-slate-500">
              Explain why this request cannot be approved so the requester knows what needs to change.
            </p>
            <div className="text-xs">
              <label htmlFor="requisition-rejection-reason" className="font-semibold block mb-1">Rejection reason *</label>
              <textarea
                id="requisition-rejection-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectFormError(null);
                }}
                placeholder="For example: Please update the quantity to match the current stock plan."
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>
            {rejectFormError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{rejectFormError}</p>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectFormError(null);
                }}
                className="px-3 py-1.5 border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejectingRequisition || !rejectReason.trim()}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectingRequisition ? "Rejecting..." : "Confirm rejection"}
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
