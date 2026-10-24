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
 * Target UI    : Persistent Corporate Account Header Component
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React from "react";
import { Building2 } from "lucide-react";
import { RetailCustomerRecord, CustomerCreditExposureResponse } from "../types.ts";

interface CorporateMasterAccountHeaderProps {
  customer: RetailCustomerRecord;
  creditExposure?: CustomerCreditExposureResponse;
}

export const CorporateMasterAccountHeader: React.FC<CorporateMasterAccountHeaderProps> = ({ customer, creditExposure }) => {
  // Format currency in Indian numbering (e.g. 1,00,00,000)
  const formatIndianNumber = (val?: number | string | null) => {
    if (val === undefined || val === null || val === "") return "0";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "0";
    return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  // Format date like "01 Apr 2023"
  const formatRelationshipDate = (dateStr?: string) => {
    if (!dateStr) return "01 Apr 2023";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // Normalize group and price list display
  const groupLabel = customer.customerGroupId || customer.customer_group_id || "CG-Retail";
  const priceListLabel = customer.priceGroup?.includes("#")
    ? customer.priceGroup.split("#")[1]
    : (customer.priceGroup || "CORP - Standard Corporate");

  const isActive = (customer.status || "Active").toLowerCase() === "active";

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-xs transition-colors shrink-0">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        
        {/* Left Section: Emblem + Title + Tags */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          
          {/* Logo / Building Emblem */}
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 text-[#00355f] dark:text-[#8ebdf9] shadow-2xs">
            <Building2 size={32} className="stroke-[1.75]" />
          </div>

          {/* Account Identity Details */}
          <div className="flex-1 min-w-0">
            {/* Top row: Code + Status Badge */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                {customer.code || "RRL-001"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {customer.status || "Active"}
              </span>
            </div>

            {/* Middle: Prominent Customer Name */}
            <h2 className="text-lg md:text-xl font-extrabold text-[#191c1e] dark:text-white tracking-tight truncate">
              {customer.name || "Customer Name"}
            </h2>

            {/* Bottom: Tags */}
            <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-[#00355f] dark:text-[#8ebdf9] border border-blue-200 dark:border-blue-800">
                Corporate / B2B
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {groupLabel}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {priceListLabel}
              </span>
              {creditExposure && creditExposure.companyCount > 1 && (
                <span
                  data-testid="header-group-exposure-badge"
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1.5 ${
                    creditExposure.groupRiskLevel === "ON_HOLD" || creditExposure.holdCount > 0
                      ? "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      : creditExposure.groupRiskLevel === "CRITICAL"
                      ? "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      : creditExposure.groupRiskLevel === "HIGH"
                      ? "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>Group Treasury: {creditExposure.companyCount} Cos</span>
                  <span>•</span>
                  <span>{creditExposure.groupUtilizationPercent}% ({creditExposure.groupRiskLevel})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Compact Financial & Statutory Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 w-full lg:w-auto shrink-0 text-left">
          
          {/* PAN */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              PAN
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
              {customer.panNumber || "—"}
            </span>
          </div>

          {/* GSTIN (Primary) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              GSTIN (Primary)
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
              {customer.gstin || "—"}
            </span>
          </div>

          {/* Credit Limit (INR) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              Credit Limit (INR)
            </span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {formatIndianNumber(customer.creditLimit)}
            </span>
            {creditExposure && creditExposure.companyCount > 1 && (
              <span
                data-testid="header-group-credit-limit"
                className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block truncate"
                title={`Consolidated Group Limit: ₹${formatIndianNumber(creditExposure.totalCreditLimit)}`}
              >
                Grp: ₹{formatIndianNumber(creditExposure.totalCreditLimit)}
              </span>
            )}
          </div>

          {/* Outstanding (INR) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              Outstanding (INR)
            </span>
            <span className="font-mono text-xs font-bold text-[#005fb8] dark:text-[#8ebdf9] block">
              {formatIndianNumber(customer.creditUsed)}
            </span>
            {creditExposure && creditExposure.companyCount > 1 && (
              <span
                data-testid="header-group-credit-used"
                className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block truncate"
                title={`Consolidated Group Outstanding: ₹${formatIndianNumber(creditExposure.totalCreditUsed)}`}
              >
                Grp: ₹{formatIndianNumber(creditExposure.totalCreditUsed)}
              </span>
            )}
          </div>

          {/* Payment Terms */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              Payment Terms
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
              {customer.paymentTerm || "Net 45"}
            </span>
          </div>

          {/* Relationship Since */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              Relationship Since
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {formatRelationshipDate(customer.createdAt)}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
