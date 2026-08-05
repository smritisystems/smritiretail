/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Item Health Dashboard (Store-Wide Catalog Hygiene SSOT)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import React, { useMemo, useState } from "react";
import { Product } from "../../types.js";
import { MDQE, ProductQualityResult } from "../../kernel/ule/MasterDataQualityEngine.js";
import {
  ShieldCheck, AlertTriangle, AlertCircle, Package, Barcode, Building2,
  Tag, Image as ImageIcon, CheckCircle2, Search, ArrowRight, ExternalLink, Activity
} from "lucide-react";

interface ItemHealthDashboardProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export const ItemHealthDashboard: React.FC<ItemHealthDashboardProps> = ({
  products,
  onSelectProduct
}) => {
  const [filterType, setFilterType] = useState<"ALL" | "MISSING_BARCODE" | "MISSING_HSN" | "MISSING_SUPPLIER" | "MISSING_IMAGE" | "INACTIVE">("ALL");

  // Store-wide hygiene calculations
  const analytics = useMemo(() => {
    let totalScoreSum = 0;
    let missingBarcodeCount = 0;
    let missingHsnCount = 0;
    let missingSupplierCount = 0;
    let missingImageCount = 0;
    let inactiveCount = 0;

    const evaluatedProducts = products.map((prod) => {
      const quality = MDQE.evaluateProduct(prod);
      totalScoreSum += quality.overallScore;

      if (!prod.barcode || prod.barcode.trim().length < 6) missingBarcodeCount++;
      if (!prod.hsn_code && !prod.hsnCode) missingHsnCount++;

      const supplier = (prod as any).preferred_supplier || (prod as any).supplier || (prod.attributes && (prod.attributes.preferred_supplier || prod.attributes.supplier));
      if (!supplier || String(supplier).trim().length === 0) missingSupplierCount++;

      if (!prod.primaryImageUrl) missingImageCount++;
      if (prod.status && prod.status !== "Active") inactiveCount++;

      return { product: prod, quality };
    });

    const averageHealthScore = products.length > 0 ? Math.round(totalScoreSum / products.length) : 100;

    let overallGrade: "A+" | "A" | "B" | "C" | "D" | "F" = "A+";
    if (averageHealthScore >= 95) overallGrade = "A+";
    else if (averageHealthScore >= 85) overallGrade = "A";
    else if (averageHealthScore >= 75) overallGrade = "B";
    else if (averageHealthScore >= 60) overallGrade = "C";
    else overallGrade = "D";

    return {
      averageHealthScore,
      overallGrade,
      missingBarcodeCount,
      missingHsnCount,
      missingSupplierCount,
      missingImageCount,
      inactiveCount,
      evaluatedProducts,
    };
  }, [products]);

  const filteredItems = useMemo(() => {
    return analytics.evaluatedProducts.filter(({ product, quality }) => {
      if (filterType === "MISSING_BARCODE") return !product.barcode || product.barcode.trim().length < 6;
      if (filterType === "MISSING_HSN") return !product.hsn_code && !product.hsnCode;
      if (filterType === "MISSING_SUPPLIER") {
        const supplier = (product as any).preferred_supplier || (product as any).supplier || (product.attributes && (product.attributes.preferred_supplier || product.attributes.supplier));
        return !supplier || String(supplier).trim().length === 0;
      }
      if (filterType === "MISSING_IMAGE") return !product.primaryImageUrl;
      if (filterType === "INACTIVE") return product.status && product.status !== "Active";
      return true;
    });
  }, [analytics.evaluatedProducts, filterType]);

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Store Quality Health Grade Banner */}
      <div className="p-5 bg-gradient-to-r from-purple-950/60 via-theme-surface-2 to-indigo-950/60 border border-purple-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-emerald-400 font-mono">
            <span className="text-xl font-black">{analytics.averageHealthScore}%</span>
            <span className="text-[10px] font-bold uppercase">{analytics.overallGrade} Grade</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Catalog Health &amp; Hygiene Dashboard
            </h3>
            <p className="text-theme-muted text-xs mt-0.5 font-mono">
              Store Master Data Quality Score across {products.length} SKUs powered by MDQE Standard v1.0.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-theme-body font-bold">
            {products.length - analytics.missingBarcodeCount} / {products.length} Barcodes Verified
          </div>
        </div>
      </div>

      {/* 8 Operational Hygiene Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setFilterType("ALL")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "ALL"
              ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)] shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-theme-muted text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Total SKUs</span>
            <Package className="w-3.5 h-3.5 text-theme-muted" />
          </div>
          <div className="text-xl font-black text-theme-heading mt-1">{products.length}</div>
        </button>

        <button
          onClick={() => setFilterType("MISSING_BARCODE")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "MISSING_BARCODE"
              ? "bg-rose-500/10 border-rose-500 shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-rose-400 text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Missing Barcode</span>
            <Barcode className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-400 mt-1">{analytics.missingBarcodeCount}</div>
        </button>

        <button
          onClick={() => setFilterType("MISSING_HSN")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "MISSING_HSN"
              ? "bg-amber-500/10 border-amber-500 shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-amber-400 text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Missing HSN Code</span>
            <Tag className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 mt-1">{analytics.missingHsnCount}</div>
        </button>

        <button
          onClick={() => setFilterType("MISSING_SUPPLIER")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "MISSING_SUPPLIER"
              ? "bg-blue-500/10 border-blue-500 shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-blue-400 text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Missing Supplier</span>
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-400 mt-1">{analytics.missingSupplierCount}</div>
        </button>

        <button
          onClick={() => setFilterType("MISSING_IMAGE")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "MISSING_IMAGE"
              ? "bg-purple-500/10 border-purple-500 shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-purple-400 text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Missing Image</span>
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-400 mt-1">{analytics.missingImageCount}</div>
        </button>

        <button
          onClick={() => setFilterType("INACTIVE")}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            filterType === "INACTIVE"
              ? "bg-theme-surface-hover border-theme-divider shadow-xs"
              : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
          }`}
        >
          <div className="text-theme-muted text-[10px] uppercase font-bold flex items-center justify-between">
            <span>Non-Active SKUs</span>
            <Activity className="w-3.5 h-3.5 text-theme-muted" />
          </div>
          <div className="text-xl font-black text-theme-muted mt-1">{analytics.inactiveCount}</div>
        </button>
      </div>

      {/* Flagged Items Action Table */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 border-b border-theme-divider flex items-center justify-between font-mono">
          <span className="font-bold text-theme-heading text-xs uppercase tracking-wider">
            Showing {filteredItems.length} SKUs ({filterType})
          </span>
          <span className="text-[10px] text-theme-muted">Click any row to open Item 360 Studio Inspector</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-theme-divider bg-theme-surface-1 text-theme-muted font-bold uppercase text-[10px]">
                <th className="p-2.5">Item Name</th>
                <th className="p-2.5">SKU / Code</th>
                <th className="p-2.5">Barcode</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-center">Quality Score</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider/40">
              {filteredItems.slice(0, 50).map(({ product, quality }) => (
                <tr
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="hover:bg-theme-surface-1 transition-colors cursor-pointer"
                >
                  <td className="p-2.5 font-bold text-theme-heading flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-[var(--c-seef-accent)] flex-shrink-0" />
                    <span className="line-clamp-1">{product.name}</span>
                  </td>
                  <td className="p-2.5 text-theme-muted">{product.sku || product.code}</td>
                  <td className="p-2.5">{product.barcode || <span className="text-rose-400 font-bold">Unassigned</span>}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        (product.status || "Active") === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {product.status || "Active"}
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="font-bold text-theme-heading">{quality.overallScore}% ({quality.grade})</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(product);
                      }}
                      className="px-2.5 py-1 bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/20 rounded font-bold text-[10px] flex items-center gap-1 ml-auto"
                    >
                      <span>Fix</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
