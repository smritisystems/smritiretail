/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-19
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";

export const numberToIndianWords = (num: number): string => {
  if (num === 0) return "Zero";
  
  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const doubleDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tensMultiple = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const placeValues = ["", "Thousand", "Lakh", "Crore"];

  const getWordForThreeDigits = (n: number): string => {
    let word = "";
    if (n >= 100) {
      word += singleDigits[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      word += doubleDigits[n - 10] + " ";
    } else if (n >= 20) {
      word += tensMultiple[Math.floor(n / 10)] + " " + singleDigits[n % 10] + " ";
    } else if (n > 0) {
      word += singleDigits[n] + " ";
    }
    return word;
  };

  let strWords = "";
  let integerPart = Math.floor(num);
  let paisaPart = Math.round((num - integerPart) * 100);

  const chunks: number[] = [];
  // Indian formatting chunks: first chunk is 3 digits, subsequent chunks are 2 digits
  if (integerPart === 0) {
    strWords = "Zero ";
  } else {
    chunks.push(integerPart % 1000);
    integerPart = Math.floor(integerPart / 1000);
    while (integerPart > 0) {
      chunks.push(integerPart % 100);
      integerPart = Math.floor(integerPart / 100);
    }
    
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunkVal = chunks[i];
      if (chunkVal > 0) {
        strWords += getWordForThreeDigits(chunkVal) + (placeValues[i] ? placeValues[i] + " " : "");
      }
    }
  }

  let finalStr = strWords.trim() + " Rupees Only";
  if (paisaPart > 0) {
    const paisaWords = getWordForThreeDigits(paisaPart).trim();
    finalStr = strWords.trim() + " Rupees and " + paisaWords + " Paisa Only";
  }

  return finalStr;
};

interface TaxInvoiceA4Props {
  data: {
    companyName?: string;
    companyAddress?: string;
    companyGst?: string;
    companyPhone?: string;
    companyEmail?: string;
    logoUrl?: string;
    
    invoiceNo: string;
    date: string;
    dueDate?: string;
    poRef?: string;
    eWayBillNo?: string;
    supplyType?: "Intrastate" | "Interstate";
    
    customerName: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPincode?: string;
    billingCountry?: string;
    customerGst?: string;
    customerPhone?: string;
    
    shippingName?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    shippingCountry?: string;
    shippingSameAsBilling?: boolean;
    
    items: Array<{
      name: string;
      hsn?: string;
      qty: number;
      unit?: string;
      rate: number;
      discountPercent?: number;
      gstPercentage?: number;
    }>;
    
    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
    bankBranch?: string;
    paymentTerms?: string;
    notes?: string;
  };
}

export const TaxInvoiceA4: React.FC<TaxInvoiceA4Props> = ({ data }) => {
  const items = data.items || [];
  
  // Calculations
  let totalTaxableValue = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let grandTotal = 0;

  // HSN-wise tax breakdown cache
  const hsnBreakdown: Record<string, {
    taxable: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
  }> = {};

  const processedItems = items.map((item) => {
    const qty = item.qty || 0;
    const rate = item.rate || 0;
    const discPercent = item.discountPercent || 0;
    const gstRate = item.gstPercentage || 0;
    const hsn = item.hsn || "99633"; // Fallback default HSN

    const grossAmount = qty * rate;
    const discountAmount = (grossAmount * discPercent) / 100;
    const taxableValue = grossAmount - discountAmount;
    
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isInterstate = data.supplyType === "Interstate";
    if (isInterstate) {
      igst = (taxableValue * gstRate) / 100;
    } else {
      cgst = (taxableValue * (gstRate / 2)) / 100;
      sgst = (taxableValue * (gstRate / 2)) / 100;
    }

    const total = taxableValue + cgst + sgst + igst;

    totalTaxableValue += taxableValue;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    grandTotal += total;

    // Build HSN-wise summary
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
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      total,
    };
  });

  const rawGrandTotal = grandTotal;
  const roundedGrandTotal = Math.round(grandTotal);
  const roundingAdjustment = roundedGrandTotal - rawGrandTotal;

  // Billing address string formatting
  const billingAddr = [
    data.billingAddressLine1,
    data.billingAddressLine2,
    data.billingCity ? `${data.billingCity}${data.billingPincode ? ' - ' + data.billingPincode : ''}` : '',
    data.billingState,
    data.billingCountry
  ].filter(Boolean).join(", ") || "No Billing Address Listed";

  // Shipping address string formatting
  const shippingAddr = data.shippingSameAsBilling !== false
    ? billingAddr
    : [
        data.shippingAddressLine1,
        data.shippingAddressLine2,
        data.shippingCity ? `${data.shippingCity}${data.shippingPincode ? ' - ' + data.shippingPincode : ''}` : '',
        data.shippingState,
        data.shippingCountry
      ].filter(Boolean).join(", ") || "No Shipping Address Listed";

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-black p-[15mm] mx-auto box-border text-[11px] leading-normal font-sans border border-gray-200">
      
      {/* Header and Branding */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-3">
        <div className="flex items-center gap-3">
          {data.logoUrl && (
            <img src={data.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
          )}
          <div>
            <h1 className="text-lg font-bold uppercase tracking-tight text-gray-900">
              {data.companyName || "SMRITI ENTERPRISES"}
            </h1>
            <p className="text-gray-600 max-w-sm whitespace-pre-wrap">{data.companyAddress || "Corporate Office Address Details"}</p>
            {data.companyPhone && <span className="text-gray-600">Phone: {data.companyPhone} | </span>}
            {data.companyEmail && <span className="text-gray-600">Email: {data.companyEmail}</span>}
            {data.companyGst && <p className="text-gray-800 font-semibold mt-0.5">GSTIN: {data.companyGst}</p>}
          </div>
        </div>
        
        <div className="text-right border-l border-gray-300 pl-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Tax Invoice</h2>
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-left font-mono">
            <span className="text-gray-500">Invoice No:</span>
            <span className="font-bold text-gray-900">{data.invoiceNo}</span>
            <span className="text-gray-500">Date:</span>
            <span className="text-gray-950 font-medium">{data.date}</span>
            {data.dueDate && (
              <>
                <span className="text-gray-500">Due Date:</span>
                <span className="text-gray-950 font-medium">{data.dueDate}</span>
              </>
            )}
            {data.poRef && (
              <>
                <span className="text-gray-500">PO Ref:</span>
                <span className="text-gray-950 font-medium">{data.poRef}</span>
              </>
            )}
            {data.eWayBillNo && (
              <>
                <span className="text-gray-500">E-Way Bill:</span>
                <span className="text-gray-950 font-medium">{data.eWayBillNo}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bill To vs Ship To */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-2.5 rounded mb-3 bg-gray-50/40">
        <div>
          <h3 className="font-bold text-gray-800 uppercase text-[9px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            Billed To (Recipient)
          </h3>
          <p className="font-bold text-gray-900">{data.customerName}</p>
          <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{billingAddr}</p>
          {data.customerPhone && <p className="text-gray-600 mt-0.5">Mobile: {data.customerPhone}</p>}
          {data.customerGst && (
            <p className="text-gray-800 font-semibold mt-1 bg-gray-200/50 inline-block px-1 rounded font-mono">
              GSTIN: {data.customerGst}
            </p>
          )}
        </div>
        <div>
          <h3 className="font-bold text-gray-800 uppercase text-[9px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            Shipped To (Consignee)
          </h3>
          <p className="font-bold text-gray-900">{data.shippingName || data.customerName}</p>
          <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{shippingAddr}</p>
        </div>
      </div>

      {/* Itemized Table */}
      <table className="w-full text-left border border-gray-300 border-collapse mb-3">
        <thead>
          <tr className="bg-gray-100/80 text-gray-800 uppercase text-[9px] tracking-wider border-b border-gray-300 font-mono">
            <th className="p-1.5 border-r border-gray-300 text-center w-8">#</th>
            <th className="p-1.5 border-r border-gray-300">Item Description</th>
            <th className="p-1.5 border-r border-gray-300 text-center w-16">HSN/SAC</th>
            <th className="p-1.5 border-r border-gray-300 text-right w-12">Qty</th>
            <th className="p-1.5 border-r border-gray-300 text-right w-16">Rate</th>
            <th className="p-1.5 border-r border-gray-300 text-right w-12">Disc %</th>
            <th className="p-1.5 border-r border-gray-300 text-right w-20">Taxable Val</th>
            {data.supplyType !== "Interstate" ? (
              <>
                <th className="p-1.5 border-r border-gray-300 text-right w-24">CGST</th>
                <th className="p-1.5 border-r border-gray-300 text-right w-24">SGST</th>
              </>
            ) : (
              <th className="p-1.5 border-r border-gray-300 text-right w-24">IGST</th>
            )}
            <th className="p-1.5 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {processedItems.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50">
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{idx + 1}</td>
              <td className="p-1.5 border-r border-gray-300 font-medium text-gray-900">{item.name}</td>
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{item.hsn}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono">{item.qty} {item.unit || "Pcs"}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono">₹{item.rate.toFixed(2)}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono">{item.discountPercent ? `${item.discountPercent}%` : "-"}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono">₹{item.taxableValue.toFixed(2)}</td>
              {data.supplyType !== "Interstate" ? (
                <>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-600">
                    ₹{item.cgst.toFixed(2)}<span className="text-[8px] block">@{(item.gstRate / 2)}%</span>
                  </td>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-600">
                    ₹{item.sgst.toFixed(2)}<span className="text-[8px] block">@{(item.gstRate / 2)}%</span>
                  </td>
                </>
              ) : (
                <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-600">
                  ₹{item.igst.toFixed(2)}<span className="text-[8px] block">@{item.gstRate}%</span>
                </td>
              )}
              <td className="p-1.5 text-right font-mono font-bold text-gray-900">₹{item.total.toFixed(2)}</td>
            </tr>
          ))}
          {processedItems.length === 0 && (
            <tr>
              <td colSpan={data.supplyType !== "Interstate" ? 10 : 9} className="p-8 text-center text-gray-400 italic">
                No items included in this invoice.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals Summary */}
      <div className="flex justify-between items-start mb-3 gap-4">
        {/* Left Side: Indian numbering words */}
        <div className="w-1/2 border border-gray-300 p-2 rounded bg-gray-50/30">
          <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
            Total Amount (in words)
          </span>
          <p className="font-bold text-gray-900 leading-normal text-xs font-display">
            {numberToIndianWords(roundedGrandTotal)}
          </p>
        </div>
        
        {/* Right Side: Totals calculation */}
        <div className="w-1/2 border border-gray-300 rounded overflow-hidden">
          <div className="grid grid-cols-2 divide-y divide-gray-200 text-right font-mono">
            <div className="p-1.5 bg-gray-50/50 text-gray-500 pr-3 border-r border-gray-200">Subtotal (Taxable Value):</div>
            <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalTaxableValue.toFixed(2)}</div>
            {data.supplyType !== "Interstate" ? (
              <>
                <div className="p-1.5 bg-gray-50/50 text-gray-500 pr-3 border-r border-gray-200">CGST Total:</div>
                <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalCGST.toFixed(2)}</div>
                <div className="p-1.5 bg-gray-50/50 text-gray-500 pr-3 border-r border-gray-200">SGST Total:</div>
                <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalSGST.toFixed(2)}</div>
              </>
            ) : (
              <>
                <div className="p-1.5 bg-gray-50/50 text-gray-500 pr-3 border-r border-gray-200">IGST Total:</div>
                <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalIGST.toFixed(2)}</div>
              </>
            )}
            {Math.abs(roundingAdjustment) > 0.005 && (
              <>
                <div className="p-1.5 bg-gray-50/50 text-gray-500 pr-3 border-r border-gray-200">Rounding Adjustment:</div>
                <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{roundingAdjustment.toFixed(2)}</div>
              </>
            )}
            <div className="p-2 bg-gray-900 text-white font-bold text-xs pr-3 border-r border-gray-800">GRAND TOTAL:</div>
            <div className="p-2 bg-gray-900 text-white font-bold text-sm pr-3 font-mono">₹{roundedGrandTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* GST Breakdown Summary Table */}
      <div className="mb-3">
        <h4 className="font-bold text-gray-800 uppercase text-[9px] tracking-wider mb-1.5">
          GST Summary / HSN-wise tax breakdown
        </h4>
        <table className="w-full border border-gray-300 border-collapse text-left text-[9px] font-mono">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-300 font-bold uppercase text-[8px] text-gray-700">
              <th className="p-1 border-r border-gray-300">HSN/SAC</th>
              <th className="p-1 border-r border-gray-300 text-right">Taxable Value</th>
              {data.supplyType !== "Interstate" ? (
                <>
                  <th className="p-1 border-r border-gray-300 text-right w-16">CGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">CGST Amount</th>
                  <th className="p-1 border-r border-gray-300 text-right w-16">SGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">SGST Amount</th>
                </>
              ) : (
                <>
                  <th className="p-1 border-r border-gray-300 text-right w-20">IGST Rate</th>
                  <th className="p-1 border-r border-gray-300 text-right">IGST Amount</th>
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
                  <td className="p-1.5 border-r border-gray-300 text-right">₹{v.taxable.toFixed(2)}</td>
                  {data.supplyType !== "Interstate" ? (
                    <>
                      <td className="p-1.5 border-r border-gray-300 text-right">{(v.gstRate / 2)}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.cgst.toFixed(2)}</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">{(v.gstRate / 2)}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.sgst.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-1.5 border-r border-gray-300 text-right">{v.gstRate}%</td>
                      <td className="p-1.5 border-r border-gray-300 text-right">₹{v.igst.toFixed(2)}</td>
                    </>
                  )}
                  <td className="p-1.5 text-right font-bold">₹{totalTax.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info: Bank / Note / Signature */}
      <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3 mt-4 text-[10px]">
        <div>
          {data.bankName && (
            <div className="mb-2 p-2 border border-gray-200 rounded bg-gray-50/20">
              <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
                Bank Details
              </span>
              <p className="font-semibold text-gray-900">{data.bankName}</p>
              <p className="text-gray-600 font-mono">A/C No: {data.bankAccountNo}</p>
              <p className="text-gray-600 font-mono">IFSC: {data.bankIfsc} | Branch: {data.bankBranch}</p>
              {data.paymentTerms && <p className="text-gray-700 mt-1 italic">Terms: {data.paymentTerms}</p>}
            </div>
          )}
          {data.notes && (
            <div>
              <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-0.5">
                Terms &amp; Conditions
              </span>
              <p className="text-gray-500 whitespace-pre-wrap text-[9px] leading-relaxed">{data.notes}</p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col justify-between items-end pl-8">
          <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10">
            <p className="text-[8px] text-gray-500 uppercase">For {data.companyName || "SMRITI ENTERPRISES"}</p>
            <div className="h-10 mt-1" /> {/* Spacer for signature */}
            <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
              Authorised Signatory
            </p>
          </div>
          <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10 mt-4">
            <div className="h-10" /> {/* Spacer for signature */}
            <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
              Customer Signature
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-[9px] text-gray-500 border-t border-dashed pt-2 font-mono">
        <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
        <p className="font-bold text-gray-600 mt-0.5">SMRITI OS Retail Suite -- Powered by AITDL NETWORKS</p>
      </div>

    </div>
  );
};
