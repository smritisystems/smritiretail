/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-18
 * Modified     : 2026-10-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Searchable Store Code Master Lookup Modal
 */

import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Check, AlertCircle, Lock, Building, MapPin, Store } from "lucide-react";
import { StoreCodeLookupItem } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

interface StoreCodeLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomerId?: string;
  currentCustomerName?: string;
  currentlyAssignedCodes?: string[];
  onAssignStoreCode: (store: StoreCodeLookupItem) => Promise<void> | void;
}

export const StoreCodeLookupModal: React.FC<StoreCodeLookupModalProps> = ({
  isOpen,
  onClose,
  currentCustomerId,
  currentCustomerName,
  currentlyAssignedCodes = [],
  onAssignStoreCode,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StoreCodeLookupItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStoreCode, setNewStoreCode] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setFeedbackMessage(null);
      setNewStoreCode("");
      setNewStoreName("");
      setNewCity("");
      setNewAddress("");
      return;
    }
    fetchLookupItems();
  }, [isOpen, currentCustomerId]);

  const fetchLookupItems = async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q && q.trim()) params.append("q", q.trim());
      if (currentCustomerId) params.append("currentCustomerId", currentCustomerId);
      params.append("limit", "100");

      const res = await apiFetchV1<StoreCodeLookupItem[]>(`/crm/store-codes/lookup?${params.toString()}`);
      if (Array.isArray(res)) {
        setItems(res);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.store_code.toLowerCase().includes(q) ||
        item.store_name.toLowerCase().includes(q) ||
        (item.city || "").toLowerCase().includes(q) ||
        (item.assigned_customer_name && item.assigned_customer_name.toLowerCase().includes(q))
    );
  }, [items, searchTerm]);

  const handleCreateLocation = async () => {
    if (!currentCustomerId || !newStoreCode.trim() || !newStoreName.trim()) return;
    setIsSubmitting(true);
    setFeedbackMessage(null);
    try {
      const saved = await apiFetchV1<any>(`/crm/customers/${currentCustomerId}/delivery-locations`, {
        method: "POST",
        body: {
          storeCode: newStoreCode.trim().toUpperCase(),
          locationName: newStoreName.trim(),
          city: newCity.trim() || undefined,
          addressLine1: newAddress.trim() || undefined,
          source: "MANUAL",
          status: "ACTIVE",
        },
      });
      await onAssignStoreCode({
        id: saved.id,
        store_code: saved.store_code ?? saved.storeCode ?? newStoreCode.trim().toUpperCase(),
        store_name: saved.location_name ?? saved.locationName ?? newStoreName.trim(),
        city: saved.city ?? newCity.trim(),
        state: saved.state ?? "",
        store_type: "Customer Location",
        status: saved.status ?? "ACTIVE",
        address_summary: saved.address_line1 ?? saved.addressLine1 ?? newAddress.trim(),
        is_assigned: true,
        is_selectable: false,
        addresses_count: 1,
        psv_value: 0,
      });
      setFeedbackMessage({
        type: "success",
        text: `Store location ${newStoreCode.trim().toUpperCase()} was saved to this customer.`,
      });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Failed to assign Store Code. Please verify permissions.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8]">
              <Store size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Customer Store Location
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create a persisted customer delivery location. The store code is an external identifier; the saved location ID is the internal identity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Feedback Alert */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          {!currentCustomerId ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Save the customer before adding store locations.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <input aria-label="Store code" data-field-key="store_code" placeholder="Store code (required)" value={newStoreCode} onChange={e => setNewStoreCode(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs" />
              <input aria-label="Store or site name" data-field-key="store_name" placeholder="Store / site name (required)" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs" />
              <input aria-label="City" data-field-key="city" placeholder="City" value={newCity} onChange={e => setNewCity(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs" />
              <input aria-label="Address" data-field-key="address_line1" placeholder="Address" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs" />
            </div>
          )}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search existing customer locations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7]"
            />
          </div>

          {feedbackMessage && (
            <div
              className={`mt-2.5 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              }`}
            >
              {feedbackMessage.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{feedbackMessage.text}</span>
            </div>
          )}
        </div>

        {/* Store Code Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3">Record</th>
                  <th className="py-2.5 px-3">Store Code</th>
                  <th className="py-2.5 px-3">Store / Site Name</th>
                  <th className="py-2.5 px-3">City & Address</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Mapping Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      Loading Store Codes...
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isAlreadyAssignedToCurrent =
                      currentlyAssignedCodes.includes(item.store_code) ||
                      (item.assigned_customer_id && item.assigned_customer_id === currentCustomerId);

                    return (
                      <tr key={item.id} className={item.is_selectable ? "" : "bg-slate-50/60 dark:bg-slate-900/40 opacity-70"}>

                        {/* Store Code */}
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#0284c7] dark:text-[#38bdf8] border border-slate-200 dark:border-slate-700">
                            {item.store_code}
                          </span>
                        </td>

                        {/* Store Name */}
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {item.store_name}
                        </td>

                        {/* City & Address Summary */}
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1.5">{item.city}:</span>
                          <span>{item.address_summary}</span>
                        </td>

                        {/* Store Type */}
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.store_type}
                        </td>

                        {/* Mapping Status & Tooltip */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {item.is_selectable ? (
                            isAlreadyAssignedToCurrent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/70 text-[#0284c7] dark:text-[#38bdf8] border border-sky-200 dark:border-sky-800">
                                <Check size={10} /> Saved on this customer
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Available for mapping
                              </span>
                            )
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]" title={item.disabled_reason}>
                              <Lock size={12} className="text-amber-500 shrink-0" />
                              <span className="font-medium text-amber-700 dark:text-amber-400 truncate max-w-[240px]">
                                {item.disabled_reason || "Assigned to another customer"}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No matching Store Codes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>Existing locations are shown for reference. Create a new location above.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateLocation}
              disabled={!currentCustomerId || !newStoreCode.trim() || !newStoreName.trim() || isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Saving Location...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Create Location</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
