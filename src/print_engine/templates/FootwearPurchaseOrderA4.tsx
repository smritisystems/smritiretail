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

import React from "react";

export interface FootwearPurchaseOrderItem {
  articleCode: string;
  modelName: string;
  category?: string;
  taricCode?: string;
  hsnCode?: string;
  color: string;
  size?: string;
  colorHex?: string;
  finish?: string;
  upperMaterial: string;
  soleMaterial: string;
  liningMaterial: string;
  insoleMaterial: string;
  weltType?: string;
  ratioString?: string;
  photoUrl?: string;
  // Sizing run - Euro EU 40-45 Default
  eu40?: number;
  eu41?: number;
  eu42?: number;
  eu43?: number;
  eu44?: number;
  eu45?: number;
  cartons: number;
  pairs: number;
  ratePerPair: number;
  taxRatePercent: number;
  lineTotal: number;
}

export interface FootwearPurchaseOrderData {
  poNumber?: string;
  poDate?: string;
  deliveryDate?: string;
  companyName?: string;
  companySubtitle?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyContact?: string;
  vendorCode?: string;
  vendorName?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  vendorContact?: string;
  dcCode?: string;
  dcName?: string;
  dcAddress?: string;
  dcGstin?: string;
  dcReceivingGate?: string;
  currency?: "EUR" | "INR" | "USD";
  currencySymbol?: string;
  sizingScale?: "EURO" | "UK" | "US";
  showPhotos?: boolean;
  items?: FootwearPurchaseOrderItem[];
  totalCartons?: number;
  totalPairs?: number;
  netOrderValue?: number;
  netOrderValueInWords?: string;
  secondaryCurrencyTotal?: string;
  paymentTerms?: string;
  purchaser?: string;
  supplierReference?: string;
  documentStatus?: string;
  qualityStandards?: string[];
  authorizedSignatoryBuyer?: string;
  authorizedSignatoryVendor?: string;
}

export const FootwearPurchaseOrderA4: React.FC<{ data: FootwearPurchaseOrderData }> = ({ data }) => {
  const currencySymbol = data.currencySymbol || (data.currency === "INR" ? "₹" : data.currency === "USD" ? "$" : "€");
  const currencyCode = data.currency || "EUR";
  const sizingScale = data.sizingScale || "EURO";
  const showPhotos = data.showPhotos !== false;

  const items = data.items && data.items.length > 0 ? data.items : [
    {
      articleCode: "FW-OXF-801",
      modelName: "Men's Handcrafted Leather Oxford Derby",
      category: "Oxford Formal",
      taricCode: "64035910",
      color: "Tan Brown",
      colorHex: "#78350f",
      finish: "Burnished Finish",
      upperMaterial: "Full Grain Calf Leather",
      soleMaterial: "Genuine Leather + Rubber Pad",
      liningMaterial: "Breathable Goat Leather",
      insoleMaterial: "Memory Foam OrthoLite",
      ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
      eu40: 10, eu41: 20, eu42: 30, eu43: 30, eu44: 20, eu45: 10,
      cartons: 10,
      pairs: 120,
      ratePerPair: 21.00,
      taxRatePercent: 0.0,
      lineTotal: 2520.00
    },
    {
      articleCode: "FW-SNK-402",
      modelName: "Men's Air-Cushion Knit Running Sneaker",
      category: "Athletic Sneaker",
      taricCode: "64041190",
      color: "Cobalt / White",
      colorHex: "#0284c7",
      finish: "Dual Tone Sole",
      upperMaterial: "Seamless Engineered Jacquard Mesh",
      soleMaterial: "Ultra-Light Phylon EVA + Rubber",
      liningMaterial: "Moisture-Wicking Padded Spandex",
      insoleMaterial: "Ergonomic Gel Arch Support",
      ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
      eu40: 15, eu41: 30, eu42: 45, eu43: 45, eu44: 30, eu45: 15,
      cartons: 15,
      pairs: 180,
      ratePerPair: 14.20,
      taxRatePercent: 0.0,
      lineTotal: 2556.00
    },
    {
      articleCode: "FW-CHE-905",
      modelName: "Men's Goodyear Welted Suede Chelsea Boot",
      category: "Chelsea Boot",
      taricCode: "64039190",
      color: "Rustic Black",
      colorHex: "#1c1917",
      finish: "Heavy Elastic Gusset",
      upperMaterial: "Premium Water-Resistant Oiled Suede",
      soleMaterial: "Commando Lugged Vibram Rubber Sole",
      liningMaterial: "Full Glove Leather Lining",
      insoleMaterial: "Memory Foam OrthoLite",
      weltType: "360-Degree Goodyear Storm Welt",
      ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
      eu40: 5, eu41: 10, eu42: 15, eu43: 15, eu44: 10, eu45: 5,
      cartons: 5,
      pairs: 60,
      ratePerPair: 36.40,
      taxRatePercent: 0.0,
      lineTotal: 2184.00
    }
  ];

  const totalCartons = data.totalCartons || items.reduce((acc, it) => acc + (it.cartons || 0), 0);
  const totalPairs = data.totalPairs || items.reduce((acc, it) => acc + (it.pairs || 0), 0);
  const netOrderValue = data.netOrderValue || items.reduce((acc, it) => acc + (it.lineTotal || 0), 0);

  const sumEu40 = items.reduce((a, b) => a + (b.eu40 || 0), 0);
  const sumEu41 = items.reduce((a, b) => a + (b.eu41 || 0), 0);
  const sumEu42 = items.reduce((a, b) => a + (b.eu42 || 0), 0);
  const sumEu43 = items.reduce((a, b) => a + (b.eu43 || 0), 0);
  const sumEu44 = items.reduce((a, b) => a + (b.eu44 || 0), 0);
  const sumEu45 = items.reduce((a, b) => a + (b.eu45 || 0), 0);

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 mx-auto box-border text-[11px] font-sans print-only-container shadow-sm leading-normal">
      {/* 1. CORPORATE HEADER */}
      <div className="flex justify-between border-b-2 border-indigo-950 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-950 text-white w-10 h-10 rounded flex items-center justify-center font-black text-lg tracking-wider">
              TF
            </div>
            <div>
              <h1 className="text-xl font-black text-indigo-950 leading-none">
                {data.companyName || "TATTLY FOOTWEAR & LEATHER APPAREL PVT LTD"}
              </h1>
              <p className="text-[10px] text-slate-500 mt-1">
                {data.companySubtitle || "Footwear Manufacturing, Brand Licensing & International Distribution"}
              </p>
            </div>
          </div>
          <div className="text-[10px] text-slate-600 mt-2 space-y-0.5">
            <p><strong>Central Godown & Office:</strong> {data.companyAddress || "Plot 88, Sector 59, IMT Manesar, Gurugram, Haryana - 122051"}</p>
            <p><strong>GSTIN / VAT:</strong> {data.companyGstin || "06AAACT2934K1Z2"} | <strong>Country:</strong> India / EU Export Desk</p>
            <p><strong>Footwear Procurement:</strong> {data.companyContact || "footwear.procurement@tattlythreads.com | +91 124 4987 880"}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block bg-indigo-100 text-indigo-900 px-3 py-1 font-black text-xs rounded mb-1.5 uppercase tracking-wide">
            FOOTWEAR PURCHASE ORDER
          </div>
          <div className="text-sm font-mono font-black text-indigo-950">PO #: {data.poNumber || "FWPO-2026-084"}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">PO Date: {data.poDate || "19-Sep-2026"}</div>
          <div className="text-[11px] text-rose-600 font-bold mt-0.5">Delivery Due: {data.deliveryDate || "05-Oct-2026"}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Scale: {sizingScale === "EURO" ? "Euro Scale (EU 40–45) [Default]" : sizingScale}
          </div>
        </div>
      </div>

      {/* 2. VENDOR & DELIVERY DESTINATION */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-[10px]">
        <div className="border border-slate-300 rounded p-2 bg-slate-50">
          <div className="font-extrabold text-indigo-950 uppercase text-[9px] border-b border-slate-200 pb-1 mb-1.5 flex justify-between">
            <span>FOOTWEAR MANUFACTURER / FACTORY</span>
            <span className="font-mono text-slate-500">{data.vendorCode || "VENDOR: V-AGRA-44"}</span>
          </div>
          <div className="font-bold text-xs text-slate-900">{data.vendorName || "Agra Leatherworks & Footwear Craft Ltd"}</div>
          <div className="text-slate-600 mt-0.5">{data.vendorAddress || "Plot 12-14, Leather Park, Sikandra Industrial Area, Agra, UP - 282007"}</div>
          <div className="text-slate-600 mt-0.5"><strong>GSTIN / Tax ID:</strong> {data.vendorGstin || "09AAACA4488Q1ZQ"}</div>
          <div className="text-slate-600 mt-0.5">{data.vendorContact || "Factory Head: Surendra Verma | orders@agraleatherworks.com"}</div>
        </div>

        <div className="border border-slate-300 rounded p-2 bg-slate-50">
          <div className="font-extrabold text-indigo-950 uppercase text-[9px] border-b border-slate-200 pb-1 mb-1.5 flex justify-between">
            <span>RECEIVING GODOWN / CENTRAL DC</span>
            <span className="font-mono text-slate-500">{data.dcCode || "DC CODE: DC-MANESAR"}</span>
          </div>
          <div className="font-bold text-xs text-slate-900">{data.dcName || "Tattly Central Footwear Logistics Hub"}</div>
          <div className="text-slate-600 mt-0.5">{data.dcAddress || "Shed 4, IndoSpace Logistics Park, IMT Manesar, Gurugram, Haryana - 122051"}</div>
          <div className="text-slate-600 mt-0.5"><strong>GSTIN:</strong> {data.dcGstin || "06AAACT2934K1Z2"}</div>
          <div className="text-slate-600 mt-0.5">{data.dcReceivingGate || "Receiving Gate: Bay 2 Footwear Inward (08:00 to 17:00 Hrs)"}</div>
        </div>
      </div>

      {/* 3. SIZING MATRIX TABLE */}
      <div className="mb-3">
        <div className="text-[10.5px] font-extrabold text-indigo-950 uppercase mb-1.5 flex justify-between items-center">
          <span>FOOTWEAR PRODUCTION & CARTON ASSORTMENT (EURO SIZING SCALE EU 40–45 [DEFAULT])</span>
          <span className="text-[9px] text-slate-500 font-normal">Packaging: 1 Master Carton = 12 Pairs Assorted Ratio</span>
        </div>

        <table className="w-full border-collapse text-[10px] border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 text-slate-900 text-left">
              <th className="p-1.5 text-center border-r border-slate-300 w-6">#</th>
              {showPhotos && <th className="p-1.5 text-center border-r border-slate-300 w-14">Photo</th>}
              <th className="p-1.5 border-r border-slate-300 w-24">Article & Model</th>
              <th className="p-1.5 border-r border-slate-300">Footwear Technical Specifications</th>
              <th className="p-1.5 border-r border-slate-300 w-20">Color</th>
              {/* Euro Sizing Columns */}
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 40<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 6)</span></th>
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 41<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 7)</span></th>
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 42<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 8)</span></th>
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 43<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 9)</span></th>
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 44<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 10)</span></th>
              <th className="p-1 text-center bg-indigo-50 border-r border-slate-300 w-9 font-bold">EU 45<br/><span className="text-[7.5px] font-normal text-indigo-700">(UK 11)</span></th>
              <th className="p-1.5 text-center bg-rose-50 border-r border-slate-300 w-14 font-bold">Cartons</th>
              <th className="p-1.5 text-right bg-amber-50 border-r border-slate-300 w-14 font-extrabold">Pairs</th>
              <th className="p-1.5 text-right border-r border-slate-300 w-16">Rate ({currencyCode})</th>
              <th className="p-1.5 text-center border-r border-slate-300 w-14">Tax</th>
              <th className="p-1.5 text-right font-extrabold bg-slate-50 w-20">Total ({currencyCode})</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="p-1.5 text-center text-slate-500 border-r border-slate-300">{idx + 1}</td>
                {showPhotos && (
                  <td className="p-1 text-center border-r border-slate-300">
                    <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto overflow-hidden">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                        <path d="M2 18h20c-.5-3-2-6-5-7l-5-2-4 1-4 3c-1 1-1.5 3-2 5z"/>
                        <path d="M2 18v2c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-2"/>
                      </svg>
                    </div>
                  </td>
                )}
                <td className="p-1.5 font-mono font-bold border-r border-slate-300">
                  {item.articleCode}
                  <div className="text-[8.5px] text-indigo-700 font-sans font-semibold">{item.category}</div>
                  <div className="text-[8px] text-slate-400">TARIC: {item.taricCode || item.hsnCode}</div>
                </td>
                <td className="p-1.5 border-r border-slate-300">
                  <div className="font-bold text-slate-900">{item.modelName}</div>
                  <div className="grid grid-cols-2 gap-x-2 text-[8.5px] text-slate-600 mt-1">
                    <span><strong>Upper:</strong> {item.upperMaterial}</span>
                    <span><strong>Sole:</strong> {item.soleMaterial}</span>
                    <span><strong>Lining:</strong> {item.liningMaterial}</span>
                    <span><strong>Insole:</strong> {item.insoleMaterial}</span>
                  </div>
                  {item.ratioString && (
                    <div className="text-[8px] text-emerald-700 font-semibold mt-1">
                      Ratio (EU 40-45): {item.ratioString}
                    </div>
                  )}
                </td>
                <td className="p-1.5 border-r border-slate-300">
                  <div className="flex items-center gap-1">
                    {item.colorHex && (
                      <span className="w-2.5 h-2.5 rounded-sm border border-slate-300 inline-block" style={{ backgroundColor: item.colorHex }} />
                    )}
                    <span className="font-semibold">{item.color}</span>
                  </div>
                  <div className="text-[8px] text-slate-400">{item.finish}</div>
                </td>
                {/* Size Quantities */}
                <td className="p-1 text-center font-mono border-r border-slate-300">{item.eu40 || "-"}</td>
                <td className="p-1 text-center font-mono font-semibold border-r border-slate-300">{item.eu41 || "-"}</td>
                <td className="p-1 text-center font-mono font-semibold border-r border-slate-300">{item.eu42 || "-"}</td>
                <td className="p-1 text-center font-mono font-semibold border-r border-slate-300">{item.eu43 || "-"}</td>
                <td className="p-1 text-center font-mono font-semibold border-r border-slate-300">{item.eu44 || "-"}</td>
                <td className="p-1 text-center font-mono border-r border-slate-300">{item.eu45 || "-"}</td>
                {/* Summary cols */}
                <td className="p-1.5 text-center font-mono font-bold bg-rose-50/50 border-r border-slate-300">{item.cartons} Ctns</td>
                <td className="p-1.5 text-right font-mono font-black bg-amber-50/50 border-r border-slate-300">{item.pairs} Prs</td>
                <td className="p-1.5 text-right font-mono border-r border-slate-300">
                  {currencySymbol} {item.ratePerPair.toFixed(2)}
                </td>
                <td className="p-1.5 text-center font-mono text-[8.5px] border-r border-slate-300 text-emerald-700 font-bold">
                  {item.taxRatePercent.toFixed(1)}%
                </td>
                <td className="p-1.5 text-right font-mono font-black text-indigo-950">
                  {currencySymbol} {item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
              <td colSpan={showPhotos ? 5 : 4} className="p-2 text-right uppercase">
                Consolidated Euro Scale Sum (EU 40–45):
              </td>
              <td className="p-1 text-center font-mono">{sumEu40}</td>
              <td className="p-1 text-center font-mono">{sumEu41}</td>
              <td className="p-1 text-center font-mono">{sumEu42}</td>
              <td className="p-1 text-center font-mono">{sumEu43}</td>
              <td className="p-1 text-center font-mono">{sumEu44}</td>
              <td className="p-1 text-center font-mono">{sumEu45}</td>
              <td className="p-2 text-center font-mono text-rose-800 bg-rose-100">{totalCartons} Master Ctns</td>
              <td className="p-2 text-right font-mono text-indigo-950 bg-amber-100">{totalPairs} Pairs</td>
              <td colSpan={2} className="p-2 text-right uppercase">Net Total:</td>
              <td className="p-2 text-right font-mono text-indigo-950 text-xs">
                {currencySymbol} {netOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. FOOTWEAR QUALITY & SETTLEMENT SUMMARY */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3 mb-3 text-[9.5px]">
        <div>
          <div className="bg-indigo-50 border border-indigo-200 rounded p-2 mb-2">
            <strong className="text-indigo-950">Total Chargeable Invoice Value (in words):</strong>
            <p className="italic text-indigo-900 font-bold text-[10px] mt-0.5">
              {data.netOrderValueInWords || "Euros Seven Thousand Two Hundred Sixty Only (Dual Ref: ₹ 6,40,332.00 @ 88.20 FX Rate)"}
            </p>
          </div>

          <div className="border border-slate-200 rounded p-2 bg-slate-50">
            <strong className="text-indigo-950 uppercase">Footwear Quality & Packaging Norms:</strong>
            <ul className="list-disc pl-4 mt-1 text-slate-600 space-y-0.5">
              <li><strong>Shoebox Standards:</strong> Magnetic Kraft shoebox with tissue paper and anti-fungal silica pouch.</li>
              <li><strong>Barcoding:</strong> High-adhesion EAN-13 barcode sticker on each shoebox specifying Euro size (EU 40–45 default) & UK size.</li>
              <li><strong>Master Cartons:</strong> 7-ply export cartons strapped with nylon banding. Label with Carton number & Euro ratio breakdown.</li>
              <li><strong>Bonding Norms:</strong> Sole pull test must exceed 4.0 N/mm standard per SATRA TM411.</li>
            </ul>
          </div>
        </div>

        <div className="border border-slate-300 rounded p-2 bg-slate-50 flex flex-col justify-between">
          <div>
            <div className="font-extrabold text-indigo-950 border-b border-slate-200 pb-1 mb-1.5">
              TAX COMPUTATION & SETTLEMENT
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Merchandise Net Value ({currencyCode}):</span>
              <span className="font-mono font-bold">{currencySymbol} {netOrderValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Cross-Border Reverse Charge / Export:</span>
              <span className="font-mono font-bold text-emerald-700">0.0% ({currencySymbol} 0.00)</span>
            </div>
            {data.secondaryCurrencyTotal && (
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Domestic Valuation:</span>
                <span className="font-mono font-bold">{data.secondaryCurrencyTotal}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-1.5 font-black text-xs text-indigo-950">
              <span>NET PAYABLE TOTAL:</span>
              <span className="font-mono">{currencySymbol} {netOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="text-[8px] text-slate-400 text-center mt-2">
            Euro Footwear Procurement Order • SMRITI Universal Document Engine
          </div>
        </div>
      </div>

      {/* 5. PO AUTHORIZATION & SUPPLIER ACKNOWLEDGEMENT */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-300 text-[8.5px]">
        {[
          ["Prepared By", data.purchaser || "Procurement User"],
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

      {/* 6. MANDATORY SMRITI RETAIL OS BRANDING FOOTER */}
      <div className="flex justify-between items-center text-[8.5px] text-slate-500 border-t border-slate-300 pt-2 mt-4 font-mono">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-950 text-white font-black px-1.5 py-0.5 rounded text-[8px] tracking-wider">SMRITI</span>
            <span className="font-extrabold text-slate-800">SMRITI Retail OS</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Universal Enterprise Procurement Engine</span>
          </div>
          <div className="text-slate-500">
            This purchase order is not a tax invoice. Goods are subject to inspection and acceptance against the PO terms.
          </div>
        </div>
        <div className="text-right space-y-1">
          <div>
            <span>PO: <strong className="text-slate-700">{data.poNumber || "—"}</strong></span>
            <span className="mx-2">•</span>
            <span>Status: <strong className="text-indigo-900">{data.documentStatus || "DRAFT"}</strong></span>
          </div>
          <div>
            <span>Payment: {data.paymentTerms || "30 Days"}</span>
            <span className="mx-2">•</span>
            <span>Purchaser: {data.purchaser || "—"}</span>
          </div>
          <div>
            <span>Supplier Ref: {data.supplierReference || "—"}</span>
            <span className="mx-2">•</span>
            <span>Due: {data.deliveryDate || "—"}</span>
          </div>
        </div>
      </div>
      <div className="text-center border-t border-slate-200 pt-1.5 mt-1 text-[8px] font-mono">
        <div className="font-bold text-indigo-900">SUBJECT TO NAGPUR JURISDICTION</div>
        <div className="text-slate-600 mt-0.5">SMRITISYS | SMRITI Retail OS | Enterprise Commerce Suite | smritibooks.com</div>
      </div>
    </div>
  );
};

export default FootwearPurchaseOrderA4;
