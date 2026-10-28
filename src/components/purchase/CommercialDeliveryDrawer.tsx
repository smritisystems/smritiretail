/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.78.0
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal / Purchase Order Commercial & Delivery Drawer
 * Capability    : @SmritiCapability("PURCHASE", "COMMERCIAL_DELIVERY_DRAWER")
 */

import React, { useEffect, useRef, useState } from "react";
import { SafeRichTermsRenderer } from "../common/SafeRichTermsRenderer";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface CommercialDeliveryData {
  paymentTerms: string;
  paymentTermsDays?: number;
  freightCharges: string;
  freightAmount?: number;
  currency: string;
  buyer: string;
  department: string;
  specialInstructions: string;
  supplierReference: string;
  deliveryDate: string;
  deliveryLocation: string;
  warehouseId?: string;
  leadTimeDays: number;
  otherCharges?: number;
  remarks?: string;
  internalNotes?: string;
  priceList?: string;
  businessTerms?: string;
}

export const DEFAULT_BUSINESS_TERMS =
  "1. Payment Terms: Strictly 120 Days credit settlement from date of physical GRN inwarding and barcode acceptance.\n" +
  "2. Quality & Inspection: Goods are subject to warehouse QC inspection. Any manufacturing defect, shade mismatch, or size deviation must be replaced or credited within 15 days of intimation.\n" +
  "3. Packaging & Labeling: All footwear articles must arrive packed in individual master boxes carrying GS1/EAN-13 barcodes, size labels, and manufacturer MRP stickers.\n" +
  "4. Statutory & Legal Jurisdiction: All commercial disputes arising out of this statutory purchase order are subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.";

export interface CommercialDeliveryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: CommercialDeliveryData;
  onChange: (updated: Partial<CommercialDeliveryData>) => void;
  supplierName?: string;
  supplierCode?: string;
  supplierCommercialDefaults?: Partial<CommercialDeliveryData>;
  onResetToDefaults?: () => void;
  readOnly?: boolean;
}

const PAYMENT_TERMS_PRESETS = [
  "Immediate Payment",
  "7 Days",
  "15 Days",
  "30 Days",
  "45 Days",
  "60 Days",
  "90 Days",
  "120 Days",
  "Against Delivery (COD)",
  "Advance 50% / Balance on Dispatch",
  "Letter of Credit (LC)",
];

const FREIGHT_TERMS_PRESETS = [
  "Paid by Supplier (FOR Destination)",
  "Paid by Buyer (Ex-Factory / To-Pay)",
  "FOB (Free on Board)",
  "CIF (Cost, Insurance and Freight)",
  "Door Delivery Included",
  "Shared 50/50",
];

const CURRENCY_PRESETS = [
  "INR - Indian Rupee",
  "USD - US Dollar",
  "EUR - Euro",
  "GBP - British Pound",
  "AED - UAE Dirham",
];

const DEPARTMENT_PRESETS = [
  "Footwear",
  "Apparel & Garments",
  "Accessories & Leather",
  "FMCG / Retail Goods",
  "General Procurement",
];

interface AvailableGodown {
  id: string;
  code: string;
  name: string;
}

export const CommercialDeliveryDrawer: React.FC<CommercialDeliveryDrawerProps> = ({
  isOpen,
  onClose,
  data,
  onChange,
  supplierName,
  supplierCode,
  supplierCommercialDefaults,
  onResetToDefaults,
  readOnly = false,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [previewTerms, setPreviewTerms] = useState(false);
  const [warehouses, setWarehouses] = useState<AvailableGodown[]>([]);

  // Load active warehouses from backend
  useEffect(() => {
    let isMounted = true;
    apiFetchV1<any[]>("/wms/warehouses")
      .then((res) => {
        if (isMounted && Array.isArray(res) && res.length > 0) {
          const list = res
            .filter((w) => w.is_active !== false)
            .map((w) => ({
              id: w.id,
              code: w.code || w.id,
              name: w.name,
            }));
          setWarehouses(list);
        }
      })
      .catch((err) => {
        console.warn("[CommercialDeliveryDrawer] Failed to fetch warehouses:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCloseRef.current();
      }
    };
    let focusTimer: number | undefined;
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 100);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine if values are currently overridden from Supplier defaults
  const isOverridden = Boolean(
    supplierCommercialDefaults && (
      (supplierCommercialDefaults.paymentTerms && data.paymentTerms !== supplierCommercialDefaults.paymentTerms) ||
      (supplierCommercialDefaults.freightCharges && data.freightCharges !== supplierCommercialDefaults.freightCharges) ||
      (supplierCommercialDefaults.currency && data.currency !== supplierCommercialDefaults.currency) ||
      (supplierCommercialDefaults.buyer && data.buyer !== supplierCommercialDefaults.buyer) ||
      (supplierCommercialDefaults.department && data.department !== supplierCommercialDefaults.department) ||
      (supplierCommercialDefaults.specialInstructions && data.specialInstructions !== supplierCommercialDefaults.specialInstructions)
    )
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="commercial-drawer-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-[440px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out transform text-slate-800 dark:text-slate-100"
        >
          {/* ── Drawer Header ── */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              </div>
              <div>
                <h2 id="commercial-drawer-title" className="font-extrabold text-sm text-slate-100 leading-none">
                  Commercial & Delivery
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supplier commercial terms snapshot & logistics
                </p>
              </div>
            </div>

            <button
              type="button"
              id="commercial-drawer-close-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
              title="Close drawer (Esc)"
              aria-label="Close drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* ── Status Banner: Supplier Mapping Lineage ── */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate min-w-0">
              <span className="material-symbols-outlined text-slate-400 text-[16px]">domain</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate" title={supplierName || "No Supplier"}>
                {supplierName || "No Supplier Selected"}
              </span>
              {supplierCode && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                  {supplierCode}
                </span>
              )}
            </div>

            {isOverridden ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                PO Override
              </span>
            ) : supplierName ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Master Default
              </span>
            ) : null}
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs font-sans">

            {/* Section 1: Commercial & Financial Terms */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[14px]">payments</span>
                  Commercial & Payment Terms
                </h3>
                {onResetToDefaults && isOverridden && !readOnly && (
                  <button
                    type="button"
                    onClick={onResetToDefaults}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold underline cursor-pointer"
                    title="Re-populate defaults from Supplier Master"
                  >
                    Reset Defaults
                  </button>
                )}
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Payment Terms
                </label>
                <select
                  ref={firstInputRef}
                  disabled={readOnly}
                  value={data.paymentTerms || "120 Days"}
                  onChange={(e) => onChange({ paymentTerms: e.target.value })}
                  className="w-full text-xs font-medium px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {PAYMENT_TERMS_PRESETS.map((pt) => (
                    <option key={pt} value={pt} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{pt}</option>
                  ))}
                </select>
              </div>

              {/* Freight Terms */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Freight & Shipping Terms
                </label>
                <select
                  disabled={readOnly}
                  value={data.freightCharges || "Paid by Supplier"}
                  onChange={(e) => onChange({ freightCharges: e.target.value })}
                  className="w-full text-xs font-medium px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {FREIGHT_TERMS_PRESETS.map((ft) => (
                    <option key={ft} value={ft} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{ft}</option>
                  ))}
                </select>
              </div>

              {/* Currency & Freight Amount */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Currency
                  </label>
                  <select
                    disabled={readOnly}
                    value={data.currency || "INR - Indian Rupee"}
                    onChange={(e) => onChange({ currency: e.target.value })}
                    className="w-full text-xs font-medium px-2 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {CURRENCY_PRESETS.map((cur) => (
                      <option key={cur} value={cur} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{cur.split(" - ")[0]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Freight Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={readOnly}
                    value={data.freightAmount ?? 0}
                    onChange={(e) => onChange({ freightAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full font-mono text-xs font-bold text-right px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Delivery & Destination */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[14px]">local_shipping</span>
                Delivery & Warehouse Destination
              </h3>

              {/* Delivery Location / Warehouse */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Delivery Destination Warehouse
                </label>
                <select
                  disabled={readOnly}
                  value={data.warehouseId || ""}
                  onChange={(e) => {
                    const warehouseId = e.target.value;
                    const warehouse = warehouses.find((w) => w.id === warehouseId);
                    onChange({
                      warehouseId,
                      deliveryLocation: warehouse ? `${warehouse.code} - ${warehouse.name}` : "",
                    });
                  }}
                  className="w-full text-xs font-medium px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  {warehouses.length > 0 ? (
                    <>
                    <option value="">Select a receiving warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {w.code} - {w.name}
                      </option>
                    ))}
                    </>
                  ) : (
                    <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      No active warehouses available
                    </option>
                  )}
                </select>
              </div>

              {/* Delivery Date & Lead Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    disabled={readOnly}
                    value={data.deliveryDate}
                    onChange={(e) => onChange({ deliveryDate: e.target.value })}
                    className="w-full font-mono text-xs px-2 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={readOnly}
                    value={data.leadTimeDays ?? 7}
                    onChange={(e) => onChange({ leadTimeDays: parseInt(e.target.value, 10) || 0 })}
                    className="w-full font-mono font-bold text-center text-xs px-2 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Buyer, Department & References */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[14px]">badge</span>
                Department & Quotation Reference
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Buyer / Merchant
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={data.buyer || ""}
                    placeholder="e.g. Senior Buyer"
                    onChange={(e) => onChange({ buyer: e.target.value })}
                    className="w-full text-xs px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={data.department || "Footwear"}
                    list="comm-dept-list"
                    onChange={(e) => onChange({ department: e.target.value })}
                    className="w-full text-xs px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <datalist id="comm-dept-list">
                    {DEPARTMENT_PRESETS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Supplier Quotation / Ref No
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={data.supplierReference || ""}
                  placeholder="e.g. QUOT-2026-894"
                  onChange={(e) => onChange({ supplierReference: e.target.value })}
                  className="w-full font-mono text-xs px-2.5 h-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Special Instructions / Packing Notes
                </label>
                <textarea
                  rows={3}
                  disabled={readOnly}
                  value={data.specialInstructions || ""}
                  placeholder="Carton packing specifications, delivery window, gate entry rules..."
                  onChange={(e) => onChange({ specialInstructions: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Section 4: Business Terms & Statutory Conditions */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[14px]">gavel</span>
                  Business Terms & Statutory Conditions
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTerms(!previewTerms)}
                    className="text-[10px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    {previewTerms ? "Edit Terms" : "Preview Terms"}
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ businessTerms: DEFAULT_BUSINESS_TERMS })}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold underline cursor-pointer disabled:opacity-50"
                    title="Load standard wholesale 120-day commercial terms"
                  >
                    Load Standard Terms
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Contract Terms & Purchase Clauses (Prints on PO PDF)
                </label>
                {previewTerms ? (
                  <div className="w-full min-h-[100px] p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs overflow-y-auto max-h-[160px]">
                    <SafeRichTermsRenderer content={data.businessTerms ?? DEFAULT_BUSINESS_TERMS} />
                  </div>
                ) : (
                  <textarea
                    rows={5}
                    disabled={readOnly}
                    value={data.businessTerms ?? DEFAULT_BUSINESS_TERMS}
                    placeholder="Enter custom business terms, warranty clauses, delivery conditions, penalty clauses, and statutory jurisdiction..."
                    onChange={(e) => onChange({ businessTerms: e.target.value })}
                    className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-indigo-500 resize-none disabled:opacity-50 font-sans leading-relaxed"
                  />
                )}
              </div>
            </div>

            {/* Informational Policy Note */}
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-[11px] text-blue-900 dark:text-blue-300 flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[16px] shrink-0 mt-0.5">info</span>
              <div>
                <span className="font-bold">Commercial Terms Guarantee:</span> Changes made here apply directly to this Purchase Order's frozen snapshot (`rule_snapshots["commercial_terms"]`) and will not overwrite the Supplier Master master-record.
              </div>
            </div>

          </div>

          {/* ── Drawer Footer ── */}
          <div className="bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400">
              Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono">Esc</kbd> to close
            </span>
            <button
              type="button"
              id="commercial-drawer-apply-btn"
              onClick={onClose}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Apply & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
