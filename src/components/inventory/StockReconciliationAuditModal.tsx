/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Centralized Inventory Reconciliation & Invariant Diagnostic Studio
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  ArrowRight,
  Lock,
  Layers,
  FileCheck2,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface StockReconciliationAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

interface TransactionReference {
  transaction_id: string;
  doc_type: string;
  movement_type?: string;
  status?: string;
  quantity: number;
  warehouse_id?: string;
  created_at?: string;
  user?: string;
}

interface StockDiscrepancyItem {
  product_id: string;
  sku: string;
  product_name: string;
  article_code?: string;
  color?: string;
  size?: string;
  variant_id?: string;
  company_id: string;
  branch_id?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  
  opening_stock: number;
  purchase_receipts: number;
  sales_returns: number;
  transfers_in: number;
  positive_adjustments: number;
  sales_dispatches: number;
  purchase_returns: number;
  transfers_out: number;
  negative_adjustments: number;
  damage_write_offs: number;
  
  expected_closing_stock: number;
  actual_ledger_stock: number;
  cached_stock: number;
  quantity_variance: number;
  
  discrepancy_category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  likely_root_cause: string;
  recommended_corrective_action: string;
  manual_approval_required: boolean;
  
  related_transactions: TransactionReference[];
}

interface StockReconciliationReport {
  audit_id: string;
  generated_at: string;
  company_id: string;
  branch_id?: string;
  warehouse_id?: string;
  total_products_audited: number;
  balanced_products_count: number;
  discrepancy_count: number;
  total_variance_units: number;
  discrepancies_by_category: Record<string, number>;
  discrepancies_by_severity: Record<string, number>;
  discrepancies: StockDiscrepancyItem[];
}

interface ProposedStockCorrection {
  proposal_id: string;
  company_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  correction_type: string;
  before_stock: number;
  proposed_after_stock: number;
  delta_stock: number;
  source_reference: string;
  audit_trail_reason: string;
  manual_approval_required: boolean;
  status: string;
}

interface HistoricalCorrectionPlan {
  plan_id: string;
  created_at: string;
  company_id: string;
  total_proposals: number;
  net_positive_delta: number;
  net_negative_delta: number;
  proposals: ProposedStockCorrection[];
  authorization_notice: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  HIGH:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  MEDIUM:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW:      "text-sky-400 bg-sky-500/10 border-sky-500/20",
};

export const StockReconciliationAuditModal: React.FC<StockReconciliationAuditModalProps> = ({
  isOpen,
  onClose,
  onNotification,
}) => {
  const [activeTab, setActiveTab] = useState<"AUDIT" | "PROPOSAL">("AUDIT");
  const [report, setReport] = useState<StockReconciliationReport | null>(null);
  const [proposalPlan, setProposalPlan] = useState<HistoricalCorrectionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchSku, setSearchSku] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchAuditReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchSku.trim()) params.append("sku", searchSku.trim());
      params.append("limit", "500");

      const res = await apiFetchV1<StockReconciliationReport>(
        `/inventory/reconciliation?${params.toString()}`
      );
      setReport(res);
    } catch (err: any) {
      setError(err?.message || "Failed to execute stock reconciliation audit.");
      onNotification?.("Audit Error", err?.message || "Reconciliation failed", "error");
    } finally {
      setLoading(false);
    }
  }, [searchSku, onNotification]);

  const fetchProposalPlan = useCallback(async () => {
    setProposalLoading(true);
    try {
      const res = await apiFetchV1<HistoricalCorrectionPlan>(
        "/inventory/reconciliation/correction-proposal?limit=500"
      );
      setProposalPlan(res);
    } catch (err: any) {
      onNotification?.("Proposal Error", err?.message || "Failed to load proposals", "error");
    } finally {
      setProposalLoading(false);
    }
  }, [onNotification]);

  useEffect(() => {
    if (isOpen) {
      fetchAuditReport();
    }
  }, [isOpen, fetchAuditReport]);

  useEffect(() => {
    if (isOpen && activeTab === "PROPOSAL" && !proposalPlan) {
      fetchProposalPlan();
    }
  }, [isOpen, activeTab, proposalPlan, fetchProposalPlan]);

  if (!isOpen) return null;

  const filteredDiscrepancies = (report?.discrepancies || []).filter((d) => {
    if (categoryFilter !== "ALL" && d.discrepancy_category !== categoryFilter) return false;
    if (severityFilter !== "ALL" && d.severity !== severityFilter) return false;
    if (searchSku.trim()) {
      const term = searchSku.toLowerCase();
      return (
        d.sku.toLowerCase().includes(term) ||
        d.product_name.toLowerCase().includes(term) ||
        (d.variant_id && d.variant_id.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-7xl h-[92vh] bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  SMRITI Retail OS — Stock Movement Invariant & Reconciliation Audit
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  READ-ONLY DIAGNOSTIC
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative verification of purchase receipts, sales dispatches, transfers, returns, cancellations, and physical ledgers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab("AUDIT")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                activeTab === "AUDIT"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Audit Ledger & Invariants</span>
            </button>
            <button
              onClick={() => setActiveTab("PROPOSAL")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                activeTab === "PROPOSAL"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Correction Proposals</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by SKU or Product..."
                value={searchSku}
                onChange={(e) => setSearchSku(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAuditReport()}
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="MISSING_MOVEMENT">Missing Movement</option>
              <option value="DUPLICATE_MOVEMENT">Duplicate Movement</option>
              <option value="NEGATIVE_STOCK">Negative Stock</option>
              <option value="CACHE_MISMATCH">Cache Mismatch</option>
              <option value="VARIANT_MISMATCH">Variant Mismatch</option>
              <option value="WRONG_WAREHOUSE_OR_COMPANY">Wrong Tenant/Warehouse</option>
              <option value="UNEXPLAINED_VARIANCE">Unexplained Variance</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <button
              onClick={() => {
                fetchAuditReport();
                if (activeTab === "PROPOSAL") fetchProposalPlan();
              }}
              disabled={loading || proposalLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || proposalLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-xs font-medium text-slate-400">Total Audited Products</div>
              <div className="mt-1 text-2xl font-bold font-mono text-slate-100">
                {report ? report.total_products_audited : "—"}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Candidate inventory master items</div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="text-xs font-medium text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero-Drift Balanced Items</span>
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-300">
                {report ? report.balanced_products_count : "—"}
              </div>
              <div className="mt-1 text-[11px] text-emerald-500/80">Strict ledger & cache parity</div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="text-xs font-medium text-amber-400 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Discrepancies Detected</span>
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-300">
                {report ? report.discrepancy_count : "—"}
              </div>
              <div className="mt-1 text-[11px] text-amber-500/80">Requiring corrective attention</div>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <div className="text-xs font-medium text-rose-400 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Net Variance Magnitude</span>
              </div>
              <div className="mt-1 text-2xl font-bold font-mono text-rose-300">
                {report ? `${report.total_variance_units.toFixed(2)} units` : "—"}
              </div>
              <div className="mt-1 text-[11px] text-rose-500/80">Cumulative stock drift</div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "AUDIT" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">
                  Discrepancy Inventory Ledger ({filteredDiscrepancies.length} records)
                </h3>
                <span className="text-xs text-slate-500">
                  Formula: Expected = Opening + Receipts + Sales Returns + Xfer In + Pos Adj − Dispatches − Purch Returns − Xfer Out − Neg Adj − Damage
                </span>
              </div>

              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                  <p className="text-sm font-mono">Running transaction ledger invariant verification...</p>
                </div>
              ) : filteredDiscrepancies.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-700/60 rounded-xl bg-slate-800/20">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-200">No Inventory Discrepancies Found</p>
                  <p className="text-xs text-slate-500 mt-1">All audited products strictly balance across transaction lifecycles.</p>
                </div>
              ) : (
                <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700/60">
                      <tr>
                        <th className="py-3 px-4">Item & Variant</th>
                        <th className="py-3 px-3">Warehouse</th>
                        <th className="py-3 px-3 text-right">Opening</th>
                        <th className="py-3 px-3 text-right">Receipts</th>
                        <th className="py-3 px-3 text-right">Dispatches</th>
                        <th className="py-3 px-3 text-right">Expected</th>
                        <th className="py-3 px-3 text-right">Actual</th>
                        <th className="py-3 px-3 text-right">Cached</th>
                        <th className="py-3 px-3 text-right">Variance</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Severity</th>
                        <th className="py-3 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredDiscrepancies.map((d) => {
                        const isExpanded = expandedRow === d.product_id;
                        return (
                          <React.Fragment key={d.product_id}>
                            <tr className="hover:bg-slate-800/30 transition">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-200">{d.sku}</div>
                                <div className="text-[11px] text-slate-400 truncate max-w-xs">{d.product_name}</div>
                                {(d.color || d.size) && (
                                  <div className="text-[10px] text-slate-500">
                                    Variant: {d.color || "—"} / {d.size || "—"}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-400">
                                {d.warehouse_name || d.warehouse_id || "Primary"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono">{d.opening_stock}</td>
                              <td className="py-3 px-3 text-right font-mono text-emerald-400">+{d.purchase_receipts}</td>
                              <td className="py-3 px-3 text-right font-mono text-rose-400">-{d.sales_dispatches}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">{d.expected_closing_stock}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-sky-400">{d.actual_ledger_stock}</td>
                              <td className="py-3 px-3 text-right font-mono text-amber-300">{d.cached_stock}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                                {d.quantity_variance > 0 ? `+${d.quantity_variance}` : d.quantity_variance}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                  {d.discrepancy_category}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_BADGE[d.severity] || "text-slate-400"}`}>
                                  {d.severity}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <button
                                  onClick={() => setExpandedRow(isExpanded ? null : d.product_id)}
                                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-800/40">
                                <td colSpan={12} className="p-4 border-t border-slate-800">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                                      <div className="font-semibold text-slate-300">Root-Cause Diagnosis</div>
                                      <p className="text-slate-400 text-[11px] leading-relaxed">{d.likely_root_cause}</p>
                                      <div className="font-semibold text-slate-300 mt-2">Recommended Corrective Action</div>
                                      <p className="text-slate-400 text-[11px] leading-relaxed">{d.recommended_corrective_action}</p>
                                    </div>
                                    <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                                      <div className="font-semibold text-slate-300">Complete Invariant Breakdown</div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
                                        <div>Sales Returns: +{d.sales_returns}</div>
                                        <div>Purchase Returns: -{d.purchase_returns}</div>
                                        <div>Transfers In: +{d.transfers_in}</div>
                                        <div>Transfers Out: -{d.transfers_out}</div>
                                        <div>Positive Adjustments: +{d.positive_adjustments}</div>
                                        <div>Negative Adjustments: -{d.negative_adjustments}</div>
                                        <div>Damage / Write-Off: -{d.damage_write_offs}</div>
                                        <div className="text-indigo-400 font-bold">Approval Required: {d.manual_approval_required ? "YES" : "NO"}</div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start space-x-3">
                <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-indigo-200">MANDATORY GOVERNANCE & SAFETY INVARIANT</div>
                  <p className="mt-0.5 text-indigo-300/90 leading-relaxed">
                    {proposalPlan?.authorization_notice ||
                      "This correction proposal plan is strictly read-only and non-destructive. No historical balances have been altered. Explicit system administrator authorization is required before any compensatory transaction can be posted."}
                  </p>
                </div>
              </div>

              {proposalLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                  <p className="text-sm font-mono">Formulating proposed historical correction plan...</p>
                </div>
              ) : !proposalPlan || proposalPlan.proposals.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-700/60 rounded-xl bg-slate-800/20">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-200">No Corrections Required</p>
                  <p className="text-xs text-slate-500 mt-1">All transactions reconcile cleanly with zero variance.</p>
                </div>
              ) : (
                <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-900/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-700/60">
                      <tr>
                        <th className="py-3 px-4">SKU & Item</th>
                        <th className="py-3 px-3">Proposed Action</th>
                        <th className="py-3 px-3 text-right">Before Stock</th>
                        <th className="py-3 px-3 text-center"></th>
                        <th className="py-3 px-3 text-right">Proposed Stock</th>
                        <th className="py-3 px-3 text-right">Delta</th>
                        <th className="py-3 px-3">Source Reference</th>
                        <th className="py-3 px-4">Audit Trail Justification</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {proposalPlan.proposals.map((p) => (
                        <tr key={p.proposal_id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{p.sku}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.product_name}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {p.correction_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">{p.before_stock}</td>
                          <td className="py-3 px-3 text-center text-slate-500">
                            <ArrowRight className="w-3.5 h-3.5 inline" />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{p.proposed_after_stock}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300">
                            {p.delta_stock > 0 ? `+${p.delta_stock}` : p.delta_stock}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{p.source_reference}</td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] max-w-md">{p.audit_trail_reason}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700/50 bg-slate-800/40 text-xs text-slate-400">
          <div>
            Audit ID: <span className="font-mono text-slate-300">{report?.audit_id || "—"}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
