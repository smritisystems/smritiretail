/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Human-Readable Pre-Save Validation Advisor (HREP Compliance)
 */

import React, { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
  ShieldAlert,
  Sparkles,
  Tag,
  Wand2,
  X,
  ArrowRight,
  Database,
  Barcode as BarcodeIcon,
} from "lucide-react";
import { ItemMasterGridRow } from "../types.ts";
import { generateSkuCode } from "../../../services/skuGenerationEngine.ts";

export interface ItemMasterValidationAdvisorModalProps {
  isOpen: boolean;
  rows: ItemMasterGridRow[];
  commonFieldValues: Record<string, any>;
  onClose: () => void;
  onApplyFixesAndSave: (fixedRows: ItemMasterGridRow[]) => void;
  onApplyFixesToGridOnly: (fixedRows: ItemMasterGridRow[]) => void;
  isSaving?: boolean;
}

export interface ValidationIssue {
  id: string;
  category: "HSN" | "BARCODE" | "SKU" | "NAME" | "PRICE" | "VENDOR";
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  affectedCount: number;
  explanation: string;
  guidance: string;
  recommendation: string;
  quickFixLabel?: string;
  fixAction?: (rows: ItemMasterGridRow[]) => ItemMasterGridRow[];
}

export const ItemMasterValidationAdvisorModal: React.FC<ItemMasterValidationAdvisorModalProps> = ({
  isOpen,
  rows,
  commonFieldValues,
  onClose,
  onApplyFixesAndSave,
  onApplyFixesToGridOnly,
  isSaving = false,
}) => {
  // Analyze rows and detect missing or problematic fields
  const analysis = useMemo(() => {
    const validRows = rows.filter(
      (r) => (r.product && r.product.trim()) || (r.stockNo && r.stockNo.trim()) || (r.barcode && r.barcode.trim())
    );

    const issues: ValidationIssue[] = [];

    // 1. Check Missing HSN Code
    const missingHsnRows = validRows.filter((r) => {
      const hsn = (r.hsnCode || commonFieldValues.hsnCode || "").toString().trim();
      return !hsn;
    });

    if (missingHsnRows.length > 0) {
      issues.push({
        id: "missing_hsn",
        category: "HSN",
        severity: "CRITICAL",
        title: "Missing HSN Code (Statutory GST Requirement)",
        affectedCount: missingHsnRows.length,
        explanation:
          "Under statutory GST regulations, every commercial item must have an HSN (Harmonized System of Nomenclature) classification code. Without an HSN code, this product cannot be added to sales tax invoices or scanned in POS billing.",
        guidance:
          "POS billing and sales transactions will reject or quarantine items with missing HSN codes.",
        recommendation:
          "Enter standard 8-digit HSN code for footwear/chappals: 64029990 (or 64041990).",
        quickFixLabel: "Apply Suggested Footwear HSN (64029990) to All Missing Rows",
        fixAction: (currentRows) =>
          currentRows.map((r) => {
            const hsn = (r.hsnCode || commonFieldValues.hsnCode || "").toString().trim();
            if (!hsn) {
              return { ...r, hsnCode: "64029990" };
            }
            return r;
          }),
      });
    }

    // 2. Check Missing Barcodes
    const missingBarcodeRows = validRows.filter((r) => !(r.barcode && r.barcode.trim()));
    if (missingBarcodeRows.length > 0) {
      issues.push({
        id: "missing_barcode",
        category: "BARCODE",
        severity: "WARNING",
        title: "Missing Barcode (POS Gun Scanner Required)",
        affectedCount: missingBarcodeRows.length,
        explanation:
          "Barcode scanner guns at POS checkout lookup items using barcodes. Without a barcode, cashiers must manually type the SKU or product code.",
        guidance:
          "Enter your manufacturer EAN-13 barcode, or auto-generate internal barcodes so items can be scanned immediately.",
        recommendation: "Auto-generate internal 13-digit retail barcodes.",
        quickFixLabel: "Auto-Generate Barcodes for Missing Rows",
        fixAction: (currentRows) =>
          currentRows.map((r, idx) => {
            if (!(r.barcode && r.barcode.trim())) {
              const syntheticBc = `890${Date.now().toString().slice(-7)}${String(idx + 1).padStart(3, "0")}`;
              return { ...r, barcode: syntheticBc };
            }
            return r;
          }),
      });
    }

    // 3. Check Missing SKU / Stock Code
    const missingSkuRows = validRows.filter((r) => !(r.stockNo && r.stockNo.trim()));
    if (missingSkuRows.length > 0) {
      issues.push({
        id: "missing_sku",
        category: "SKU",
        severity: "CRITICAL",
        title: "Missing SKU Code (Stock Identification)",
        affectedCount: missingSkuRows.length,
        explanation:
          "A unique SKU (Stock Keeping Unit) identifies each distinct style, color, and size combination in your inventory ledger.",
        guidance:
          "Enter the unique style-color-size code, or click Auto-Generate SKUs to create codes automatically.",
        recommendation: "Generate standardized SKUs from Style Code + Color + Size.",
        quickFixLabel: "Auto-Generate Standard SKUs",
        fixAction: (currentRows) =>
          currentRows.map((r, idx) => {
            if (!(r.stockNo && r.stockNo.trim())) {
              const sku = generateSkuCode(
                {
                  brand: r.brand || commonFieldValues.brand || "GEN",
                  styleCode: r.style || "STYLE",
                  colour: r.shade || "STD",
                  size: r.size || "M",
                },
                { mode: "AUTO", prefix: "SKU", sequenceStart: 1001 },
                idx
              );
              return { ...r, stockNo: sku };
            }
            return r;
          }),
      });
    }

    // 4. Check Missing Item Name / Title
    const missingNameRows = validRows.filter(
      (r) => !(r.product && r.product.trim()) && !(r.itemDescription && r.itemDescription.trim())
    );
    if (missingNameRows.length > 0) {
      issues.push({
        id: "missing_name",
        category: "NAME",
        severity: "CRITICAL",
        title: "Missing Product Title / Description",
        affectedCount: missingNameRows.length,
        explanation:
          "Every item needs a readable display name printed on customer receipts and price labels.",
        guidance: "Enter an item description or title.",
        recommendation: "Fill product name using the Style Code and Category.",
        quickFixLabel: "Auto-Fill Names from Style & Category",
        fixAction: (currentRows) =>
          currentRows.map((r) => {
            if (!r.product && !r.itemDescription) {
              const autoName = `${r.style || "FOOTWEAR"} ${r.shade || ""} ${r.size || ""}`.trim() || "Item";
              return { ...r, product: autoName, itemDescription: autoName };
            }
            return r;
          }),
      });
    }

    // 5. Check Pricing (MRP, Selling Price, Cost Price)
    const pricingIssueRows = validRows.filter((r) => {
      const mrp = parseFloat(String(r.mrp || 0));
      const sp = parseFloat(String(r.sellingPrice || r.price || 0));
      return isNaN(mrp) || mrp <= 0 || isNaN(sp) || sp <= 0 || mrp < sp;
    });

    if (pricingIssueRows.length > 0) {
      issues.push({
        id: "pricing_issues",
        category: "PRICE",
        severity: "CRITICAL",
        title: "Pricing Incomplete (MRP / Selling Price Required)",
        affectedCount: pricingIssueRows.length,
        explanation:
          "Selling price cannot be blank or exceed MRP. Each commercial product must have an active retail price.",
        guidance: "Ensure MRP is greater than or equal to the selling price.",
        recommendation: "Set Selling Price equal to MRP if selling at full retail price.",
        quickFixLabel: "Auto-Fill Selling Price = MRP",
        fixAction: (currentRows) =>
          currentRows.map((r) => {
            const mrp = parseFloat(String(r.mrp || 0));
            const sp = parseFloat(String(r.sellingPrice || r.price || 0));
            if (mrp > 0 && (isNaN(sp) || sp <= 0)) {
              return { ...r, sellingPrice: String(mrp) };
            }
            if (mrp > 0 && sp > mrp) {
              return { ...r, sellingPrice: String(mrp) };
            }
            return r;
          }),
      });
    }

    // 6. Check Cost Price / Buying Price
    const costIssueRows = validRows.filter((r) => {
      const cost = parseFloat(String(r.costPrice || (r as any).buyingPrice || 0));
      return isNaN(cost) || cost <= 0;
    });

    if (costIssueRows.length > 0) {
      issues.push({
        id: "missing_cost",
        category: "PRICE",
        severity: "WARNING",
        title: "Missing Buy Cost / Cost Price",
        affectedCount: costIssueRows.length,
        explanation:
          "Cost price is required for gross margin calculations and inventory stock valuation in accounting ledgers.",
        guidance:
          "If this is a trade product, enter your purchase cost. If it is a promotional sample or free gift, cost may be set to zero.",
        recommendation: "Provide purchase cost for commercial inventory or auto-fill estimated cost.",
        quickFixLabel: "Auto-Fill Estimated Cost (40% of MRP)",
        fixAction: (currentRows) =>
          currentRows.map((r) => {
            const cost = parseFloat(String(r.costPrice || (r as any).buyingPrice || 0));
            if (isNaN(cost) || cost <= 0) {
              const mrp = parseFloat(String(r.mrp || 0));
              const estimated = mrp > 0 ? (mrp * 0.4).toFixed(2) : "100";
              return { ...r, costPrice: estimated, buyingPrice: estimated };
            }
            return r;
          }),
      });
    }

    // 7. Check Vendor Code Linkage
    const hasVendorCodeRows = validRows.filter((r) => Boolean(r.vendorCode && r.vendorCode.trim()));
    if (hasVendorCodeRows.length > 0) {
      issues.push({
        id: "vendor_check",
        category: "VENDOR",
        severity: "INFO",
        title: "Vendor Code Linkage Advisory",
        affectedCount: hasVendorCodeRows.length,
        explanation:
          `You have specified Vendor Code '${hasVendorCodeRows[0].vendorCode}' on ${hasVendorCodeRows.length} item(s). If this vendor code is not registered in Master Data → Suppliers, backend database saving will be blocked.`,
        guidance: "Ensure the vendor code exists in your Supplier directory, or clear it if you want to save the items immediately.",
        recommendation: "Register vendor in Master Data → Suppliers or clear vendor code.",
        quickFixLabel: "Clear Unverified Vendor Code (Allow Immediate Save)",
        fixAction: (currentRows) =>
          currentRows.map((r) => ({ ...r, vendorCode: "" })),
      });
    }

    return {
      validRowCount: validRows.length,
      issues,
      criticalCount: issues.filter((i) => i.severity === "CRITICAL").length,
      warningCount: issues.filter((i) => i.severity === "WARNING").length,
      infoCount: issues.filter((i) => i.severity === "INFO").length,
    };
  }, [rows, commonFieldValues]);

  if (!isOpen) return null;

  // Handle applying all automatic quick fixes
  const handleApplyAllQuickFixesAndSave = () => {
    let current = [...rows];
    analysis.issues.forEach((issue) => {
      if (issue.fixAction) {
        current = issue.fixAction(current);
      }
    });
    onApplyFixesAndSave(current);
  };

  const handleApplyAllQuickFixesToGrid = () => {
    let current = [...rows];
    analysis.issues.forEach((issue) => {
      if (issue.fixAction) {
        current = issue.fixAction(current);
      }
    });
    onApplyFixesToGridOnly(current);
  };

  const handleApplySingleQuickFix = (fixAction?: (rows: ItemMasterGridRow[]) => ItemMasterGridRow[]) => {
    if (!fixAction) return;
    const updated = fixAction(rows);
    onApplyFixesToGridOnly(updated);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn p-4 font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-xl w-[780px] max-w-[96vw] max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Item Master Creation & Validation Guide</h2>
              <p className="text-xs text-slate-400">
                Pre-flight check for {analysis.validRowCount} row(s) before catalogue commit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informative Banner: Draft vs Database Notice */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-6 py-3 flex items-start gap-3 shrink-0">
          <Database size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <strong>Important Store Operator Notice:</strong> Pasting or importing rows into the grid is only a{" "}
            <strong>Draft Preview</strong>. The items are <strong>not yet saved in the database</strong> and cannot be
            used in POS billing until you confirm and save them below.
          </div>
        </div>

        {/* Non-Technical Step-by-Step Flow Guide */}
        <div className="bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">1</span>
            <span>Paste / Add Items</span>
          </div>
          <ArrowRight size={13} className="text-slate-400" />
          <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">2</span>
            <span>Review & Fix Missing Info</span>
          </div>
          <ArrowRight size={13} className="text-slate-400" />
          <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">3</span>
            <span>Confirm & Ready for POS</span>
          </div>
        </div>

        {/* Scrollable Issue List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {analysis.issues.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                All Validation Checks Passed!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Every item contains mandatory statutory fields (HSN, Barcode, SKU, Prices). These items will be
                immediately available for POS Billing and Sales Orders.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Requirements & Recommendations ({analysis.issues.length})
                </div>
                <div className="flex gap-2">
                  {analysis.criticalCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                      {analysis.criticalCount} Required
                    </span>
                  )}
                  {analysis.warningCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {analysis.warningCount} Recommended
                    </span>
                  )}
                </div>
              </div>

              {analysis.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 rounded-xl border transition-all ${
                    issue.severity === "CRITICAL"
                      ? "border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20"
                      : issue.severity === "WARNING"
                      ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {issue.severity === "CRITICAL" ? (
                          <ShieldAlert size={18} className="text-red-600 dark:text-red-400" />
                        ) : issue.severity === "WARNING" ? (
                          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Info size={18} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {issue.title}
                          </h4>
                          <span className="text-[11px] px-2 py-0.2 rounded font-medium bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {issue.affectedCount} row(s)
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {issue.explanation}
                        </p>
                        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-1.5">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">Action:</span>
                          <span>{issue.recommendation}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick fix button if available */}
                    {issue.quickFixLabel && issue.fixAction && (
                      <button
                        type="button"
                        onClick={() => handleApplySingleQuickFix(issue.fixAction)}
                        className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                      >
                        <Wand2 size={13} />
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Return to Grid to Edit
          </button>

          <div className="flex items-center gap-3">
            {analysis.issues.some((i) => i.quickFixLabel) && (
              <button
                type="button"
                onClick={handleApplyAllQuickFixesToGrid}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-2"
              >
                <Wand2 size={14} className="text-blue-600 dark:text-blue-400" />
                Apply Fixes to Grid Only
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyAllQuickFixesAndSave}
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle size={15} />
              {isSaving ? "Saving..." : "Confirm & Save to Catalogue"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
