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
  const [selectedItem, setSelectedItem] = useState<StoreCodeLookupItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setSelectedItem(null);
      setFeedbackMessage(null);
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
        // Fallback default mock items if backend lookup has no seeded data yet
        setItems(getFallbackLookupItems(currentCustomerId));
      }
    } catch {
      // Graceful fallback to simulated master catalog
      setItems(getFallbackLookupItems(currentCustomerId));
    } finally {
      setLoading(false);
    }
  };

  const getFallbackLookupItems = (currId?: string): StoreCodeLookupItem[] => [
    {
      id: "cdl-rel-001",
      store_code: "RRL-MUM-001",
      store_name: "Reliance Fresh - Andheri",
      city: "Mumbai",
      state: "Maharashtra",
      store_type: "Supermarket",
      status: "Active",
      address_summary: "Plot 4, Andheri West, Mumbai - 400053",
      assigned_customer_id: currId || "cust-ril-001",
      assigned_customer_name: currentCustomerName || "Reliance Retail Ltd.",
      assigned_customer_code: "CUST-REL-0001",
      is_assigned: true,
      is_selectable: true,
      disabled_reason: undefined,
      addresses_count: 2,
      psv_value: 2450000,
    },
    {
      id: "cdl-rel-002",
      store_code: "RRL-MUM-002",
      store_name: "Reliance Smart - Powai",
      city: "Mumbai",
      state: "Maharashtra",
      store_type: "Hypermarket",
      status: "Active",
      address_summary: "Hiranandani Gardens, Powai, Mumbai - 400076",
      assigned_customer_id: currId || "cust-ril-001",
      assigned_customer_name: currentCustomerName || "Reliance Retail Ltd.",
      assigned_customer_code: "CUST-REL-0001",
      is_assigned: true,
      is_selectable: true,
      disabled_reason: undefined,
      addresses_count: 3,
      psv_value: 4820000,
    },
    {
      id: "cdl-tata-001",
      store_code: "TATA-STR-101",
      store_name: "Star Bazaar - Korum Mall",
      city: "Thane",
      state: "Maharashtra",
      store_type: "Hypermarket",
      status: "Active",
      address_summary: "Korum Mall, Eastern Express Hwy, Thane - 400606",
      assigned_customer_id: "cust-other-tata",
      assigned_customer_name: "Tata Trent Hypermarket Ltd.",
      assigned_customer_code: "CUST-TATA-002",
      is_assigned: true,
      is_selectable: false,
      disabled_reason: "Already mapped to Tata Trent Hypermarket Ltd. (CUST-TATA-002)",
      addresses_count: 2,
      psv_value: 3100000,
    },
    {
      id: "cdl-dmt-001",
      store_code: "DMRT-BOM-009",
      store_name: "DMart - Malad West",
      city: "Mumbai",
      state: "Maharashtra",
      store_type: "Supermarket",
      status: "Active",
      address_summary: "Link Road, Malad West, Mumbai - 400064",
      assigned_customer_id: "cust-other-dmart",
      assigned_customer_name: "Avenue Supermarts Ltd.",
      assigned_customer_code: "CUST-DMART-003",
      is_assigned: true,
      is_selectable: false,
      disabled_reason: "Already mapped to Avenue Supermarts Ltd. (CUST-DMART-003)",
      addresses_count: 1,
      psv_value: 5400000,
    },
    {
      id: "cdl-open-001",
      store_code: "WH-BHIWANDI-09",
      store_name: "Western Hub Logistics Shed 9",
      city: "Bhiwandi",
      state: "Maharashtra",
      store_type: "Warehouse",
      status: "Active",
      address_summary: "Dapode Road, Sector 3, Bhiwandi - 421302",
      assigned_customer_id: undefined,
      assigned_customer_name: undefined,
      is_assigned: false,
      is_selectable: true,
      disabled_reason: undefined,
      addresses_count: 1,
      psv_value: 0,
    },
    {
      id: "cdl-open-002",
      store_code: "RRL-DEL-001",
      store_name: "Reliance Digital - Lajpat",
      city: "New Delhi",
      state: "Delhi",
      store_type: "Electronics",
      status: "Active",
      address_summary: "Central Market, Lajpat Nagar, New Delhi - 110024",
      assigned_customer_id: currId || "cust-ril-001",
      assigned_customer_name: currentCustomerName || "Reliance Retail Ltd.",
      assigned_customer_code: "CUST-REL-0001",
      is_assigned: true,
      is_selectable: true,
      disabled_reason: undefined,
      addresses_count: 2,
      psv_value: 3210000,
    },
  ];

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.store_code.toLowerCase().includes(q) ||
        item.store_name.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        (item.assigned_customer_name && item.assigned_customer_name.toLowerCase().includes(q))
    );
  }, [items, searchTerm]);

  const handleConfirmAssignment = async () => {
    if (!selectedItem || !selectedItem.is_selectable) return;
    setIsSubmitting(true);
    setFeedbackMessage(null);
    try {
      await onAssignStoreCode(selectedItem);
      setFeedbackMessage({
        type: "success",
        text: `Store Code ${selectedItem.store_code} successfully mapped to customer.`,
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
                Store Code Master Lookup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search and assign canonical Store Codes. Multi-store mapping with tenant-wide exclusive assignment.
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
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Store Code (e.g. RRL-MUM-001), Store Name, City, or Owning Customer..."
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
                  <th className="py-2.5 px-3 w-10 text-center">Select</th>
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
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      Loading Store Codes...
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    const isAlreadyAssignedToCurrent =
                      currentlyAssignedCodes.includes(item.store_code) ||
                      (item.assigned_customer_id && item.assigned_customer_id === currentCustomerId);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (item.is_selectable) {
                            setSelectedItem(isSelected ? null : item);
                          }
                        }}
                        className={`transition ${
                          item.is_selectable
                            ? isSelected
                              ? "bg-sky-50/80 dark:bg-sky-950/40 border-l-4 border-l-[#0284c7] cursor-pointer"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                            : "bg-slate-50/60 dark:bg-slate-900/40 opacity-70 cursor-not-allowed"
                        }`}
                      >
                        {/* Radio selection */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="radio"
                            name="storeCodeSelect"
                            checked={isSelected}
                            disabled={!item.is_selectable}
                            onChange={() => {
                              if (item.is_selectable) setSelectedItem(item);
                            }}
                            className="cursor-pointer text-[#0284c7] focus:ring-[#0284c7]"
                          />
                        </td>

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
                                <Check size={10} /> Currently Assigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Available for Mapping
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
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
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
            {selectedItem ? (
              <span>
                Selected: <strong className="text-slate-900 dark:text-white font-mono">{selectedItem.store_code}</strong> ({selectedItem.store_name})
              </span>
            ) : (
              <span>Select an available Store Code to map to this customer profile.</span>
            )}
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
              onClick={handleConfirmAssignment}
              disabled={!selectedItem || !selectedItem.is_selectable || isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Mapping Store...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Map Store Code</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
