/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Account Header Component
 */

import React, { useState } from "react";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Edit,
  Plus,
  MoreHorizontal,
  ChevronRight,
  Store,
  CheckCircle2,
  Share2,
  Printer,
  RefreshCw,
  FileSpreadsheet
} from "lucide-react";
import { CorporateCustomer360Data } from "./types.ts";

interface CorporateAccountHeaderProps {
  data: CorporateCustomer360Data;
  onEdit?: () => void;
  onCreateOrder?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onPrint?: () => void;
}

export const CorporateAccountHeader: React.FC<CorporateAccountHeaderProps> = ({
  data,
  onEdit,
  onCreateOrder,
  onRefresh,
  onExport,
  onPrint,
}) => {
  const { customer, kpis } = data;
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Formatting helpers
  const formatCreditLimit = (val?: number | string) => {
    if (val === undefined || val === null || val === "" || val === 0 || val === "0") return "—";
    const num = typeof val === "number" ? val : Number(String(val).replace(/,/g, ""));
    if (isNaN(num)) return String(val);
    return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6">

        {/* Left Section: Logo, Title, Badges, Contact, Address & Metas */}
        <div className="flex flex-col md:flex-row items-start gap-5 flex-1 min-w-0">

          {/* Logo / Brand Emblem Box */}
          <div className="w-28 h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-2 shrink-0 shadow-2xs overflow-hidden">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-1">
                <div className="w-6 h-6 rounded-full bg-[#00355f] flex items-center justify-center text-white text-[11px] font-bold">
                  <span>R</span>
                </div>
              </div>
              <span className="font-extrabold text-[#d92228] text-sm tracking-tight font-sans mt-0.5">
                Reliance
              </span>
              <span className="text-[8px] font-bold text-[#00355f] tracking-widest uppercase">
                RETAIL
              </span>
            </div>
          </div>

          {/* Details Column */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Badges + Title */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Key Account
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  National Retail Chain
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{customer.status || "Active"}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {customer.name || "Reliance Retail Ltd."}
                </h1>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                    {customer.code || "CUST-REL-0001"}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                    <Building2 size={13} className="text-slate-400" />
                    <span>{customer.customer_type || "Corporate Customer"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Details Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <a
                href={`tel:${customer.mobile || "+912235550000"}`}
                className="flex items-center gap-1.5 hover:text-[#0284c7] transition"
              >
                <Phone size={13} className="text-[#0284c7]" />
                <span className="font-mono">{customer.mobile || "+91 22 3555 0000"}</span>
              </a>
              <a
                href={`mailto:${customer.email || "procurement@ril.com"}`}
                className="flex items-center gap-1.5 hover:text-[#0284c7] transition"
              >
                <Mail size={13} className="text-[#0284c7]" />
                <span>{customer.email || "procurement@ril.com"}</span>
              </a>
              <a
                href="https://www.ril.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-[#0284c7] transition"
              >
                <Globe size={13} className="text-[#0284c7]" />
                <span>{customer.website || "www.ril.com"}</span>
              </a>
            </div>

            {/* Address Row */}
            <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {customer.registered_address ||
                  "3rd Floor, Court House, Lokmanya Tilak Marg, Dhobi Talao, Mumbai - 400002, Maharashtra, India"}
              </span>
            </div>

            {/* Enterprise Commercial Metadata Grid */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Customer Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {customer.customer_type || "Corporate Retail Chain"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Segment</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 underline decoration-slate-300 dark:decoration-slate-700 underline-offset-2">
                  {customer.segment || "Modern Trade"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Price Group</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {customer.price_group || "Key Account"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Payment Terms</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {customer.payment_term || "30 Days (Credit)"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Credit Limit</span>
                <span className="font-semibold font-mono text-slate-900 dark:text-white">
                  {formatCreditLimit(customer.credit_limit ?? customer.creditLimit)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">GST No.</span>
                <span className="font-semibold font-mono text-[#0284c7] dark:text-[#38bdf8]">
                  {customer.gst_number || customer.gstNumber || "27AAACR1718E1ZV"}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Section: Header Action Buttons & Summary Cards */}
        <div className="flex flex-col items-end gap-3 w-full lg:w-80 shrink-0">

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Edit size={13} className="text-slate-500" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={onCreateOrder}
              className="px-3.5 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus size={14} />
              <span>Create Order</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
              >
                <MoreHorizontal size={14} />
                <span>More</span>
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 py-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in duration-150">
                  <button
                    onClick={() => { setShowMoreMenu(false); onRefresh?.(); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <RefreshCw size={13} className="text-slate-400" />
                    <span>Refresh Profile</span>
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onExport?.(); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <FileSpreadsheet size={13} className="text-slate-400" />
                    <span>Export 360 Dataset</span>
                  </button>
                  <button
                    onClick={() => { setShowMoreMenu(false); onPrint?.(); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Printer size={13} className="text-slate-400" />
                    <span>Print Profile PDF</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary Cards */}
          <div className="w-full space-y-2">

            {/* Stores Network Card */}
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center text-[#0284c7]">
                  <Store size={15} />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Total Stores</span>
                  <span className="font-extrabold text-sm font-mono text-slate-900 dark:text-white">
                    {(kpis.total_stores || 2456).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Active Stores</span>
                  <span className="font-extrabold text-sm font-mono text-slate-900 dark:text-white">
                    {(kpis.active_stores || 2318).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Servicing Region Card */}
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-2.5 text-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600">
                <MapPin size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[10px] text-slate-400 font-medium">Servicing Region</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {customer.servicing_region || "All India"}
                </span>
              </div>
            </div>

            {/* Account Manager Card */}
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-2 text-xs group cursor-pointer hover:border-blue-400 transition">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0284c7] text-white flex items-center justify-center font-bold text-xs">
                  {customer.primary_account_manager?.initials || "RS"}
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-medium">Primary Account Manager</span>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    {customer.primary_account_manager?.name || "Rohan Singh"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {customer.primary_account_manager?.title || "National Key Account Manager"}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400 group-hover:text-[#0284c7] group-hover:translate-x-0.5 transition" />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
