/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.85.0
 * Created      : 2026-09-11
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { CreditCard, DollarSign, Award, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { VendorDetail } from "../../../types/vendor";
import { withCapability } from "../../../types/architecture";
import { RichTextTermsEditor } from "../../common/RichTextTermsEditor";

interface VendorCommercialTabProps {
  vendor: VendorDetail;
  onChangeCommercial: (field: string, value: any) => void;
  isEditing: boolean;
}

const VendorCommercialTabBase: React.FC<VendorCommercialTabProps> = ({ vendor, onChangeCommercial, isEditing }) => {
  const comm = vendor.commercial;
  const isMicroOrSmall = comm?.msmeCategory === "MICRO" || comm?.msmeCategory === "SMALL";

  return (
    <div className="space-y-6">
      {/* Credit & Payment Mandates */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span>Payment Terms & Credit Cycle Mandate</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Payment Terms (Days) *</label>
            <input
              type="number"
              min={0}
              max={120}
              value={comm?.paymentTermsDays ?? 30}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("paymentTermsDays", parseInt(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
            {isMicroOrSmall && (comm?.paymentTermsDays || 0) > 45 && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center space-x-1">
                <AlertTriangle size={12} />
                <span>Exceeds 45-day statutory limit under Sec 43B(h)!</span>
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Commercial Classification</label>
            <select
              value={comm?.commercialClassification || "APPROVED"}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("commercialClassification", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            >
              <option value="PREFERRED">Preferred Vendor (Priority Procurement)</option>
              <option value="APPROVED">Approved Active Vendor (Standard)</option>
              <option value="CONDITIONAL">Conditional (Subject to QC Review)</option>
              <option value="RESTRICTED">Restricted (Manager Approval Required)</option>
              <option value="BLOCKED">Blocked (No New Purchase Orders Allowed)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Business Capacity / Role</label>
            <select
              value={comm?.supplierType || "DISTRIBUTOR"}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("supplierType", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            >
              <option value="MANUFACTURER">Original Equipment Manufacturer (OEM)</option>
              <option value="DISTRIBUTOR">Authorized National / C&F Distributor</option>
              <option value="IMPORTER">Direct Importer</option>
              <option value="TRADER">Wholesale Stockist / Trader</option>
              <option value="SERVICE_PROVIDER">Service / Job Work Contractor</option>
            </select>
          </div>
        </div>
      </div>

      {/* TDS & Withholding Tax Coordinates */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          <DollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>TDS & Withholding Tax Settings</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Applicable TDS Section</label>
            <select
              value={comm?.tdsSection || "194Q"}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("tdsSection", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            >
              <option value="194Q">Section 194Q (Purchase of Goods &gt; ₹50 Lakhs)</option>
              <option value="194C">Section 194C (Contractors / Transportation)</option>
              <option value="194J">Section 194J (Professional / Technical Fees)</option>
              <option value="NONE">None (Exempt / Threshold Not Met)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">TDS Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={comm?.tdsRate ?? 0.1}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("tdsRate", parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Default 0.10% if PAN provided; 5.0% if PAN missing</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Current Liability Ledger</label>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Total Unpaid Payable: </span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                ₹{(comm?.outstandingLiability || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Default Purchase Order Commercial Terms */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
          <span>Default Purchase Order Commercial Terms</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Default Freight Terms</label>
            <input
              type="text"
              value={comm?.freightTerms ?? "Paid by Supplier"}
              disabled={!isEditing}
              onChange={(e) => {
                const val = e.target.value;
                onChangeCommercial("freightTerms", val);
                const isToPay = val.toLowerCase().includes("buyer") || val.toLowerCase().includes("to-pay") || val.toLowerCase().includes("to pay");
                onChangeCommercial("deliveryTerms", isToPay ? "Ex-Factory" : "Door Delivery");
              }}
              placeholder="e.g. Paid by Supplier, To Pay"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Default Delivery Terms</label>
            <input
              type="text"
              value={comm?.deliveryTerms ?? (comm?.freightTerms?.toLowerCase().includes("buyer") || comm?.freightTerms?.toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery")}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("deliveryTerms", e.target.value)}
              placeholder="e.g. Door Delivery, Ex-Factory"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Default Currency</label>
            <select
              value={comm?.currency ?? "INR - Indian Rupee"}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("currency", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            >
              <option value="INR - Indian Rupee">INR - Indian Rupee</option>
              <option value="USD - US Dollar">USD - US Dollar</option>
              <option value="EUR - Euro">EUR - Euro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Default Buyer</label>
            <input
              type="text"
              value={comm?.buyer ?? ""}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("buyer", e.target.value)}
              placeholder="e.g. admin (SYSADMIN)"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Default Department</label>
            <input
              type="text"
              value={comm?.department ?? ""}
              disabled={!isEditing}
              onChange={(e) => onChangeCommercial("department", e.target.value)}
              placeholder="e.g. General Purchase"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-60"
            />
          </div>

          <div className="col-span-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Special Instructions &amp; Commercial Terms (Prints on Purchase Orders)
              </label>
              <span className="text-[10.5px] text-slate-400">
                Supplier-specific statutory terms, warranty clauses, inspection mandates, and QC conditions
              </span>
            </div>
            <RichTextTermsEditor
              value={comm?.specialInstructions ?? ""}
              disabled={!isEditing}
              onChange={(newHtml) => onChangeCommercial("specialInstructions", newHtml)}
              placeholder="Enter supplier-specific commercial terms, credit agreements, inspection clauses, and statutory conditions..."
              minHeight="190px"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const VendorCommercialTab = withCapability(VendorCommercialTabBase, {
  entity: "vendor",
  capability: "vendor.commercial",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorCommercialTab;

