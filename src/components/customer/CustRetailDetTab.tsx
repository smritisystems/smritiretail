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

import React, { useState } from "react";
import { Users, Heart, Award, Plus, Trash2, Calendar, Sparkles } from "lucide-react";
import { RetailCustomerRecord, CustomerDependantEntry } from "./types.ts";

interface SmritiCustomerRetailDetailsTabProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
}

export const SmritiCustomerRetailDetailsTab: React.FC<SmritiCustomerRetailDetailsTabProps> = ({
  customer,
  onChange
}) => {
  const [newDepCode, setNewDepCode] = useState("");
  const [newDepName, setNewDepName] = useState("");
  const [newDepRelation, setNewDepRelation] = useState("Spouse");

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

        {/* Primary Account Link Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#f7f9fb] dark:bg-[#2d3133]/40 p-3 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={customer.isDependant}
                onChange={e => onChange("isDependant", e.target.checked)}
                className="rounded text-[#00355f]"
              />
              <span className="font-bold text-xs text-[#00355f] dark:text-[#8ebdf9]">
                Dependant / Sub-Ordinate Account
              </span>
            </label>
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Primary Parent Code
            </label>
            <input
              type="text"
              disabled={!customer.isDependant}
              value={customer.primaryAccountCode}
              onChange={e => onChange("primaryAccountCode", e.target.value)}
              placeholder="e.g. CUST-PRIMARY-001"
              className={`w-full p-2 border rounded-lg font-mono text-xs ${
                customer.isDependant
                  ? "bg-white dark:bg-[#191c1e] border-[#c6c6cd]"
                  : "bg-[#f2f4f6] dark:bg-[#2d3133] cursor-not-allowed opacity-50"
              }`}
            />
          </div>

          <div>
            <label className="text-[#515f74] dark:text-[#bec6e0] font-bold text-[10px] uppercase block mb-1">
              Primary Account Name
            </label>
            <input
              type="text"
              disabled={!customer.isDependant}
              value={customer.primaryAccountName}
              onChange={e => onChange("primaryAccountName", e.target.value)}
              placeholder="e.g. Jameel Ahmed"
              className={`w-full p-2 border rounded-lg text-xs ${
                customer.isDependant
                  ? "bg-white dark:bg-[#191c1e] border-[#c6c6cd]"
                  : "bg-[#f2f4f6] dark:bg-[#2d3133] cursor-not-allowed opacity-50"
              }`}
            />
          </div>
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

    </div>
  );
};
