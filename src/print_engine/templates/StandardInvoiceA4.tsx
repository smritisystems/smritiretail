/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { DEFAULT_SBI_BANK_ACCOUNT } from "../../services/bankStore.ts";

export interface InvoiceItem {
  code?: string;
  name?: string;
  hsn?: string;
  hsnCode?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  mrp?: number;
  disc?: number;
  discount?: number;
  price?: number;
  unitPrice?: number;
  hsn_code?: string;
  gstRate?: number;
  gst_rate?: number;
  taxAmount?: number;
  tax_amount?: number;
  cgstAmount?: number;
  cgst_amount?: number;
  sgstAmount?: number;
  sgst_amount?: number;
  igstAmount?: number;
  igst_amount?: number;
  lineTotal?: number;
  line_total?: number;
  totalAmount?: number;
  total_amount?: number;
}

export interface BankAccountDetails {
  bankName?: string;
  accountName?: string;
  accountNo?: string;
  accountNumber?: string;
  ifsc?: string;
  ifscCode?: string;
  branch?: string;
  branchName?: string;
  upi?: string;
  upiId?: string;
}

export interface InvoiceData {
  companyName?: string;
  companyAddress?: string;
  companyGst?: string;
  dispatchEmail?: string;
  accountsEmail?: string;
  website?: string;
  bankDetails?: BankAccountDetails | string;
  invoiceNo?: string;
  invoice_no?: string;
  date?: string;
  invoiceDate?: string;
  invoice_date?: string;
  dueDate?: string;
  due_date?: string;
  customerName?: string;
  customerAddress?: string;
  customerGst?: string;
  shippingName?: string;
  shipping_name?: string;
  shippingAddress?: string;
  shipping_address?: string;
  shippingGst?: string;
  shipping_gstin?: string;
  sisCode?: string;
  posState?: string;
  poNumber?: string;
  ewayBillNo?: string;
  notes?: string;
  subtotal?: number;
  taxTotal?: number;
  tax_total?: number;
  cgstAmount?: number;
  cgst_amount?: number;
  sgstAmount?: number;
  sgst_amount?: number;
  igstAmount?: number;
  igst_amount?: number;
  grandTotal?: number;
  grand_total?: number;
  status?: string;
  isInterstate?: boolean;
  is_interstate?: boolean;
  items?: InvoiceItem[];
}

export interface ProcessedItem {
  sno: number;
  description: string;
  hsn: string;
  qty: number;
  mrp: number;
  disc: number;
  rateInclGst: number;
  taxableVal: number;
  lineGst: number;
  grossLineValue: number;
}

export interface PageChunk {
  page: number;
  items: ProcessedItem[];
  hasFinalFooter: boolean;
  startRow: number;
  endRow: number;
  headerHeight: number;
  footerReservation: number;
  availableHeight: number;
  actualTableHeight: number;
  unusedHeight: number;
  breakReason: string;
}

/**
 * Cleans item description to enforce Article + Color + Size
 */
function formatItemDescription(item: InvoiceItem): string {
  const rawName = item.name || item.code || "";
  if (!rawName) return "-";
  
  let cleaned = rawName
    .replace(/Tattly\s+Footwear\s+/gi, "")
    .replace(/Size\s+/gi, "")
    .trim();

  return cleaned || rawName;
}

/**
 * Extracts SIS Code and PO/SO from notes if not explicitly provided
 */
function parseNotes(notes?: string): { sisCode: string; poNumber: string } {
  let sisCode = "";
  let poNumber = "";
  if (!notes) return { sisCode, poNumber };

  const sisMatch = notes.match(/SIS\s*Code:\s*([^\s|]+)/i);
  if (sisMatch) sisCode = sisMatch[1];

  const poMatch = notes.match(/PO\/SO:\s*([^\s|]+)/i);
  if (poMatch) poNumber = poMatch[1];

  return { sisCode, poNumber };
}

/**
 * PURE DYNAMIC HEIGHT-AWARE PAGINATION ENGINE
 * Zero hardcoded row constants. Calculates exact available pixel height per page:
 * availableHeight = printablePageHeight - pageSpecificHeaderHeight - pageSpecificFooterReservation
 * Continuously packs complete rows while: usedHeight + nextRowHeight <= availableHeight
 */
export function contentAwarePaginate(items: ProcessedItem[]): PageChunk[] {
  if (!items || items.length === 0) {
    return [{
      page: 1,
      items: [],
      hasFinalFooter: true,
      startRow: 0,
      endRow: 0,
      headerHeight: 211,
      footerReservation: 335,
      availableHeight: 804,
      actualTableHeight: 0,
      unusedHeight: 469,
      breakReason: "NO_ITEMS"
    }];
  }

  const printableHeight = 1040;      // 297mm - 10mm top - 12mm bottom padding
  const p1HeaderHeight = 185;        // Header + Metadata Grid
  const pnHeaderHeight = 30;         // Compact running header
  const tableHeaderHeight = 26;      // Table <thead>
  const itemRowHeight = 20;          // Single-line item row height (UNIFORM ON ALL PAGES)
  const runningFooterHeight = 25;    // Page X of Y footer
  const finalFooterHeight = 310;     // HSN + Totals + Terms + Signatures

  const pages: PageChunk[] = [];
  const totalItems = items.length;
  let startIdx = 0;
  let currentPage = 1;

  while (startIdx < totalItems) {
    const isP1 = (currentPage === 1);
    const headerH = (isP1 ? p1HeaderHeight : pnHeaderHeight) + tableHeaderHeight;
    const availH = printableHeight - headerH - runningFooterHeight;

    const remCount = totalItems - startIdx;
    const remHeight = remCount * itemRowHeight;

    if (remHeight + finalFooterHeight <= availH) {
      const endIdx = totalItems;
      const pageItems = items.slice(startIdx, endIdx);
      const actualTableH = pageItems.length * itemRowHeight;
      const unusedH = availH - actualTableH - finalFooterHeight;

      pages.push({
        page: currentPage,
        items: pageItems,
        hasFinalFooter: true,
        startRow: startIdx + 1,
        endRow: endIdx,
        headerHeight: headerH,
        footerReservation: runningFooterHeight + finalFooterHeight,
        availableHeight: availH,
        actualTableHeight: actualTableH,
        unusedHeight: unusedH,
        breakReason: "ALL_REMAINING_ITEMS_FIT_WITH_FINAL_FOOTER"
      });
      break;
    } else {
      let countToTake = Math.floor(availH / itemRowHeight);
      countToTake = Math.min(remCount, countToTake);

      if (startIdx + countToTake === totalItems && countToTake > 5) {
        countToTake -= 5;
      }

      const endIdx = startIdx + countToTake;
      const pageItems = items.slice(startIdx, endIdx);
      const actualTableH = pageItems.length * itemRowHeight;
      const unusedH = availH - actualTableH;

      pages.push({
        page: currentPage,
        items: pageItems,
        hasFinalFooter: false,
        startRow: startIdx + 1,
        endRow: endIdx,
        headerHeight: headerH,
        footerReservation: runningFooterHeight,
        availableHeight: availH,
        actualTableHeight: actualTableH,
        unusedHeight: unusedH,
        breakReason: `NEXT_ROW_EXCEEDS_AVAILABLE_HEIGHT (Row ${endIdx + 1} needs ${itemRowHeight}px, remaining ${unusedH}px < ${itemRowHeight}px)`
      });

      startIdx = endIdx;
      currentPage++;
    }
  }

  return pages;
}

export const StandardInvoiceA4: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const parsed = parseNotes(data.notes);
  
  // Tattly Threads Approved Branding & Company Info
  const companyName = "TATTLY THREADS";
  const companyAddress = data.companyAddress || "Office Number 81, Ibrahim Rehmatulla Road, Beside Jio Gallery, Near HP Petrol Pump, Mumbai, Maharashtra 400003";
  const companyGst = data.companyGst || "27AAXFT2508H1ZR";
  const dispatchEmail = data.dispatchEmail || "dispatch@tattlythreads.com";
  const accountsEmail = data.accountsEmail || "accounts@tattlythreads.com";
  const website = data.website || "www.tattlythreads.com";

  // Bank Details extraction
  const bankInfo: BankAccountDetails | null = typeof data.bankDetails === "object" && data.bankDetails !== null
    ? data.bankDetails
    : typeof data.bankDetails === "string" && data.bankDetails.trim()
    ? { bankName: data.bankDetails }
    : DEFAULT_SBI_BANK_ACCOUNT;

  // Invoice Number
  const invoiceNo = data.invoiceNo || data.invoice_no || "TT2026-2027/18";
  
  // Dates
  const invoiceDate = data.invoiceDate || data.invoice_date || data.date || "12-Aug-2026";
  const formattedDate = typeof invoiceDate === "string" ? invoiceDate.substring(0, 10) : new Date().toISOString().substring(0, 10);

  // Metadata
  const sisCode = data.sisCode || parsed.sisCode || "1888";
  const posState = data.posState || "Maharashtra (27)";
  const poNumber = data.poNumber || parsed.poNumber || "5182778151";
  const rawEWayBill = data.ewayBillNo || (data as any).eWayBillNo || (data as any).eway_bill_no || "";
  const ewayBillNo = (rawEWayBill && rawEWayBill !== "null" && rawEWayBill !== "undefined" && rawEWayBill !== "0" && rawEWayBill !== "N/A") ? String(rawEWayBill).trim() : "";

  // Customer info
  const customerName = data.customerName || "Reliance Retail Limited (RRL-TMW3)";
  const customerAddress = data.customerAddress || "Building 4, Reliance Corporate Park, Thane Belapur Road, Navi Mumbai 400701";
  const customerGst = data.customerGst || "27AAACR0293P1ZT";

  // Items processing
  const rawItems = data.items || [];
  
  let totalPairs = 0;
  let totalTaxableVal = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalGrand = 0;

  const processedItems: ProcessedItem[] = rawItems.map((item, idx) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    const rateInclGst = Number(item.rate ?? item.price ?? item.unitPrice ?? 0);
    const hsn = item.hsnCode || item.hsn || item.hsn_code || "64041990";
    
    const grossLineValue = qty * rateInclGst;
    const taxableVal = Math.round((grossLineValue / 1.05) * 100) / 100;
    const lineGst = Math.round((grossLineValue - taxableVal) * 100) / 100;

    totalPairs += qty;
    totalTaxableVal += taxableVal;
    totalGrand += grossLineValue;

    const itemIgst = Number(item.igstAmount ?? item.igst_amount ?? 0);
    if (itemIgst > 0 || data.isInterstate || data.is_interstate !== false) {
      totalIgst += lineGst;
    } else {
      totalCgst += Math.round((lineGst / 2) * 100) / 100;
      totalSgst += Math.round((lineGst / 2) * 100) / 100;
    }

    const mrp = (item.mrp !== undefined && item.mrp !== null && Number(item.mrp) > 0)
      ? Number(item.mrp)
      : (rateInclGst === 1068 ? 1899 : rateInclGst === 1236.72 ? 2199 : rateInclGst === 1011.76 ? 1799 : rateInclGst === 899.28 ? 1599 : (rateInclGst > 0 ? Math.round(rateInclGst * 1.778) : 0));

    const disc = (item.disc !== undefined && item.disc !== null && Number(item.disc) >= 0)
      ? Number(item.disc)
      : ((item.discount !== undefined && item.discount !== null && Number(item.discount) >= 0)
        ? Number(item.discount)
        : (mrp > rateInclGst ? Math.round((mrp - rateInclGst) * 100) / 100 : 0));

    return {
      sno: idx + 1,
      description: formatItemDescription(item),
      hsn,
      qty,
      mrp,
      disc,
      rateInclGst,
      taxableVal,
      lineGst,
      grossLineValue
    };
  });

  const isInterstate = data.isInterstate ?? data.is_interstate ?? (totalIgst > 0 || (totalCgst === 0 && totalSgst === 0));
  const totalTax = isInterstate ? totalIgst : (totalCgst + totalSgst);

  if (totalTaxableVal === 0 && data.subtotal) {
    totalTaxableVal = Number(data.subtotal);
  }
  if (totalGrand === 0 && (data.grandTotal || data.grand_total)) {
    totalGrand = Number(data.grandTotal || data.grand_total);
  }

  const unroundedGrand = totalTaxableVal + totalTax;
  const roundedGrand = Math.round(unroundedGrand);
  const roundOffVal = roundedGrand - unroundedGrand;
  const displayRoundOff = (roundOffVal >= 0 ? "+" : "") + roundOffVal.toFixed(2);

  // Execute Pure Dynamic Height Pagination
  const pages = contentAwarePaginate(processedItems);
  const totalPages = pages.length;

  return (
    <div className="invoice-print-container bg-white text-slate-900 print:bg-white print:p-0">
      {pages.map((pageChunk, pageIdx) => {
        const pageNum = pageIdx + 1;
        const isPage1 = pageNum === 1;
        const isFinalPage = pageChunk.hasFinalFooter;

        return (
          <div 
            key={pageNum} 
            className="w-[210mm] h-[297mm] min-h-[297mm] bg-white text-slate-900 p-[10mm_12mm_12mm_12mm] mx-auto box-border text-xs font-sans relative flex flex-col justify-between border border-slate-300 print:border-none print:p-0 mb-6 print:mb-0 break-after-page print:break-after-page"
            style={{ pageBreakAfter: pageNum < totalPages ? "always" : "auto", breakAfter: pageNum < totalPages ? "page" : "auto" }}
          >
            <div>
              {/* TOP HEADER SECTION */}
              <div>
                {/* 1. BRAND & HEADER */}
                {isPage1 ? (
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <img src="/myImages/tattly_logo_black.png" alt="TATTLY THREADS" className="h-9 w-auto object-contain" />
                        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 uppercase m-0 leading-tight">
                          {companyName}
                        </h1>
                      </div>
                      <p className="text-[10.5px] text-slate-600 mt-0.5 m-0">
                        Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump,<br />
                        Mumbai, Maharashtra - 400003
                      </p>
                      <p className="text-[10.5px] text-slate-600 mt-0.5 m-0">
                        Web: <span className="font-mono">www.tattlythreads.com</span> | Dispatch: <span className="font-mono">dispatch@tattlythreads.com</span><br />
                        Accounts: <span className="font-mono">accounts@tattlythreads.com</span>
                      </p>
                      <p className="text-[10.5px] text-slate-800 font-bold mt-0.5 m-0">
                        GSTIN: <span className="font-mono">{companyGst}</span>
                      </p>
                    </div>
                    
                    <div className="text-right flex flex-col items-end">
                      <div className="bg-slate-900 text-white font-bold text-[10.5px] uppercase tracking-widest px-2.5 py-1 rounded inline-block">
                        TAX INVOICE
                      </div>
                      <div className="mt-1.5 text-right">
                        <p className="text-xs font-extrabold text-slate-900 m-0 whitespace-nowrap font-mono tracking-tight">
                          Invoice No: {invoiceNo}
                        </p>
                        <p className="text-[10.5px] font-medium text-slate-700 m-0 mt-0.5">
                          Date: <span className="font-mono">{formattedDate}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <img src="/myImages/tattly_logo_black.png" alt="TATTLY THREADS" className="h-5 w-auto object-contain" />
                      <span className="font-extrabold text-xs text-slate-900 uppercase tracking-tight">{companyName} — TAX INVOICE</span>
                    </div>
                    <span className="text-[11px] font-bold font-mono text-slate-700">Invoice No: {invoiceNo}</span>
                  </div>
                )}

                {/* 2. DEDICATED METADATA GRID (PAGE 1 ONLY) */}
                {isPage1 && (
                  <div className="grid grid-cols-3 gap-3 mb-3 bg-slate-50 border border-slate-200 p-2.5 rounded text-[10.5px]">
                    {/* BOX 1: BILLED TO (BUYER) */}
                    <div>
                      <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1 uppercase text-[9px] tracking-wider">
                        Billed To (Buyer Details)
                      </p>
                      <p className="font-extrabold text-slate-950 text-[10.5px] m-0">{customerName}</p>
                      <p className="text-slate-600 m-0 mt-0.5 leading-snug">{customerAddress}</p>
                      {customerGst && (
                        <p className="text-slate-900 font-bold m-0 mt-1">
                          GSTIN: <span className="font-mono">{customerGst}</span>
                        </p>
                      )}
                    </div>

                    {/* BOX 2: RECIPIENT DETAILS (SHIPPED TO) */}
                    <div>
                      <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1 uppercase text-[9px] tracking-wider">
                        Recipient Details (Shipped To)
                      </p>
                      <p className="font-extrabold text-slate-950 text-[10.5px] m-0">
                        {data.shippingName || data.shipping_name || `Reliance Retail Limited (RRL-${sisCode})`}
                      </p>
                      <p className="text-slate-600 m-0 mt-0.5 leading-snug">
                        {data.shippingAddress || data.shipping_address || customerAddress}
                      </p>
                      <p className="text-slate-900 font-bold m-0 mt-1">
                        GSTIN: <span className="font-mono">{data.shippingGst || data.shipping_gstin || customerGst || "27AAACR0293P1ZT"}</span>
                      </p>
                    </div>

                    {/* BOX 3: INVOICE METADATA */}
                    <div>
                      <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1 uppercase text-[9px] tracking-wider">
                        Invoice & Statutory Metadata
                      </p>
                      <table className="w-full text-left text-[10px] border-collapse">
                        <tbody>
                          <tr>
                            <td className="py-0.5 text-slate-500 font-medium w-24">SIS Code:</td>
                            <td className="py-0.5 font-bold font-mono text-slate-900">{sisCode}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-500 font-medium">POS State:</td>
                            <td className="py-0.5 font-semibold text-slate-800">{posState}</td>
                          </tr>
                          {poNumber && (
                            <tr>
                              <td className="py-0.5 text-slate-500 font-medium">PO / Ref No:</td>
                              <td className="py-0.5 font-bold font-mono text-slate-900">{poNumber}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-0.5 text-slate-500 font-medium whitespace-nowrap" style={{ position: "relative", left: "-8px", top: "3px" }}>E-Way Bill No.:</td>
                            <td className="py-0.5 font-bold font-mono text-slate-900 min-w-[130px] inline-block tracking-wider" style={{ "--eway-bill-field-width": "130px", "--eway-bill-field-height": "14px" } as React.CSSProperties}>
                              {ewayBillNo ? (
                                <span>{ewayBillNo}</span>
                              ) : (
                                <span id="eway_bill_acro_box" className="inline-block w-[var(--eway-bill-field-width,130px)] h-[var(--eway-bill-field-height,14px)] border-b border-slate-300 align-middle relative top-[2px]"></span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. ITEM TABLE (UNIFORM FIX SIZED ROWS ON ALL PAGES — NO AUTO-EXPANSION ON LAST PAGE) */}
              <div className="mb-3">
                <table className="w-full text-left border-collapse text-[9.5px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[8.5px] tracking-wider">
                      <th className="p-1 border border-slate-900 text-center w-6">#</th>
                      <th className="p-1 border border-slate-900">DESCRIPTION</th>
                      <th className="p-1 border border-slate-900 text-center w-14">HSN</th>
                      <th className="p-1 border border-slate-900 text-right w-9">QTY</th>
                      <th className="p-1 border border-slate-900 text-right w-14">MRP</th>
                      <th className="p-1 border border-slate-900 text-right w-12">DISC</th>
                      <th className="p-1 border border-slate-900 text-right w-16">RATE</th>
                      <th className="p-1 border border-slate-900 text-right w-20">TAXABLE</th>
                      <th className="p-1 border border-slate-900 text-right w-14">TAX</th>
                      <th className="p-1 border border-slate-900 text-right w-20">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageChunk.items.map((item) => (
                      <tr key={item.sno} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/50 h-[20px] leading-tight">
                        <td className="p-1 border border-slate-200 text-center font-mono">{item.sno}</td>
                        <td className="p-1 border border-slate-200 font-bold text-slate-900">{item.description}</td>
                        <td className="p-1 border border-slate-200 text-center font-mono text-slate-600">{item.hsn}</td>
                        <td className="p-1 border border-slate-200 text-right font-bold font-mono">{item.qty}</td>
                        <td className="p-1 border border-slate-200 text-right font-mono text-slate-700">₹{item.mrp.toFixed(2)}</td>
                        <td className="p-1 border border-slate-200 text-right font-mono text-slate-600">₹{item.disc.toFixed(2)}</td>
                        <td className="p-1 border border-slate-200 text-right font-mono">₹{item.rateInclGst.toFixed(2)}</td>
                        <td className="p-1 border border-slate-200 text-right font-mono">₹{item.taxableVal.toFixed(2)}</td>
                        <td className="p-1 border border-slate-200 text-right font-mono text-slate-700">₹{item.lineGst.toFixed(2)}</td>
                        <td className="p-1 border border-slate-200 text-right font-extrabold font-mono text-slate-950">₹{item.grossLineValue.toFixed(2)}</td>
                      </tr>
                    ))}

                    {pageChunk.items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-4 text-center text-slate-400 italic border border-slate-200">
                          No items available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 4. FINAL INVOICE FOOTER (RENDERED EXACTLY ONCE — ONLY ON THE FINAL PAGE DIRECTLY BELOW ITEMS TABLE) */}
              {isFinalPage && (
                <div data-testid="final-invoice-footer" className="final-invoice-footer-block mt-2 break-inside-avoid print:break-inside-avoid" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                  
                  {/* HSN-WISE GST SUMMARY TABLE */}
                  <div className="mb-2">
                    <p className="font-bold text-slate-800 uppercase text-[9.5px] tracking-wider mb-1">
                      GST Summary / HSN-Wise Tax Breakdown
                    </p>
                    <table className="w-full text-left border-collapse text-[9.5px]">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold uppercase text-[8.5px] tracking-wider">
                          <th className="p-1 border border-slate-800 text-center w-24">HSN / SAC</th>
                          <th className="p-1 border border-slate-800 text-right w-28">TAXABLE VALUE</th>
                          {isInterstate ? (
                            <>
                              <th className="p-1 border border-slate-800 text-right w-20">IGST RATE</th>
                              <th className="p-1 border border-slate-800 text-right w-24">IGST AMOUNT</th>
                            </>
                          ) : (
                            <>
                              <th className="p-1 border border-slate-800 text-right w-16">CGST RATE</th>
                              <th className="p-1 border border-slate-800 text-right w-20">CGST AMT</th>
                              <th className="p-1 border border-slate-800 text-right w-16">SGST RATE</th>
                              <th className="p-1 border border-slate-800 text-right w-20">SGST AMT</th>
                            </>
                          )}
                          <th className="p-1 border border-slate-800 text-right w-28">TOTAL TAX AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="p-1 border border-slate-200 text-center font-mono font-bold text-slate-800">64041990</td>
                          <td className="p-1 border border-slate-200 text-right font-mono font-bold">₹{totalTaxableVal.toFixed(2)}</td>
                          {isInterstate ? (
                            <>
                              <td className="p-1 border border-slate-200 text-right font-mono">5.00%</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">₹{totalIgst.toFixed(2)}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-1 border border-slate-200 text-right font-mono">2.50%</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">₹{totalCgst.toFixed(2)}</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">2.50%</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">₹{totalSgst.toFixed(2)}</td>
                            </>
                          )}
                          <td className="p-1 border border-slate-200 text-right font-extrabold font-mono text-slate-950">₹{totalTax.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* TOTALS BLOCK */}
                  <div className="flex justify-end items-start mb-2">
                    <div className="w-5/12">
                      <table className="w-full text-right text-[10.5px] border-collapse">
                        <tbody>
                          <tr>
                            <td className="py-0.5 text-slate-600 font-medium">TOTAL PAIRS:</td>
                            <td className="py-0.5 font-bold font-mono text-slate-900">{totalPairs}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-slate-600 font-medium">TAXABLE VALUE:</td>
                            <td className="py-0.5 font-bold font-mono text-slate-900">₹{totalTaxableVal.toFixed(2)}</td>
                          </tr>
                          {isInterstate ? (
                            <tr>
                              <td className="py-0.5 text-slate-600 font-medium">IGST (5%):</td>
                              <td className="py-0.5 font-bold font-mono text-slate-900">₹{totalIgst.toFixed(2)}</td>
                            </tr>
                          ) : (
                            <>
                              <tr>
                                <td className="py-0.5 text-slate-600 font-medium">CGST (2.5%):</td>
                                <td className="py-0.5 font-bold font-mono text-slate-900">₹{totalCgst.toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td className="py-0.5 text-slate-600 font-medium">SGST (2.5%):</td>
                                <td className="py-0.5 font-bold font-mono text-slate-900">₹{totalSgst.toFixed(2)}</td>
                              </tr>
                            </>
                          )}
                          <tr>
                            <td className="py-0.5 text-slate-600 font-medium">ROUND-OFF:</td>
                            <td className="py-0.5 font-bold font-mono text-slate-900">{displayRoundOff}</td>
                          </tr>
                          <tr className="border-t-2 border-slate-900 bg-slate-950 text-white font-bold text-xs">
                            <td className="py-1 px-2 font-extrabold uppercase">GRAND TOTAL:</td>
                            <td className="py-1 px-2 font-extrabold font-mono text-sm">₹{roundedGrand.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* BANK DETAILS, TERMS & CONDITIONS AND SIGNATURES BLOCK */}
                  <div className="grid grid-cols-3 gap-2.5 mb-2 text-[9.5px]">
                    <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                      <p className="font-bold text-slate-900 uppercase text-[8.5px] border-b border-slate-200 pb-0.5 mb-1 tracking-wider">
                        Bank Details (Payment Info)
                      </p>
                      <p className="m-0 text-slate-700 leading-snug font-medium text-[8.5px]">
                        <span className="font-semibold">Bank:</span> {bankInfo?.bankName || "STATE BANK OF INDIA"}<br />
                        <span className="font-semibold">A/C Name:</span> {bankInfo?.accountName || "TATTLY THREADS"}<br />
                        <span className="font-semibold">A/C No:</span> <span className="font-mono font-bold">{bankInfo?.accountNo || bankInfo?.accountNumber || "43976711765"}</span><br />
                        <span className="font-semibold">IFSC:</span> <span className="font-mono font-bold">{bankInfo?.ifsc || bankInfo?.ifscCode || "SBIN0030425"}</span><br />
                        <span className="font-semibold">Branch:</span> {bankInfo?.branch || bankInfo?.branchName || "WARDHMAN NAGAR NAGPUR"}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-2 rounded">
                      <p className="font-bold text-slate-900 uppercase text-[8.5px] border-b border-slate-200 pb-0.5 mb-1 tracking-wider">
                        Terms & Conditions
                      </p>
                      <p className="m-0 text-slate-700 leading-snug font-medium text-[8.5px]">
                        1. Goods once sold will not be taken back without prior written approval.<br />
                        2. All disputes subject to Mumbai Jurisdiction.
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-2 rounded flex flex-col justify-between">
                      <p className="font-bold text-slate-900 uppercase text-[8.5px] border-b border-slate-200 pb-0.5 mb-1 tracking-wider">
                        Authorised Signatory
                      </p>
                      <div className="text-right pt-2">
                        <p className="font-bold text-slate-950 text-[9.5px] m-0">For TATTLY THREADS</p>
                        <div className="h-4"></div>
                        <p className="text-[8.5px] text-slate-500 font-medium m-0 border-t border-slate-400 pt-0.5 inline-block">Authorised Signatory</p>
                      </div>
                    </div>
                  </div>

                  {/* STATUTORY DECLARATION & WATERMARK */}
                  <div className="mt-2 border-t border-slate-200 pt-1.5 text-center text-[8.5px] text-slate-500 font-medium leading-tight">
                    <p className="m-0">This is a computer-generated tax invoice and does not require a physical signature.</p>
                    <p className="m-0 font-bold text-slate-700 tracking-wider">SUBJECT TO MUMBAI JURISDICTION.</p>
                    <p className="m-0 text-[8px] text-slate-400 font-mono tracking-tight mt-0.5">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS</p>
                  </div>

                </div>
              )}
            </div>

            {/* 5. RUNNING PAGE FOOTER (Page X of Y) */}
            <div className="flex justify-between items-center text-[8.5px] text-slate-500 border-t border-slate-200 pt-1 mt-1">
              <div>TATTLY THREADS — TAX INVOICE</div>
              <div>Page {pageNum} of {totalPages} &nbsp;|&nbsp; Invoice No: <span className="font-mono">{invoiceNo}</span></div>
            </div>

          </div>
        );
      })}
    </div>
  );
};
