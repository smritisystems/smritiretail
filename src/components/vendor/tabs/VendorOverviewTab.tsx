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
import { 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  MapPin, 
  FileText,
  DollarSign,
  TrendingUp,
  Award
} from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";

interface VendorOverviewTabProps {
  vendor: VendorDetail;
  onNavigateTab: (tabId: string) => void;
}

const VendorOverviewTabBase: React.FC<VendorOverviewTabProps> = ({ vendor, onNavigateTab }) => {
  const primaryBank = vendor.bankAccounts.find(b => b.isPrimary) || vendor.bankAccounts[0];
  const primaryContact = vendor.contacts.find(c => c.isPrimary) || vendor.contacts[0];
  const primaryAddress = vendor.addresses.find(a => a.isPrimary) || vendor.addresses[0];

  const payables = vendor.commercial?.outstandingLiability || 0;
  const isMsme = Boolean(vendor.commercial?.msmeRegistrationNo);
  const termsDays = vendor.commercial?.paymentTermsDays || 30;

  return (
    <div className="space-y-6">
      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Payables</div>
            <div className={`text-xl font-black font-mono mt-1 ${payables > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              ₹{payables.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Terms: Net {termsDays} Days</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Commercial Status</div>
            <div className="text-base font-bold text-indigo-400 mt-1 flex items-center space-x-1.5">
              <span>{vendor.commercial?.commercialClassification || "APPROVED"}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{vendor.commercial?.supplierType || "DISTRIBUTOR"}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Award size={20} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">MSME Compliance</div>
            <div className={`text-base font-bold mt-1 ${isMsme ? "text-amber-400" : "text-slate-400"}`}>
              {isMsme ? vendor.commercial?.msmeCategory || "REGISTERED" : "Not Applicable"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isMsme ? "Section 43B(h) 45d Guard" : "Standard credit terms"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bank Coordinates</div>
            <div className="text-base font-bold text-teal-400 mt-1 truncate max-w-[140px]">
              {primaryBank ? primaryBank.bankName : "No Account"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {primaryBank ? `A/C: •••• ${primaryBank.accountNumber.slice(-4)}` : "Disbursement unconfigured"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* MSME Statutory Warning Banner if applicable */}
      {isMsme && (
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start space-x-3 text-xs text-amber-200">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">MSMED Act 2006 & Section 43B(h) Active:</span> This vendor is registered as a Micro/Small enterprise (Udyam: <span className="font-mono">{vendor.commercial?.msmeRegistrationNo}</span>). Outstanding dues must be discharged within {termsDays} days to ensure statutory income tax deductibility.
          </div>
        </div>
      )}

      {/* 2-Column Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statutory Identity Profile */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span>Statutory & Tax Identity</span>
            </div>
            <button 
              onClick={() => onNavigateTab("identity")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Edit Details →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Legal Entity Name</span>
              <span className="text-slate-200 font-semibold">{vendor.legalName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Trade Name</span>
              <span className="text-slate-200 font-semibold">{vendor.tradeName || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">GSTIN Registration</span>
              <span className="font-mono text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded inline-block mt-0.5">
                {vendor.gstin || "Unregistered"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">PAN Number</span>
              <span className="font-mono text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded inline-block mt-0.5">
                {vendor.pan || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">TDS Applicability</span>
              <span className="text-slate-300">Sec {vendor.commercial?.tdsSection || "194Q"} ({vendor.commercial?.tdsRate || 0.1}%)</span>
            </div>
            <div>
              <span className="text-slate-500 block">Verification Status</span>
              <span className="inline-flex items-center space-x-1 text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Compliant</span>
              </span>
            </div>
          </div>
        </div>

        {/* Primary Contact & Location */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 text-sm font-bold text-white">
              <Users size={16} className="text-indigo-400" />
              <span>Key Contacts & Location</span>
            </div>
            <button 
              onClick={() => onNavigateTab("contacts")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Manage Contacts →
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {primaryContact ? (
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span>{primaryContact.contactName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {primaryContact.contactCategory}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{primaryContact.designation || "Primary Representative"}</div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-300">
                  <div>{primaryContact.mobile || primaryContact.phone || "—"}</div>
                  <div className="text-slate-500 text-[10px]">{primaryContact.email || ""}</div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic">No specific contact person recorded.</div>
            )}

            <div className="pt-1 flex items-start space-x-2 text-slate-400">
              <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-medium">{primaryAddress?.addressTitle || "Registered Office"}: </span>
                <span>{primaryAddress?.addressLine1 || vendor.addressLine1 || "No address recorded."}</span>
                {vendor.city && <span>, {vendor.city}, {vendor.state} {vendor.pincode}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VendorOverviewTab = withCapability(VendorOverviewTabBase, {
  entity: "vendor",
  capability: "vendor.overview",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorOverviewTab;

