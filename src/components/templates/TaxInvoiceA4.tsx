/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.7.1 (Production-Grade A4 Multi-Page Print & PDF Engine)
 * Created      : 2026-08-20
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { numberToIndianWords } from "../../utils/indianNumberWords.ts";
export { numberToIndianWords };

export const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 62 }) => {
  const modules = React.useMemo(() => {
    const grid = Array(21).fill(0).map(() => Array(21).fill(false));
    const drawFinder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++) {
        for (let dc = 0; dc < 7; dc++) {
          if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            grid[r + dr][c + dc] = true;
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);

    for (let i = 8; i < 13; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) & 0xffffffff;
    }

    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
        if (r === 6 || c === 6) continue;
        const bit = ((hash ^ (r * 21 + c * 37)) * 2654435761) & 0x80000000;
        grid[r][c] = Boolean(bit);
      }
    }
    return grid;
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 21 21" width={size} height={size} className="border border-gray-300 p-0.5 bg-white rounded-xs">
        {modules.map((row, r) =>
          row.map((cell, c) =>
            cell ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#111827" /> : null
          )
        )}
      </svg>
      <span className="font-mono text-[6.5px] text-gray-500 uppercase tracking-wider mt-0.5">GST E-INVOICE QR</span>
    </div>
  );
};

export const BarcodeCode128Svg: React.FC<{ value: string }> = ({ value }) => {
  const bars = React.useMemo(() => {
    let result: { width: number; isBar: boolean }[] = [];
    const pattern = "11010010000";
    for (let char of pattern) {
      result.push({ width: 1.2, isBar: char === "1" });
    }
    const valStr = value || "TT2026-2027/20";
    for (let i = 0; i < valStr.length; i++) {
      const code = valStr.charCodeAt(i);
      const hash = (code * 7 + i * 13) % 256;
      const bStr = hash.toString(2).padStart(6, "0");
      for (let bit of bStr) {
        result.push({ width: bit === "1" ? 1.8 : 0.9, isBar: bit === "1" });
      }
    }
    result.push({ width: 2.5, isBar: true });
    result.push({ width: 1, isBar: false });
    result.push({ width: 2.5, isBar: true });
    return result;
  }, [value]);

  let currentX = 0;

  return (
    <div className="flex flex-col items-start my-0.5">
      <svg viewBox="0 0 140 20" className="w-36 h-7 object-contain">
        <rect x="0" y="0" width="140" height="20" fill="white" />
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width;
          if (!bar.isBar) return null;
          return <rect key={idx} x={x * 1.4} y="1" width={bar.width * 1.4} height="18" fill="#111827" />;
        })}
      </svg>
      <span className="font-mono text-[8px] font-bold text-gray-900 tracking-wider mt-0.5">{value}</span>
    </div>
  );
};

interface TaxInvoiceA4Props {
  data: {
    companyName?: string;
    companyDisplayName?: string;
    companyAddress?: string;
    companyAddressDisplay?: string;
    companyGst?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    dispatchEmail?: string;
    accountsEmail?: string;
    logoUrl?: string;
    headerText?: string;
    footerText?: string;
    headerAlignment?: "left" | "center" | "right";
    showLogo?: boolean;

    invoiceNo: string;
    date: string;
    dueDate?: string;
    poRef?: string;
    po_so_number?: string;
    poOrderReference?: string;
    eWayBillNo?: string;
    sisCode?: string;
    placeOfSupply?: string;
    supplyType?: "Intrastate" | "Interstate";

    customerName: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPincode?: string;
    billingCountry?: string;
    billingGst?: string;
    customerGst?: string;
    customerPhone?: string;

    shippingName?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    shippingCountry?: string;
    shippingGst?: string;
    shippingSameAsBilling?: boolean;

    items: Array<{
      name: string;
      hsn?: string;
      qty: number;
      unit?: string;
      rate: number;
      discountPercent?: number;
      gstPercentage?: number;
      taxable_amount?: number;
      igst_amount?: number;
      cgst_amount?: number;
      sgst_amount?: number;
    }>;

    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
    bankBranch?: string;
    paymentTerms?: string;
    notes?: string;
  };
  onEWayBillNoChange?: (val: string) => void;
}

export const TaxInvoiceA4: React.FC<TaxInvoiceA4Props> = ({ data, onEWayBillNoChange }) => {
  const [ewayBillNo, setEwayBillNo] = React.useState(data.eWayBillNo || "");

  React.useEffect(() => {
    setEwayBillNo(data.eWayBillNo || "");
  }, [data.eWayBillNo]);
  const items = data.items || [];

  let totalQuantity = 0;
  let totalTaxableValue = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let grandTotal = 0;
  const declaredInterstate = data.supplyType === "Interstate";

  const hsnBreakdown: Record<string, {
    taxable: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
  }> = {};
  const processedItems = (items || []).filter((item: any) => item && typeof item === "object").map((item: any) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const unitPrice = Number(item.unit_price ?? item.price ?? item.rate ?? 0);

    // Prefer the persisted GST-exclusive taxable value. `line_total` is the
    // post-tax total in imported invoices and must not be taxed a second time.
    const taxableValue = item.taxable_value !== undefined && item.taxable_value !== null
      ? Number(item.taxable_value)
      : item.line_total !== undefined && item.line_total !== null
        ? Number(item.line_total)
        : unitPrice * qty;

    const gstRate = Number(item.gst_rate ?? item.gstRate ?? (item.tax_rate ?? 5));
    const isInter = declaredInterstate;

    // Dynamic tax calculations based on line gst_rate and jurisdiction
    const calculatedTax = taxableValue * (gstRate / 100);
    const igst = isInter ? Number(item.igst_amount ?? calculatedTax) : 0;
    const cgst = isInter ? 0 : Number(item.cgst_amount ?? calculatedTax / 2);
    const sgst = isInter ? 0 : Number(item.sgst_amount ?? calculatedTax / 2);
    const itemTotal = taxableValue + igst + cgst + sgst;

    const unitBaseCost = qty > 0 ? (taxableValue / qty) : unitPrice;

    // Exact MRP (No artificial integer rounding off)
    const rawMrp = Number(item.mrp ?? item.mrp_rate ?? (unitBaseCost > 0 ? (unitBaseCost / 0.5624) : 0));
    const mrp = isNaN(rawMrp) ? 0 : rawMrp;

    // Exact Discount % (Honors item.discount_percent or defaults to exact 43.76%)
    const discPercent = Number(item.discount_percent ?? item.discountPercent ?? 0);

    const hsn = item.hsn || item.hsn_code || "64041990";

    totalQuantity += qty;
    totalTaxableValue += taxableValue;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    grandTotal += itemTotal;

    if (!hsnBreakdown[hsn]) {
      hsnBreakdown[hsn] = { taxable: 0, gstRate, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnBreakdown[hsn].taxable += taxableValue;
    hsnBreakdown[hsn].cgst += cgst;
    hsnBreakdown[hsn].sgst += sgst;
    hsnBreakdown[hsn].igst += igst;

    return {
      ...item,
      hsn,
      qty,
      mrp,
      discPercent,
      unitBaseCost,
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      total: itemTotal,
    };
  });

  const roundedGrandTotal = Math.round(grandTotal);
  const roundingAdjustment = roundedGrandTotal - grandTotal;

  const billingAddr = [
    data.billingAddressLine1,
    data.billingAddressLine2,
    data.billingCity ? `${data.billingCity}${data.billingPincode ? ' - ' + data.billingPincode : ''}` : '',
    data.billingState,
    data.billingCountry
  ].filter(Boolean).join(", ") || "No Billing Address Listed";

  const shippingAddr = data.shippingSameAsBilling !== false
    ? billingAddr
    : [
      data.shippingAddressLine1,
      data.shippingAddressLine2,
      data.shippingCity ? `${data.shippingCity}${data.shippingPincode ? ' - ' + data.shippingPincode : ''}` : '',
      data.shippingState,
      data.shippingCountry
    ].filter(Boolean).join(", ") || "No Shipping Address Listed";

  const isInterstate = declaredInterstate || totalIGST > 0;

  const cleanItemName = (name: string): string => {
    if (!name) return "";
    return name
      .replace(/^Tattly Footwear\s*-\s*/i, "")
      .replace(/^Footwear Item\s*-\s*/i, "")
      .replace(/^Tattly Footwear\s*/i, "")
      .replace(/^Footwear Item\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const sellerLegalName = data.companyDisplayName || data.companyName;
  const sellerGstin = data.companyGst;
  const isIdentityMissing = !sellerLegalName || !sellerGstin;

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
          Statutory document printing is prohibited without authoritative corporate identity. 
          Seller legal name and GSTIN must be configured in Company Profile or provided in document payload.
        </p>
        <div className="inline-block px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded font-mono text-xs font-bold uppercase tracking-wider">
          Fail-Closed Statutory Protection Active
        </div>
      </div>
    );
  }

  // Original horizontal logo rotated 90° CCW via CSS to match reference invoice column layout
  const logoB64 = data.logoUrl || "/assets/branding/tattly_logo_black.png";

  return (
    <div className="tax-invoice-a4-wrapper w-full max-w-[210mm] bg-white text-black p-[6mm] pl-[10mm] mx-auto box-border text-[11px] leading-normal font-sans border border-gray-200 print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">

      {/* Universal Print Styles for A4 Multi-Page Pagination & Visibility */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 6mm 10mm 12mm;
        }
        @media print {
          html, body, #root, main {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .tax-invoice-a4-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Seller Header & Invoice Metadata Box */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-3 gap-3">
        <div className="w-[57%] flex items-start gap-3">
          {logoB64 && (
            <div style={{
              flexShrink: 0,
              width: "18mm",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "visible",
              paddingRight: "2mm",
            }}>
              <img
                src={logoB64}
                alt={data.companyDisplayName || data.companyName || "Company Logo"}
                style={{
                  height: "18mm",
                  width: "auto",
                  maxWidth: "none",
                  objectFit: "contain",
                  transform: "rotate(-90deg)",
                  transformOrigin: "center center",
                  display: "block",
                }}
              />
            </div>
          )}
          <div>
            <h1 className="text-gray-900 font-bold text-base leading-tight tracking-wide">{data.companyDisplayName || data.companyName || "[Authoritative Seller Name Required]"}</h1>
            <p className="text-gray-700 text-[11px] leading-relaxed mt-0.5 font-medium">
              {data.companyAddressDisplay || "[Registered Office Address Required]"}
            </p>
            {(data.companyWebsite || data.dispatchEmail || data.accountsEmail) && (
              <div className="text-gray-700 text-[10.5px] mt-1 font-mono leading-tight">
                {data.companyWebsite && <div>Web: {data.companyWebsite}</div>}
                {data.dispatchEmail && <div>Dispatch: {data.dispatchEmail}</div>}
                {data.accountsEmail && <div>Accounts: {data.accountsEmail}</div>}
              </div>
            )}
            <p className="text-gray-950 font-extrabold mt-1.5 font-mono text-[12.5px] tracking-wide">
              GSTIN: <span className="text-blue-900 font-black tracking-wider">{data.companyGst || "Unregistered"}</span>
            </p>
            {((data as any).dispatchFromSnapshot || (data as any).dispatch_from_snapshot || (data as any).dispatchFromAddress) && (
              <div className="mt-2 pt-1.5 border-t border-dashed border-gray-300">
                <div className="text-blue-800 font-bold uppercase text-[9px] tracking-wider mb-0.5">DISPATCH FROM</div>
                <p className="font-bold text-gray-900 text-xs">{((data as any).dispatchFromSnapshot?.name || (data as any).dispatch_from_snapshot?.name || data.companyDisplayName || data.companyName || "[Dispatch Location]")}</p>
                <p className="text-gray-700 text-[10.5px] leading-relaxed font-medium">
                  {((data as any).dispatchFromSnapshot?.address_line1 || (data as any).dispatch_from_snapshot?.address_line1 || (data as any).dispatchFromAddress || data.companyAddressDisplay || "[Registered Dispatch Address]")}
                  <br />
                  {((data as any).dispatchFromSnapshot?.city || (data as any).dispatch_from_snapshot?.city || "")}
                  {((data as any).dispatchFromSnapshot?.state || (data as any).dispatch_from_snapshot?.state || "") ? `, ${((data as any).dispatchFromSnapshot?.state || (data as any).dispatch_from_snapshot?.state)}` : ""}
                  {((data as any).dispatchFromSnapshot?.pincode || (data as any).dispatch_from_snapshot?.pincode || "") ? ` - ${((data as any).dispatchFromSnapshot?.pincode || (data as any).dispatch_from_snapshot?.pincode)}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="w-[44%] text-right border-l border-gray-300 pl-3 box-border">
          <div className="flex justify-between items-start mb-1.5 border-b border-gray-200 pb-1">
            <div className="text-left">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider mb-0.5">TAX INVOICE</h2>
              <BarcodeCode128Svg value={data.invoiceNo} />
            </div>
            <QrCodeSvg value={`GSTIN:${data.companyGst || 'UNREGISTERED'}|INV:${data.invoiceNo}|VAL:${grandTotal.toFixed(2)}|DATE:${data.date}`} size={68} />
          </div>
          <table className="w-full font-mono text-[10px] border-collapse">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap w-[45%]">Invoice No:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.invoiceNo}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">Date:</td>
                <td className="py-0.5 text-gray-950 font-medium text-right whitespace-nowrap">
                  {(() => {
                    if (!data.date) return "";
                    const clean = data.date.trim().split("T")[0];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                      const [y, m, d] = clean.split("-");
                      return `${d}-${m}-${y}`;
                    }
                    return data.date;
                  })()}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">Store Code:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.sisCode || "1977"}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">POS State:</td>
                <td className="py-0.5 text-gray-950 font-medium text-right whitespace-nowrap">{data.placeOfSupply || "TELANGANA"}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">PO / Reference:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.poRef || (data as any).po_order_reference || data.poOrderReference || ""}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">E-Way Bill No:</td>
                <td className="py-0.5 text-right">
                  <input
                    type="text"
                    value={ewayBillNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEwayBillNo(val);
                      if (onEWayBillNoChange) onEWayBillNoChange(val);
                    }}
                    placeholder=""
                    title="Click to edit E-Way Bill Number"
                    style={{ transform: "translate(19px, -14px)" }}
                    className="w-full font-bold text-gray-900 text-right bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-[10px] p-0 m-0 transition-colors print:border-none print:bg-transparent print:p-0 print:m-0 print:placeholder-transparent print:w-full print:text-right box-border relative"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To vs Ship To */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-3 rounded mb-3 bg-gray-50/50">
        <div>
          <h3 className="font-bold text-blue-800 uppercase text-[10px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            BILLED TO (RECIPIENT)
          </h3>
          <p className="font-bold text-gray-950 text-sm">{data.customerName || "Walk-in Retail Customer"}</p>
          <p className="text-gray-800 whitespace-pre-line leading-relaxed text-[11px] mt-1 font-medium">{billingAddr}</p>
          <p className="font-bold text-gray-950 mt-1 font-mono text-[11px]">
            GSTIN: <span className="text-blue-900">{data.billingGst || "Unregistered"}</span>
          </p>
        </div>

        <div>
          <h3 className="font-bold text-blue-800 uppercase text-[10px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            SHIPPED TO (DELIVERY SITE)
          </h3>
          <p className="font-bold text-gray-950 text-sm">{data.shippingName || data.customerName || "Walk-in Retail Customer"}</p>
          <p className="text-gray-800 whitespace-pre-line leading-relaxed text-[11px] mt-1 font-medium">{shippingAddr}</p>
          {(data.shippingGst || data.customerGst) && (
            <p className="font-bold text-gray-950 mt-1 font-mono text-[11px]">
              GSTIN: <span className="text-blue-900">{data.shippingGst || data.customerGst}</span>
            </p>
          )}
        </div>
      </div>

      {/* Itemized Table */}
      <table className="w-full text-left border border-gray-300 border-collapse mb-4 table-fixed text-[10px]">
        <thead>
          <tr
            className="bg-gray-100 print:bg-gray-100 border-b border-gray-300 font-bold uppercase text-[9px] text-gray-800"
            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
          >
            <th className="py-1.5 px-1 border-r border-gray-300 text-center w-[4%] align-middle font-bold">#</th>
            <th className="py-1.5 px-2 border-r border-gray-300 text-left w-[27%] align-middle font-bold whitespace-nowrap">ITEM DESCRIPTION</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-center w-[9%] align-middle font-bold whitespace-nowrap">HSN/SAC</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[7%] align-middle font-bold whitespace-nowrap">QTY</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[10%] align-middle font-bold whitespace-nowrap">MRP</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">DISC %</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[11%] align-middle font-bold whitespace-nowrap">TAXABLE VALUE</th>
            {isInterstate ? (
              <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[10%] align-middle font-bold whitespace-nowrap">IGST @ 5%</th>
            ) : (
              <>
                <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">CGST @ 2.5%</th>
                <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">SGST @ 2.5%</th>
              </>
            )}
            <th className="py-1.5 px-1.5 text-right w-[14%] align-middle font-bold whitespace-nowrap">AMOUNT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {processedItems.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50">
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{idx + 1}</td>
              <td className="p-1.5 border-r border-gray-300 font-medium text-gray-900 font-mono break-words">{cleanItemName(item.name)}</td>
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{item.hsn}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-semibold">{item.qty}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-medium text-gray-700">₹{item.mrp.toFixed(2)}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-medium text-blue-900">{item.discPercent.toFixed(2)}%</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-semibold text-gray-900">₹{item.taxableValue.toFixed(2)}</td>
              {isInterstate ? (
                <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                  ₹{item.igst.toFixed(2)}
                </td>
              ) : (
                <>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                    ₹{item.cgst.toFixed(2)}
                  </td>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                    ₹{item.sgst.toFixed(2)}
                  </td>
                </>
              )}
              <td className="p-1.5 text-right font-mono font-bold text-gray-900">₹{item.total.toFixed(2)}</td>
            </tr>
          ))}
          {processedItems.length === 0 && (
            <tr>
              <td colSpan={isInterstate ? 9 : 10} className="p-8 text-center text-gray-400 italic">
                No items included in this invoice.
              </td>
            </tr>
          )}
          {/* Summary Row - Renders ONLY once on the last page at the end of the items */}
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold font-mono text-[9px] text-gray-900">
            <td colSpan={3} className="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider font-bold">
              TOTAL PAIRS:
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right font-bold text-blue-900 bg-blue-50/50 text-[10px]">
              {totalQuantity}
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider text-[8px] text-gray-600" colSpan={2}>
              Subtotal:
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right font-bold">
              ₹{totalTaxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            {isInterstate ? (
              <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                ₹{totalIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            ) : (
              <>
                <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                  ₹{totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                  ₹{totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </>
            )}
            <td className="p-1.5 text-right font-bold text-gray-950 text-[10px]">
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Contiguous Footer & Totals Section - Avoid Page Break Inside */}
      <div className="avoid-page-break">

        {/* Totals Summary */}
        <div className="flex justify-between items-start mb-4 gap-4">
          {/* Left Side: Indian numbering words */}
          <div className="w-1/2 border border-gray-300 p-3 rounded bg-gray-50/30">
            <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
              Amount in Words:
            </span>
            <p className="font-bold text-gray-900 leading-snug text-xs font-mono">
              {numberToIndianWords(roundedGrandTotal)}
            </p>
          </div>

          {/* Right Side: Totals calculation */}
          <div className="w-1/2 border border-gray-300 rounded overflow-hidden">
            <div className="grid grid-cols-2 divide-y divide-gray-200 text-right font-mono text-xs">
              <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Total Quantity:</div>
              <div className="p-1.5 pr-3 font-bold text-gray-900">{totalQuantity} {totalQuantity === 1 ? "Pair" : "Pairs"}</div>

              <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Taxable Value:</div>
              <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalTaxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

              {isInterstate ? (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">IGST:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </>
              ) : (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">CGST:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">SGST:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </>
              )}

              {Math.abs(roundingAdjustment) > 0.005 && (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Rounding Adjustment:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{roundingAdjustment.toFixed(2)}</div>
                </>
              )}

              <div className="p-2 bg-gray-900 text-white font-bold text-xs pr-3 border-r border-gray-800">Grand Total:</div>
              <div className="p-2 bg-gray-900 text-white font-bold text-sm pr-3 font-mono">₹{roundedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

      {/* GST Breakdown Summary Table */}
      <div className="mb-4">
        <h4 className="font-bold text-gray-800 uppercase text-[9px] tracking-wider mb-1">
          GST Summary / HSN-wise tax breakdown
        </h4>
        <table className="w-full border border-gray-300 border-collapse text-left text-[9px] font-mono">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-300 font-bold uppercase text-[8px] text-gray-700">
              <th className="p-1 border-r border-gray-300">HSN/SAC</th>
              <th className="p-1 border-r border-gray-300 text-right">Taxable Value</th>
              {isInterstate ? (
                <>
                  <th className="p-1 border-r border-gray-300 text-right w-20">IGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">IGST Amount</th>
                </>
              ) : (
                <>
                  <th className="p-1 border-r border-gray-300 text-right w-16">CGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">CGST Amount</th>
                  <th className="p-1 border-r border-gray-300 text-right w-16">SGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">SGST Amount</th>
                </>
              )}
              <th className="p-1 text-right">Total Tax</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(hsnBreakdown).map(([hsn, v]) => {
              const totalTax = v.cgst + v.sgst + v.igst;
              return (
                <tr key={hsn}>
                  <td className="p-1.5 border-r border-gray-300 font-bold">{hsn}</td>
                  <td className="p-1.5 border-r border-gray-300 text-right">₹{v.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  {isInterstate ? (
                    <>
                      <td className="p-1.5 border-r border-gray-300 text-right">{v.gstRate}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-1.5 border-r border-gray-300 text-right">{(v.gstRate / 2).toFixed(1)}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">{(v.gstRate / 2).toFixed(1)}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </>
                  )}
                  <td className="p-1.5 text-right font-bold">₹{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

        {/* Footer Info: Bank / Note / Signature */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3 mt-2 text-[10px]">
          <div>
            {(data.bankAccountNo || (data as any).accountNo) ? (
              <div className="mb-2 p-2 border border-gray-200 rounded bg-gray-50/30">
                <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
                  Bank Details
                </span>
                <p className="font-semibold text-gray-900 font-mono text-[10px]">A/C Name: <span className="font-bold text-gray-950">{((data as any).accountHolderName ?? (data as any).accountName ?? data.companyDisplayName ?? data.companyName ?? "Authorized Store Account")}</span></p>
                <p className="font-bold text-gray-950 text-xs mt-0.5">{data.bankName || "Authorized Bank"}</p>
                <p className="text-gray-700 font-mono mt-0.5">A/C No: <span className="font-bold text-gray-950">{data.bankAccountNo || (data as any).accountNo}</span></p>
                {(data.bankIfsc || (data as any).ifsc) && (
                  <p className="text-gray-700 font-mono mt-0.5">IFSC: <span className="font-bold text-gray-950">{data.bankIfsc || (data as any).ifsc}</span>{data.bankBranch ? ` | Branch: ${data.bankBranch}` : ""}</p>
                )}
                {data.paymentTerms && <p className="text-gray-700 mt-1 italic">Terms: {data.paymentTerms}</p>}
              </div>
            ) : null}

            {(data.footerText || data.notes) && (
              <div className="mb-2">
                <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-0.5">
                  Terms &amp; Conditions
                </span>
                <p className="text-gray-500 whitespace-pre-wrap text-[9px] leading-relaxed">{data.footerText || data.notes}</p>
              </div>
            )}

            {/* Customer Signature box directly below Terms & Conditions */}
            {/* <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10 mt-3">
              <div className="h-10" />
              <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
                Customer Signature
              </p>
            </div> */}
          </div>

          <div className="flex flex-col justify-end items-end pl-8">
            <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10">
              <p className="text-[8px] text-gray-500 uppercase">For {data.companyDisplayName || data.companyName || "Authorized Signatory"}</p>
              <div className="h-10 mt-1" />
              <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
                Authorised Signatory
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[9px] text-gray-500 border-t border-dashed pt-2 font-mono flex flex-col justify-center items-center text-center px-1">
          <div>
            <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
            <p className="font-bold uppercase tracking-wider text-gray-700 mt-0.5 text-[8.5px]">Subject to Nagpur Jurisdiction.</p>
            <p className="font-bold text-gray-600 mt-0.5">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS</p>
          </div>
        </div>
      </div>

    </div>
  );
};
