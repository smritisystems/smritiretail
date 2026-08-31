/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { CreditCard, Truck, Percent, ShieldCheck, FileCheck, Landmark } from "lucide-react";
import { RetailCustomerRecord } from "./types.ts";

interface SmritiCustomerAdditionalDetailsTabProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
}

export const SmritiCustomerAdditionalDetailsTab: React.FC<SmritiCustomerAdditionalDetailsTabProps> = ({
  customer,
  onChange
}) => {
  const creditPercentUsed = customer.creditLimit > 0 
    ? Math.min(Math.round((customer.creditUsed / customer.creditLimit) * 100), 100) 
    : 0;

  return (
    <div className="space-y-5 text-xs">
      
      {/* 1. Payment & Credit Policy Details */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <CreditCard size={15} /> Payment &amp; Credit Policy
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Payment Category
            </label>
            <select
              value={customer.paymentCategory}
              onChange={e => onChange("paymentCategory", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-bold"
            >
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
              <option value="CARD">CARD (DEBIT/CREDIT)</option>
              <option value="UPI">UPI / QR CODE</option>
              <option value="NETBANKING">NETBANKING</option>
              <option value="CHEQUE">CHEQUE</option>
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Payment Term
            </label>
            <input
              type="text"
              value={customer.paymentTerm}
              onChange={e => onChange("paymentTerm", e.target.value)}
              placeholder="e.g. Net 30 Days"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Credit Limit (INR)
            </label>
            <input
              type="number"
              value={customer.creditLimit}
              onChange={e => onChange("creditLimit", parseFloat(e.target.value) || 0)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold text-[#00355f] dark:text-[#8ebdf9]"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Credit Days
            </label>
            <input
              type="number"
              value={customer.creditDays}
              onChange={e => onChange("creditDays", parseInt(e.target.value) || 0)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
            />
          </div>
        </div>

        {/* Credit Utilization Bar */}
        <div className="bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#c6c6cd] dark:border-[#45464d] p-3 rounded-xl flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1 text-[11px]">
              <span className="font-bold text-[#515f74] dark:text-[#bec6e0]">
                Credit Utilization (₹{customer.creditUsed.toLocaleString("en-IN")} / ₹{customer.creditLimit.toLocaleString("en-IN")})
              </span>
              <span className="font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{creditPercentUsed}%</span>
            </div>
            <div className="w-full h-2 bg-[#e0e3e5] dark:bg-[#45464d] rounded-full overflow-hidden">
              <div
                style={{ width: `${creditPercentUsed}%` }}
                className={`h-full transition-all ${
                  creditPercentUsed > 85 ? "bg-[#ba1a1a]" : creditPercentUsed > 50 ? "bg-[#eab308]" : "bg-[#0c9488]"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Logistics, Transport & Banking */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Truck size={15} /> Transport, Logistics &amp; Banking
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Trans. Mode
            </label>
            <select
              value={customer.transportMode}
              onChange={e => onChange("transportMode", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs"
            >
              <option value="By-Road">By-Road</option>
              <option value="Air">Air Express</option>
              <option value="Rail">Rail Express</option>
              <option value="Sea">Sea Cargo</option>
              <option value="Express Courier">Express Courier</option>
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Trans. Code
            </label>
            <input
              type="text"
              value={customer.transportCode}
              onChange={e => onChange("transportCode", e.target.value)}
              placeholder="e.g. VRL, BLUE DART"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Transit Days
            </label>
            <input
              type="number"
              value={customer.transitDays}
              onChange={e => onChange("transitDays", parseInt(e.target.value) || 0)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Bank Code
            </label>
            <input
              type="text"
              value={customer.bankCode}
              onChange={e => onChange("bankCode", e.target.value)}
              placeholder="e.g. HDFC000123"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Bank Location
            </label>
            <input
              type="text"
              value={customer.bankLocation}
              onChange={e => onChange("bankLocation", e.target.value)}
              placeholder="e.g. MG Road, Bangalore"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Price & Tax Factors & Transaction Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Price and Tax Factors */}
        <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
            <Percent size={15} /> Price &amp; Tax Factors
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Retail Factor
              </label>
              <input
                type="number"
                step="0.01"
                value={customer.retailFactor}
                onChange={e => onChange("retailFactor", parseFloat(e.target.value) || 1)}
                className="w-full p-2 bg-[#f2f4f6] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Dealer Factor
              </label>
              <input
                type="number"
                step="0.01"
                value={customer.dealerFactor}
                onChange={e => onChange("dealerFactor", parseFloat(e.target.value) || 0.85)}
                className="w-full p-2 bg-[#f2f4f6] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Dest. Tax Type
              </label>
              <select
                value={customer.destinationTaxType}
                onChange={e => onChange("destinationTaxType", e.target.value)}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-semibold"
              >
                <option value="318#GST_RETAIL">318#GST_RETAIL</option>
                <option value="318#STAPLES">318#STAPLES</option>
                <option value="000#EXEMPTED">000#EXEMPTED</option>
                <option value="999#SEZ_ZERO_RATED">999#SEZ_ZERO_RATED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transaction Checkboxes */}
        <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
            <ShieldCheck size={15} /> Transaction Permissions
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#eceef0] dark:border-[#2d3133] cursor-pointer">
              <input
                type="checkbox"
                checked={customer.allowCashBill}
                onChange={e => onChange("allowCashBill", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Allow Cash Bill</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#eceef0] dark:border-[#2d3133] cursor-pointer">
              <input
                type="checkbox"
                checked={customer.allowDcGen}
                onChange={e => onChange("allowDcGen", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Allow DC Gen.</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#eceef0] dark:border-[#2d3133] cursor-pointer">
              <input
                type="checkbox"
                checked={customer.allowCreditInvoice}
                onChange={e => onChange("allowCreditInvoice", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Allow Credit Invoice</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#eceef0] dark:border-[#2d3133] cursor-pointer">
              <input
                type="checkbox"
                checked={customer.allowMiscIssue}
                onChange={e => onChange("allowMiscIssue", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Allow Misc. Issue</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#eceef0] dark:border-[#2d3133] cursor-pointer col-span-2">
              <input
                type="checkbox"
                checked={customer.allowMiscReceipts}
                onChange={e => onChange("allowMiscReceipts", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Allow Misc. Receipts</span>
            </label>
          </div>
        </div>

      </div>

      {/* 4. Tax Numbers & Compliance (LST / CST / GSTIN / Forms) */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <FileCheck size={15} /> Commercial Tax Identifiers &amp; Forms
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              GSTIN / Tax ID
            </label>
            <input
              type="text"
              value={customer.gstin}
              onChange={e => onChange("gstin", e.target.value)}
              placeholder="29AABCT1332L1ZV"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              PAN Number
            </label>
            <input
              type="text"
              value={customer.panNumber}
              onChange={e => onChange("panNumber", e.target.value)}
              placeholder="ABCDE1234F"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              LST Number &amp; Date
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customer.lstNumber}
                onChange={e => onChange("lstNumber", e.target.value)}
                placeholder="LST-001"
                className="w-1/2 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded-lg font-mono text-xs"
              />
              <input
                type="date"
                value={customer.lstDate}
                onChange={e => onChange("lstDate", e.target.value)}
                className="w-1/2 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              CST Number &amp; Date
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customer.cstNumber}
                onChange={e => onChange("cstNumber", e.target.value)}
                placeholder="CST-001"
                className="w-1/2 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded-lg font-mono text-xs"
              />
              <input
                type="date"
                value={customer.cstDate}
                onChange={e => onChange("cstDate", e.target.value)}
                className="w-1/2 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Tax Form Applicability */}
          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customer.isPreSaleFormApplicable}
                onChange={e => onChange("isPreSaleFormApplicable", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Pre-Sale Form Applicable</span>
            </label>
            {customer.isPreSaleFormApplicable && (
              <input
                type="text"
                placeholder="Form Name (e.g. Form C)"
                value={customer.preSaleFormName}
                onChange={e => onChange("preSaleFormName", e.target.value)}
                className="flex-1 p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
              />
            )}
          </div>

          <div className="md:col-span-2 flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customer.isPostSaleFormApplicable}
                onChange={e => onChange("isPostSaleFormApplicable", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-semibold text-xs">Post-Sale Form Applicable</span>
            </label>
            {customer.isPostSaleFormApplicable && (
              <input
                type="text"
                placeholder="Form Name (e.g. Form F)"
                value={customer.postSaleFormName}
                onChange={e => onChange("postSaleFormName", e.target.value)}
                className="flex-1 p-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs"
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
