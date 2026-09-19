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
  const [template, setTemplate] = useState<"footwear" | "standard">("footwear");
  const [sizingScale, setSizingScale] = useState<"EURO" | "UK" | "US">("EURO");
  const [currency, setCurrency] = useState<"EUR" | "INR" | "USD">("EUR");
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
          taxRatePercent: 0.0,
          lineTotal: lineTotal,
        };
      });
    }
  } else {
    // Generation tab - Standard rows
    const validLines = lineItems.filter(
      (l) => (l.stockNo && l.stockNo.trim().length > 0) || (l.product && l.product.trim().length > 0)
    );

    if (validLines.length > 0) {
      mappedFootwearItems = validLines.map((l, idx) => {
        const totalPairs = l.orderQty || 12;
        const cartons = Math.max(1, Math.round(totalPairs / 12));
        const rate = currency === "EUR" ? (l.rate ? l.rate / fxEurToInr : 19.50) : l.rate || 1800;
        const lineTotal = +(rate * totalPairs).toFixed(2);

        return {
          articleCode: l.stockNo || `FW-ART-${200 + idx}`,
          modelName: l.product || "Commercial Shoe Line",
          category: l.brand || "Footwear Division",
          taricCode: "64035910",
          hsnCode: "6403",
          color: l.shade || "Classic Nero",
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
          taxRatePercent: 0.0,
          lineTotal: lineTotal,
        };
      });
    }
  }

  // Construct Footwear PO Data payload
  const footwearData: FootwearPurchaseOrderData = {
    poNumber: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    poDate: header.orderDate || new Date().toISOString().split("T")[0],
    deliveryDate: header.deliveryDate || new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    companyName: "TATTLY FOOTWEAR & LEATHER APPAREL PVT LTD",
    companySubtitle: "Enterprise Footwear & Lifestyle Sourcing Division",
    companyAddress: "Central Logistics Hub, Plot 42, Multi-Modal Hub, MIHAN SEZ, Nagpur, Maharashtra 441108",
    companyGstin: "27AABCT9981K1Z2",
    companyContact: "+91 712 2987654 / sourcing@tattlyfootwear.com",
    vendorName: header.supplierName || vendor?.name || "Apex Fabrics & Footwear Ltd",
    vendorCode: header.supplierId || vendor?.code || "VEND-001",
    vendorAddress: vendor?.address || "Industrial Area Phase II, Agra - 282007, Uttar Pradesh, India",
    vendorGstin: vendor?.gstin || vendor?.gst_number || "09AABCA7712K1Z6",
    vendorContact: vendor?.mobile || vendor?.phone || "+91 98765 43210",
    dcCode: "DC-NAGPUR-01",
    dcName: "Nagpur Central Footwear Depot",
    dcAddress: "Plot 42, Logistics Park, Wardha Road, Nagpur 441108",
    dcGstin: "27AABCT9981K1Z2",
    dcReceivingGate: "Gate 4 - Commercial Freight Bay",
    currency: currency,
    currencySymbol: currencySymbol,
    sizingScale: sizingScale,
    showPhotos: showPhotos,
    items: mappedFootwearItems.length > 0 ? mappedFootwearItems : undefined, // fallback to template mock showcase if empty
    secondaryCurrencyTotal:
      currency === "EUR" ? "₹ 6,40,332.00 Domestic Valuation (@ ₹ 88.20 / EUR)" : undefined,
  };

  // Standard PO Data fallback for StandardInvoiceA4 component
  const standardInvoiceData = {
    invoiceNo: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    date: header.orderDate || new Date().toISOString().split("T")[0],
    dueDate: header.deliveryDate || "",
    company: {
      name: "Tattly Threads & Footwear Retail Ltd",
      address: "Nagpur Logistics Park, Maharashtra 440029",
      gstin: "27AABCT9981K1Z2",
      phone: "+91 712 2987654",
      email: "procurement@smritibooks.com",
      pan: "AABCT9981K",
    },
    customer: {
      name: header.supplierName || vendor?.name || "Apex Fabrics Ltd",
      address: vendor?.address || "Factory Road, Sourcing District, India",
      gstin: vendor?.gstin || vendor?.gst_number || "09AABCA7712K1Z6",
      phone: vendor?.mobile || vendor?.phone || "+91 98765 43210",
      state: vendor?.state || "Maharashtra",
      stateCode: "27",
    },
    items: (mappedFootwearItems.length > 0 ? mappedFootwearItems : [
      {
        articleCode: "FW-OXF-801",
        modelName: "Men's Handcrafted Leather Oxford Derby",
        hsnCode: "6403",
        pairs: 120,
        ratePerPair: 21.00,
        taxRatePercent: 5.0,
        lineTotal: 2520.00,
      }
    ]).map((it, idx) => ({
      sNo: idx + 1,
      barcode: it.articleCode,
      description: `${it.modelName} (EU 40-45 Euro Scale)`,
      hsnCode: it.hsnCode || "6403",
      qty: it.pairs,
      uom: "PRS",
      mrp: it.ratePerPair * 1.5,
      unitPrice: it.ratePerPair,
      discount: 0,
      taxableAmount: it.lineTotal,
      gstPercent: it.taxRatePercent || 5,
      cgstPercent: (it.taxRatePercent || 5) / 2,
      cgstAmount: (it.lineTotal * ((it.taxRatePercent || 5) / 200)),
      sgstPercent: (it.taxRatePercent || 5) / 2,
      sgstAmount: (it.lineTotal * ((it.taxRatePercent || 5) / 200)),
      total: it.lineTotal * (1 + (it.taxRatePercent || 5) / 100),
    })),
    subtotal: 7260,
    taxTotal: 363,
    total: 7623,
    amountInWords: "Seven Thousand Six Hundred Twenty Three Only",
    terms: "1. Goods delivered per SATRA norms.\n2. Payment terms 30 days net from GRN date.",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible"
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
                EURO SCALE (EU 40-45) [DEFAULT]
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
                  <option value="EUR" className="bg-slate-900 text-white">Euro (€ - EUR) [Default]</option>
                  <option value="INR" className="bg-slate-900 text-white">Indian Rupee (₹ - INR)</option>
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
