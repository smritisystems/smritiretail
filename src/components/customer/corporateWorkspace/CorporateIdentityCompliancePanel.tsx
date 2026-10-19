/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Identity & Compliance Panel (Tab 1)
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState } from "react";
import {
  Building2,
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Info
} from "lucide-react";
import { RetailCustomerRecord, CustomerGSTRegistrationOption } from "../types.ts";
import { AddEditGstModal, GstRegistrationEntry } from "./AddEditGstModal.tsx";

interface CorporateIdentityCompliancePanelProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  gstRegistrations: GstRegistrationEntry[];
  onSaveGstRegistration: (reg: GstRegistrationEntry) => void;
  onDeleteGstRegistration: (regId: string) => void;
  onOpenPriceListModal?: () => void;
  onOpenGroupsModal?: () => void;
}

export const CorporateIdentityCompliancePanel: React.FC<CorporateIdentityCompliancePanelProps> = ({
  customer,
  onChange,
  gstRegistrations,
  onSaveGstRegistration,
  onDeleteGstRegistration,
  onOpenPriceListModal,
  onOpenGroupsModal,
}) => {
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [editingGst, setEditingGst] = useState<GstRegistrationEntry | null>(null);

  const descLength = (customer.businessDescription || customer.profileNotes || "").length;

  const handleOpenAddGst = () => {
    setEditingGst(null);
    setIsGstModalOpen(true);
  };

  const handleOpenEditGst = (reg: GstRegistrationEntry) => {
    setEditingGst(reg);
    setIsGstModalOpen(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
      
      {/* ── CARD 1: Corporate Identity ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Card Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Building2 size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
            Corporate Identity
          </h3>
        </div>

        {/* Fields */}
        <div className="space-y-3.5">
          
          {/* Row 1: Customer Code & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Customer Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                readOnly
                value={customer.code || "RRL-001"}
                className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-xs text-slate-800 dark:text-slate-200 cursor-not-allowed outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Status
              </label>
              <div className="relative">
                <select
                  value={customer.status || "Active"}
                  onChange={e => onChange("status", e.target.value)}
                  className="w-full p-2 pl-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
                <span
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                    (customer.status || "Active").toLowerCase() === "active" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Customer Name & Short Name */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customer.name}
                onChange={e => onChange("name", e.target.value)}
                placeholder="e.g. Reliance Retail Limited"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:bg-white focus:border-[#00355f] outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Short Name
              </label>
              <input
                type="text"
                value={customer.shortName || (customer.code?.startsWith("RRL") ? "RRL" : "")}
                onChange={e => onChange("shortName", e.target.value)}
                placeholder="e.g. RRL"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
              />
            </div>
          </div>

          {/* Row 3: Legal Entity Type & Corporate Parent */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Legal Entity Type
              </label>
              <select
                value={customer.legalEntityType || "Private Limited Company"}
                onChange={e => onChange("legalEntityType", e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="Private Limited Company">Private Limited Company</option>
                <option value="Public Limited Company">Public Limited Company</option>
                <option value="Partnership Firm">Partnership Firm</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                <option value="Government / PSU">Government / PSU</option>
                <option value="Trust / Society">Trust / Society</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Corporate Parent (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customer.corporateParent || customer.primaryAccountName || (customer.name?.toLowerCase().includes("reliance") ? "Reliance Industries Limited" : "")}
                  onChange={e => onChange("corporateParent", e.target.value)}
                  placeholder="e.g. Reliance Industries Limited"
                  className="w-full p-2 pr-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white focus:border-[#00355f] outline-none font-medium"
                />
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Row 4: Customer Group & Account Manager */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Customer Group
                </label>
                {onOpenGroupsModal && (
                  <button
                    type="button"
                    onClick={onOpenGroupsModal}
                    className="text-[10px] font-semibold text-[#005fb8] hover:underline"
                  >
                    Manage Groups
                  </button>
                )}
              </div>
              <select
                value={customer.customerGroupId || customer.customer_group_id || "CG-Retail"}
                onChange={e => {
                  onChange("customerGroupId", e.target.value);
                  onChange("customer_group_id", e.target.value);
                }}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="CG-Retail">CG-Retail</option>
                <option value="CG-Corporate">CG-Corporate</option>
                <option value="CG-Wholesale">CG-Wholesale</option>
                <option value="CG-LargeRetail">CG-LargeRetail</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Account Manager
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customer.accountManager || (customer.name?.toLowerCase().includes("reliance") ? "Suresh Patil" : "")}
                  onChange={e => onChange("accountManager", e.target.value)}
                  placeholder="e.g. Suresh Patil"
                  className="w-full p-2 pr-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white focus:border-[#00355f] outline-none"
                />
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Row 5: Primary Price List */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Primary Price List
              </label>
              {onOpenPriceListModal && (
                <button
                  type="button"
                  onClick={onOpenPriceListModal}
                  className="text-[10px] font-semibold text-[#005fb8] hover:underline"
                >
                  View Price Lists
                </button>
              )}
            </div>
            <select
              value={customer.priceGroup || "CORP#Standard Corporate"}
              onChange={e => onChange("priceGroup", e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
            >
              <option value="CORP#Standard Corporate">CORP - Standard Corporate</option>
              <option value="VIP#Platinum Retail">VIP - Platinum Retail</option>
              <option value="WS#Standard Wholesale">WS - Standard Wholesale</option>
              <option value="DIST#Tier 1 Distribution">DIST - Tier 1 Distribution</option>
            </select>
          </div>

        </div>

      </div>

      {/* ── CARD 2: Legal & Tax Details ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Card Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <FileText size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
            Legal &amp; Tax Details
          </h3>
        </div>

        {/* Identifiers Row: PAN, TAN, IEC */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              PAN Number
            </label>
            <input
              type="text"
              maxLength={10}
              value={customer.panNumber || ""}
              onChange={e => onChange("panNumber", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-xs uppercase focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              TAN Number
            </label>
            <input
              type="text"
              maxLength={10}
              value={customer.tanNumber || (customer.name?.toLowerCase().includes("reliance") ? "MUMA12345G" : "")}
              onChange={e => onChange("tanNumber", e.target.value.toUpperCase())}
              placeholder="MUMA12345G"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs uppercase focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              IEC Number
            </label>
            <input
              type="text"
              maxLength={10}
              value={customer.iecNumber || ""}
              onChange={e => onChange("iecNumber", e.target.value)}
              placeholder="e.g. 0301123456"
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:bg-white focus:border-[#00355f] outline-none"
            />
          </div>
        </div>

        {/* GST Registrations Table Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              GST Registrations
            </span>
            <button
              type="button"
              onClick={handleOpenAddGst}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#005fb8] dark:text-[#8ebdf9] border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1 transition"
            >
              <Plus size={13} /> Add GST Registration
            </button>
          </div>

          {/* Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-2.5 w-8">#</th>
                  <th className="p-2.5">GSTIN</th>
                  <th className="p-2.5">State</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gstRegistrations.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item.gstin}
                      {item.isPrimary && (
                        <span className="ml-1 text-[9px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-sans font-bold">
                          Primary
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.state}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.registrationType}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditGst(item)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition"
                          title="Edit GSTIN"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGstRegistration(item.id || item.gstin)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Delete GSTIN"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {gstRegistrations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                      No GST registrations linked. Click "+ Add GST Registration" to add.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── CARD 3: Business Information ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        
        {/* Card Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Info size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
            Business Information
          </h3>
        </div>

        {/* Fields */}
        <div className="space-y-3.5">
          
          {/* Industry & Business Nature */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Industry
              </label>
              <select
                value={customer.industry || "Retail - Multi Brand"}
                onChange={e => onChange("industry", e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="Retail - Multi Brand">Retail - Multi Brand</option>
                <option value="Retail - Single Brand">Retail - Single Brand</option>
                <option value="FMCG & Groceries">FMCG & Groceries</option>
                <option value="Apparel & Fashion">Apparel & Fashion</option>
                <option value="Electronics & IT">Electronics & IT</option>
                <option value="Pharma & Healthcare">Pharma & Healthcare</option>
                <option value="Hospitality">Hospitality</option>
                <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Business Nature
              </label>
              <select
                value={customer.businessNature || "Retail Chain"}
                onChange={e => onChange("businessNature", e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="Retail Chain">Retail Chain</option>
                <option value="Distributor / Wholesaler">Distributor / Wholesaler</option>
                <option value="Direct Retailer">Direct Retailer</option>
                <option value="Franchise Operator">Franchise Operator</option>
                <option value="Supermarket Chain">Supermarket Chain</option>
                <option value="Hypermarket">Hypermarket</option>
                <option value="Institutional Buyer">Institutional Buyer</option>
              </select>
            </div>
          </div>

          {/* Annual Turnover & Website */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Annual Turnover (INR)
              </label>
              <select
                value={customer.annualTurnover || "> 1,000 Crore"}
                onChange={e => onChange("annualTurnover", e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
              >
                <option value="< 10 Crore">&lt; 10 Crore</option>
                <option value="10 - 50 Crore">10 - 50 Crore</option>
                <option value="50 - 250 Crore">50 - 250 Crore</option>
                <option value="250 - 1,000 Crore">250 - 1,000 Crore</option>
                <option value="> 1,000 Crore">&gt; 1,000 Crore</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Website
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={customer.website || (customer.name?.toLowerCase().includes("reliance") ? "https://www.ril.com" : "")}
                  onChange={e => onChange("website", e.target.value)}
                  placeholder="https://www.company.com"
                  className="w-full p-2 pr-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:bg-white focus:border-[#00355f] outline-none"
                />
                {customer.website && (
                  <a
                    href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#005fb8] hover:text-[#0f4c81] p-1"
                    title="Open website in new tab"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Business Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Business Description
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {descLength}/500
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              value={customer.businessDescription || customer.profileNotes || (customer.name?.toLowerCase().includes("reliance") ? "Leading retail chain operating multiple formats across India including fashion, electronics, grocery and lifestyle." : "")}
              onChange={e => {
                onChange("businessDescription", e.target.value);
                onChange("profileNotes", e.target.value);
              }}
              placeholder="Provide an overview of corporate business model, store operations, and format portfolio..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs leading-relaxed focus:bg-white focus:border-[#00355f] outline-none resize-none"
            />
          </div>

        </div>

      </div>

      {/* Sub-Modal: Add/Edit GST Registration */}
      <AddEditGstModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        initialData={editingGst}
        onSave={onSaveGstRegistration}
      />

    </div>
  );
};
