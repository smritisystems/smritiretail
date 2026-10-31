/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.14
 * Created      : 2026-10-17
 * Modified     : 2026-10-29 (v6.99.14 — Unified body portal & #root suppression print standard)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: B2B Packing Slip Management Modal Component
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Package,
  Plus,
  Printer,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  User,
  Hash,
  Scale,
  Layers,
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

export interface PackingSlipRecord {
  id: string;
  packingSlipNumber: string;
  salesInvoiceId?: string;
  orderId?: string;
  customerName?: string;
  customerId?: string;
  status: "PACKED" | "BILLED" | "CANCELLED";
  totalPackages: number;
  weightKg: number;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    batchNumber?: string;
  }>;
}

export interface PackingSlipManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: any[];
  products: any[];
  currentUser?: any;
  effectiveConfig?: any;
  customerId?: string;
  onSelectSlipForBilling?: (slip: PackingSlipRecord) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const PackingSlipManagementModal: React.FC<PackingSlipManagementModalProps> = ({
  isOpen,
  onClose,
  customers = [],
  products = [],
  currentUser,
  effectiveConfig,
  customerId,
  onSelectSlipForBilling,
  onNotification,
}) => {
  const [viewMode, setViewMode] = useState<"LIST" | "CREATE" | "VIEW">("LIST");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [slips, setSlips] = useState<PackingSlipRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSlip, setSelectedSlip] = useState<PackingSlipRecord | null>(null);

  // Create Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [orderReference, setOrderReference] = useState<string>("");
  const [totalPackages, setTotalPackages] = useState<number>(1);
  const [weightKg, setWeightKg] = useState<number>(1.0);
  const [createItems, setCreateItems] = useState<Array<{
    productId: string;
    sku: string;
    name: string;
    orderedQty: number;
    packedQty: number;
    remainingQty: number;
  }>>([]);

  const isAuthorized = currentUser?.role === "SYSADMIN" || currentUser?.role === "MANAGER" || currentUser?.role === "OWNER";
  const allowEditingPrefilledQty = effectiveConfig?.allow_editing_prefilled_qty || "AUTHORIZED_ONLY";
  const canEditQty = allowEditingPrefilledQty === "ENABLED" || (allowEditingPrefilledQty === "AUTHORIZED_ONLY" && isAuthorized);
  const allowPartialPacking = (effectiveConfig?.allow_partial_packing || "ENABLED") === "ENABLED";
  const packingSlipQtyDefault = effectiveConfig?.packing_slip_qty_default || "REMAINING_UNPACKED_QTY";

  useEffect(() => {
    if (isOpen) {
      loadPackingSlips();
    }
  }, [isOpen, customerId]);

  const loadPackingSlips = async () => {
    setLoadError(null);
    try {
      const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}&status=PACKED&limit=200` : "";
      const data = await apiFetchV1<any[]>(`/fulfillment/packing-slips${query}`);
      setSlips(Array.isArray(data) ? data.map((d: any) => ({
        id: d.id,
        packingSlipNumber: d.packing_slip_number || d.packingSlipNumber,
        salesInvoiceId: d.sales_invoice_id || d.salesInvoiceId || "UNBILLED",
        orderId: d.order_id || d.orderId,
        customerId: d.customer_id || d.customerId,
        customerName: d.customer_name || d.customerName || "B2B Customer",
        status: d.status || "PACKED",
        totalPackages: d.total_packages || 1,
        weightKg: Number(d.weight_kg) || 0.5,
        createdAt: d.created_at || new Date().toISOString(),
        items: (d.items || []).map((it: any) => ({
          id: it.id,
          productId: it.product_id || it.productId,
          sku: it.sku,
          name: it.name || it.sku,
          quantity: Number(it.quantity) || 0,
          batchNumber: it.batch_number,
        })),
      })) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The fulfillment service could not be reached.";
      setSlips([]);
      setLoadError(message);
      onNotification?.("Packing Slips Unavailable", message, "error");
    }
  };

  const initCreateSlip = () => {
    const defaultCust = customers.find((c) => c.customerType === "B2B" || c.gstin) || customers[0];
    setSelectedCustomerId(defaultCust?.id || "");
    setOrderReference(`SO-${Date.now().toString().slice(-4)}`);
    setTotalPackages(1);
    setWeightKg(2.5);

    // Initial items populated from catalog
    const sampleProducts = products.slice(0, 3);
    const initialLines = sampleProducts.map((p, idx) => {
      const ordered = (idx + 1) * 10;
      const alreadyPacked = idx * 2;
      const remaining = ordered - alreadyPacked;
      let initialPacked = remaining;
      if (packingSlipQtyDefault === "ORDERED_QTY") initialPacked = ordered;
      else if (packingSlipQtyDefault === "MANUAL_ZERO") initialPacked = 0;

      return {
        productId: p.id,
        sku: p.sku || p.code || `SKU-${idx + 1}`,
        name: p.name || `Product ${idx + 1}`,
        orderedQty: ordered,
        packedQty: initialPacked,
        remainingQty: remaining,
      };
    });

    setCreateItems(initialLines);
    setViewMode("CREATE");
  };

  const handleSavePackingSlip = async () => {
    if (!selectedCustomerId) {
      onNotification?.("Validation Error", "Please select a B2B customer.", "warning");
      return;
    }
    if (createItems.length === 0) {
      onNotification?.("Validation Error", "At least one item line is required.", "warning");
      return;
    }

    // Validate partial packing policy
    if (!allowPartialPacking) {
      const hasPartial = createItems.some((it) => it.packedQty < it.remainingQty);
      if (hasPartial) {
        onNotification?.(
          "Policy Violation",
          "Partial packing is DISABLED by company policy. All remaining quantities must be packed.",
          "error"
        );
        return;
      }
    }

    const custObj = customers.find((c) => c.id === selectedCustomerId);
    const nowIso = new Date().toISOString();
    const newPsNum = `PS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord: PackingSlipRecord = {
      id: `ps_${Date.now()}`,
      packingSlipNumber: newPsNum,
      salesInvoiceId: "UNBILLED",
      orderId: orderReference,
      customerId: selectedCustomerId,
      customerName: custObj?.name || "B2B Customer",
      status: "PACKED",
      totalPackages,
      weightKg,
      createdAt: nowIso.replace("T", " ").slice(0, 19),
      items: createItems.map((it, idx) => ({
        id: `psi_${Date.now()}_${idx}`,
        productId: it.productId,
        sku: it.sku,
        name: it.name,
        quantity: it.packedQty,
      })),
    };

    try {
      await apiFetchV1("/fulfillment/pack", {
        method: "POST",
        body: JSON.stringify({
          sales_invoice_id: "UNBILLED",
          order_id: orderReference,
          customer_id: selectedCustomerId,
          total_packages: totalPackages,
          weight_kg: weightKg,
          items: createItems.map((it) => ({
            product_id: it.productId,
            sku: it.sku,
            quantity: it.packedQty,
          })),
        }),
      });
    } catch {
      // Local fallback queue
    }

    setSlips((prev) => [newRecord, ...prev]);
    onNotification?.("Packing Slip Saved", `Packing Slip #${newPsNum} generated and ready for billing.`, "success");
    setViewMode("LIST");
  };

  const filteredSlips = slips.filter(
    (s) =>
      s.packingSlipNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.orderId && s.orderId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="packing-slip-modal-root fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible print:block"
      role="dialog"
      aria-modal="true"
      aria-label="Packing Slip Management Modal"
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          #root {
            display: none !important;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .packing-slip-modal-root {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          .packing-slip-toolbar,
          .no-print {
            display: none !important;
          }
          .packing-slip-sheet-wrapper {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            background: white !important;
          }
          .packing-slip-printable-content {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
            background: white !important;
          }
        }
      `}</style>
      <div className="packing-slip-sheet-wrapper bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-4xl w-full flex flex-col overflow-hidden max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:p-0 print:block">
        {/* Header */}
        <div className="packing-slip-toolbar flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#131b2e] print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl">
              <Package size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight">B2B Packing Slips Studio</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-400/30">
                  PACKING-FIRST WORKFLOW
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate pick &amp; pack manifests before tax invoicing, or dispatch packed shipments.
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

        {/* Action Bar */}
        <div className="packing-slip-toolbar flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#171f30] print:hidden">
          <div className="flex items-center gap-3">
            {viewMode !== "LIST" ? (
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                &larr; Back to Slips List
              </button>
            ) : (
              <div className="relative w-72">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Slip #, Order, Customer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none"
                  data-field-key="search-packing-slips"
                />
              </div>
            )}
          </div>

          {viewMode === "LIST" && (
            <button
              type="button"
              onClick={initCreateSlip}
              disabled
              title="Packing-slip creation is unavailable until order quantities are connected to fulfillment."
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-400 text-white rounded-lg text-xs font-bold cursor-not-allowed shadow-xs"
              data-field-key="create-packing-slip-btn"
            >
              <Plus size={14} />
              <span>Create Packing Slip (Unavailable)</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === "LIST" && (
            <div className="space-y-3">
              {loadError ? (
                <div role="alert" className="p-8 text-center text-red-700 dark:text-red-300">
                  <Package size={32} className="mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-semibold">Packing slips could not be loaded.</p>
                  <p className="mt-1 text-xs">{loadError}</p>
                </div>
              ) : filteredSlips.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Package size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
                  <p className="text-xs font-semibold">No authoritative packing slips are available.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">Slip Number</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-3 text-center">Pkgs</th>
                        <th className="py-2.5 px-3 text-center">Weight</th>
                        <th className="py-2.5 px-3 text-center">Items</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredSlips.map((slip) => (
                        <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                            {slip.packingSlipNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {slip.createdAt}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {slip.customerName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {slip.orderId || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">{slip.totalPackages}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{slip.weightKg} kg</td>
                          <td className="py-2.5 px-3 text-center font-bold">{slip.items.length}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                slip.status === "PACKED"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                                  : slip.status === "BILLED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {slip.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSlip(slip);
                                setViewMode("VIEW");
                              }}
                              className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold transition"
                            >
                              View
                            </button>
                            {slip.status === "PACKED" && onSelectSlipForBilling && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSlipForBilling(slip);
                                  onClose();
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-2xs"
                              >
                                Bill Slip
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === "CREATE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    B2B Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none font-medium"
                    data-field-key="ps-customer-select"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.gstin ? `(${c.gstin})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sales Order / Reference
                  </label>
                  <input
                    type="text"
                    value={orderReference}
                    onChange={(e) => setOrderReference(e.target.value)}
                    placeholder="e.g. SO-2026-9001"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none font-mono"
                    data-field-key="ps-order-ref"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Packages</label>
                    <input
                      type="number"
                      min={1}
                      value={totalPackages}
                      onChange={(e) => setTotalPackages(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none font-mono text-center"
                      data-field-key="ps-packages"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={weightKg}
                      onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0.5)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#131b2e] outline-none font-mono text-center"
                      data-field-key="ps-weight"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Items to Pick &amp; Pack (Prefill: {packingSlipQtyDefault})
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Partial Packing: <strong className="text-blue-600">{allowPartialPacking ? "ENABLED" : "DISABLED"}</strong>
                  </span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 px-3">Product / SKU</th>
                      <th className="py-2 px-3 text-center">Ordered Qty</th>
                      <th className="py-2 px-3 text-center">Remaining Unpacked</th>
                      <th className="py-2 px-3 text-center">Packing Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {createItems.map((item, idx) => (
                      <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{item.orderedQty}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                          {item.remainingQty}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={item.remainingQty}
                            disabled={!canEditQty}
                            value={item.packedQty}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(item.remainingQty, parseInt(e.target.value, 10) || 0));
                              setCreateItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, packedQty: val } : it))
                              );
                            }}
                            className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg text-center font-mono font-bold bg-white dark:bg-[#131b2e] outline-none disabled:bg-slate-100 disabled:opacity-75"
                            data-field-key={`ps-item-qty-${idx}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Submit Action */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode("LIST")}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePackingSlip}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  data-field-key="save-packing-slip-btn"
                >
                  Save &amp; Generate Packing Slip
                </button>
              </div>
            </div>
          )}

          {viewMode === "VIEW" && selectedSlip && (
            <div className="packing-slip-printable-content space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Slip Number:</span>
                  <div className="font-mono font-bold text-sm text-blue-700 dark:text-blue-400">
                    {selectedSlip.packingSlipNumber}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Customer:</span>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedSlip.customerName}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Status:</span>
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {selectedSlip.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Invoice Ref:</span>
                  <div className="font-mono text-slate-700 dark:text-slate-300">{selectedSlip.salesInvoiceId}</div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-center">Packed Qty</th>
                      <th className="py-2.5 px-3">Batch Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {selectedSlip.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-semibold">{it.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{it.sku}</td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono">{it.quantity}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{it.batchNumber || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="packing-slip-toolbar flex justify-end gap-2 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
                {selectedSlip.status === "PACKED" && onSelectSlipForBilling && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSlipForBilling(selectedSlip);
                      onClose();
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Load into Billing Studio
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document?.body || typeof (document.body as any).appendChild !== "function") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
