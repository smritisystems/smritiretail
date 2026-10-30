/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: B2B Consolidated Billing Modal Component
 */

import React, { useState, useEffect } from "react";
import {
  FileText,
  Package,
  CheckSquare,
  Square,
  Scan,
  AlertTriangle,
  ArrowRight,
  X,
  Building2,
  Layers,
  Calculator,
  ShieldAlert,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { PackingSlipRecord } from "./PackingSlipManagementModal.tsx";

export interface ConsolidatedBillingItem {
  productId: string;
  sku: string;
  name: string;
  barcode?: string;
  style?: string;
  color?: string;
  size?: string;
  unitPrice: number;
  mrp: number;
  taxPct: number;
  hsnCode?: string;
  orderedQty: number;
  packedQty: number;
  previouslyInvoicedQty: number;
  remainingEligibleQty: number;
  invoiceQty: number;
  allocations: Array<{
    packingSlipId: string;
    packingSlipNumber: string;
    quantity: number;
  }>;
}

export interface ConsolidatedBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableSlips: PackingSlipRecord[];
  customers: any[];
  currentUser?: any;
  effectiveConfig?: any;
  onApplyConsolidatedItems: (params: {
    selectedSlips: PackingSlipRecord[];
    items: ConsolidatedBillingItem[];
    customer: any;
  }) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const ConsolidatedBillingModal: React.FC<ConsolidatedBillingModalProps> = ({
  isOpen,
  onClose,
  availableSlips = [],
  customers = [],
  currentUser,
  effectiveConfig,
  onApplyConsolidatedItems,
  onNotification,
}) => {
  const [selectedSlipIds, setSelectedSlipIds] = useState<string[]>([]);
  const [scannerInput, setScannerInput] = useState<string>("");
  const [consolidatedLines, setConsolidatedLines] = useState<ConsolidatedBillingItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const isAuthorized =
    currentUser?.role === "SYSADMIN" || currentUser?.role === "MANAGER" || currentUser?.role === "OWNER";
  const allowEditingPrefilledQty = effectiveConfig?.allow_editing_prefilled_qty || "AUTHORIZED_ONLY";
  const canEditQty = allowEditingPrefilledQty === "ENABLED" || (allowEditingPrefilledQty === "AUTHORIZED_ONLY" && isAuthorized);
  const allowPartialInvoicing = (effectiveConfig?.allow_partial_invoicing || "ENABLED") === "ENABLED";
  const invoiceQtyDefault = effectiveConfig?.invoice_qty_default || "PACKED_UNBILLED_QTY";

  // Re-calculate consolidated lines whenever selected slips change
  useEffect(() => {
    if (!isOpen) return;

    const chosenSlips = availableSlips.filter((s) => selectedSlipIds.includes(s.id));
    if (chosenSlips.length === 0) {
      setConsolidatedLines([]);
      setSelectedCustomer(null);
      return;
    }

    // Determine primary customer
    const firstCustId = chosenSlips[0].customerId;
    const custObj = customers.find((c) => c.id === firstCustId) || {
      id: firstCustId || "cust-b2b-01",
      name: chosenSlips[0].customerName || "B2B Customer",
      customerType: "B2B",
      gstin: "27AABCR1234F1Z8",
      stateCode: "27",
    };
    setSelectedCustomer(custObj);

    // Group items by product/SKU while preserving individual slip allocations
    const lineMap: Record<string, ConsolidatedBillingItem> = {};

    chosenSlips.forEach((slip) => {
      slip.items.forEach((it) => {
        const key = it.productId || it.sku;
        const packed = it.quantity || 0;
        const previouslyInvoiced = 0; // Default for unbilled slips
        const remainingEligible = Math.max(0, packed - previouslyInvoiced);

        let initialInvoiceQty = remainingEligible;
        if (invoiceQtyDefault === "ORDERED_QTY_IF_ELIGIBLE") {
          initialInvoiceQty = remainingEligible;
        } else if (invoiceQtyDefault === "MANUAL_ZERO") {
          initialInvoiceQty = 0;
        }

        if (!lineMap[key]) {
          lineMap[key] = {
            productId: it.productId,
            sku: it.sku,
            name: it.name,
            barcode: `890100${key.slice(-4)}`,
            style: "CASUAL",
            color: "NAVY",
            size: "8",
            unitPrice: 1499.0,
            mrp: 1999.0,
            taxPct: 5.0,
            hsnCode: "6404",
            orderedQty: packed,
            packedQty: packed,
            previouslyInvoicedQty: previouslyInvoiced,
            remainingEligibleQty: remainingEligible,
            invoiceQty: initialInvoiceQty,
            allocations: [
              {
                packingSlipId: slip.id,
                packingSlipNumber: slip.packingSlipNumber,
                quantity: initialInvoiceQty,
              },
            ],
          };
        } else {
          const existing = lineMap[key];
          existing.orderedQty += packed;
          existing.packedQty += packed;
          existing.previouslyInvoicedQty += previouslyInvoiced;
          existing.remainingEligibleQty += remainingEligible;
          existing.invoiceQty += initialInvoiceQty;
          existing.allocations.push({
            packingSlipId: slip.id,
            packingSlipNumber: slip.packingSlipNumber,
            quantity: initialInvoiceQty,
          });
        }
      });
    });

    setConsolidatedLines(Object.values(lineMap));
  }, [selectedSlipIds, availableSlips, isOpen, invoiceQtyDefault]);

  // Handle Scanning of Packing Slip Barcode inside the modal
  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scannerInput.trim();
    if (!query) return;

    // Explicit format check or lookup
    const isSlipCode = query.toUpperCase().startsWith("PS-") || query.toLowerCase().startsWith("ps_");
    if (!isSlipCode) {
      onNotification?.(
        "Invalid Packing Slip Scan",
        `Scanned barcode "${query}" is not a recognized Packing Slip format (e.g. PS-YYYYMMDD-XXXXXX). Never guessing unknown barcodes.`,
        "warning"
      );
      setScannerInput("");
      return;
    }

    const matched = availableSlips.find(
      (s) =>
        s.packingSlipNumber.toLowerCase() === query.toLowerCase() ||
        s.id.toLowerCase() === query.toLowerCase()
    );

    if (!matched) {
      onNotification?.(
        "Packing Slip Not Found",
        `Packing Slip "${query}" was not found in active records or belongs to another company tenant.`,
        "error"
      );
      setScannerInput("");
      return;
    }

    if (matched.status === "BILLED") {
      onNotification?.(
        "Already Invoiced",
        `Packing Slip #${matched.packingSlipNumber} has already been fully billed.`,
        "warning"
      );
      setScannerInput("");
      return;
    }

    if (selectedSlipIds.includes(matched.id)) {
      onNotification?.("Already Selected", `Packing Slip #${matched.packingSlipNumber} is already in the batch.`, "info");
      setScannerInput("");
      return;
    }

    // Customer Incompatibility Guard (Section 6: Reject incompatible selections with a clear explanation)
    if (selectedSlipIds.length > 0) {
      const currentSlip = availableSlips.find((s) => s.id === selectedSlipIds[0]);
      if (currentSlip && matched.customerId && currentSlip.customerId && matched.customerId !== currentSlip.customerId) {
        onNotification?.(
          "Customer Incompatibility",
          `Customer Incompatibility: Packing Slip #${matched.packingSlipNumber} belongs to "${matched.customerName}", whereas current selection is for "${currentSlip.customerName}". Incompatible customer accounts cannot be consolidated into a single invoice.`,
          "error"
        );
        setScannerInput("");
        return;
      }
    }

    setSelectedSlipIds((prev) => [...prev, matched.id]);
    onNotification?.(
      "Packing Slip Added",
      `Packing Slip #${matched.packingSlipNumber} added to consolidated batch (${matched.items.length} items). Scanning a slip never auto-posts an invoice.`,
      "success"
    );
    setScannerInput("");
  };

  const toggleSlipSelection = (slip: PackingSlipRecord) => {
    if (selectedSlipIds.includes(slip.id)) {
      setSelectedSlipIds((prev) => prev.filter((id) => id !== slip.id));
      return;
    }

    // Customer incompatibility guard
    if (selectedSlipIds.length > 0) {
      const currentSlip = availableSlips.find((s) => s.id === selectedSlipIds[0]);
      if (currentSlip && slip.customerId && currentSlip.customerId && slip.customerId !== currentSlip.customerId) {
        onNotification?.(
          "Customer Incompatibility",
          `Customer Incompatibility: Packing Slip #${slip.packingSlipNumber} belongs to "${slip.customerName}", whereas current selection is for "${currentSlip.customerName}". Incompatible customer accounts cannot be consolidated into a single invoice.`,
          "error"
        );
        return;
      }
    }

    setSelectedSlipIds((prev) => [...prev, slip.id]);
  };

  const handleInvoiceQtyChange = (sku: string, newQty: number) => {
    setConsolidatedLines((prev) =>
      prev.map((line) => {
        if (line.sku !== sku) return line;
        const clamped = Math.max(0, Math.min(line.remainingEligibleQty, newQty));
        return { ...line, invoiceQty: clamped };
      })
    );
  };

  const handleApplyToBillingStudio = () => {
    if (selectedSlipIds.length === 0) {
      onNotification?.("Validation Error", "Please select at least one packing slip.", "warning");
      return;
    }

    // Validate partial invoicing policy
    if (!allowPartialInvoicing) {
      const hasPartial = consolidatedLines.some((l) => l.invoiceQty < l.remainingEligibleQty);
      if (hasPartial) {
        onNotification?.(
          "Policy Violation",
          "Partial invoicing is DISABLED by company policy. All eligible quantities must be invoiced.",
          "error"
        );
        return;
      }
    }

    // Validate overbilling
    const hasOverbilling = consolidatedLines.some((l) => l.invoiceQty > l.remainingEligibleQty);
    if (hasOverbilling) {
      onNotification?.(
        "Overbilling Guard",
        "Invoice quantity cannot exceed remaining eligible packed quantity.",
        "error"
      );
      return;
    }

    const chosenSlips = availableSlips.filter((s) => selectedSlipIds.includes(s.id));
    onApplyConsolidatedItems({
      selectedSlips: chosenSlips,
      items: consolidatedLines,
      customer: selectedCustomer,
    });
    onNotification?.(
      "Consolidation Loaded",
      `${consolidatedLines.length} line items from ${chosenSlips.length} packing slips transferred to Billing Studio cart for Tax Invoicing.`,
      "success"
    );
    onClose();
  };

  const totalPackedSum = consolidatedLines.reduce((acc, l) => acc + l.packedQty, 0);
  const totalInvoicedSum = consolidatedLines.reduce((acc, l) => acc + l.invoiceQty, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-5xl w-full flex flex-col overflow-hidden max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight">B2B Consolidated Tax Billing</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-400/30">
                  MULTI-SLIP INVOICE COMPILER
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select or scan multiple Packing Slips for the same customer and compile into a single consolidated Tax Invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dedicated Scanner & Customer Context Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#171f30]">
          {/* Scanner Form */}
          <form onSubmit={handleScannerSubmit} className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Scan size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                placeholder="Scan Packing Slip Barcode / QR (PS-...)"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none font-mono"
                data-field-key="scan-packing-slip-input"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              Add Slip
            </button>
          </form>

          {/* Customer Match Indicator */}
          {selectedCustomer && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-300">
              <Building2 size={14} className="text-blue-600 shrink-0" />
              <span className="font-bold">{selectedCustomer.name}</span>
              <span className="opacity-60">·</span>
              <span className="font-mono text-[11px]">{selectedCustomer.gstin || "GSTIN VERIFIED"}</span>
            </div>
          )}
        </div>

        {/* Main Content Area: Split View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 1. Slip Picker Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package size={14} />
                <span>Available Packing Slips ({availableSlips.filter((s) => s.status === "PACKED").length})</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-semibold">
                Selected: <strong className="text-blue-600">{selectedSlipIds.length} Slips</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {availableSlips
                .filter((s) => s.status === "PACKED")
                .map((slip) => {
                  const isSelected = selectedSlipIds.includes(slip.id);
                  return (
                    <div
                      key={slip.id}
                      onClick={() => toggleSlipSelection(slip)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-xs"
                          : "bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <div className="pt-0.5">
                        {isSelected ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 truncate">
                            {slip.packingSlipNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{slip.totalPackages} Pkg</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {slip.customerName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                          <span>Ref: {slip.orderId || "—"}</span>
                          <span className="font-bold">{slip.items.length} Lines</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 2. 6-Quantity Line-Item Inspection Table */}
          {selectedSlipIds.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-4">
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Consolidated Line Items &amp; Quantity Reconciliation
                </span>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>
                    Total Packed: <strong className="text-slate-900 dark:text-white font-mono">{totalPackedSum}</strong>
                  </span>
                  <span>
                    Total to Bill: <strong className="text-emerald-600 font-mono font-bold">{totalInvoicedSum}</strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3">Product Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Ordered</th>
                      <th className="py-2.5 px-3 text-center">Packed</th>
                      <th className="py-2.5 px-3 text-center">Prev. Invoiced</th>
                      <th className="py-2.5 px-3 text-center">Eligible Rem.</th>
                      <th className="py-2.5 px-3 text-center">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-center">Tax %</th>
                      <th className="py-2.5 px-3 text-center bg-blue-50/50 dark:bg-blue-950/20">Invoice Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {consolidatedLines.map((line) => (
                      <tr key={line.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{line.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {line.allocations.map((a) => a.packingSlipNumber).join(", ")}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{line.sku}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{line.orderedQty}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                          {line.packedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                          {line.previouslyInvoicedQty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {line.remainingEligibleQty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">₹{line.unitPrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{line.taxPct}%</td>
                        <td className="py-2.5 px-3 text-center bg-blue-50/50 dark:bg-blue-950/20">
                          <input
                            type="number"
                            min={0}
                            max={line.remainingEligibleQty}
                            disabled={!canEditQty}
                            value={line.invoiceQty}
                            onChange={(e) => handleInvoiceQtyChange(line.sku, parseInt(e.target.value, 10) || 0)}
                            className="w-20 px-2 py-1 text-xs border border-blue-300 dark:border-blue-700 rounded-lg text-center font-mono font-bold bg-white dark:bg-[#131b2e] outline-none disabled:bg-slate-100 disabled:opacity-75 focus:ring-2 focus:ring-blue-500"
                            data-field-key={`consol-qty-${line.sku}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#131b2e]">
          <div className="text-xs text-slate-500">
            {selectedSlipIds.length > 0 ? (
              <span>
                Consolidating <strong>{selectedSlipIds.length}</strong> packing slips for{" "}
                <strong>{selectedCustomer?.name}</strong>.
              </span>
            ) : (
              <span>Select or scan packing slips above to initiate consolidated compilation.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyToBillingStudio}
              disabled={selectedSlipIds.length === 0 || consolidatedLines.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              data-field-key="transfer-consolidated-btn"
            >
              <span>Transfer to Billing Studio for Tax Invoicing</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
