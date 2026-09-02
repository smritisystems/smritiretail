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

import React, { useState, useEffect } from "react";
import { User, MapPin, Store, FileText, Tag, Layers, CheckSquare, Sliders } from "lucide-react";
import { RetailCustomerRecord, CustomerPriceGroup } from "./types.ts";
import { getCustomerPriceGroups } from "../../services/customerStore.ts";
import { SmritiCustomerPriceGroupModal } from "./CustPriceGroupDlg.tsx";

interface SmritiCustomerFormTabProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  onOpenMailingModal: () => void;
}

export const SmritiCustomerFormTab: React.FC<SmritiCustomerFormTabProps> = ({
  customer,
  onChange,
  onOpenMailingModal
}) => {
  const primaryAddress = customer.mailingAddresses[0];
  const [priceGroups, setPriceGroups] = useState<CustomerPriceGroup[]>(() => getCustomerPriceGroups());
  const [showPriceGroupModal, setShowPriceGroupModal] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      setPriceGroups(getCustomerPriceGroups());
    };
    window.addEventListener("smriti_customer_price_groups_updated", handleUpdate);
    return () => window.removeEventListener("smriti_customer_price_groups_updated", handleUpdate);
  }, []);

  return (
    <div className="space-y-5 text-xs">
      
      {/* 1. General Details & Classification in 2-column card layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Left Card: General Details */}
        <div className="bg-white dark:bg-[#1e2224] border border-[#c6c6cd] dark:border-[#45464d] rounded-2xl p-4 shadow-xs space-y-3.5">
          <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
            <User size={15} /> General Details
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Customer Code
              </label>
              <input
                type="text"
                readOnly
                value={customer.code || "Generating..."}
                data-field-key="customer_code"
                className="w-full p-2 bg-[#f2f4f6] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono font-bold text-xs text-[#00355f] dark:text-[#8ebdf9] cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Customer Name*
              </label>
              <input
                type="text"
                value={customer.name}
                data-field-key="customer_name"
                onChange={(e) => onChange("name", e.target.value)}
                placeholder="e.g. Farida Jameel"
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-bold text-xs outline-none focus:border-[#00355f]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block">
                  Customer Price Group
                </label>
                <button
                  type="button"
                  onClick={() => setShowPriceGroupModal(true)}
                  className="text-[10px] text-[#00355f] dark:text-[#8ebdf9] font-bold hover:underline flex items-center gap-1"
                >
                  <Sliders size={11} /> Manage Groups
                </button>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={customer.priceGroup?.split("#")[0] || customer.priceGroup}
                  data-field-key="customer_price_group"
                  onChange={e => {
                    const code = e.target.value;
                    const grp = priceGroups.find(p => p.code === code || `${p.code}#${p.description}` === code);
                    const val = grp ? `${grp.code}#${grp.description}` : code;
                    onChange("priceGroup", val);
                    if (grp) {
                      onChange("paymentTerm", grp.paymentTerms);
                      onChange("creditDays", grp.creditDays);
                      onChange("creditLimit", grp.creditLimit);
                      onChange("destinationTaxType", grp.destTaxType);
                      onChange("allowCreditInvoice", grp.allowCreditInvoice);
                      onChange("allowCashBill", grp.allowCashInvoice);
                      onChange("allowMiscIssue", grp.allowMiscIssue);
                    }
                  }}
                  className="flex-1 p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-semibold outline-none focus:border-[#00355f]"
                >
                  {priceGroups.map(pg => (
                    <option key={pg.code} value={pg.code}>
                      {pg.code} - {pg.description} ({pg.paymentTerms}, {pg.creditDays} Days)
                    </option>
                  ))}
                  {/* Fallback legacy option */}
                  {!priceGroups.some(pg => pg.code === (customer.priceGroup?.split("#")[0] || customer.priceGroup)) && customer.priceGroup && (
                    <option value={customer.priceGroup?.split("#")[0] || customer.priceGroup}>
                      {customer.priceGroup}
                    </option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setShowPriceGroupModal(true)}
                  className="px-2.5 py-1.5 bg-[#f2f4f6] dark:bg-[#2d3133] hover:bg-[#e1e4e8] dark:hover:bg-[#3d4246] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-[#00355f] dark:text-[#8ebdf9] font-bold text-xs shadow-2xs transition"
                  title="Configure Customer Price Groups"
                >
                  [...]
                </button>
              </div>
            </div>

            {/* Modal instance */}
            <SmritiCustomerPriceGroupModal
              isOpen={showPriceGroupModal}
              onClose={() => setShowPriceGroupModal(false)}
              selectedGroupCode={customer.priceGroup?.split("#")[0] || "CPP"}
              onSelectGroup={(grp) => {
                onChange("priceGroup", `${grp.code}#${grp.description}`);
                onChange("paymentTerm", grp.paymentTerms);
                onChange("creditDays", grp.creditDays);
                onChange("creditLimit", grp.creditLimit);
                onChange("destinationTaxType", grp.destTaxType);
                onChange("allowCreditInvoice", grp.allowCreditInvoice);
                onChange("allowCashBill", grp.allowCashInvoice);
                onChange("allowMiscIssue", grp.allowMiscIssue);
              }}
            />

            {/* Mail List Info Box */}
            <div className="bg-[#f7f9fb] dark:bg-[#2d3133]/40 border border-[#c6c6cd] dark:border-[#45464d] p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0] block">
                  Mail List Info ({customer.mailingAddresses.length} Address{customer.mailingAddresses.length === 1 ? "" : "es"})
                </span>
                <p className="text-[11px] text-[#191c1e] dark:text-white font-medium truncate max-w-[240px] mt-0.5">
                  {primaryAddress ? `${primaryAddress.locality || primaryAddress.city || "Address Setup"} (${primaryAddress.mobilePhone || "No Mobile"})` : "No primary address"}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenMailingModal}
                className="px-3 py-1.5 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] rounded-lg font-bold text-xs flex items-center gap-1 transition shadow-2xs"
              >
                <MapPin size={12} /> Manage Address
              </button>
            </div>
          </div>
        </div>

        {/* Classification Details Section */}
        <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
            <Tag size={15} /> Classification Details
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Religion
              </label>
              <select
                value={customer.religion}
                onChange={e => onChange("religion", e.target.value)}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
              >
                <option value="Muslim">Muslim</option>
                <option value="Hindu">Hindu</option>
                <option value="Christian">Christian</option>
                <option value="Sikh">Sikh</option>
                <option value="Jain">Jain</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Ethnicity
              </label>
              <select
                value={customer.ethnicity}
                onChange={e => onChange("ethnicity", e.target.value)}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
              >
                <option value="Asian">Asian</option>
                <option value="Arab">Arab</option>
                <option value="European">European</option>
                <option value="Australian">Australian</option>
                <option value="American">American</option>
                <option value="African">African</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Age Group
              </label>
              <select
                value={customer.ageGroup}
                onChange={e => onChange("ageGroup", e.target.value)}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
              >
                <option value="<20">&lt;20</option>
                <option value=">=20 - <35">&gt;=20 - &lt;35</option>
                <option value=">=35 - <45">&gt;=35 - &lt;45</option>
                <option value=">=45 - <60">&gt;=45 - &lt;60</option>
                <option value=">=60">&gt;=60</option>
              </select>
            </div>

            <div>
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Profession
              </label>
              <input
                type="text"
                value={customer.profession}
                data-field-key="customer_name"
                onChange={(e) => onChange("profession", e.target.value)}
                placeholder="e.g. Architect, Doctor, Teacher"
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
                Customer Type
              </label>
              <select
                value={customer.customerType}
                data-field-key="customer_type"
                onChange={e => {
                  const val = e.target.value;
                  onChange("customerType", val);
                  if (val === "Corporate" || val === "Wholesale" || val === "Distribution") {
                    onChange("environment", val);
                  }
                }}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-semibold"
              >
                <option value="Retail">Retail Shopper</option>
                <option value="Corporate">Corporate / B2B</option>
                <option value="VIP">VIP Privilege Account</option>
                <option value="Wholesale">Wholesale Trader</option>
                <option value="Walk-In">Walk-In Occasional</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Profile Details (Notes & Preferences) */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-2">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2">
          <FileText size={15} /> Profile Details &amp; Shopper Preferences
        </h3>
        <textarea
          rows={3}
          value={customer.profileNotes}
          onChange={e => onChange("profileNotes", e.target.value)}
          placeholder="Document customer size preferences, favorite brands, tailored styling notes, allergy alerts, or special service requests..."
          className="w-full p-3 bg-[#f7f9fb] dark:bg-[#131b2e] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl text-xs outline-none focus:bg-white dark:focus:bg-[#191c1e] focus:border-[#00355f] leading-relaxed"
        />
      </div>

      {/* 3. Details of Shoper (Environment & File Integration) */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Store size={15} /> Details of Shoper
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Comp Code
            </label>
            <input
              type="text"
              value={customer.companyCode}
              data-field-key="customer_code"
              onChange={(e) => onChange("companyCode", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Environment
            </label>
            <select
              value={customer.environment}
              data-field-key="customer_environment"
              onChange={e => onChange("environment", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-semibold"
            >
              <option value="Retail">Retail</option>
              <option value="Corporate">Corporate</option>
              <option value="Distribution">Distribution</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Flat File Format
            </label>
            <select
              value={customer.flatFileFormat}
              onChange={e => onChange("flatFileFormat", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
            >
              <option value="GUI with Delimiter Format">GUI with Delimiter Format</option>
              <option value="Fixed Length Format">Fixed Length Format</option>
              <option value="XML Format">XML Format</option>
              <option value="JSON Format">JSON Format</option>
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Delimiter
            </label>
            <input
              type="text"
              value={customer.delimiter}
              data-field-key="reference_no"
              onChange={(e) => onChange("delimiter", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs text-center font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Buying Factor
            </label>
            <input
              type="number"
              step="0.01"
              value={customer.buyingFactor}
              data-field-key="cost_price"
              onChange={(e) => onChange("buyingFactor", parseFloat(e.target.value) || 1)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Selling Factor
            </label>
            <input
              type="number"
              step="0.01"
              value={customer.sellingFactor}
              data-field-key="selling_price"
              onChange={(e) => onChange("sellingFactor", parseFloat(e.target.value) || 1)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs"
            />
          </div>

          <div className="flex items-end pb-2 md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customer.isTaxInclusive}
                onChange={(e) => onChange("isTaxInclusive", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-bold text-xs text-[#00355f] dark:text-[#8ebdf9]">
                Tax Inclusive Pricing Applicable
              </span>
            </label>
          </div>
        </div>
      </div>

    </div>
  );
};
