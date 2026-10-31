/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useEffect, useState } from "react";
import { Users, Heart, Award, Plus, Trash2, Calendar, Sparkles, X } from "lucide-react";
import { RetailCustomerRecord, CustomerDependantEntry } from "./types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

interface SmritiCustomerRetailDetailsTabProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
}

export const SmritiCustomerRetailDetailsTab: React.FC<SmritiCustomerRetailDetailsTabProps> = ({
  customer,
  onChange
}) => {
  const isCorporate = customer.customerType === "Corporate" || customer.customerType === "Wholesale" || customer.customerType === "Distribution" || customer.environment === "Corporate" || customer.customerGroupId === "CG-Corporate" || (customer.code ? customer.code.startsWith("RRL") : false);

  const [newDepCode, setNewDepCode] = useState("");
  const [newDepName, setNewDepName] = useState("");
  const [newDepRelation, setNewDepRelation] = useState("Spouse");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentSearchResults, setParentSearchResults] = useState<Array<{ id: string; code?: string | null; name: string }>>([]);
  const [parentSearchOpen, setParentSearchOpen] = useState(!customer.parentCustomerId);
  const [parentSearchLoading, setParentSearchLoading] = useState(false);
  const [parentSearchError, setParentSearchError] = useState<string | null>(null);

  useEffect(() => {
    setParentSearchOpen(!customer.parentCustomerId);
    setParentSearchQuery("");
  }, [customer.id, customer.parentCustomerId]);

  useEffect(() => {
    const query = parentSearchQuery.trim();
    if (!parentSearchOpen || query.length < 2) {
      setParentSearchResults([]);
      setParentSearchLoading(false);
      setParentSearchError(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setParentSearchLoading(true);
      setParentSearchError(null);
      try {
        const results = await apiFetchV1<Array<{ id: string; code?: string | null; name: string }>>(
          `/crm/customers/search?q=${encodeURIComponent(query)}&limit=10`,
        );
        if (active) {
          setParentSearchResults((results || []).filter(candidate => candidate.id !== customer.id));
        }
      } catch (error) {
        if (active) {
          setParentSearchResults([]);
          setParentSearchError(error instanceof Error ? error.message : "Unable to search parent accounts.");
        }
      } finally {
        if (active) setParentSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customer.id, parentSearchOpen, parentSearchQuery]);

  const selectParentAccount = (parent: { id: string; code?: string | null; name: string }) => {
    onChange("parentCustomerId", parent.id);
    onChange("primaryAccountCode", parent.code || "");
    onChange("primaryAccountName", parent.name);
    onChange("isDependant", true);
    setParentSearchQuery("");
    setParentSearchOpen(false);
  };

  const clearParentAccount = () => {
    onChange("parentCustomerId", "");
    onChange("primaryAccountCode", "");
    onChange("primaryAccountName", "");
    onChange("isDependant", false);
    setParentSearchQuery("");
    setParentSearchOpen(true);
  };

  const handleAddDependant = () => {
    if (!newDepName.trim()) return;
    const newEntry: CustomerDependantEntry = {
      code: newDepCode.trim() || `DEP-${String(customer.dependants.length + 1).padStart(3, "0")}`,
      name: newDepName.trim(),
      relation: newDepRelation,
      applySameMailing: true
    };
    onChange("dependants", [...customer.dependants, newEntry]);
    setNewDepCode("");
    setNewDepName("");
  };

  const handleRemoveDependant = (idxToDelete: number) => {
    onChange("dependants", customer.dependants.filter((_, idx) => idx !== idxToDelete));
  };

  return (
    <div className="space-y-5 text-xs">
      <section className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Users size={15} /> Account Relationship
        </h3>
        {customer.parentCustomerId && !parentSearchOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
            <div>
              <p className="font-bold text-[#00355f] dark:text-[#8ebdf9]">
                Parent account: {customer.primaryAccountCode ? `${customer.primaryAccountCode} · ` : ""}
                {customer.primaryAccountName || customer.parentCustomerId}
              </p>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                Parent billing visibility: {customer.parentShowChildCustomersInBilling ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setParentSearchOpen(true)} className="rounded border border-[#c6c6cd] px-2.5 py-1.5 font-semibold">
                Change
              </button>
              <button type="button" onClick={clearParentAccount} className="flex items-center gap-1 rounded border border-[#c6c6cd] px-2.5 py-1.5 font-semibold">
                <X size={12} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase text-[#515f74] dark:text-[#bec6e0]">
              Search for one parent account
            </label>
            <input
              type="search"
              value={parentSearchQuery}
              onChange={event => setParentSearchQuery(event.target.value)}
              placeholder="Search account code or name"
              className="w-full rounded-lg border border-[#c6c6cd] bg-white p-2 text-xs dark:border-[#45464d] dark:bg-[#191c1e]"
            />
            {parentSearchLoading && <p className="text-[11px] text-slate-500">Searching accounts…</p>}
            {parentSearchError && <p role="alert" className="text-[11px] text-red-700 dark:text-red-300">{parentSearchError}</p>}
            {!parentSearchLoading && parentSearchQuery.trim().length >= 2 && !parentSearchError && parentSearchResults.length === 0 && (
              <p className="text-[11px] text-slate-500">No active matching accounts found.</p>
            )}
            {parentSearchResults.length > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border border-[#c6c6cd] dark:border-[#45464d]">
                {parentSearchResults.map(parent => (
                  <li key={parent.id}>
                    <button
                      type="button"
                      onClick={() => selectParentAccount(parent)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-[#2d3133]"
                    >
                      <span className="font-mono font-bold">{parent.code || parent.id}</span>
                      <span className="ml-2">{parent.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {customer.parentCustomerId && (
              <button type="button" onClick={() => setParentSearchOpen(false)} className="text-[11px] font-semibold text-[#00355f] dark:text-[#8ebdf9]">
                Cancel parent change
              </button>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Each account can have only one active parent within a company.
            </p>
          </div>
        )}
      </section>
      {isCorporate ? (
        <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
            <Heart size={15} /> Corporate Customer Governance
          </h3>
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <span className="font-bold text-[#00355f] dark:text-[#8ebdf9] text-xs block">B2B Account Standards</span>
            <p>Personal consumer demographics (gender, DOB, marital anniversary), family dependants, and retail shopper loyalty controls are suppressed for Corporate / B2B customer accounts.</p>
            <p className="text-[11px] text-slate-500">Corporate branch stores and delivery network mapping are managed through the <strong>Corporate Network</strong> tab. Statutory and commercial terms apply directly.</p>
          </div>
        </div>
      ) : (
        <>
      {/* 1. Personal Demographics Details */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Heart size={15} /> Personal Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          {/* Gender Radio Group */}
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-2">
              Gender
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="gender"
                  value="Female"
                  checked={customer.gender === "Female"}
                  onChange={() => onChange("gender", "Female")}
                  className="text-[#00355f] focus:ring-[#00355f]"
                />
                <span>Female</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="gender"
                  value="Male"
                  checked={customer.gender === "Male"}
                  onChange={() => onChange("gender", "Male")}
                  className="text-[#00355f] focus:ring-[#00355f]"
                />
                <span>Male</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="gender"
                  value="Other"
                  checked={customer.gender === "Other"}
                  onChange={() => onChange("gender", "Other")}
                  className="text-[#00355f] focus:ring-[#00355f]"
                />
                <span>Other</span>
              </label>
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Date of Birth
            </label>
            <div className="relative">
              <input
                type="date"
                value={customer.dateOfBirth}
                onChange={e => onChange("dateOfBirth", e.target.value)}
                className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-medium"
              />
            </div>
          </div>

          {/* Marital Status Checkbox */}
          <div className="flex items-center gap-2 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customer.isMarried}
                onChange={e => {
                  onChange("isMarried", e.target.checked);
                  if (!e.target.checked) onChange("weddingAnniversary", "");
                }}
                className="rounded text-[#00355f] focus:ring-[#00355f]"
              />
              <span className="font-bold text-xs text-[#00355f] dark:text-[#8ebdf9]">
                Married Status
              </span>
            </label>
          </div>

          {/* Wedding Anniversary Datepicker (enabled only if isMarried) */}
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Wedding Anniversary
            </label>
            <input
              type="date"
              disabled={!customer.isMarried}
              value={customer.weddingAnniversary}
              onChange={e => onChange("weddingAnniversary", e.target.value)}
              className={`w-full p-2 border rounded-lg text-xs font-medium ${
                customer.isMarried
                  ? "bg-white dark:bg-[#191c1e] border-[#c6c6cd] dark:border-[#45464d]"
                  : "bg-[#f2f4f6] dark:bg-[#2d3133] border-[#e0e3e5] cursor-not-allowed opacity-50"
              }`}
            />
          </div>

        </div>
      </div>

      {/* 2. Sub-Ordinate or Dependant Details */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Users size={15} /> Sub-Ordinate or Dependant Details
        </h3>

        {/* Parent Customer Setting: Show Child Customers in Billing */}
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-[#131b2e] dark:to-[#19223c] rounded-xl border border-blue-200 dark:border-blue-900/50">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#00355f] dark:text-[#8ebdf9]">
                Allow child accounts under this account to be selected in billing
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                customer.showChildCustomersInBilling
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
              }`}>
                {customer.showChildCustomersInBilling ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0] leading-tight">
              When enabled, eligible direct child accounts can be searched and selected while creating bills or sales invoices.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-4">
            <input
              type="checkbox"
              id="toggle-show-child-billing"
              checked={Boolean(customer.showChildCustomersInBilling)}
              onChange={e => {
                onChange("showChildCustomersInBilling", e.target.checked);
                onChange("show_child_customers_in_billing", e.target.checked);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Dependants List Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0]">
              Registered Dependants ({customer.dependants.length})
            </span>
          </div>

          {/* Add Dependant Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-[#f2f4f6] dark:bg-[#131b2e] p-2.5 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
            <input
              type="text"
              placeholder="Dependant Code (e.g. DEP-001)"
              value={newDepCode}
              onChange={e => setNewDepCode(e.target.value)}
              className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded font-mono text-xs"
            />
            <input
              type="text"
              placeholder="Dependant Name (e.g. Sara Jameel)"
              value={newDepName}
              onChange={e => setNewDepName(e.target.value)}
              className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs font-bold"
            />
            <select
              value={newDepRelation}
              onChange={e => setNewDepRelation(e.target.value)}
              className="p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-xs font-semibold"
            >
              <option value="Spouse">Spouse</option>
              <option value="Child">Child / Son / Daughter</option>
              <option value="Parent">Parent / Father / Mother</option>
              <option value="Sibling">Sibling / Brother / Sister</option>
              <option value="Other">Other</option>
            </select>
            <button
              type="button"
              onClick={handleAddDependant}
              className="px-3 py-2 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] rounded font-bold text-xs flex items-center justify-center gap-1 shadow-2xs"
            >
              <Plus size={13} /> Add Dependant
            </button>
          </div>

          {/* Table */}
          <div className="border border-[#c6c6cd] dark:border-[#45464d] rounded-xl overflow-hidden bg-white dark:bg-[#191c1e]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f7f9fb] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0]">
                <tr>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Dependant Name</th>
                  <th className="p-2.5">Relation</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                {customer.dependants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-[#76777d] italic">
                      No dependants registered under this account.
                    </td>
                  </tr>
                ) : (
                  customer.dependants.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]">
                      <td className="p-2.5 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{dep.code}</td>
                      <td className="p-2.5 font-bold">{dep.name}</td>
                      <td className="p-2.5">{dep.relation}</td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveDependant(idx)}
                          className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1 rounded transition"
                          title="Remove Dependant"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Loyalty Program Details */}
      <div className="bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#00355f] dark:text-[#8ebdf9] uppercase tracking-wider flex items-center gap-2 border-b border-[#eceef0] dark:border-[#2d3133] pb-2.5">
          <Award size={15} /> Loyalty Program Details
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Pgm. ID
            </label>
            <input
              type="text"
              value={customer.loyaltyPgmId}
              onChange={e => onChange("loyaltyPgmId", e.target.value)}
              placeholder="e.g. 024"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Pgm. Code
            </label>
            <input
              type="text"
              value={customer.loyaltyPgmCode}
              onChange={e => onChange("loyaltyPgmCode", e.target.value)}
              placeholder="e.g. DSC"
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Membership Tier
            </label>
            <select
              value={customer.loyaltyTier}
              onChange={e => onChange("loyaltyTier", e.target.value)}
              className="w-full p-2 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs font-bold"
            >
              <option value="Standard">Standard</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="Platinum">Platinum</option>
              <option value="Diamond">Diamond Elite</option>
            </select>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Points Balance
            </label>
            <input
              type="number"
              value={customer.loyaltyPointsBalance}
              onChange={e => onChange("loyaltyPointsBalance", parseInt(e.target.value) || 0)}
              className="w-full p-2 bg-[#f7f9fb] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono text-xs font-bold text-[#0c9488]"
            />
          </div>
        </div>
      </div>
      </>
      )}

    </div>
  );
};
