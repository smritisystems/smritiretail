/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Enterprise Customer Summary Card
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React from "react";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Layers,
  MapPin,
  ShieldCheck,
  Store,
  Users,
  FileText,
  Clock,
  Star
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";

interface CustomerSummaryCardProps {
  customer: RetailCustomerRecord;
  childCustomerCount?: number;
  totalStoreCount?: number;
}

export const CustomerSummaryCard: React.FC<CustomerSummaryCardProps> = ({
  customer,
  childCustomerCount = 0,
  totalStoreCount = 0,
}) => {
  const customerName = customer.name || "—";
  const customerCode = customer.code || "—";
  const status = customer.status || "Active";
  const customerType = customer.customerType || "Corporate / Enterprise";
  const relationshipType = customer.corporateParent || customer.isDependant ? "Child / Branch" : "Parent";
  const businessCategory = customer.businessNature || "Key Account";
  const gstin = customer.gstin?.trim() || "Not Registered";
  const pan = customer.panNumber?.trim() || (customer.gstin && customer.gstin.length >= 12 ? customer.gstin.slice(2, 12) : "—");
  const priceList = customer.priceGroup || "Standard";
  const paymentTerms = customer.paymentTerm || "Not Configured";
  const creditLimit = typeof customer.creditLimit === "number" ? customer.creditLimit : 0;

  return (
    <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5">
      {/* Title */}
      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
        Customer Summary
      </h3>

      {/* Identity Top Row */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[#00355f] dark:text-[#8ebdf9] flex items-center justify-center shrink-0 shadow-2xs">
          <Building2 size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm text-slate-900 dark:text-white truncate">
            {customerName}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-bold text-[#00355f] dark:text-[#8ebdf9]">
              {customerCode}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Key-Value Summary List */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" />
            <span>Type:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{customerType}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-400" />
            <span>Relationship:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{relationshipType}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Star size={13} className="text-amber-500" />
            <span>Category:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{businessCategory}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-blue-500" />
            <span>GSTIN:</span>
          </span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{gstin}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <FileText size={13} className="text-slate-400" />
            <span>PAN:</span>
          </span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{pan}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Layers size={13} className="text-purple-500" />
            <span>Default Price List:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{priceList}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-indigo-500" />
            <span>Payment Terms:</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{paymentTerms}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CreditCard size={13} className="text-emerald-500" />
            <span>Credit Limit:</span>
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            ₹ {creditLimit.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-sky-500" />
            <span>Total Child Customers:</span>
          </span>
          <span className="font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">
            {childCustomerCount}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Store size={13} className="text-teal-500" />
            <span>Total Stores / Outlets:</span>
          </span>
          <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
            {totalStoreCount}
          </span>
        </div>
      </div>
    </div>
  );
};
