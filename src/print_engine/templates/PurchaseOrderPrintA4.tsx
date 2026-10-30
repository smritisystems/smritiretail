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
 * * Version    : 6.86.0
 * * Created    : 2026-10-15
 * * Modified   : 2026-10-16
 * * Copyright  : © SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 */

import React from "react";
import smritiImagePlaceholder from "../../../myImages/smriti-image-placeholder.png";
import imageNotAvailablePlaceholder from "../../../myImages/image_not_available_placeholder.png";
import { SafeRichTermsRenderer } from "../../components/common/SafeRichTermsRenderer";
import { getTenantCompanyContext } from "../../lib/apiFetchV1";

export interface FootwearArticleReference {
  articleNo: string;
  color: string;
  heels?: string;
  upperMaterial?: string;
  outsole?: string;
  collectionType?: string;
  imageUrl?: string;
}

export interface ItemReferenceFieldVisibility {
  color: boolean;
  collectionType?: boolean;
  heels: boolean;
  upperMaterial: boolean;
  outsole: boolean;
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
  companyWebsite?: string;
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

  // Item Reference Cards (2 large preview images per row or 4 compact per row)
  itemReferences?: FootwearArticleReference[];
  itemReferenceFields?: ItemReferenceFieldVisibility;
  imageColumns?: 2 | 4;

  // Commercial Terms
  paymentTerms?: string;
  freightTerms?: string;
  currency?: string;
  deliveryTerms?: string;
  collectionType?: string;
  supplierReference?: string;
  specialInstructions?: string;
  businessTerms?: string;

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
 * GoldenRatioImagePlaceholder — Renders the SMRITI branded "Image Not Available" placeholder
 * with rectangular 5:3 proportions, centered, with no border or decorations around the artwork.
 * Mandated for missing or unavailable footwear product imagery in SMRITI purchase order print formats.
 */
export const GoldenRatioImagePlaceholder: React.FC<{
  companyName?: string;
  articleNo?: string;
  className?: string;
}> = ({ articleNo, className = "" }) => {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{
        aspectRatio: "5 / 3",
      }}
      title={`Image placeholder for ${articleNo || "article"}`}
    >
      <img
        src={smritiImagePlaceholder || "/smriti-image-placeholder.png"}
        alt="Image Not Available"
        className="max-h-full max-w-full w-auto h-auto object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== window.location.origin + "/smriti-image-placeholder.png") {
            img.src = "/smriti-image-placeholder.png";
          } else if (img.src !== window.location.origin + "/assets/branding/smriti-image-placeholder.png") {
            img.src = "/assets/branding/smriti-image-placeholder.png";
          }
        }}
      />
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

  // Sizewise calculations — Group by unique Article No. + Color combination
  const sizewiseRows = React.useMemo(() => {
    const rawRows = data.sizewiseItems || [];
    if (rawRows.length === 0) return [];

    const groupedMap = new Map<string, {
      sNo: number;
      articleNo: string;
      color: string;
      sizeQuantities: Record<string, number>;
      totalQty: number;
      rate: number;
      taxPercent?: number;
      taxAmount?: number;
      amount: number;
    }>();

    rawRows.forEach((item) => {
      const art = (item.articleNo || "").trim();
      const col = (item.color || "").trim();
      const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
      const qty = Number(item.totalQty) || 0;
      const rate = Number(item.rate) || 0;
      const amount = Number(item.amount) || 0;
      const taxRate = item.taxPercent !== undefined ? Number(item.taxPercent) : (data.commonTaxPercent ?? 5);
      const taxAmt = item.taxAmount !== undefined ? Number(item.taxAmount) : (amount * taxRate) / 100;
      const rowSizeQtys = item.sizeQuantities || {};

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          sNo: item.sNo || 0,
          articleNo: art || item.articleNo,
          color: col || item.color,
          sizeQuantities: { ...rowSizeQtys },
          totalQty: qty,
          rate: rate,
          taxPercent: taxRate,
          taxAmount: taxAmt,
          amount: amount,
        });
      } else {
        const existing = groupedMap.get(key)!;
        for (const [sz, sqty] of Object.entries(rowSizeQtys)) {
          const num = Number(sqty) || 0;
          if (num > 0) {
            existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + num;
          }
        }
        existing.totalQty += qty;
        existing.amount += amount;
        existing.taxAmount = (existing.taxAmount || 0) + taxAmt;
        if (existing.rate === 0 && rate > 0) {
          existing.rate = rate;
        }
      }
    });

    return Array.from(groupedMap.values()).map((row, idx) => ({
      ...row,
      sNo: idx + 1,
    }));
  }, [data.sizewiseItems, data.commonTaxPercent]);
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
            : (Number(item.amount) * (Number(item.taxPercent) || data.commonTaxPercent || 5)) / 100),
        0
      )
    : sizewiseRows.reduce(
        (sum, item) =>
          sum +
          (item.taxAmount !== undefined
            ? Number(item.taxAmount)
            : (Number(item.amount) * (Number(item.taxPercent) || data.commonTaxPercent || 5)) / 100),
        0
      );

  const displayTotalItems = data.totalItems ?? (isStandard ? (data.standardItems || []).length : sizewiseRows.length);
  const displayTotalQty = data.totalQuantity ?? calculatedTotalQty;
  const displaySubtotal = data.subtotal ?? (data.grandTotal ? data.grandTotal - (data.gstAmount || 0) : calculatedTotalAmount);
  const displayGst = data.gstAmount !== undefined ? data.gstAmount : calculatedTotalTaxAmount;
  const displayGrandTotal = data.grandTotal ?? (displaySubtotal + displayGst);
  const imageCols = data.imageColumns ?? 2;

  // Item References deduplication / formatting with automatic line items fallback
  const references = React.useMemo(() => {
    if (data.itemReferences && data.itemReferences.length > 0) {
      return data.itemReferences;
    }
    // Fallback: derive unique item references from sizewiseItems or standardItems
    const derivedMap = new Map<string, FootwearArticleReference>();
    if (data.sizewiseItems && data.sizewiseItems.length > 0) {
      data.sizewiseItems.forEach((it) => {
        const art = (it.articleNo || "").trim();
        if (art && !derivedMap.has(art)) {
          derivedMap.set(art, {
            articleNo: art,
            color: it.color || "—",
            heels: (it as any).heels || (it as any).heelType || (it as any).heel_type || "—",
            upperMaterial: (it as any).upperMaterial || (it as any).upper_material || "—",
            outsole: (it as any).outsole || (it as any).outsoleMaterial || (it as any).outsole_material || "—",
            collectionType: (it as any).collectionType || (it as any).collection_type || data.collectionType || "—",
            imageUrl: (it as any).imageUrl || (it as any).photoUrl,
          });
        }
      });
    }
    if (derivedMap.size === 0 && data.standardItems && data.standardItems.length > 0) {
      data.standardItems.forEach((it) => {
        const art = (it.articleNo || it.productName || "").trim();
        if (art && !derivedMap.has(art)) {
          derivedMap.set(art, {
            articleNo: art,
            color: it.color || "—",
            heels: (it as any).heels || (it as any).heelType || (it as any).heel_type || "—",
            upperMaterial: (it as any).upperMaterial || (it as any).upper_material || "—",
            outsole: (it as any).outsole || (it as any).outsoleMaterial || (it as any).outsole_material || "—",
            collectionType: (it as any).collectionType || (it as any).collection_type || data.collectionType || "—",
            imageUrl: (it as any).imageUrl || (it as any).photoUrl,
          });
        }
      });
    }
    return Array.from(derivedMap.values());
  }, [data.itemReferences, data.sizewiseItems, data.standardItems]);
  const itemReferenceFields = data.itemReferenceFields ?? {
    color: true,
    collectionType: true,
    heels: true,
    upperMaterial: true,
    outsole: true,
  };

  const tenantCtx = typeof window !== "undefined" ? getTenantCompanyContext() : null;
  const companyName = data.companyName || tenantCtx?.companyName || "";
  const companyAddress = data.companyAddress || tenantCtx?.companyAddress || "";
  const companyGstin = data.companyGstin || tenantCtx?.companyGstin || "";
  const companyPan = data.companyPan || (companyGstin && companyGstin.length >= 12 ? companyGstin.slice(2, 12) : "");
  const companyWebsite = data.companyWebsite || "";
  const companyEmail = data.companyEmail || tenantCtx?.companyEmail || "";
  const logoUrl = data.logoUrl || tenantCtx?.companyLogoUrl || null;

  const isIdentityMissing = !companyName;

  if (isIdentityMissing) {
    return (
      <div 
        data-testid="print-blocked-container"
        className="w-[210mm] min-h-[148mm] bg-white text-slate-900 p-8 mx-auto box-border font-sans border-2 border-red-500 rounded-lg flex flex-col items-center justify-center text-center shadow-lg my-6 print:border-red-600 print:shadow-none"
      >
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-3xl font-black">
          ✕
        </div>
        <h2 className="text-xl font-black text-red-700 uppercase tracking-wider mb-2">
          CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED
        </h2>
        <p className="text-sm text-slate-700 max-w-md mb-4 leading-relaxed">
          Purchase order printing is prohibited without authoritative buyer corporate identity. 
          Company name must be configured in Company Profile or provided in document payload.
        </p>
        <div className="inline-block px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded font-mono text-xs font-bold uppercase tracking-wider">
          Fail-Closed Statutory Protection Active
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-white text-slate-900 mx-auto box-border font-sans antialiased shadow-sm print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none print:min-h-0 print:h-auto ${
        isLandscape ? "w-[297mm] min-h-[210mm] p-6" : "w-[210mm] min-h-[297mm] p-6 sm:p-7"
      }`}
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* ── Document Background Watermark ── */}
      {companyName && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.07] z-20 overflow-hidden select-none print:opacity-[0.08] mix-blend-multiply">
          <div className="text-center font-black tracking-widest text-[#1e3a8a] rotate-[-28deg] border-4 border-dashed border-[#1e3a8a] px-10 py-6 rounded-3xl uppercase flex flex-col items-center justify-center shadow-xs">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={companyName}
                className="w-36 h-auto max-h-20 object-contain mb-2 print:max-h-20"
              />
            )}
            <div className="text-[52px] leading-tight font-black tracking-wider text-[#1e3a8a]">
              {companyName}
            </div>
            <div className="text-xl font-bold tracking-[0.22em] mt-1 text-slate-800 border-t-2 border-dashed border-[#1e3a8a]/40 pt-1 w-full">
              {data.status === "DRAFT" ? "PURCHASE ORDER — DRAFT" : "PURCHASE ORDER"}
            </div>
          </div>
        </div>
      )}

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
      <header className="relative z-10 flex justify-between items-start pb-2 mb-2 border-b border-slate-200">
        {/* Left: Dynamic Brand Logo + Company Details */}
        <div className="flex items-start">
          {logoUrl && (
            <div className="pr-3.5 mr-3.5 border-r border-slate-200 flex flex-col justify-center">
              <img
                src={logoUrl}
                alt={companyName || "Logo"}
                className="h-10 w-auto object-contain max-w-[135px]"
              />
            </div>
          )}
          <div className="text-[10px] text-slate-600 leading-snug">
            <h1 className="text-xs font-bold text-[#0f172a] leading-tight">
              {companyName || "COMPANY NAME NOT SET"}
            </h1>
            <p className="whitespace-pre-line text-slate-600 mt-0.5">
              {companyAddress}
            </p>
            <p className="text-slate-700 font-medium mt-0.5">
              GSTIN: <span className="font-mono">{companyGstin}</span>
              {companyPan && (
                <>
                  <span className="mx-1 text-slate-300">|</span>
                  PAN: <span className="font-mono">{companyPan}</span>
                </>
              )}
            </p>
            <p className="text-slate-500 text-[9px] mt-0.5 font-mono">
              Web: {companyWebsite} | Email: {companyEmail}
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
              <span className="font-semibold text-slate-800">{data.expectedDelivery || "—"}</span>

              <span className="text-slate-600">Warehouse</span>
              <span className="text-slate-400">:</span>
              <span className="font-semibold text-slate-800">{data.warehouse || "Main Store (MAIN)"}</span>

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
      <section className="relative z-10 bg-[#eff6ff] border border-[#dbeafe] rounded-lg p-1.5 mb-1.5 text-[9.5px] text-slate-700 leading-snug">
        <div className="text-[9.5px] font-extrabold text-[#2563eb] uppercase tracking-wider mb-1">
          SUPPLIER
        </div>
        <div className="font-bold text-[11.5px] text-slate-900 flex items-center gap-1.5">
          <span>{data.supplierName || "Selected Supplier"}</span>
          {data.supplierCode && (
            <span className="text-slate-500 font-mono text-[10px] font-semibold">
              ({data.supplierCode})
            </span>
          )}
        </div>
        {data.supplierAddress && data.supplierAddress.trim() ? (
          <div className="whitespace-pre-line text-slate-600 mt-0.5">
            {data.supplierAddress}
          </div>
        ) : null}
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
                    const rowTaxPct = item.taxPercent ?? data.commonTaxPercent ?? 5;
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
                    const rowTaxPct = line.taxPercent ?? data.commonTaxPercent ?? 5;
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

      {/* ── 4. ITEM REFERENCE (IMAGES) ─────────── */}
      <section className="mb-1.5">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wide">
            ITEM REFERENCE (IMAGES)
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">
            {imageCols === 4 ? "4 images per row • Compact preview" : "2 images per row • Large preview"}
          </span>
        </div>

        {references.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-slate-400 text-[10px] italic">
            No item reference imagery available for this purchase order.
          </div>
        ) : (
          <div className={`grid ${imageCols === 4 ? "grid-cols-4 gap-1.5" : "grid-cols-2 gap-2"}`}>
            {references.map((ref, idx) => {
              const referenceFields = [
                { key: "color" as const, label: "Color", value: ref.color },
                { key: "collectionType" as const, label: "Collection", value: ref.collectionType },
                { key: "heels" as const, label: "Heels", value: ref.heels },
                { key: "upperMaterial" as const, label: "Upper Material", value: ref.upperMaterial },
                { key: "outsole" as const, label: "Outsole", value: ref.outsole },
              ].filter((field) => (itemReferenceFields as any)[field.key]);

              return (
              <div
                key={idx}
                className="page-break-avoid border border-[#cbd5e1] rounded-lg p-1.5 bg-white shadow-2xs flex flex-col justify-between"
              >
                {/* Card Title: Article No */}
                <div className={`${imageCols === 4 ? "text-[10.5px]" : "text-[12px]"} font-extrabold text-[#0f172a] mb-0.5 break-words`}>
                  {ref.articleNo}
                </div>

                {/* Card Content: Wrapping attributes above the reference image */}
                <div className="flex flex-col gap-1">
                  {referenceFields.length > 0 && (
                    <div className={`grid ${imageCols === 4 ? "grid-cols-1 gap-y-0.5 text-[8px]" : "grid-cols-2 gap-x-3 gap-y-1 text-[9.5px]"}`}>
                      {referenceFields.map((field) => (
                        <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-1" key={field.key}>
                          <span className="text-slate-500 whitespace-nowrap">{field.label}:</span>
                          <span className="font-medium text-slate-800 min-w-0 whitespace-normal break-words leading-tight">
                            {displayAttr(field.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full-Width Framed Preview Image Canvas */}
                  <div
                    className="w-full flex items-center justify-center overflow-hidden relative bg-[#f8fafc] border border-slate-200/80 rounded-md p-1"
                    style={{
                      height: imageCols === 4 ? "82px" : "138px",
                      maxHeight: imageCols === 4 ? "82px" : "138px",
                    }}
                  >
                    {Boolean(ref.imageUrl && ref.imageUrl.trim() && ref.imageUrl.trim().toLowerCase() !== "null" && ref.imageUrl.trim().toLowerCase() !== "undefined") ? (
                      <img
                        src={ref.imageUrl}
                        alt={ref.articleNo}
                        className="max-h-full max-w-full w-auto h-auto object-contain"
                        onError={(e) => {
                          const imgElem = e.currentTarget;
                          imgElem.src = smritiImagePlaceholder || "/smriti-image-placeholder.png";
                          imgElem.alt = "Image Not Available";
                          imgElem.onerror = () => {
                            imgElem.src = "/assets/branding/smriti-image-placeholder.png";
                            imgElem.onerror = null;
                          };
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
              );
            })}
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
              <span className="font-semibold text-slate-900">{data.paymentTerms && data.paymentTerms !== "30 Days" ? data.paymentTerms : "120 Days"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Freight Terms</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.freightTerms || "Paid by Supplier"}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Currency</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">{data.currency || `INR (${currencySymbol})`}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Delivery Terms</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900">
                {data.deliveryTerms || ((data.freightTerms || "").toLowerCase().includes("buyer") || (data.freightTerms || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery")}
              </span>
            </div>
            {data.collectionType && (
              <div className="flex items-start">
                <span className="text-slate-500 w-28 shrink-0">Collection Type</span>
                <span className="text-slate-400 mr-1.5">:</span>
                <span className="font-semibold text-slate-900">{data.collectionType}</span>
              </div>
            )}
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Supplier Reference</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <span className="font-semibold text-slate-900 font-mono">{displayAttr(data.supplierReference)}</span>
            </div>
            <div className="flex items-start">
              <span className="text-slate-500 w-28 shrink-0">Special Instructions</span>
              <span className="text-slate-400 mr-1.5">:</span>
              <div className="font-medium text-slate-800 leading-tight">
                {data.specialInstructions ? (
                  <SafeRichTermsRenderer content={data.specialInstructions} className="text-[9px]" />
                ) : (
                  "Please ensure all items are packed with size stickers and barcode labels."
                )}
              </div>
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
                  GST ({(data.commonTaxPercent !== undefined ? data.commonTaxPercent : ((displaySubtotal > 0 && displayGst > 0) ? Math.round((displayGst / displaySubtotal) * 100) : 5))}%) ({currencySymbol})
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

      {/* ── 5.1 BUSINESS TERMS & STATUTORY CONDITIONS ─────────────────────── */}
      {Boolean(data.businessTerms && data.businessTerms.trim()) && (
        <section className="bg-slate-50 border border-slate-200/90 rounded-lg p-2 mb-1.5 text-[8.5px] page-break-avoid">
          <div className="font-extrabold text-[9px] text-[#1e3a8a] uppercase mb-1 flex items-center justify-between border-b border-slate-200 pb-0.5">
            <span>BUSINESS TERMS & STATUTORY CONDITIONS</span>
            <span className="text-[7.5px] text-slate-400 font-mono font-normal">SMRITI STATUTORY COMMERCIAL CONTRACT</span>
          </div>
          <SafeRichTermsRenderer
            content={data.businessTerms}
            className="text-[8px] text-slate-700"
          />
        </section>
      )}

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
