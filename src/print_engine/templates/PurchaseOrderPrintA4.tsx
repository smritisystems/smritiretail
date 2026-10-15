/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: [REDACTED_PUBLIC_PII]
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.82.0
 * * Created    : 2026-10-15
 * * Modified   : 2026-10-15
 * * Copyright  : © SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 */

import React from "react";

export interface FootwearArticleReference {
  articleNo: string;
  color: string;
  heels?: string;
  upperMaterial?: string;
  outsole?: string;
  imageUrl?: string;
}

export interface PurchaseOrderPrintData {
  // Mode: "sizewise" (default) or "standard"
  mode?: "sizewise" | "standard";

  // Company Information
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyPan?: string;
  companyPhone?: string;
  companyEmail?: string;
  logoUrl?: string;

  // Purchase Order Metadata
  poNumber?: string;
  orderDate?: string;
  expectedDelivery?: string;
  warehouse?: string;
  status?: string;

  // Supplier Information
  supplierName?: string;
  supplierCode?: string;
  supplierAddress?: string;
  supplierGstin?: string;
  supplierContact?: string;
  supplierEmail?: string;

  // Sizewise Matrix Details
  sizeChartName?: string; // e.g. "Size Chart: EU (36 - 44)"
  sizeColumns?: string[]; // e.g. ["36", "37", "38", "39", "40", "41", "42", "43", "44"]
  sizewiseItems?: {
    sNo: number;
    articleNo: string;
    color: string;
    sizeQuantities: Record<string, number>;
    totalQty: number;
    rate: number;
    taxPercent?: number;
    taxAmount?: number;
    amount: number;
  }[];

  // Standard (Barcode-wise) Details
  standardItems?: {
    sNo: number;
    barcode?: string;
    articleNo: string;
    productName: string;
    color?: string;
    size?: string;
    quantity: number;
    rate: number;
    taxPercent?: number;
    taxAmount?: number;
    amount: number;
  }[];

  // Item Reference Cards (2 large preview images per row)
  itemReferences?: FootwearArticleReference[];

  // Commercial Terms
  paymentTerms?: string;
  freightTerms?: string;
  currency?: string;
  deliveryTerms?: string;
  supplierReference?: string;
  specialInstructions?: string;

  // Order Financial Summary
  totalItems?: number;
  totalQuantity?: number;
  subtotal?: number;
  commonTaxPercent?: number;
  gstAmount?: number;
  grandTotal?: number;

  // Remarks & Signatures
  remarks?: string;
  preparedByName?: string;
  preparedByDate?: string;
  checkedByName?: string;
  checkedByDate?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  authorizedSignatoryDate?: string;

  // Currency & Layout Configuration
  currencySymbol?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * GoldenRatioImagePlaceholder — Renders an image container formatted to the Golden Ratio (1.618 : 1)
 * with a high-fidelity watermark of the Company Name and subtle geometric Golden Spiral / grid lines.
 * Mandated for missing or unavailable footwear product imagery in SMRITI purchase order print formats.
 */
export const GoldenRatioImagePlaceholder: React.FC<{
  companyName?: string;
  articleNo?: string;
  className?: string;
}> = ({ companyName, articleNo, className = "" }) => {
  const displayCompany = companyName || "SMRITI Retail Private Limited";

  return (
    <div
      className={`relative w-full h-[68px] rounded-md border border-slate-200/90 bg-gradient-to-br from-slate-50 via-slate-100/60 to-blue-50/30 flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{
        aspectRatio: "1.618 / 1",
        maxHeight: "70px",
      }}
      title={`Image placeholder for ${articleNo || "article"} with ${displayCompany} watermark`}
    >
      {/* 1. Subtle Golden Ratio Geometry / Fibonacci Grid Overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.09] pointer-events-none"
        viewBox="0 0 162 100"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="162" height="100" fill="none" stroke="#1e3a8a" strokeWidth="1" />
        <line x1="100" y1="0" x2="100" y2="100" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="3 2" />
        <line x1="100" y1="62" x2="162" y2="62" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="3 2" />
        <line x1="138" y1="62" x2="138" y2="100" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="3 2" />
        <path
          d="M 100 100 A 100 100 0 0 1 0 0 A 62 62 0 0 1 100 62 A 38 38 0 0 1 138 100"
          fill="none"
          stroke="#1e3a8a"
          strokeWidth="0.8"
        />
      </svg>

      {/* 2. Prominent Diagonal Watermark of Company Name */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden p-1">
        <span
          className="text-[#1e3a8a] opacity-[0.16] font-black uppercase text-[10px] whitespace-nowrap transform -rotate-12 select-none tracking-[0.22em] text-center"
          style={{ letterSpacing: "0.22em" }}
        >
          {displayCompany}
        </span>
      </div>

      {/* 3. Center Content: Footwear Silhouette Icon + Article Label + Golden Ratio Badge */}
      <div className="relative z-10 flex flex-col items-center justify-center text-slate-400 p-1.5 text-center">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.4"
          className="opacity-70 drop-shadow-2xs"
        >
          <path d="M2 18h20c-.5-3-2-6-5-7l-5-2-4 1-4 3c-1 1-1.5 3-2 5z" />
          <path d="M2 18v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2" />
        </svg>
        <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
          {articleNo ? `${articleNo}` : "Pending Image"}
        </span>
        <span className="text-[6.5px] font-mono text-slate-400 tracking-tight">
          Golden Ratio (1.618 : 1)
        </span>
      </div>
    </div>
  );
};

export const PurchaseOrderPrintA4: React.FC<{ data: PurchaseOrderPrintData }> = ({ data }) => {
  const isLandscape = data.orientation === "landscape";
  const currencySymbol = data.currencySymbol || "₹";
  const isStandard = data.mode === "standard";

  // Dynamic Size Columns (Default fallback to EU 36 - 44)
  const sizeColumns = (data.sizeColumns && data.sizeColumns.length > 0)
    ? data.sizeColumns
    : ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

  const sizeChartName = data.sizeChartName || `Size Chart: EU (${sizeColumns[0]} - ${sizeColumns[sizeColumns.length - 1]})`;

  // Format currency with Indian grouping
  const formatCurrency = (val?: number): string => {
    if (val === undefined || val === null || isNaN(val)) return "0.00";
    return val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Safe attribute display fallback
  const displayAttr = (val?: string): string => {
    if (!val || !val.trim() || val.trim().toLowerCase() === "null" || val.trim().toLowerCase() === "undefined") {
      return "—";
    }
    return val.trim();
  };

  // Sizewise calculations
  const sizewiseRows = data.sizewiseItems || [];
  const perSizeTotals = sizeColumns.map((sz) => {
    return sizewiseRows.reduce((sum, item) => sum + (Number(item.sizeQuantities?.[sz]) || 0), 0);
  });

  const calculatedTotalQty = isStandard
    ? (data.standardItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    : sizewiseRows.reduce((sum, item) => sum + (Number(item.totalQty) || 0), 0);

  const calculatedTotalAmount = isStandard
    ? (data.standardItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : sizewiseRows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const calculatedTotalTaxAmount = isStandard
    ? (data.standardItems || []).reduce(
        (sum, item) =>
          sum +
          (item.taxAmount !== undefined
            ? Number(item.taxAmount)
            : (Number(item.amount) * (Number(item.taxPercent) || data.commonTaxPercent || 18)) / 100),
        0
      )
    : sizewiseRows.reduce(
        (sum, item) =>
          sum +
          (item.taxAmount !== undefined
            ? Number(item.taxAmount)
            : (Number(item.amount) * (Number(item.taxPercent) || data.commonTaxPercent || 18)) / 100),
        0
      );

  const displayTotalItems = data.totalItems ?? (isStandard ? (data.standardItems || []).length : sizewiseRows.length);
  const displayTotalQty = data.totalQuantity ?? calculatedTotalQty;
  const displaySubtotal = data.subtotal ?? (data.grandTotal ? data.grandTotal - (data.gstAmount || 0) : calculatedTotalAmount);
  const displayGst = data.gstAmount !== undefined ? data.gstAmount : calculatedTotalTaxAmount;
  const displayGrandTotal = data.grandTotal ?? (displaySubtotal + displayGst);

  // Item References deduplication / formatting
  const references = data.itemReferences || [];

  return (
    <div
      className={`bg-white text-slate-900 mx-auto box-border font-sans antialiased shadow-sm print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none print:min-h-0 print:h-auto ${
        isLandscape ? "w-[297mm] min-h-[210mm] p-6" : "w-[210mm] min-h-[297mm] p-6 sm:p-7"
      }`}
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* ── CSS Page Setup for Perfect A4 Printing ────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
            margin: 6mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          table {
            width: 100% !important;
          }
          .overflow-x-auto {
            overflow: visible !important;
          }
          #po-print-preview-sheet-wrapper,
          .print-only-container {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* ── 1. HEADER & COMPANY INFORMATION ─────────────────────────────── */}
      <header className="flex justify-between items-start pb-2 mb-2 border-b border-slate-200">
        {/* Left: SMRITI Retail OS Brand Logo + Company Details */}
        <div className="flex items-start">
          <div className="pr-4 mr-4 border-r border-slate-200 flex flex-col justify-center">
            <div className="text-2xl font-black tracking-tight text-[#0f172a] leading-none flex items-center">
              <span>SMRITI</span>
            </div>
            <div className="text-[9px] font-bold tracking-[0.32em] text-[#334155] uppercase mt-1 leading-none">
              RETAIL OS
            </div>
          </div>
          <div className="text-[10px] text-slate-600 leading-snug">
            <h1 className="text-xs font-bold text-[#0f172a] leading-tight">
              {data.companyName || "SMRITI Retail Private Limited"}
            </h1>
            <p className="whitespace-pre-line text-slate-600 mt-0.5">
              {data.companyAddress || "123 Retail Park, MG Road, Bengaluru - 560001\nKarnataka, India"}
            </p>
            <p className="text-slate-700 font-medium mt-0.5">
              GSTIN: <span className="font-mono">{data.companyGstin || "29AABCS1234F1Z5"}</span>
              {data.companyPan && (
                <>
                  <span className="mx-1 text-slate-300">|</span>
                  PAN: <span className="font-mono">{data.companyPan}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: Document Title & Metadata Box */}
        <div className="text-right flex flex-col items-end">
          <h2 className="text-lg font-black tracking-tight text-[#1e3a8a] uppercase leading-none mb-1.5">
            PURCHASE ORDER
          </h2>
          <div className="border border-slate-200 rounded-md bg-white p-1.5 min-w-[200px] text-[10px] leading-tight text-left shadow-2xs">
            <div className="grid grid-cols-[100px_8px_1fr] gap-y-0.5 items-center">
              <span className="text-slate-600">PO No.</span>
              <span className="text-slate-400">:</span>
              <span className="font-mono font-bold text-slate-900">{data.poNumber || "PO-2026-00123"}</span>

              <span className="text-slate-600">Order Date</span>
              <span className="text-slate-400">:</span>
              <span className="font-semibold text-slate-800">{data.orderDate || "14 Oct 2026"}</span>

              <span className="text-slate-600">Expected Delivery</span>
              <span className="text-slate-400">:</span>
              <span className="font-semibold text-slate-800">{data.expectedDelivery || "25 Oct 2026"}</span>

              <span className="text-slate-600">Warehouse</span>
              <span className="text-slate-400">:</span>
              <span className="font-semibold text-slate-800">{data.warehouse || "Main Warehouse"}</span>

              <span className="text-slate-600">Status</span>
              <span className="text-slate-400">:</span>
              <span>
                <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  {data.status || "DRAFT"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. SUPPLIER INFORMATION PANEL ──────────────────────────────── */}
      <section className="bg-[#eff6ff] border border-[#dbeafe] rounded-lg p-1.5 mb-1.5 text-[9.5px] text-slate-700 leading-snug">
        <div className="text-[9.5px] font-extrabold text-[#2563eb] uppercase tracking-wider mb-1">
          SUPPLIER
        </div>
        <div className="font-bold text-[11.5px] text-slate-900 flex items-center gap-1.5">
          <span>{data.supplierName || "ABC Footwear Pvt Ltd"}</span>
          {data.supplierCode && (
            <span className="text-slate-500 font-mono text-[10px] font-semibold">
              ({data.supplierCode})
            </span>
          )}
        </div>
        <div className="whitespace-pre-line text-slate-600 mt-0.5">
          {data.supplierAddress || "A-12, Industrial Area, Andheri (East)\nMumbai - 400093, Maharashtra, India"}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-slate-800 font-medium mt-1">
          {data.supplierGstin && (
            <div>
              GSTIN: <span className="font-mono">{data.supplierGstin}</span>
            </div>
          )}
          {(data.supplierContact || data.supplierEmail) && (
            <div className="flex items-center gap-2 text-slate-600">
              {data.supplierContact && <span>Contact: {data.supplierContact}</span>}
              {data.supplierContact && data.supplierEmail && <span className="text-slate-300">|</span>}
              {data.supplierEmail && <span>Email: {data.supplierEmail}</span>}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. ITEM DETAILS TABLE (SIZEWISE or STANDARD) ───────────────── */}
      <section className="mb-1.5">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wide">
            {isStandard ? "ITEM DETAILS (STANDARD - BARCODE-WISE)" : "ITEM DETAILS (SIZEWISE)"}
          </h3>
          {!isStandard && (
            <span className="text-[10.5px] font-bold text-[#2563eb]">
              {sizeChartName}
            </span>
          )}
        </div>

        {!isStandard ? (
          /* ── SIZEWISE MATRIX TABLE ── */
          <div className="overflow-x-auto border border-[#cbd5e1] rounded-md">
            <table className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-[#f8fafc] text-slate-700 font-bold border-b border-[#cbd5e1]">
                  <th rowSpan={2} className="p-1 border-r border-[#cbd5e1] text-center w-5 text-[9px]">#</th>
                  <th rowSpan={2} className="px-1.5 py-1 border-r border-[#cbd5e1] text-left w-[76px] text-[9px]">ARTICLE NO.</th>
                  <th rowSpan={2} className="px-1.5 py-1 border-r border-[#cbd5e1] text-left w-[56px] text-[9px]">COLOR</th>
                  <th colSpan={sizeColumns.length} className="px-1 py-0.5 border-r border-[#cbd5e1] text-center bg-[#f0f7ff] text-[#1e3a8a] font-extrabold uppercase tracking-wide text-[9px]">
                    SIZE (EU)
                  </th>
                  <th rowSpan={2} className="px-1 py-1 border-r border-[#cbd5e1] text-center bg-[#f0f7ff] text-[#1e3a8a] font-extrabold w-[46px] text-[9px]">
                    TOTAL QTY
                  </th>
                  <th rowSpan={2} className="px-1 py-1 border-r border-[#cbd5e1] text-right w-[54px] text-[9px] whitespace-nowrap">
                    RATE ({currencySymbol})
                  </th>
                  <th rowSpan={2} className="px-0.5 py-1 border-r border-[#cbd5e1] text-center w-[36px] text-[9px] whitespace-nowrap">
                    TAX %
                  </th>
                  <th rowSpan={2} className="px-1 py-1 border-r border-[#cbd5e1] text-right w-[58px] text-[9px] whitespace-nowrap">
                    TAX ({currencySymbol})
                  </th>
                  <th rowSpan={2} className="px-1.5 py-1 text-right w-[70px] text-[9px] whitespace-nowrap">
                    AMOUNT ({currencySymbol})
                  </th>
                </tr>
                <tr className="bg-[#f0f7ff] border-b border-[#cbd5e1]">
                  {sizeColumns.map((sz) => (
                    <th
                      key={sz}
                      className="px-0.5 py-0.5 border-r border-[#cbd5e1] text-center font-bold text-[#2563eb] w-[22px] min-w-[20px] text-[8.5px]"
                    >
                      {sz}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizewiseRows.length === 0 ? (
                  <tr>
                    <td colSpan={sizeColumns.length + 7} className="p-4 text-center italic text-slate-500">
                      No purchase order items recorded.
                    </td>
                  </tr>
                ) : (
                  sizewiseRows.map((item, idx) => {
                    const rowTaxPct = item.taxPercent ?? data.commonTaxPercent ?? 18;
                    const rowTaxVal = item.taxAmount !== undefined
                      ? item.taxAmount
                      : (item.amount * rowTaxPct) / 100;

                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                      >
                        <td className="p-1 text-center text-slate-500 border-r border-slate-200 text-[8.5px]">{item.sNo || idx + 1}</td>
                        <td className="px-1.5 py-1 font-bold font-mono text-slate-900 border-r border-slate-200 text-[9px] whitespace-nowrap">
                          {item.articleNo || "—"}
                        </td>
                        <td className="px-1.5 py-1 text-slate-800 border-r border-slate-200 text-[9px] truncate max-w-[56px]">{item.color || "—"}</td>
                        {sizeColumns.map((sz) => {
                          const qty = item.sizeQuantities?.[sz];
                          return (
                            <td
                              key={sz}
                              className="px-0.5 py-1 text-center font-medium text-slate-800 border-r border-slate-200 text-[8.5px]"
                            >
                              {qty !== undefined && qty > 0 ? qty : "—"}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1 text-center font-bold text-slate-900 bg-blue-50/20 border-r border-slate-200 text-[9px]">
                          {item.totalQty}
                        </td>
                        <td className="px-1 py-1 text-right font-mono text-slate-800 border-r border-slate-200 text-[8.5px] whitespace-nowrap">
                          {formatCurrency(item.rate)}
                        </td>
                        <td className="px-0.5 py-1 text-center text-slate-600 font-mono border-r border-slate-200 text-[8.5px] whitespace-nowrap">
                          {rowTaxPct}%
                        </td>
                        <td className="px-1 py-1 text-right font-mono text-slate-800 border-r border-slate-200 text-[8.5px] whitespace-nowrap">
                          {formatCurrency(rowTaxVal)}
                        </td>
                        <td className="px-1.5 py-1 text-right font-mono font-medium text-slate-900 text-[8.5px] whitespace-nowrap">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8fafc] font-black border-t-2 border-[#cbd5e1]">
                  <td colSpan={3} className="px-1.5 py-1 text-right uppercase tracking-wider text-[#1e3a8a] border-r border-slate-300 text-[9px]">
                    TOTAL
                  </td>
                  {perSizeTotals.map((tot, idx) => (
                    <td key={idx} className="px-0.5 py-1 text-center font-bold text-slate-900 border-r border-slate-300 text-[8.5px]">
                      {tot > 0 ? tot : "—"}
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center font-black text-slate-950 bg-blue-50/60 border-r border-slate-300 text-[9px]">
                    {displayTotalQty}
                  </td>
                  <td className="px-1 py-1 text-center text-slate-400 border-r border-slate-300 text-[8.5px]">-</td>
                  <td className="px-0.5 py-1 text-center text-slate-400 border-r border-slate-300 text-[8.5px]">-</td>
                  <td className="px-1 py-1 text-right font-bold text-slate-900 font-mono border-r border-slate-300 text-[8.5px] whitespace-nowrap">
                    {formatCurrency(displayGst)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-black text-[#1d4ed8] text-[9.5px] font-mono whitespace-nowrap">
                    {formatCurrency(calculatedTotalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ── STANDARD (BARCODE-WISE) TABLE ── */
          <div className="overflow-x-auto border border-[#cbd5e1] rounded-md">
            <table className="w-full border-collapse text-[9.5px]">
              <thead>
                <tr className="bg-[#f8fafc] text-slate-700 font-bold border-b border-[#cbd5e1]">
                  <th className="p-1 border-r border-[#cbd5e1] text-center w-6">#</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-left w-24">BARCODE / SKU</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-left w-24">ARTICLE NO.</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-left">PRODUCT DESCRIPTION</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-left w-16">COLOR</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-center w-12">SIZE</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-center bg-[#f0f7ff] text-[#1e3a8a] font-extrabold w-14">QTY</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-right w-16">RATE ({currencySymbol})</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-center w-12">TAX %</th>
                  <th className="p-1.5 border-r border-[#cbd5e1] text-right w-18">TAX ({currencySymbol})</th>
                  <th className="p-1.5 text-right w-20">AMOUNT ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {(data.standardItems || []).length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-4 text-center italic text-slate-500">
                      No standard line items available.
                    </td>
                  </tr>
                ) : (
                  (data.standardItems || []).map((line, idx) => {
                    const rowTaxPct = line.taxPercent ?? data.commonTaxPercent ?? 18;
                    const rowTaxVal = line.taxAmount !== undefined
                      ? line.taxAmount
                      : (line.amount * rowTaxPct) / 100;

                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                      >
                        <td className="p-1 text-center text-slate-500 border-r border-slate-200">{line.sNo || idx + 1}</td>
                        <td className="p-1.5 font-mono text-slate-700 border-r border-slate-200">{line.barcode || "—"}</td>
                        <td className="p-1.5 font-bold font-mono text-slate-900 border-r border-slate-200">{line.articleNo || "—"}</td>
                        <td className="p-1.5 font-medium text-slate-800 border-r border-slate-200">{line.productName || "Footwear Article"}</td>
                        <td className="p-1.5 text-slate-700 border-r border-slate-200">{line.color || "—"}</td>
                        <td className="p-1.5 text-center font-bold text-slate-800 border-r border-slate-200">{line.size || "—"}</td>
                        <td className="p-1 text-center font-bold text-slate-900 bg-blue-50/20 border-r border-slate-200">{line.quantity}</td>
                        <td className="p-1.5 text-right font-mono text-slate-800 border-r border-slate-200">{formatCurrency(line.rate)}</td>
                        <td className="p-1.5 text-center text-slate-600 font-mono border-r border-slate-200">{rowTaxPct}%</td>
                        <td className="p-1.5 text-right font-mono text-slate-800 border-r border-slate-200">{formatCurrency(rowTaxVal)}</td>
                        <td className="p-1.5 text-right font-mono font-medium text-slate-900">{formatCurrency(line.amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8fafc] font-black border-t-2 border-[#cbd5e1]">
                  <td colSpan={6} className="p-2 text-right uppercase tracking-wider text-[#1e3a8a] border-r border-slate-300">
                    TOTAL
                  </td>
                  <td className="p-1 text-center font-black text-slate-950 bg-blue-50/60 border-r border-slate-300">
                    {displayTotalQty}
                  </td>
                  <td className="p-1 text-center text-slate-400 border-r border-slate-300">-</td>
                  <td className="p-1 text-center text-slate-400 border-r border-slate-300">-</td>
                  <td className="p-1.5 text-right font-bold text-slate-900 font-mono border-r border-slate-300">
                    {formatCurrency(displayGst)}
                  </td>
                  <td className="p-2 text-right font-black text-[#1d4ed8] text-[11px] font-mono">
                    {formatCurrency(calculatedTotalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── 4. ITEM REFERENCE (IMAGES) — 2 LARGE CARDS PER ROW ─────────── */}
      <section className="mb-1.5">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wide">
            ITEM REFERENCE (IMAGES)
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">
            2 images per row • Large preview
          </span>
        </div>

        {references.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-slate-400 text-[10px] italic">
            No item reference imagery available for this purchase order.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref, idx) => (
              <div
                key={idx}
                className="page-break-avoid border border-[#cbd5e1] rounded-lg p-1.5 bg-white shadow-2xs flex flex-col justify-between"
              >
                {/* Card Title: Article No */}
                <div className="text-[12px] font-extrabold text-[#0f172a] mb-1">
                  {ref.articleNo}
                </div>

                {/* Card Content: Sub-details (Left) + Large Image (Right) */}
                <div className="grid grid-cols-[115px_1fr] gap-2 items-center">
                  {/* Left Column: Footwear Sub-Details */}
                  <div className="text-[9.5px] space-y-1">
                    <div className="flex items-start">
                      <span className="text-slate-500 w-18 shrink-0">Color</span>
                      <span className="text-slate-400 mr-1">:</span>
                      <span className="font-semibold text-slate-900 truncate">{displayAttr(ref.color)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-slate-500 w-18 shrink-0">Heels</span>
                      <span className="text-slate-400 mr-1">:</span>
                      <span className="font-medium text-slate-800 truncate">{displayAttr(ref.heels)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-slate-500 w-18 shrink-0">Upper Material</span>
                      <span className="text-slate-400 mr-1">:</span>
                      <span className="font-medium text-slate-800 truncate">{displayAttr(ref.upperMaterial)}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-slate-500 w-18 shrink-0">Outsole</span>
                      <span className="text-slate-400 mr-1">:</span>
                      <span className="font-medium text-slate-800 truncate">{displayAttr(ref.outsole)}</span>
                    </div>
                  </div>

                  {/* Right Column: Large Preview Image with Golden Ratio (1.618 : 1) */}
                  <div
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 flex items-center justify-center overflow-hidden relative"
                    style={{
                      aspectRatio: "1.618 / 1",
                      maxHeight: "92px",
                    }}
                  >
                    {ref.imageUrl ? (
                      <img
                        src={ref.imageUrl}
                        alt={ref.articleNo}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          // Replace failed image with Golden Ratio watermark placeholder
                          const imgElem = e.target as HTMLElement;
                          imgElem.style.display = "none";
                          const parent = imgElem.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 60%, #eff6ff 100%);">
                                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; overflow:hidden; pointer-events:none;">
                                  <span style="color:#1e3a8a; opacity:0.16; font-weight:900; text-transform:uppercase; font-size:10px; white-space:nowrap; transform:rotate(-12deg); letter-spacing:0.22em;">
                                    ${(data.companyName || "SMRITI Retail Private Limited").replace(/</g, "&lt;")}
                                  </span>
                                </div>
                                <div style="position:relative; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#64748b; padding:4px; text-align:center;">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.4" style="opacity:0.75;">
                                    <path d="M2 18h20c-.5-3-2-6-5-7l-5-2-4 1-4 3c-1 1-1.5 3-2 5z"/>
                                    <path d="M2 18v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2"/>
                                  </svg>
                                  <span style="font-size:7.5px; font-weight:bold; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:0.05em;">
                                    ${(ref.articleNo || "").replace(/</g, "&lt;")}
                                  </span>
                                  <span style="font-size:6.5px; font-family:monospace; color:#94a3b8;">
                                    Golden Ratio (1.618 : 1)
                                  </span>
                                </div>
                              </div>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <GoldenRatioImagePlaceholder
                        companyName={data.companyName}
                        articleNo={ref.articleNo}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. COMMERCIAL TERMS & ORDER SUMMARY (SIDE-BY-SIDE) ───────────── */}
      <section className="grid grid-cols-2 gap-2.5 mb-1.5 page-break-avoid">
        {/* Left Card: Commercial Terms */}
        <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-lg p-1.5 text-[9.5px]">
          <div className="font-extrabold text-[10.5px] text-[#1e3a8a] uppercase mb-1.5 pb-1 border-b border-blue-200/60">
            COMMERCIAL TERMS
          </div>
          <div className="space-y-1 text-slate-700">
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Payment Terms</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.paymentTerms || "30 Days"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Freight Terms</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.freightTerms || "As agreed"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Currency</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.currency || `INR (${currencySymbol})`}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Delivery Terms</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.deliveryTerms || "Ex-Factory"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Supplier Reference</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900 font-mono">{data.supplierReference || "—"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Special Instructions</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-medium text-slate-800 leading-tight">
                {data.specialInstructions || "Please ensure all items are packed with size stickers and barcode labels."}
              </span>
            </div>
          </div>
        </div>

        {/* Right Card: Order Summary */}
        <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-lg p-1.5 text-[9.5px] flex flex-col justify-between">
          <div>
            <div className="font-extrabold text-[10.5px] text-[#1e3a8a] uppercase mb-1.5 pb-1 border-b border-blue-200/60">
              ORDER SUMMARY
            </div>
            <div className="space-y-1 text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Items</span>
                <span className="font-semibold text-slate-900">{displayTotalItems}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Quantity</span>
                <span className="font-semibold text-slate-900">{displayTotalQty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Subtotal ({currencySymbol})</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">
                  GST {data.commonTaxPercent ? `(${data.commonTaxPercent}%)` : ""} ({currencySymbol})
                </span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(displayGst)}</span>
              </div>
            </div>
          </div>

          {/* Grand Total Row */}
          <div className="flex justify-between items-baseline pt-1.5 mt-2 border-t border-blue-200">
            <span className="font-black text-xs text-[#1e3a8a] uppercase">
              Grand Total ({currencySymbol})
            </span>
            <span className="font-black text-base text-[#1d4ed8] font-mono">
              {formatCurrency(displayGrandTotal)}
            </span>
          </div>
        </div>
      </section>

      {/* ── 6. REMARKS LINE ─────────────────────────────────────────────── */}
      <section className="mb-1.5 text-[9.5px] page-break-avoid">
        <div className="flex items-baseline">
          <span className="font-bold text-slate-900 mr-2 shrink-0">Remarks:</span>
          <div className="grow border-b border-slate-300 pb-0.5 text-slate-700 min-h-[16px]">
            {data.remarks || ""}
          </div>
        </div>
      </section>

      {/* ── 7. APPROVAL & SIGNATURES (3 BLOCKS) ─────────────────────────── */}
      <section className="grid grid-cols-3 gap-3 mb-1.5 pt-0.5 text-[9px] page-break-avoid">
        {/* Block 1: Prepared By */}
        <div className="space-y-1">
          <div className="font-extrabold text-[#1e3a8a] uppercase text-[9.5px] mb-1.5">
            Prepared By
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-12">Name</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.preparedByName || ""}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-12">Date</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.preparedByDate || ""}
            </span>
          </div>
        </div>

        {/* Block 2: Checked By */}
        <div className="space-y-1">
          <div className="font-extrabold text-[#1e3a8a] uppercase text-[9.5px] mb-1.5">
            Checked By
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-12">Name</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.checkedByName || ""}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-12">Date</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.checkedByDate || ""}
            </span>
          </div>
        </div>

        {/* Block 3: Authorized Signatory */}
        <div className="space-y-1">
          <div className="font-extrabold text-[#1e3a8a] uppercase text-[9.5px] mb-1.5">
            Authorized Signatory
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-18">Name</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.authorizedSignatoryName || ""}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-18">Designation</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.authorizedSignatoryDesignation || ""}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-slate-500 w-18">Date</span>
            <span className="text-slate-400 mr-1">:</span>
            <span className="grow border-b border-slate-300 min-h-[14px] text-slate-800">
              {data.authorizedSignatoryDate || ""}
            </span>
          </div>
        </div>
      </section>

      {/* ── 8. SYSTEM FOOTER & PAGINATION ───────────────────────────────── */}
      <footer className="border-t border-slate-200 pt-2 flex justify-between items-center text-[8.5px] text-slate-400 font-sans page-break-avoid">
        <div>
          Computer-generated Purchase Order | SMRITI Retail OS | www.smritibooks.com
        </div>
        <div>
          Page 1 of 1
        </div>
      </footer>
    </div>
  );
};

export default PurchaseOrderPrintA4;
