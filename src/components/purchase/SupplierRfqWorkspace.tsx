/**
 * Project      : SMRITI Retail OS
 * Module       : Supplier RFQ & Quotation Comparison Workspace
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
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  Award,
  Layers,
  ArrowRight,
  TrendingDown,
  Scale,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface RfqItem {
  id: string;
  product_id: string;
  code: string;
  name: string;
  target_quantity: number;
  target_cost?: number;
  specifications?: string;
}

interface Rfq {
  id: string;
  rfq_no: string;
  rfq_date: string;
  due_date: string;
  title: string;
  status: "DRAFT" | "ISSUED" | "EVALUATED" | "AWARDED" | "CLOSED" | "CANCELLED";
  notes?: string;
  awarded_quotation_id?: string;
  awarded_supplier_id?: string;
  awarded_notes?: string;
  items: RfqItem[];
  quotations_count: number;
}

export interface RfqDraftLine {
  product_id: string;
  item_id?: string;
  variant_id?: string;
  code: string;
  name: string;
  quantity: string;
}

interface RfqCatalogProduct {
  product_id: string;
  item_id?: string;
  variant_id?: string;
  code: string;
  name: string;
}

export function validateRfqDraft(
  title: string,
  dueDate: string,
  lines: ReadonlyArray<RfqDraftLine>
): string | null {
  if (!title.trim()) return "Enter a name for this quote request.";
  if (!dueDate) return "Set a supplier response deadline.";
  if (lines.length === 0) return "Add at least one catalog item to this quote request.";
  if (lines.some((line) => !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
    return "Enter a quantity greater than zero for every requested item.";
  }
  return null;
}

const RFQ_STATUS_LABELS: Record<Rfq["status"], string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  EVALUATED: "Quotes received",
  AWARDED: "Supplier selected",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

interface QuotationItem {
  id: string;
  product_id: string;
  code: string;
  name: string;
  quoted_quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  freight_allocation: number;
  net_landed_cost_per_unit: number;
  line_total: number;
}

interface Quotation {
  id: string;
  quotation_no: string;
  rfq_id?: string;
  supplier_id: string;
  supplier_name?: string;
  quotation_date: string;
  valid_until: string;
  status: "RECEIVED" | "SHORTLISTED" | "SELECTED" | "REJECTED";
  payment_terms?: string;
  delivery_timeline?: string;
  subtotal: number;
  tax_total: number;
  freight_charges: number;
  other_charges: number;
  total_landed_cost: number;
  rank?: number;
  selection_justification?: string;
  po_id?: string;
  po_no?: string;
  items: QuotationItem[];
}

interface ComparisonMatrix {
  rfq_id: string;
  rfq_no: string;
  title: string;
  quotations: Quotation[];
  item_comparisons: Array<{
    product_id: string;
    item_name: string;
    code: string;
    target_quantity: number;
    quotes: Record<string, any>;
  }>;
  lowest_landed_cost_supplier_id?: string;
}

export const SupplierRfqWorkspaceBase: React.FC = () => {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [matrix, setMatrix] = useState<ComparisonMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Modals
  const [showCreateRfqModal, setShowCreateRfqModal] = useState(false);
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedQuoteForAward, setSelectedQuoteForAward] = useState<Quotation | null>(null);
  const [awardJustification, setAwardJustification] = useState("");

  // Suppliers master
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // RFQ Creation State
  const [rfqTitle, setRfqTitle] = useState("");
  const [rfqDueDate, setRfqDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  });
  const [rfqLines, setRfqLines] = useState<RfqDraftLine[]>([]);
  const [rfqCatalogProducts, setRfqCatalogProducts] = useState<RfqCatalogProduct[]>([]);
  const [rfqCatalogLoading, setRfqCatalogLoading] = useState(false);
  const [rfqCatalogError, setRfqCatalogError] = useState<string | null>(null);
  const [rfqCatalogRetry, setRfqCatalogRetry] = useState(0);
  const [rfqProductSearch, setRfqProductSearch] = useState("");
  const [rfqFormError, setRfqFormError] = useState<string | null>(null);
  const [creatingRfq, setCreatingRfq] = useState(false);

  // Quotation Entry State
  const [quoteSupplierId, setQuoteSupplierId] = useState("");
  const [quoteNo, setQuoteNo] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [quoteFreight, setQuoteFreight] = useState(0);
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("30 Days Net");
  const [quoteDeliveryTimeline, setQuoteDeliveryTimeline] = useState("7 Days from PO");
  const [quoteLines, setQuoteLines] = useState<Array<{ product_id: string; code: string; name: string; quantity: number; unitPrice: number; discountPercent: number; taxRate: number }>>([]);

  const loadRfqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/purchase/rfqs/");
      setRfqs(Array.isArray(data) ? data : []);
      if (!selectedRfq && data.length > 0) {
        setSelectedRfq(data[0]);
      }
    } catch (e: any) {
      console.error(e);
      setNotification({ type: "error", msg: `Failed to load RFQs: ${e?.message || "Server error"}` });
    } finally {
      setLoading(false);
    }
  }, [selectedRfq]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await apiFetchV1("/purchase/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
      if (data && data.length > 0) setQuoteSupplierId(data[0].id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadMatrix = useCallback(async (rfqId: string) => {
    setMatrixLoading(true);
    try {
      const data = await apiFetchV1(`/purchase/rfqs/${rfqId}/comparison`);
      setMatrix(data);
    } catch (e: any) {
      console.error(e);
      setMatrix(null);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRfqs();
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedRfq) {
      loadMatrix(selectedRfq.id);
    }
  }, [selectedRfq]);

  useEffect(() => {
    if (!showCreateRfqModal) return;

    let active = true;
    const loadCatalog = async () => {
      setRfqCatalogLoading(true);
      setRfqCatalogError(null);
      try {
        const data = await apiFetchV1("/inventory/?page=1&page_size=5000&sort=created_at&order=desc");
        const products = Array.isArray(data) ? data : data?.items;
        if (!Array.isArray(products)) {
          throw new Error("The catalog response did not contain a product list.");
        }

        const catalogProducts = products.flatMap((product: any) => {
          if (!product || product.is_active === false || product.is_deleted === true) return [];
          const productId = product.id == null ? "" : String(product.id);
          const code = String(product.code || product.sku || product.barcode || "").trim();
          const name = String(product.name || "").trim();
          if (!productId || !code || !name) return [];
          return [{
            product_id: productId,
            item_id: product.item_id == null ? undefined : String(product.item_id),
            variant_id: product.item_variant_id == null
              ? (product.variant_id == null ? undefined : String(product.variant_id))
              : String(product.item_variant_id),
            code,
            name,
          }];
        });
        if (active) setRfqCatalogProducts(catalogProducts);
      } catch (error: unknown) {
        console.error("Failed to load catalog items for quote request:", error);
        if (active) {
          setRfqCatalogError(error instanceof Error ? error.message : "Unable to load catalog items.");
        }
      } finally {
        if (active) setRfqCatalogLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [showCreateRfqModal, rfqCatalogRetry]);

  const filteredRfqCatalog = useMemo(() => {
    const query = rfqProductSearch.trim().toLowerCase();
    return rfqCatalogProducts
      .filter((product) => !query || `${product.code} ${product.name}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [rfqCatalogProducts, rfqProductSearch]);

  const openCreateRfqModal = () => {
    setRfqTitle("");
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 10);
    setRfqDueDate(dueDate.toISOString().split("T")[0]);
    setRfqLines([]);
    setRfqProductSearch("");
    setRfqFormError(null);
    setShowCreateRfqModal(true);
  };

  const addRfqLine = (product: RfqCatalogProduct) => {
    setRfqLines((lines) => lines.some((line) => line.product_id === product.product_id)
      ? lines
      : [...lines, { ...product, quantity: "1" }]);
    setRfqFormError(null);
  };

  const handleCreateRfq = async () => {
    const validationError = validateRfqDraft(rfqTitle, rfqDueDate, rfqLines);
    if (validationError) {
      setRfqFormError(validationError);
      return;
    }
    setRfqFormError(null);
    setCreatingRfq(true);
    try {
      const payload = {
        title: rfqTitle.trim(),
        due_date: rfqDueDate,
        items: rfqLines.map((l) => ({
          product_id: l.product_id,
          item_id: l.item_id,
          variant_id: l.variant_id,
          code: l.code,
          name: l.name,
          target_quantity: Number(l.quantity),
        })),
      };
      const created = await apiFetchV1("/purchase/rfqs/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotification({ type: "success", msg: `Quote request ${created.rfq_no} created.` });
      setShowCreateRfqModal(false);
      setRfqLines([]);
      loadRfqs();
      setSelectedRfq(created);
    } catch (e: any) {
      setRfqFormError(e?.message || "Failed to create quote request.");
    } finally {
      setCreatingRfq(false);
    }
  };

  const handleOpenAddQuote = () => {
    if (!selectedRfq) return;
    setQuoteNo(`QT-${Date.now().toString().slice(-6)}`);
    setQuoteLines(
      selectedRfq.items.map((it) => ({
        product_id: it.product_id,
        code: it.code,
        name: it.name,
        quantity: it.target_quantity,
        unitPrice: 850,
        discountPercent: 5,
        taxRate: 18,
      }))
    );
    setShowAddQuoteModal(true);
  };

  const handleSaveQuote = async () => {
    if (!selectedRfq || !quoteSupplierId || !quoteNo.trim()) return;
    try {
      const payload = {
        rfq_id: selectedRfq.id,
        supplier_id: quoteSupplierId,
        quotation_no: quoteNo,
        valid_until: quoteValidUntil,
        payment_terms: quotePaymentTerms,
        delivery_timeline: quoteDeliveryTimeline,
        freight_charges: Number(quoteFreight),
        items: quoteLines.map((l) => ({
          product_id: l.product_id,
          code: l.code,
          name: l.name,
          quoted_quantity: Number(l.quantity),
          unit_price: Number(l.unitPrice),
          discount_percent: Number(l.discountPercent),
          tax_rate: Number(l.taxRate),
        })),
      };

      await apiFetchV1("/purchase/quotations/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotification({ type: "success", msg: `Quote ${quoteNo} recorded. Total costs calculated.` });
      setShowAddQuoteModal(false);
      loadMatrix(selectedRfq.id);
      loadRfqs();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Failed to save quotation" });
    }
  };

  const handleAwardQuotation = async () => {
    if (!selectedQuoteForAward || !awardJustification.trim()) {
      setNotification({ type: "error", msg: "Enter a reason for choosing this supplier." });
      return;
    }
    try {
      await apiFetchV1(`/purchase/quotations/${selectedQuoteForAward.id}/select`, {
        method: "POST",
        body: JSON.stringify({ selection_justification: awardJustification }),
      });
      setNotification({
        type: "success",
        msg: `${selectedQuoteForAward.supplier_name} selected for quote ${selectedQuoteForAward.quotation_no}.`,
      });
      setShowAwardModal(false);
      setAwardJustification("");
      if (selectedRfq) loadMatrix(selectedRfq.id);
      loadRfqs();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "Award selection failed" });
    }
  };

  const handleConvertToPO = async (quote: Quotation) => {
    try {
      const po = await apiFetchV1(`/purchase/quotations/${quote.id}/convert-to-po`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotification({
        type: "success",
        msg: `Draft purchase order ${po.order_no} created from the selected quote.`,
      });
      if (selectedRfq) loadMatrix(selectedRfq.id);
      loadRfqs();
    } catch (e: any) {
      setNotification({ type: "error", msg: e?.message || "PO Conversion failed" });
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
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
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
            <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Supplier quotes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create a quote request, compare supplier prices and delivery terms, then record your choice before creating a purchase order.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRfqs}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateRfqModal}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create quote request
          </button>
        </div>
      </div>

      {/* Main Grid: RFQ Selector & Comparison Matrix */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* RFQ Sidebar List */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Quote requests ({rfqs.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {rfqs.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">No quote requests yet.</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Create one to start tracking supplier offers.</p>
              </div>
            ) : (
              rfqs.map((r) => {
                const isSelected = selectedRfq?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRfq(r)}
                    className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-l-4 border-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-indigo-950 dark:text-indigo-200">{r.rfq_no}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.status === "AWARDED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : r.status === "EVALUATED"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {RFQ_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{r.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>Replies due: {r.due_date}</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {r.quotations_count} {r.quotations_count === 1 ? "quote" : "quotes"} received
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Comparison Matrix Area */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          {selectedRfq ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Matrix Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedRfq.rfq_no}</h2>
                    <span className="text-xs text-slate-500 font-normal">({selectedRfq.title})</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requested items: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedRfq.items.length}</span> • Quotes received:{" "}
                    <span className="font-medium text-indigo-600 dark:text-indigo-400 font-bold">{matrix?.quotations.length || 0}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenAddQuote}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Record Supplier Quote
                  </button>
                </div>
              </div>

              {/* Quotes Summary Cards */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/40">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {matrix?.quotations.map((q) => {
                    const isLowest = q.supplier_id === matrix.lowest_landed_cost_supplier_id;
                    const isSelected = q.status === "SELECTED";
                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg border flex flex-col justify-between transition ${
                          isSelected
                            ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700"
                            : isLowest
                            ? "bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{q.supplier_name}</span>
                            {isSelected ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                                <Award className="w-3 h-3" /> Selected
                              </span>
                            ) : isLowest ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                                <TrendingDown className="w-3 h-3" /> Lowest total cost
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Quote: {q.quotation_no}</div>
                          <div className="text-[10px] text-slate-400 mt-2">Total cost including tax and shipping</div>
                          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                            ₹{Number(q.total_landed_cost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Payment: {q.payment_terms || "Standard"} • Delivery: {q.delivery_timeline || "Standard"}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          {isSelected ? (
                            q.po_no ? (
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3" /> Order: {q.po_no}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConvertToPO(q)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <ShoppingBag className="w-3 h-3" /> Create draft order
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedQuoteForAward(q);
                                setShowAwardModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Award className="w-3 h-3" /> Choose supplier
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-Side Comparison Table */}
              <div className="flex-1 overflow-y-auto p-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Price comparison by item
                </span>
                <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Per-item totals include discounts, tax, and allocated shipping.
                </p>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5 font-semibold">Item / Specification</th>
                        <th className="p-2.5 font-semibold text-right">Requested quantity</th>
                        {matrix?.quotations.map((q) => (
                          <th key={q.id} className="p-2.5 font-semibold text-right border-l border-slate-200 dark:border-slate-800">
                            <div>{q.supplier_name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">Total per unit</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {matrix?.item_comparisons.map((row) => (
                        <tr key={row.product_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{row.item_name}</div>
                            <div className="text-[11px] text-slate-400">{row.code}</div>
                          </td>
                          <td className="p-2.5 text-right font-medium">{Number(row.target_quantity)}</td>
                          {matrix.quotations.map((q) => {
                            const quoteData = row.quotes[q.supplier_id];
                            return (
                              <td
                                key={q.id}
                                className="p-2.5 text-right border-l border-slate-200 dark:border-slate-800"
                              >
                                {quoteData ? (
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-slate-100">
                                      ₹{Number(quoteData.net_landed_unit).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Unit price: ₹{quoteData.unit_price} · Discount: {quoteData.discount_percent}%
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Layers className="w-12 h-12 mb-3 stroke-[1.5] text-slate-300 dark:text-slate-700" />
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
                {rfqs.length === 0 ? "Start with a quote request" : "Choose a quote request"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {rfqs.length === 0
                  ? "Create a request for quotation (RFQ), then record supplier offers to compare prices and delivery terms."
                  : "Select a request from the list to compare supplier prices, delivery terms, and total costs."}
              </p>
              {rfqs.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateRfqModal}
                  className="mt-4 flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create quote request
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE RFQ MODAL */}
      {showCreateRfqModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              Create a Request for Quotation (RFQ)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Name the request, choose the products and quantities suppliers should quote, and set a response deadline.
            </p>
            <div className="text-xs space-y-3">
              <div>
                <label htmlFor="rfq-title" className="font-semibold block mb-1">Request name *</label>
                <input
                  id="rfq-title"
                  type="text"
                  value={rfqTitle}
                  onChange={(e) => {
                    setRfqTitle(e.target.value);
                    setRfqFormError(null);
                  }}
                  placeholder="e.g. Winter footwear order"
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="rfq-due-date" className="font-semibold block mb-1">Supplier response deadline *</label>
                <input
                  id="rfq-due-date"
                  type="date"
                  value={rfqDueDate}
                  onChange={(e) => {
                    setRfqDueDate(e.target.value);
                    setRfqFormError(null);
                  }}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <section className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Requested items *</h4>
                <span className="text-[11px] text-slate-500">{rfqLines.length} added</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Add each catalog item once and enter how many units suppliers should price.
              </p>
              <label htmlFor="rfq-product-search" className="sr-only">Search catalog items</label>
              <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg px-2 bg-slate-50 dark:bg-slate-800">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  id="rfq-product-search"
                  type="search"
                  value={rfqProductSearch}
                  onChange={(e) => setRfqProductSearch(e.target.value)}
                  placeholder="Search by item code or product name"
                  className="w-full py-2 bg-transparent outline-none text-xs"
                />
              </div>

              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {rfqCatalogLoading ? (
                  <p className="p-3 text-xs text-slate-500">Loading catalog items…</p>
                ) : rfqCatalogError ? (
                  <div className="p-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-rose-600 dark:text-rose-400">Could not load catalog: {rfqCatalogError}</p>
                    <button
                      type="button"
                      onClick={() => setRfqCatalogRetry((retry) => retry + 1)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0"
                    >
                      Try again
                    </button>
                  </div>
                ) : rfqCatalogProducts.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No active catalog items are available to add.</p>
                ) : filteredRfqCatalog.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No catalog items match that search.</p>
                ) : (
                  filteredRfqCatalog.map((product) => {
                    const alreadyAdded = rfqLines.some((line) => line.product_id === product.product_id);
                    return (
                      <div key={product.product_id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{product.name}</div>
                          <div className="text-[10px] text-slate-500">{product.code}</div>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addRfqLine(product)}
                          className="px-2 py-1 text-[11px] font-semibold rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                        >
                          {alreadyAdded ? "Added" : "Add item"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {rfqLines.length > 0 ? (
                <div className="space-y-2">
                  {rfqLines.map((line) => (
                    <div key={line.product_id} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2">
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
                            setRfqLines((lines) => lines.map((item) =>
                              item.product_id === line.product_id ? { ...item, quantity: e.target.value } : item
                            ));
                            setRfqFormError(null);
                          }}
                          className="mt-1 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => {
                          setRfqLines((lines) => lines.filter((item) => item.product_id !== line.product_id));
                          setRfqFormError(null);
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">No items added yet. Search the catalog and add at least one.</p>
              )}
            </section>

            {rfqFormError && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{rfqFormError}</p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setShowCreateRfqModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRfq}
                disabled={creatingRfq || rfqCatalogLoading || rfqLines.length === 0}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingRfq ? "Creating…" : "Create quote request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SUPPLIER QUOTATION MODAL */}
      {showAddQuoteModal && selectedRfq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Enter supplier quote for {selectedRfq.rfq_no}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Supplier *</label>
                <select
                  value={quoteSupplierId}
                  onChange={(e) => setQuoteSupplierId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Supplier quote number *</label>
                <input
                  type="text"
                  value={quoteNo}
                  onChange={(e) => setQuoteNo(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Shipping / freight total (₹)</label>
                <input
                  type="number"
                  value={quoteFreight}
                  onChange={(e) => setQuoteFreight(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={quotePaymentTerms}
                  onChange={(e) => setQuotePaymentTerms(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            {/* Line items quote inputs */}
            <div className="flex-1 overflow-y-auto text-xs space-y-2 border p-3 rounded-lg border-slate-200 dark:border-slate-700">
              <span className="font-bold block mb-1">Quoted prices by item</span>
              {quoteLines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-center bg-slate-50/50 dark:bg-slate-800/40 p-2 rounded">
                  <div className="col-span-1 font-medium">{line.name}</div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Unit price (₹)</label>
                    <input
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const copy = [...quoteLines];
                        copy[idx].unitPrice = Number(e.target.value);
                        setQuoteLines(copy);
                      }}
                      className="w-full p-1 border rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Discount (%)</label>
                    <input
                      type="number"
                      value={line.discountPercent}
                      onChange={(e) => {
                        const copy = [...quoteLines];
                        copy[idx].discountPercent = Number(e.target.value);
                        setQuoteLines(copy);
                      }}
                      className="w-full p-1 border rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">GST rate (%)</label>
                    <input
                      type="number"
                      value={line.taxRate}
                      onChange={(e) => {
                        const copy = [...quoteLines];
                        copy[idx].taxRate = Number(e.target.value);
                        setQuoteLines(copy);
                      }}
                      className="w-full p-1 border rounded bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowAddQuoteModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button onClick={handleSaveQuote} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                Save supplier quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTED AWARD JUSTIFICATION MODAL */}
      {showAwardModal && selectedQuoteForAward && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              Choose supplier: {selectedQuoteForAward.supplier_name}
            </h3>
            <p className="text-xs text-slate-500">
              Record why you chose this supplier. The lowest price is not always best if product quality or delivery terms matter more.
            </p>

            <div className="text-xs">
              <label className="font-semibold block mb-1">Reason for choosing this supplier *</label>
              <textarea
                rows={3}
                value={awardJustification}
                onChange={(e) => setAwardJustification(e.target.value)}
                placeholder="e.g. More reliable delivery or better payment terms"
                className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowAwardModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-semibold">
                Cancel
              </button>
              <button onClick={handleAwardQuotation} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">
                Confirm supplier choice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SupplierRfqWorkspace = withCapability(SupplierRfqWorkspaceBase, {
  entity: "purchase",
  capability: "supplier_rfq_and_quotations",
  role: "CANONICAL",
  canonicalOwner: "src/components/purchase/SupplierRfqWorkspace.tsx",
  description: "Supplier RFQ and Landed-Cost Quotation Comparison Matrix",
});
