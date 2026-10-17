/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.86.0
 * Created      : 2026-09-22
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import smritiImagePlaceholder from "../../../myImages/smriti-image-placeholder.png";
import imageNotAvailablePlaceholder from "../../../myImages/image_not_available_placeholder.png";
import type { PurchaseOrderHeader, PurchaseOrderSizePivotRow } from "../../components/purchase/types.ts";
import { SafeRichTermsRenderer } from "../../components/common/SafeRichTermsRenderer";
import { getTenantCompanyContext } from "../../lib/apiFetchV1";

export interface SizePivotMatrixA4Props {
  header?: PurchaseOrderHeader;
  rows?: PurchaseOrderSizePivotRow[];
  currencySymbol?: string;
  vendorName?: string;
  orientation?: "portrait" | "landscape";
  data?: {
    header?: PurchaseOrderHeader;
    rows?: PurchaseOrderSizePivotRow[];
    currencySymbol?: string;
    vendorName?: string;
    orientation?: "portrait" | "landscape";
  };
}

const SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];

export const SizePivotMatrixA4: React.FC<SizePivotMatrixA4Props> = (props) => {
  const header = props.header || props.data?.header || {} as PurchaseOrderHeader;
  const rows = props.rows || props.data?.rows || [];
  const currencySymbol = props.currencySymbol || props.data?.currencySymbol || "₹";
  const vendorName = props.vendorName || props.data?.vendorName || header.supplierName || "Selected Supplier";
  const isLandscape = (props.orientation ?? props.data?.orientation) === "landscape";

  // Group validRows by unique Article No. + Color combination
  const validRows = React.useMemo(() => {
    const rawValid = (rows || []).filter((row) => (row.articleNo || "").trim() || (row.product || "").trim());
    if (rawValid.length === 0) return [];

    const groupedMap = new Map<string, PurchaseOrderSizePivotRow>();

    rawValid.forEach((row) => {
      const art = (row.articleNo || row.product || "").trim();
      const col = (row.color || "").trim();
      const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
      const qty = Number(row.totalQty) || 0;
      const rate = Number(row.rate) || 0;
      const value = row.totalValue !== undefined ? Number(row.totalValue) : (qty * rate);
      const rowSizeQtys = row.sizeQuantities || {};

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          ...row,
          articleNo: art || row.articleNo,
          color: col || row.color,
          sizeQuantities: { ...rowSizeQtys },
          totalQty: qty,
          rate: rate,
          totalValue: value,
        });
      } else {
        const existing = groupedMap.get(key)!;
        for (const [sz, sqty] of Object.entries(rowSizeQtys)) {
          const num = Number(sqty) || 0;
          if (num > 0) {
            existing.sizeQuantities = existing.sizeQuantities || {};
            existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + num;
          }
        }
        existing.totalQty = (existing.totalQty || 0) + qty;
        existing.totalValue = (existing.totalValue || 0) + value;
        if ((!existing.photoUrl && !existing.imageUrl) && (row.photoUrl || row.imageUrl)) {
          existing.photoUrl = row.photoUrl || row.imageUrl;
          existing.imageUrl = row.imageUrl || row.photoUrl;
        }
      }
    });

    return Array.from(groupedMap.values()).map((row, idx) => ({
      ...row,
      sNo: idx + 1,
    }));
  }, [rows]);

  const hasAnyPhotos = validRows.some((row) => Boolean(row.photoUrl || row.imageUrl));
  const totalQty = validRows.reduce((sum, row) => sum + (row.totalQty || 0), 0);
  const totalValue = validRows.reduce((sum, row) => sum + (row.totalValue || (row.totalQty || 0) * (row.rate || 0)), 0);

  const poNumberDisplay = `${header.prefix || "PO"}-${header.orderNumber || "1"}`;

  const tenantCtx = typeof window !== "undefined" ? getTenantCompanyContext() : null;
  const companyName = header.billTo || header.buyer || tenantCtx?.companyName || "";
  const logoUrl = tenantCtx?.companyLogoUrl || null;
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
          Size pivot purchase order printing is prohibited without authoritative buyer corporate identity. 
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
      className={`${
        isLandscape ? "w-[297mm] min-h-[210mm] p-6" : "w-[210mm] min-h-[297mm] p-8"
      } relative bg-white text-slate-900 mx-auto box-border text-[11px] font-sans print-only-container shadow-sm overflow-hidden`}
    >
      {/* ── Document Watermark (Diagonal Buyer Logo + Stamp) ── */}
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
              PURCHASE ORDER
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page {
            size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
            margin: 8mm;
          }
        }
      `}</style>
      <header className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between">
        <div>
          <div className="text-xl font-black text-slate-950">{companyName || "SMRITI RETAIL OS"}</div>
          <div className="text-xs text-slate-600">Size Pivot Matrix Procurement</div>
          <div className="text-[10px] mt-2">Supplier: <strong>{vendorName}</strong></div>
          <div className="text-[10px]">Delivery: {header.deliveryLocation || "Main Store (MAIN)"}</div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-3 py-1 font-bold text-xs">SIZE PIVOT MATRIX</div>
          <div className="font-mono font-bold mt-2">PO No: {poNumberDisplay}</div>
          <div className="text-[10px]">Date: {header.orderDate || new Date().toISOString().slice(0, 10)}</div>
          <div className="text-[10px]">Due: {header.deliveryDate || "-"}</div>
        </div>
      </header>

      <table className="w-full border-collapse border border-slate-400 text-[9px]">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-1 border border-slate-700">#</th>
            {hasAnyPhotos && <th className="p-1 border border-slate-700">PHOTO</th>}
            <th className="p-1 border border-slate-700">ARTICLE</th>
            <th className="p-1 border border-slate-700">PRODUCT</th>
            <th className="p-1 border border-slate-700">COLOR</th>
            {SIZES.map((size) => <th key={size} className="p-1 border border-slate-700">{size}</th>)}
            <th className="p-1 border border-slate-700">QTY</th>
            <th className="p-1 border border-slate-700">RATE</th>
            <th className="p-1 border border-slate-700">TAX</th>
            <th className="p-1 border border-slate-700">VALUE</th>
          </tr>
        </thead>
        <tbody>
          {validRows.length === 0 ? (
            <tr><td colSpan={hasAnyPhotos ? 18 : 17} className="p-5 text-center italic text-slate-500">No pivot items available</td></tr>
          ) : validRows.map((row, index) => {
            const rowQty = row.totalQty || 0;
            const rowRate = row.rate || 0;
            const rowValue = row.totalValue ?? (rowQty * rowRate);
            const photo = row.photoUrl || row.imageUrl;
            return (
              <tr key={row.id || index} className="border-b border-slate-200">
                <td className="p-1 border border-slate-300 text-center">{index + 1}</td>
                {hasAnyPhotos && (
                  <td className="p-1 border border-slate-300 text-center">
                    {photo ? (
                      <img
                        src={photo}
                        alt={row.articleNo || ""}
                        className="w-8 h-8 object-cover rounded mx-auto border border-slate-200"
                        onError={(e) => {
                          const imgElem = e.currentTarget;
                          imgElem.src = smritiImagePlaceholder || "/smriti-image-placeholder.png";
                          imgElem.className = "w-8 h-8 object-contain mx-auto";
                          imgElem.onerror = () => {
                            imgElem.src = "/assets/branding/smriti-image-placeholder.png";
                            imgElem.onerror = null;
                          };
                        }}
                      />
                    ) : (
                      <img
                        src={smritiImagePlaceholder || "/smriti-image-placeholder.png"}
                        alt="Image Not Available"
                        className="w-8 h-8 object-contain mx-auto"
                        onError={(e) => {
                          const imgElem = e.currentTarget;
                          if (imgElem.src !== window.location.origin + "/assets/branding/smriti-image-placeholder.png") {
                            imgElem.src = "/assets/branding/smriti-image-placeholder.png";
                          }
                        }}
                      />
                    )}
                  </td>
                )}
                <td className="p-1 border border-slate-300 font-mono font-bold">{row.articleNo || "-"}</td>
                <td className="p-1 border border-slate-300 font-semibold">{row.product || "-"}</td>
                <td className="p-1 border border-slate-300">{row.color || "-"}</td>
                {SIZES.map((size) => <td key={size} className="p-1 border border-slate-300 text-center font-mono">{row.sizeQuantities?.[size] || 0}</td>)}
                <td className="p-1 border border-slate-300 text-right font-bold">{rowQty}</td>
                <td className="p-1 border border-slate-300 text-right">{currencySymbol}{rowRate.toFixed(2)}</td>
                <td className="p-1 border border-slate-300 text-right">{(row.gstPercent || 0).toFixed(2)}%</td>
                <td className="p-1 border border-slate-300 text-right font-bold">{currencySymbol}{rowValue.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td colSpan={hasAnyPhotos ? 9 : 8} className="p-2 text-right">TOTAL</td>
            <td className="p-2 text-right">{totalQty}</td>
            <td colSpan={2}></td>
            <td className="p-2 text-right">{currencySymbol}{totalValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Business Terms & Statutory Conditions */}
      {Boolean(header.businessTerms && header.businessTerms.trim()) && (
        <div className="border border-slate-300 rounded p-2 mt-4 bg-slate-50 text-[8.5px]">
          <div className="font-bold text-slate-800 uppercase mb-1 flex items-center justify-between border-b border-slate-200 pb-0.5">
            <span>BUSINESS TERMS & STATUTORY CONDITIONS</span>
            <span className="text-[7.5px] text-slate-400 font-mono">120 DAYS STATUTORY COMMERCIAL CONTRACT</span>
          </div>
          <SafeRichTermsRenderer
            content={header.businessTerms}
            className="text-[8px] text-slate-700"
          />
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mt-5 text-[8.5px]">
        {[
          ["Prepared By", header.buyer || "Procurement User"],
          ["Verified By", "Name / Signature"],
          ["Approved By", "Name / Signature"],
          ["Supplier Acknowledgement", "Name / Signature / Stamp"],
        ].map(([label, value]) => (
          <div key={label} className="border border-slate-300 rounded p-2 min-h-[42px] flex flex-col justify-between">
            <span className="font-bold uppercase text-slate-700">{label}</span>
            <span className="border-t border-dashed border-slate-400 pt-1 text-slate-500">{value}</span>
          </div>
        ))}
      </div>

      <footer className="mt-5 border-t border-slate-300 pt-2 text-[9px] text-slate-600 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-800">SMRITI Retail OS | Size Pivot Matrix</span>
          <span>PO: {poNumberDisplay} | Status: DRAFT</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Payment: {header.paymentTerms || "120 Days"} | Purchaser: {header.buyer || "-"}</span>
          <span>Supplier Ref: {header.supplierReference || "-"} | Due: {header.deliveryDate || "-"}</span>
        </div>
        <div className="flex justify-between gap-4 text-slate-500">
          <span>This purchase order is not a tax invoice. Goods are subject to inspection and acceptance.</span>
        </div>
        <div className="text-center border-t border-slate-200 pt-1.5 mt-1 font-mono">
          <div className="font-bold text-indigo-900">SUBJECT TO NAGPUR JURISDICTION</div>
          <div className="text-slate-600 mt-0.5">SMRITISYS | SMRITI Retail OS | Enterprise Commerce Suite | smritibooks.com</div>
        </div>
      </footer>
    </div>
  );
};

export default SizePivotMatrixA4;
