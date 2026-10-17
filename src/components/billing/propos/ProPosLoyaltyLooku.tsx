/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { ProPosCustomer } from "./types.ts";
import { X, Search, Award, Star, CheckCircle, Info, Loader2 } from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";

interface SmritiLoyaltyLookupDlgpModalProps {
  currentCustomer?: ProPosCustomer;
  onApplyLoyaltyPoints: (points: number, amountDiscount: number) => void;
  onSelectCustomer: (customer: ProPosCustomer) => void;
  onClose: () => void;
}

export const SmritiLoyaltyLookupDlgpModal: React.FC<SmritiLoyaltyLookupDlgpModalProps> = ({
  currentCustomer,
  onApplyLoyaltyPoints,
  onSelectCustomer,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customers, setCustomers] = useState<ProPosCustomer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCust, setSelectedCust] = useState<ProPosCustomer | null>(() => {
    return currentCustomer || null;
  });
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  const POINT_CONVERSION_RATE = 0.5; // 1 point = ₹0.50

  const redemptionValue = useMemo(() => {
    return pointsToRedeem * POINT_CONVERSION_RATE;
  }, [pointsToRedeem]);

  const maxPointsAvailable = selectedCust?.loyaltyPoints || 0;
  const remainingPoints = Math.max(0, maxPointsAvailable - pointsToRedeem);

  // Live query to CRM customer repository
  useEffect(() => {
    let isCancelled = false;
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const query = searchQuery.trim();
        const url = query
          ? `/crm/customers/search?q=${encodeURIComponent(query)}`
          : `/crm/customers?limit=20`;
        const res = await apiFetchV1<any[]>(url);
        if (!isCancelled && Array.isArray(res)) {
          const mapped: ProPosCustomer[] = res.map((c: any) => ({
            id: c.id,
            code: c.identity_code || c.customer_code || c.code || `CUST-${c.id.slice(0, 6)}`,
            name: c.name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Registered Customer",
            phone: c.mobile_no || c.phone || "",
            email: c.email || "",
            loyaltyTier: c.loyalty_tier || c.loyaltyTier || "Standard",
            loyaltyPoints: Number(c.loyalty_points_balance || c.loyaltyPointsBalance || 0),
            creditLimit: Number(c.credit_limit || 0),
            currentBalance: Number(c.credit_used || 0),
          }));
          setCustomers(mapped);
          if (!selectedCust && mapped.length > 0) {
            setSelectedCust(mapped[0]);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("[ProPosLoyalty] Customer search error:", err);
          setCustomers([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomers();
    return () => {
      isCancelled = true;
    };
  }, [searchQuery]);

  const handleMaxPoints = () => {
    setPointsToRedeem(maxPointsAvailable);
  };

  const handleApply = () => {
    if (selectedCust && pointsToRedeem > 0) {
      onSelectCustomer(selectedCust);
      onApplyLoyaltyPoints(pointsToRedeem, redemptionValue);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white rounded-lg">
              <Award size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#191c1d] dark:text-white">Customer Loyalty &amp; Rewards Lookup</h2>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">Search shopper rewards profile and redeem accumulated points.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          
          {/* Search Bar */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1.5">
              Search Registered Shopper
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#757684]" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Mobile, Customer Name, or Code..."
                className="w-full pl-10 pr-3 py-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs outline-none focus:border-[#00288e]"
              />
            </div>
          </div>

          {/* Matching Customers dropdown/list */}
          {isLoading ? (
            <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-600" />
              <span>Searching customer repository...</span>
            </div>
          ) : searchQuery.trim() && customers.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
              No registered customers found matching "{searchQuery}".
            </div>
          ) : customers.length > 0 ? (
            <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-xl max-h-36 overflow-y-auto divide-y divide-[#eceef0] dark:divide-[#2d3133]">
              {customers.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCust(c);
                    setPointsToRedeem(0);
                  }}
                  className={`p-2.5 cursor-pointer text-xs flex justify-between items-center transition-colors ${
                    selectedCust?.id === c.id
                      ? "bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600"
                      : "hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
                  }`}
                >
                  <div>
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[#565e74] ml-2 font-mono text-[11px]">{c.phone || c.code}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#dde1ff] text-[#00288e] rounded text-[10px] font-bold">
                    {c.loyaltyPoints?.toLocaleString() || 0} pts
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Active Customer Profile Card */}
          {selectedCust ? (
            <div className="bg-[#f8f9fa] dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#dde1ff] text-[#00288e] font-bold text-sm flex items-center justify-center">
                    {selectedCust.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#191c1d] dark:text-white">{selectedCust.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Star size={13} className="text-[#d97706] fill-amber-500" />
                      <span className="text-xs font-bold text-[#d97706]">{selectedCust.loyaltyTier || "Standard Member"}</span>
                      {selectedCust.phone && (
                        <span className="text-xs text-[#565e74] dark:text-[#bec6e0] ml-1">({selectedCust.phone})</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                    Available Rewards
                  </span>
                  <div className="text-xl font-bold font-mono text-[#00288e] dark:text-[#a8b8ff]">
                    {(selectedCust.loyaltyPoints || 0).toLocaleString()} pts
                  </div>
                  <div className="text-xs font-mono text-[#0c9488] font-semibold">
                    Worth ₹{((selectedCust.loyaltyPoints || 0) * POINT_CONVERSION_RATE).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              Please search or select a shopper from the customer master to redeem loyalty points.
            </div>
          )}

          {/* Redemption Input Box */}
          <div className="bg-white dark:bg-[#131b2e] p-4 rounded-xl border border-[#c4c5d5] dark:border-[#444653]">
            <div className="flex justify-between items-end gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1.5">
                  Points to Redeem in this Transaction
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={maxPointsAvailable}
                    value={pointsToRedeem}
                    onChange={e => setPointsToRedeem(Math.min(maxPointsAvailable, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="flex-1 px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-l-xl bg-[#f8f9fa] dark:bg-[#191c1e] text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                  />
                  <button
                    type="button"
                    onClick={handleMaxPoints}
                    className="px-4 py-2 bg-[#edeeef] dark:bg-[#3f465c] border-y border-r border-[#c4c5d5] dark:border-[#444653] rounded-r-xl text-xs font-bold hover:bg-[#d9dadb] transition"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end pb-1 min-w-[120px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                  Bill Discount Value
                </span>
                <span className="text-xl font-bold font-mono text-[#16a34a] mt-0.5">
                  -₹{redemptionValue.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-xs text-[#565e74] dark:text-[#bec6e0] flex items-center gap-1">
              <Info size={13} />
              <span>Remaining balance after redemption: <strong>{remainingPoints.toLocaleString()} pts</strong></span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] rounded-xl text-xs font-bold hover:bg-[#f3f4f5] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedCust || pointsToRedeem <= 0}
            onClick={handleApply}
            className="px-6 py-2 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition flex items-center gap-1.5 shadow-sm disabled:opacity-40"
          >
            <CheckCircle size={15} />
            <span>Apply Loyalty Discount</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiLoyaltyLookupDlgpModal;
