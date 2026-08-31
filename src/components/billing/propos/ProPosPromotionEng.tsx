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

import React, { useState } from "react";
import { PromotionRule } from "./types.ts";
import { 
  Sparkles, 
  Tag, 
  Plus, 
  Calendar, 
  CheckCircle, 
  PauseCircle, 
  Percent, 
  Gift, 
  Clock, 
  Search,
  Filter
} from "lucide-react";

export const SmritiPromotionEngineine: React.FC = () => {
  const [promotions, setPromotions] = useState<PromotionRule[]>([
    {
      id: "promo-1",
      name: "Weekend Footwear Fest (Buy 2 Get 1 Free)",
      code: "B2G1-FOOTWEAR",
      type: "BUY_X_GET_Y",
      description: "Buy any 2 pairs of footwear and get the 3rd pair free.",
      startDate: "2026-08-20",
      endDate: "2026-08-31",
      minQuantity: 3,
      discountValue: 100,
      applicableCategories: ["Footwear"],
      isActive: true,
      usageCount: 142
    },
    {
      id: "promo-2",
      name: "Flat ₹500 Off on Bills Above ₹3,999",
      code: "FESTIVE500",
      type: "FLAT_DISCOUNT",
      description: "Instant cash discount applied on checkout subtotal.",
      startDate: "2026-08-15",
      endDate: "2026-09-15",
      minBillAmount: 3999,
      discountValue: 500,
      isActive: true,
      usageCount: 89
    },
    {
      id: "promo-3",
      name: "Evening Happy Hours (15% Off 06 PM - 09 PM)",
      code: "HAPPY-HOURS-15",
      type: "HAPPY_HOURS",
      description: "Time-triggered promotional scheme for rush evening shoppers.",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      discountValue: 15,
      isActive: true,
      usageCount: 310
    }
  ]);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredPromos = promotions.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePromoStatus = (id: string) => {
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-y-auto p-6 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#c4c5d5] dark:border-[#444653]">
          <div>
            <h1 className="text-xl font-bold text-[#00288e] dark:text-[#a8b8ff] flex items-center gap-2">
              <Sparkles size={22} />
              ProPOS Promotion &amp; Discount Engine
            </h1>
            <p className="text-xs text-[#565e74] dark:text-[#bec6e0] mt-0.5">
              Automated campaign rules, Buy X Get Y, basket thresholds, and time-based triggers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              New Promotion Rule
            </button>
          </div>
        </div>

        {/* Promo List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredPromos.map(p => (
            <div
              key={p.id}
              className="bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="px-2.5 py-0.5 bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white rounded-lg text-[10px] font-bold font-mono uppercase">
                    {p.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => togglePromoStatus(p.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      p.isActive ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f5] text-[#565e74]"
                    }`}
                  >
                    {p.isActive ? <CheckCircle size={11} /> : <PauseCircle size={11} />}
                    {p.isActive ? "Active" : "Paused"}
                  </button>
                </div>

                <h3 className="text-sm font-bold text-[#191c1d] dark:text-white leading-tight">
                  {p.name}
                </h3>
                <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">{p.description}</p>
              </div>

              <div className="pt-3 border-t border-[#eceef0] dark:border-[#444653] flex justify-between items-center text-xs">
                <div className="flex items-center gap-1 text-[#565e74] dark:text-[#bec6e0]">
                  <Calendar size={13} />
                  <span>Valid: {p.endDate}</span>
                </div>
                <span className="font-bold text-[#00288e] dark:text-[#a8b8ff] font-mono">
                  {p.usageCount} Redeemed
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SmritiPromotionEngineine;
