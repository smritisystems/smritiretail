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
 * Target UI    : Corporate Store Network Table Component
 */

import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ArrowRight, ExternalLink, Plus, MapPin } from "lucide-react";
import { CorporateStoreItem, StoreAddressItem, StoreCodeLookupItem } from "./types.ts";
import { StoreCodeLookupModal } from "./StoreCodeLookupModal.tsx";
import { StoreAddressModal } from "./StoreAddressModal.tsx";

interface CorporateStoreNetworkProps {
  stores: CorporateStoreItem[];
  customerId?: string;
  customerName?: string;
  totalStoresCount?: number;
  totalCount?: number;
  onViewAllStores?: () => void;
  onSelectStore?: (store: CorporateStoreItem) => void;
  onStoreAssigned?: (store: StoreCodeLookupItem) => Promise<void> | void;
}

export const CorporateStoreNetwork: React.FC<CorporateStoreNetworkProps> = ({
  stores: initialStores,
  customerId,
  customerName,
  totalStoresCount,
  totalCount,
  onViewAllStores,
  onSelectStore,
  onStoreAssigned,
}) => {
  const [stores, setStores] = useState<CorporateStoreItem[]>(initialStores);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Modals state
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [selectedAddressStore, setSelectedAddressStore] = useState<CorporateStoreItem | null>(null);

  // Sync with initialStores prop if it changes
  React.useEffect(() => {
    setStores(initialStores);
  }, [initialStores]);

  // Extract unique regions & types for filters
  const regions = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.state) set.add(s.state);
      else if (s.city) set.add(s.city);
    });
    return Array.from(set).sort();
  }, [stores]);

  const storeTypes = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.store_type) set.add(s.store_type);
    });
    return Array.from(set).sort();
  }, [stores]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.store_code.toLowerCase().includes(q) ||
        s.store_name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.address_summary && s.address_summary.toLowerCase().includes(q));

      const matchRegion =
        selectedRegion === "ALL" ||
        s.state === selectedRegion ||
        s.city === selectedRegion;

      const matchType = selectedType === "ALL" || s.store_type === selectedType;

      const matchStatus =
        selectedStatus === "ALL" ||
        s.status.toUpperCase() === selectedStatus.toUpperCase();

      return matchSearch && matchRegion && matchType && matchStatus;
    });
  }, [stores, searchTerm, selectedRegion, selectedType, selectedStatus]);

  // Paginated stores
  const paginatedStores = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, page, pageSize]);

  const totalStores = totalStoresCount ?? totalCount ?? stores.length;

  const formatPsv = (val: number) => {
    if (val >= 10000000) {
      return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹ ${(val / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  };

  const handleAssignStore = async (lookupStore: StoreCodeLookupItem) => {
    if (onStoreAssigned) {
      await onStoreAssigned(lookupStore);
    }
    // Optimistically add to local state if not present
    if (!stores.some((s) => s.store_code === lookupStore.store_code)) {
      const newStoreItem: CorporateStoreItem = {
        id: lookupStore.id,
        store_code: lookupStore.store_code,
        store_name: lookupStore.store_name,
        city: lookupStore.city,
        state: lookupStore.state || "Maharashtra",
        store_type: lookupStore.store_type,
        status: lookupStore.status,
        psv_value: lookupStore.psv_value || 0,
        contact: lookupStore.assigned_customer_name || "Assigned Manager",
        address_summary: lookupStore.address_summary,
        addresses: [],
      };
      setStores((prev) => [newStoreItem, ...prev]);
    }
  };

  const handleAddressesUpdated = (updatedAddresses: StoreAddressItem[]) => {
    if (!selectedAddressStore) return;
    const primary = updatedAddresses.find((a) => a.is_primary && a.is_active) || updatedAddresses[0];
    const summary = primary
      ? `${primary.address_line1}, ${primary.city} - ${primary.pincode}`
      : selectedAddressStore.address_summary;

    setStores((prev) =>
      prev.map((s) =>
        s.id === selectedAddressStore.id
          ? { ...s, addresses: updatedAddresses, address_summary: summary }
          : s
      )
    );
  };

  return (
    <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Store Network ({totalStores.toLocaleString("en-IN")} Stores)
            </h2>
            <button
              type="button"
              onClick={() => setIsLookupOpen(true)}
              className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center gap-1 shadow-xs transition"
              title="Search and map canonical Store Codes"
            >
              <Plus size={13} />
              <span>Map Store Code</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs w-full sm:w-auto">
            {/* Regions Filter */}
            <select
              value={selectedRegion}
              onChange={(e) => { setSelectedRegion(e.target.value); setPage(1); }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
            >
              <option value="ALL">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* Store Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
            >
              <option value="ALL">All Store Types</option>
              {storeTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-[#0284c7]"
            >
              <option value="ALL">Status: All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Store Code, Name, City, or Address..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#0284c7]"
          />
        </div>

        {/* Dense Store Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3">Store Code</th>
                <th className="py-2.5 px-3">Store Name</th>
                <th className="py-2.5 px-3">City</th>
                <th className="py-2.5 px-3">Address Summary</th>
                <th className="py-2.5 px-3">Store Type</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">PSV Value</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedStores.length > 0 ? (
                paginatedStores.map((store) => (
                  <tr
                    key={store.id || store.store_code}
                    onClick={() => onSelectStore?.(store)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer group"
                  >
                    <td className="py-2 px-3 font-mono font-semibold text-[#0284c7] dark:text-[#38bdf8] whitespace-nowrap group-hover:underline">
                      {store.store_code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <div>{store.store_name}</div>
                      {(store.contact_person || store.contact) && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {store.contact_person || store.contact}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {store.city}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={store.address_summary}>
                      {store.address_summary || `${store.city}, ${store.state || "Maharashtra"}`}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {store.store_type}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        store.status.toUpperCase() === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {store.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {store.psv_value_display ? (
                        <span className={store.psv_status === "Not Reporting" ? "text-slate-400 font-sans italic text-[11px]" : ""}>
                          {store.psv_value_display}
                        </span>
                      ) : (
                        formatPsv(store.psv_value)
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedAddressStore(store)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-[#0284c7] dark:text-[#38bdf8] bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 transition inline-flex items-center gap-1"
                        title="Manage typed addresses for this Store Code"
                      >
                        <MapPin size={11} />
                        <span>Addresses ({store.addresses?.filter(a => a.is_active).length || 1})</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No matching stores found in network.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Navigation Link */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          Showing {paginatedStores.length} of {filteredStores.length} stores
        </span>

        <button
          type="button"
          onClick={onViewAllStores}
          className="text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] font-semibold flex items-center gap-1 transition"
        >
          <span>View All {totalStores.toLocaleString("en-IN")} Stores</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Store Code Lookup Modal */}
      <StoreCodeLookupModal
        isOpen={isLookupOpen}
        onClose={() => setIsLookupOpen(false)}
        currentCustomerId={customerId}
        currentCustomerName={customerName}
        currentlyAssignedCodes={stores.map((s) => s.store_code)}
        onAssignStoreCode={handleAssignStore}
      />

      {/* Store Address Modal */}
      <StoreAddressModal
        isOpen={Boolean(selectedAddressStore)}
        onClose={() => setSelectedAddressStore(null)}
        customerId={customerId}
        store={selectedAddressStore}
        onAddressesUpdated={handleAddressesUpdated}
      />
    </div>
  );
};
