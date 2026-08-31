/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { ProPosCustomer } from "./types.ts";
import { X, Search, Award, Star, CheckCircle, Info } from "lucide-react";

interface SmritiLoyaltyLookupDlgpModalProps {
  currentCustomer?: ProPosCustomer;
  onApplyLoyaltyPoints: (points: number, amountDiscount: number) => void;
  onSelectCustomer: (customer: ProPosCustomer) => void;
  onClose: () => void;
}

const MOCK_LOYALTY_CUSTOMERS: ProPosCustomer[] = [
  {
    id: "cust-1",
    code: "CUST-1001",
    name: "Farida Jameel",
    phone: "9876543210",
    email: "farida@example.com",
    loyaltyTier: "Platinum",
    loyaltyPoints: 4500,
    creditLimit: 50000,
    currentBalance: 12400
  },
  {
    id: "cust-2",
    code: "CUST-1002",
    name: "Rajesh Sharma",
    phone: "9811223344",
    email: "rajesh.sharma@example.com",
    loyaltyTier: "Gold",
    loyaltyPoints: 2100,
    creditLimit: 25000,
    currentBalance: 0
  },
  {
    id: "cust-3",
    code: "CUST-1003",
    name: "Ananya Roy",
    phone: "9900112233",
    email: "ananya.roy@example.com",
    loyaltyTier: "Silver",
    loyaltyPoints: 850,
    creditLimit: 10000,
    currentBalance: 3200
  }
];

export const SmritiLoyaltyLookupDlgpModal: React.FC<SmritiLoyaltyLookupDlgpModalProps> = ({
  currentCustomer,
  onApplyLoyaltyPoints,
  onSelectCustomer,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCust, setSelectedCust] = useState<ProPosCustomer>(() => {
    return currentCustomer || MOCK_LOYALTY_CUSTOMERS[0];
  });
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(500);

  const POINT_CONVERSION_RATE = 0.5; // 1 point = ₹0.50

  const redemptionValue = useMemo(() => {
    return pointsToRedeem * POINT_CONVERSION_RATE;
  }, [pointsToRedeem]);

  const maxPointsAvailable = selectedCust?.loyaltyPoints || 0;
  const remainingPoints = Math.max(0, maxPointsAvailable - pointsToRedeem);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_LOYALTY_CUSTOMERS;
    const q = searchQuery.toLowerCase();
    return MOCK_LOYALTY_CUSTOMERS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q))
    );
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

          {/* Matching Customers dropdown/list if searching */}
          {searchQuery.trim() && (
            <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-xl max-h-32 overflow-y-auto divide-y divide-[#eceef0] dark:divide-[#2d3133]">
              {filteredCustomers.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCust(c);
                    setSearchQuery("");
                  }}
                  className="p-2.5 hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] cursor-pointer text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[#565e74] ml-2 font-mono text-[11px]">{c.phone}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#dde1ff] text-[#00288e] rounded text-[10px] font-bold">
                    {c.loyaltyPoints} pts
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Active Customer Profile Card */}
          {selectedCust && (
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
                      <span className="text-xs font-bold text-[#d97706]">{selectedCust.loyaltyTier || "Silver Member"}</span>
                      <span className="text-xs text-[#565e74] dark:text-[#bec6e0] ml-1">({selectedCust.phone})</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                    Available Rewards
                  </span>
                  <div className="text-xl font-bold font-mono text-[#00288e] dark:text-[#a8b8ff]">
                    {selectedCust.loyaltyPoints?.toLocaleString()} pts
                  </div>
                  <div className="text-xs font-mono text-[#0c9488] font-semibold">
                    Worth ₹{((selectedCust.loyaltyPoints || 0) * POINT_CONVERSION_RATE).toFixed(2)}
                  </div>
                </div>
              </div>
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
            disabled={pointsToRedeem <= 0}
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
