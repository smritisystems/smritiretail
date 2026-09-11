/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Building2, FileText, Award } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";

interface VendorIdentityTabProps {
  vendor: VendorDetail;
  onChange: (field: string, value: any) => void;
  isEditing: boolean;
}

const VendorIdentityTabBase: React.FC<VendorIdentityTabProps> = ({ vendor, onChange, isEditing }) => {
  return (
    <div className="space-y-6">
      {/* Entity Profile Section */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
          <Building2 size={16} className="text-indigo-400" />
          <span>Legal Entity Identification</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Legal Company Name *</label>
            <input
              type="text"
              value={vendor.legalName}
              disabled={!isEditing}
              onChange={(e) => onChange("legalName", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              placeholder="e.g. Acme Textile Mills Private Limited"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Trade / Brand Name</label>
            <input
              type="text"
              value={vendor.tradeName || ""}
              disabled={!isEditing}
              onChange={(e) => onChange("tradeName", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              placeholder="e.g. Acme Fabrics"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Constitution</label>
            <select
              value={vendor.partyType}
              disabled={!isEditing}
              onChange={(e) => onChange("partyType", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="ORGANIZATION">Private / Public Limited (Company)</option>
              <option value="PARTNERSHIP">Partnership / LLP</option>
              <option value="PROPRIETORSHIP">Sole Proprietorship</option>
              <option value="INDIVIDUAL">Individual / Freelancer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statutory & Taxation Section */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
          <ShieldCheck size={16} className="text-indigo-400" />
          <span>Statutory Tax & Regulatory Identification</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">GSTIN Number (15-digit)</label>
            <div className="relative">
              <input
                type="text"
                maxLength={15}
                value={vendor.gstin || ""}
                disabled={!isEditing}
                onChange={(e) => onChange("gstin", e.target.value.toUpperCase())}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                placeholder="27AABCA1234A1Z5"
              />
              {vendor.gstin && vendor.gstin.length === 15 && (
                <CheckCircle2 size={16} className="text-emerald-400 absolute right-3 top-2.5" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">State Code: {vendor.gstin ? vendor.gstin.slice(0, 2) : "—"}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">PAN Number (Permanent Account No)</label>
            <input
              type="text"
              maxLength={10}
              value={vendor.pan || ""}
              disabled={!isEditing}
              onChange={(e) => onChange("pan", e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              placeholder="AABCA1234A"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Mandatory for TDS compliance under Sec 194Q</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">GST Tax Treatment</label>
            <select
              value={vendor.commercial?.taxTreatment || "REGISTERED_REGULAR"}
              disabled={!isEditing}
              onChange={(e) => onChange("commercial.taxTreatment", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="REGISTERED_REGULAR">Registered Business - Regular</option>
              <option value="REGISTERED_COMPOSITION">Registered Business - Composition</option>
              <option value="UNREGISTERED">Unregistered Business / Consumer</option>
              <option value="OVERSEAS">Overseas / SEZ Unit</option>
            </select>
          </div>
        </div>
      </div>

      {/* MSMED & Regulatory Compliance Section */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
          <Award size={16} className="text-amber-400" />
          <span>MSME & Section 43B(h) Statutory Compliance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">MSME Udyam Registration No</label>
            <input
              type="text"
              value={vendor.commercial?.msmeRegistrationNo || ""}
              disabled={!isEditing}
              onChange={(e) => onChange("commercial.msmeRegistrationNo", e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              placeholder="UDYAM-MH-01-0012345"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">MSME Enterprise Classification</label>
            <select
              value={vendor.commercial?.msmeCategory || "NOT_APPLICABLE"}
              disabled={!isEditing}
              onChange={(e) => onChange("commercial.msmeCategory", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              <option value="NOT_APPLICABLE">Not Applicable (Medium / Large Enterprise)</option>
              <option value="MICRO">Micro Enterprise (Investment &lt; ₹1 Cr, Turnover &lt; ₹5 Cr)</option>
              <option value="SMALL">Small Enterprise (Investment &lt; ₹10 Cr, Turnover &lt; ₹50 Cr)</option>
              <option value="MEDIUM">Medium Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Mandate Guard</label>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
              {vendor.commercial?.msmeCategory === "MICRO" || vendor.commercial?.msmeCategory === "SMALL" ? (
                <span className="text-amber-300 font-semibold">Strict 45-Day Section 43B(h) Active</span>
              ) : (
                <span className="text-slate-400">Standard contractual payment terms apply</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VendorIdentityTab = withCapability(VendorIdentityTabBase, {
  entity: "vendor",
  capability: "vendor.identity",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorIdentityTab;

