/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.30.0
 * * Created    : 2026-09-19
 * * Modified   : 2026-09-19
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { FootwearPurchaseOrderA4, FootwearPurchaseOrderData, FootwearPurchaseOrderItem } from "../../print_engine/templates/FootwearPurchaseOrderA4";
import { StandardInvoiceA4 } from "../../print_engine/templates/StandardInvoiceA4";
import { SizePivotMatrixA4 } from "../../print_engine/templates/SizePivotMatrixA4";
import type { PurchaseOrderHeader, PurchaseOrderLineItem, PurchaseOrderSizePivotRow } from "./types.ts";

export interface POPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  header: PurchaseOrderHeader;
  lineItems: PurchaseOrderLineItem[];
  sizePivotRows: PurchaseOrderSizePivotRow[];
  activeTab: string;
  vendor?: { id: string; name: string; code?: string; address?: string; gstin?: string; gst_number?: string; mobile?: string; phone?: string; state?: string } | null;
}

export const POPrintPreviewModal: React.FC<POPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  header,
  lineItems,
  sizePivotRows,
  activeTab,
  vendor,
}) => {
  // Modal Customizer Controls State (Euro & Footwear Defaults)
  const [template, setTemplate] = useState<"footwear" | "standard" | "jobwork" | "pivot">(
    activeTab === "pivot" ? "pivot" : "footwear"
  );
  const [sizingScale, setSizingScale] = useState<"EURO" | "UK" | "US">("EURO");
  const [currency, setCurrency] = useState<"EUR" | "INR" | "USD">(() => {
    const headerCurrency = (header.currency || "").toUpperCase();
    if (headerCurrency.includes("EUR")) return "EUR";
    if (headerCurrency.includes("USD")) return "USD";
    return "INR";
  });
  const [showPhotos, setShowPhotos] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Keyboard shortcut listener: ESC to close, F9/Ctrl+P to trigger window.print
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && e.key === "p")) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Currency formatting metadata
  const currencySymbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "₹";
  const fxEurToInr = 88.20;

  // Build active items list for Footwear PO
  let mappedFootwearItems: FootwearPurchaseOrderItem[] = [];

  if (activeTab === "pivot") {
    // Collect filled pivot rows
    const validPivotRows = sizePivotRows.filter(
      (r) => (r.articleNo && r.articleNo.trim().length > 0) || (r.product && r.product.trim().length > 0)
    );

    if (validPivotRows.length > 0) {
      mappedFootwearItems = validPivotRows.map((r, idx) => {
        const q40 = Number(r.sizeQuantities["40"] || r.sizeQuantities["EU 40"] || r.sizeQuantities["S"] || 0);
        const q41 = Number(r.sizeQuantities["41"] || r.sizeQuantities["EU 41"] || r.sizeQuantities["M"] || 0);
        const q42 = Number(r.sizeQuantities["42"] || r.sizeQuantities["EU 42"] || r.sizeQuantities["L"] || 0);
        const q43 = Number(r.sizeQuantities["43"] || r.sizeQuantities["EU 43"] || r.sizeQuantities["XL"] || 0);
        const q44 = Number(r.sizeQuantities["44"] || r.sizeQuantities["EU 44"] || r.sizeQuantities["XXL"] || 0);
        const q45 = Number(r.sizeQuantities["45"] || r.sizeQuantities["EU 45"] || 0);
        const totalPairs = r.totalQty || (q40 + q41 + q42 + q43 + q44 + q45) || 12;
        const cartons = Math.max(1, Math.round(totalPairs / 12));
        const rate = currency === "EUR" ? (r.rate ? r.rate / fxEurToInr : 22.50) : r.rate || 1999;
        const lineTotal = +(rate * totalPairs).toFixed(2);

        return {
          articleCode: r.articleNo || `FW-ART-${100 + idx}`,
          modelName: r.product || "Footwear Style Line",
          category: r.brand || "Footwear Collection",
          taricCode: "64035910",
          hsnCode: "6403",
          color: r.color || "Standard Noir / Tan",
          size: "EU 40-45",
          colorHex: "#334155",
          finish: "Polished Finish",
          upperMaterial: "Genuine Calf Leather / Microfiber",
          soleMaterial: "Anti-Skid TPR / Goodyear Welt",
          liningMaterial: "Breathable Sweat-Absorption Mesh",
          insoleMaterial: "High-Density Memory Cushion",
          ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
          eu40: q40 || cartons * 1,
          eu41: q41 || cartons * 2,
          eu42: q42 || cartons * 3,
          eu43: q43 || cartons * 3,
          eu44: q44 || cartons * 2,
          eu45: q45 || cartons * 1,
          cartons: cartons,
          pairs: totalPairs,
          ratePerPair: +rate.toFixed(2),
          taxRatePercent: Number(r.gstPercent ?? header.commonTaxPercent ?? 5),
          lineTotal: lineTotal,
        };
      });
    }
  } else {
    // Generation tab - Standard rows
    const validLines = lineItems.filter(
      (l) => (l.stockNo && l.stockNo.trim().length > 0) || (l.barcode && l.barcode.trim().length > 0) || (l.product && l.product.trim().length > 0)
    );

    if (validLines.length > 0) {
      mappedFootwearItems = validLines.map((l, idx) => {
        const totalPairs = l.orderQty || 12;
        const cartons = Math.max(1, Math.round(totalPairs / 12));
        const rate = currency === "EUR" ? (l.rate ? l.rate / fxEurToInr : 19.50) : l.rate || 1800;
        const lineTotal = +(rate * totalPairs).toFixed(2);

        return {
          articleCode: l.stockNo || l.barcode || `FW-ART-${200 + idx}`,
          modelName: l.product || l.barcode || "Commercial Shoe Line",
          category: l.brand || "Footwear Division",
          taricCode: "64035910",
          hsnCode: "6403",
          color: l.shade || "Classic Nero",
          size: l.size || "EU 40-45",
          colorHex: "#1e293b",
          finish: "Standard Matt Finish",
          upperMaterial: "Full Grain Leather / Mesh",
          soleMaterial: "Phylon EVA / Molded Rubber",
          liningMaterial: "Anti-Bacterial Fabric",
          insoleMaterial: "Anatomic Arch Support",
          ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
          eu40: cartons * 1,
          eu41: cartons * 2,
          eu42: cartons * 3,
          eu43: cartons * 3,
          eu44: cartons * 2,
          eu45: cartons * 1,
          cartons: cartons,
          pairs: totalPairs,
          ratePerPair: +rate.toFixed(2),
          taxRatePercent: Number(l.taxPercent ?? header.commonTaxPercent ?? 5),
          lineTotal: lineTotal,
        };
      });
    }
  }

  const mappedNetTotal = mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const mappedTotalPairs = mappedFootwearItems.reduce((sum, item) => sum + item.pairs, 0);
  const mappedTotalCartons = mappedFootwearItems.reduce((sum, item) => sum + item.cartons, 0);

  // Construct Footwear PO Data payload
  const footwearData: FootwearPurchaseOrderData = {
    poNumber: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    poDate: header.orderDate || new Date().toISOString().split("T")[0],
    deliveryDate: header.deliveryDate || new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    companyName: "SMRITI RETAIL OS",
    companySubtitle: "Enterprise Sourcing & Procurement Division",
    companyAddress: "Central Logistics Hub, SMRITI Retail OS",
    companyGstin: "27AABCT9981K1Z2",
    companyContact: "sourcing@smritibooks.com",
    vendorName: header.supplierName || vendor?.name || "Selected Supplier",
    vendorCode: header.supplierId || vendor?.code || "—",
    vendorAddress: vendor?.address || "Registered Supplier Premises",
    vendorGstin: vendor?.gstin || vendor?.gst_number || "—",
    vendorContact: vendor?.mobile || vendor?.phone || "—",
    dcCode: "DC-MAIN-01",
    dcName: "Central Distribution Depot",
    dcAddress: "Central Commercial Freight Bay",
    dcGstin: "27AABCT9981K1Z2",
    dcReceivingGate: "Gate 1 - Commercial Freight Bay",
    currency: currency,
    currencySymbol: currencySymbol,
    sizingScale: sizingScale,
    showPhotos: showPhotos,
    items: mappedFootwearItems,
    totalCartons: mappedTotalCartons,
    totalPairs: mappedTotalPairs,
    netOrderValue: mappedNetTotal,
    netOrderValueInWords: `${currencySymbol} ${mappedNetTotal.toFixed(2)} (calculated from live PO lines)`,
    paymentTerms: header.paymentTerms || "30 Days",
    purchaser: header.buyer || "—",
    supplierReference: header.supplierReference || "—",
    documentStatus: "DRAFT",
    secondaryCurrencyTotal:
      currency === "EUR" ? "Domestic Valuation (@ ₹ 88.20 / EUR)" : undefined,
  };

  // Standard PO Data fallback for StandardInvoiceA4 component
  const standardInvoiceData = {
    documentType: template === "jobwork" ? "job-work-order" as const : "purchase-order" as const,
    supplierName: header.supplierName || vendor?.name || "Selected Supplier",
    supplierAddress: vendor?.address || "Registered Supplier Premises",
    supplierGst: vendor?.gstin || vendor?.gst_number || "—",
    supplierPhone: vendor?.mobile || vendor?.phone || "",
    deliveryLocation: header.deliveryLocation || "Main Store (MAIN)",
    deliveryDate: header.deliveryDate || "",
    paymentTerms: header.paymentTerms || "30 Days",
    supplierReference: header.supplierReference || "",
    purchaser: header.buyer || "",
    department: header.department || "General Purchase",
    specialInstructions: header.specialInstructions || "",
    isInterstate: Boolean(vendor?.state && vendor.state.trim().toLowerCase() !== "maharashtra"),
    currencySymbol,
    invoiceNo: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    date: header.orderDate || new Date().toISOString().split("T")[0],
    dueDate: header.deliveryDate || "",
    company: {
      name: "SMRITI Retail OS",
      address: "Central Logistics Park, SMRITI Retail OS",
      gstin: "27AABCT9981K1Z2",
      phone: "+91 712 2987654",
      email: "procurement@smritibooks.com",
      pan: "AABCT9981K",
    },
    customer: {
      name: header.supplierName || vendor?.name || "Selected Supplier",
      address: vendor?.address || "Registered Supplier Premises",
      gstin: vendor?.gstin || vendor?.gst_number || "—",
      phone: vendor?.mobile || vendor?.phone || "—",
      state: vendor?.state || "Commercial State",
      stateCode: "27",
    },
    items: mappedFootwearItems.map((it, idx) => ({
      sNo: idx + 1,
      code: it.articleCode,
      name: `${it.articleCode} - ${it.modelName} | Color: ${it.color} | Size: ${it.size || "EU 40-45"}`,
      barcode: it.articleCode,
      description: `${it.articleCode} - ${it.modelName} | Color: ${it.color} | Size: ${it.size || "EU 40-45"}`,
      hsnCode: it.hsnCode || "6403",
      qty: it.pairs,
      uom: "PRS",
      mrp: it.ratePerPair * 1.5,
      unitPrice: it.ratePerPair,
      discount: 0,
      taxableAmount: it.lineTotal,
      gstRate: it.taxRatePercent,
      cgstPercent: it.taxRatePercent / 2,
      cgstAmount: (it.lineTotal * (it.taxRatePercent / 200)),
      sgstPercent: it.taxRatePercent / 2,
      sgstAmount: (it.lineTotal * (it.taxRatePercent / 200)),
      total: it.lineTotal * (1 + it.taxRatePercent / 100),
    })),
    subtotal: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal, 0),
    taxTotal: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal * (item.taxRatePercent / 100), 0),
    total: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal * (1 + item.taxRatePercent / 100), 0),
    amountInWords: "",
    terms: "1. Goods delivered per SATRA norms.\n2. Payment terms 30 days net from GRN date.",
  };

  return (
    <div
      className="print-preview-visible fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible"
      role="dialog"
      aria-modal="true"
      aria-label="Purchase Order Print Preview"
    >
      {/* Top Floating Control Bar - Excluded in @media print */}
      <div className="sticky top-2 z-60 w-full max-w-5xl bg-[#1e1b4b] text-white rounded-xl shadow-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border border-indigo-500/30 print:hidden mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-xl">print</span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-2">
              <span>Purchase Order Print Preview</span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                {currency === "INR" ? "INDIAN RUPEE (₹)" : currency === "USD" ? "US DOLLAR ($)" : "EURO (€)"}
              </span>
            </h2>
            <p className="text-[10px] text-indigo-300 font-mono">
              PO: {header.prefix}-{header.orderNumber} • Vendor: {header.supplierName || "Apex Fabrics Ltd"}
            </p>
          </div>
        </div>

        {/* Customizer Controls Strip */}
        <div className="flex items-center gap-2 text-xs">
          {/* Template Format Selector */}
          <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
            <span className="text-[10px] text-indigo-300">Format:</span>
            <select
              id="po-preview-template-select"
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
            >
              <option value="footwear" className="bg-slate-900 text-white">Footwear PO (Euro Scale & Matrix)</option>
              <option value="standard" className="bg-slate-900 text-white">Standard Enterprise PO (A4)</option>
              <option value="jobwork" className="bg-slate-900 text-white">Job Work Order (A4)</option>
              <option value="pivot" className="bg-slate-900 text-white">Size Pivot Matrix (A4)</option>
            </select>
          </div>

          {template === "footwear" && (
            <>
              {/* Sizing Scale Selector */}
              <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
                <span className="text-[10px] text-indigo-300">Scale:</span>
                <select
                  id="po-preview-scale-select"
                  value={sizingScale}
                  onChange={(e) => setSizingScale(e.target.value as any)}
                  className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="EURO" className="bg-slate-900 text-white">Euro (EU 40-45) [Default]</option>
                  <option value="UK" className="bg-slate-900 text-white">UK / India (6-11)</option>
                  <option value="US" className="bg-slate-900 text-white">US Mens (7-12)</option>
                </select>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
                <span className="text-[10px] text-indigo-300">Currency:</span>
                <select
                  id="po-preview-currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="EUR" className="bg-slate-900 text-white">Euro (€ - EUR)</option>
                  <option value="INR" className="bg-slate-900 text-white">Indian Rupee (₹ - INR) [Default]</option>
                  <option value="USD" className="bg-slate-900 text-white">US Dollar ($ - USD)</option>
                </select>
              </div>

              {/* Shoe Photo Toggle */}
              <label className="flex items-center gap-1 text-[11px] bg-indigo-900/60 hover:bg-indigo-900 text-indigo-100 rounded px-2 py-1 border border-indigo-700 cursor-pointer">
                <input
                  type="checkbox"
                  id="po-preview-toggle-photos"
                  checked={showPhotos}
                  onChange={(e) => setShowPhotos(e.target.checked)}
                  className="rounded text-amber-400 focus:ring-0"
                />
                <span>Shoe Photos</span>
              </label>
            </>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-1.5 py-1 border border-indigo-700 text-[11px]">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="hover:text-amber-400 font-bold px-1"
              title="Zoom out"
            >
              -
            </button>
            <span className="font-mono text-[10px]">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="hover:text-amber-400 font-bold px-1"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            id="po-preview-print-action-btn"
            onClick={() => window.print()}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            id="po-preview-close-modal-btn"
            onClick={onClose}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-0.5"
            title="Close preview (Esc)"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Esc
          </button>
        </div>
      </div>

      {/* Document Sheet Display Canvas with Scaled Preview */}
      <div className="w-full flex justify-center pb-12 print:p-0 print:m-0">
        <div
          id="po-print-preview-sheet-wrapper"
          className="transition-transform duration-150 origin-top shadow-2xl print:shadow-none print:transform-none"
          style={{ transform: `scale(${zoomLevel / 100})` }}
        >
          {template === "footwear" ? (
            <FootwearPurchaseOrderA4 data={footwearData} />
          ) : template === "pivot" ? (
            <SizePivotMatrixA4
              header={header}
              rows={sizePivotRows}
              currencySymbol={currencySymbol}
              vendorName={vendor?.name}
            />
          ) : (
            <div className="bg-white p-8 rounded-lg shadow-xl w-[210mm] min-h-[297mm]">
              <StandardInvoiceA4 data={standardInvoiceData as any} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POPrintPreviewModal;
