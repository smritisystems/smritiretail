/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-19
 * Modified     : 2026-10-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Store Network & Mapping Panel (Tab 2)
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Building2,
  MapPin,
  Plus,
  ArrowRight,
  ExternalLink,
  Layers,
  CheckCircle2,
  Store
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";
import { StoreCodeLookupModal } from "../corporate360/StoreCodeLookupModal.tsx";
import { StoreCodeLookupItem } from "../corporate360/types.ts";

export interface MappedStoreEntry {
  id?: string;
  storeCode: string;
  storeName: string;
  city: string;
  status: "Active" | "Inactive" | string;
}

interface CorporateNetworkPanelProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  mappedStores?: MappedStoreEntry[];
  onStoreAssigned?: (store: StoreCodeLookupItem) => Promise<void> | void;
}

export const CorporateNetworkPanel: React.FC<CorporateNetworkPanelProps> = ({
  customer,
  onChange,
  mappedStores: propStores,
  onStoreAssigned,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);

  // Derive mapped stores from prop or customer delivery locations or fallback corporate seed
  const stores: MappedStoreEntry[] = useMemo(() => {
    if (propStores && propStores.length > 0) return propStores;

    // Check if customer delivery locations exist in mailingAddresses with store codes
    const fromAddresses = (customer.mailingAddresses || [])
      .filter(a => a.storeCode || a.shippingStoreCode || a.billingStoreCode)
      .map((a) => ({
        id: a.id || a.code || `${a.storeCode || a.shippingStoreCode || "location"}`,
        storeCode: a.storeCode || a.shippingStoreCode || "—",
        storeName: a.locationName || (a.contactPerson ? `${a.contactPerson} Store` : "Unnamed location"),
        city: a.city || "—",
        status: "Active"
      }));

    return fromAddresses;
  }, [propStores, customer.mailingAddresses]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return stores;
    return stores.filter(
      s =>
        s.storeCode.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
    );
  }, [stores, searchTerm]);

  // Dynamic metrics calculation
  const totalLocations = stores.length;
  const mappedCount = stores.length;
  const unmappedCount = 0;

  const currentlyAssignedCodes = useMemo(() => stores.map(s => s.storeCode), [stores]);

  const handleAssign = async (storeItem: StoreCodeLookupItem) => {
    if (onStoreAssigned) {
      await onStoreAssigned(storeItem);
    }
    setIsLookupModalOpen(false);
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5 text-xs">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[#00355f] dark:text-[#8ebdf9]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
            Corporate Network
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsLookupModalOpen(true)}
          className="text-xs font-bold text-[#005fb8] dark:text-[#8ebdf9] hover:underline flex items-center gap-1"
        >
          Manage Mapping
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Account Hierarchy & Location Metrics (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Parent Account Input */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Parent Account
            </label>
            <div className="relative">
              <input
                type="text"
                value={customer.corporateParent || customer.primaryAccountName || (customer.name?.toLowerCase().includes("reliance") ? "Reliance Industries Limited" : "")}
                onChange={e => onChange("corporateParent", e.target.value)}
                placeholder="e.g. Reliance Industries Limited"
                className="w-full p-2 pr-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:bg-white focus:border-[#00355f] outline-none"
              />
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Network Type Select */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              Network Type
            </label>
            <select
              value={customer.networkType || "Multi-Store Retail"}
              onChange={e => onChange("networkType", e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:bg-white focus:border-[#00355f] outline-none"
            >
              <option value="Multi-Store Retail">Multi-Store Retail</option>
              <option value="Hub & Spoke Network">Hub &amp; Spoke Network</option>
              <option value="Franchise Network">Franchise Network</option>
              <option value="Centralized Purchasing">Centralized Purchasing</option>
              <option value="Independent Outlets">Independent Outlets</option>
            </select>
          </div>

          {/* Metric Badges Summary Box (Matching reference screenshot) */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              Network Summary
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              
              {/* Total Locations */}
              <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Total Locations
                </span>
                <span className="text-xl font-extrabold text-[#00355f] dark:text-[#8ebdf9]">
                  {totalLocations}
                </span>
              </div>

              {/* Mapped Store Codes */}
              <div className="bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Mapped Store Codes
                </span>
                <span className="text-xl font-extrabold text-sky-700 dark:text-sky-300">
                  {mappedCount}
                </span>
              </div>

              {/* Unmapped Locations */}
              <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                  Unmapped Locations
                </span>
                <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                  {unmappedCount}
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Mapped Store Codes Table (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Table Header with Search */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Mapped Store Codes ({stores.length})
            </span>

            <div className="relative w-48 sm:w-60">
              <input
                type="text"
                placeholder="Search store, code or city..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-1.5 pl-7 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:bg-white focus:border-[#00355f]"
              />
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Mapped Stores Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-2.5 w-8">#</th>
                  <th className="p-2.5">Store Code</th>
                  <th className="p-2.5">Store Name</th>
                  <th className="p-2.5">City</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStores.map((store, idx) => (
                  <tr key={store.id || store.storeCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-2.5 font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {store.storeCode}
                    </td>
                    <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300">
                      {store.storeName}
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {store.city}
                    </td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {store.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      No matching store codes mapped.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Lookup Store Modal */}
      <StoreCodeLookupModal
        isOpen={isLookupModalOpen}
        onClose={() => setIsLookupModalOpen(false)}
        currentCustomerId={customer.id}
        currentCustomerName={customer.name}
        currentlyAssignedCodes={currentlyAssignedCodes}
        onAssignStoreCode={handleAssign}
      />

    </div>
  );
};
