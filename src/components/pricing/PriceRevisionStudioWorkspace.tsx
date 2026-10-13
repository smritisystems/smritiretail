/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.2
 * Created      : 2026-10-13
 * Modified     : 2026-10-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Price Revision Studio Workspace (Phase 5)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  RefreshCw,
  Search,
  ShieldCheck,
  FileText,
  Layers,
  History,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  PlayCircle,
  Sparkles,
  Info,
  DollarSign,
  Package,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface PriceRevisionRecord {
  id: string;
  company_id: string;
  branch_id?: string;
  item_id: string;
  variant_id: string;
  item_code?: string;
  variant_sku?: string;
  item_name?: string;
  price_book_id?: string;
  price_book_code?: string;
  currency: string;
  previous_mrp: number;
  revised_mrp: number;
  previous_selling_price: number;
  revised_selling_price: number;
  previous_cost_price?: number;
  revised_cost_price?: number;
  margin_pct?: number;
  effective_from: string;
  effective_to?: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SCHEDULED" | "ACTIVE" | "SUPERSEDED" | "EXPIRED";
  reason_code: string;
  justification?: string;
  approval_required: boolean;
  approval_request_id?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  source: string;
  batch_id?: string;
  created_by?: string;
  created_at?: string;
}

export interface PriceRevisionStudioWorkspaceProps {
  currentUser?: { role: string; name?: string; id?: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigateTab?: (tab: string) => void;
}

const fmt = (n?: number | null) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString("en-IN")} ${dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return d;
  }
};

export const PriceRevisionStudioWorkspace: React.FC<PriceRevisionStudioWorkspaceProps> = ({
  currentUser,
  onNotification,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<"TIMELINE" | "NEW" | "APPROVALS" | "BULK">("TIMELINE");
  const [loading, setLoading] = useState<boolean>(false);
  const [revisions, setRevisions] = useState<PriceRevisionRecord[]>([]);

  // Search & Filters for Timeline
  const [timelineSearch, setTimelineSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [reasonFilter, setReasonFilter] = useState<string>("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Inspector Drawer for Selected Revision Details
  const [inspectedRevision, setInspectedRevision] = useState<PriceRevisionRecord | null>(null);

  // New Revision Form State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [revisedMrp, setRevisedMrp] = useState<string>("");
  const [revisedSp, setRevisedSp] = useState<string>("");
  const [revisedCp, setRevisedCp] = useState<string>("");
  const [effectiveTiming, setEffectiveTiming] = useState<"NOW" | "SCHEDULED">("NOW");
  const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>("MANUAL_REVISION");
  const [justification, setJustification] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Approval Modal Prompt
  const [approvalTarget, setApprovalTarget] = useState<PriceRevisionRecord | null>(null);
  const [supervisorPin, setSupervisorPin] = useState<string>("");
  const [rejectionTarget, setRejectionTarget] = useState<PriceRevisionRecord | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("");

  // Bulk Import State
  const [bulkCsvText, setBulkCsvText] = useState<string>("");
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);

  // Activating scheduled revisions indicator
  const [isActivatingScheduled, setIsActivatingScheduled] = useState<boolean>(false);

  // Fetch Revisions from Authoritative Backend
  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    try {
      // Query up to 300 recent revisions for live client-side fast search/filter and pagination
      const data = await apiFetchV1<PriceRevisionRecord[]>("/pricing/revisions?limit=300");
      setRevisions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      onNotification?.("Error", err?.message || "Failed to load price revisions.", "error");
    } finally {
      setLoading(false);
    }
  }, [onNotification]);

  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  // Product Lookup (Supports exact Barcode / SKU resolution or fuzzy search)
  const handleSearchProduct = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearchingProduct(true);
    try {
      // Step 1: Attempt instantaneous product resolution via /products/resolve
      try {
        const resolveRes = await apiFetchV1<any>(`/products/resolve?identifier=${encodeURIComponent(q)}`);
        if (resolveRes && resolveRes.success && (resolveRes.product_id || resolveRes.variant_id)) {
          selectProduct({
            id: resolveRes.variant_id || resolveRes.product_id,
            item_id: resolveRes.item_id || resolveRes.product_id,
            name: resolveRes.name,
            code: resolveRes.sku || resolveRes.product_id,
            sku: resolveRes.sku,
            barcode: resolveRes.barcode,
            price: Number(resolveRes.selling_price || 0),
            mrp: Number(resolveRes.mrp || 0),
            cost_price: Number(resolveRes.cost_price || 0),
          });
          setIsSearchingProduct(false);
          return;
        }
      } catch {
        // Fall back to fuzzy catalogue search if exact resolve yields not found
      }

      // Step 2: Fall back to catalogue search
      const res = await apiFetchV1<any>(`/products?q=${encodeURIComponent(q)}&page=1&page_size=8`);
      const items = Array.isArray(res) ? res : res?.items || [];
      setSearchResults(items);
      if (items.length === 1) {
        selectProduct(items[0]);
      }
    } catch (err: any) {
      onNotification?.("Search Error", err?.message || "Failed to search product.", "error");
    } finally {
      setIsSearchingProduct(false);
    }
  };

  const selectProduct = (p: any) => {
    setSelectedVariant(p);
    setSearchResults([]);
    setRevisedMrp(String(p.mrp || p.price || 0));
    setRevisedSp(String(p.price || 0));
    setRevisedCp(String(p.cost_price || p.buying_price || ""));
  };

  // Price calculations & Statutory Invariant Evaluation
  const curMrp = selectedVariant ? Number(selectedVariant.mrp || selectedVariant.price || 0) : 0;
  const curSp = selectedVariant ? Number(selectedVariant.price || 0) : 0;
  const curCp = selectedVariant ? Number(selectedVariant.cost_price || 0) : 0;

  const newMrpNum = parseFloat(revisedMrp) || 0;
  const newSpNum = parseFloat(revisedSp) || 0;
  const newCpNum = parseFloat(revisedCp) || 0;

  const spDelta = curSp > 0 ? ((newSpNum - curSp) / curSp) * 100 : 0;
  const mrpDelta = curMrp > 0 ? ((newMrpNum - curMrp) / curMrp) * 100 : 0;
  const newMarginPct = newSpNum > 0 ? ((newSpNum - newCpNum) / newSpNum) * 100 : 0;
  const isCeilingViolation = newSpNum > newMrpNum;

  // Submit Single Revision
  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) {
      onNotification?.("Validation", "Please select a product or variant.", "warning");
      return;
    }
    if (isCeilingViolation) {
      onNotification?.(
        "Statutory Violation",
        `Selling price (${fmt(newSpNum)}) cannot exceed statutory MRP (${fmt(newMrpNum)}).`,
        "error"
      );
      return;
    }

    let effFromDate: string | undefined = undefined;
    if (effectiveTiming === "SCHEDULED") {
      if (!scheduledDateTime) {
        onNotification?.("Validation", "Please choose a future effective date and time.", "warning");
        return;
      }
      effFromDate = new Date(scheduledDateTime).toISOString();
    }

    setIsSubmitting(true);
    try {
      const payload = {
        variant_id: selectedVariant.id,
        item_id: selectedVariant.item_id || selectedVariant.id,
        revised_mrp: newMrpNum,
        revised_selling_price: newSpNum,
        revised_cost_price: newCpNum > 0 ? newCpNum : undefined,
        effective_from: effFromDate,
        reason_code: reasonCode,
        justification: justification.trim() || undefined,
        auto_approve_if_eligible: true,
      };

      const res = await apiFetchV1<PriceRevisionRecord>("/pricing/revisions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onNotification?.(
        "Revision Created",
        `Price revision successfully recorded. Status: ${res.status}`,
        "success"
      );
      setSelectedVariant(null);
      setSearchQuery("");
      setJustification("");
      await fetchRevisions();
      setActiveTab("TIMELINE");
    } catch (err: any) {
      onNotification?.("Submission Failed", err?.message || "Failed to create price revision.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve Action
  const handleApprove = async () => {
    if (!approvalTarget) return;
    try {
      await apiFetchV1(`/pricing/revisions/${approvalTarget.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          action: "APPROVE",
          supervisor_pin: supervisorPin.trim() || undefined,
        }),
      });
      onNotification?.("Approved", `Revision ${approvalTarget.id} approved successfully.`, "success");
      setApprovalTarget(null);
      setSupervisorPin("");
      fetchRevisions();
    } catch (err: any) {
      onNotification?.("Approval Failed", err?.message || "Failed to approve revision.", "error");
    }
  };

  // Reject Action
  const handleReject = async () => {
    if (!rejectionTarget || !rejectionReasonInput.trim()) {
      onNotification?.("Validation", "Rejection reason is required.", "warning");
      return;
    }
    try {
      await apiFetchV1(`/pricing/revisions/${rejectionTarget.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          action: "REJECT",
          rejection_reason: rejectionReasonInput.trim(),
        }),
      });
      onNotification?.("Rejected", `Revision ${rejectionTarget.id} rejected.`, "info");
      setRejectionTarget(null);
      setRejectionReasonInput("");
      fetchRevisions();
    } catch (err: any) {
      onNotification?.("Rejection Failed", err?.message || "Failed to reject revision.", "error");
    }
  };

  // Scheduled Activation Trigger
  const handleActivateScheduled = async () => {
    setIsActivatingScheduled(true);
    try {
      const res = await apiFetchV1<any>("/pricing/revisions/activate-scheduled", {
        method: "POST",
      });
      const count = res?.activated_count ?? 0;
      onNotification?.(
        "Scheduled Activation",
        count > 0
          ? `Successfully activated ${count} scheduled revision(s) whose effective datetime has arrived.`
          : "No scheduled revisions are due for activation right now.",
        count > 0 ? "success" : "info"
      );
      fetchRevisions();
    } catch (err: any) {
      onNotification?.("Activation Failed", err?.message || "Failed to activate scheduled revisions.", "error");
    } finally {
      setIsActivatingScheduled(false);
    }
  };

  // Bulk CSV/TSV Parser with Statutory Pre-validation
  const handleParseBulkCsv = () => {
    const lines = bulkCsvText.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows: any[] = [];
    const errs: string[] = [];

    lines.forEach((line, idx) => {
      // Header skip
      if (idx === 0 && (line.toLowerCase().includes("sku") || line.toLowerCase().includes("barcode"))) return;

      // Split by comma or tab
      const parts = line.includes("\t")
        ? line.split("\t").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());

      if (parts.length < 3) {
        errs.push(`Row ${idx + 1}: Insufficient columns. Minimum required: sku_or_barcode, revised_mrp, revised_sp`);
        return;
      }
      const [sku, mrpStr, spStr, cpStr, effStr, reason] = parts;
      const mrp = parseFloat(mrpStr);
      const sp = parseFloat(spStr);
      const cp = cpStr ? parseFloat(cpStr) : undefined;

      if (isNaN(mrp) || isNaN(sp)) {
        errs.push(`Row ${idx + 1} (${sku}): Invalid numeric price.`);
        return;
      }
      if (sp > mrp) {
        errs.push(`Row ${idx + 1} (${sku}): Statutory Violation! Selling Price (${fmt(sp)}) cannot exceed MRP (${fmt(mrp)}).`);
      }

      rows.push({
        sku_or_barcode: sku,
        revised_mrp: mrp,
        revised_selling_price: sp,
        revised_cost_price: cp,
        effective_from: effStr ? new Date(effStr).toISOString() : undefined,
        reason_code: reason || "BULK_IMPORT",
        is_valid: sp <= mrp,
      });
    });

    setBulkParsedRows(rows);
    setBulkErrors(errs);
  };

  // Execute Bulk Upload
  const handleExecuteBulk = async () => {
    if (bulkParsedRows.length === 0) {
      onNotification?.("Validation", "No parsed rows to upload.", "warning");
      return;
    }
    if (bulkErrors.length > 0) {
      onNotification?.("Validation Error", "Please resolve statutory errors before submitting.", "error");
      return;
    }

    setIsProcessingBulk(true);
    try {
      const itemsToUpload = bulkParsedRows.map((r) => ({
        sku_or_barcode: r.sku_or_barcode,
        revised_mrp: r.revised_mrp,
        revised_selling_price: r.revised_selling_price,
        revised_cost_price: r.revised_cost_price,
        effective_from: r.effective_from,
        reason_code: r.reason_code,
      }));

      const res = await apiFetchV1<any>("/pricing/revisions/bulk", {
        method: "POST",
        body: JSON.stringify({ items: itemsToUpload }),
      });

      onNotification?.(
        "Bulk Revisions Processed",
        `Batch ${res.batch_id || "OK"}: ${res.approved_count || 0} approved, ${res.pending_count || 0} pending approval.`,
        "success"
      );
      setBulkCsvText("");
      setBulkParsedRows([]);
      setBulkErrors([]);
      await fetchRevisions();
      setActiveTab("TIMELINE");
    } catch (err: any) {
      onNotification?.("Bulk Upload Error", err?.message || "Failed to process bulk revisions.", "error");
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // KPI Metrics Calculations
  const kpis = useMemo(() => {
    const total = revisions.length;
    const active = revisions.filter((r) => r.status === "ACTIVE").length;
    const scheduled = revisions.filter((r) => r.status === "SCHEDULED").length;
    const pending = revisions.filter((r) => r.status === "PENDING_APPROVAL").length;
    const rejected = revisions.filter((r) => r.status === "REJECTED").length;
    return { total, active, scheduled, pending, rejected };
  }, [revisions]);

  // Filtered Revisions List
  const filteredRevisions = useMemo(() => {
    return revisions.filter((r) => {
      // Status Filter
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      // Reason Code Filter
      if (reasonFilter !== "ALL" && r.reason_code !== reasonFilter) return false;
      // Search Filter
      if (timelineSearch.trim()) {
        const q = timelineSearch.toLowerCase();
        const matchesId = r.id.toLowerCase().includes(q);
        const matchesSku = (r.variant_sku || "").toLowerCase().includes(q);
        const matchesName = (r.item_name || "").toLowerCase().includes(q);
        const matchesCode = (r.item_code || "").toLowerCase().includes(q);
        const matchesReason = (r.reason_code || "").toLowerCase().includes(q);
        if (!matchesId && !matchesSku && !matchesName && !matchesCode && !matchesReason) {
          return false;
        }
      }
      return true;
    });
  }, [revisions, statusFilter, reasonFilter, timelineSearch]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredRevisions.length / pageSize));
  const paginatedRevisions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRevisions.slice(start, start + pageSize);
  }, [filteredRevisions, currentPage, pageSize]);

  const pendingApprovals = useMemo(() => {
    return revisions.filter((r) => r.status === "PENDING_APPROVAL");
  }, [revisions]);

  const statusBadge = (st: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
      SCHEDULED: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
      PENDING_APPROVAL: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
      APPROVED: { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
      SUPERSEDED: { bg: "bg-slate-100 dark:bg-slate-800/60", text: "text-slate-600 dark:text-slate-400", border: "border-slate-300 dark:border-slate-700" },
      REJECTED: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
      EXPIRED: { bg: "bg-slate-100 dark:bg-slate-800/40", text: "text-slate-500 dark:text-slate-500", border: "border-slate-200 dark:border-slate-800" },
      DRAFT: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    };
    const s = map[st] || { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
        {st}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans select-none overflow-hidden">
      
      {/* ── TOP HEADER & ACTIONS ── */}
      <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Price Revision Studio
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                Authoritative Temporal Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live MRP, Commercial Selling Price & Inward Cost Price Revisions with Statutory Ceiling Protection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleActivateScheduled}
            disabled={isActivatingScheduled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
            title="Check and activate future revisions whose effective date/time is reached"
          >
            <PlayCircle className={`w-3.5 h-3.5 ${isActivatingScheduled ? "animate-spin" : ""}`} />
            <span>Activate Due Revisions</span>
          </button>

          <button
            type="button"
            onClick={fetchRevisions}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Reload live revisions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── KPI COUNTERS ── */}
      <div className="px-6 py-3 bg-white/70 dark:bg-[#0f172a]/70 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Total Revisions</div>
            <div className="text-base font-bold text-slate-900 dark:text-white font-mono">{kpis.total}</div>
          </div>
          <History className="w-5 h-5 text-slate-400" />
        </div>

        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Active Now</div>
            <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">{kpis.active}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Scheduled</div>
            <div className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">{kpis.scheduled}</div>
          </div>
          <Clock className="w-5 h-5 text-blue-500" />
        </div>

        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Pending Approval</div>
            <div className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">{kpis.pending}</div>
          </div>
          <ShieldCheck className="w-5 h-5 text-amber-500" />
        </div>

        <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Rejected</div>
            <div className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">{kpis.rejected}</div>
          </div>
          <XCircle className="w-5 h-5 text-rose-500" />
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("TIMELINE")}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "TIMELINE"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <History className="w-4 h-4" />
          Revision Timeline &amp; History ({filteredRevisions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("NEW")}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "NEW"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Create Price Revision
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("APPROVALS")}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "APPROVALS"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Approval Queue
          {pendingApprovals.length > 0 && (
            <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("BULK")}
          className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "BULK"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Upload className="w-4 h-4" />
          Bulk CSV/TSV Import
        </button>
      </div>

      {/* ── WORKSPACE TAB BODY ── */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: REVISION TIMELINE & HISTORY (Paginated Master Grid)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "TIMELINE" && (
          <div className="space-y-4">
            
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0f172a] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search input */}
                <div className="relative min-w-[260px] flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={timelineSearch}
                    onChange={(e) => {
                      setTimelineSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search Revision ID, SKU, Barcode, Item Name..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {timelineSearch && (
                    <button
                      type="button"
                      onClick={() => setTimelineSearch("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-1.5 text-xs">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="ALL">All Statuses ({revisions.length})</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="SUPERSEDED">SUPERSEDED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                {/* Reason Filter */}
                <select
                  value={reasonFilter}
                  onChange={(e) => {
                    setReasonFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="ALL">All Reason Codes</option>
                  <option value="MANUAL_REVISION">Manual Revision</option>
                  <option value="SUPPLIER_RATE_HIKE">Supplier / Inward Hike</option>
                  <option value="SEASONAL_PRICE_DROP">Seasonal Price Drop</option>
                  <option value="COMPETITOR_PRICE_MATCH">Competitor Match</option>
                  <option value="STATUTORY_TAX_ADJUSTMENT">Statutory GST Adjustment</option>
                  <option value="CLEARANCE_PROMO">Clearance Promo</option>
                </select>
              </div>

              {/* Page size dropdown */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Table or Empty State */}
            {filteredRevisions.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-[#0f172a] border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-3">
                <Package className="w-10 h-10 mx-auto text-slate-400 stroke-1" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Price Revisions Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {timelineSearch || statusFilter !== "ALL" || reasonFilter !== "ALL"
                    ? "No revisions match your filter criteria. Try adjusting the search keyword or filter."
                    : "No price revision records exist in this company database yet. Create your first revision below."}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("NEW")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl"
                >
                  Create New Revision
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Revision ID</th>
                        <th className="p-3">Item / SKU</th>
                        <th className="p-3">MRP (Old &rarr; New)</th>
                        <th className="p-3">Selling Price (Old &rarr; New)</th>
                        <th className="p-3">Cost Price / Margin</th>
                        <th className="p-3">Effective Date</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {paginatedRevisions.map((r) => {
                        const mrpDiff = r.previous_mrp > 0 ? ((r.revised_mrp - r.previous_mrp) / r.previous_mrp) * 100 : 0;
                        const spDiff = r.previous_selling_price > 0 ? ((r.revised_selling_price - r.previous_selling_price) / r.previous_selling_price) * 100 : 0;

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                          >
                            <td className="p-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {r.id}
                            </td>

                            <td className="p-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {r.item_name || r.item_code || r.variant_sku || r.variant_id}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                SKU: {r.variant_sku || "N/A"}
                              </div>
                            </td>

                            <td className="p-3 text-slate-500 font-mono">
                              <span className="line-through">{fmt(r.previous_mrp)}</span> &rarr;{" "}
                              <span className="font-bold text-slate-900 dark:text-white">{fmt(r.revised_mrp)}</span>
                              {mrpDiff !== 0 && (
                                <span className={`ml-1.5 text-[10px] font-bold ${mrpDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                  {mrpDiff > 0 ? `+${mrpDiff.toFixed(1)}%` : `${mrpDiff.toFixed(1)}%`}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-slate-500 font-mono">
                              <span className="line-through">{fmt(r.previous_selling_price)}</span> &rarr;{" "}
                              <span className="font-bold text-blue-600 dark:text-blue-400">{fmt(r.revised_selling_price)}</span>
                              {spDiff !== 0 && (
                                <span className={`ml-1.5 text-[10px] font-bold ${spDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                  {spDiff > 0 ? `+${spDiff.toFixed(1)}%` : `${spDiff.toFixed(1)}%`}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-slate-500 font-mono">
                              <div>{fmt(r.revised_cost_price)}</div>
                              {r.margin_pct !== undefined && r.margin_pct !== null && (
                                <div className="text-[10px] font-semibold text-slate-400">
                                  Margin: {r.margin_pct.toFixed(1)}%
                                </div>
                              )}
                            </td>

                            <td className="p-3 text-slate-500">
                              <div>{fmtDate(r.effective_from)}</div>
                              {r.effective_to && <div className="text-[10px] text-slate-400">to {fmtDate(r.effective_to)}</div>}
                            </td>

                            <td className="p-3">{statusBadge(r.status)}</td>

                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              <div className="font-medium">{r.reason_code}</div>
                              {r.justification && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.justification}>
                                  {r.justification}
                                </div>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectedRevision(r)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="View detailed audit record"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    Showing{" "}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {(currentPage - 1) * pageSize + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {Math.min(currentPage * pageSize, filteredRevisions.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {filteredRevisions.length}
                    </span>{" "}
                    revisions
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: CREATE PRICE REVISION STUDIO (Form with Live Product Search)
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "NEW" && (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Product Lookup Card */}
            <div className="p-5 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-500" />
                    Select Item / Variant for Price Revision
                  </h3>
                  <p className="text-xs text-slate-500">
                    Scan thermal barcode label or search by SKU / Item Name
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchProduct()}
                    placeholder="Scan Barcode or enter SKU / Item Name..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchProduct}
                  disabled={isSearchingProduct}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                >
                  {isSearchingProduct ? "Searching..." : "Lookup"}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-800 shadow-lg animate-in fade-in">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => selectProduct(item)}
                      className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          SKU: {item.sku || item.code} | Barcode: {item.barcode || "N/A"}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmt(item.price)}</div>
                        <div className="text-[10px] text-slate-400">MRP: {fmt(item.mrp || item.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Product Banner */}
              {selectedVariant && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between animate-in fade-in">
                  <div>
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      {selectedVariant.name || selectedVariant.code}
                    </div>
                    <div className="text-[11px] text-blue-700 dark:text-blue-400 font-mono">
                      ID: {selectedVariant.id} | SKU: {selectedVariant.sku || selectedVariant.code}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Change Product
                  </button>
                </div>
              )}
            </div>

            {/* Active Revision Configuration Form */}
            {selectedVariant && (
              <form onSubmit={handleSubmitRevision} className="space-y-6">
                
                {/* Before vs After Price Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* MRP Box */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xs space-y-2">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Statutory MRP</div>
                    <div className="text-xs text-slate-500">
                      Current: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{fmt(curMrp)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={revisedMrp}
                        onChange={(e) => setRevisedMrp(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    {curMrp > 0 && newMrpNum !== curMrp && (
                      <div className={`text-[11px] font-semibold flex items-center gap-1 ${mrpDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {mrpDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {mrpDelta > 0 ? `+${mrpDelta.toFixed(1)}%` : `${mrpDelta.toFixed(1)}%`}
                      </div>
                    )}
                  </div>

                  {/* Selling Price Box */}
                  <div className={`p-4 rounded-xl border ${isCeilingViolation ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/30" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]"} shadow-xs space-y-2`}>
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Selling Price</div>
                    <div className="text-xs text-slate-500">
                      Current: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{fmt(curSp)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={revisedSp}
                        onChange={(e) => setRevisedSp(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    {curSp > 0 && newSpNum !== curSp && (
                      <div className={`text-[11px] font-semibold flex items-center gap-1 ${spDelta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {spDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {spDelta > 0 ? `+${spDelta.toFixed(1)}%` : `${spDelta.toFixed(1)}%`}
                      </div>
                    )}
                  </div>

                  {/* Cost Price Box */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-xs space-y-2">
                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Cost Price (Inward)</div>
                    <div className="text-xs text-slate-500">
                      Current: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{fmt(curCp)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={revisedCp}
                        onChange={(e) => setRevisedCp(e.target.value)}
                        placeholder="Optional"
                        className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    {newMarginPct !== 0 && (
                      <div className="text-[11px] text-slate-500 font-medium">
                        Margin: <span className="font-bold text-slate-800 dark:text-slate-200">{newMarginPct.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statutory Ceiling Violation Warning */}
                {isCeilingViolation && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                    <div>
                      <span className="font-bold">Statutory Ceiling Invariant Violation: </span>
                      Commercial Selling Price ({fmt(newSpNum)}) cannot exceed the statutory Maximum Retail Price ({fmt(newMrpNum)}).
                    </div>
                  </div>
                )}

                {/* Timing & Reason Form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Activation Timing */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] space-y-3">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      Activation Timing
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="effectiveTiming"
                          checked={effectiveTiming === "NOW"}
                          onChange={() => setEffectiveTiming("NOW")}
                          className="text-blue-600"
                        />
                        <span>Effective Immediately</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="effectiveTiming"
                          checked={effectiveTiming === "SCHEDULED"}
                          onChange={() => setEffectiveTiming("SCHEDULED")}
                          className="text-blue-600"
                        />
                        <span>Future Scheduled</span>
                      </label>
                    </div>

                    {effectiveTiming === "SCHEDULED" && (
                      <div className="space-y-1 pt-1">
                        <label className="text-[11px] text-slate-500">Scheduled Date &amp; Time:</label>
                        <input
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Reason Classification */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] space-y-3">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Reason Classification
                    </label>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="MANUAL_REVISION">Manual Revision</option>
                      <option value="SUPPLIER_RATE_HIKE">Supplier / Inward Rate Hike</option>
                      <option value="SEASONAL_PRICE_DROP">Seasonal Price Reduction</option>
                      <option value="COMPETITOR_PRICE_MATCH">Competitor Price Match</option>
                      <option value="STATUTORY_TAX_ADJUSTMENT">Statutory / GST Slabs Change</option>
                      <option value="CLEARANCE_PROMO">End of Season Clearance</option>
                    </select>

                    <input
                      type="text"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="Justification notes (optional)..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Submit Action Bar */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isCeilingViolation}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
                  >
                    {isSubmitting ? "Creating Revision..." : "Submit Price Revision"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: APPROVAL QUEUE
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "APPROVALS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Pending Approvals ({pendingApprovals.length})
              </h3>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-[#0f172a] border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-slate-400 text-xs space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500" />
                <div className="font-bold text-slate-700 dark:text-slate-300">Approval Queue is Clear</div>
                <p>All revisions are approved, active, or auto-cleared. No pending items require supervisor review.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Revision ID</th>
                      <th className="p-3">Item / SKU</th>
                      <th className="p-3">Current MRP / SP</th>
                      <th className="p-3">Proposed MRP / SP</th>
                      <th className="p-3">Effective Date</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Submitter</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {pendingApprovals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="p-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {r.id}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{r.item_name || r.variant_sku || r.variant_id}</div>
                          <div className="text-[11px] text-slate-400 font-mono">SKU: {r.variant_sku || "N/A"}</div>
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          {fmt(r.previous_mrp)} / {fmt(r.previous_selling_price)}
                        </td>
                        <td className="p-3 font-semibold text-blue-600 dark:text-blue-400 font-mono">
                          {fmt(r.revised_mrp)} / {fmt(r.revised_selling_price)}
                        </td>
                        <td className="p-3 text-slate-500">
                          {fmtDate(r.effective_from)}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          <div>{r.reason_code}</div>
                          {r.justification && <div className="text-[10px] text-slate-400 truncate max-w-xs">{r.justification}</div>}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{r.created_by || "system"}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setApprovalTarget(r)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectionTarget(r)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-xs"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: BULK CSV/TSV IMPORT & PRE-VALIDATION
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "BULK" && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="p-5 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-500" />
                    Paste CSV or TSV Data for Bulk Price Revisions
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Header: <code className="text-blue-600 font-mono">sku_or_barcode, revised_mrp, revised_selling_price, revised_cost_price, effective_from, reason_code</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleParseBulkCsv}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Validate &amp; Preview
                </button>
              </div>

              <textarea
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder={`SKU-1001, 500.00, 450.00, 300.00, 2026-11-01T00:00:00Z, SEASONAL_DISCOUNT\nSKU-1002, 1200.00, 999.00, 750.00, , MANUAL_REVISION`}
                rows={6}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Validation Errors */}
            {bulkErrors.length > 0 && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Statutory Pre-Validation Errors ({bulkErrors.length})
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {bulkErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Parsed Preview Table */}
            {bulkParsedRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Parsed Rows Preview ({bulkParsedRows.length} items ready)
                  </div>
                  <button
                    type="button"
                    onClick={handleExecuteBulk}
                    disabled={isProcessingBulk || bulkErrors.length > 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                  >
                    {isProcessingBulk ? "Processing..." : "Execute Bulk Revision"}
                  </button>
                </div>

                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">Identifier</th>
                        <th className="p-2.5">Revised MRP</th>
                        <th className="p-2.5">Revised SP</th>
                        <th className="p-2.5">Revised CP</th>
                        <th className="p-2.5">Effective Date</th>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
                      {bulkParsedRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{row.sku_or_barcode}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{fmt(row.revised_mrp)}</td>
                          <td className="p-2.5 font-semibold text-blue-600 dark:text-blue-400">{fmt(row.revised_selling_price)}</td>
                          <td className="p-2.5 text-slate-500">{fmt(row.revised_cost_price)}</td>
                          <td className="p-2.5 text-slate-500">{row.effective_from || "Immediate (Now)"}</td>
                          <td className="p-2.5 font-sans text-slate-600 dark:text-slate-400">{row.reason_code}</td>
                          <td className="p-2.5 font-sans">
                            {row.is_valid ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Valid
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold flex items-center gap-1">
                                <X className="w-3.5 h-3.5" /> Invalid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── REVISION AUDIT DETAILS SLIDE-OVER DRAWER ── */}
      {inspectedRevision && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-slate-800 h-full p-6 space-y-6 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revision Audit Metadata</h3>
                <p className="text-[11px] text-slate-400 font-mono">{inspectedRevision.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedRevision(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Item / SKU</div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {inspectedRevision.item_name || inspectedRevision.variant_sku}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Item ID: {inspectedRevision.item_id} | Variant: {inspectedRevision.variant_id}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Price Differential</div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-slate-400">Previous MRP: </span>
                    <span className="font-semibold">{fmt(inspectedRevision.previous_mrp)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Revised MRP: </span>
                    <span className="font-bold text-slate-900 dark:text-white">{fmt(inspectedRevision.revised_mrp)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Previous SP: </span>
                    <span className="font-semibold">{fmt(inspectedRevision.previous_selling_price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Revised SP: </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{fmt(inspectedRevision.revised_selling_price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Previous CP: </span>
                    <span className="font-semibold">{fmt(inspectedRevision.previous_cost_price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Revised CP: </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{fmt(inspectedRevision.revised_cost_price)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span>{statusBadge(inspectedRevision.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reason Code:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{inspectedRevision.reason_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created At:</span>
                  <span className="text-slate-600 dark:text-slate-300">{fmtDate(inspectedRevision.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created By:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">{inspectedRevision.created_by || "system"}</span>
                </div>
                {inspectedRevision.approved_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Approved By:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{inspectedRevision.approved_by}</span>
                  </div>
                )}
                {inspectedRevision.approved_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Approved At:</span>
                    <span className="text-slate-600 dark:text-slate-300">{fmtDate(inspectedRevision.approved_at)}</span>
                  </div>
                )}
                {inspectedRevision.justification && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Justification</div>
                    <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg">
                      {inspectedRevision.justification}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Statutory Invariant Verification
                </div>
                <p>
                  Certified: Revised Selling Price ({fmt(inspectedRevision.revised_selling_price)}) does not exceed statutory MRP ({fmt(inspectedRevision.revised_mrp)}).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVE PROMPT MODAL ── */}
      {approvalTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Approve Price Revision
            </h4>
            <p className="text-xs text-slate-500">
              Authorizing revision <span className="font-mono font-bold text-blue-600">{approvalTarget.id}</span> for{" "}
              <span className="font-bold text-slate-900 dark:text-white">{approvalTarget.item_name || approvalTarget.variant_sku}</span>.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Supervisor PIN (if required):</label>
              <input
                type="password"
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                placeholder="Enter PIN if cashier or elevated..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT PROMPT MODAL ── */}
      {rejectionTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              Reject Price Revision
            </h4>
            <p className="text-xs text-slate-500">
              Rejecting revision <span className="font-mono font-bold text-rose-600">{rejectionTarget.id}</span>.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Rejection Reason *:</label>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Explain why this revision is rejected..."
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PriceRevisionStudioWorkspace;
