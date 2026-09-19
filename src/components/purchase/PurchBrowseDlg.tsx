/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.42.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  POProductStatusBadge,
  POProductDecisionBanner,
  type POProductDecision,
  type POVendorDecisionStatus,
} from "./POProductStatusBadge.tsx";
import { POProductExplainModal } from "./POProductExplainModal.tsx";

interface PurchaseProductBrowseModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  /** Vendor party ID (canonical) or legacy supplier ID — used for batch evaluation */
  vendorId?: string;
  /** PO date for effective-date evaluation */
  transactionDate?: string;
}

type StatusFilter = "ALL" | POVendorDecisionStatus;

/** Map of product_ref → decision, populated by the batch evaluate API */
type DecisionMap = Record<string, POProductDecision>;

export const PurchBrowseDlg: React.FC<PurchaseProductBrowseModalProps> = ({
  products,
  isOpen,
  onClose,
  onSelectProduct,
  vendorId,
  transactionDate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [decisionMap, setDecisionMap] = useState<DecisionMap>({});
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [explainDecision, setExplainDecision] = useState<POProductDecision | null>(null);
  const [explainProductName, setExplainProductName] = useState<string | undefined>();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const showVendorStatus = !!vendorId; // Only show status column when vendor is selected

  // ── Focus on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setStatusFilter("ALL");
    }
  }, [isOpen]);

  // ── Batch evaluation ───────────────────────────────────────────────────────
  const runBatchEvaluation = useCallback(async () => {
    if (!vendorId || !isOpen || products.length === 0) return;
    setEvaluating(true);
    setEvalError(null);
    try {
      // Send codes for first 200 products (API limit)
      const refs = products.slice(0, 200).map((p) => p.code || p.barcode || p.id);
      const validRefs = refs.filter(Boolean) as string[];
      if (validRefs.length === 0) return;

      const resp = await apiFetchV1("/purchase/evaluate-products", {
        method: "POST",
        body: JSON.stringify({
          vendor_id: vendorId,
          product_refs: validRefs,
          transaction_date: transactionDate,
        }),
      });
      const data = resp as { decisions: POProductDecision[] };
      const map: DecisionMap = {};
      data.decisions.forEach((d) => {
        map[d.product_ref] = d;
      });
      setDecisionMap(map);
    } catch (err: unknown) {
      // Soft failure — don't block PO creation if evaluation fails
      setEvalError("Vendor assignment status could not be loaded. Standard purchase flow applies.");
      console.warn("[PurchBrowseDlg] Batch evaluation failed:", err);
    } finally {
      setEvaluating(false);
    }
  }, [vendorId, isOpen, products, transactionDate]);

  useEffect(() => {
    if (isOpen && vendorId) {
      runBatchEvaluation();
    }
  }, [isOpen, vendorId]);

  // ── Product filtering ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = products;

    // Apply vendor status filter
    if (statusFilter !== "ALL" && Object.keys(decisionMap).length > 0) {
      result = result.filter((p) => {
        const ref = p.code || p.barcode || p.id;
        const dec = ref ? decisionMap[ref] : undefined;
        return dec?.status === statusFilter;
      });
    }

    // Apply text search
    if (q) {
      result = result.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.styleCode && p.styleCode.toLowerCase().includes(q)) ||
          (p.color && p.color.toLowerCase().includes(q))
      );
    }

    return result.slice(0, 100);
  }, [products, searchQuery, statusFilter, decisionMap]);

  // ── Status filter counts ───────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: products.length,
      ASSIGNED: 0,
      CROSS_VENDOR: 0,
      UNASSIGNED: 0,
      RESTRICTED: 0,
    };
    Object.values(decisionMap).forEach((d) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [decisionMap, products.length]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && filteredProducts[selectedIndex]) {
      e.preventDefault();
      const product = filteredProducts[selectedIndex];
      const ref = product.code || product.barcode || product.id;
      const dec = ref ? decisionMap[ref] : undefined;
      // Block selection of RESTRICTED products
      if (dec?.action === "BLOCK") return;
      onSelectProduct(product);
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleProductClick = (product: Product) => {
    const ref = product.code || product.barcode || product.id;
    const dec = ref ? decisionMap[ref] : undefined;
    if (dec?.action === "BLOCK") return; // Prevent selecting blocked products
    onSelectProduct(product);
    onClose();
  };

  if (!isOpen) return null;

  const filterTabs: { key: StatusFilter; emoji: string; label: string }[] = [
    { key: "ALL", emoji: "📦", label: "All" },
    { key: "ASSIGNED", emoji: "🟢", label: "Assigned" },
    { key: "CROSS_VENDOR", emoji: "🟡", label: "Cross-Vendor" },
    { key: "UNASSIGNED", emoji: "🔵", label: "Unassigned" },
    { key: "RESTRICTED", emoji: "🔴", label: "Restricted" },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        onKeyDown={handleKeyDown}
      >
        <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-5xl rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span className="font-bold text-sm">Browse Stock Items (F2)</span>
              <span className="text-[10px] bg-[#dae2ff] text-[#00296d] px-2 py-0.5 rounded font-mono font-bold">
                {filteredProducts.length} Items
              </span>
              {evaluating && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono animate-pulse">
                  Checking vendor assignments...
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className="text-white hover:opacity-80 p-1">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Evaluation error */}
          {evalError && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-700 font-medium">
              ⚠ {evalError}
            </div>
          )}

          {/* Search + Status Filter */}
          <div className="p-3 bg-[#e8e7ed] border-b border-[#c4c6d4] flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#737685] text-[18px]">search</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search by Stock No, Article, Brand, Product, Style, Color..."
                className="flex-1 bg-white border border-[#737685] rounded px-3 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-[#00296d] h-8"
              />
            </div>

            {/* Vendor status filter tabs — only shown when vendor is selected and evaluation available */}
            {showVendorStatus && Object.keys(decisionMap).length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.key);
                      setSelectedIndex(0);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                      statusFilter === tab.key
                        ? "bg-[#00296d] text-white border-[#00296d]"
                        : "bg-white text-[#434652] border-[#c4c6d4] hover:bg-[#f4f3f9]"
                    }`}
                  >
                    <span>{tab.emoji}</span>
                    <span>{tab.label}</span>
                    <span className="font-mono text-[9px] opacity-70">
                      ({statusCounts[tab.key] ?? 0})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Catalog Table */}
          <div className="flex-1 overflow-auto bg-white custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#eeedf3] sticky top-0 z-10 text-[10px] font-bold uppercase text-[#434652] shadow-xs">
                <tr>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] w-10 text-center">#</th>
                  {showVendorStatus && (
                    <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] w-28 text-center">
                      Vendor Status
                    </th>
                  )}
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[90px]">Stock / Code</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[140px]">Product Name</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[100px]">Brand</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px]">Style</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px]">Color/Shade</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[60px]">Size</th>
                  <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px] text-right">Cost/Rate</th>
                  <th className="p-1.5 px-2 border-b border-[#c4c6d4] min-w-[70px] text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6d4]/40 font-medium">
                {filteredProducts.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  const ref = p.code || p.barcode || p.id;
                  const decision = ref ? decisionMap[ref] : undefined;
                  const isBlocked = decision?.action === "BLOCK";

                  return (
                    <tr
                      key={p.id || idx}
                      onClick={() => handleProductClick(p)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`transition-colors
                        ${isBlocked ? "opacity-40 cursor-not-allowed bg-rose-50" : "hover:bg-[#f4f3f9] cursor-pointer"}
                        ${isSelected && !isBlocked ? "bg-[#cdddff] font-bold text-[#00296d]" : ""}
                      `}
                      title={isBlocked ? decision?.explanation : undefined}
                    >
                      <td className="p-1 px-2 border-r border-[#c4c6d4] text-center font-mono text-[#737685]">
                        {idx + 1}
                      </td>
                      {showVendorStatus && (
                        <td className="p-1 px-2 border-r border-[#c4c6d4] text-center">
                          <POProductStatusBadge
                            decision={decision}
                            loading={evaluating && !decision}
                            onClick={
                              decision && decision.action !== "ALLOW"
                                ? (e) => {
                                    (e as unknown as React.MouseEvent)?.stopPropagation?.();
                                    setExplainDecision(decision);
                                    setExplainProductName(p.name);
                                  }
                                : undefined
                            }
                          />
                        </td>
                      )}
                      <td className="p-1 px-2 border-r border-[#c4c6d4] font-mono font-bold">{p.code || p.barcode}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.name}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.brand || "-"}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.styleCode || "-"}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.color || "-"}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4] font-mono">{p.size || "-"}</td>
                      <td className="p-1 px-2 border-r border-[#c4c6d4] text-right font-mono">
                        ₹{(p.costPrice || p.price * 0.7 || p.price || 0).toFixed(2)}
                      </td>
                      <td className="p-1 px-2 text-right font-mono font-bold">{p.stock ?? 0}</td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={showVendorStatus ? 10 : 9}
                      className="p-8 text-center text-[#737685] font-medium"
                    >
                      {statusFilter !== "ALL"
                        ? `No ${statusFilter.replace("_", "-").toLowerCase()} products found. Try a different filter.`
                        : "No products matched your search. Try another query or press Esc to close."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-[#f4f3f9] px-4 py-2 border-t border-[#c4c6d4] flex justify-between items-center shrink-0 text-xs">
            <div className="flex gap-4 text-[#434652] font-mono">
              <span><strong>↑ / ↓</strong> Navigate</span>
              <span><strong>Enter</strong> Select Product</span>
              <span><strong>Esc</strong> Close</span>
              {showVendorStatus && (
                <span className="text-[#737685]">
                  🟢 Assigned &nbsp;🟡 Cross-Vendor &nbsp;🔵 Unassigned &nbsp;🔴 Restricted
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-[#c4c6d4] px-4 py-1 rounded font-bold hover:bg-[#eeedf3]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Explanation modal */}
      <POProductExplainModal
        isOpen={!!explainDecision}
        onClose={() => setExplainDecision(null)}
        decision={explainDecision}
        productName={explainProductName}
      />
    </>
  );
};
