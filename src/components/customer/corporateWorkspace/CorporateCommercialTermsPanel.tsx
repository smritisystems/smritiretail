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
 * Target UI    : Corporate Commercial Terms Panel (Tab 4)
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Percent,
  Truck,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
  Building2,
  Plus,
  Edit2,
  AlertTriangle,
  Lock,
  Unlock,
  Check
} from "lucide-react";
import { RetailCustomerRecord, CustomerCompanyRelationship, CustomerCreditExposureResponse } from "../types.ts";

interface CorporateCommercialTermsPanelProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  relationships?: CustomerCompanyRelationship[];
  activeRelationshipId?: string;
  onSelectRelationship?: (relationshipId: string) => void;
  onUpdateRelationship?: (relationshipId: string, updates: Partial<CustomerCompanyRelationship>) => void;
  onAddRelationship?: (newRelationship: Partial<CustomerCompanyRelationship>) => void;
  creditExposure?: CustomerCreditExposureResponse;
  isReadOnly?: boolean;
}

export const CorporateCommercialTermsPanel: React.FC<CorporateCommercialTermsPanelProps> = ({
  customer,
  onChange,
  relationships,
  activeRelationshipId,
  onSelectRelationship,
  onUpdateRelationship,
  onAddRelationship,
  creditExposure,
  isReadOnly = false
}) => {
  const [selectedRelId, setSelectedRelId] = useState<string>("");
  const [isAddingEntity, setIsAddingEntity] = useState<boolean>(false);
  const [newCompanyId, setNewCompanyId] = useState<string>("");
  const [newCustomerGroupId, setNewCustomerGroupId] = useState<string>("CG-Corporate");
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);
  const [newCreditDays, setNewCreditDays] = useState<number>(30);
  const [newCreditHold, setNewCreditHold] = useState<boolean>(false);

  // Compute effective relationships
  const effectiveRelationships: CustomerCompanyRelationship[] = useMemo(() => {
    if (relationships && relationships.length > 0) {
      return relationships;
    }
    const defaultCompanyId = customer.companyCode || "COMP-001";
    return [
      {
        id: `rel-${defaultCompanyId}`,
        company_id: defaultCompanyId,
        customer_id: customer.id,
        customer_group_id: customer.customerGroupId || customer.customer_group_id || "CG-Corporate",
        credit_limit: Number(customer.creditLimit || 0),
        credit_days: Number(customer.creditDays || 0),
        credit_hold: false,
        status: "Active",
        is_active: true
      }
    ];
  }, [relationships, customer.companyCode, customer.id, customer.customerGroupId, customer.customer_group_id, customer.creditLimit, customer.creditDays]);

  const activeRel = useMemo(() => {
    const targetId = activeRelationshipId || selectedRelId;
    const found = effectiveRelationships.find(r => r.id === targetId);
    return found || effectiveRelationships[0];
  }, [effectiveRelationships, activeRelationshipId, selectedRelId]);

  const creditLimit = Number(customer.creditLimit || activeRel.credit_limit || activeRel.creditLimit || 0);
  const outstanding = Number(customer.creditUsed || 0);
  const creditPercentUsed = creditLimit > 0
    ? Math.min(Math.round((outstanding / creditLimit) * 10000) / 100, 100)
    : 0;

  // Format currency
  const formatIndianNumber = (val: number) => {
    return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  // Compute consolidated group exposure data (BD-6)
  const groupExposureData = useMemo(() => {
    if (creditExposure && creditExposure.companyExposures && creditExposure.companyExposures.length > 0) {
      return creditExposure;
    }
    const totalLimit = effectiveRelationships.reduce((acc, r) => acc + Number(r.credit_limit ?? r.creditLimit ?? 0), 0);
    const totalUsed = Number(customer.creditUsed || 0);
    const available = Math.max(0, totalLimit - totalUsed);
    const utilPct = totalLimit > 0 ? Math.min(Math.round((totalUsed / totalLimit) * 10000) / 100, 100) : 0;
    const holdCount = effectiveRelationships.filter(r => Boolean(r.credit_hold ?? r.creditHold)).length;
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "ON_HOLD" = "LOW";
    if (holdCount > 0) riskLevel = "ON_HOLD";
    else if (utilPct >= 100) riskLevel = "CRITICAL";
    else if (utilPct >= 80) riskLevel = "HIGH";
    else if (utilPct >= 50) riskLevel = "MODERATE";

    return {
      customerId: customer.id,
      customerName: customer.name,
      totalCreditLimit: totalLimit,
      totalCreditUsed: totalUsed,
      totalAvailableCredit: available,
      groupUtilizationPercent: utilPct,
      groupRiskLevel: riskLevel,
      companyCount: effectiveRelationships.length,
      holdCount,
      companyExposures: effectiveRelationships.map(r => {
        const cLim = Number(r.credit_limit ?? r.creditLimit ?? 0);
        const cUsed = r.company_id === (customer.companyCode || "COMP-001") ? Number(customer.creditUsed || 0) : 0;
        const cAvail = Math.max(0, cLim - cUsed);
        const cUtil = cLim > 0 ? Math.min(Math.round((cUsed / cLim) * 10000) / 100, 100) : 0;
        const isHold = Boolean(r.credit_hold ?? r.creditHold);
        return {
          companyId: r.company_id || r.companyId || "COMP-001",
          companyName: undefined,
          companyCode: r.company_id || r.companyId || "COMP-001",
          relationshipId: r.id,
          customerGroupId: r.customer_group_id || r.customerGroupId,
          creditLimit: cLim,
          creditDays: Number(r.credit_days ?? r.creditDays ?? 0),
          creditHold: isHold,
          creditUsed: cUsed,
          availableCredit: cAvail,
          utilizationPercent: cUtil,
          exposureStatus: isHold ? "ON_HOLD" : cUtil >= 100 ? "CRITICAL_BREACH" : cUtil >= 80 ? "HIGH_WARNING" : "NORMAL",
          status: r.status || "Active"
        };
      })
    };
  }, [creditExposure, effectiveRelationships, customer.id, customer.name, customer.creditUsed, customer.companyCode]);


  const handleToggleCreditHold = () => {
    if (isReadOnly) return;
    const currentHold = Boolean(activeRel.credit_hold ?? activeRel.creditHold);
    const updatedHold = !currentHold;
    if (onUpdateRelationship) {
      onUpdateRelationship(activeRel.id, {
        credit_hold: updatedHold,
        creditHold: updatedHold
      });
    }
  };

  const handleEntityFieldChange = (field: keyof CustomerCompanyRelationship, val: any) => {
    if (isReadOnly) return;
    if (onUpdateRelationship) {
      onUpdateRelationship(activeRel.id, { [field]: val });
    }
    // Synchronize to primary customer record if matching primary company
    const activeCompanyId = activeRel.company_id || activeRel.companyId;
    const primaryCompanyId = customer.companyCode || "COMP-001";
    if (activeCompanyId === primaryCompanyId || activeCompanyId === "COMP-001") {
      if (field === "credit_limit" || field === "creditLimit") {
        onChange("creditLimit", Number(val));
      } else if (field === "credit_days" || field === "creditDays") {
        onChange("creditDays", Number(val));
      } else if (field === "customer_group_id" || field === "customerGroupId") {
        onChange("customerGroupId", String(val));
        onChange("customer_group_id", String(val));
      }
    }
  };

  const handleSaveNewEntity = () => {
    if (!newCompanyId.trim()) return;
    if (onAddRelationship) {
      onAddRelationship({
        company_id: newCompanyId.trim(),
        customer_group_id: newCustomerGroupId.trim() || undefined,
        credit_limit: newCreditLimit,
        credit_days: newCreditDays,
        credit_hold: newCreditHold,
        status: "Active"
      });
    }
    setIsAddingEntity(false);
    setNewCompanyId("");
    setNewCreditLimit(0);
    setNewCreditDays(30);
    setNewCreditHold(false);
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-6 text-xs">
      
      {/* Panel Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <CreditCard size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
          Commercial Terms
        </h3>
      </div>

      {/* Row 1: High-Density Commercial Metrics (Matching Reference Screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Payment Category */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Payment Category
          </label>
          <select
            value={customer.paymentCategory || "CREDIT"}
            onChange={e => onChange("paymentCategory", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:bg-white focus:border-[#00355f] outline-none"
          >
            <option value="CREDIT">CREDIT</option>
            <option value="CASH">CASH</option>
            <option value="CARD">CARD (DEBIT/CREDIT)</option>
            <option value="UPI">UPI / QR CODE</option>
            <option value="NETBANKING">NETBANKING</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
        </div>

        {/* Payment Terms */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Payment Terms
          </label>
          <select
            value={customer.paymentTerm || "Net 45"}
            onChange={e => onChange("paymentTerm", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          >
            <option value="Net 45">Net 45</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 15">Net 15</option>
            <option value="Net 60">Net 60</option>
            <option value="Immediate">Immediate / Advance</option>
          </select>
        </div>

        {/* Credit Limit (INR) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Credit Limit (INR)
          </label>
          <input
            type="number"
            value={customer.creditLimit}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              onChange("creditLimit", val);
              handleEntityFieldChange("credit_limit", val);
            }}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold text-slate-800 dark:text-slate-200 focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

        {/* Credit Days */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Credit Days
          </label>
          <input
            type="number"
            value={customer.creditDays}
            onChange={e => {
              const val = parseInt(e.target.value) || 0;
              onChange("creditDays", val);
              handleEntityFieldChange("credit_days", val);
            }}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

        {/* Current Outstanding (INR) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Current Outstanding (INR)
          </label>
          <div className="w-full p-2 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg font-mono text-xs font-extrabold text-[#005fb8] dark:text-[#8ebdf9]">
            {formatIndianNumber(outstanding)}
          </div>
        </div>

        {/* Credit Utilization */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Credit Utilization
            </label>
            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {creditPercentUsed.toFixed(2)}%
            </span>
          </div>
          <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 flex items-center">
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(creditPercentUsed, 100)}%` }}
                className={`h-full transition-all ${
                  creditPercentUsed > 85
                    ? "bg-rose-500"
                    : creditPercentUsed > 50
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
          </div>
        </div>

      </div>

      {/* BD-6: Consolidated Group Treasury & Credit Exposure Monitoring */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Consolidated Group Treasury & Credit Exposure
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold uppercase">
                  BD-6 Governance
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Multi-company aggregate exposure monitoring, centralized risk tiers, and corporate credit limits.
              </p>
            </div>
          </div>

          {/* Group Risk Tier Pill */}
          <div className="flex items-center gap-2">
            <span
              data-testid="group-risk-badge"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                groupExposureData.groupRiskLevel === "ON_HOLD" || groupExposureData.holdCount > 0
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                  : groupExposureData.groupRiskLevel === "CRITICAL"
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                  : groupExposureData.groupRiskLevel === "HIGH"
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>Risk Tier: {groupExposureData.groupRiskLevel}</span>
            </span>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Group Credit Limit */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Group Credit Limit
            </span>
            <span data-testid="group-total-limit" className="font-mono text-sm md:text-base font-extrabold text-slate-800 dark:text-slate-100 block">
              ₹{formatIndianNumber(groupExposureData.totalCreditLimit)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Across {groupExposureData.companyCount} Legal Entities
            </span>
          </div>

          {/* Card 2: Group Total Outstanding */}
          <div className="p-3 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9] block mb-1">
              Group Outstanding
            </span>
            <span data-testid="group-total-used" className="font-mono text-sm md:text-base font-extrabold text-[#005fb8] dark:text-[#8ebdf9] block">
              ₹{formatIndianNumber(groupExposureData.totalCreditUsed)}
            </span>
            <span className="text-[10px] text-blue-500/80 mt-0.5 block">
              Receivables Ledger Total
            </span>
          </div>

          {/* Card 3: Net Available Credit */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Available Credit
            </span>
            <span data-testid="group-total-available" className="font-mono text-sm md:text-base font-extrabold text-emerald-600 dark:text-emerald-400 block">
              ₹{formatIndianNumber(groupExposureData.totalAvailableCredit)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Uncommitted Headroom
            </span>
          </div>

          {/* Card 4: Group Utilization */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Group Utilization
              </span>
              <span data-testid="group-utilization-pct" className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                {groupExposureData.groupUtilizationPercent}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
              <div
                style={{ width: `${Math.min(groupExposureData.groupUtilizationPercent, 100)}%` }}
                className={`h-full transition-all ${
                  groupExposureData.groupUtilizationPercent >= 100
                    ? "bg-rose-500"
                    : groupExposureData.groupUtilizationPercent >= 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {groupExposureData.holdCount > 0 ? `${groupExposureData.holdCount} Entity On Hold` : "All Accounts Clean"}
            </span>
          </div>
        </div>

        {/* Hold Warning Banner if any entity is on hold */}
        {groupExposureData.holdCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
            <AlertTriangle size={16} className="shrink-0 text-rose-600" />
            <span>
              <strong>Treasury Alert:</strong> Commercial invoicing is on hold for {groupExposureData.holdCount} operating legal entity. Invoicing and order fulfillment are restricted for suspended entities.
            </span>
          </div>
        )}

        {/* Multi-Company Exposure Breakdown Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">Operating Entity</th>
                <th className="py-2.5 px-3">Credit Limit (INR)</th>
                <th className="py-2.5 px-3">Outstanding (INR)</th>
                <th className="py-2.5 px-3">Available (INR)</th>
                <th className="py-2.5 px-3">Utilization</th>
                <th className="py-2.5 px-3">Terms</th>
                <th className="py-2.5 px-3">Invoicing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {groupExposureData.companyExposures.map((item) => {
                const isItemHold = item.creditHold || item.exposureStatus === "ON_HOLD";
                return (
                  <tr key={item.companyId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition">
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {item.companyId}
                      </div>
                      {item.companyName && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {item.companyName}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                      ₹{formatIndianNumber(item.creditLimit)}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-[#005fb8] dark:text-[#8ebdf9]">
                      ₹{formatIndianNumber(item.creditUsed)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                      ₹{formatIndianNumber(item.availableCredit)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">
                          {item.utilizationPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-600 dark:text-slate-300">
                      {item.creditDays} Days
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      {isItemHold ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          <ShieldAlert size={11} />
                          ON HOLD
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <ShieldCheck size={11} />
                          PERMITTED
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model C: Operating Legal Entities & Commercial Policy */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Operating Legal Entity Commercial Terms
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold lowercase">
                  model c multi-company
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Entity-specific credit governance, commercial customer group mapping, and transaction hold controls.
              </p>
            </div>
          </div>

          {!isReadOnly && !isAddingEntity && (
            <button
              type="button"
              onClick={() => setIsAddingEntity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <Plus size={13} />
              <span>Add Entity Relationship</span>
            </button>
          )}
        </div>

        {/* Entity Selector Tabs / Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {effectiveRelationships.map(rel => {
            const isSelected = rel.id === activeRel.id;
            const isHold = Boolean(rel.credit_hold ?? rel.creditHold);
            return (
              <button
                key={rel.id}
                type="button"
                onClick={() => {
                  if (onSelectRelationship) onSelectRelationship(rel.id);
                  else setSelectedRelId(rel.id);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  isSelected
                    ? "bg-[#00355f] text-white border-[#00355f] shadow-xs"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{rel.company_id || rel.companyId || "COMP-001"}</span>
                {isHold ? (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase ${isSelected ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
                    HOLD
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold uppercase ${isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Entity Active Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operating Entity:
              </span>
              <span className="font-mono text-xs font-extrabold text-[#00355f] dark:text-[#8ebdf9]">
                {activeRel.company_id || activeRel.companyId || "COMP-001"}
              </span>
              <span className="text-[10px] text-slate-400">|</span>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Relationship ID: <code className="font-mono text-[11px] text-slate-500">{activeRel.id}</code>
              </span>
            </div>

            {/* Quick Credit Hold Status Button */}
            <button
              type="button"
              disabled={isReadOnly}
              onClick={handleToggleCreditHold}
              data-field-key="ccr_credit_hold"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                Boolean(activeRel.credit_hold ?? activeRel.creditHold)
                  ? "bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              } ${isReadOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {Boolean(activeRel.credit_hold ?? activeRel.creditHold) ? (
                <>
                  <ShieldAlert size={14} />
                  <span>CREDIT ON HOLD — INVOICING BLOCKED</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>CREDIT CLEAN — INVOICING PERMITTED</span>
                </>
              )}
            </button>
          </div>

          {/* Active Entity Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Company ID */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Company Entity Code
              </label>
              <input
                type="text"
                readOnly
                data-field-key="ccr_company_id"
                value={activeRel.company_id || activeRel.companyId || "COMP-001"}
                className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
              />
            </div>

            {/* Customer Group */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Commercial Customer Group
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                data-field-key="ccr_customer_group"
                value={activeRel.customer_group_id ?? activeRel.customerGroupId ?? customer.customerGroupId ?? "CG-Corporate"}
                onChange={e => handleEntityFieldChange("customer_group_id", e.target.value)}
                placeholder="e.g. CG-Corporate"
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold focus:border-[#00355f] outline-none"
              />
            </div>

            {/* Credit Limit */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Entity Credit Limit (INR)
              </label>
              <input
                type="number"
                disabled={isReadOnly}
                data-field-key="ccr_credit_limit"
                value={activeRel.credit_limit ?? activeRel.creditLimit ?? 0}
                onChange={e => handleEntityFieldChange("credit_limit", parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-[#00355f] outline-none"
              />
            </div>

            {/* Credit Days */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Entity Credit Days
              </label>
              <input
                type="number"
                disabled={isReadOnly}
                data-field-key="ccr_credit_days"
                value={activeRel.credit_days ?? activeRel.creditDays ?? 0}
                onChange={e => handleEntityFieldChange("credit_days", parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold focus:border-[#00355f] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Add Entity Relationship Expandable Form */}
        {isAddingEntity && (
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-200">
                New Operating Legal Entity Commercial Relationship
              </span>
              <button
                type="button"
                onClick={() => setIsAddingEntity(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Operating Company ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. comp-foreign-002"
                  value={newCompanyId}
                  onChange={e => setNewCompanyId(e.target.value.trim())}
                  data-field-key="ccr_company_id"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-bold focus:border-[#00355f] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Customer Group ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. CG-Corporate"
                  value={newCustomerGroupId}
                  onChange={e => setNewCustomerGroupId(e.target.value.trim())}
                  data-field-key="ccr_customer_group"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:border-[#00355f] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Credit Limit (INR)
                </label>
                <input
                  type="number"
                  value={newCreditLimit}
                  onChange={e => setNewCreditLimit(parseFloat(e.target.value) || 0)}
                  data-field-key="ccr_credit_limit"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:border-[#00355f] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Credit Days
                </label>
                <input
                  type="number"
                  value={newCreditDays}
                  onChange={e => setNewCreditDays(parseInt(e.target.value) || 0)}
                  data-field-key="ccr_credit_days"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:border-[#00355f] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCreditHold}
                  onChange={e => setNewCreditHold(e.target.checked)}
                  data-field-key="ccr_credit_hold"
                  className="rounded text-[#00355f] focus:ring-[#00355f]"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hold Credit Immediately Upon Creation
                </span>
              </label>

              <button
                type="button"
                onClick={handleSaveNewEntity}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00355f] text-white hover:bg-[#002747] transition shadow-xs"
              >
                <Check size={14} />
                <span>Save Relationship</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Pricing Factors & Tax Defaults (Matching Reference Screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        
        {/* Dealer Factor */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Dealer Factor
          </label>
          <input
            type="number"
            step="0.01"
            value={customer.dealerFactor || 0.85}
            onChange={e => onChange("dealerFactor", parseFloat(e.target.value) || 0.85)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

        {/* Retail Factor */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Retail Factor
          </label>
          <input
            type="number"
            step="0.01"
            value={customer.retailFactor || 1.00}
            onChange={e => onChange("retailFactor", parseFloat(e.target.value) || 1.00)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          />
        </div>

        {/* Bill On Price */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Bill On Price
          </label>
          <select
            value={customer.pricingBasis || customer.pricing_basis || "MRP"}
            onChange={e => {
              const val = e.target.value as "MRP" | "RATE";
              onChange("pricingBasis", val);
              onChange("pricing_basis", val);
            }}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] focus:bg-white outline-none"
          >
            <option value="MRP">MRP (Retail)</option>
            <option value="RATE">RATE (Wholesale)</option>
          </select>
        </div>

        {/* Default Tax Type */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
            Default Tax Type
          </label>
          <select
            value={customer.destinationTaxType || "318#GST_RETAIL"}
            onChange={e => onChange("destinationTaxType", e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
          >
            <option value="318#GST_RETAIL">3/5% GST - RETAIL</option>
            <option value="318#STAPLES">318#STAPLES</option>
            <option value="000#EXEMPTED">000#EXEMPTED</option>
            <option value="999#SEZ_ZERO_RATED">999#SEZ_ZERO_RATED</option>
          </select>
        </div>

      </div>

      {/* Row 3: Logistics, Banking & Transaction Permissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-slate-100 dark:border-slate-800">
        
        {/* Logistics & Banking */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Truck size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Transport, Logistics &amp; Banking
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Trans. Mode
              </label>
              <select
                value={customer.transportMode || "By-Road"}
                onChange={e => onChange("transportMode", e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white outline-none"
              >
                <option value="By-Road">By-Road</option>
                <option value="Air">Air Express</option>
                <option value="Rail">Rail Express</option>
                <option value="Sea">Sea Cargo</option>
                <option value="Express Courier">Express Courier</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Trans. Code
              </label>
              <input
                type="text"
                value={customer.transportCode || "VRL"}
                onChange={e => onChange("transportCode", e.target.value)}
                placeholder="e.g. VRL"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Transit Days
              </label>
              <input
                type="number"
                value={customer.transitDays || 2}
                onChange={e => onChange("transitDays", parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:bg-white outline-none"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Bank Code
              </label>
              <input
                type="text"
                value={customer.bankCode || "HDFC000123"}
                onChange={e => onChange("bankCode", e.target.value)}
                placeholder="e.g. HDFC000123"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs focus:bg-white outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Bank Location
              </label>
              <input
                type="text"
                value={customer.bankLocation || "MG Road, Bangalore"}
                onChange={e => onChange("bankLocation", e.target.value)}
                placeholder="e.g. MG Road, Bangalore"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Transaction Permissions */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Transaction Permissions
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={customer.allowCashBill}
                onChange={e => onChange("allowCashBill", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Allow Cash Bill</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={customer.allowDcGen}
                onChange={e => onChange("allowDcGen", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Allow DC Gen.</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={customer.allowCreditInvoice}
                onChange={e => onChange("allowCreditInvoice", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Allow Credit Invoice</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={customer.allowMiscIssue}
                onChange={e => onChange("allowMiscIssue", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Allow Misc. Issue</span>
            </label>

            <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 transition col-span-2">
              <input
                type="checkbox"
                checked={customer.allowMiscReceipts}
                onChange={e => onChange("allowMiscReceipts", e.target.checked)}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Allow Misc. Receipts</span>
            </label>
          </div>
        </div>

      </div>

    </div>
  );
};
